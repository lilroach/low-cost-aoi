import hashlib
import json
import re
import threading
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List

from fastapi import HTTPException

from app.repositories.edge_sync_repository import EdgeDeviceRepository
from app.repositories.edge_sync_state_repository import EdgeSyncStateRepository
from app.schemas.edge_sync import EdgeDeviceConfig, EdgeSyncResult, SyncItem
from app.services.run_import_service import import_run_bundle_file
from app.services.ssh_edge_service import SshEdgeClient


SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


class EdgeSyncService:
    _active_devices: set[str] = set()
    _active_lock = threading.Lock()

    def __init__(
        self,
        device_repository: EdgeDeviceRepository,
        state_repository: EdgeSyncStateRepository,
        imported_runs_dir: Path,
        raw_dir: Path,
        temp_dir: Path,
        client_factory: Callable[[EdgeDeviceConfig], SshEdgeClient] = SshEdgeClient,
    ) -> None:
        self.device_repository = device_repository
        self.state_repository = state_repository
        self.imported_runs_dir = imported_runs_dir
        self.raw_dir = raw_dir
        self.temp_dir = temp_dir
        self.client_factory = client_factory

    def _device(self, device_id: str) -> EdgeDeviceConfig:
        try:
            return self.device_repository.get_device(device_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Edge device not found") from exc

    def list_devices(self) -> List[Dict[str, Any]]:
        result = []
        for device in self.device_repository.list_devices():
            public = self.client_factory(device).public_device().model_dump()
            result.append(
                {
                    **public,
                    "latest": self.state_repository.load_latest(device.device_id),
                }
            )
        return result

    def latest(self, device_id: str) -> Dict[str, Any]:
        self._device(device_id)
        return self.state_repository.load_latest(device_id)

    def test_connection(self, device_id: str) -> Dict[str, Any]:
        client = self.client_factory(self._device(device_id))
        client.test_connection()
        return {
            "status": "ok",
            "device": client.public_device().model_dump(),
            "health": client.read_json("health"),
        }

    def _read_diagnostics(self, client: SshEdgeClient) -> Dict[str, Any]:
        diagnostics: Dict[str, Any] = {}
        for operation in ("health", "camera", "models"):
            try:
                diagnostics[operation] = client.read_json(operation)
            except Exception as exc:
                diagnostics[operation] = {"error": str(exc)}
        for operation in ("disk", "services", "journal"):
            try:
                diagnostics[operation] = client.read_text(operation)
            except Exception as exc:
                diagnostics[operation] = {"error": str(exc)}
        return diagnostics

    def _bundle_run_id(self, bundle_path: Path) -> str:
        with zipfile.ZipFile(bundle_path, "r") as bundle:
            manifest = json.loads(bundle.read("manifest.json"))
        run_id = manifest.get("run_id")
        if not isinstance(run_id, str) or not SAFE_RUN_ID.fullmatch(run_id):
            raise HTTPException(status_code=400, detail="Bundle has an invalid run id")
        return run_id

    def _sync_bundle(
        self,
        client: SshEdgeClient,
        device_id: str,
        operation: str,
        source_key: str,
        sources: Dict[str, List[Dict[str, Any]]],
        run_id: str | None = None,
    ) -> SyncItem:
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = self.temp_dir / f"{device_id}-{uuid.uuid4().hex}.zip"
        try:
            client.download_bundle(operation, temp_path, run_id=run_id)
            checksum = hashlib.sha256(temp_path.read_bytes()).hexdigest()
            versions = sources.setdefault(source_key, [])
            if any(version.get("sha256") == checksum for version in versions):
                return SyncItem(source=source_key, run_id=run_id, status="skipped")

            bundle_run_id = self._bundle_run_id(temp_path)
            if run_id is not None and bundle_run_id != run_id:
                raise HTTPException(status_code=400, detail="History bundle run id mismatch")

            status = "updated" if versions else "added"
            storage_id = f"{device_id}__{bundle_run_id}"
            if status == "updated":
                storage_id = f"{storage_id}__{checksum[:12]}"

            import_run_bundle_file(
                temp_path,
                self.imported_runs_dir,
                self.raw_dir,
                storage_id=storage_id,
                replace_existing=False,
            )
            versions.append(
                {
                    "run_id": bundle_run_id,
                    "sha256": checksum,
                    "storage_id": storage_id,
                    "synced_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            return SyncItem(source=source_key, run_id=bundle_run_id, status=status)
        except Exception as exc:
            return SyncItem(
                source=source_key,
                run_id=run_id,
                status="failed",
                detail=str(exc),
            )
        finally:
            temp_path.unlink(missing_ok=True)

    def sync(self, device_id: str) -> EdgeSyncResult:
        device = self._device(device_id)
        with self._active_lock:
            if device_id in self._active_devices:
                raise HTTPException(status_code=409, detail="Edge sync already running")
            self._active_devices.add(device_id)

        synced_at = datetime.now(timezone.utc).isoformat()
        client = self.client_factory(device)
        latest = self.state_repository.load_latest(device_id)
        sources: Dict[str, List[Dict[str, Any]]] = latest.get("sources", {})
        diagnostics: Dict[str, Any] = {}
        items: List[SyncItem] = []
        try:
            client.test_connection()
            diagnostics = self._read_diagnostics(client)

            try:
                capture = client.read_json("capture")
                diagnostics["capture"] = capture
                if isinstance(capture, dict) and capture.get("ready_for_training", 0) > 0:
                    date = str(capture.get("date", "unknown"))
                    items.append(
                        self._sync_bundle(
                            client,
                            device_id,
                            "capture",
                            f"capture:{date}",
                            sources,
                        )
                    )
            except Exception as exc:
                diagnostics["capture"] = {"error": str(exc)}

            try:
                history = client.read_json("history")
                diagnostics["history"] = history
                if isinstance(history, list):
                    for entry in history:
                        run_id = entry.get("run_id") if isinstance(entry, dict) else None
                        if not isinstance(run_id, str) or not SAFE_RUN_ID.fullmatch(run_id):
                            items.append(
                                SyncItem(
                                    source="history:invalid",
                                    status="failed",
                                    detail="Invalid history run id",
                                )
                            )
                            continue
                        items.append(
                            self._sync_bundle(
                                client,
                                device_id,
                                "history",
                                f"history:{run_id}",
                                sources,
                                run_id=run_id,
                            )
                        )
            except Exception as exc:
                diagnostics["history"] = {"error": str(exc)}

            counts = {
                status: len([item for item in items if item.status == status])
                for status in ("added", "skipped", "updated", "failed")
            }
            result = EdgeSyncResult(
                device=client.public_device(),
                synced_at=synced_at,
                counts=counts,
                items=items,
                diagnostics=diagnostics,
            )
            snapshot = result.model_dump(mode="json")
            snapshot["sources"] = sources
            self.state_repository.save_snapshot(device_id, snapshot)
            return result
        finally:
            with self._active_lock:
                self._active_devices.discard(device_id)
