import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Layers, Check, Mic, MicOff } from 'lucide-react';

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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        if (transcript.trim()) {
          setSnippet((prev) => {
            const updated = (prev + ' ' + transcript.trim()).slice(-350);
            onUpdateContext(updated);
            return updated;
          });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onUpdateContext]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
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

        {speechSupported && (
          <button
            onClick={toggleListening}
            title={isListening ? 'Stop live audio transcription' : 'Start live audio transcription from microphone'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition ${
              isListening
                ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                : 'bg-gray-800 text-gray-300 hover:text-white border border-gray-700'
            }`}
          >
            {isListening ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-indigo-400" />}
            <span>{isListening ? 'Transcribing...' : 'Auto-listen'}</span>
          </button>
        )}
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
