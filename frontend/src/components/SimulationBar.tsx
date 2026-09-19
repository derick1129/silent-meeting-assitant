import React from 'react';
import { Hand, MessageSquare, Octagon, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react';

interface SimulationBarProps {
  onSimulate: (intent: string, source?: string) => void;
  isConnected: boolean;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({ onSimulate, isConnected }) => {
  const actions = [
    { label: 'Raise Hand', intent: 'REQUEST_TO_SPEAK', source: 'gesture', icon: Hand, color: 'hover:bg-amber-950/80 hover:border-amber-700 text-amber-300' },
    { label: 'Question', intent: 'QUESTION', source: 'lip', icon: MessageSquare, color: 'hover:bg-blue-950/80 hover:border-blue-700 text-blue-300' },
    { label: 'Stop', intent: 'STOP', source: 'gesture', icon: Octagon, color: 'hover:bg-rose-950/80 hover:border-rose-700 text-rose-300' },
    { label: 'Agree', intent: 'YES', source: 'gesture', icon: ThumbsUp, color: 'hover:bg-emerald-950/80 hover:border-emerald-700 text-emerald-300' },
    { label: 'Disagree', intent: 'NO', source: 'gesture', icon: ThumbsDown, color: 'hover:bg-orange-950/80 hover:border-orange-700 text-orange-300' },
  ];

  return (
    <div className="space-y-2 pt-1 border-t border-gray-800/80">
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span className="font-semibold tracking-wider uppercase flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Live Modality Testing
        </span>
        <span className={isConnected ? "text-emerald-400 font-mono text-[10px]" : "text-amber-400 font-mono text-[10px]"}>
          {isConnected ? "● WS Connected" : "○ WS Disconnected"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.intent}
              disabled={!isConnected}
              onClick={() => onSimulate(act.intent, act.source)}
              className={`flex items-center gap-1.5 p-2 rounded-lg border border-gray-800 bg-gray-900/60 text-xs transition duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${act.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
