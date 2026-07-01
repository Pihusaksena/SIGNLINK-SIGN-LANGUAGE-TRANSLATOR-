import { Landmark } from "../types";

// Connections defining the hand bones structure (MediaPipe 21-Joint skeleton)
export const SKELETON_CONNECTIONS = [
  // Wrist to Finger bases
  [0, 1], [0, 5], [0, 9], [0, 13], [0, 17],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index
  [5, 6], [6, 7], [7, 8],
  // Middle
  [9, 10], [10, 11], [11, 12],
  // Ring
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20]
];

// Reference base points for a neutral hand
const baseWrist: Landmark = { x: 0, y: 0.5, z: 0 };

/**
 * Standardize and clean a coordinate set so it is centered on the wrist
 * and scaled correctly for proportional rendering.
 */
function normalizeSkeletalModel(coords: Landmark[]): Landmark[] {
  if (coords.length === 0) return [];
  const wrist = coords[0];
  const translated = coords.map(p => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - (wrist.z || 0)
  }));
  
  // Calculate middle finger MCP (9) length to scale
  const mcp = translated[9] || { x: 0, y: -0.5, z: 0 };
  const d = Math.sqrt(mcp.x * mcp.x + mcp.y * mcp.y + mcp.z * mcp.z) || 1.0;
  
  return translated.map(p => ({
    x: (p.x / d) * 0.45 + 0.5, // Center & scale for standard SVG viewport (0 to 1)
    y: (p.y / d) * 0.45 + 0.65,
    z: p.z / d
  }));
}

// Compact definitions of letters A-Z representing finger orientations
// Format: [ThumbOpen, IndexOpen, MiddleOpen, RingOpen, PinkyOpen]
const FINGER_POSTURES: Record<string, { extensions: number[], thumbCurl?: boolean }> = {
  A: { extensions: [0, 0, 0, 0, 0] }, // Fist
  B: { extensions: [1, 1, 1, 1, 1] }, // Open palm
  C: { extensions: [0.5, 0.5, 0.5, 0.5, 0.5] }, // Curved open
  D: { extensions: [0, 1, 0, 0, 0] }, // Pointing index
  E: { extensions: [0.1, 0.1, 0.1, 0.1, 0.1] }, // Claw/Clenched curled
  F: { extensions: [0, 0, 1, 1, 1] }, // OK sign
  G: { extensions: [1, 1, 0, 0, 0] }, // Index and thumb horizontally open (like a gun/pointer)
  H: { extensions: [0, 1, 1, 0, 0] }, // Index + Middle horizontal (rotated hand)
  I: { extensions: [0, 0, 0, 0, 1] }, // Only pinky up
  J: { extensions: [0, 0, 0, 0, 1], thumbCurl: true }, // Pinky up (rotates)
  K: { extensions: [1, 1, 1, 0, 0] }, // V-sign with thumb leaning on middle finger
  L: { extensions: [1, 1, 0, 0, 0] }, // Form L with index and thumb
  M: { extensions: [0, 0, 0, 0, 0] }, // Fist with thumb tucked
  N: { extensions: [0, 0, 0, 0, 0] }, // Fist with thumb tucked less
  O: { extensions: [0.3, 0.3, 0.3, 0.3, 0.3] }, // Round circle
  P: { extensions: [1, 1, 0.5, 0, 0] }, // Tilted down k
  Q: { extensions: [1, 0.5, 0, 0, 0] }, // Tilted down gun
  R: { extensions: [0, 1, 1, 0, 0] }, // Crossed fingers (index + middle straight)
  S: { extensions: [0, 0, 0, 0, 0] }, // Strict fist
  T: { extensions: [0.3, 0, 0, 0, 0] }, // Fist thumb tucked under index
  U: { extensions: [0, 1, 1, 0, 0] }, // Two fingers up tight
  V: { extensions: [0, 1, 1, 0, 0] }, // Two fingers up spread
  W: { extensions: [0, 1, 1, 1, 0] }, // Three fingers up spread
  X: { extensions: [0, 0.5, 0, 0, 0] }, // Hooked index
  Y: { extensions: [1, 0, 0, 0, 1] }, // Thumb + pinky open
  Z: { extensions: [0, 1, 0, 0, 0] }, // Pointing index (motion draws Z)
};

/**
 * Procedural modeler that returns 21-landmark arrays for any letter A-Z.
 * Dynamically computes bone vector lengths and rotations depending on spelling rules,
 * providing a polished, fluid, and mathematically logical hand visualizer.
 */
