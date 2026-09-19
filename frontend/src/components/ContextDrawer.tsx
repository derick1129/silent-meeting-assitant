import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, Check } from 'lucide-react';

interface ContextDrawerProps {
  onUpdateContext: (snippet: string) => void;
  isConnected: boolean;
}

export const ContextDrawer: React.FC<ContextDrawerProps> = ({ onUpdateContext, isConnected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [snippet, setSnippet] = useState(
    'Discussing whether to migrate our database to PostgreSQL or keep MongoDB.'
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!snippet.trim()) return;
    onUpdateContext(snippet.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl overflow-hidden transition">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 text-xs text-gray-300 hover:text-white transition"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Active Meeting Context (Gemini)</span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {isOpen && (
        <div className="p-3 pt-0 space-y-2 border-t border-gray-800/60 text-xs">
          <p className="text-[11px] text-gray-400">
            What is currently being discussed in the meeting? Gemini uses this to adapt your silent gestures:
          </p>
          <textarea
            rows={2}
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-gray-200 text-xs focus:outline-none focus:border-indigo-500 transition"
            placeholder="e.g. Discussing project timeline, architecture choices..."
          />
          <button
            disabled={!isConnected}
            onClick={handleSave}
            className="w-full py-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-md font-medium text-xs flex items-center justify-center gap-1 transition"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Context Updated' : 'Update Meeting Context'}
          </button>
        </div>
      )}
    </div>
  );
};
