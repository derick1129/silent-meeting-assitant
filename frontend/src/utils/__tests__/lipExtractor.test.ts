import { describe, it, expect } from 'vitest';
import { extractLipPoints, LIP_INDICES } from '../lipExtractor';

describe('Lip Landmark Extractor', () => {
  it('has exactly 40 canonical inner and outer lip landmark indices', () => {
    expect(LIP_INDICES.length).toBe(40);
  });

  it('returns null if landmarks array is missing or shorter than 468 points', () => {
    expect(extractLipPoints([])).toBeNull();
    expect(extractLipPoints(new Array(400).fill({ x: 0, y: 0 }))).toBeNull();
  });

  it('extracts exactly 40 points from 468 FaceMesh points', () => {
    const fakeFace = new Array(468).fill(null).map((_, i) => ({
      x: i * 0.001,
      y: i * 0.002,
      z: 0.0,
    }));

    const lips = extractLipPoints(fakeFace);
    expect(lips).not.toBeNull();
    expect(lips?.length).toBe(40);
    expect(lips?.[0].x).toBe(61 * 0.001);
  });
});
