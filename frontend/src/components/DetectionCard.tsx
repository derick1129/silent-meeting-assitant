import React from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { Hand, MessageSquare, Mic, Send, X } from 'lucide-react';

export const DetectionCard: React.FC = () => {
  const { activeEvent, stagedMessage, confirmStagedMessage, cancelStagedMessage } = useAssistantStore();

  if (!activeEvent || !stagedMessage) {
    return (
      <div className="p-4 bg-gray-950/50 rounded-lg border border-gray-800/60 text-center text-gray-500 text-xs py-8">
        Waiting for speech, silent lip commands, or gestures...
      </div>
    );
  }

  const SourceIcon = activeEvent.source === 'gesture' ? Hand : activeEvent.source === 'lip' ? MessageSquare : Mic;

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-indigo-500/30 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium uppercase tracking-wider">
          <SourceIcon className="w-4 h-4" />
          <span>{activeEvent.source} detected</span>
        </div>
        <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-mono">
          {Math.round(activeEvent.confidence * 100)}%
        </span>
      </div>

      <p className="text-base text-gray-100 font-medium leading-relaxed">
        "{stagedMessage}"
      </p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={confirmStagedMessage}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition"
        >
          <Send className="w-3.5 h-3.5" /> Send to Meeting
        </button>
        <button
          onClick={cancelStagedMessage}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
