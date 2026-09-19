import { describe, it, expect, beforeEach } from 'vitest';
import { useAssistantStore } from '../useAssistantStore';

describe('useAssistantStore', () => {
  beforeEach(() => {
    useAssistantStore.setState({
      status: 'IDLE',
      mode: 'AUTO',
      activeEvent: null,
      stagedMessage: '',
      history: []
    });
  });

  it('sets detected event and stages normalized message', () => {
    const { stageEvent, confirmStagedMessage } = useAssistantStore.getState();
    stageEvent({
      id: 'evt_1',
      source: 'lip',
      intent: 'QUESTION',
      raw_text: 'I have a question',
      confidence: 0.94
    }, 'I have a question regarding this architecture.');

    const state = useAssistantStore.getState();
    expect(state.status).toBe('AWAITING_CONFIRMATION');
    expect(state.stagedMessage).toBe('I have a question regarding this architecture.');

    confirmStagedMessage();
    const after = useAssistantStore.getState();
    expect(after.status).toBe('SENT');
    expect(after.history.length).toBe(1);
    expect(after.history[0].message).toBe('I have a question regarding this architecture.');
  });

  it('cancels staged message', () => {
    const { stageEvent, cancelStagedMessage } = useAssistantStore.getState();
    stageEvent({
      id: 'evt_2',
      source: 'gesture',
      intent: 'STOP',
      raw_text: 'Stop',
      confidence: 0.95
    }, 'Please pause.');

    expect(useAssistantStore.getState().status).toBe('AWAITING_CONFIRMATION');
    cancelStagedMessage();
    expect(useAssistantStore.getState().status).toBe('IDLE');
    expect(useAssistantStore.getState().activeEvent).toBeNull();
  });

  it('manages meeting copilot solution lifecycle and stages answer', () => {
    const { setSolution, clearSolution, setAutoSuggest, stageSolutionAsAnswer } = useAssistantStore.getState();
    setAutoSuggest(true);
    expect(useAssistantStore.getState().autoSuggest).toBe(true);

    const testSolution = {
      query: 'Should we migrate to PostgreSQL?',
      suggested_answer: 'Yes, PostgreSQL provides strong ACID compliance and JSON support.',
      solution_points: [
        'Evaluate current MongoDB query patterns.',
        'Benchmark write throughput under load.'
      ],
      category: 'Database Architecture',
      timestamp: Date.now()
    };

    setSolution(testSolution);
    expect(useAssistantStore.getState().activeSolution).toEqual(testSolution);

    // Stage solution as answer
    stageSolutionAsAnswer(testSolution);
    const stagedState = useAssistantStore.getState();
    expect(stagedState.status).toBe('AWAITING_CONFIRMATION');
    expect(stagedState.stagedMessage).toBe(testSolution.suggested_answer);
    expect(stagedState.activeEvent?.intent).toBe('SUGGESTED_ANSWER');

    clearSolution();
    expect(useAssistantStore.getState().activeSolution).toBeNull();
  });
});
