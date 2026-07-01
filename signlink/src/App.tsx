import React, { useState, useEffect } from "react";
import WebcamTranslator from "./components/WebcamTranslator";
import DatasetManager from "./components/DatasetManager";
import AIControlPanel from "./components/AIControlPanel";
import ReverseTranslator from "./components/ReverseTranslator";
import { Landmark, GestureTemplate } from "./types";
import { classifyGesture, solveFingerExtensions } from "./utils/gestureClassifier";
import { Sparkles, BrainCircuit, Hand, BookOpen, GraduationCap, Github } from "lucide-react";

export default function App() {
  // Landmarks state
  const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null);
  const [fingerExtensions, setFingerExtensions] = useState<boolean[]>([false, false, false, false, false]);

  // Gestures loaded from localStorage to persist user recordings
  const [userSavedTemplates, setUserSavedTemplates] = useState<GestureTemplate[]>([]);

  // Sliding majority vote predictions (Module 6)
  const [rawPrediction, setRawPrediction] = useState("Searching...");
  const [latestPrediction, setLatestPrediction] = useState("Searching...");
  const [confidence, setConfidence] = useState(0);
  const [predictionHistory, setPredictionHistory] = useState<string[]>([]);

  // Slate accumulated words
  const [recognizedWordList, setRecognizedWordList] = useState<string[]>([]);

  // Load custom gestures recorded by user
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sign_language_custom_gestures");
      if (stored) {
        setUserSavedTemplates(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load custom stored gestures:", e);
    }
  }, []);

  const handleLandmarksTracked = (landmarks: Landmark[], handedness: "Left" | "Right") => {
    setCurrentLandmarks(landmarks);
    
    // Classify gesture
    const result = classifyGesture(landmarks, userSavedTemplates);
    setRawPrediction(result.gesture);
    setConfidence(result.confidence);
    
    // Calculate finger triggers
    setFingerExtensions(solveFingerExtensions(landmarks));

    // Majority voting smoothing (Fulfills Module 6)
    setPredictionHistory((prev) => {
      const updated = [...prev, result.gesture].slice(-12); // sliding window of 12 frames
      
      const frequencies: Record<string, number> = {};
      let maxFreq = 0;
      let consensus = "Searching...";

      updated.forEach((gesture) => {
        frequencies[gesture] = (frequencies[gesture] || 0) + 1;
        if (frequencies[gesture] > maxFreq) {
          maxFreq = frequencies[gesture];
          consensus = gesture;
        }
      });

      // Filter noise
      if (consensus !== "Unknown Gesture" && maxFreq >= 5) {
        setLatestPrediction(consensus);
      } else if (consensus === "Unknown Gesture") {
        setLatestPrediction("Unknown Target");
      } else {
        setLatestPrediction("Searching...");
      }

      return updated;
    });
  };

  const handleTrackingLost = () => {
    setCurrentLandmarks(null);
    setFingerExtensions([false, false, false, false, false]);
    setRawPrediction("Searching...");
    setLatestPrediction("Searching...");
    setConfidence(0);
    setPredictionHistory([]);
  };

  const handleAddTemplate = (name: string, landmarks: Landmark[]) => {
    const updated = [...userSavedTemplates, { name, landmarks }];
    setUserSavedTemplates(updated);
    localStorage.setItem("sign_language_custom_gestures", JSON.stringify(updated));
  };

  const handleClearTemplates = () => {
    setUserSavedTemplates([]);
    localStorage.removeItem("sign_language_custom_gestures");
  };

  // Slate operations (Module 7)
  const handleClearWords = () => setRecognizedWordList([]);
  const handleBackspace = () => setRecognizedWordList((prev) => prev.slice(0, -1));
  const handleAppendWord = (word: string) => {
    if (!word || word === "Searching..." || word === "Unknown Gesture" || word === "Unknown Target") return;
    setRecognizedWordList((prev) => {
      // Avoid immediate sequential duplicate clicks of same gesture if desired
      return [...prev, word];
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans pb-16">
      {/* 1. Header Banner styled following the Sophisticated Dark theme specifications */}
      <header className="border-b border-slate-800 bg-[#0F0F12] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
             <div className="border-l border-slate-700 pl-4">
               <h1 className="font-display font-medium text-base text-slate-100 tracking-tight flex items-center gap-2 uppercase">
                 SignLink
                 <span className="text-slate-500 font-light italic text-xs capitalize">Real-Time AI Translator</span>
                 <span className="text-[9px] font-mono select-none px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 lowercase">v2.5 full-stack</span>
               </h1>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest leading-none font-mono">Engine Status</p>
              <p className="text-xs font-mono text-emerald-400">ACTIVE // WEBCAM_USB</p>
            </div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-300 bg-[#16161A] px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
              Sign Language Translator
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Bento Grid Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 flex flex-col gap-8">
        
        {/* Intro academic summarycard to elevate presentation */}
        <div className="p-6 rounded-3xl bg-[#0F0F12] border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-start gap-4 max-w-3xl">
            <GraduationCap className="w-10 h-10 text-indigo-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-display font-bold text-base text-slate-100 tracking-tight">Academic Demonstration Profile</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                This full-stack system facilitates smooth conversation translating sign language hand gestures into fluent, text-to-speech synthesized statements. It operates using client-side **MediaPipe WASM** coordinate extraction on a 21-joint skeleton, standardizing values for webcam distance translation-invariance, combined with **Generative AI sequence smoothing** (Gemini Pro) to craft proper grammatical outputs.
              </p>
            </div>
          </div>
          <div className="bg-[#16161A] p-4 rounded-2xl border border-slate-800/80 min-w-44 text-center md:text-left">
            <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase block">Out of the Box Signs</span>
            <span className="font-display text-lg font-bold text-slate-200 mt-0.5 block">15+ Gestures</span>
            <span className="text-[10px] text-indigo-400 font-semibold font-mono block mt-1">A-J + Hello, Thanks, Yes, No, Please</span>
          </div>
        </div>

        {/* Bento grid panels split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Live camera feed skeleton (7 cols) */}
          <section className="lg:col-span-7 flex flex-col gap-8">
            <WebcamTranslator
              onLandmarksTracked={handleLandmarksTracked}
              onTrackingLost={handleTrackingLost}
              latestPrediction={latestPrediction}
              confidence={confidence}
              userSavedTemplates={userSavedTemplates}
            />

            <DatasetManager
              currentLandmarks={currentLandmarks}
              userSavedTemplates={userSavedTemplates}
              onAddTemplate={handleAddTemplate}
              onClearTemplates={handleClearTemplates}
              fingerExtensions={fingerExtensions}
            />
          </section>

          {/* Right Column: AI Translation & Text-to-Speech (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-8">
            <AIControlPanel
              recognizedWordList={recognizedWordList}
              currentGesture={latestPrediction}
              onClearWords={handleClearWords}
              onBackspace={handleBackspace}
              onAppendWord={handleAppendWord}
            />

            <ReverseTranslator />

            {/* Quick-Guide info and handbook section to fulfill Academic project requirements */}
            <div className="p-6 rounded-3xl bg-[#0F0F12] border border-slate-800 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-display font-bold text-sm text-slate-200">Interactive Handbook &amp; Guide</h3>
              </div>

              <div className="flex flex-col gap-3 font-sans text-xs text-slate-400 leading-relaxed">
                <div className="p-3.5 bg-[#16161A] rounded-xl border border-slate-800/80">
                  <span className="font-bold text-slate-200 font-mono tracking-wide uppercase text-[10px] text-cyan-400 block mb-1">Finger Configuration Tips:</span>
                  <ul className="list-disc pl-4 gap-1.5 flex flex-col">
                    <li><strong className="text-slate-300">Letter A (Fist):</strong> Clench all 5 fingers tight. Thumb lays alongside index knuckles.</li>
                    <li><strong className="text-slate-300">Letter B (Flat Palm):</strong> Extend all 5 fingers straight up kept closely together.</li>
                    <li><strong className="text-slate-300">Letter D (Pointer):</strong> Clench all fingers but stand your index pointing straight up.</li>
                    <li><strong className="text-slate-300">Thank You (Palm Out):</strong> Hold palm flat near face/mouth and move it slightly.</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-[#16161A] rounded-xl border border-slate-800/80">
                  <span className="font-bold text-slate-200 font-mono tracking-wide uppercase text-[10px] text-indigo-400 block mb-1">Demonstration Flow Strategy:</span>
                  <p>
                    1. Turn on the Web Stream. Put your hand in frame to initialize WASM coordinates.<br />
                    2. Hold gesture <strong className="text-slate-300">B</strong> (Hello) for a second. Tap &quot;Append Hand Sign&quot; once stabilized. <br />
                    3. Do gesture <strong className="text-slate-300">D</strong> (pointing). Click &quot;Append Hand Sign&quot;.<br />
                    4. Click &quot;Polished Sentence&quot; to invoke Gemini, which transforms raw sequence <span className="text-indigo-400 font-mono">B D</span> into smooth grammar: <span className="text-cyan-400 italic">“Hello, look over there.”</span>
                  </p>
                </div>
              </div>
            </div>

          </section>

        </div>
      </main>

      {/* Footer credits */}
      <footer className="mt-20 border-t border-slate-800 pt-8 max-w-7xl mx-auto text-center px-4">
         <p className="text-xs text-slate-600 font-mono">
           Real-Time Sign Language Translator AI System &copy; {new Date().getFullYear()}. All Rights Reserved. Custom WebGL Accelerated WASM MediaPipe Layer.
         </p>
         <div className="flex justify-center gap-4 mt-3 text-slate-500 hover:text-slate-400 text-xs transition">
           <span>B.Tech CSE Project Defense Framework Documentation</span>
         </div>
      </footer>
    </div>
  );
}
