from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from pydantic import BaseModel
import asyncio
import threading
import time
import json
from datetime import datetime
from pathlib import Path
from ultralytics import YOLO

router = APIRouter(prefix="/training", tags=["training"])

# --- Models ---
class TrainingConfig(BaseModel):
    model_type: str = "yolov8n.pt"  # yolov8n.pt, yolov8s.pt, etc.
    epochs: int = 10
    batch_size: int = 16
    img_size: int = 640
    data_yaml: str = "data.yaml"

# --- Training Manager (Singleton) ---
class TrainingManager:
    def __init__(self):
        self.is_running = False
        self.current_epoch = 0
        self.total_epochs = 0
        self.progress = 0.0
        self.latest_log = ""
        self.metrics = {"loss": [], "map50": []}
        self.stop_event = threading.Event()
        self.active_websockets: list[WebSocket] = []
        self._thread = None

    async def connect_websocket(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.append(websocket)

    def disconnect_websocket(self, websocket: WebSocket):
        if websocket in self.active_websockets:
            self.active_websockets.remove(websocket)

    async def broadcast_log(self, message: str, type: str = "info"):
        """Send log message to all connected clients"""
        payload = json.dumps({
            "type": type,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "message": message,
            "progress": self.progress,
            "epoch": f"{self.current_epoch}/{self.total_epochs}",
            "metrics": self.metrics
        })
        for ws in self.active_websockets:
            try:
                await ws.send_text(payload)
            except:
                pass

    def _run_training(self, config: TrainingConfig):
        """Background training loop"""
        self.is_running = True
        self.current_epoch = 0
        self.total_epochs = config.epochs
        self.metrics = {"loss": [], "map50": []}
        self.stop_event.clear()

        # Notify start
        asyncio.run(self.broadcast_log(f"Starting training with model {config.model_type}...", "start"))

        try:
            # 1. Prepare Dataset (mock for now, real implementation needs to generate data.yaml from raw images)
            # In a real scenario, we would generate a data.yaml from the uploaded images in /app/data/raw
            # For this MVP, we might expect a pre-existing YAML or generate one dynamically.
            # Let's assume we are training on a dummy or existing dataset for now to test the pipeline.
            
            # Initialize Model
            model = YOLO(config.model_type)

            # Custom Callback to stream logs (simulated for now as YOLO callback integration is complex)
            # In production, we would add a custom YOLO callback.
            
            # SIMULATION LOOP (for UI testing phase)
            # We will simulate training progress to verify UI first
            for epoch in range(1, config.epochs + 1):
                if self.stop_event.is_set():
                    asyncio.run(self.broadcast_log("Training stopped by user.", "warning"))
                    break

                self.current_epoch = epoch
                self.progress = round((epoch / config.epochs) * 100, 1)
                
                # Simulate metrics
                import random
                loss = max(0, 1.0 - (epoch * 0.05) + random.uniform(-0.05, 0.05))
                map50 = min(1.0, (epoch * 0.1) + random.uniform(-0.02, 0.02))
                
                self.metrics["loss"].append(loss)
                self.metrics["map50"].append(map50)
                
                log_msg = f"Epoch {epoch}/{config.epochs} - Box Loss: {loss:.4f}, mAP50: {map50:.4f}"
                asyncio.run(self.broadcast_log(log_msg, "log"))
                
                time.sleep(1) # Simulate training time per epoch

            if not self.stop_event.is_set():
                asyncio.run(self.broadcast_log("Training completed successfully!", "success"))
                # Save model logic here (e.g. model.export(format='onnx'))

        except Exception as e:
            asyncio.run(self.broadcast_log(f"Training failed: {str(e)}", "error"))

        finally:
            self.is_running = False
            self._thread = None

    def start_training(self, config: TrainingConfig):
        if self.is_running:
            return False, "Training is already in progress"
        
        self._thread = threading.Thread(target=self._run_training, args=(config,), daemon=True)
        self._thread.start()
        return True, "Training started"

    def stop_training(self):
        if not self.is_running:
            return False, "No active training found"
        self.stop_event.set()
        return True, "Stopping training..."

manager = TrainingManager()

# --- Endpoints ---

@router.post("/start")
async def start_training(config: TrainingConfig):
    success, msg = manager.start_training(config)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "started", "message": msg}

@router.post("/stop")
async def stop_training():
    success, msg = manager.stop_training()
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "stopping", "message": msg}

@router.get("/status")
async def get_status():
    return {
        "is_running": manager.is_running,
        "progress": manager.progress,
        "current_epoch": manager.current_epoch,
        "total_epochs": manager.total_epochs,
        "metrics": manager.metrics
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect_websocket(websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages if needed
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_websocket(websocket)
