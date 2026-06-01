from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import camera, motion, scan, program, inference, capture, alignment, models
from app.config import HISTORY_DIR

app = FastAPI(title="AOI Edge Unit (Raspberry Pi)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
app.mount("/data/history", StaticFiles(directory=str(HISTORY_DIR)), name="history")

app.include_router(camera.router, prefix="/api/camera", tags=["camera"])
app.include_router(motion.router, prefix="/api/motion", tags=["motion"])
app.include_router(scan.router, prefix="/api/scan", tags=["scan"])
app.include_router(program.router, prefix="/api/program", tags=["program"])
app.include_router(inference.router, prefix="/api/inference", tags=["inference"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(capture.router, prefix="/api/capture", tags=["capture"])
app.include_router(alignment.router, prefix="/api/alignment", tags=["alignment"])

# Register Orchestrator
from app.api import orchestrator
app.include_router(orchestrator.router, prefix="/api/orchestrator", tags=["orchestrator"])

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "mode": "raspberry-pi"}
