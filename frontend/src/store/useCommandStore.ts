import { create } from 'zustand';
import { CommandDefinition } from '../types';

export const DEFAULT_COMMANDS: Record<string, CommandDefinition> = {
  YES: {
    intent: 'YES',
    display_name: 'Yes',
    default_text: 'Yes, I agree.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
  NO: {
    intent: 'NO',
    display_name: 'No',
    default_text: 'No, I disagree.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
  HELP: {
    intent: 'HELP',
    display_name: 'Help',
    default_text: 'I need assistance.',
    supported_modalities: ['lip', 'speech'],
  },
  STOP: {
    intent: 'STOP',
    display_name: 'Stop',
    default_text: 'Please pause or stop here.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
  THANK_YOU: {
    intent: 'THANK_YOU',
    display_name: 'Thank You',
    default_text: 'Thank you.',
    supported_modalities: ['lip', 'speech'],
  },
  REQUEST_TO_SPEAK: {
    intent: 'REQUEST_TO_SPEAK',
    display_name: 'I Want to Speak',
    default_text: 'I would like to speak.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
  QUESTION: {
    intent: 'QUESTION',
    display_name: 'I Have a Question',
    default_text: 'I have a question regarding this.',
    supported_modalities: ['lip', 'speech'],
  },
  PLEASE_REPEAT: {
    intent: 'PLEASE_REPEAT',
    display_name: 'Please Repeat',
    default_text: 'Could you please repeat that?',
    supported_modalities: ['lip', 'speech'],
  },
  NEXT_TOPIC: {
    intent: 'NEXT_TOPIC',
    display_name: 'Next Topic',
    default_text: "Let's move on to the next topic.",
    supported_modalities: ['lip', 'speech'],
  },
  AGREE: {
    intent: 'AGREE',
    display_name: 'Agree',
    default_text: 'I agree with this point.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
  DISAGREE: {
    intent: 'DISAGREE',
    display_name: 'Disagree',
    default_text: 'I have concerns regarding this.',
    supported_modalities: ['gesture', 'lip', 'speech'],
  },
};

const STORAGE_KEY = 'silent_meeting_commands';

function loadInitialCommands(): Record<string, CommandDefinition> {
  if (typeof window === 'undefined') return { ...DEFAULT_COMMANDS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_COMMANDS, ...parsed };
    }
  } catch (err) {
    console.warn('[useCommandStore] Failed to parse localStorage commands', err);
  }
  return { ...DEFAULT_COMMANDS };
}

function saveCommandsLocally(commands: Record<string, CommandDefinition>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
  } catch (err) {
    console.warn('[useCommandStore] Failed to save commands to localStorage', err);
  }
}

interface CommandStoreState {
  commands: Record<string, CommandDefinition>;
  isLoading: boolean;
  error: string | null;

  fetchCommands: () => Promise<void>;
  updateCommand: (
    intent: string,
    defaultText: string,
    displayName?: string,
    supportedModalities?: string[]
  ) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  getCommandText: (intent: string) => string;
}

export const useCommandStore = create<CommandStoreState>((set, get) => ({
  commands: loadInitialCommands(),
  isLoading: false,
  error: null,

  fetchCommands: async () => {
    set({ isLoading: true, error: null });
    try {
      const resp = await fetch('/api/commands');
      if (resp.ok) {
        const data = await resp.json();
        const merged = { ...get().commands, ...data };
        saveCommandsLocally(merged);
        set({ commands: merged, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      // Offline or network error - keep local commands
      set({ isLoading: false, error: err?.message || 'Failed to fetch commands' });
    }
  },

  updateCommand: async (
    intent: string,
    defaultText: string,
    displayName?: string,
    supportedModalities?: string[]
  ) => {
    const current = get().commands;
    const existing = current[intent];

    const updatedCmd: CommandDefinition = {
      intent,
      display_name: displayName || existing?.display_name || intent.replace(/_/g, ' '),
      default_text: defaultText,
      supported_modalities: supportedModalities || existing?.supported_modalities || ['gesture', 'lip', 'speech'],
    };

    const nextCommands = { ...current, [intent]: updatedCmd };
    saveCommandsLocally(nextCommands);
    set({ commands: nextCommands });

    // Sync to backend if available
    try {
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent,
          default_text: defaultText,
          display_name: updatedCmd.display_name,
          supported_modalities: updatedCmd.supported_modalities,
        }),
      });
    } catch (err) {
      console.warn('[useCommandStore] Could not sync command update to backend', err);
    }
  },

  resetToDefaults: async () => {
    const fresh = { ...DEFAULT_COMMANDS };
    saveCommandsLocally(fresh);
    set({ commands: fresh });

    try {
      await fetch('/api/commands/reset', { method: 'POST' });
    } catch (err) {
      console.warn('[useCommandStore] Could not sync reset to backend', err);
    }
  },

  getCommandText: (intent: string) => {
    const cmd = get().commands[intent];
    if (cmd && cmd.default_text) {
      return cmd.default_text;
    }
    return DEFAULT_COMMANDS[intent]?.default_text || intent;
  },
}));
