import React, { useState } from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { Sliders } from 'lucide-react';
import { CommandSettingsModal } from './CommandSettingsModal';

export const Header: React.FC = () => {
  const { mode, status, setMode } = useAssistantStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900 text-white select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-wide">SILENT ASSISTANT</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-mono transition"
            title="Configure Commands & Phrases"
          >
            <Sliders className="w-3 h-3 text-indigo-400" />
            <span>Commands</span>
          </button>
          <button
            onClick={() => setMode(mode === 'AUTO' ? 'SILENT' : mode === 'SILENT' ? 'VOICE' : 'AUTO')}
            className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 font-mono text-gray-200"
          >
            {mode}
          </button>
          <span className="text-gray-400 text-[11px] font-mono">{status}</span>
        </div>
      </div>

      <CommandSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

