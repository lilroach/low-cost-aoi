import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from app.repositories.edge_sync_state_repository import EdgeSyncStateRepository
from app.schemas.edge_sync import EdgeDeviceConfig
from app.services.edge_sync_service import EdgeSyncService


def _bundle_bytes(run_id: str, marker: str) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as handle:
        path = Path(handle.name)
    try:
        manifest = {
            "schema_version": "1.0",
            "run_id": run_id,
            "machine_id": "pi-a",
            "created_at": "2026-07-10T12:00:00Z",
            "contents": {
                "report": "report.json",
                "program": "program.json",
                "images_dir": "images",
            },
        }
        report = {
            "metadata": {"machine_id": "pi-a", "marker": marker},
            "total_points": 0,
            "results": [],
            "completed_at": 1,
            "status": "completed",
        }
        with zipfile.ZipFile(path, "w") as bundle:
            bundle.writestr("manifest.json", json.dumps(manifest))
            bundle.writestr("report.json", json.dumps(report))
            bundle.writestr("program.json", '{"points": []}')
            bundle.writestr("images/a.jpg", marker.encode())
        return path.read_bytes()
    finally:
        path.unlink(missing_ok=True)


class FakeDeviceRepository:
    def __init__(self, device: EdgeDeviceConfig) -> None:
        self.device = device

    def list_devices(self):
        return [self.device]

    def get_device(self, device_id: str):
        if device_id != self.device.device_id:
            raise KeyError(device_id)
        return self.device


class FakeSshClient:
    def __init__(self) -> None:
        self.capture_bundle = _bundle_bytes("capture-20260710", "capture-v1")
        self.history_bundles = {"run-1": _bundle_bytes("run-1", "run-v1")}
        self.fail_history = False

    def public_device(self):
        from app.schemas.edge_sync import EdgeDevicePublic

        return EdgeDevicePublic(device_id="edge-a", name="Edge A", host="pi-a", port=22)

    def test_connection(self) -> None:
        return None

    def read_json(self, operation: str):
        responses = {
            "health": {"status": "ok"},
            "camera": {"available": True},
            "models": {"models": [], "active": {}},
            "capture": {"date": "20260710", "ready_for_training": 1},
            "history": [{"run_id": "run-1"}],
        }
        return responses[operation]

    def read_text(self, operation: str) -> str:
        return {"disk": "disk-ok", "services": "active", "journal": "journal-ok"}[operation]

    def download_bundle(self, operation: str, destination: Path, run_id: str | None = None) -> None:
        if operation == "capture":
            destination.write_bytes(self.capture_bundle)
            return
        if self.fail_history:
            raise RuntimeError("history unavailable")
        destination.write_bytes(self.history_bundles[run_id])


class EdgeSyncServiceTests(unittest.TestCase):
    def _service(self, root: Path, client: FakeSshClient):
        device = EdgeDeviceConfig(
            device_id="edge-a",
            name="Edge A",
            host="pi-a",
            user="aoi",
            identity_file=root / "key",
            known_hosts_file=root / "known_hosts",
        )
        state_repository = EdgeSyncStateRepository(root / "edge_sync")
        service = EdgeSyncService(
            device_repository=FakeDeviceRepository(device),
            state_repository=state_repository,
            imported_runs_dir=root / "imported_runs",
            raw_dir=root / "raw",
            temp_dir=root / "tmp",
            client_factory=lambda unused: client,
        )
        return service, state_repository

    def test_repeated_sync_adds_then_skips_unchanged_bundles(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service, unused = self._service(root, FakeSshClient())

            first = service.sync("edge-a")
            second = service.sync("edge-a")

            self.assertEqual(first.counts, {"added": 2, "skipped": 0, "updated": 0, "failed": 0})
            self.assertEqual(second.counts, {"added": 0, "skipped": 2, "updated": 0, "failed": 0})

    def test_changed_bundle_creates_update_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client = FakeSshClient()
            service, repository = self._service(root, client)
            service.sync("edge-a")
            client.history_bundles["run-1"] = _bundle_bytes("run-1", "run-v2")

            result = service.sync("edge-a")

            self.assertEqual(result.counts["updated"], 1)
            self.assertEqual(len(repository.versions("edge-a", "history:run-1")), 2)

    def test_one_bundle_failure_does_not_block_other_imports(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            client = FakeSshClient()
            client.fail_history = True
            service, unused = self._service(root, client)

            result = service.sync("edge-a")

            self.assertEqual(result.counts["added"], 1)
            self.assertEqual(result.counts["failed"], 1)
            self.assertFalse(any(root.rglob("*.incoming")))


if __name__ == "__main__":
    unittest.main()
