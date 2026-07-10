from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import datasets, edges, training
import os
from pathlib import Path

app = FastAPI(title="AOI Training Host API", version="0.1.0")


def _default_app_root() -> Path:
    docker_root = Path("/app")
    if os.name != "nt" and ((docker_root / "app").exists() or (docker_root / "data").exists()):
        return docker_root
    current_file = Path(__file__).resolve()
    if current_file.parents[1].name == "backend":
        return current_file.parents[2]
    return current_file.parents[1]


APP_ROOT = Path(os.getenv("AOI_TRAINING_APP_ROOT", str(_default_app_root())))
DATA_DIR = Path(os.getenv("AOI_TRAINING_DATA_DIR", str(APP_ROOT / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files to view images
app.mount("/api/data", StaticFiles(directory=str(DATA_DIR)), name="data")

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api")
app.include_router(edges.router, prefix="/api")
app.include_router(training.router, prefix="/api")

@app.get("/api/health")
async def root():
    return {
        "status": "online",
        "message": "AOI Training Host API is running",
        "docs": "/docs",
        "deployment": "terminal",
        "data_dir": str(DATA_DIR),
    }

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "deployment": "terminal",
        "data_dir": str(DATA_DIR),
        "gpu_available": "checked by ultralytics/torch at training time",
    }
