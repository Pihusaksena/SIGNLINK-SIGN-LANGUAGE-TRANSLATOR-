"""
predict.py - Live Gesture Prediction & Majority Voter (Module 6)
Integrates deep learning model files with live webcam frames, smoothing output triggers via deques.
"""

import os
import cv2
import numpy as np
import tensorflow as tf
from collections import deque, Counter

from camera import get_frame, start_camera, stop_camera
from hand_detector import detect_hands, extract_landmarks, draw_landmarks
from preprocessing import normalize_landmarks

MODEL_PATH = "model/model.h5"

class GesturePredictor:
    def __init__(self, model_path=MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "Hello", "ThankYou", "Yes", "No", "Please"]
        self.vote_buffer = deque(maxlen=15) # Majority voting window size (Module 6)
        
    def load_model(self):
        """Loads preserved Keras binary file if present, otherwise fits mock layer."""
        if os.path.exists(self.model_path):
            try:
                self.model = tf.keras.models.load_model(self.model_path)
                print(f"[Success] Loaded neural parameters from: {self.model_path}")
                return True
            except Exception as e:
                print(f"[Error] Failed to load H5 model structure: {e}")
        else:
            print(f"[Warn] No model found at {self.model_path}. Starting in simulated dummy test classification state.")
        return False

    def predict_gesture(self, landmarks_relative):
        """Predicts character label from single hands landmark list."""
        if self.model is None:
            # Fallback simulator for offline project checks
            return self.labels[0], 0.95
            
        flat_feats = normalize_landmarks(landmarks_relative)
        if flat_feats is None:
            return "Searching", 0.0
            
        # Reshape for single batch sample: (1, 63)
        input_tensor = np.expand_dims(flat_feats, axis=0)
        predictions = self.model.predict(input_tensor, verbose=0)
        
        idx = np.argmax(predictions[0])
        confidence = predictions[0][idx]
        predicted_class = self.labels[idx]
        
        return predicted_class, confidence

    def run_live_inference_loop(self):
        """Real-time camera feed reading and visual display overlay."""
        if not start_camera():
            print("[CRITICAL] Camera setup error. Closing predictor.")
            return

        self.load_model()
        print("\n=== Live Prediction Terminal actively running ===")
        print(" -> Show your hand in front of the lens.")
        print(" -> Press 'q' to shut down predictor.")
        
        try:
            while True:
                img = get_frame()
                if img is None:
                    continue
                    
                h, w, _ = img.shape
                detect_hands(img)
                annotated_img = draw_landmarks(img)
                
                raw_lms = extract_landmarks(h, w)
                
                # Active hands detected
                if len(raw_lms) > 0:
                    pred_class, conf = self.predict_gesture(raw_lms[0])
                    
                    # Accumulate prediction into Queue (Majority Voting)
                    if conf > 0.65:
                         self.vote_buffer.append(pred_class)
                    else:
                         self.vote_buffer.append("Unknown")
                         
                    # Determine consolidated majority winner
                    votes = Counter(self.vote_buffer)
                    consensus, vote_count = votes.most_common(1)[0]
                    
                    # Display results on screen
                    if consensus != "Unknown" and vote_count >= 6:
                        display_text = f"Classified Sign: {consensus}"
                        confidence_text = f"Stability: {vote_count}/15 frames | Conf: {conf*100:.1f}%"
                        color = (0, 255, 0)
                    else:
                        display_text = "Stabilizing hand position..."
                        confidence_text = "Syncing voter ring buffer..."
                        color = (0, 191, 255)
                        
                    cv2.putText(annotated_img, display_text, (20, 45), cv2.FONT_HERSHEY_DUPLEX, 0.9, color, 2)
                    cv2.putText(annotated_img, confidence_text, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
                else:
                    self.vote_buffer.append("Unknown")
                    cv2.putText(annotated_img, "Searching for active hand skeleton...", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (120, 120, 120), 1)

                cv2.imshow("Real-Time Sign Language Translator Inference Engine", annotated_img)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        finally:
            stop_camera()
            cv2.destroyAllWindows()

# Singleton instance
_global_predictor = GesturePredictor()

def load_model(path=MODEL_PATH):
    return _global_predictor.load_model()

def predict_gesture(landmarks):
    return _global_predictor.predict_gesture(landmarks)

if __name__ == "__main__":
    _global_predictor.run_live_inference_loop()
stream_predictor = _global_predictor
