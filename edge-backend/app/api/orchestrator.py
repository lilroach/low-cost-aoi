from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict
import asyncio
import time
import math

from app.api import motion, camera, inference
from app.api.program import Point
import os
import json
import cv2
import datetime
import shutil

HISTORY_DIR = "/app/data/history"
os.makedirs(HISTORY_DIR, exist_ok=True)

router = APIRouter()

# --- Job State ---
class RunStatus(BaseModel):
    is_running: bool
    current_point_index: int
    total_points: int
    last_error: Optional[str] = None
    results: List[Dict] = []

# Global State
job_state = {
    "is_running": False,
    "current_point_index": 0,
    "total_points": 0,
    "last_error": None,
    "results": [],
    "stop_signal": False
}

def run_loop(points: List[Point]):
    """
    The main execution loop running in background.
    Strictly sequential: Move -> Wait -> Capture -> Infer
    """
    global job_state
    
    try:
        print(f"Starting run with {len(points)} points")
        job_state["is_running"] = True
        job_state["total_points"] = len(points)
        job_state["results"] = []
        job_state["current_point_index"] = 0
        if job_state["metadata"].get("start_time"):
            run_id = datetime.datetime.fromtimestamp(job_state["metadata"]["start_time"]).strftime("%Y%m%d_%H%M%S")
        else:
            run_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create Run Directory
        run_dir = os.path.join(HISTORY_DIR, run_id)
        os.makedirs(run_dir, exist_ok=True)
        job_state["run_id"] = run_id
        job_state["run_dir"] = run_dir

        job_state["stop_signal"] = False

        for i, pt in enumerate(points):
            if job_state["stop_signal"]:
                print("Run stopped by user")
                break
                
            job_state["current_point_index"] = i + 1
            
            # 1. Move Machine (Backend Call)
            # Calculate distance for simulation delay
            curr_x = motion.machine_pos["x"]
            curr_y = motion.machine_pos["y"]
            dist_x = pt.x - curr_x
            dist_y = pt.y - curr_y
            distance = math.sqrt(dist_x**2 + dist_y**2)
            
            # Simulate Feed Rate: 100mm/s
            feed_rate = 100.0
            travel_time = distance / feed_rate
            
            print(f"Moving to Point {pt.id}: {pt.x}, {pt.y} (Dist: {distance:.1f}mm, Est Time: {travel_time:.2f}s)")
            
            # Execute Move
            motion.move_to(pt.x, pt.y)
            
            # 2. Travel Wait + Settling Time
            # In real system, we would poll motion.is_idle()
            time.sleep(travel_time + 0.5) 
            
            # 3. Capture Image
            print("Capturing...")
            # Flush existing buffer to avoid stale frames (very important for rolling shutter / usb cams)
            camera.flush_buffer()
            frame = camera.get_latest_frame()
            
            # 4. Inference
            print("Inferencing...")
            res = inference.predict_on_image(frame)
            
            # 5. Record Result
            result_entry = {
                "point_id": pt.id,
                "x": pt.x,
                "y": pt.y,
                "result": res["result"],
                "detections": res["detections"],
                "image_path": f"{job_state['run_id']}/{pt.id}.jpg" # Relative path
            }
            job_state["results"].append(result_entry)

            # Save Image to Disk
            img_path = os.path.join(job_state["run_dir"], f"{pt.id}.jpg")
            # Convert frame back to BGR for saving if needed (Assuming get_latest_frame returns BGR or RGB). 
            # Usually OpenCV reads/writes BGR.
            cv2.imwrite(img_path, frame)
            
            # Simulate processing time
            time.sleep(0.1)

    except Exception as e:
        print(f"Run Error: {e}")
        job_state["last_error"] = str(e)
    finally:
        job_state["is_running"] = False
        print("Run finished")
        
        # Save Final Report
        if "run_dir" in job_state:
            report_path = os.path.join(job_state["run_dir"], "report.json")
            report_data = {
                "metadata": job_state.get("metadata", {}),
                "total_points": job_state["total_points"],
                "results": job_state["results"],
                "completed_at": time.time(),
                "status": "completed" if not job_state["last_error"] else "error",
                "error": job_state["last_error"]
            }
            with open(report_path, "w") as f:
                json.dump(report_data, f, indent=2)

