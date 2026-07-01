"""
speech.py - Offline Vocal Synth Engine (Module 8)
Interfaces with pyttsx3 to sound out synthesized statements with adjustable parameters.
"""

import pyttsx3
import threading

class SpeechEngine:
    def __init__(self):
        self._engine_lock = threading.Lock()
        self.rate = 150 # default speed words per minute
        self.volume = 1.0 # default volume 100%

    def speak_text(self, text, rate=None, voice_gender="female"):
        """
        Sounds out the specified string of text. Uses background threading to 
        prevent blocking live CV frame rendering loops in Flask.
        """
        if not text or text.strip() == "":
            return
            
        # Spawn daemon speaker thread to bypass OpenCV frame freezes!
        t = threading.Thread(
            target=self._speak_worker, 
            args=(text, rate or self.rate, voice_gender), 
            daemon=True
        )
        t.start()

    def _speak_worker(self, text, rate, gender):
        """Worker loop running under thread local context."""
        with self._engine_lock:
            try:
                # Initialize inside worker thread context
                engine = pyttsx3.init()
                
                # set speed parameters
                engine.setProperty('rate', rate)
                engine.setProperty('volume', self.volume)
                
                # Find corresponding voice index
                voices = engine.getProperty('voices')
                if len(voices) > 0:
                    if gender == "female" and len(voices) > 1:
                        engine.setProperty('voice', voices[1].id)
                    else:
                        engine.setProperty('voice', voices[0].id)
                        
                engine.say(text)
                engine.runAndWait()
                # Stop and clean up
                engine.stop()
            except Exception as e:
                print(f"[Error] Offline vocal TTS error: {e}")

# Global instance
speech_synth = SpeechEngine()

def speak_text(text, rate=150, gender="female"):
    speech_synth.speak_text(text, rate, gender)
