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

