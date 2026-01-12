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
        
        # Create a dummy image
        img = np.zeros((480, 640, 3), np.uint8)
        
        # Get actual machine position from motion module
        # Note: Importing inside method to avoid circular import issues if motion imports camera
        from app.api import motion
        
        # Visualize Machine Position
        # Map 0-300mm space to pixel space
        # Let's say 1mm = 2px. origin at center? 
        # Or just show a grid moving? 
        
        # Let's draw a "PCB Feature" that is ensuring at Machine(150, 150)
        # If camera is at (x,y), the feature is at (150-x, 150-y) relative to center?
        # Simpler: Just show coordinates as text and a crosshair that moves
        
        cx, cy = int(motion.machine_pos["x"]), int(motion.machine_pos["y"])
        
        # Draw a static "Bed" grid
        # As camera moves (machine_pos changes), the grid should move opposite?
        # Camera moves +X, Grid moves -X in the frame.
        
        shift_x = int(motion.machine_pos["x"] * 10) # 1mm = 10px
        shift_y = int(motion.machine_pos["y"] * 10)
        
        # Draw some fixed circles on the "bed"
        # Circle 1 at (0,0) -> Frame coords: Center - Shift
        # Frame Center
        fc_x, fc_y = 320, 240
        
        # Draw Origin (0,0)
        cv2.circle(img, (fc_x - shift_x, fc_y - shift_y + 480), 20, (0, 0, 255), -1) # +480 to flip Y? 
        # CNC Y+ usually up. Image Y+ usually down.
        # Let's align: Camera Y+ (Up) -> Image moves Down?
        # If camera moves UP (Y+), static object moves DOWN in frame.
        # Image Y is Top-Down.
        # Shift Y should be inverted? 
        
        grid_target_x = fc_x - shift_x
        grid_target_y = fc_y + shift_y # + because if Y grows, we move down? No.
        # If Machine Y=0. Object is at Center.
        # If Machine Y=10. Camera moved Up. Object should be lower in frame.
        # Image Y increases downwards.
        # So Object Y = Center Y + (ObjectWorldY - CameraY) ?
        
        # Let's just draw the text first for clarity
        
        cv2.putText(img, f"POS: X{motion.machine_pos['x']:.1f} Y{motion.machine_pos['y']:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.putText(img, "MOVING", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 1)
        
        # Draw a moving box representing the "Camera" location in the world?
        # Or a fixed crosshair and moving world?
        cv2.line(img, (320, 230), (320, 250), (0, 255, 255), 1)
        cv2.line(img, (310, 240), (330, 240), (0, 255, 255), 1)
        
        # Draw "World" dots
        # Dot at World(10,10)
        # ScreenX = 320 + (10 - X)*10
        # ScreenY = 240 + (Y - 10)*10 (Y is flipped?)
        
        # Simple feedback: Draw a circle that moves WITH the machine coords for now
        # so user sees SOMETHING moving.
        cv2.circle(img, (50 + int(motion.machine_pos["x"]), 400 - int(motion.machine_pos["y"])), 15, (0, 255, 255), -1)

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
