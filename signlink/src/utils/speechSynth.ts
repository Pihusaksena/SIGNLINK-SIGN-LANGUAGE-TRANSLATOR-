// Text-To-Speech Interface (Fulfills Module 8)

export interface TTSOptions {
  voiceName?: string;
  rate?: number; // Speed: 0.5 to 2.0
  pitch?: number; // Pitch: 0.5 to 2.0
}

/**
 * Returns list of offline voices currently loaded on the system
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Trigger spoken speech using browser client SpeechSynthesis
 */
export function speakText(text: string, options: TTSOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("SpeechSynthesis is not supported on this browser.");
      reject("Not supported");
      return;
    }

    // Cancel any active speak queues
    window.speechSynthesis.cancel();

    if (!text || text.trim() === "") {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure rate
    if (options.rate !== undefined) {
      utterance.rate = options.rate;
    }
    
    // Configure pitch
    if (options.pitch !== undefined) {
      utterance.pitch = options.pitch;
    }

    // Find and set voice by name
    if (options.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find(v => v.name === options.voiceName);
      if (selected) {
         utterance.voice = selected;
      }
    }

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (err) => {
      console.error("SpeechSynthesis error:", err);
      reject(err);
    };

    window.speechSynthesis.speak(utterance);
  });
}
