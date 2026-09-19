import { useEffect, useRef, useState, useCallback } from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { CommunicationEvent } from '../types';

interface WebSocketMessage {
  event: string;
  data: any;
  timestamp?: number;
}

export function useWebSocket(url: string = 'ws://127.0.0.1:8000/ws/events') {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const { stageEvent } = useAssistantStore();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const envelope: WebSocketMessage = JSON.parse(event.data);
          if (envelope.event === 'message_staged') {
            const { event: commEvent, normalized_text, is_refined } = envelope.data;
            stageEvent(commEvent as CommunicationEvent, normalized_text, !is_refined);
          } else if (envelope.event === 'message_refined') {
            const { refined_text } = envelope.data;
            useAssistantStore.getState().refineStagedMessage(refined_text);
          } else if (envelope.event === 'context_updated') {
            const fullContext = envelope.data?.full_context || envelope.data?.snippet;
            if (fullContext) {
              useAssistantStore.getState().setMeetingContext(fullContext);
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnection after 2 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        ws.close();
      };
    } catch (e) {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  }, [url, stageEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  const sendAction = useCallback((action: string, payload: Record<string, any> = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  const simulateIntent = useCallback((intent: string, source: string = 'gesture') => {
    sendAction('simulate_intent', { intent, source });
  }, [sendAction]);

  const updateContext = useCallback((snippet: string) => {
    sendAction('update_context', { snippet });
  }, [sendAction]);

  const detectGesture = useCallback((landmarks: any[]) => {
    sendAction('detect_gesture', { landmarks });
  }, [sendAction]);

  const detectLip = useCallback((landmarks: any[]) => {
    sendAction('detect_lip', { landmarks });
  }, [sendAction]);

  const sendAudioChunk = useCallback((base64Data: string) => {
    sendAction('audio_chunk', { data: base64Data });
  }, [sendAction]);

  const startAudio = useCallback(() => {
    sendAction('start_audio');
  }, [sendAction]);

  const stopAudio = useCallback(() => {
    sendAction('stop_audio');
  }, [sendAction]);

  return {
    isConnected,
    sendAction,
    simulateIntent,
    updateContext,
    detectGesture,
    detectLip,
    sendAudioChunk,
    startAudio,
    stopAudio,
  };
}
