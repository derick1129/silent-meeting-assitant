import { describe, it, expect } from 'vitest';
import { convertFloat32ToInt16, arrayBufferToBase64, downsampleBuffer, calculateRMS } from '../useAudioStreamer';

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

  it('downsamples from 48000 Hz to 16000 Hz correctly (3:1 ratio)', () => {
    // 6 samples at 48kHz downsample to 2 samples at 16kHz
    const input48k = new Float32Array([0.2, 0.4, 0.6, 0.8, 1.0, 0.6]);
    const output16k = downsampleBuffer(input48k, 48000, 16000);
    expect(output16k.length).toBe(2);
    expect(output16k[0]).toBeCloseTo((0.2 + 0.4 + 0.6) / 3, 2);
    expect(output16k[1]).toBeCloseTo((0.8 + 1.0 + 0.6) / 3, 2);
  });

  it('passes through unchanged if input rate is already 16000 Hz', () => {
    const input16k = new Float32Array([0.1, 0.2, 0.3]);
    const output16k = downsampleBuffer(input16k, 16000, 16000);
    expect(output16k).toBe(input16k);
  });

  it('converts ArrayBuffer to Base64 cleanly', () => {
    const testBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = arrayBufferToBase64(testBytes.buffer);
    expect(b64).toBe('SGVsbG8=');
  });

  it('calculates RMS audio energy level correctly', () => {
    const silence = new Float32Array([0, 0, 0, 0]);
    expect(calculateRMS(silence)).toBe(0);

    const active = new Float32Array([0.2, -0.2, 0.2, -0.2]);
    const level = calculateRMS(active);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(1);
  });
});
