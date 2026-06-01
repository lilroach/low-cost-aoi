from fastapi import APIRouter
from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional
from pathlib import Path
from threading import RLock

from app.config import MODEL_INFERENCE_ENABLED
from app.model_manifest import ModelManifestError, load_model_manifest
from app.model_registry import registry

router = APIRouter()

class Detection(BaseModel):
    label: str
    confidence: float
    box: List[int] # [x, y, w, h] relative to image ?? or absolute? Let's say pixel

class InferenceResult(BaseModel):
    result: str # "OK" or "NG"
    detections: List[Detection]
    image_url: Optional[str] = None


class HailoInferenceAdapter:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self.manifest = load_model_manifest(model_dir)
        self.model_id = self.manifest["model_id"]
        self.hef_path = model_dir / "model.hef"
        try:
            import hailo_platform  # type: ignore
        except Exception as exc:
            raise ModelManifestError("HailoRT Python bindings are not available. Install python3-hailort on the Raspberry Pi.") from exc
        self.hailo_platform = hailo_platform
        try:
            self.hef = hailo_platform.HEF(str(self.hef_path))
        except Exception as exc:
            raise ModelManifestError(f"HailoRT could not load model.hef: {exc}") from exc

    def predict(self, image):
        raise RuntimeError(
            "HailoRT runtime is installed and model manifest is valid, but model execution/postprocess is not wired yet."
        )


class ModelFeatureDisabled(RuntimeError):
    pass


class ActiveModelManager:
    def __init__(self):
        self._lock = RLock()
        self._adapter: Optional[HailoInferenceAdapter] = None
        self._adapter_error: Optional[str] = None

    def status(self):
        snapshot = registry.snapshot()
        if not MODEL_INFERENCE_ENABLED:
            return {
                "status": "locked",
                "message": "Model inference is locked for Phase 2.",
                "active": snapshot["active"],
                "models": snapshot["models"],
            }

        with self._lock:
            if self._adapter:
                return {
                    "status": "ready",
                    "model_id": self._adapter.model_id,
                    "format": self._adapter.manifest["format"],
                    "model_dir": str(self._adapter.model_dir),
                    "active": snapshot["active"],
                }
            if self._adapter_error:
                return {"status": "error", "message": self._adapter_error, "active": snapshot["active"]}
            return {"status": "idle", "message": "No model is loaded.", "active": snapshot["active"]}

    def switch_to(self, model_id: str) -> HailoInferenceAdapter:
        if not MODEL_INFERENCE_ENABLED:
            raise ModelFeatureDisabled("Model inference is locked for Phase 2.")

        with self._lock:
            if self._adapter and self._adapter.model_id == model_id:
                return self._adapter

            model = registry.get_model(model_id)
            if not model:
                registry.refresh()
                model = registry.get_model(model_id)
            if not model:
                raise ModelManifestError(f"Model bundle not found: {model_id}")
            if model["status"] != "valid":
                raise ModelManifestError(f"Model bundle is invalid: {model.get('error')}")

            try:
                self._adapter = HailoInferenceAdapter(Path(model["path"]))
                self._adapter_error = None
                return self._adapter
            except ModelManifestError as exc:
                self._adapter = None
                self._adapter_error = str(exc)
                raise

    def adapter_for(self, model_id: Optional[str] = None, part_no: Optional[str] = None) -> HailoInferenceAdapter:
        selected_model_id = model_id
        if not selected_model_id and part_no:
            active_model = registry.active_model_for_part(part_no)
            selected_model_id = active_model["model_id"] if active_model else None
        if not selected_model_id:
            raise ModelManifestError("No active model selected")
        return self.switch_to(selected_model_id)


active_model_manager = ActiveModelManager()


def predict_on_image(image, model_id: Optional[str] = None, part_no: Optional[str] = None):
    return active_model_manager.adapter_for(model_id=model_id, part_no=part_no).predict(image)


@router.get("/model/status")
async def model_status():
    return active_model_manager.status()

@router.post("/detect", response_model=InferenceResult)
async def run_inference():
    """
    Run the configured Hailo model.
    """
    try:
        return predict_on_image(None)
    except ModelFeatureDisabled as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    except ModelManifestError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
