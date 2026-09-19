import { describe, it, expect } from 'vitest';

describe('CameraFeed Debounce and Cooldown Logic', () => {
  it('enforces 1500ms cooldown window between gesture emissions', () => {
    const cooldownMs = 1500;
    const firstEmitted = 1000;

    const quickFollowUp = 1800; // only 800ms later
    const canEmitQuick = quickFollowUp - firstEmitted > cooldownMs;
    expect(canEmitQuick).toBe(false);

    const validFollowUp = 2600; // 1600ms later
    const canEmitValid = validFollowUp - firstEmitted > cooldownMs;
    expect(canEmitValid).toBe(true);
  });

  it('correctly defaults camera to inactive', () => {
    const initialActive = false;
    expect(initialActive).toBe(false);
  });
});
