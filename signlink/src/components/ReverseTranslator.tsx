import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  Square, 
  Mic, 
  MicOff, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  Keyboard, 
  ArrowRight,
  Gauge,
  CircleDot
} from "lucide-react";
import { getLetterLandmarks, SKELETON_CONNECTIONS, SPECIAL_SIGNS_GLOSSARY } from "../utils/reverseGestureModel";
import { Landmark } from "../types";

export default function ReverseTranslator() {
  // Input states
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [listeningError, setListeningError] = useState("");

  // Playback States
  const [playlist, setPlaylist] = useState<{ id: string; type: "letter" | "word"; label: string; landmarks: Landmark[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per step (1000ms = 1s)
  const [loopMode, setLoopMode] = useState(false);

  // Speech Recognition API reference
  const recognitionRef = useRef<any>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set up speech recognition on mount
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setListeningError("");
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          // Auto generate playlist when transcribed
          processTextToSign(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setListeningError("Microphone permission denied.");
        } else {
          setListeningError(`Voice Assist error: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, []);

  // Process text into translation playlist sequence (Letters & special words)
  const processTextToSign = (textToConvert: string) => {
    const text = textToConvert.toUpperCase().trim();
    if (!text) {
      setPlaylist([]);
      setCurrentIndex(0);
      setIsPlaying(false);
      return;
    }

    const items: { id: string; type: "letter" | "word"; label: string; landmarks: Landmark[] }[] = [];
    const words = text.split(/\s+/);

    words.forEach((word, wordIdx) => {
      // 1. Check if the word is a recognized special glossary gesture (e.g., HELLO, YES, THANKYOU)
      const cleanWord = word.replace(/[^A-Z]/g, "");
      if (SPECIAL_SIGNS_GLOSSARY[cleanWord]) {
        const signLabel = SPECIAL_SIGNS_GLOSSARY[cleanWord];
        // Retrieve landmarks for the sign (or fallback to its first letter landmark)
        const signLandmarks = getLetterLandmarks(signLabel.substring(0, 1));
        items.push({
          id: `word-${cleanWord}-${wordIdx}`,
          type: "word",
          label: signLabel,
          landmarks: signLandmarks
        });
      } else {
        // 2. Otherwise, finger-spell letter-by-letter
        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          if (/[A-Z]/.test(char)) {
            const letterLandmarks = getLetterLandmarks(char);
            items.push({
              id: `letter-${char}-${wordIdx}-${i}`,
              type: "letter",
              label: char,
              landmarks: letterLandmarks
            });
          }
        }
      }

      // Add a brief word break spacer at the end of words (except last one)
      if (wordIdx < words.length - 1 && items.length > 0) {
        items.push({
          id: `spacer-${wordIdx}`,
          type: "word",
          label: "Space ␣",
          landmarks: getLetterLandmarks("B") // Draw open relaxed hand for space
        });
      }
    });

    setPlaylist(items);
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  // Playback timer effects
  useEffect(() => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }

    if (isPlaying && playlist.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          if (prevIndex < playlist.length - 1) {
            return prevIndex + 1;
          } else {
            if (loopMode) {
              return 0;
            } else {
              setIsPlaying(false);
              return prevIndex;
            }
          }
        });
      }, playbackSpeed);
    }

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playlist, playbackSpeed, loopMode]);

  const handleStartVoice = () => {
    if (!recognitionRef.current) {
      setListeningError("Web Speech API voice transcribing is not supported in this browser.");
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const togglePlayback = () => {
    if (playlist.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const resetPlayback = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : playlist.length - 1));
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev < playlist.length - 1 ? prev + 1 : 0));
  };

  // Get dynamic anatomy tip helper text based on active playback label
  const getAnatomyTip = (label: string): string => {
    const l = label.toUpperCase();
    if (l.includes("SPACE")) return "Space spacer: Stand palm completely relaxed and open to signify the split between words.";
    if (l === "HELLO") return "Open hand tilted, fingers wide apart. Wave outwards slowly.";
    if (l === "THANK YOU" || l === "THANKS") return "Touch fingertips to chin/lips, then flatten your palm forward and down.";
    if (l === "YES") return "Rock clenched fist down and up twice (simulating a head nodding).";
    if (l === "NO") return "Snap index and middle fingers down together onto your extended thumb.";
    
    // Fallback letter anatomy
    switch (l) {
      case "A": return "Letter A (Fist): Clench index, middle, ring, and pinky tight. Thumb rests flat along side of index knuckles.";
      case "B": return "Letter B (Flat Palm): Extend index, middle, ring, and pinky straight up side-by-side. Thumb tucks over palm.";
      case "C": return "Letter C (Cup): Curve all 5 fingers together into a crescent shape resembling the letter 'C'.";
      case "D": return "Letter D (Pointer): Point index straight up. Touch tips of thumb, middle, ring, and pinky in a closed loop below.";
      case "E": return "Letter E (Claw Fist): Curl all fingers tightly flat against their bases. Thumb folds tight horizontally beneath.";
      case "F": return "Letter F (OK Gesture): Touch index tip and thumb tip to form a circle. Extend middle, ring, and pinky straight up.";
      case "G": return "Letter G (Pinch horizontal): Point index straight out horizontally. Extend thumb straight up forming right angle.";
      case "H": return "Letter H (Double pointer): Extend index and middle straight out horizontally side-by-side. Tightly clench ring & pinky.";
      case "I": return "Letter I (Small Finger): Clench index, middle, ring & thumb. Extend only your pinky finger straight up.";
      case "J": return "Letter J (Pinky hook): Stand pinky straight up, then trace a looping 'J' hook trajectory in the air with it.";
      case "K": return "Letter K (Ascending V): Stand index finger straight up, angle middle forward at 45 degrees, rest thumb tip on middle.";
      case "L": return "Letter L (Right Angle): Stand index straight up and extend thumb straight out horizontally to make an L-shape.";
      case "M": return "Letter M (Triple Wrap): Fold index, middle, and ring fingers over your thumb tucked underneath them.";
      case "N": return "Letter N (Double Wrap): Fold index and middle fingers over your thumb tucked underneath them.";
      case "O": return "Letter O (O-Ring): Curve all fingers to meet the thumb tip, forming a perfect circular ring.";
      case "P": return "Letter P (Slanted K): Point your index straight out tilted downwards, with middle finger at 45 degrees, thumb resting on middle.";
      case "Q": return "Letter Q (Down Pinch): Point index and thumb downwards in a pinching pose (recursively inverted letter G).";
      case "R": return "Letter R (Twisted index): Twist your middle finger tightly over the back of your index finger. Curl other fingers tight.";
      case "S": return "Letter S (Solid Fist): Clench all 4 fingers into a tight fist. Wrap your thumb across the middle face of index/middle.";
      case "T": return "Letter T (Single tuck): Clench fingers. Tuck your thumb up behind your index finger so only thumb knuckle peeks.";
      case "U": return "Letter U (Double tight): Extend index and middle fingers straight up side-by-side touching. Curl others tight.";
      case "V": return "Letter V (Peace Sign): Spread index and middle fingers apart forming a V. Curl ring, pinky, and thumb tight.";
      case "W": return "Letter W (Triple Crown): Extend index, middle, and ring fingers spread apart. Touch thumb tip and pinky tip together.";
      case "X": return "Letter X (Finger hook): Clench middle, ring, pinky, and thumb. Hook your index finger into a crescent curve.";
      case "Y": return "Letter Y (Horns out): Extend thumb and pinky wide. Clench index, middle, and ring tight.";
      case "Z": return "Letter Z (Index sketch): Stand index straight up and trace a quick 'Z' pattern in the air with the finger tip.";
      default: return `Spelling the character '${l}' sequentially. Hold hands steadily in frame.`;
    }
  };

  // Get active item
  const activeItem = playlist[currentIndex];
  const landmarksToRender = activeItem ? activeItem.landmarks : null;

  // Visual helper functions to render realistic, detailed, and understandable hands
  const getBoneStyle = (start: number, end: number) => {
    // Check which finger sequence they belong to
    if (start >= 1 && end <= 4) return { stroke: "#f43f5e", width: 2.2 }; // Thumb (Rose)
    if (start >= 5 && end <= 8) return { stroke: "#06b6d4", width: 2.2 }; // Index (Cyan)
    if (start >= 9 && end <= 12) return { stroke: "#a855f7", width: 2.2 }; // Middle (Purple)
    if (start >= 13 && end <= 16) return { stroke: "#f59e0b", width: 2.2 }; // Ring (Amber)
    if (start >= 17 && end <= 20) return { stroke: "#ec4899", width: 2.2 }; // Pinky (Pink)
    // Wrist/palm structural bounds
    return { stroke: "rgba(148, 163, 184, 0.45)", width: 1.5, dash: "2,2" };
  };

  const getJointColor = (idx: number) => {
    if (idx === 0) return "#3b82f6"; // Wrist base (Blue)
    if (idx >= 1 && idx <= 4) return "#f43f5e"; // Thumb (Rose)
    if (idx >= 5 && idx <= 8) return "#06b6d4"; // Index (Cyan)
    if (idx >= 9 && idx <= 12) return "#a855f7"; // Middle (Purple)
    if (idx >= 13 && idx <= 16) return "#f59e0b"; // Ring (Amber)
    if (idx >= 17 && idx <= 20) return "#ec4899"; // Pinky (Pink)
    return "#10b981";
  };

  const getPalmPointsStr = (landmarks: Landmark[]) => {
    // Vertices outlining the standard palm base: Wrist (0), Thumb Base (1), Index Base (5), Middle Base (9), Ring Base (13), Pinky Base (17)
    const indices = [0, 1, 5, 9, 13, 17];
    return indices
      .map(i => {
        const p = landmarks[i];
        if (!p) return "";
        return `${p.x * 100},${p.y * 100}`;
      })
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="p-6 rounded-3xl bg-[#0F0F12] border border-slate-800 shadow-2xl flex flex-col gap-6" id="reverse-translator">
      {/* 1. Feature Title Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-100 uppercase tracking-wider">Voice &amp; Text Signer</h3>
            <p className="text-[10px] text-slate-500 font-mono">REVERSE TRANSLATION ENGINE // GENERATOR</p>
          </div>
        </div>
        
        <div className="text-[10px] font-mono select-none px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Reverse-Translator
        </div>
      </div>

      {/* 2. Interactive Input Panel */}
      <div className="flex flex-col gap-3">
        <label className="text-[10px] font-bold text-slate-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
          Statement or Phrase to Sign
        </label>
        
        <div className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              processTextToSign(e.target.value);
            }}
            placeholder="Type anything (e.g. hello please, b t e c h, yes)..."
            className="w-full pl-4 pr-12 py-3 rounded-xl bg-[#16161A] border border-slate-800 text-sm focus:outline-none focus:border-emerald-500 text-slate-100 transition-all placeholder:text-slate-650"
          />
          <button
            onClick={isListening ? handleStopVoice : handleStartVoice}
            className={`absolute right-2 top-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
              isListening 
              ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse" 
              : "bg-slate-800/80 hover:bg-slate-700 border-slate-750 text-slate-300"
            }`}
            title={isListening ? "Stop Voice Transcription" : "Transcribe Voice with Mic"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {listeningError && (
          <p className="text-[10px] text-rose-400 font-mono leading-none bg-rose-950/20 border border-rose-800/30 p-2 rounded-lg">
            ⚠️ {listeningError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <span className="text-[9px] font-mono text-slate-500 self-center">Try templates:</span>
          {["HELLO YES", "THANK YOU", "A B C D E", "SIGN LANGUAGE"].map((tmp) => (
            <button
              key={tmp}
              onClick={() => {
                setInputText(tmp);
                processTextToSign(tmp);
              }}
              className="px-2.5 py-1 rounded text-[10px] font-mono bg-slate-900 border border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              {tmp}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Splitting/Sequence Visual Representation bar */}
      {playlist.length > 0 && (
        <div className="flex flex-col gap-2 bg-[#16161A]/40 p-3.5 rounded-2xl border border-slate-850">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Translation Sequence</span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">{currentIndex + 1} / {playlist.length} Frames</span>
          </div>
          
          <div className="flex gap-1.5 py-1 overflow-x-auto scrollbar-thin">
            {playlist.map((item, index) => {
              const isActive = index === currentIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentIndex(index);
                  }}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                    isActive
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] scale-102"
                    : item.type === "word"
                      ? "bg-[#16161A] hover:bg-[#202026] text-cyan-400 border-slate-800/80"
                      : "bg-[#16161A]/60 hover:bg-[#202026] text-slate-400 border-slate-800/40"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Active Skeletal Render Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Render column layout */}
        <div className="md:col-span-6 flex flex-col items-center justify-center bg-[#16161A]/80 border border-slate-800/80 rounded-2xl relative p-5 aspect-square overflow-hidden group shadow-inner">
          
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded bg-[#0F0F12] border border-slate-800 text-[10px] font-mono text-slate-400">
            <CircleDot className="w-3 h-3 text-emerald-400 animate-pulse" />
            Skeleton Output
          </div>

          {/* Top-Right Interactive Finger Color Guide Legend Badge */}
          <div className="absolute top-3 right-3 flex flex-wrap max-w-[145px] sm:max-w-none items-center justify-end gap-1.5 text-[8px] font-mono text-slate-400 bg-[#0F0F12]/90 px-2 py-1 rounded-lg border border-slate-800/60 transition-all select-none shadow">
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></span>Thumb</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]"></span>Index</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span>Mid</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>Ring</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-[#ec4899]"></span>Pinky</span>
          </div>

          {landmarksToRender ? (
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full max-w-64 max-h-64 object-contain filter drop-shadow-[0_0_15px_rgba(99,102,241,0.25)]"
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="1.0" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Render Palm Shading Polygon boundary for structure orientation */}
              {getPalmPointsStr(landmarksToRender) && (
                <polygon
                  points={getPalmPointsStr(landmarksToRender)}
                  fill="rgba(99, 102, 241, 0.12)"
                  stroke="rgba(99,102,241,0.3)"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
              )}

              {/* Render Bone connections with localized style colors */}
              {SKELETON_CONNECTIONS.map(([start, end], idx) => {
                const sPoint = landmarksToRender[start];
                const ePoint = landmarksToRender[end];
                if (!sPoint || !ePoint) return null;
                
                const style = getBoneStyle(start, end);
                
                return (
                  <line
                    key={`bone-${idx}`}
                    x1={sPoint.x * 100}
                    y1={sPoint.y * 100}
                    x2={ePoint.x * 100}
                    y2={ePoint.y * 100}
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeLinecap="round"
                    strokeDasharray={style.dash || ""}
                    className="opacity-90 transition-all duration-300"
                    filter="url(#glow)"
                  />
                );
              })}

              {/* Render Joint points and anatomical tip text labels overlay */}
              {landmarksToRender.map((joint, idx) => {
                const isTip = [4, 8, 12, 16, 20].includes(idx);
                const isWrist = idx === 0;
                const jointColor = getJointColor(idx);

                // Setup clear finger labels for immediate user understanding
                let labelText = "";
                if (idx === 4) labelText = "Thumb";
                if (idx === 8) labelText = "Index";
                if (idx === 12) labelText = "Middle";
                if (idx === 16) labelText = "Ring";
                if (idx === 20) labelText = "Pinky";
                
                return (
                  <g key={`joint-grp-${idx}`}>
                    <circle
                      cx={joint.x * 100}
                      cy={joint.y * 100}
                      r={isWrist ? 2.4 : isTip ? 1.8 : 1.3}
                      className="transition-all duration-300"
                      fill={jointColor}
                      stroke="#ffffff"
                      strokeWidth="0.5"
                    />

                    {/* fingertip text markers overlay */}
                    {isTip && (
                      <g>
                        <text
                          x={joint.x * 100}
                          y={joint.y * 100 - 4.5}
                          fill={jointColor}
                          fontSize="3.2"
                          fontWeight="bold"
                          textAnchor="middle"
                          filter="url(#glow)"
                          className="font-mono select-none"
                        >
                          {labelText}
                        </text>
                        {/* subtle connecting connector */}
                        <line 
                          x1={joint.x * 100}
                          y1={joint.y * 100}
                          x2={joint.x * 100}
                          y2={joint.y * 100 - 3.5}
                          stroke={jointColor}
                          strokeWidth="0.3"
                          strokeDasharray="1,1"
                          className="opacity-60"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Sparkles className="w-8 h-8 text-slate-600 animate-pulse" />
              <p className="text-xs text-slate-500">Input some text above or speak into the microphone to display sign language skeletons.</p>
            </div>
          )}

          {/* Floating Current visual card overlay */}
          {activeItem && (
            <div className="absolute bottom-3 right-3 left-3 py-2 px-3 rounded-xl bg-[#0F0F12]/90 border border-slate-800 text-center flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Active Sign:</span>
              <span className="font-serif font-semibold text-lg text-emerald-400 italic px-2">{activeItem.label}</span>
            </div>
          )}
        </div>

        {/* Info Column containing controllers & anatomic guides */}
        <div className="md:col-span-6 flex flex-col justify-between gap-4">
          
          {/* Controllers Card */}
          <div className="p-4 bg-[#16161A]/60 border border-slate-800/60 rounded-2xl flex flex-col gap-3">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Player Controls</span>
            
            <div className="flex justify-center items-center gap-3">
              <button
                onClick={resetPlayback}
                disabled={playlist.length === 0}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Reset sequence"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handlePrev}
                disabled={playlist.length === 0}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Previous sign"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlayback}
                disabled={playlist.length === 0}
                className={`p-3.5 rounded-xl transition cursor-pointer ${
                  isPlaying 
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={isPlaying ? "Pause visual playback" : "Play Sign Sequence"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>

              <button
                onClick={handleNext}
                disabled={playlist.length === 0}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Next sign"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLoopMode(!loopMode)}
                disabled={playlist.length === 0}
                className={`px-3 py-2 rounded-xl border text-[10px] font-mono tracking-wide font-medium transition cursor-pointer ${
                  loopMode 
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400" 
                  : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
                title="Toggle continuous looping"
              >
                LOOP
              </button>
            </div>

            {/* Speed slider */}
            <div className="flex flex-col gap-1.5 border-t border-slate-850 pt-2.5">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> Delay Per Sign</span>
                <span>{(playbackSpeed / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="400"
                max="2500"
                step="100"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg bg-slate-800 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Handbook/Tip Display Box */}
          <div className="p-4 bg-[#16161A]/40 border border-slate-850 rounded-2xl flex flex-col gap-2 flex-grow min-h-24 justify-center">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Finger-Spelling Guide
            </span>
            <p className="text-xs text-slate-400 leading-relaxed font-sans mt-0.5">
              {activeItem 
                ? getAnatomyTip(activeItem.label) 
                : "Enter text above or speak with your voice first. The signer will procedurally construct the corresponding real-time joint-nodes pose map below with active instructions."
              }
            </p>
          </div>
          
        </div>
      </div>

    </div>
  );
}
