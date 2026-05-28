import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List


class ModelManifestError(RuntimeError):
    pass


def _require_keys(data: Dict[str, Any], keys: List[str], label: str) -> None:
    missing = [key for key in keys if key not in data]
    if missing:
        raise ModelManifestError(f"{label} missing required keys: {', '.join(missing)}")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_model_manifest(model_dir: Path) -> Dict[str, Any]:
    manifest_path = model_dir / "manifest.json"
    hef_path = model_dir / "model.hef"

    if not manifest_path.exists():
        raise ModelManifestError(f"Missing model manifest: {manifest_path}")
    if not hef_path.exists():
        raise ModelManifestError(f"Missing Hailo model file: {hef_path}")

    with open(manifest_path, "r", encoding="utf-8") as file:
        manifest = json.load(file)

    _require_keys(
        manifest,
        ["model_id", "format", "source_yolo_model", "classes", "input_size", "postprocess", "created_at", "checksum"],
        "manifest.json",
    )
    if manifest["format"] != "hailo-hef":
        raise ModelManifestError("manifest format must be hailo-hef")
    if not isinstance(manifest["classes"], list) or not manifest["classes"]:
        raise ModelManifestError("manifest classes must be a non-empty list")
    if not isinstance(manifest["input_size"], list) or len(manifest["input_size"]) != 2:
        raise ModelManifestError("manifest input_size must be [width, height]")

    checksum = manifest["checksum"]
    _require_keys(checksum, ["algorithm", "model_hef"], "manifest checksum")
    if checksum["algorithm"] != "sha256":
        raise ModelManifestError("manifest checksum algorithm must be sha256")

    actual = _sha256(hef_path)
    if actual.lower() != checksum["model_hef"].lower():
        raise ModelManifestError("model.hef checksum mismatch")

    return manifest
