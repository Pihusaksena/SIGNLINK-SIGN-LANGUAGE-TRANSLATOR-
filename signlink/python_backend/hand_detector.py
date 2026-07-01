"""
hand_detector.py - MediaPipe Hand Tracking Layer (Module 2)
Interprets coordinate landmarks (21 distinct nodes x, y, z) and outputs skeleton metrics.
"""

import cv2
import mediapipe as mp
import numpy as np

class HandDetector:
    def __init__(self, static_mode=False, max_hands=2, min_detection_conf=0.6, min_tracking_conf=0.6):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=static_mode,
            max_num_hands=max_hands,
            model_complexity=1,
            min_detection_confidence=min_detection_conf,
            min_tracking_confidence=min_tracking_conf
        )
        self.mp_draw = mp.solutions.drawing_utils
        self.results = None

    def detect_hands(self, frame_bgr):
        """Processes OpenCV BGR image and tracks state results."""
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        self.results = self.hands.process(frame_rgb)
        return self.results

    def extract_landmarks(self, h, w):
        """Returns flat arrays of relative coordinates for detected hands."""
        landmarks_list = []
        if self.results and self.results.multi_hand_landmarks:
            for hand_lms in self.results.multi_hand_landmarks:
                pts = []
                for lm in hand_lms.landmark:
                    # Collect normalized and pixel coordinates
                    pts.append([lm.x, lm.y, lm.z])
                landmarks_list.append(pts)
        return landmarks_list

    def draw_landmarks(self, frame_bgr):
        """Draws fluorescent joint maps and bones on top of input frame."""
        annotated_frame = frame_bgr.copy()
        if self.results and self.results.multi_hand_landmarks:
            for hand_lms in self.results.multi_hand_landmarks:
                self.mp_draw.draw_landmarks(
                    annotated_frame, 
                    hand_lms, 
                    self.mp_hands.HAND_CONNECTIONS,
                    self.mp_draw.DrawingSpec(color=(6, 182, 212), thickness=3, circle_radius=4), # Cyan bones
                    self.mp_draw.DrawingSpec(color=(236, 72, 153), thickness=2, circle_radius=3) # Pink nodes
                )
        return annotated_frame

# Global Singleton instance
_global_detector = HandDetector()

def detect_hands(frame):
    return _global_detector.detect_hands(frame)

def extract_landmarks(h=480, w=640):
    return _global_detector.extract_landmarks(h, w)

def draw_landmarks(frame):
    return _global_detector.draw_landmarks(frame)
