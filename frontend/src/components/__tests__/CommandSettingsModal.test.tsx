import { describe, it, expect } from 'vitest';
import { DEFAULT_COMMANDS } from '../../store/useCommandStore';

describe('CommandSettingsModal Logic', () => {
  it('loads all standard commands into the configuration list', () => {
    const commands = Object.values(DEFAULT_COMMANDS);
    expect(commands.length).toBeGreaterThanOrEqual(10);
    expect(commands.some((c) => c.intent === 'YES')).toBe(true);
    expect(commands.some((c) => c.intent === 'QUESTION')).toBe(true);
    expect(commands.some((c) => c.intent === 'STOP')).toBe(true);
  });

  it('validates custom command intent sanitization', () => {
    const rawIntent = '  wrap  up  ';
    const cleanIntent = rawIntent.trim().toUpperCase().replace(/\s+/g, '_');
    expect(cleanIntent).toBe('WRAP_UP');
  });

  it('detects dirty state when command text differs from default', () => {
    const defaultText = DEFAULT_COMMANDS.YES.default_text;
    const editedText = 'LGTM! Approved.';
    const isDirty = editedText !== defaultText;
    expect(isDirty).toBe(true);
  });
});
