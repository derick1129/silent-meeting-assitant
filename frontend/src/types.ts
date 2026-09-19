export type ModalitySource = 'speech' | 'lip' | 'gesture' | 'system';
export type AppStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'RECOGNIZED' | 'AWAITING_CONFIRMATION' | 'SENT' | 'ERROR';
export type AppMode = 'AUTO' | 'VOICE' | 'SILENT';

export interface CommunicationEvent {
  id: string;
  source: ModalitySource;
  intent: string;
  raw_text: string;
  confidence: number;
}

export interface DispatchedMessage {
  id: string;
  source: ModalitySource;
  message: string;
  timestamp: number;
}

export interface CommandDefinition {
  intent: string;
  display_name: string;
  default_text: string;
  supported_modalities: string[];
}

export interface MeetingSolution {
  query: string;
  suggested_answer: string;
  solution_points: string[];
  category: string;
  timestamp: number;
}

export type SilentPhraseCaptureState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export interface VSRPrediction {
  text: string;
  intent: string | null;
  confidence: number;
  latency_ms: number;
  model_id: string;
}
