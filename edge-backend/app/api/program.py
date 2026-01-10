from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import cv2 # Used for Affine Transform calculation
from app.api import motion

router = APIRouter()

class Point(BaseModel):
    id: int
    x: float
    y: float
    type: str # 'ref' or 'inspect'

class Program(BaseModel):
    name: str
    refs: List[Point] = []
    points: List[Point] = []

import os
import json
from glob import glob

# ... imports ...

# Directory for storing programs
DATA_DIR = "app/data/programs"
os.makedirs(DATA_DIR, exist_ok=True)

# ... Program models ...

# Initialize current program
current_program = Program(name="Untitled")

class ProgramSummary(BaseModel):
    name: str
    points_count: int

def _load_from_disk(name: str) -> Optional[Program]:
    path = os.path.join(DATA_DIR, f"{name}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
        return Program(**data)
    except Exception as e:
        print(f"Error loading {name}: {e}")
        return None

def _save_to_disk(program: Program):
    path = os.path.join(DATA_DIR, f"{program.name}.json")
    with open(path, "w") as f:
        f.write(program.json())

@router.get("/list", response_model=List[ProgramSummary])
async def list_programs():
    files = glob(os.path.join(DATA_DIR, "*.json"))
    summaries = []
    for f in files:
        # Load briefly to get point count, or just trust filename? 
        # Loading is safer to verify validity
        try:
            with open(f, "r") as fp:
                data = json.load(fp)
                p = Program(**data)
                summaries.append(ProgramSummary(name=p.name, points_count=len(p.points)))
        except:
            continue
    return summaries

@router.post("/save/{name}")
async def save_program(name: str):
    global current_program
    current_program.name = name
    _save_to_disk(current_program)
    return {"status": "saved", "name": name}

@router.post("/load/{name}")
async def load_program(name: str):
    global current_program
    p = _load_from_disk(name)
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    
    current_program = p
    return current_program

@router.post("/record/ref/{idx}")
async def record_ref(idx: int):
    """Record current position as Reference Point 1, 2, or 3"""
    global current_program
    if idx < 1 or idx > 3:
        raise HTTPException(status_code=400, detail="Index must be 1, 2, or 3")
    
    # Remove existing ref with this index
    current_program.refs = [p for p in current_program.refs if p.id != idx]
    
    current_program.refs.append(Point(
        id=idx,
        x=motion.machine_pos["x"],
        y=motion.machine_pos["y"],
        type="ref"
    ))
    # Sort refs by ID
    current_program.refs.sort(key=lambda p: p.id)
    
    # Auto-save changes? Or wait for explicit save?
    # User might expect "step-by-step" to be transient until Save. 
    # But usually industrial machines auto-save or hold in current memory context.
    # Current memory context (current_program) is fine.
    
    return current_program

@router.post("/record/point")
async def record_point():
    """Record current position as an Inspection Point"""
    global current_program
    new_id = len(current_program.points) + 1
    p = Point(
        id=new_id,
        x=motion.machine_pos["x"],
        y=motion.machine_pos["y"],
        type="inspect"
    )
    current_program.points.append(p)
    return current_program

@router.delete("/clear")
async def clear_program():
    global current_program
    current_program = Program(name="Untitled")
    return current_program

@router.get("/current")
async def get_program():
    return current_program

class AlignmentInput(BaseModel):
    # The actual coordinates measured at Runtime
    run_refs: List[Point] 

@router.post("/align")
async def calculate_alignment(data: AlignmentInput):
    """
    Calculate transform from Teaching Refs -> Runtime Refs
    And return corrected inspection points.
    """
    if len(current_program.refs) < 2 or len(data.run_refs) < 2:
         raise HTTPException(status_code=400, detail="Need at least 2 points for alignment")

    # Extract coordinates
    src_pts = np.float32([[p.x, p.y] for p in current_program.refs[:3]]) # Teaching
    dst_pts = np.float32([[p.x, p.y] for p in data.run_refs[:3]])        # Runtime

    # Determine Transformation Matrix (Affine if 3 pts, Euclidean if 2)
    # Determine Transformation Matrix (Affine if 3 pts, Euclidean if 2)
    if len(src_pts) >= 3 and len(dst_pts) >= 3:
        M = cv2.getAffineTransform(src_pts[:3], dst_pts[:3])
    else:
        # Fallback to Euclidean (Rotation + Translation) for 2 points
        # estimateAffinePartial2D handles 2 points perfectly
        M, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
        if M is None:
             # Absolute Fallback (just translation) if something fails
            dx = dst_pts[0][0] - src_pts[0][0]
            dy = dst_pts[0][1] - src_pts[0][1]
            M = np.float32([[1, 0, dx], [0, 1, dy]])
        
    # Apply to all inspection points
    corrected_points = []
    for p in current_program.points:
        # [x, y, 1]
        original = np.array([p.x, p.y, 1.0])
        # M is 2x3, but we need dot product
        # corrected = M * original
        new_x = (original[0] * M[0,0]) + (original[1] * M[0,1]) + M[0,2]
        new_y = (original[0] * M[1,0]) + (original[1] * M[1,1]) + M[1,2]
        
        corrected_points.append(Point(
            id=p.id,
            x=round(float(new_x), 2),
            y=round(float(new_y), 2),
            type="inspect"
        ))
        
    return {
        "matrix": M.tolist(),
        "corrected_points": corrected_points
    }

def _generate_fluidnc_gcode(program: Program) -> str:
    lines = []
    lines.append("%")
    lines.append(f"(Program: {program.name})")
    lines.append(f"(Generated by AOI Edge)")
    lines.append("G21 G90 G17 (mm, abs, XY plane)")
    lines.append("G54 (Use Work Coordinate System)")
    lines.append("")
    
    # 1. References
    for i, ref in enumerate(program.refs):
        lines.append(f"(REF {ref.id})")
        # In a real scenario, we might want to pause here for manual check
        lines.append(f"G0 X{ref.x:.3f} Y{ref.y:.3f}")
        lines.append("M0 (Pause for verification)")
        lines.append("")
        
    # 2. Inspection Points
    lines.append("(INSPECTION START)")
    for pt in program.points:
        lines.append(f"(POINT {pt.id})")
        lines.append(f"G0 X{pt.x:.3f} Y{pt.y:.3f}")
        lines.append("G4 P0.5 (Wait for settling)")
        # Trigger Camera (e.g., M62/M63 or specific M-code)
        lines.append("M62 P1 (Trigger Camera)")
        lines.append("G4 P0.1")
        lines.append("M63 P1")
        lines.append("")
        
    lines.append("M30 (End Program)")
    lines.append("%")
    return "\n".join(lines)

@router.get("/export/{name}/gcode")
async def export_gcode(name: str):
    p = _load_from_disk(name)
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    
    gcode = _generate_fluidnc_gcode(p)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(gcode, media_type="text/plain", headers={"Content-Disposition": f"attachment; filename={name}.nc"})

@router.delete("/{name}")
async def delete_program(name: str):
    path = os.path.join(DATA_DIR, f"{name}.json")
    if os.path.exists(path):
        os.remove(path)
        return {"status": "deleted", "name": name}
    raise HTTPException(status_code=404, detail="Program not found")
