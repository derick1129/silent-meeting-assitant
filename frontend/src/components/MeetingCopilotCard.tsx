import React, { useState } from 'react';
import { Sparkles, Copy, Check, X, ArrowRight, Lightbulb } from 'lucide-react';
import { useAssistantStore } from '../store/useAssistantStore';

export const MeetingCopilotCard: React.FC = () => {
  const {
    activeSolution,
    isGeneratingSolution,
    stageSolutionAsAnswer,
    clearSolution,
  } = useAssistantStore();

  const [copied, setCopied] = useState(false);

  if (!activeSolution && !isGeneratingSolution) {
    return null;
  }

  const handleCopy = () => {
    if (!activeSolution) return;
    const textToCopy = `${activeSolution.suggested_answer}\n\nKey Points:\n${activeSolution.solution_points.map(p => `• ${p}`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStage = () => {
    if (!activeSolution) return;
    stageSolutionAsAnswer(activeSolution);
  };

  if (isGeneratingSolution) {
    return (
      <div className="bg-gradient-to-r from-indigo-950/70 to-purple-950/70 border border-indigo-500/30 rounded-xl p-3 text-xs space-y-2 animate-pulse">
        <div className="flex items-center gap-2 text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">AI Meeting Copilot</span>
        </div>
        <p className="text-gray-300 text-[11px]">
          Synthesizing real-time answer & solution from meeting discussion...
        </p>
      </div>
    );
  }

  if (!activeSolution) return null;

  return (
    <div className="bg-gradient-to-b from-indigo-950/80 to-gray-900/90 border border-indigo-500/40 rounded-xl p-3.5 text-xs space-y-3 shadow-lg shadow-indigo-950/50 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-[11px] uppercase tracking-wider">
            Copilot Suggestion
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
            {activeSolution.category || 'General'}
          </span>
        </div>
        <button
          onClick={clearSolution}
          title="Dismiss suggestion"
          className="text-gray-400 hover:text-gray-200 p-0.5 rounded transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Query heard */}
      {activeSolution.query && (
        <div className="bg-gray-950/60 border border-indigo-900/40 rounded-lg p-2 text-gray-300 text-[11px] italic flex items-start gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2">&ldquo;{activeSolution.query}&rdquo;</span>
        </div>
      )}

      {/* Suggested Answer */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
          Suggested Answer
        </div>
        <div className="bg-indigo-950/50 border border-indigo-600/30 rounded-lg p-2.5 text-gray-100 font-medium text-[11.5px] leading-relaxed">
          {activeSolution.suggested_answer}
        </div>
      </div>

      {/* Solution Bullet Points */}
      {activeSolution.solution_points && activeSolution.solution_points.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Actionable Solution Points
          </div>
          <ul className="space-y-1 bg-gray-950/40 rounded-lg p-2 border border-gray-800/80">
            {activeSolution.solution_points.map((pt, i) => (
              <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                <span className="text-indigo-400 font-bold mt-0.5">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleStage}
          className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 shadow transition"
        >
          <span>Stage as Answer</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleCopy}
          title="Copy Answer & Points"
          className="py-1.5 px-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs flex items-center gap-1 transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