export function getLetterLandmarks(letter: string): Landmark[] {
  const normLetter = letter.toUpperCase().trim();
  const config = FINGER_POSTURES[normLetter] || FINGER_POSTURES["B"];
  
  const landmarks: Landmark[] = [];
  // 1. Add wrist (0)
  landmarks.push({ x: 0, y: 0.5, z: 0 });

  // Helper to add a finger chain
  const addFinger = (
    baseX: number,
    baseY: number,
    angle: number, // Radians, pointing up generally
    length: number,
    extensionState: number, // 0 = closed, 1 = fully open, 0.5 = curved/semi-open
    fingerIdx: number // 1 to 5
  ) => {
    // Joint base (MCP)
    const mcpX = baseX;
    const mcpY = baseY;
    const mcpZ = -0.05 * fingerIdx;
    landmarks.push({ x: mcpX, y: mcpY, z: mcpZ });

    // PIP joint (1st joint)
    const segLen = length / 3;
    let pipAngle = angle;
    
    // Curvature logic based on extensionState
    if (extensionState < 0.4) {
      // Clenched (bends backwards/down)
      pipAngle = angle + Math.PI * 0.7;
    } else if (extensionState >= 0.4 && extensionState < 0.8) {
      // Curved
      pipAngle = angle + Math.PI * 0.3;
    }

    const pipX = mcpX + Math.sin(pipAngle) * segLen;
    const pipY = mcpY - Math.cos(pipAngle) * segLen;
    const pipZ = mcpZ + (extensionState < 0.4 ? 0.15 : -0.05);
    landmarks.push({ x: pipX, y: pipY, z: pipZ });

    // DIP joint (2nd joint)
    let dipAngle = pipAngle;
    if (extensionState < 0.4) {
      dipAngle = pipAngle + Math.PI * 0.4;
    } else if (extensionState < 0.8) {
      dipAngle = pipAngle + Math.PI * 0.25;
    }
    const dipX = pipX + Math.sin(dipAngle) * segLen;
    const dipY = pipY - Math.cos(dipAngle) * segLen;
    const dipZ = pipZ + (extensionState < 0.4 ? 0.1 : -0.05);
    landmarks.push({ x: dipX, y: dipY, z: dipZ });

    // Tip
    let tipAngle = dipAngle;
    if (extensionState < 0.4) {
      tipAngle = dipAngle + Math.PI * 0.2;
    }
    const tipX = dipX + Math.sin(tipAngle) * segLen;
    const tipY = dipY - Math.cos(tipAngle) * segLen;
    const tipZ = dipZ + (extensionState < 0.4 ? 0.05 : -0.05);
    landmarks.push({ x: tipX, y: tipY, z: tipZ });
  };

  // 2. Add Thumb (Landmarks 1-4)
  const thumbExt = config.extensions[0];
  const thumbAngle = thumbExt > 0.5 ? -Math.PI * 0.25 : -Math.PI * 0.05;
  addFinger(-0.18, 0.32, thumbAngle, 0.4, thumbExt, 1);

  // Adjustments specifically for letters like 'Y' or 'L' to spread thumb more
  if (normLetter === "Y" || normLetter === "L") {
    landmarks[1] = { x: -0.15, y: 0.3, z: -0.05 };
    landmarks[2] = { x: -0.3, y: 0.22, z: -0.08 };
    landmarks[3] = { x: -0.44, y: 0.15, z: -0.12 };
    landmarks[4] = { x: -0.56, y: 0.1, z: -0.15 };
  }

  // 3. Add Index Finger (Landmarks 5-8)
  const indexExt = config.extensions[1];
  let indexAngle = -0.05;
  if (normLetter === "V") indexAngle = -0.15; // Spread index
  if (normLetter === "R") indexAngle = 0.05; // Cross index over middle
  addFinger(-0.12, 0.18, indexAngle, 0.52, indexExt, 2);

  // 4. Add Middle Finger (Landmarks 9-12)
  const middleExt = config.extensions[2];
  let middleAngle = 0.0;
  if (normLetter === "V") middleAngle = 0.15; // Spread middle
  if (normLetter === "R") middleAngle = -0.05; // Cross middle under index
  addFinger(-0.02, 0.15, middleAngle, 0.55, middleExt, 3);

  // 5. Add Ring Finger (Landmarks 13-16)
  const ringExt = config.extensions[3];
  addFinger(0.08, 0.16, 0.05, 0.51, ringExt, 4);

  // 6. Add Pinky Finger (Landmarks 17-20)
  const pinkyExt = config.extensions[4];
  let pinkyAngle = 0.12;
  if (normLetter === "Y" || normLetter === "W") pinkyAngle = 0.24; // Spread pinky
  addFinger(0.18, 0.2, pinkyAngle, 0.44, pinkyExt, 5);

  // High precision tweaks for other specific letters to look highly recognizable and visually stunning
  if (normLetter === "A") {
    // Thumb wraps across clenched index/middle
    landmarks[1] = { x: -0.12, y: 0.35, z: -0.05 };
    landmarks[2] = { x: -0.22, y: 0.28, z: -0.08 };
    landmarks[3] = { x: -0.15, y: 0.22, z: -0.15 };
    landmarks[4] = { x: -0.08, y: 0.24, z: -0.22 };
  } else if (normLetter === "F") {
    // OK sign: index and thumb touch
    // Index tip (8) and Thumb tip (4) pull together
    landmarks[4] = { x: -0.12, y: 0.18, z: -0.12 };
    landmarks[8] = { x: -0.1, y: 0.2, z: -0.12 };
  } else if (normLetter === "O" || normLetter === "C") {
    // Curve into 'O' or 'C' circle
    const isO = normLetter === "O";
    const factor = isO ? 1.0 : 0.8;
    landmarks[4] = { x: -0.18 * factor, y: 0.22 * factor, z: -0.1 };
    landmarks[8] = { x: -0.05 * factor, y: 0.12 * factor, z: -0.15 };
    landmarks[12] = { x: 0.02 * factor, y: 0.14 * factor, z: -0.15 };
    landmarks[16] = { x: 0.09 * factor, y: 0.16 * factor, z: -0.15 };
    landmarks[20] = { x: 0.15 * factor, y: 0.18 * factor, z: -0.15 };
  }

  return normalizeSkeletalModel(landmarks);
}

// Map specialized dictionary phrases
export const SPECIAL_SIGNS_GLOSSARY: Record<string, string> = {
  "HELLO": "Hello",
  "THANKS": "Thank You",
  "THANKYOU": "Thank You",
  "YES": "Yes",
  "NO": "No"
};
