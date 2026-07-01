"""
preprocessing.py - Landmarkers Coordinates Normalizer Plane (Module 4)
Applies coordinate geometry equations to normalize relative vectors and splits dataset partitions.
"""

import os
import csv
import numpy as np
from sklearn.model_selection import train_test_split

DATASET_DIR = "dataset"

def normalize_landmarks(landmarks_list):
    """
    Geometrical Translation & Scale Invariance (Module 4 Task).
    Translates wrist coordinates (0) to (0,0,0) origin and divides by scale factor.
    """
    if len(landmarks_list) != 21:
        return None
        
    landmarks_arr = np.array(landmarks_list)
    wrist = landmarks_arr[0]
    
    # 1. Translate palm position - subtract wrist vector
    translated = landmarks_arr - wrist
    
    # 2. Scale coordinate size - length between wrist (0) and middle MCP (9)
    middle_mcp = translated[9]
    scale_factor = np.linalg.norm(middle_mcp)
    
    if scale_factor == 0:
        scale_factor = 1e-6
        
    # 3. Apply normalization
    normalized = translated / scale_factor
    return normalized.flatten() # Returns 1D flat vector of shape (63,)

def prepare_dataset(src_dir=DATASET_DIR):
    """
    Loops through the collected labeled samples, preprocesses, splits (70/15/15),
    and converts targets to integers.
    """
    X = []
    y = []
    
    if not os.path.exists(src_dir):
        print(f"[Warn] '{src_dir}' folder is empty. Please capture coordinate samples first.")
        return None, None, None, None, None, None

    labels = sorted(os.listdir(src_dir))
    label_map = {label: i for i, label in enumerate(labels)}
    
    print(f"[Info] Scanning class leaves: {label_map}")
    
    for label in labels:
        class_dir = os.path.join(src_dir, label)
        if not os.path.isdir(class_dir):
            continue
            
        csv_files = [f for f in os.listdir(class_dir) if f.endswith(".csv")]
        print(f" -> Class '{label}': Processing {len(csv_files)} samples...")
        
        for file in csv_files:
            file_path = os.path.join(class_dir, file)
            landmarks = []
            
            # Read 21 point coordinates
            with open(file_path, mode='r') as f:
                reader = csv.reader(f)
                next(reader) # skip headers ["x", "y", "z"]
                for row in reader:
                    if len(row) == 3:
                        landmarks.append([float(row[0]), float(row[1]), float(row[2])])
            
            if len(landmarks) == 21:
                flat_norm = normalize_landmarks(landmarks)
                if flat_norm is not None:
                    X.append(flat_norm)
                    y.append(label_map[label])
                    
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    
    if len(X) == 0:
        print("[Error] Preprocessed zero landmarks profiles. Cannot split.")
        return None, None, None, None, None, None
        
    print(f"[Success] Loaded aggregated tensor footprint of shape: Features={X.shape}, Labeled={y.shape}")

    # Split dataset: 70% train | 30% temp
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
    # Split temp into 15% validation | 15% testing
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)
    
    print(f"[Preprocessed Partition Splits]")
    print(f" -> Training Core:   {X_train.shape[0]} samples (70%)")
    print(f" -> Validation Core: {X_val.shape[0]} samples (15%)")
    print(f" -> Testing Target:  {X_test.shape[0]} samples (15%)")
    
    return X_train, X_val, X_test, y_train, y_val, y_test

if __name__ == "__main__":
    X_train, X_val, X_test, y_train, y_val, y_test = prepare_dataset()
    if X_train is not None:
        # Cache np file structures
        np.save("X_train.npy", X_train)
        np.save("X_val.npy", X_val)
        np.save("X_test.npy", X_test)
        np.save("y_train.npy", y_train)
        np.save("y_val.npy", y_val)
        np.save("y_test.npy", y_test)
        print("[Success] Preprocessed datasets exported as .npy structures!")
