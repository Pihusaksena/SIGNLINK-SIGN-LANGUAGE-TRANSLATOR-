"""
app.py - Flask Full-Stack Server Backend (Module 10)
Hosts web interfaces and provides rest interfaces for live video streaming, model predictions, and speech synthesizers.
"""

import os
from flask import Flask, render_react_equivalent, render_template, Response, request, jsonify

# Import student modules
from camera import start_camera, get_frame, stop_camera
from hand_detector import detect_hands, extract_landmarks, draw_landmarks
from predict import predict_gesture
from speech import speak_text
from text_generator import slate_generator

app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/")
def index():
    """Serves the main central dashboard client interface."""
    # Ensure camera initializes upon boot
    start_camera()
    return render_template("index.html")

def generate_video_stream():
    """Thread-safe MJPEG stream loop combining opencv captures and drawings."""
    while True:
        frame = get_frame()
        if frame is None:
            continue
            
        # Run detection overlays
        detect_hands(frame)
        annotated_frame = draw_landmarks(frame)
        
        # Mirror for native user alignment
        annotated_frame = cv2.flip(annotated_frame, 1) if 'cv2' in globals() else annotated_frame
        
        # Encode as JPEG
        ret, jpeg = cv2.imencode('.jpg', annotated_frame) if 'cv2' in globals() else (False, None)
        if not ret:
            continue
            
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n\r\n')

@app.route("/video_feed")
def video_feed():
    """Serves raw streaming camera values under multipart MJPEG headers."""
    return Response(
        generate_video_stream(), 
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

@app.route("/predict")
def get_prediction():
    """Calculates active points and feeds them into the deep learning classifier."""
    frame = get_frame()
    if frame is None:
         return jsonify({"gesture": "Searching", "confidence": 0.0})
         
    h, w, _ = frame.shape
    detect_hands(frame)
    lms = extract_landmarks(h, w)
    
    if len(lms) > 0:
        pred_class, score = predict_gesture(lms[0])
        return jsonify({
            "gesture": pred_class,
            "confidence": float(score)
        })
        
    return jsonify({"gesture": "Searching", "confidence": 0.0})

@app.route("/speak", methods=["POST"])
def voice_speak():
    """Cues background pyttsx3 verbal thread with custom rates."""
    data = request.get_json()
    if not data or "text" not in data:
         return jsonify({"status": "error", "message": "No text provided"}), 400
         
    text = data.get("text")
    rate = data.get("rate", 160)
    gender = data.get("gender", "female")
    
    speak_text(text, rate, gender)
    return jsonify({"status": "speaking"})

@app.route("/clear", methods=["POST"])
def clear_slate():
    """Resets the accumulated states."""
    slate_generator.clear()
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    # Import cv2 dynamically inside runtime initialization scope
    try:
        import cv2
    except ImportError:
         print("[Alarm] cv2 is not present in target execution client environment!")
         
    print("\n===========================================")
    print("Flask Sign Language Translator actively booted!")
    print("Web-URL: http://127.0.0.1:5000")
    print("===========================================")
    
    # Run loop
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)
