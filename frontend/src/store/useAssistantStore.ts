import { create } from 'zustand';
import { AppMode, AppStatus, CommunicationEvent, DispatchedMessage } from '../types';

interface AssistantState {
  status: AppStatus;
  mode: AppMode;
  activeEvent: CommunicationEvent | null;
  stagedMessage: string;
  history: DispatchedMessage[];
  setMode: (mode: AppMode) => void;
  stageEvent: (event: CommunicationEvent, normalizedText: string) => void;
  confirmStagedMessage: () => void;
  cancelStagedMessage: () => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  status: 'IDLE',
  mode: 'AUTO',
  activeEvent: null,
  stagedMessage: '',
  history: [],
  setMode: (mode) => set({ mode }),
  stageEvent: (event, normalizedText) => set({
    activeEvent: event,
    stagedMessage: normalizedText,
    status: 'AWAITING_CONFIRMATION'
  }),
  confirmStagedMessage: () => {
    const { activeEvent, stagedMessage, history } = get();
    if (!activeEvent || !stagedMessage) return;
    const newMsg: DispatchedMessage = {
      id: activeEvent.id,
      source: activeEvent.source,
      message: stagedMessage,
      timestamp: Date.now()
    };
    set({
      history: [newMsg, ...history],
      activeEvent: null,
      stagedMessage: '',
      status: 'SENT'
    });
  },
  cancelStagedMessage: () => set({
    activeEvent: null,
    stagedMessage: '',
    status: 'IDLE'
  })
}));
