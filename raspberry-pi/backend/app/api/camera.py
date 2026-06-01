from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import cv2
import numpy as np
import threading
import time
from app.config import CAMERA_FOURCC, CAMERA_FPS, CAMERA_HEIGHT, CAMERA_INDEX, CAMERA_WIDTH

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
        return None

class RealCamera:
    """
    Physical camera driver using OpenCV.
    """
    def __init__(self, index=0, width=640, height=480, fps=30, fourcc="MJPG"):
        self.index = index
        self.requested_width = width
        self.requested_height = height
        self.requested_fps = fps
        self.requested_fourcc = fourcc
        self.lock = threading.Lock()
        self.latest_frame = None
        self.running = True
        self.cap = cv2.VideoCapture(index, cv2.CAP_V4L2)
        if not self.cap.isOpened():
            raise RuntimeError(f"Could not open video device {index}")

        if fourcc:
            self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*fourcc[:4]))
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

        start = time.time()
        while self.latest_frame is None and time.time() - start < 3:
            time.sleep(0.05)

    def _capture_loop(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                with self.lock:
                    self.latest_frame = frame
            else:
                time.sleep(0.05)

    def get_frame(self):
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
        # Return a black frame until the first camera frame arrives.
        return np.zeros((480, 640, 3), np.uint8)

    def flush_buffer(self):
        time.sleep(0.1)

    def status(self):
        return {
            "mode": "real",
            "index": self.index,
            "requested": {
                "width": self.requested_width,
                "height": self.requested_height,
                "fps": self.requested_fps,
                "fourcc": self.requested_fourcc,
            },
            "actual": {
                "width": int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "fps": self.cap.get(cv2.CAP_PROP_FPS),
                "fourcc": int(self.cap.get(cv2.CAP_PROP_FOURCC)),
            },
            "has_frame": self.latest_frame is not None,
        }

    def __del__(self):
        self.running = False
        if hasattr(self, 'cap'):
            self.cap.release()

# Global Camera Instance Selector
def initialize_camera():
    print("Initializing camera unit...")
    try:
        driver = RealCamera(
            index=CAMERA_INDEX,
            width=CAMERA_WIDTH,
            height=CAMERA_HEIGHT,
            fps=CAMERA_FPS,
            fourcc=CAMERA_FOURCC,
        )
        print(
            "Camera initialized: [REAL] Physical hardware detected. "
            f"index={CAMERA_INDEX} size={CAMERA_WIDTH}x{CAMERA_HEIGHT} fps={CAMERA_FPS} fourcc={CAMERA_FOURCC}"
        )
        return driver
    except Exception as e:
        print(f"Camera warning: {e}")
        print("Camera initialized: [MOCK] Falling back to simulation mode.")
        return MockCamera()

camera_driver = initialize_camera()

@router.get("/status")
async def camera_status():
    if hasattr(camera_driver, "status"):
        return camera_driver.status()
    return {"mode": "mock", "has_frame": True}

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
