export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: Landmark[];
   handedness: "Left" | "Right";
}

export interface GestureTemplate {
  name: string;
  landmarks: Landmark[]; // 21 landmarks
}

export interface ClassificationResult {
  gesture: string;
  confidence: number;
}

export interface TrainingMetric {
  epoch: number;
  loss: number;
  valLoss: number;
  accuracy: number;
  valAccuracy: number;
}

export interface AnalyticsState {
  fps: number;
  landmarksCapturedCount: number;
  latencyMs: number;
  detectedHands: number;
  triggerCooldown: number;
}
