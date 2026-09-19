import { useState, useRef, useCallback } from 'react';

export function convertFloat32ToInt16(buffer: Float32Array): Int16Array {
  let l = buffer.length;
  const buf = new Int16Array(l);
  while (l--) {
    buf[l] = Math.min(1, Math.max(-1, buffer[l])) * 0x7fff;
  }
  return buf;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(binary);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return (globalThis as any).Buffer ? (globalThis as any).Buffer.from(binary, 'binary').toString('base64') : '';
}

export function useAudioStreamer(onChunk: (base64Chunk: string) => void) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startStreaming = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      // Process in 4096 sample buffers (~256 ms of 16kHz audio)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = convertFloat32ToInt16(inputData);
        const b64 = arrayBufferToBase64(pcm16.buffer);
        onChunk(b64);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsStreaming(true);
    } catch (err: any) {
      console.error('Failed to start audio streaming:', err);
      setError(err.message || 'Microphone access denied');
      setIsStreaming(false);
    }
  }, [onChunk]);

  const stopStreaming = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
  };
}
