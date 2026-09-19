import React, { useState } from 'react';
import { useAssistantStore } from '../store/useAssistantStore';
import { Hand, MessageSquare, Mic, Send, X, Check } from 'lucide-react';

export const DetectionCard: React.FC = () => {
  const { activeEvent, stagedMessage, confirmStagedMessage, cancelStagedMessage } = useAssistantStore();
  const [copied, setCopied] = useState(false);

  if (!activeEvent || !stagedMessage) {
    return (
      <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-800/60 text-center text-gray-500 text-xs py-7 space-y-1">
        <p className="font-medium text-gray-400">Waiting for live detection...</p>
        <p className="text-[11px] text-gray-600">Raise your hand, mouth a phrase, or click a test button below.</p>
      </div>
    );
  }

  const SourceIcon = activeEvent.source === 'gesture' ? Hand : activeEvent.source === 'lip' ? MessageSquare : Mic;

  const handleSend = async () => {
    try {
      await navigator.clipboard.writeText(stagedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    confirmStagedMessage();
  };

  return (
    <div className="p-4 bg-gray-900/90 rounded-xl border border-indigo-500/40 shadow-xl space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          <SourceIcon className="w-4 h-4 text-indigo-400 animate-bounce" />
          <span>{activeEvent.source} detected</span>
        </div>
        <span className="text-xs bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
          {Math.round(activeEvent.confidence * 100)}% match
        </span>
      </div>

      <p className="text-[13px] text-gray-100 font-medium leading-relaxed bg-black/40 p-3 rounded-lg border border-gray-800">
        "{stagedMessage}"
      </p>

      {copied && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/50 p-2 rounded border border-emerald-800/50 animate-fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>Copied to clipboard! Ready to paste (Cmd + V) into Google Meet chat.</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSend}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-lg text-xs font-semibold shadow transition"
        >
          <Send className="w-3.5 h-3.5" /> Copy & Send to Meeting
        </button>
        <button
          onClick={cancelStagedMessage}
          title="Cancel"
          className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 rounded-lg text-xs transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
