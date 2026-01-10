from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import random
import time

router = APIRouter()

class Detection(BaseModel):
    label: str
    confidence: float
    box: List[int] # [x, y, w, h] relative to image ?? or absolute? Let's say pixel

class InferenceResult(BaseModel):
    result: str # "OK" or "NG"
    detections: List[Detection]
    image_url: Optional[str] = None


# Internal function
def predict_on_image(image):
    """
    Simulate running model on an image (numpy array).
    """
    # In real app: results = session.run(...)
    time.sleep(0.5) # Simulate inference time
    
    is_ng = random.random() < 0.3 # 30% chance of NG
    
    if is_ng:
        return {
            "result": "NG",
            "detections": [
                {
                    "label": "missing_component",
                    "confidence": 0.95,
                    "box": [100, 100, 50, 50]
                }
            ]
        }
    else:
        return {
            "result": "OK",
            "detections": []
        }

@router.post("/detect", response_model=InferenceResult)
async def run_inference():
    """
    Simulate running YOLO model.
    Randomly returns NG with defects.
    """
    # For now, just call the internal one with None
    return predict_on_image(None)
