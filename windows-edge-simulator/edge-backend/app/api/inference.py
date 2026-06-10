from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from fastapi import HTTPException

from app.config import MODEL_INFERENCE_ENABLED
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


_loaded_model_id = None
_loaded_model = None


def _model_for_request(model_id: Optional[str], part_no: Optional[str]):
    selected_model_id = model_id
    if not selected_model_id and part_no:
        active_model = registry.active_model_for_part(part_no)
        selected_model_id = active_model["model_id"] if active_model else None
    if not selected_model_id:
        active = registry.load_active()
        if len(active) == 1:
            selected_model_id = next(iter(active.values()))
    if not selected_model_id:
        raise RuntimeError("No active model selected")

    model = registry.get_model(selected_model_id)
    if not model:
        registry.refresh()
        model = registry.get_model(selected_model_id)
    if not model:
        raise RuntimeError(f"Model bundle not found: {selected_model_id}")
    if model["status"] != "valid":
        raise RuntimeError(f"Model bundle is invalid: {model.get('error')}")
    return model


def _load_model(model):
    global _loaded_model_id, _loaded_model
    if _loaded_model_id == model["model_id"] and _loaded_model is not None:
        return _loaded_model

    from ultralytics import YOLO

    _loaded_model = YOLO(model["weights_path"])
    _loaded_model_id = model["model_id"]
    return _loaded_model


def predict_on_image(image, model_id: Optional[str] = None, part_no: Optional[str] = None):
    """
    Run the active Ultralytics model on an image.
    """
    if not MODEL_INFERENCE_ENABLED:
        raise RuntimeError("Model inference is locked for Phase 2.")
    if image is None:
        raise RuntimeError("No image was provided for inference")

    model_bundle = _model_for_request(model_id=model_id, part_no=part_no)
    yolo = _load_model(model_bundle)
    manifest = model_bundle["manifest"]
    names = manifest["classes"]
    conf = manifest.get("postprocess", {}).get("confidence_threshold", 0.25)
    iou = manifest.get("postprocess", {}).get("iou_threshold", 0.45)
    imgsz = manifest.get("input_size", [640, 640])[0]

    result = yolo.predict(image, imgsz=imgsz, conf=conf, iou=iou, verbose=False)[0]
    detections = []
    for box in result.boxes:
        cls_id = int(box.cls[0])
        x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
        detections.append({
            "label": names[cls_id] if cls_id < len(names) else str(cls_id),
            "confidence": float(box.conf[0]),
            "box": [x1, y1, max(0, x2 - x1), max(0, y2 - y1)],
        })

    return {"result": "NG" if detections else "OK", "detections": detections}


@router.post("/detect", response_model=InferenceResult)
async def run_inference(model_id: Optional[str] = None, part_no: Optional[str] = None):
    """
    Simulate running YOLO model.
    Randomly returns NG with defects.
    """
    # For now, just call the internal one with None
    try:
        return predict_on_image(None, model_id=model_id, part_no=part_no)
    except RuntimeError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
