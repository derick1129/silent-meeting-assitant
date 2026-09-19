import { create } from 'zustand';
import { AppMode, AppStatus, CommunicationEvent, DispatchedMessage } from '../types';

interface AssistantState {
  status: AppStatus;
  mode: AppMode;
  activeEvent: CommunicationEvent | null;
  stagedMessage: string;
  isRefining: boolean;
  history: DispatchedMessage[];
  meetingContext: string;
  setMode: (mode: AppMode) => void;
  setMeetingContext: (ctx: string) => void;
  stageEvent: (event: CommunicationEvent, normalizedText: string, isRefining?: boolean) => void;
  refineStagedMessage: (refinedText: string) => void;
  confirmStagedMessage: () => void;
  cancelStagedMessage: () => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  status: 'IDLE',
  mode: 'AUTO',
  activeEvent: null,
  stagedMessage: '',
  isRefining: false,
  history: [],
  meetingContext: 'Discussing whether to migrate our database to PostgreSQL or keep MongoDB.',
  setMode: (mode) => set({ mode }),
  setMeetingContext: (ctx) => set({ meetingContext: ctx }),
  stageEvent: (event, normalizedText, isRefining = true) => set({
    activeEvent: event,
    stagedMessage: normalizedText,
    isRefining,
    status: 'AWAITING_CONFIRMATION'
  }),
  refineStagedMessage: (refinedText: string) => set((state) => {
    if (!state.activeEvent) return {};
    return {
      stagedMessage: refinedText,
      isRefining: false,
    };
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
