import { describe, it, expect, beforeEach } from 'vitest';
import { useAssistantStore } from '../../store/useAssistantStore';

describe('useWebSocket message handling', () => {
  beforeEach(() => {
    useAssistantStore.setState({
      status: 'IDLE',
      mode: 'AUTO',
      activeEvent: null,
      stagedMessage: '',
      history: []
    });
  });

  it('updates store when message_staged event is received', () => {
    const fakeData = {
      event: {
        id: 'evt_test',
        source: 'gesture',
        intent: 'REQUEST_TO_SPEAK',
        raw_text: 'I would like to speak',
        confidence: 0.95
      },
      normalized_text: 'I would like to speak regarding database architecture.'
    };

    useAssistantStore.getState().stageEvent(fakeData.event as any, fakeData.normalized_text);
    const state = useAssistantStore.getState();
    expect(state.status).toBe('AWAITING_CONFIRMATION');
    expect(state.stagedMessage).toBe('I would like to speak regarding database architecture.');
  });

  it('updates store when solution_generated event is processed', () => {
    const fakeSolution = {
      query: 'What is our Q3 timeline?',
      suggested_answer: 'Target delivery is scheduled for mid-August with canary deployments.',
      solution_points: ['Stage 1 rollout', 'Beta testing'],
      category: 'Timeline',
      timestamp: Date.now()
    };

    useAssistantStore.getState().setSolution(fakeSolution);
    useAssistantStore.getState().setIsGeneratingSolution(false);

    const state = useAssistantStore.getState();
    expect(state.activeSolution).toEqual(fakeSolution);
    expect(state.isGeneratingSolution).toBe(false);
  });
});
