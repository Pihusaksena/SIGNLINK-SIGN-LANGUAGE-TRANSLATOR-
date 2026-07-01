import React, { useState, useEffect } from "react";
import { getAvailableVoices, speakText } from "../utils/speechSynth";
import { Send, Volume2, Trash2, ArrowLeft, Wand2, Sparkles, AlertCircle } from "lucide-react";

interface AIControlPanelProps {
  recognizedWordList: string[];
  currentGesture: string;
  onClearWords: () => void;
  onBackspace: () => void;
  onAppendWord: (word: string) => void;
}

export default function AIControlPanel({
  recognizedWordList,
  currentGesture,
  onClearWords,
  onBackspace,
  onAppendWord,
}: AIControlPanelProps) {
  // TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Full-Stack Translation State
  const [polishedSentence, setPolishedSentence] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>(["How are you?", "What is your name?", "Thank you so much"]);
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Collect local web speech voices
    const loadVoices = () => {
      const avail = getAvailableVoices();
      setVoices(avail);
      if (avail.length > 0 && !selectedVoice) {
        // Prefer local high-quality English accent voices
        const englishVoice = avail.find(v => v.lang.startsWith("en-") && v.name.includes("Google"));
        setSelectedVoice(englishVoice ? englishVoice.name : avail[0].name);
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
       window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Fulfills Module 8: Speech Trigger
  const triggerSpeech = async (textToSpeak: string) => {
    if (!textToSpeak) return;
    setIsSpeaking(true);
    try {
      await speakText(textToSpeak, {
        voiceName: selectedVoice,
        rate: speechRate,
        pitch: speechPitch,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Full-Stack REST Caller querying Express server -> Gemini API
  const handleTranslateWithAI = async () => {
    if (recognizedWordList.length === 0) {
      setErrorMsg("Please accumulate some gestures on the sentence slate first.");
      return;
    }
    setAiLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/translate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence: recognizedWordList,
          context: polishedSentence, // Carry previous context if any
        }),
      });

      if (!res.ok) {
        throw new Error("Local server translation API failed.");
      }

      const data = await res.json();
      if (data.corrected) {
         setPolishedSentence(data.corrected);
         if (data.suggestions && data.suggestions.length > 0) {
           setAiSuggestions(data.suggestions);
         }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to reach advanced translator back-end. Operating in offline state.");
    } finally {
      setAiLoading(false);
    }
  };

  const currentSentenceRaw = recognizedWordList.join(" ");

  return (
    <div className="p-6 rounded-3xl bg-[#0F0F12] border border-slate-800 shadow-2xl flex flex-col gap-6" id="ai-control-panel">
      {/* 1. Sentence Accumulator / Word Slate (Module 7) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-bold font-mono tracking-wider uppercase">Gesture Slate</span>
          <span className="text-xs text-indigo-400 font-medium">Accumulating words sequentially ...</span>
        </div>

        <div className="min-h-24 p-4 rounded-2xl bg-[#16161A] border border-slate-800 flex flex-wrap gap-2 items-start content-start relative group">
          {recognizedWordList.length === 0 ? (
            <span className="text-slate-600 text-sm italic select-none">
              Captured gestures appear here as words. Strike gestures and tap &quot;Append Hand Sign&quot; to build.
            </span>
          ) : (
            recognizedWordList.map((word, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-medium text-sm animate-fade-in"
              >
                {word}
              </span>
            ))
          )}

          {/* Inline hotkeys */}
          {recognizedWordList.length > 0 && (
            <div className="absolute top-2 right-2 flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 shadow opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onBackspace}
                title="Backspace"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClearWords}
                title="Clear Slate"
                className="p-1 hover:bg-rose-950 rounded text-rose-400 hover:text-rose-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Append Trigger button & current hover state */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            if (currentGesture && currentGesture !== "Searching..." && currentGesture !== "Unknown Gesture") {
              onAppendWord(currentGesture);
            }
          }}
          disabled={!currentGesture || currentGesture === "Searching..." || currentGesture === "Unknown Gesture"}
          className={`py-3 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border ${currentGesture && currentGesture !== "Searching..." && currentGesture !== "Unknown Gesture" ? 'bg-cyan-600 border-cyan-500 hover:bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.35)]' : 'bg-[#16161A] border-slate-800 text-slate-600 cursor-not-allowed'}`}
        >
          Append Hand Sign: &quot;{currentGesture && currentGesture !== "Searching..." && currentGesture !== "Unknown Gesture" ? currentGesture : 'None'}&quot;
        </button>

        <button
          onClick={() => triggerSpeech(currentSentenceRaw)}
          disabled={recognizedWordList.length === 0}
          className={`py-3 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 border cursor-pointer ${recognizedWordList.length > 0 ? 'bg-[#16161A] hover:bg-[#202026] text-slate-200 border-slate-800' : 'bg-[#16161A]/40 text-slate-600 border-slate-850/10 cursor-not-allowed'}`}
        >
          <Volume2 className="w-4 h-4 text-cyan-400" />
          Speak Raw Slate
        </button>
      </div>

      {/* 2. Advanced Full-Stack AI Translation Box (Fulfills Gemini API rules and Sentence predictions) */}
      <div className="p-4 rounded-2xl bg-[#16161A]/60 border border-slate-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="font-display font-bold text-sm text-slate-200">Fluid AI Translation (Gemini Pro)</h4>
          </div>
          <button
            onClick={handleTranslateWithAI}
            disabled={aiLoading || recognizedWordList.length === 0}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide transition flex items-center gap-1 cursor-pointer ${recognizedWordList.length === 0 ? 'bg-slate-800/50 text-slate-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
          >
            {aiLoading ? "Smoothing..." : "Polished Sentence"}
          </button>
        </div>

        <div className="p-3 bg-[#0F0F12] rounded-xl min-h-12 border border-slate-800/80 flex flex-col justify-center">
          {polishedSentence ? (
            <p className="text-sm font-medium text-slate-200">{polishedSentence}</p>
          ) : (
            <span className="text-xs text-slate-500 italic">Advanced grammatical correction sequence will populate here.</span>
          )}
        </div>

        {/* Speak button for polished output */}
        {polishedSentence && (
          <button
            onClick={() => triggerSpeech(polishedSentence)}
            className="self-end px-3 py-1 bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase font-mono tracking-wide rounded-lg hover:bg-cyan-400 transition cursor-pointer flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Speech Fluid Voice
          </button>
        )}

        {/* Next word dynamic suggestions (Module 7 and Additional features) */}
        <div>
          <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500 block mb-2">Predictive Context Suggestions</span>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onAppendWord(sug);
                  // Auto speak suggestion
                  triggerSpeech(sug);
                }}
                className="px-2.5 py-1 text-xs rounded-lg bg-[#0F0F12] hover:bg-[#16161A] text-slate-300 transition-all font-medium border border-slate-800/80 cursor-pointer"
              >
                + {sug}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-[10px] text-amber-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 3. Text to Speech Vocal Customizer (Module 8 Controls) */}
      <div className="flex flex-col gap-4 border-t border-slate-800 pt-4">
        <span className="text-xs font-bold font-mono text-slate-400 tracking-wider uppercase">Voice synthesizer config (TTS)</span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Accent Voice</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="px-2.5 py-1.5 bg-[#16161A] border border-slate-800 text-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-500 scrollbar-thin max-w-full"
            >
              {voices.length === 0 ? (
                <option>Local System Voices</option>
              ) : (
                voices.map((v, i) => (
                  <option key={i} value={v.name} className="bg-slate-950 text-xs">
                     {v.name} ({v.lang})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              <span>Speech Speed</span>
              <span>{speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg bg-[#16161A] accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              <span>Vocal Pitch</span>
              <span>{speechPitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speechPitch}
              onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg bg-[#16161A] accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
