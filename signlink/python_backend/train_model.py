"""
train_model.py - Neural Network Training Core (Module 5)
Compiles Dense Deep Learning architecture, logs validation loss curves, and generates Confusion Matrix.
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers
from keras import callbacks
from sklearn.metrics import confusion_matrix, classification_report
import matplotlib.pyplot as plt
import seaborn as sns

from preprocessing import prepare_dataset

MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "model.h5")

def build_model(input_dim, num_classes):
    """
    Assembles requested feed-forward Deep Dense Neural network (Module 5 recommended architecture).
    """
    model = keras.Sequential([
        layers.Input(shape=(input_dim,)),
        
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        
        layers.Dense(64, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        
        layers.Dense(num_classes, activation='softmax')
    ])
    
    # Compile with Adam optimizer & cross entropy
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    return model

def train_model():
    """Fetches normalized datasets and runs fitting loop with checkpoints."""
    X_train, X_val, X_test, y_train, y_val, y_test = prepare_dataset()
    
    if X_train is None:
        print("[Error] No training metrics found. Please record landmarks data.")
        return
        
    num_classes = len(np.unique(y_train))
    input_dim = X_train.shape[1] # Expected 63: (21 nodes * 3 axes)
    
    model = build_model(input_dim, num_classes)
    model.summary()
    
    # Establish directory
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    # Standard academic Callbacks
    early_stop = callbacks.EarlyStopping(
        monitor='val_loss', 
        patience=10, 
        restore_best_weights=True
    )
    
    checkpoint = callbacks.ModelCheckpoint(
        MODEL_PATH, 
        monitor='val_accuracy', 
        save_best_only=True
    )
    
    print("\n[Training Loop] Initiating neural network alignment...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=80,
        batch_size=32,
        callbacks=[early_stop, checkpoint]
    )
    
    print(f"\n[Success] Training complete. Model preserved at: {MODEL_PATH}")
    evaluate_model(model, X_test, y_test)
    _plot_curves(history)

def evaluate_model(model, X_test, y_test):
    """Prints F1-score details and renders confusion matrices."""
    loss, acc = model.evaluate(X_test, y_test, verbose=0)
    print(f"\n[Validation Test Assessment]")
    print(f" -> Accuracy Score: {acc * 100:.2f}% (Expectation: >90%)")
    print(f" -> Loss Coordinate: {loss:.4f}")
    
    # Compute confusion values
    preds = model.predict(X_test)
    y_pred = np.argmax(preds, axis=1)
    
    # Print metrics report
    print("\n----------------- CLASSIFICATION REPORT -----------------")
    print(classification_report(y_test, y_pred))
    
    # Draw Matrix PNG
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
    plt.title("Confusion Matrix - Real-Time Sign Recognition Model")
    plt.xlabel("Predicted Labels")
    plt.ylabel("Actual Labels")
    plt.savefig("confusion_matrix_metrics.png")
    print("[Info] Heatmap graphics exported safely as 'confusion_matrix_metrics.png'")

def _plot_curves(history):
    """Renders training convergence metrics."""
    plt.figure(figsize=(12, 4))
    
    # Loss Curve
    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Train Loss')
    plt.plot(history.history['val_loss'], label='Val Loss')
    plt.title('Loss Convergence')
    plt.xlabel('Epoch')
    plt.ylabel('Entropy Loss')
    plt.legend()
    
    # Accuracy Curve
    plt.subplot(1, 2, 2)
    plt.plot(history.history['accuracy'], label='Train Acc')
    plt.plot(history.history['val_accuracy'], label='Val Acc')
    plt.title('Validation Accuracy Progression')
    plt.xlabel('Epoch')
    plt.ylabel('Classification Ratio')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig("accuracy_loss_convergence.png")
    print("[Info] Convergence curves exported safely as 'accuracy_loss_convergence.png'")

if __name__ == "__main__":
    train_model()
