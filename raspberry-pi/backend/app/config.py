import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = Path(os.environ.get("AOI_EDGE_DATA_DIR", PROJECT_ROOT / "data")).resolve()
PROGRAMS_DIR = DATA_ROOT / "programs"
HISTORY_DIR = DATA_ROOT / "history"
TRAINING_HOST_URL = os.environ.get("AOI_TRAINING_HOST_URL", "http://127.0.0.1:8000").rstrip("/")
MACHINE_ID = os.environ.get("AOI_MACHINE_ID", "raspberry-pi-edge")
MODEL_ROOT = Path(os.environ.get("AOI_EDGE_MODEL_DIR", PROJECT_ROOT / "models")).resolve()
MODEL_DIR = MODEL_ROOT
MODEL_INFERENCE_ENABLED = os.environ.get("AOI_EDGE_MODEL_INFERENCE_ENABLED", "false").lower() in ("1", "true", "yes", "on")
CAMERA_INDEX = int(os.environ.get("AOI_CAMERA_INDEX", "0"))
CAMERA_WIDTH = int(os.environ.get("AOI_CAMERA_WIDTH", "1920"))
CAMERA_HEIGHT = int(os.environ.get("AOI_CAMERA_HEIGHT", "1080"))
CAMERA_FPS = int(os.environ.get("AOI_CAMERA_FPS", "30"))
CAMERA_FOURCC = os.environ.get("AOI_CAMERA_FOURCC", "MJPG")

PROGRAMS_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_DIR.mkdir(parents=True, exist_ok=True)
MODEL_ROOT.mkdir(parents=True, exist_ok=True)
