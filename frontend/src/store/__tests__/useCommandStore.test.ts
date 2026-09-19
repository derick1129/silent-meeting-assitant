import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommandStore, DEFAULT_COMMANDS } from '../useCommandStore';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'window', { value: { localStorage: localStorageMock }, writable: true });

describe('useCommandStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useCommandStore.setState({
      commands: { ...DEFAULT_COMMANDS },
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('initializes with default commands', () => {
    const { commands, getCommandText } = useCommandStore.getState();
    expect(commands.YES).toBeDefined();
    expect(commands.YES.default_text).toBe('Yes, I agree.');
    expect(getCommandText('YES')).toBe('Yes, I agree.');
    expect(getCommandText('STOP')).toBe('Please pause or stop here.');
  });

  it('updates command text and reflects in getCommandText', async () => {
    // mock global fetch
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const { updateCommand } = useCommandStore.getState();
    await updateCommand('YES', 'LGTM! Approved.');

    const state = useCommandStore.getState();
    expect(state.commands.YES.default_text).toBe('LGTM! Approved.');
    expect(state.getCommandText('YES')).toBe('LGTM! Approved.');

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem('silent_meeting_commands') || '{}');
    expect(saved.YES.default_text).toBe('LGTM! Approved.');
  });

  it('allows adding a new custom command', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const { updateCommand } = useCommandStore.getState();
    await updateCommand('WRAP_UP', "Let's wrap up now.", 'Wrap Up', ['gesture']);

    const state = useCommandStore.getState();
    expect(state.commands.WRAP_UP).toBeDefined();
    expect(state.getCommandText('WRAP_UP')).toBe("Let's wrap up now.");
    expect(state.commands.WRAP_UP.supported_modalities).toEqual(['gesture']);
  });

  it('resets commands to default', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const { updateCommand, resetToDefaults } = useCommandStore.getState();
    await updateCommand('YES', 'Changed agreement');
    expect(useCommandStore.getState().getCommandText('YES')).toBe('Changed agreement');

    await resetToDefaults();
    expect(useCommandStore.getState().getCommandText('YES')).toBe('Yes, I agree.');
    expect(useCommandStore.getState().commands.WRAP_UP).toBeUndefined();
  });
});
