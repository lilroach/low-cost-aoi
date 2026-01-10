from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import math
from app.api import motion

router = APIRouter()

class ScanConfig(BaseModel):
    width_mm: float
    height_mm: float
    overlap_percent: float = 0.1  # 10% overlap

class ScanPoint(BaseModel):
    id: int
    work_x: float
    work_y: float
    machine_x: float
    machine_y: float

@router.post("/preview", response_model=List[ScanPoint])
async def preview_scan_path(config: ScanConfig):
    """
    Generate a Zigzag (S-curve) scanning path based on:
    1. PCB Dimensions
    2. Current Work Offset (G54) from motion module
    3. Camera FOV (Simulated as 40mm x 30mm)
    """
    
    # 1. Get current Offset (The "Origin Compensation" user asked about)
    offset_x = motion.work_offset["x"]
    offset_y = motion.work_offset["y"]
    
    # 2. Camera Field of View Settings (Simulated)
    # In real world, this comes from calibration (pixels * mm_per_pixel)
    FOV_W = 40.0 
    FOV_H = 30.0
    
    # 3. Calculate Step Size (considering overlap)
    step_x = FOV_W * (1 - config.overlap_percent)
    step_y = FOV_H * (1 - config.overlap_percent)
    
    cols = math.ceil(config.width_mm / step_x)
    rows = math.ceil(config.height_mm / step_y)
    
    path = []
    point_id = 1
    
    # 4. Generate Zigzag Path
    for row in range(rows):
        y = row * step_y
        
        # Determine direction for this row (Zigzag)
        if row % 2 == 0:
            col_range = range(cols)      # Left to Right
        else:
            col_range = range(cols-1, -1, -1) # Right to Left
            
        for col in col_range:
            x = col * step_x
            
            # Create Point
            p = ScanPoint(
                id=point_id,
                work_x=round(x, 2),
                work_y=round(y, 2),
                # KEY LOGIC: Work Coordinate + Offset = Machine Coordinate
                machine_x=round(offset_x + x, 2),
                machine_y=round(offset_y + y, 2)
            )
            path.append(p)
            point_id += 1
            
    return path
