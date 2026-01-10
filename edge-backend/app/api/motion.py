from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class Position(BaseModel):
    x: float
    y: float

class MotionStatus(BaseModel):
    machine: Position
    work: Position
    offset: Position

# Global State
machine_pos = {"x": 0.0, "y": 0.0}
work_offset = {"x": 0.0, "y": 0.0}

@router.get("/status", response_model=MotionStatus)
async def get_status():
    return {
        "machine": machine_pos,
        "offset": work_offset,
        "work": {
            "x": machine_pos["x"] - work_offset["x"],
            "y": machine_pos["y"] - work_offset["y"]
        }
    }

class MoveCommand(BaseModel):
    axis: str # 'x' or 'y'
    distance: float # e.g. 0.1, 10.0


# Internal Helper
def move_to(x: float, y: float):
    global machine_pos
    # Clip logic (0-300mm soft limits)
    target_x = max(0, min(300, x))
    target_y = max(0, min(300, y))
    
    machine_pos["x"] = target_x
    machine_pos["y"] = target_y
    return machine_pos

@router.post("/jog")
async def jog(cmd: MoveCommand):
    global machine_pos
    target_x = machine_pos["x"]
    if cmd.axis.lower() == 'x':
        target_x += cmd.distance
    
    target_y = machine_pos["y"]
    if cmd.axis.lower() == 'y':
        target_y += cmd.distance
        
    move_to(target_x, target_y)
    
    return await get_status()

@router.post("/home")
async def home():
    global machine_pos
    # Return to machine zero
    machine_pos = {"x": 0.0, "y": 0.0}
    return await get_status()

@router.post("/zero")
async def set_zero():
    """Set current machine position as new Work Zero (G54)"""
    global work_offset, machine_pos
    work_offset = machine_pos.copy()
    return await get_status()
