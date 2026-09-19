import React from 'react';
import { Header } from './components/Header';
import { DetectionCard } from './components/DetectionCard';
import { ContextDrawer } from './components/ContextDrawer';
import { CameraFeed } from './components/CameraFeed';
import { SimulationBar } from './components/SimulationBar';
import { useAssistantStore } from './store/useAssistantStore';
import { useWebSocket } from './hooks/useWebSocket';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const { history } = useAssistantStore();
  const { isConnected, simulateIntent, updateContext, detectGesture, detectLip, sendAudioChunk } = useWebSocket();

  const handleGestureDetected = React.useCallback(
    (_intent: string, landmarks: any[]) => {
      detectGesture(landmarks);
    },
    [detectGesture]
  );

  const handleLipDetected = React.useCallback(
    (landmarks: any[]) => {
      detectLip(landmarks);
    },
    [detectLip]
  );

  return (
    <div className="w-[390px] min-h-[540px] max-h-[90vh] bg-gray-950 text-gray-200 flex flex-col font-sans border border-gray-800 shadow-2xl rounded-2xl overflow-hidden">
      <Header />
      
      <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
        <CameraFeed
          onGestureDetected={handleGestureDetected}
          onLipDetected={handleLipDetected}
        />

        <ContextDrawer
          onUpdateContext={updateContext}
          onSendAudioChunk={sendAudioChunk}
          isConnected={isConnected}
        />
        
        <DetectionCard />

        <SimulationBar onSimulate={simulateIntent} isConnected={isConnected} />

        {history.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-800/80">
            <h2 className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">
              Dispatched to Meeting
            </h2>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className="p-2.5 bg-gray-900/80 border border-gray-800 rounded-lg text-xs flex justify-between items-center gap-2"
                >
                  <span className="text-gray-200 line-clamp-2">{msg.message}</span>
                  <span className="text-[10px] text-indigo-400 font-mono shrink-0 uppercase px-1.5 py-0.5 bg-indigo-950/60 rounded">
                    {msg.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 text-[10px] text-gray-600 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span>Local-first privacy: Camera frames never leave device</span>
        </div>
      </div>
    </div>
  );
};
