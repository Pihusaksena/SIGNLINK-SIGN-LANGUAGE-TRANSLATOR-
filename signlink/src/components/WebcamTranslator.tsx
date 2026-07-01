import React, { useRef, useEffect, useState } from "react";
import { Landmark, AnalyticsState, GestureTemplate } from "../types";
import { Camera as CameraIcon, AlertTriangle, Cpu, Play, Square, VideoOff, Layers, CheckCircle2, ChevronRight, HelpCircle } from "lucide-react";
import { SEEDED_GESTURES, normalizeLandmarks } from "../utils/gestureClassifier";
import { getLetterLandmarks } from "../utils/reverseGestureModel";

declare var Hands: any;
declare var Camera: any;

interface WebcamTranslatorProps {
  onLandmarksTracked: (landmarks: Landmark[], handedness: "Left" | "Right") => void;
  onTrackingLost: () => void;
  latestPrediction: string;
  confidence: number;
  userSavedTemplates?: GestureTemplate[];
}

export default function WebcamTranslator({
  onLandmarksTracked,
  onTrackingLost,
  latestPrediction,
  confidence,
  userSavedTemplates = [],
}: WebcamTranslatorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hologram Wireframe overlay settings & stats state
  const [guideTarget, setGuideTarget] = useState<string>("Auto");
  const [guideOpacity, setGuideOpacity] = useState<number>(0.75);
  const [matchScore, setMatchScore] = useState<number | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsState>({
    fps: 0,
    landmarksCapturedCount: 0,
    latencyMs: 0,
    detectedHands: 0,
    triggerCooldown: 0,
  });

  // Track FPS and processing times
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsIntervalRef = useRef<any>(null);
  const cameraInstanceRef = useRef<any>(null);
  const handsInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Collect FPS metrics
    fpsIntervalRef.current = setInterval(() => {
      setAnalytics((prev) => ({
        ...prev,
        fps: frameCountRef.current,
      }));
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(fpsIntervalRef.current);
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    try {
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
        cameraInstanceRef.current = null;
      }
      if (handsInstanceRef.current) {
        handsInstanceRef.current.close();
        handsInstanceRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    } catch (e) {
      console.error("Error stopping camera instances:", e);
    }
    setActive(false);
    onTrackingLost();
    setMatchScore(null);
  };

  const startCamera = async () => {
    setLoading(true);
    setErrorMsg(null);

    // Verify CDN loaded successfully
    if (typeof Hands === "undefined" || typeof Camera === "undefined") {
      setErrorMsg("MediaPipe script CDNs failed to load. Please check your internet connection.");
      setLoading(false);
      return;
    }

    try {
      // 1. Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });

      hands.onResults((results: any) => {
        const startTime = performance.now();
        frameCountRef.current += 1;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Access predictions
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const rawLandmarks = results.multiHandLandmarks[0];
          const handedness = results.multiHandedness && results.multiHandedness[0]
            ? results.multiHandedness[0].label
            : "Right";

          // Format landmarks
          const landmarks: Landmark[] = rawLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z ?? 0,
          }));

          // Trigger state communication
          onLandmarksTracked(landmarks, handedness);

          // Draw the hand overlay skeleton
          drawHandSkeleton(ctx, rawLandmarks, canvas.width, canvas.height);

          // Render wireframe gesture guidelines if any target is set
          let targetName = guideTarget;
          if (guideTarget === "Auto") {
            targetName = latestPrediction;
          }

          if (targetName && targetName !== "None" && targetName !== "Searching..." && targetName !== "Unknown Target" && targetName !== "Unknown Gesture") {
            const templatePoints = getTargetGesturePoints(targetName, userSavedTemplates);
            if (templatePoints) {
              drawTemplateOverlay(ctx, templatePoints, rawLandmarks, canvas.width, canvas.height, guideOpacity);

              // Calculate similarity percentage score
              const userNorm = normalizeLandmarks(landmarks);
              if (userNorm.length === 21 && templatePoints.length === 21) {
                let sumDist = 0;
                for (let i = 0; i < 21; i++) {
                  const dx = userNorm[i].x - templatePoints[i].x;
                  const dy = userNorm[i].y - templatePoints[i].y;
                  const dz = (userNorm[i].z || 0) - (templatePoints[i].z || 0);
                  sumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
                }
                const averageDist = sumDist / 21;
                // Convert average normalized distance to percentage
                let computedScore = Math.round(Math.max(0, 100 - (averageDist * 115)));
                if (computedScore < 20) computedScore = 20;
                if (computedScore > 100) computedScore = 100;
                setMatchScore(computedScore);
              } else {
                setMatchScore(null);
              }
            } else {
              setMatchScore(null);
            }
          } else {
            setMatchScore(null);
          }

          setAnalytics((prev) => ({
            ...prev,
            detectedHands: results.multiHandLandmarks.length,
            landmarksCapturedCount: landmarks.length,
            latencyMs: Math.round(performance.now() - startTime),
          }));
        } else {
          onTrackingLost();
          setMatchScore(null);
          setAnalytics((prev) => ({
            ...prev,
            detectedHands: 0,
            latencyMs: Math.round(performance.now() - startTime),
          }));
        }
      });

      handsInstanceRef.current = hands;

      // 2. Access Web Media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // 3. Connect Video elements to MediaPipe runner
      const camera_obj = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
             await hands.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      await camera_obj.start();
      cameraInstanceRef.current = camera_obj;
      setActive(true);
    } catch (err: any) {
      console.error("Camera activation error:", err);
      setErrorMsg(
        err.message?.includes("Permission") || err.name === "NotAllowedError"
          ? "Camera Permission Denied. Please unblock camera access in your browser settings."
          : "Could not access camera. Make sure no other device is using it."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleFeed = () => {
    if (active) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const getTargetGesturePoints = (name: string, customTemplates?: GestureTemplate[]): Landmark[] | null => {
    if (!name) return null;
    const clean = name.trim().toUpperCase();

    // 1. Try standard SEEDED_GESTURES
    const seeded = SEEDED_GESTURES.find(g => g.name.toUpperCase() === clean);
    if (seeded) return seeded.landmarks;

    // 2. Try custom templates
    if (customTemplates) {
      const customMatches = customTemplates.find(g => g.name.toUpperCase() === clean);
      if (customMatches) return customMatches.landmarks;
    }

    // 3. Try letter models
    if (clean.length === 1 && /[A-Z]/.test(clean)) {
      try {
        return getLetterLandmarks(clean);
      } catch (e) {
        console.error("Could not load procedural letter landmarks:", clean, e);
      }
    }

    return null;
  };

  const drawTemplateOverlay = (
    ctx: CanvasRenderingContext2D,
    templatePoints: Landmark[],
    userRawPoints: any[],
    width: number,
    height: number,
    opacity: number
  ) => {
    if (templatePoints.length < 21 || userRawPoints.length < 21) return;

    // Get user projected points (mirrored x)
    const userCoords = userRawPoints.map((p) => ({
      x: (1 - p.x) * width,
      y: p.y * height,
    }));

    const Uw = userCoords[0];
    const UserVector = {
      x: userCoords[9].x - userCoords[0].x,
      y: userCoords[9].y - userCoords[0].y,
    };
    const userLen = Math.sqrt(UserVector.x * UserVector.x + UserVector.y * UserVector.y) || 1.0;
    const userAngle = Math.atan2(UserVector.y, UserVector.x);

    const Tw = templatePoints[0];
    const TemplateMCP = {
      x: templatePoints[9].x - templatePoints[0].x,
      y: templatePoints[9].y - templatePoints[0].y,
    };
    const templateLen = Math.sqrt(TemplateMCP.x * TemplateMCP.x + TemplateMCP.y * TemplateMCP.y) || 1.0;
    const templateAngle = Math.atan2(TemplateMCP.y, TemplateMCP.x);

    const diffAngle = userAngle - templateAngle;
    const scaleRatio = userLen / templateLen;

    const overlayCoords = templatePoints.map((tp) => {
      const relX = tp.x - Tw.x;
      const relY = tp.y - Tw.y;

      const rotX = relX * Math.cos(diffAngle) - relY * Math.sin(diffAngle);
      const rotY = relX * Math.sin(diffAngle) + relY * Math.cos(diffAngle);

      return {
        x: Uw.x + rotX * scaleRatio,
        y: Uw.y + rotY * scaleRatio,
      };
    });

    // Draw connecting lines (dashed glowing golden laser guide)
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#f59e0b"; // Golden glow
    ctx.strokeStyle = `rgba(245, 158, 11, ${opacity})`;
    ctx.lineWidth = 3.5;
    
    // Dynamic scanline pulse animation
    const pulseOffset = (Date.now() / 25) % 30;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -pulseOffset;

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17] // Palm Base Closure
    ];

    connections.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(overlayCoords[start].x, overlayCoords[start].y);
      ctx.lineTo(overlayCoords[end].x, overlayCoords[end].y);
      ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Draw joints
    templatePoints.forEach((_, i) => {
      const { x, y } = overlayCoords[i];
      const isTip = [4, 8, 12, 16, 20].includes(i);
      
      ctx.beginPath();
      ctx.arc(x, y, isTip ? 5.5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = isTip ? "#ec4899" : "#f59e0b"; // Pink fingertips, gold knuckles
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isTip) {
        ctx.beginPath();
        const outerPulse = 8 + Math.sin(Date.now() / 150) * 3;
        ctx.arc(x, y, outerPulse, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(236, 72, 153, ${0.45 * opacity})`;
        ctx.stroke();
      }
    });
  };

  // Modern glow graphics painter
  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, points: any[], width: number, height: number) => {
    // 21 points map connections (finger joints structure)
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17] // Palm Base Closure
    ];

    // Project coordinates
    const coords = points.map((p) => ({
      x: (1 - p.x) * width, // Mirror x-axis coordinates for user ease
      y: p.y * height,
    }));

    // 1. Draw connecting Bones under fluorescent style
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.75)"; // Teal bright blue
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#06b6d4";

    connections.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(coords[start].x, coords[start].y);
      ctx.lineTo(coords[end].x, coords[end].y);
      ctx.stroke();
    });

    // 2. Draw Landmark Joints
    ctx.shadowBlur = 0; // reset shadow
    points.forEach((pt, i) => {
      const { x, y } = coords[i];

      // Key palm indicators or fingertip node glows
      const isTip = [4, 8, 12, 16, 20].includes(i);
      const isWrist = i === 0;

      ctx.beginPath();
      ctx.arc(x, y, isTip ? 7 : isWrist ? 9 : 5, 0, 2 * Math.PI);
      
      // Select beautiful joint coloring
      if (isWrist) {
        ctx.fillStyle = "#ec4899"; // Pink
      } else if (isTip) {
        ctx.fillStyle = "#10b981"; // Emerald green tip
      } else {
        ctx.fillStyle = "#06b6d4"; // Cyan blue mid joints
      }
      
      ctx.fill();
      
      // Node white outline ring
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  };

  return (
    <div className="flex flex-col gap-6" id="webcam-translator">
      {/* Primary Video Container */}
      <div className="relative aspect-video rounded-3xl bg-[#0F0F12] border border-slate-800 shadow-2xl overflow-hidden group">
        
        {/* Hidden but running mirror element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none scale-x-[-1]"
          playsInline
          muted
        />

        {/* Live visible mirrored camera viewport */}
        {active && !loading && (
          <video
            src=""
            style={{ display: "none" }}
          />
        )}

        {/* Standard canvas overlaid */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-cover z-10 scale-x-[-1]"
        />

        {/* Feed State Display */}
        {!active && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 p-8 text-center bg-radial from-[#0F0F12] via-[#0A0A0B] to-[#0A0A0B]">
            <div className="p-5 rounded-full bg-[#16161A] border-2 border-dashed border-slate-800 animate-pulse text-indigo-400">
              <CameraIcon className="w-12 h-12" id="camera-placeholder" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-slate-200">Webcam Feed is Off</h3>
              <p className="text-sm mt-1 text-slate-450 max-w-sm leading-relaxed mx-auto">
                Turn on your camera to capture and track hand gestures in real time using client-side AI.
              </p>
            </div>
            <button
              onClick={startCamera}
              className="mt-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Enable Video Stream
            </button>
          </div>
        )}

        {/* Streaming Video Render */}
        {active && (
          <div className="absolute inset-0 w-full h-full object-cover -z-0">
            {/* Show real video tag directly under canvas */}
            <video
              ref={(v) => {
                if (v && videoRef.current && v.srcObject !== videoRef.current.srcObject) {
                  v.srcObject = videoRef.current.srcObject;
                  v.play().catch(() => {});
                }
              }}
              className="w-full h-full object-cover scale-x-[-1] brightness-[1.05]"
              playsInline
              muted
            />
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0A0A0B]/90 z-20 backdrop-blur-md">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-indigo-200 font-medium font-mono">Initializing MediaPipe WASM Engine...</p>
          </div>
        )}

        {/* Camera Errors */}
        {errorMsg && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0A0A0B]/95 z-20 p-8 text-center">
            <AlertTriangle className="w-14 h-14 text-rose-500 animate-bounce" />
            <div>
              <h4 className="font-display font-semibold text-rose-400 animate-pulse">Camera Connection Failed</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={startCamera}
              className="px-5 py-2 rounded-lg bg-slate-805 hover:bg-slate-700 text-xs text-slate-200 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Dashboard Status Pill Overlay */}
        {active && (
          <div className="absolute top-4 left-4 z-20 flex gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 text-emerald-400 text-[10px] font-mono tracking-wider uppercase font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Live Tracking
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0F0F12]/80 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-mono font-medium">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              {analytics.fps} FPS
            </div>
          </div>
        )}

        {/* Holographic Wireframe Gesture Guide Controls (Top-Right) */}
        {active && (
          <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 max-w-[280px]">
            <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-[#0F0F12]/85 backdrop-blur-md border border-slate-800 text-slate-300 text-xs shadow-lg font-mono">
              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                <Layers className="w-3 h-3 text-amber-400" />
                Skeletal Hologram Guide
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[9px] text-slate-400 block font-semibold">PRACTICE TARGET:</label>
                <select
                  value={guideTarget}
                  onChange={(e) => {
                    setGuideTarget(e.target.value);
                    setMatchScore(null);
                  }}
                  className="bg-slate-900 border border-slate-700 text-slate-205 text-[11px] rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-500 focus:outline-none w-full"
                >
                  <option value="Auto">Auto (Follow prediction)</option>
                  <option value="None">Disabled (Hide overlays)</option>
                  <optgroup label="Alphabets Practice">
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((letter) => (
                      <option key={letter} value={letter}>Alphabet "{letter}"</option>
                    ))}
                  </optgroup>
                  <optgroup label="Core Keywords">
                    <option value="Hello">"Hello" (Salute)</option>
                    <option value="Thank You">"Thank You"</option>
                    <option value="Yes">"Yes" (Rock fist)</option>
                    <option value="No">"No"</option>
                  </optgroup>
                  {userSavedTemplates.length > 0 && (
                    <optgroup label="Your Custom Recorded Gestures">
                      {userSavedTemplates.map((t, idx) => (
                        <option key={`custom-${idx}`} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Opacity slider control */}
              {guideTarget !== "None" && (
                <div className="flex flex-col gap-1 mt-1.5">
                  <div className="flex justify-between items-center text-[9px] text-slate-400">
                    <span>GUIDE INTENSITY:</span>
                    <span className="font-semibold text-amber-450">{Math.round(guideOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={guideOpacity}
                    onChange={(e) => setGuideOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>
            
            {/* Real-time Match score visual comparison pill */}
            {matchScore !== null && guideTarget !== "None" && (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F0F12]/92 backdrop-blur-md border border-slate-800 shadow-md">
                  <span className="text-[9px] text-slate-450 font-mono tracking-wider font-semibold">SHAPE MATCH:</span>
                  <span className={`font-mono text-xs font-bold ${
                    matchScore >= 85 ? "text-emerald-450 animate-pulse" :
                    matchScore >= 70 ? "text-amber-450" : "text-rose-400"
                  }`}>
                    {matchScore}%
                  </span>
                  <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        matchScore >= 85 ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" :
                        matchScore >= 70 ? "bg-amber-500 shadow-[0_0_6px_#f59e0b]" : 
                        "bg-rose-500 shadow-[0_0_6px_#f43f5e]"
                      }`}
                      style={{ width: `${matchScore}%` }}
                    />
                  </div>
                </div>

                {matchScore >= 85 && (
                  <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[9px] font-mono text-emerald-400 font-bold animate-bounce shadow">
                    Perfect shape alignment! 🔥
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live Classifier Box Overlay - Styled with beautiful Serif Display as requested */}
        {active && analytics.detectedHands > 0 && (
          <div className="absolute bottom-4 right-4 left-4 z-20 flex items-center justify-between p-4 rounded-2xl bg-[#16161A]/95 backdrop-blur-lg border border-slate-800 animate-fade-in shadow-xl">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">Current Prediction</span>
              <span className="font-serif font-medium text-2xl text-white tracking-tight italic">
                {latestPrediction}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">Confidence</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-slate-200">
                  {confidence}%
                </span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_8px_#22d3ee]"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controller Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#0F0F12] border border-slate-800 shadow-md">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <CameraIcon className="w-4 h-4 text-indigo-450" />
          <span>Capture Status: </span>
          <span className={`font-semibold font-mono text-xs ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
            {active ? "STREAMING" : "OFFLINE"}
          </span>
        </div>

        <div className="flex gap-2">
          {active ? (
            <button
              onClick={stopCamera}
              className="px-5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-550 text-rose-400 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <VideoOff className="w-3.5 h-3.5" />
              Kill Stream
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Power Up Stream
            </button>
          )}
        </div>
      </div>

      {/* Detailed Technical Monitor panels placed in Card slots */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F0F12] border border-slate-800 text-center shadow-md">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">FPS Frame Rate</div>
          <div className="font-display text-2xl font-bold text-slate-200">{active ? analytics.fps : 0}</div>
          <div className="text-[9px] text-slate-450 mt-1 font-mono">Goal: &gt; 20 fps</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0F0F12] border border-slate-800 text-center shadow-md">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Inference Latency</div>
          <div className="font-display text-2xl font-bold text-slate-200">{active && analytics.detectedHands > 0 ? `${analytics.latencyMs}ms` : "0ms"}</div>
          <div className="text-[9px] text-teal-400 mt-1 font-mono">Performance: &lt; 200ms</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0F0F12] border border-slate-800 text-center shadow-md">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Tracking Nodes</div>
          <div className="font-display text-2xl font-bold text-slate-200">{active && analytics.detectedHands > 0 ? analytics.landmarksCapturedCount : 0}</div>
          <div className="text-[9px] text-pink-400 mt-1 font-mono">21 nodes per hand</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0F0F12] border border-slate-800 text-center shadow-md">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1">Hardware Core</div>
          <div className="font-display text-base font-bold text-slate-200 uppercase truncate">MediaPipe WASM</div>
          <div className="text-[9px] text-indigo-400 mt-1 font-mono">Standardized Input</div>
        </div>
      </div>
    </div>
  );
}
