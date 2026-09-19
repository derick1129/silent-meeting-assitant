import { describe, expect, it, vi } from 'vitest';
import { createVSRRequest, selectVSRMimeType } from '../useSilentPhraseCapture';

describe('silent phrase capture helpers', () => {
  it('selects a browser-supported WebM recording format', () => {
    const isTypeSupported = vi.fn((type: string) => type === 'video/webm;codecs=vp8,opus');

    expect(selectVSRMimeType(isTypeSupported)).toBe('video/webm;codecs=vp8,opus');
    expect(isTypeSupported).toHaveBeenCalledWith('video/webm;codecs=vp8,opus');
  });

  it('builds a local VSR request with the expected headers and body', () => {
    const clip = new Blob(['video'], { type: 'video/webm' });
    const request = createVSRRequest(clip);

    expect(request.method).toBe('POST');
    expect((request.headers as Record<string, string>)['Content-Type']).toBe('video/webm');
    expect((request.headers as Record<string, string>)['X-Filename']).toBe('silent-phrase.webm');
    expect(request.body).toBe(clip);
  });
});
