import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = Path(os.environ.get("AOI_EDGE_DATA_DIR", PROJECT_ROOT / "data")).resolve()
PROGRAMS_DIR = DATA_ROOT / "programs"
HISTORY_DIR = DATA_ROOT / "history"
TRAINING_HOST_URL = os.environ.get("AOI_TRAINING_HOST_URL", "http://127.0.0.1:8000").rstrip("/")
MACHINE_ID = os.environ.get("AOI_MACHINE_ID", "windows-edge-sim")

PROGRAMS_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_DIR.mkdir(parents=True, exist_ok=True)
