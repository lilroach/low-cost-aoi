from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import time

router = APIRouter()


class MockCamera:
    def __init__(self):
        self.width = 640
        self.height = 480
        self.x = self.width // 2
        self.box_x = self.width // 2
        self.box_y = self.height // 2
        self.dx = 5
        self.dy = 3

    def get_frame(self):
        # Simulate capture delay
        time.sleep(0.05)
        
        # Create a dummy image (moving box)
        img = np.zeros((480, 640, 3), np.uint8)
        
        # Update box position
        self.box_x += self.dx
        self.box_y += self.dy
        
        # Bounce
        if self.box_x <= 0 or self.box_x >= 590: self.dx *= -1
        if self.box_y <= 0 or self.box_y >= 430: self.dy *= -1
        
        cv2.rectangle(img, (self.box_x, self.box_y), (self.box_x+50, self.box_y+50), (0, 255, 0), 2)
        cv2.putText(img, "MOCK CAMERA", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        return img

    def flush_buffer(self):
        """Read and discard frames to ensure fresh data"""
        for _ in range(3):
            self.get_frame()

# Global Camera Instance
camera_driver = MockCamera()

def get_latest_frame():
    """Returns the current Opencv frame"""
    return camera_driver.get_frame()

def flush_buffer():
    """Clear internal camera buffer"""
    camera_driver.flush_buffer()

def generate_frames():
    while True:
        frame = camera_driver.get_frame()
        
        # Encode
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.05) # 20 FPS

@router.get("/feed")
async def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
