import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { SilentPhraseCaptureState, VSRPrediction } from '../types';

const MAX_CAPTURE_MS = 4000;

export function selectVSRMimeType(
  isTypeSupported: (mimeType: string) => boolean = (mimeType) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType),
): string {
  const candidates = ['video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((candidate) => isTypeSupported(candidate)) || '';
}

export function createVSRRequest(clip: Blob): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'video/webm',
      'X-Filename': 'silent-phrase.webm',
    },
    body: clip,
  };
}

interface SilentPhraseCaptureResult {
  state: SilentPhraseCaptureState;
  error: string | null;
  elapsedMs: number;
  prediction: VSRPrediction | null;
  startCapture: () => void;
  stopCapture: () => void;
  reset: () => void;
}

export function useSilentPhraseCapture(
  videoRef: RefObject<HTMLVideoElement>,
): SilentPhraseCaptureResult {
  const [state, setState] = useState<SilentPhraseCaptureState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [prediction, setPrediction] = useState<VSRPrediction | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setError(null);
    setElapsedMs(0);
    setPrediction(null);
  }, [clearTimer]);

  const stopCapture = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, [clearTimer]);

  const startCapture = useCallback(() => {
    if (state === 'recording' || state === 'processing') return;

    const stream = videoRef.current?.srcObject;
    if (typeof MediaStream === 'undefined' || !(stream instanceof MediaStream)) {
      setState('error');
      setError('Turn on the live camera before recording a silent phrase.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('This browser does not support video recording.');
      return;
    }

    try {
      const mimeType = selectVSRMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      setError(null);
      setPrediction(null);
      setElapsedMs(0);
      startedAtRef.current = Date.now();
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearTimer();
        setState('error');
        setError('The browser could not record the silent phrase.');
      };
      recorder.onstop = async () => {
        clearTimer();
        setElapsedMs(Date.now() - startedAtRef.current);
        setState('processing');
        const clip = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];
        if (clip.size === 0) {
          setState('error');
          setError('No video frames were captured. Please try again.');
          return;
        }
        try {
          const response = await fetch('/api/vsr/predict', createVSRRequest(clip));
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.detail || 'Silent phrase recognition failed.');
          }
          setPrediction(payload as VSRPrediction);
          setState('success');
        } catch (requestError: any) {
          setState('error');
          setError(requestError?.message || 'Silent phrase recognition failed.');
        }
      };
      recorder.start(250);
      setState('recording');
      timerRef.current = window.setTimeout(stopCapture, MAX_CAPTURE_MS);
    } catch (captureError: any) {
      setState('error');
      setError(captureError?.message || 'The browser could not start recording.');
    }
  }, [clearTimer, state, stopCapture, videoRef]);

  useEffect(() => () => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, [clearTimer]);

  return { state, error, elapsedMs, prediction, startCapture, stopCapture, reset };
}
