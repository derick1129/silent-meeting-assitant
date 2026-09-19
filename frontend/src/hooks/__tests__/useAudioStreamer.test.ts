import { describe, it, expect } from 'vitest';
import { convertFloat32ToInt16, arrayBufferToBase64 } from '../useAudioStreamer';

describe('useAudioStreamer PCM Audio Conversion', () => {
  it('converts Float32 audio samples (-1.0 to 1.0) to Int16 linear PCM correctly', () => {
    const floatSamples = new Float32Array([0.0, 1.0, -1.0, 0.5, -0.5]);
    const int16Samples = convertFloat32ToInt16(floatSamples);

    expect(int16Samples.length).toBe(5);
    expect(int16Samples[0]).toBe(0);
    expect(int16Samples[1]).toBe(32767); // 0x7FFF
    expect(int16Samples[2]).toBe(-32767); // Clamped -1.0 * 0x7FFF
    expect(int16Samples[3]).toBe(16383); // 0.5 * 32767
  });

  it('clamps values beyond -1.0 and 1.0 without integer overflow', () => {
    const floatSamples = new Float32Array([1.5, -1.8]);
    const int16Samples = convertFloat32ToInt16(floatSamples);

    expect(int16Samples[0]).toBe(32767);
    expect(int16Samples[1]).toBe(-32767);
  });

  it('converts ArrayBuffer to Base64 cleanly', () => {
    const testBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = arrayBufferToBase64(testBytes.buffer);
    expect(b64).toBe('SGVsbG8=');
  });
});
