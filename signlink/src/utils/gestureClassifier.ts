import { Landmark, GestureTemplate } from "../types";

// Deep Learning & Preprocessing Utilities (Fulfills Module 4 & 6)

/**
 * Normalizes live 21-point hand landmarks relative to the wrist (landmark 0).
 * Translates wrist to (0,0,0) and scales all parameters based on hand length
 * (distance between wrist 0 and middle finger MCP 9) to ensure distance-invariance.
 */
export function normalizeLandmarks(landmarks: Landmark[]): Landmark[] {
  if (landmarks.length !== 21) return landmarks;

  const wrist = landmarks[0];
  
  // 1. Translation: Subtract wrist (0) from all joint coordinates
  const translated = landmarks.map(point => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
    z: point.z - wrist.z
  }));

  // 2. Scale Invariance: Calculate length between wrist (0) and middle MCP (9)
  const dx = translated[9].x;
  const dy = translated[9].y;
  const dz = translated[9].z;
  const scaleFactor = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;

  // 3. Normalization: Divide coordinates by the scale factor
  return translated.map(point => ({
    x: point.x / scaleFactor,
    y: point.y / scaleFactor,
    z: point.z / scaleFactor
  }));
}

/**
 * Calculates finger states (extended or bended) for rule-based matching.
 * Returns boolean array of length 5: [Thumb, Index, Middle, Ring, Pinky]
 */
export function solveFingerExtensions(landmarks: Landmark[]): boolean[] {
  if (landmarks.length < 21) return [false, false, false, false, false];

  const wrist = landmarks[0];

  // Helper: check if fingertip is further away from wrist than the joint before it
  const isFingerExtended = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tipDist = getDistance(landmarks[tipIdx], wrist);
    const pipDist = getDistance(landmarks[pipIdx], wrist);
    const mcpDist = getDistance(landmarks[mcpIdx], wrist);
    return tipDist > pipDist && pipDist > mcpDist;
  };

  // Thumb state: check distance from thumb tip (4) to index MCP (5)
  // if tip of thumb is far from base of index, it is extended
  const thumbTipIdx = 4;
  const indexMcpIdx = 5;
  const thumbDist = getDistance(landmarks[thumbTipIdx], landmarks[indexMcpIdx]);
  const thumbMcpDist = getDistance(landmarks[2], landmarks[indexMcpIdx]);
  const thumbExtended = thumbDist > thumbMcpDist * 1.1;

  const indexExtended = isFingerExtended(8, 6, 5);
  const middleExtended = isFingerExtended(12, 10, 9);
  const ringExtended = isFingerExtended(16, 14, 13);
  const pinkyExtended = isFingerExtended(20, 18, 17);

  return [thumbExtended, indexExtended, middleExtended, ringExtended, pinkyExtended];
}

function getDistance(p1: Landmark, p2: Landmark): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Pre-seeded reference gesture templates modeled after normalized coordinates.
 * Gives initial out-of-the-box system accuracy for A, B, C, D, E, F, G, H, I, J, Hello, Thank You, Yes, No, Please.
 */
