import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';
import { classifyHandLandmarks } from '../utils/gestureClassifier';
import { useAssistantStore } from '../store/useAssistantStore';

interface CameraFeedProps {
  onGestureDetected: (intent: string, landmarks: any[]) => void;
  onLipDetected?: (landmarks: any[]) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onGestureDetected, onLipDetected: _onLipDetected }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraInstanceRef = useRef<MediaPipeCamera | null>(null);
  const handsInstanceRef = useRef<Hands | null>(null);
  const lastEmittedRef = useRef<number>(0);

  const { stageEvent } = useAssistantStore();

  const handleResults = useCallback((results: Results) => {
    console.log('[CameraFeed] handleResults called! Hands detected:', results.multiHandLandmarks?.length || 0);
    setIsInitializing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];

      // Draw skeleton on canvas
      ctx.fillStyle = '#6366f1';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;

      for (const pt of landmarks) {
        ctx.beginPath();
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Classify gesture
      const classified = classifyHandLandmarks(landmarks);
      if (classified) {
        setDetectedGesture(classified.intent);

        const now = Date.now();
        // 1.5s cooldown
        if (now - lastEmittedRef.current > 1500) {
          lastEmittedRef.current = now;

          // 1. Immediate local stage (0ms latency)
          stageEvent(
            {
              id: `evt_${now}`,
              source: 'gesture',
              intent: classified.intent,
              raw_text: classified.defaultText,
              confidence: classified.confidence,
            },
            classified.defaultText,
            true // Refinement underway
          );

          // 2. Notify backend over WebSocket
          onGestureDetected(classified.intent, landmarks);
        }
      } else {
        setDetectedGesture(null);
      }
    } else {
      setDetectedGesture(null);
    }
    ctx.restore();
  }, [stageEvent, onGestureDetected]);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    console.log('[CameraFeed] Initializing camera & MediaPipe Hands...');
    setPermissionError(null);
    setIsInitializing(true);

    try {
      const hands = new Hands({
        locateFile: (file) => {
          const path = `/mediapipe/hands/${file}`;
          console.log('[CameraFeed] locateFile requested:', file, '->', path);
          return path;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.60,
        minTrackingConfidence: 0.60,
      });

      hands.onResults(handleResults);
      handsInstanceRef.current = hands;

      let frameCount = 0;
      const camera = new MediaPipeCamera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsInstanceRef.current) {
            if (frameCount++ % 30 === 0) {
              console.log('[CameraFeed] onFrame tick', frameCount, 'video readyState:', videoRef.current.readyState, 'size:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            }
            try {
              await handsInstanceRef.current.send({ image: videoRef.current });
            } catch (frameErr) {
              console.error('[CameraFeed] Error in hands.send:', frameErr);
            }
          }
        },
        width: 320,
        height: 240,
      });

      console.log('[CameraFeed] Starting MediaPipeCamera...');
      camera.start()
        .then(() => console.log('[CameraFeed] camera.start() resolved!'))
        .catch((err: any) => {
          console.error('[CameraFeed] Camera start failed:', err);
          setPermissionError('Camera permission denied or camera unavailable in this browser window: ' + (err?.message || err));
          setIsActive(false);
          setIsInitializing(false);
        });

      cameraInstanceRef.current = camera;
    } catch (e: any) {
      console.error('[CameraFeed] Failed to initialize MediaPipe Hands:', e);
      setPermissionError(e.message || 'MediaPipe initialization error');
      setIsActive(false);
      setIsInitializing(false);
    }

    return () => {
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
        cameraInstanceRef.current = null;
      }
      if (handsInstanceRef.current) {
        handsInstanceRef.current.close();
        handsInstanceRef.current = null;
      }
      setIsInitializing(false);
    };
  }, [isActive, handleResults]);

  const toggleCamera = () => {
    setIsActive((prev) => !prev);
    setDetectedGesture(null);
  };

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
      <div className="p-2.5 flex items-center justify-between text-xs border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCamera}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
              isActive
                ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow'
            }`}
          >
            {isActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            {isActive ? 'Stop Camera' : 'Turn on Live Camera'}
          </button>

          {isActive && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Tracking Hands
            </span>
          )}
        </div>

        {isActive && (
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-white transition p-1"
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {permissionError && (
        <div className="p-2.5 bg-rose-950/60 border-b border-rose-900/60 text-rose-300 text-[11px]">
          {permissionError}
        </div>
      )}

      {isActive && !isMinimized && (
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {isInitializing && (
            <div className="absolute inset-0 bg-gray-950/80 z-10 flex flex-col items-center justify-center text-xs text-gray-300 gap-2 font-mono">
              <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Starting camera & tracker...</span>
            </div>
          )}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            width={320}
            height={240}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          />

          {detectedGesture && (
            <div className="absolute top-2 left-2 z-20 bg-indigo-900/90 border border-indigo-400 text-indigo-100 text-[11px] font-mono px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
              <Eye className="w-3.5 h-3.5 text-indigo-300" />
              <span className="font-semibold">{detectedGesture}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
