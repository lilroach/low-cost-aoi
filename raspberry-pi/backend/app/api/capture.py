from fastapi import APIRouter, HTTPException
import os
import cv2
import datetime
import time
from app.api import camera
from app.config import HISTORY_DIR

router = APIRouter()

CAPTURE_BASE_DIR = os.path.join(str(HISTORY_DIR), "captures")

# Ensure base capture directory exists
os.makedirs(CAPTURE_BASE_DIR, exist_ok=True)

@router.post("/snap")
async def snap_image(part_no: str = "UNKNOWN", batch_no: str = "UNKNOWN"):
    """
    Captures the current frame from the camera and saves it to a daily folder.
    """
    try:
        # 1. Get daily directory
        today = datetime.datetime.now().strftime("%Y%m%d")
        daily_dir = os.path.join(CAPTURE_BASE_DIR, today)
        os.makedirs(daily_dir, exist_ok=True)

        # 2. Capture frame
        camera.flush_buffer()
        frame = camera.get_latest_frame()

        if frame is None:
            raise HTTPException(status_code=500, detail="Failed to capture frame from camera")

        # 3. Generate filename with metadata
        timestamp = datetime.datetime.now().strftime("%H%M%S_%f")[:-3]
        filename = f"{part_no}_{batch_no}_{timestamp}.jpg"
        filepath = os.path.join(daily_dir, filename)

        # 4. Save to disk
        success = cv2.imwrite(filepath, frame)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to write image to disk")

        return {
            "status": "success",
            "filename": filename,
            "path": filepath,
            "saved_at": time.time()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_captures():
    """
    Returns a list of all images captured today.
    """
    today = datetime.datetime.now().strftime("%Y%m%d")
    daily_dir = os.path.join(CAPTURE_BASE_DIR, today)

    if not os.path.exists(daily_dir):
        return {"images": []}

    # Sort by creation time (newest first)
    files = [f for f in os.listdir(daily_dir) if f.endswith('.jpg')]
    files.sort(reverse=True)

    # Return web-accessible paths (mounted at /data/history)
    # Full path: <data_root>/history/captures/YYYYMMDD/file.jpg
    # Web path: /data/history/captures/YYYYMMDD/file.jpg
    images = []
    for f in files:
        images.append({
            "name": f,
            "url": f"/data/history/captures/{today}/{f}",
            "timestamp": f.split('_')[-1].replace('.jpg', '')
        })

    return {"images": images}

@router.get("/count")
async def get_capture_count():
    """
    Returns the total number of images captured today.
    """
    today = datetime.datetime.now().strftime("%Y%m%d")
    daily_dir = os.path.join(CAPTURE_BASE_DIR, today)

    if not os.path.exists(daily_dir):
        return {"count": 0}

    files = [f for f in os.listdir(daily_dir) if f.endswith('.jpg')]
    return {"count": len(files)}
