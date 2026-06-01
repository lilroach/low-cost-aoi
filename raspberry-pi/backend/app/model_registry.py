import json
import shutil
import zipfile
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional

from app.config import MODEL_ROOT
from app.model_manifest import ModelManifestError, load_model_manifest


ACTIVE_MODELS_FILE = "active.json"


class ModelRegistryError(RuntimeError):
    pass


class ModelRegistry:
    def __init__(self, model_root: Path = MODEL_ROOT):
        self.model_root = model_root
        self.active_path = model_root / ACTIVE_MODELS_FILE
        self._lock = RLock()
        self._models: Dict[str, Dict[str, Any]] = {}
        self.refresh()

    def refresh(self) -> Dict[str, Any]:
        with self._lock:
            self.model_root.mkdir(parents=True, exist_ok=True)
            models: Dict[str, Dict[str, Any]] = {}
            for model_dir in sorted(self.model_root.iterdir()):
                if not model_dir.is_dir():
                    continue
                if model_dir.name.startswith(".") or model_dir.name == "__pycache__":
                    continue
                models[model_dir.name] = self._inspect_model_dir(model_dir)
            self._models = models
            return self.snapshot()

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            active = self.load_active()
            return {
                "model_root": str(self.model_root),
                "models": list(self._models.values()),
                "active": active,
            }

    def list_models(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._models.values())

    def get_model(self, model_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._models.get(model_id)

    def load_active(self) -> Dict[str, str]:
        if not self.active_path.exists():
            return {}
        try:
            with open(self.active_path, "r", encoding="utf-8") as file:
                data = json.load(file)
        except (json.JSONDecodeError, OSError):
            return {}
        if not isinstance(data, dict):
            return {}
        return {str(part_no): str(model_id) for part_no, model_id in data.items()}

    def save_active(self, active: Dict[str, str]) -> None:
        self.model_root.mkdir(parents=True, exist_ok=True)
        with open(self.active_path, "w", encoding="utf-8") as file:
            json.dump(active, file, ensure_ascii=False, indent=2)

    def activate(self, model_id: str) -> Dict[str, Any]:
        with self._lock:
            self.refresh()
            model = self._models.get(model_id)
            if not model:
                raise ModelRegistryError("Model bundle not found")
            if model["status"] != "valid":
                raise ModelRegistryError(f"Model bundle is not valid: {model.get('error')}")

            manifest = model["manifest"]
            part_no = manifest["part_no"]
            active = self.load_active()
            active[part_no] = model_id
            self.save_active(active)
            return {"part_no": part_no, "model_id": model_id, "active": active}

    def active_model_for_part(self, part_no: str) -> Optional[Dict[str, Any]]:
        active = self.load_active()
        model_id = active.get(part_no)
        if not model_id:
            return None
        return self.get_model(model_id)

    def install_zip(self, zip_path: Path) -> Dict[str, Any]:
        with self._lock:
            extract_root = self.model_root / ".incoming"
            if extract_root.exists():
                shutil.rmtree(extract_root)
            extract_root.mkdir(parents=True)

            try:
                with zipfile.ZipFile(zip_path, "r") as bundle:
                    self._safe_extract(bundle, extract_root)

                bundle_dir = self._resolve_extracted_bundle_dir(extract_root)
                manifest = load_model_manifest(bundle_dir)
                model_id = manifest["model_id"]
                target_dir = self.model_root / model_id
                if target_dir.exists():
                    raise ModelRegistryError(f"Model bundle already exists: {model_id}")
                if bundle_dir.name != model_id:
                    renamed_dir = extract_root / model_id
                    bundle_dir.rename(renamed_dir)
                    bundle_dir = renamed_dir
                shutil.move(str(bundle_dir), str(target_dir))
                self.refresh()
                return self._models[model_id]
            finally:
                if extract_root.exists():
                    shutil.rmtree(extract_root)

    def _inspect_model_dir(self, model_dir: Path) -> Dict[str, Any]:
        try:
            manifest = load_model_manifest(model_dir)
            if manifest["model_id"] != model_dir.name:
                raise ModelManifestError("manifest model_id must match bundle folder name")
            return {
                "model_id": manifest["model_id"],
                "part_no": manifest["part_no"],
                "version": manifest["version"],
                "status": "valid",
                "path": str(model_dir),
                "manifest": manifest,
            }
        except Exception as exc:
            return {
                "model_id": model_dir.name,
                "status": "invalid",
                "path": str(model_dir),
                "error": str(exc),
                "manifest": None,
            }

    def _safe_extract(self, bundle: zipfile.ZipFile, destination: Path) -> None:
        destination = destination.resolve()
        for member in bundle.infolist():
            target = (destination / member.filename).resolve()
            if not str(target).startswith(str(destination)):
                raise ModelRegistryError("Model bundle contains unsafe paths")
        bundle.extractall(destination)

    def _resolve_extracted_bundle_dir(self, extract_root: Path) -> Path:
        manifest_at_root = extract_root / "manifest.json"
        if manifest_at_root.exists():
            return extract_root
        children = [path for path in extract_root.iterdir() if path.is_dir()]
        if len(children) == 1 and (children[0] / "manifest.json").exists():
            return children[0]
        raise ModelRegistryError("Model bundle zip must contain manifest.json at root or in one top-level folder")


registry = ModelRegistry()