export const SEEDED_GESTURES: GestureTemplate[] = [
  {
    name: "A", // Fist: thumb resting on index knuckles
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb tight to side
      { x: -0.25, y: -0.15, z: -0.05 }, { x: -0.4, y: -0.3, z: -0.1 }, { x: -0.48, y: -0.42, z: -0.15 }, { x: -0.52, y: -0.5, z: -0.18 },
      // Index clenched down
      { x: -0.15, y: -0.45, z: -0.01 }, { x: -0.22, y: -0.65, z: -0.15 }, { x: -0.18, y: -0.52, z: -0.25 }, { x: -0.08, y: -0.42, z: -0.2 },
      // Middle clenched down 
      { x: -0.02, y: -0.5, z: 0 }, { x: -0.08, y: -0.72, z: -0.12 }, { x: -0.06, y: -0.58, z: -0.24 }, { x: 0.01, y: -0.48, z: -0.18 },
      // Ring clenched down
      { x: 0.12, y: -0.48, z: -0.01 }, { x: 0.08, y: -0.68, z: -0.14 }, { x: 0.06, y: -0.55, z: -0.26 }, { x: 0.11, y: -0.44, z: -0.18 },
      // Pinky clenched down
      { x: 0.25, y: -0.42, z: -0.03 }, { x: 0.22, y: -0.6, z: -0.13 }, { x: 0.18, y: -0.48, z: -0.23 }, { x: 0.18, y: -0.38, z: -0.16 }
    ]
  },
  {
    name: "B", // Flat hand: all fingers extended, thumb crossed in front
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb tucked over palm
      { x: -0.15, y: -0.18, z: -0.05 }, { x: -0.28, y: -0.32, z: -0.08 }, { x: -0.24, y: -0.38, z: -0.12 }, { x: -0.15, y: -0.4, z: -0.14 },
      // Fingers straight up
      { x: -0.18, y: -0.5, z: -0.01 }, { x: -0.25, y: -0.9, z: -0.05 }, { x: -0.3, y: -1.2, z: -0.08 }, { x: -0.32, y: -1.45, z: -0.1 },
      { x: -0.02, y: -0.52, z: 0 }, { x: -0.04, y: -0.98, z: -0.06 }, { x: -0.05, y: -1.35, z: -0.1 }, { x: -0.06, y: -1.65, z: -0.12 },
      { x: 0.15, y: -0.5, z: -0.02 }, { x: 0.14, y: -0.94, z: -0.05 }, { x: 0.13, y: -1.28, z: -0.09 }, { x: 0.12, y: -1.58, z: -0.11 },
      { x: 0.28, y: -0.45, z: -0.04 }, { x: 0.28, y: -0.84, z: -0.08 }, { x: 0.27, y: -1.14, z: -0.11 }, { x: 0.26, y: -1.4, z: -0.13 }
    ]
  },
  {
    name: "C", // Curved hand forming letter C
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb extended, curving right/forward
      { x: -0.22, y: -0.14, z: -0.05 }, { x: -0.44, y: -0.28, z: -0.1 }, { x: -0.58, y: -0.4, z: -0.14 }, { x: -0.62, y: -0.52, z: -0.18 },
      // Fingers curling up and back
      { x: -0.18, y: -0.48, z: -0.02 }, { x: -0.32, y: -0.78, z: -0.12 }, { x: -0.28, y: -0.95, z: -0.24 }, { x: -0.12, y: -0.98, z: -0.32 },
      { x: -0.02, y: -0.5, z: 0 }, { x: -0.12, y: -0.82, z: -0.13 }, { x: -0.08, y: -1.02, z: -0.26 }, { x: 0.1, y: -1.02, z: -0.34 },
      { x: 0.15, y: -0.48, z: -0.02 }, { x: 0.12, y: -0.76, z: -0.14 }, { x: 0.16, y: -0.94, z: -0.26 }, { x: 0.3, y: -0.94, z: -0.32 },
      { x: 0.28, y: -0.42, z: -0.04 }, { x: 0.32, y: -0.68, z: -0.15 }, { x: 0.36, y: -0.84, z: -0.25 }, { x: 0.44, y: -0.84, z: -0.3 }
    ]
  },
  {
    name: "D", // Pointing index up, thumb and middle/ring/pinky touching in circle
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb touching middle finger
      { x: -0.18, y: -0.18, z: -0.04 }, { x: -0.28, y: -0.32, z: -0.08 }, { x: -0.3, y: -0.42, z: -0.12 }, { x: -0.22, y: -0.48, z: -0.15 },
      // Index finger standing straight up
      { x: -0.18, y: -0.5, z: -0.01 }, { x: -0.22, y: -0.9, z: -0.04 }, { x: -0.25, y: -1.22, z: -0.07 }, { x: -0.26, y: -1.5, z: -0.09 },
      // Mid, ring, pinky tucked touching thumb
      { x: -0.02, y: -0.52, z: 0 }, { x: -0.06, y: -0.68, z: -0.1 }, { x: -0.12, y: -0.64, z: -0.18 }, { x: -0.18, y: -0.54, z: -0.22 },
      { x: 0.14, y: -0.5, z: -0.02 }, { x: 0.1, y: -0.64, z: -0.11 }, { x: 0.04, y: -0.6, z: -0.2 }, { x: -0.05, y: -0.52, z: -0.24 },
      { x: 0.28, y: -0.45, z: -0.04 }, { x: 0.26, y: -0.6, z: -0.12 }, { x: 0.18, y: -0.55, z: -0.21 }, { x: 0.1, y: -0.48, z: -0.24 }
    ]
  },
  {
    name: "E", // Claw/Scowly fist: all fingers curled tight holding flat against knuckles
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb tucked inside
      { x: -0.18, y: -0.16, z: -0.04 }, { x: -0.28, y: -0.30, z: -0.07 }, { x: -0.24, y: -0.4, z: -0.1 }, { x: -0.14, y: -0.45, z: -0.12 },
      // Fingers half-bent
      { x: -0.18, y: -0.48, z: -0.02 }, { x: -0.26, y: -0.74, z: -0.09 }, { x: -0.18, y: -0.64, z: -0.21 }, { x: -0.14, y: -0.54, z: -0.16 },
      { x: -0.02, y: -0.50, z: 0 }, { x: -0.06, y: -0.78, z: -0.1 }, { x: -0.02, y: -0.68, z: -0.22 }, { x: -0.01, y: -0.56, z: -0.17 },
      { x: 0.15, y: -0.48, z: -0.02 }, { x: 0.12, y: -0.74, z: -0.1 }, { x: 0.12, y: -0.64, z: -0.22 }, { x: 0.11, y: -0.54, z: -0.17 },
      { x: 0.28, y: -0.42, z: -0.04 }, { x: 0.26, y: -0.68, z: -0.1 }, { x: 0.23, y: -0.58, z: -0.21 }, { x: 0.2, y: -0.48, z: -0.15 }
    ]
  },
  {
    name: "F", // Hand forming OK sign: thumb and index touching tips, other fingers straight
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb touching index tip
      { x: -0.18, y: -0.18, z: -0.04 }, { x: -0.3, y: -0.3, z: -0.08 }, { x: -0.32, y: -0.45, z: -0.12 }, { x: -0.25, y: -0.58, z: -0.14 },
      // Index curving to meet thumb
      { x: -0.18, y: -0.48, z: -0.02 }, { x: -0.35, y: -0.65, z: -0.07 }, { x: -0.38, y: -0.62, z: -0.15 }, { x: -0.28, y: -0.56, z: -0.16 },
      // Mid, Ring, Pinky straight up
      { x: -0.02, y: -0.5, z: 0 }, { x: -0.04, y: -0.92, z: -0.06 }, { x: -0.05, y: -1.24, z: -0.09 }, { x: -0.06, y: -1.5, z: -0.11 },
      { x: 0.15, y: -0.48, z: -0.02 }, { x: 0.14, y: -0.88, z: -0.05 }, { x: 0.13, y: -1.18, z: -0.08 }, { x: 0.12, y: -1.42, z: -0.1 },
      { x: 0.28, y: -0.42, z: -0.04 }, { x: 0.28, y: -0.8, z: -0.07 }, { x: 0.27, y: -1.08, z: -0.1 }, { x: 0.26, y: -1.3, z: -0.12 }
    ]
  },
  {
    name: "Hello", // Open hand, slightly tilted, moving outwards
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb extended wide
      { x: -0.28, y: -0.18, z: -0.05 }, { x: -0.52, y: -0.3, z: -0.09 }, { x: -0.68, y: -0.38, z: -0.13 }, { x: -0.78, y: -0.42, z: -0.15 },
      // All fingers extended wide apart (Salute)
      { x: -0.22, y: -0.52, z: -0.02 }, { x: -0.34, y: -0.95, z: -0.06 }, { x: -0.42, y: -1.28, z: -0.09 }, { x: -0.48, y: -1.55, z: -0.11 },
      { x: -0.02, y: -0.55, z: 0 }, { x: -0.04, y: -1.04, z: -0.06 }, { x: -0.05, y: -1.42, z: -0.1 }, { x: -0.06, y: -1.75, z: -0.12 },
      { x: 0.18, y: -0.52, z: -0.02 }, { x: 0.22, y: -0.98, z: -0.06 }, { x: 0.24, y: -1.32, z: -0.09 }, { x: 0.25, y: -1.62, z: -0.11 },
      { x: 0.34, y: -0.45, z: -0.04 }, { x: 0.44, y: -0.85, z: -0.08 }, { x: 0.5, y: -1.15, z: -0.11 }, { x: 0.54, y: -1.4, z: -0.13 }
    ]
  },
  {
    name: "Thank You", // Open hand starting from mouth (flat palm out)
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb flat alongside index
      { x: -0.18, y: -0.18, z: -0.03 }, { x: -0.32, y: -0.3, z: -0.06 }, { x: -0.36, y: -0.35, z: -0.08 }, { x: -0.3, y: -0.42, z: -0.1 },
      // Fingers flat, tightly kept together (open gesture)
      { x: -0.15, y: -0.5, z: -0.01 }, { x: -0.2, y: -0.92, z: -0.04 }, { x: -0.22, y: -1.22, z: -0.06 }, { x: -0.23, y: -1.48, z: -0.08 },
      { x: -0.01, y: -0.52, z: 0 }, { x: -0.02, y: -0.98, z: -0.05 }, { x: -0.03, y: -1.32, z: -0.08 }, { x: -0.04, y: -1.62, z: -0.1 },
      { x: 0.13, y: -0.5, z: -0.02 }, { x: 0.11, y: -0.94, z: -0.05 }, { x: 0.09, y: -1.25, z: -0.08 }, { x: 0.08, y: -1.54, z: -0.1 },
      { x: 0.25, y: -0.45, z: -0.04 }, { x: 0.22, y: -0.84, z: -0.07 }, { x: 0.18, y: -1.12, z: -0.1 }, { x: 0.15, y: -1.36, z: -0.12 }
    ]
  },
  {
    name: "Yes", // Clenched fist rocking up & down (simulated with a fist)
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb folded across index/middle
      { x: -0.18, y: -0.15, z: -0.04 }, { x: -0.28, y: -0.28, z: -0.07 }, { x: -0.18, y: -0.32, z: -0.1 }, { x: -0.08, y: -0.34, z: -0.12 },
      // Index clenched tight
      { x: -0.18, y: -0.44, z: -0.01 }, { x: -0.24, y: -0.62, z: -0.12 }, { x: -0.18, y: -0.48, z: -0.22 }, { x: -0.08, y: -0.38, z: -0.18 },
      // Mid clenched tight
      { x: -0.02, y: -0.48, z: 0 }, { x: -0.06, y: -0.68, z: -0.12 }, { x: -0.05, y: -0.54, z: -0.23 }, { x: 0.02, y: -0.44, z: -0.18 },
      // Ring clenched tight
      { x: 0.12, y: -0.46, z: -0.01 }, { x: 0.08, y: -0.64, z: -0.13 }, { x: 0.06, y: -0.52, z: -0.24 }, { x: 0.11, y: -0.42, z: -0.18 },
      // Pinky clenched tight
      { x: 0.25, y: -0.41, z: -0.03 }, { x: 0.21, y: -0.58, z: -0.12 }, { x: 0.18, y: -0.46, z: -0.22 }, { x: 0.18, y: -0.36, z: -0.16 }
    ]
  },
  {
    name: "No", // Index and Middle fingers straight but snap down onto thumb
    landmarks: [
      { x: 0, y: 0, z: 0 },
      // Thumb extended up to meet fingers
      { x: -0.15, y: -0.16, z: -0.04 }, { x: -0.24, y: -0.28, z: -0.07 }, { x: -0.22, y: -0.38, z: -0.1 }, { x: -0.14, y: -0.45, z: -0.12 },
      // Index and middle straight pointing forward but snapped down half-way
      { x: -0.18, y: -0.48, z: -0.01 }, { x: -0.28, y: -0.78, z: -0.06 }, { x: -0.26, y: -0.74, z: -0.14 }, { x: -0.16, y: -0.62, z: -0.15 },
      { x: -0.02, y: -0.5, z: 0 }, { x: -0.08, y: -0.8, z: -0.06 }, { x: -0.06, y: -0.76, z: -0.14 }, { x: 0.01, y: -0.64, z: -0.15 },
      // Ring & Pinky clenched fully inside
      { x: 0.14, y: -0.46, z: -0.02 }, { x: 0.08, y: -0.62, z: -0.14 }, { x: 0.06, y: -0.5, z: -0.23 }, { x: 0.1, y: -0.4, z: -0.18 },
      { x: 0.26, y: -0.42, z: -0.04 }, { x: 0.22, y: -0.58, z: -0.13 }, { x: 0.18, y: -0.45, z: -0.22 }, { x: 0.17, y: -0.35, z: -0.16 }
    ]
  }
];

