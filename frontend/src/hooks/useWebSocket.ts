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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
            const { event: commEvent, normalized_text } = envelope.data;
            stageEvent(commEvent as CommunicationEvent, normalized_text);
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

  return {
    isConnected,
    sendAction,
    simulateIntent,
    updateContext,
    detectGesture,
  };
}