# --- History Endpoints ---
@router.get("/history")
async def list_history():
    runs = []
    if not os.path.exists(HISTORY_DIR):
        return []
    
    for dirname in sorted(os.listdir(HISTORY_DIR), reverse=True):
        dir_path = os.path.join(HISTORY_DIR, dirname)
        if os.path.isdir(dir_path):
            report_path = os.path.join(dir_path, "report.json")
            if os.path.exists(report_path):
                try:
                    with open(report_path, "r") as f:
                        data = json.load(f)
                        runs.append({
                            "run_id": dirname,
                            "metadata": data.get("metadata", {}),
                            "completed_at": data.get("completed_at"),
                            "status": data.get("status"),
                            "stats": {
                                "total": len(data.get("results", [])),
                                "ng": len([r for r in data.get("results", []) if r["result"] == "NG"])
                            }
                        })
                except:
                    pass
    return runs

@router.get("/history/{run_id}")
async def get_history_detail(run_id: str):
    run_dir = os.path.join(HISTORY_DIR, run_id)
    report_path = os.path.join(run_dir, "report.json")
    if not os.path.exists(report_path):
        return {"error": "Run not found"}
    
    with open(report_path, "r") as f:
        data = json.load(f)
    return data

@router.post("/history/{run_id}/update_result")
async def update_result(run_id: str, point_id: int, new_result: str):
    run_dir = os.path.join(HISTORY_DIR, run_id)
    report_path = os.path.join(run_dir, "report.json")
    if not os.path.exists(report_path):
        return {"error": "Run not found"}
    
    with open(report_path, "r") as f:
        data = json.load(f)
    
    found = False
    for r in data["results"]:
        if r["point_id"] == point_id:
            r["result"] = new_result
            r["manual_override"] = True # Flag as manually modified
            found = True
            break
            
    if found:
        with open(report_path, "w") as f:
            json.dump(data, f, indent=2)
        return {"status": "updated"}
    return {"error": "Point not found"}

@router.post("/history/{run_id}/upload")
async def upload_run(run_id: str):
    # Retrieve run data
    run_dir = os.path.join(HISTORY_DIR, run_id)
    report_path = os.path.join(run_dir, "report.json")
    
    if not os.path.exists(run_dir):
        return {"status": "error", "message": "Run not found"}

    # TODO: Implement actual upload to Training Host
    # For now, we simulate a successful upload
    # We could copy to a "synced" folder or make an HTTP POST
    
    return {"status": "success", "message": "Uploaded to Host"}

class RunRequest(BaseModel):
    points: List[Point]
    part_no: str = ""
    batch_no: str = ""

@router.post("/start")
async def start_run(req: RunRequest, background_tasks: BackgroundTasks):
    if job_state["is_running"]:
        return {"status": "error", "message": "Already running"}
    
    # Update Job State with Metadata
    job_state["metadata"] = {
        "part_no": req.part_no,
        "batch_no": req.batch_no,
        "start_time": time.time()
    }
    
    # Start the background task
    background_tasks.add_task(run_loop, req.points)
    
    return {"status": "started", "points": len(req.points)}

@router.post("/stop")
async def stop_run():
    job_state["stop_signal"] = True
    return {"status": "stopping"}

@router.get("/status", response_model=RunStatus)
async def get_run_status():
    return RunStatus(
        is_running=job_state["is_running"],
        current_point_index=job_state["current_point_index"],
        total_points=job_state["total_points"],
        last_error=job_state["last_error"],
        results=job_state["results"]
        # In a real app, we might return metadata here too
    )
