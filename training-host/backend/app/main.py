from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import datasets, training
from redis import asyncio as aioredis
import os

app = FastAPI(title="AOI Training Host API", version="0.1.0")

# Mount static files to view images
app.mount("/api/data", StaticFiles(directory="/app/data"), name="data")

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api")
app.include_router(training.router, prefix="/api")

@app.get("/api/health")
async def root():
    return {"message": "AOI Training Host API is running", "docs": "/docs"}

@app.get("/health")
async def health_check():
    # Test Redis Connection
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    try:
        redis = aioredis.from_url(redis_url)
        await redis.ping()
        redis_status = "ok"
    except Exception as e:
        redis_status = f"error: {str(e)}"
        
    return {
        "status": "online",
        "redis": redis_status,
        "gpu_available": "TODO: Check CUDA"
    }
