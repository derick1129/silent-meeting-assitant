import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateLAR,
  LipKinematicsTracker,
  LandmarkPoint,
} from '../lipClassifier';

function createMock40LipPoints(innerOpeningHeight: number, mouthWidth: number = 0.2): LandmarkPoint[] {
  // Array of 40 points:
  // 0: leftCorner (x: 0.5 - mouthWidth/2, y: 0.5)
  // 10: rightCorner (x: 0.5 + mouthWidth/2, y: 0.5)
  // 27: lowerLip (x: 0.5, y: 0.5 + innerOpeningHeight/2)
  // 37: upperLip (x: 0.5, y: 0.5 - innerOpeningHeight/2)
  const pts: LandmarkPoint[] = Array(40).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
  pts[0] = { x: 0.5 - mouthWidth / 2, y: 0.5, z: 0 };
  pts[10] = { x: 0.5 + mouthWidth / 2, y: 0.5, z: 0 };
  pts[27] = { x: 0.5, y: 0.5 + innerOpeningHeight / 2, z: 0 };
  pts[37] = { x: 0.5, y: 0.5 - innerOpeningHeight / 2, z: 0 };
  return pts;
}

describe('lipClassifier - calculateLAR', () => {
  it('returns 0 for empty or invalid landmarks', () => {
    expect(calculateLAR([])).toBe(0);
    expect(calculateLAR(Array(20).fill({ x: 0, y: 0 }))).toBe(0);
  });

  it('calculates LAR correctly for 40-point lip input', () => {
    // Neutral mouth: inner opening = 0.02, width = 0.20 -> LAR = 0.10
    const neutralPoints = createMock40LipPoints(0.02, 0.20);
    const larNeutral = calculateLAR(neutralPoints);
    expect(larNeutral).toBeCloseTo(0.10, 2);

    // Open mouth: inner opening = 0.08, width = 0.20 -> LAR = 0.40
    const openPoints = createMock40LipPoints(0.08, 0.20);
    const larOpen = calculateLAR(openPoints);
    expect(larOpen).toBeCloseTo(0.40, 2);
  });
});

describe('LipKinematicsTracker', () => {
  let tracker: LipKinematicsTracker;

  beforeEach(() => {
    tracker = new LipKinematicsTracker(24, 2000);
  });

  it('stays neutral with no intent when mouth remains closed/neutral', () => {
    const neutral = createMock40LipPoints(0.02, 0.20); // LAR = 0.10
    let lastResult = null;
    for (let i = 0; i < 15; i++) {
      lastResult = tracker.processFrame(neutral, 1000 + i * 33);
    }
    expect(lastResult?.state).toBe('NEUTRAL');
    expect(lastResult?.intent).toBe('');
  });

  it('detects QUESTION on rapid transition from closed to open mouth', () => {
    const neutral = createMock40LipPoints(0.02, 0.20); // LAR = 0.10
    const open = createMock40LipPoints(0.07, 0.20);    // LAR = 0.35

    // Feed 8 neutral frames
    for (let i = 0; i < 8; i++) {
      tracker.processFrame(neutral, 1000 + i * 33);
    }

    // Now open mouth
    const result = tracker.processFrame(open, 1000 + 8 * 33);
    expect(result?.intent).toBe('QUESTION');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result?.state).toBe('OPENING');
  });

  it('detects STOP on sustained wide open mouth', () => {
    const wideOpen = createMock40LipPoints(0.08, 0.20); // LAR = 0.40
    let detectedStop = false;

    for (let i = 0; i < 16; i++) {
      const res = tracker.processFrame(wideOpen, 1000 + i * 33);
      if (res?.intent === 'STOP') {
        detectedStop = true;
        expect(res.confidence).toBeGreaterThanOrEqual(0.85);
        break;
      }
    }
    expect(detectedStop).toBe(true);
  });

  it('detects AGREE on pursed lips', () => {
    const pursed = createMock40LipPoints(0.01, 0.20); // LAR = 0.05 < 0.08
    let detectedAgree = false;

    for (let i = 0; i < 12; i++) {
      const res = tracker.processFrame(pursed, 1000 + i * 33);
      if (res?.intent === 'AGREE') {
        detectedAgree = true;
        expect(res.confidence).toBeGreaterThanOrEqual(0.80);
        break;
      }
    }
    expect(detectedAgree).toBe(true);
  });

  it('enforces cooldown window between triggers', () => {
    const neutral = createMock40LipPoints(0.02, 0.20);
    const open = createMock40LipPoints(0.07, 0.20);

    // Initial trigger
    for (let i = 0; i < 8; i++) {
      tracker.processFrame(neutral, 1000 + i * 33);
    }
    const firstTrigger = tracker.processFrame(open, 1300);
    expect(firstTrigger?.intent).toBe('QUESTION');

    // Attempt second trigger during 2000ms cooldown (e.g. at 1800ms)
    for (let i = 0; i < 8; i++) {
      tracker.processFrame(neutral, 1400 + i * 33);
    }
    const secondTrigger = tracker.processFrame(open, 1800);
    expect(secondTrigger?.intent).toBe('');

    // After cooldown expires (at 3500ms)
    for (let i = 0; i < 8; i++) {
      tracker.processFrame(neutral, 3100 + i * 33);
    }
    const thirdTrigger = tracker.processFrame(open, 3500);
    expect(thirdTrigger?.intent).toBe('QUESTION');
  });
});
