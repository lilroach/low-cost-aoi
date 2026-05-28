from fastapi import APIRouter
from fastapi import HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.config import MODEL_DIR
from app.model_manifest import ModelManifestError, load_model_manifest

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
    def __init__(self):
        self.manifest = load_model_manifest(MODEL_DIR)
        self.model_id = self.manifest["model_id"]
        self.hef_path = MODEL_DIR / "model.hef"
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


_adapter = None
_adapter_error: Optional[str] = None


def _get_adapter():
    global _adapter, _adapter_error
    if _adapter is None:
        try:
            _adapter = HailoInferenceAdapter()
            _adapter_error = None
        except ModelManifestError as exc:
            _adapter_error = str(exc)
            raise
    return _adapter


def predict_on_image(image):
    return _get_adapter().predict(image)


@router.get("/model/status")
async def model_status():
    try:
        adapter = _get_adapter()
        return {
            "status": "ready",
            "model_id": adapter.model_id,
            "format": adapter.manifest["format"],
            "model_dir": str(MODEL_DIR),
        }
    except ModelManifestError as exc:
        return {"status": "error", "message": str(exc), "model_dir": str(MODEL_DIR)}

@router.post("/detect", response_model=InferenceResult)
async def run_inference():
    """
    Run the configured Hailo model.
    """
    try:
        return predict_on_image(None)
    except ModelManifestError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
