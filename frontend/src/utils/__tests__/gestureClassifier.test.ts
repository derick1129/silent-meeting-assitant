import { describe, it, expect } from 'vitest';
import { classifyHandLandmarks } from '../gestureClassifier';

describe('classifyHandLandmarks', () => {
  it('detects STOP on open palm', () => {
    // 21 landmarks: wrist at 0, fingers extended upwards (y smaller)
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
    // Extended tips: 4, 8, 12, 16, 20
    landmarks[4] = { x: 0.3, y: 0.4, z: 0 }; // thumb tip
    landmarks[3] = { x: 0.35, y: 0.5, z: 0 }; // thumb ip
    landmarks[8] = { x: 0.45, y: 0.2, z: 0 }; // index tip
    landmarks[6] = { x: 0.45, y: 0.5, z: 0 }; // index pip
    landmarks[12] = { x: 0.5, y: 0.2, z: 0 }; // middle tip
    landmarks[10] = { x: 0.5, y: 0.5, z: 0 }; // middle pip
    landmarks[16] = { x: 0.55, y: 0.2, z: 0 }; // ring tip
    landmarks[14] = { x: 0.55, y: 0.5, z: 0 }; // ring pip
    landmarks[20] = { x: 0.6, y: 0.2, z: 0 }; // pinky tip
    landmarks[18] = { x: 0.6, y: 0.5, z: 0 }; // pinky pip

    const result = classifyHandLandmarks(landmarks);
    expect(result).not.toBeNull();
    expect(result?.intent).toBe('STOP');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('detects REQUEST_TO_SPEAK on 4 extended fingers with thumb folded', () => {
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
    // Thumb folded
    landmarks[4] = { x: 0.4, y: 0.6, z: 0 };
    landmarks[3] = { x: 0.4, y: 0.5, z: 0 };
    // Other 4 fingers extended
    landmarks[8] = { x: 0.45, y: 0.2, z: 0 };
    landmarks[6] = { x: 0.45, y: 0.5, z: 0 };
    landmarks[12] = { x: 0.5, y: 0.2, z: 0 };
    landmarks[10] = { x: 0.5, y: 0.5, z: 0 };
    landmarks[16] = { x: 0.55, y: 0.2, z: 0 };
    landmarks[14] = { x: 0.55, y: 0.5, z: 0 };
    landmarks[20] = { x: 0.6, y: 0.2, z: 0 };
    landmarks[18] = { x: 0.6, y: 0.5, z: 0 };

    const result = classifyHandLandmarks(landmarks);
    expect(result).not.toBeNull();
    expect(result?.intent).toBe('REQUEST_TO_SPEAK');
  });
});
