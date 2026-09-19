export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface LipClassificationResult {
  intent: string;
  confidence: number;
  lar: number;
  state: 'NEUTRAL' | 'OPENING' | 'SUSTAINED_OPEN' | 'PURSED';
}

/**
 * Calculates the Lip Aspect Ratio (LAR) using vertical inner lip opening
 * over horizontal mouth width.
 * Works with both 40-point extracted lip landmarks and full 468 FaceMesh points.
 */
export function calculateLAR(landmarks: LandmarkPoint[]): number {
  if (!landmarks || (landmarks.length !== 40 && landmarks.length < 468)) {
    return 0;
  }

  let upperLip: LandmarkPoint;
  let lowerLip: LandmarkPoint;
  let leftCorner: LandmarkPoint;
  let rightCorner: LandmarkPoint;

  if (landmarks.length === 40) {
    leftCorner = landmarks[0];   // 61
    rightCorner = landmarks[10]; // 291
    lowerLip = landmarks[27];    // 14
    upperLip = landmarks[37];    // 13
  } else {
    leftCorner = landmarks[61];
    rightCorner = landmarks[291];
    lowerLip = landmarks[14];
    upperLip = landmarks[13];
  }

  if (!upperLip || !lowerLip || !leftCorner || !rightCorner) {
    return 0;
  }

  const dxHeight = upperLip.x - lowerLip.x;
  const dyHeight = upperLip.y - lowerLip.y;
  const hInner = Math.sqrt(dxHeight * dxHeight + dyHeight * dyHeight);

  const dxWidth = rightCorner.x - leftCorner.x;
  const dyWidth = rightCorner.y - leftCorner.y;
  const wMouth = Math.sqrt(dxWidth * dxWidth + dyWidth * dyWidth);

  if (wMouth <= 0.0001) return 0;
  return hInner / wMouth;
}

/**
 * Temporal Lip Kinematics Tracker.
 * Analyzes rolling window of LAR measurements to recognize controlled silent commands.
 */
export class LipKinematicsTracker {
  private history: { lar: number; timestamp: number }[] = [];
  private maxHistory: number;
  private cooldownMs: number;
  private lastTriggerTime: number = 0;
  private sustainedOpenCount: number = 0;

  constructor(maxHistory: number = 24, cooldownMs: number = 2000) {
    this.maxHistory = maxHistory;
    this.cooldownMs = cooldownMs;
  }

  reset(): void {
    this.history = [];
    this.sustainedOpenCount = 0;
    this.lastTriggerTime = 0;
  }

  processFrame(landmarks: LandmarkPoint[], now: number = Date.now()): LipClassificationResult | null {
    const lar = calculateLAR(landmarks);
    if (lar === 0) return null;

    this.history.push({ lar, timestamp: now });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Determine instantaneous visual articulation state
    let state: 'NEUTRAL' | 'OPENING' | 'SUSTAINED_OPEN' | 'PURSED' = 'NEUTRAL';
    if (lar > 0.35) {
      this.sustainedOpenCount++;
      state = this.sustainedOpenCount >= 10 ? 'SUSTAINED_OPEN' : 'OPENING';
    } else if (lar > 0.24) {
      state = 'OPENING';
      this.sustainedOpenCount = 0;
    } else {
      this.sustainedOpenCount = 0;
      if (lar < 0.08) {
        state = 'PURSED';
      } else {
        state = 'NEUTRAL';
      }
    }

    const inCooldown = this.lastTriggerTime > 0 && now - this.lastTriggerTime < this.cooldownMs;

    // Need minimal history to analyze motion transitions
    if (this.history.length < 6) {
      return { intent: '', confidence: 0, lar, state };
    }

    // 1. Sustained wide mouth opening -> STOP
    if (this.sustainedOpenCount >= 12 && !inCooldown) {
      this.lastTriggerTime = now;
      this.sustainedOpenCount = 0;
      return {
        intent: 'STOP',
        confidence: 0.90,
        lar,
        state: 'SUSTAINED_OPEN',
      };
    }

    // 2. Closed-to-Open Articulation -> QUESTION
    const earlyFrames = this.history.slice(0, Math.floor(this.history.length / 2));
    const minEarlyLar = Math.min(...earlyFrames.map((f) => f.lar));
    const currentLar = lar;

    if (minEarlyLar < 0.16 && currentLar >= 0.28 && !inCooldown) {
      this.lastTriggerTime = now;
      return {
        intent: 'QUESTION',
        confidence: 0.88,
        lar,
        state: 'OPENING',
      };
    }

    // 3. Sustained pursed lips -> AGREE
    if (state === 'PURSED' && !inCooldown) {
      const recentPursedCount = this.history.filter((f) => f.lar < 0.09).length;
      if (recentPursedCount >= 8) {
        this.lastTriggerTime = now;
        return {
          intent: 'AGREE',
          confidence: 0.85,
          lar,
          state: 'PURSED',
        };
      }
    }

    return {
      intent: '',
      confidence: 0,
      lar,
      state,
    };
  }
}

// Global default tracker instance
export const defaultLipTracker = new LipKinematicsTracker();

export function classifyLipMotion(
  landmarks: LandmarkPoint[],
  tracker: LipKinematicsTracker = defaultLipTracker,
  now?: number
): LipClassificationResult | null {
  return tracker.processFrame(landmarks, now);
}
