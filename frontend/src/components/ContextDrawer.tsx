import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Layers, Check, Mic, MicOff } from 'lucide-react';
import { useAudioStreamer } from '../hooks/useAudioStreamer';

interface ContextDrawerProps {
  onUpdateContext: (snippet: string) => void;
  onSendAudioChunk?: (base64Chunk: string) => void;
  isConnected: boolean;
}

export const ContextDrawer: React.FC<ContextDrawerProps> = ({
  onUpdateContext,
  onSendAudioChunk,
  isConnected,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [snippet, setSnippet] = useState(
    'Discussing whether to migrate our database to PostgreSQL or keep MongoDB.'
  );
  const [saved, setSaved] = useState(false);

  const { isStreaming, startStreaming, stopStreaming } = useAudioStreamer(
    useCallback(
      (b64Chunk: string) => {
        if (onSendAudioChunk) {
          onSendAudioChunk(b64Chunk);
        }
      },
      [onSendAudioChunk]
    )
  );

  const toggleStreaming = () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  };

  const handleSave = () => {
    if (!snippet.trim()) return;
    onUpdateContext(snippet.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl overflow-hidden transition">
      <div className="flex items-center justify-between p-2.5 text-xs text-gray-300">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 font-medium hover:text-white transition"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Active Meeting Context (Gemini)</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={toggleStreaming}
          title={isStreaming ? 'Stop Deepgram Live Audio' : 'Start Deepgram Live Audio Stream'}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition ${
            isStreaming
              ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
              : 'bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800'
          }`}
        >
          {isStreaming ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-indigo-400" />}
          <span>{isStreaming ? 'Deepgram Live' : 'Stream Mic'}</span>
        </button>
      </div>

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
