import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, ChevronDown, ChevronUp, Eye, MessageSquare } from 'lucide-react';
import { Hands, Results } from '@mediapipe/hands';
import { FaceMesh, Results as FaceMeshResults } from '@mediapipe/face_mesh';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';
import { classifyHandLandmarks } from '../utils/gestureClassifier';
import { extractLipPoints } from '../utils/lipExtractor';
import { LipKinematicsTracker } from '../utils/lipClassifier';
import { useAssistantStore } from '../store/useAssistantStore';
import { useCommandStore } from '../store/useCommandStore';
import { useSilentPhraseCapture } from '../hooks/useSilentPhraseCapture';

interface CameraFeedProps {
  onGestureDetected: (intent: string, landmarks: any[]) => void;
  onLipDetected?: (landmarks: any[]) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onGestureDetected, onLipDetected }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  const [detectedLipIntent, setDetectedLipIntent] = useState<string | null>(null);
  const [lipState, setLipState] = useState<string>('NEUTRAL');
  const [lipLAR, setLipLAR] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraInstanceRef = useRef<MediaPipeCamera | null>(null);
  const handsInstanceRef = useRef<Hands | null>(null);
  const faceMeshInstanceRef = useRef<FaceMesh | null>(null);
  const lipTrackerRef = useRef<LipKinematicsTracker>(new LipKinematicsTracker(24, 2000));
  const lastEmittedRef = useRef<number>(0);

  const { stageEvent } = useAssistantStore();
  const silentCapture = useSilentPhraseCapture(videoRef);

  const handleFaceMeshResults = useCallback((results: FaceMeshResults) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const face = results.multiFaceLandmarks[0];
      const lipPoints = extractLipPoints(face as any);
      if (lipPoints && lipPoints.length === 40) {
        const lipResult = lipTrackerRef.current.processFrame(lipPoints);

        let lipColor = '#10b981'; // emerald for neutral
        if (lipResult) {
          setLipState(lipResult.state);
          setLipLAR(lipResult.lar);
          if (lipResult.state === 'OPENING') lipColor = '#f59e0b';
          else if (lipResult.state === 'SUSTAINED_OPEN') lipColor = '#ef4444';
          else if (lipResult.state === 'PURSED') lipColor = '#06b6d4';

          if (lipResult.intent) {
            setDetectedLipIntent(lipResult.intent);
            const now = Date.now();
            const customText = useCommandStore.getState().getCommandText(lipResult.intent);

            // 1. Immediate local stage (0ms latency)
            stageEvent(
              {
                id: `evt_lip_${now}`,
                source: 'lip',
                intent: lipResult.intent,
                raw_text: customText,
                confidence: lipResult.confidence,
              },
              customText,
              true // Refinement underway
            );

            setTimeout(() => setDetectedLipIntent(null), 2500);
          }
        }

        // Draw 40 lip landmarks with dynamic state color
        ctx.save();
        ctx.fillStyle = lipColor;
        ctx.shadowColor = lipColor;
        ctx.shadowBlur = lipResult && lipResult.state !== 'NEUTRAL' ? 6 : 0;
        for (const pt of lipPoints) {
          ctx.beginPath();
          ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.restore();

        if (onLipDetected) {
          onLipDetected(lipPoints);
        }
      }
    }
  }, [stageEvent, onLipDetected]);

  const handleResults = useCallback((results: Results) => {
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

          const customText = useCommandStore.getState().getCommandText(classified.intent) || classified.defaultText;

          // 1. Immediate local stage (0ms latency) with user-customized text
          stageEvent(
            {
              id: `evt_${now}`,
              source: 'gesture',
              intent: classified.intent,
              raw_text: customText,
              confidence: classified.confidence,
            },
            customText,
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

    console.log('[CameraFeed] Initializing camera, MediaPipe Hands & FaceMesh...');
    setPermissionError(null);
    setIsInitializing(true);

    try {
      const hands = new Hands({
        locateFile: (file) => `/mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.60,
        minTrackingConfidence: 0.60,
      });

      hands.onResults(handleResults);
      handsInstanceRef.current = hands;

      const faceMesh = new FaceMesh({
        locateFile: (file) => `/mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.50,
        minTrackingConfidence: 0.50,
      });

      faceMesh.onResults(handleFaceMeshResults);
      faceMeshInstanceRef.current = faceMesh;

      const camera = new MediaPipeCamera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            if (handsInstanceRef.current) {
              try {
                await handsInstanceRef.current.send({ image: videoRef.current });
              } catch (frameErr) {
                console.error('[CameraFeed] Error in hands.send:', frameErr);
              }
            }
            if (faceMeshInstanceRef.current) {
              try {
                await faceMeshInstanceRef.current.send({ image: videoRef.current });
              } catch (faceErr) {
                console.error('[CameraFeed] Error in faceMesh.send:', faceErr);
              }
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
      console.error('[CameraFeed] Failed to initialize MediaPipe:', e);
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
      if (faceMeshInstanceRef.current) {
        faceMeshInstanceRef.current.close();
        faceMeshInstanceRef.current = null;
      }
      setIsInitializing(false);
    };
  }, [isActive, handleResults, handleFaceMeshResults]);

  const toggleCamera = () => {
    setIsActive((prev) => !prev);
    setDetectedGesture(null);
  };

  const captureLabel = silentCapture.state === 'recording'
    ? 'Recording…'
    : silentCapture.state === 'processing'
    ? 'Reading…'
    : silentCapture.state === 'error'
    ? 'Retry silent phrase'
    : 'Read silent phrase';

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
              Tracking Hands & Lips
            </span>
          )}
        </div>

        {isActive && (
          <button
            onClick={silentCapture.state === 'error' ? silentCapture.reset : silentCapture.startCapture}
            disabled={silentCapture.state === 'recording' || silentCapture.state === 'processing'}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 disabled:opacity-50"
          >
            {captureLabel}
          </button>
        )}

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

      {silentCapture.error && (
        <div className="px-2.5 py-1.5 bg-rose-950/60 border-b border-rose-900/60 text-rose-300 text-[11px]">
          {silentCapture.error}
        </div>
      )}

      {silentCapture.state === 'success' && silentCapture.prediction && (
        <div className="px-2.5 py-1.5 bg-emerald-950/40 border-b border-emerald-900/60 text-emerald-300 text-[11px]">
          Read “{silentCapture.prediction.text}” in {Math.round(silentCapture.prediction.latency_ms)} ms
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

          {detectedLipIntent && (
            <div className="absolute top-2 right-2 z-20 bg-amber-950/90 border border-amber-400 text-amber-100 text-[11px] font-mono px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
              <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold">{detectedLipIntent}</span>
            </div>
          )}

          {/* Real-time Kinematic HUD status */}
          <div className="absolute bottom-2 left-2 z-20 bg-gray-950/80 backdrop-blur-sm border border-gray-800 text-[10px] font-mono px-2 py-0.5 rounded text-gray-400 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                lipState === 'OPENING'
                  ? 'bg-amber-400 animate-ping'
                  : lipState === 'SUSTAINED_OPEN'
                  ? 'bg-rose-500 animate-ping'
                  : lipState === 'PURSED'
                  ? 'bg-cyan-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>LAR: {lipLAR.toFixed(2)}</span>
            <span className="text-gray-500">|</span>
            <span className="uppercase text-[9px] text-gray-300">{lipState}</span>
          </div>
        </div>
      )}
    </div>
  );
};