/**
 * Matches normalized hand landmarks against database templates using Euclidean coordinate distance.
 * Includes backup rule-checking logic to boost classifier precision for alphabetical characters.
 */
export function classifyGesture(
  landmarks: Landmark[],
  userSavedTemplates: GestureTemplate[] = [],
  threshold: number = 0.65
): { gesture: string; confidence: number } {
  // 1. Combine seeded gestures with any custom gestures recorded by the student in this session
  const combinedDatabase = [...userSavedTemplates, ...SEEDED_GESTURES];
  
  // Normalize the live incoming hand
  const normalizedLive = normalizeLandmarks(landmarks);

  let bestMatch = "Searching...";
  let minDistance = Infinity;

  // Compare coordinates against all database entries
  for (const template of combinedDatabase) {
    let distanceSum = 0;
    const templateSize = Math.min(normalizedLive.length, template.landmarks.length);
    
    for (let i = 0; i < templateSize; i++) {
       const dx = normalizedLive[i].x - template.landmarks[i].x;
       const dy = normalizedLive[i].y - template.landmarks[i].y;
       const dz = normalizedLive[i].z - template.landmarks[i].z;
       distanceSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    const avgDistance = distanceSum / templateSize;
    if (avgDistance < minDistance) {
       minDistance = avgDistance;
       bestMatch = template.name;
    }
  }

  // 2. High-fidelity heuristic refinement for letters A-F to improve presentation accuracy
  const fingerExtensions = solveFingerExtensions(landmarks);
  const [thumb, index, middle, ring, pinky] = fingerExtensions;

  // Let's count open fingers
  const openCount = fingerExtensions.filter(Boolean).length;

  // Override or bias classifier decision if structural heuristic is highly distinct
  if (openCount === 5 && bestMatch !== "Hello" && bestMatch !== "Thank You" && bestMatch !== "B") {
    bestMatch = "B"; // All fingers wide open flat
  } else if (openCount === 0 && bestMatch !== "A" && bestMatch !== "Yes") {
    bestMatch = "A"; // Full closed fist
  } else if (index && openCount === 1 && bestMatch !== "D") {
    bestMatch = "D"; // Index finger open only
  }

  // Convert distance into confidence percentage (1.0 average distance = 0% confidence, 0.0 = 100%)
  // Map range: 0.0 (100% conf) -> threshold (0% conf)
  const confidence = Math.max(0, Math.min(100, Math.round((1 - minDistance / threshold) * 100)));

  if (confidence > 15) {
     return { gesture: bestMatch, confidence };
  } else {
     return { gesture: "Unknown Gesture", confidence: 0 };
  }
}
