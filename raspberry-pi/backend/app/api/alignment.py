from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import cv2
import numpy as np

from app.api.program import Point, current_program
from app import runtime_state


router = APIRouter()


class AlignmentCalculateRequest(BaseModel):
    program_refs: List[Point]
    runtime_refs: List[Point]


@router.post("/calculate")
async def calculate_alignment(data: AlignmentCalculateRequest):
    if len(data.program_refs) < 2 or len(data.runtime_refs) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 points for alignment")

    src_pts = np.float32([[p.x, p.y] for p in data.program_refs[:3]])
    dst_pts = np.float32([[p.x, p.y] for p in data.runtime_refs[:3]])

    if len(src_pts) >= 3 and len(dst_pts) >= 3:
        matrix = cv2.getAffineTransform(src_pts[:3], dst_pts[:3])
    else:
        matrix, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts)
        if matrix is None:
            dx = dst_pts[0][0] - src_pts[0][0]
            dy = dst_pts[0][1] - src_pts[0][1]
            matrix = np.float32([[1, 0, dx], [0, 1, dy]])

    corrected_points = []
    for point in current_program.points:
        original = np.array([point.x, point.y, 1.0])
        new_x = (original[0] * matrix[0, 0]) + (original[1] * matrix[0, 1]) + matrix[0, 2]
        new_y = (original[0] * matrix[1, 0]) + (original[1] * matrix[1, 1]) + matrix[1, 2]
        corrected_points.append(Point(
            id=point.id,
            x=round(float(new_x), 2),
            y=round(float(new_y), 2),
            type="inspect",
        ))

    runtime_state.aligned_points = corrected_points

    return {
        "matrix": matrix.tolist(),
        "corrected_points": corrected_points,
    }
