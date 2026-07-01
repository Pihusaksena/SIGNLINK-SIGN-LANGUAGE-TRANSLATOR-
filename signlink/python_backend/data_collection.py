"""
data_collection.py - Sign Signatures Dataset Recorder (Module 3)
Allows recording raw coordinates from live video frames and directories, structured under labeling hierarchies.
"""

import os
import cv2
import csv
import time
import numpy as np
from camera import start_camera, get_frame, stop_camera
from hand_detector import detect_hands, extract_landmarks, draw_landmarks

# Specifying directories
DATASET_DIR = "dataset"
LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "Hello", "ThankYou", "Yes", "No", "Please"]
SAMPLES_PER_CLASS = 100

def initialize_directories():
    """Builds filesystem branches for each gesture label."""
    if not os.path.exists(DATASET_DIR):
        os.makedirs(DATASET_DIR)
        print(f"[Info] Prepared database node: {DATASET_DIR}")
        
    for label in LABELS:
        class_path = os.path.join(DATASET_DIR, label)
        if not os.path.exists(class_path):
            os.makedirs(class_path)
            print(f" -> Prepared label leaf: {label}")

def capture_samples(label_name, num_samples=SAMPLES_PER_CLASS):
    """Loop to live-capture normalized landmarks for a single hand state."""
    print(f"\n===========================================")
    print(f"READING GESTURE RECORD FOR: [{label_name}]")
    print(f"Instructions: Hold sign in front of camera.")
    print(f"Press 's' to capture a coordinate frame.")
    print(f"Press 'q' to quit.")
    print(f"===========================================")

    initialize_directories()
    
    if not start_camera():
        print("[Error] Failed to initialize camera backend.")
        return

    saved_count = 0
    time.sleep(1.0)
    
    try:
        while saved_count < num_samples:
            img = get_frame()
            if img is None:
                time.sleep(0.01)
                continue
                
            h, w, _ = img.shape
            detect_hands(img)
            annotated_img = draw_landmarks(img)
            
            # Draw stats overlays
            cv2.putText(
                annotated_img, 
                f"Label: {label_name} | Saved: {saved_count}/{num_samples}", 
                (15, 35), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, (0, 255, 0), 2
            )
            cv2.putText(
                annotated_img, 
                "Press 's' to store sample | 'q' to exit", 
                (15, h - 20), 
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.5, (255, 255, 255), 1
            )
            
            cv2.imshow("Sign Language Data Acquisition Terminal", annotated_img)
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('s'):
                lms = extract_landmarks(h, w)
                if len(lms) > 0:
                    # Save first detected hand coordinates
                    save_samples(label_name, lms[0], saved_count)
                    saved_count += 1
                    print(f" -> Logged coordinate sample #{saved_count}")
                else:
                    print(" [Alarm] No hands detected in frame! Cannot capture points.")
                    
            elif key == ord('q'):
                print("[Info] Collector exiting manually.")
                break
                
    finally:
        stop_camera()
        cv2.destroyAllWindows()

def save_samples(label_name, landmarks, index):
    """Writes the flat point sequence into tabular class directories."""
    class_dir = os.path.join(DATASET_DIR, label_name)
    sample_file = os.path.join(class_dir, f"sample_{index:04d}.csv")
    
    # Writing flattened coordinates list (63 dimensions: x0, y0, z0, ..., x20, y20, z20)
    with open(sample_file, mode='w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["x", "y", "z"])
        for lm in landmarks:
            writer.writerow(lm)

if __name__ == "__main__":
    import sys
    initialize_directories()
    # If starting via CLI with a specific label, run it
    if len(sys.argv) > 1:
        target_label = sys.argv[1]
        if target_label in LABELS:
            capture_samples(target_label)
        else:
            print(f"[Warn] '{target_label}' is not in allowed classes: {LABELS}")
    else:
        print("[Manual Usage] Run as: python data_collection.py <LabelName>")
        print(f"Available Labels: {LABELS}")
