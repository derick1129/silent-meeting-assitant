import React from 'react';
import { Header } from './components/Header';
import { DetectionCard } from './components/DetectionCard';
import { useAssistantStore } from './store/useAssistantStore';

export const App: React.FC = () => {
  const { history } = useAssistantStore();

  return (
    <div className="w-96 min-h-[480px] bg-black text-gray-200 flex flex-col font-sans border border-gray-800 shadow-2xl rounded-2xl overflow-hidden">
      <Header />
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <DetectionCard />

        {history.length > 0 && (
          <div className="space-y-2 pt-2">
            <h2 className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider">Recent Activity</h2>
            <div className="space-y-1.5">
              {history.map((msg) => (
                <div key={msg.id} className="p-2.5 bg-gray-900/80 border border-gray-800 rounded-lg text-xs flex justify-between items-center">
                  <span className="text-gray-200">{msg.message}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{msg.source}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
