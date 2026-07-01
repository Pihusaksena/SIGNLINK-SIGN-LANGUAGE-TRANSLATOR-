"""
camera.py - Webcam Frame Capture Controller (Module 1)
Handles camera threads, frame extraction, FPS optimizations, and graceful error boundaries.
"""

import cv2
import threading
import time

class WebcamCamera:
    def __init__(self, camera_idx=0):
        self.camera_idx = camera_idx
        self.cap = None
        self.is_running = False
        self.frame = None
        self.lock = threading.Lock()
        self.thread = None

    def start_camera(self):
        """Starts the background acquisition camera thread."""
        with self.lock:
            if self.is_running:
                return True
            
            self.cap = cv2.VideoCapture(self.camera_idx)
            if not self.cap.isOpened():
                print(f"[Error] Camera index {self.camera_idx} could not be loaded.")
                return False
                
            # Set resolution parameters
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640) if hasattr(cv2, 'CAP_PROP_FRAME_WIDTH') else self.cap.set(3, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480) if hasattr(cv2, 'CAP_PROP_FRAME_HEIGHT') else self.cap.set(4, 480)
            
            self.is_running = True
            self.thread = threading.Thread(target=self._update_frame_loop, daemon=True)
            self.thread.start()
            print("[Info] Camera Thread actively started.")
            return True

    def _update_frame_loop(self):
        """Internal background loop supporting low-latency thread frame pipeline."""
        while self.is_running:
            ret, frame = self.cap.read()
            if ret:
                with self.lock:
                    self.frame = frame
            else:
                time.sleep(0.01)

    def get_frame(self):
        """Returns the latest captured OpenCV frame."""
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()

    def stop_camera(self):
        """Gracefully releases resources and joins threads."""
        with self.lock:
            self.is_running = False
            
        if self.thread:
            self.thread.join(timeout=1.0)
            
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None
            self.frame = None
        print("[Info] Camera resources released successfully.")

# Singletone Global Instances
_global_camera = WebcamCamera()

def start_camera():
    return _global_camera.start_camera()

def get_frame():
    return _global_camera.get_frame()

def stop_camera():
    _global_camera.stop_camera()
