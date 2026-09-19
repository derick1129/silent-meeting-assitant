import { create } from 'zustand';
import { AppMode, AppStatus, CommunicationEvent, DispatchedMessage, MeetingSolution } from '../types';

interface AssistantState {
  status: AppStatus;
  mode: AppMode;
  activeEvent: CommunicationEvent | null;
  stagedMessage: string;
  isRefining: boolean;
  history: DispatchedMessage[];
  meetingContext: string;
  activeSolution: MeetingSolution | null;
  isGeneratingSolution: boolean;
  autoSuggest: boolean;
  setMode: (mode: AppMode) => void;
  setMeetingContext: (ctx: string) => void;
  stageEvent: (event: CommunicationEvent, normalizedText: string, isRefining?: boolean) => void;
  refineStagedMessage: (refinedText: string) => void;
  confirmStagedMessage: () => void;
  cancelStagedMessage: () => void;
  setSolution: (solution: MeetingSolution | null) => void;
  clearSolution: () => void;
  setIsGeneratingSolution: (isGenerating: boolean) => void;
  setAutoSuggest: (enabled: boolean) => void;
  stageSolutionAsAnswer: (solution: MeetingSolution) => void;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  status: 'IDLE',
  mode: 'AUTO',
  activeEvent: null,
  stagedMessage: '',
  isRefining: false,
  history: [],
  meetingContext: 'Discussing whether to migrate our database to PostgreSQL or keep MongoDB.',
  activeSolution: null,
  isGeneratingSolution: false,
  autoSuggest: false,
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
  }),
  setSolution: (solution) => set({ activeSolution: solution }),
  clearSolution: () => set({ activeSolution: null }),
  setIsGeneratingSolution: (isGeneratingSolution) => set({ isGeneratingSolution }),
  setAutoSuggest: (autoSuggest) => set({ autoSuggest }),
  stageSolutionAsAnswer: (solution) => {
    const event: CommunicationEvent = {
      id: `solution-${Date.now()}`,
      source: 'speech',
      intent: 'SUGGESTED_ANSWER',
      raw_text: solution.suggested_answer,
      confidence: 1.0,
    };
    set({
      activeEvent: event,
      stagedMessage: solution.suggested_answer,
      isRefining: false,
      status: 'AWAITING_CONFIRMATION',
    });
  },
}));
