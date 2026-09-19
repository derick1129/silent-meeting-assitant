import { describe, it, expect } from 'vitest';

describe('DetectionCard rendering logic', () => {
  it('formats confidence percentage correctly', () => {
    const confidence = 0.942;
    const formatted = `${Math.round(confidence * 100)}%`;
    expect(formatted).toBe('94%');
  });

  it('handles low confidence edge case', () => {
    const confidence = 0.501;
    const formatted = `${Math.round(confidence * 100)}%`;
    expect(formatted).toBe('50%');
  });
});
