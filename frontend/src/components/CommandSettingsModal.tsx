import React, { useState } from 'react';
import { useCommandStore } from '../store/useCommandStore';
import { X, RotateCcw, Plus, Save, Sliders, Check } from 'lucide-react';

interface CommandSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandSettingsModal: React.FC<CommandSettingsModalProps> = ({ isOpen, onClose }) => {
  const { commands, updateCommand, resetToDefaults } = useCommandStore();
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState<Record<string, boolean>>({});

  // Add command state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIntent, setNewIntent] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDefaultText, setNewDefaultText] = useState('');
  const [newModalities, setNewModalities] = useState<string[]>(['gesture', 'lip']);

  if (!isOpen) return null;

  const handleTextChange = (intent: string, val: string) => {
    setEditedTexts((prev) => ({ ...prev, [intent]: val }));
  };

  const handleSaveCommand = async (intent: string) => {
    const currentText = editedTexts[intent] !== undefined ? editedTexts[intent] : commands[intent]?.default_text;
    if (currentText.trim()) {
      await updateCommand(intent, currentText.trim());
      setSavedSuccess((prev) => ({ ...prev, [intent]: true }));
      setTimeout(() => {
        setSavedSuccess((prev) => ({ ...prev, [intent]: false }));
      }, 1500);
    }
  };

  const handleAddCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIntent = newIntent.trim().toUpperCase().replace(/\s+/g, '_');
    if (!cleanIntent || !newDefaultText.trim()) return;

    await updateCommand(
      cleanIntent,
      newDefaultText.trim(),
      newDisplayName.trim() || cleanIntent.replace(/_/g, ' '),
      newModalities.length > 0 ? newModalities : ['gesture', 'lip']
    );

    setNewIntent('');
    setNewDisplayName('');
    setNewDefaultText('');
    setNewModalities(['gesture', 'lip']);
    setShowAddForm(false);
  };

  const handleReset = async () => {
    if (window.confirm('Reset all custom commands and phrases back to defaults?')) {
      await resetToDefaults();
      setEditedTexts({});
    }
  };

  const toggleModality = (mod: string) => {
    if (newModalities.includes(mod)) {
      setNewModalities(newModalities.filter((m) => m !== mod));
    } else {
      setNewModalities([...newModalities, mod]);
    }
  };

  const commandList = Object.values(commands);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-[370px] max-h-[85vh] bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-gray-200">
        
        {/* Modal Header */}
        <div className="p-3.5 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">Command Settings</h2>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 font-mono">
              {commandList.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Scrollable Command List */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Customize the message sent to your meeting when you perform specific hand gestures or silent lip movements.
          </p>

          <div className="space-y-2.5">
            {commandList.map((cmd) => {
              const currentVal = editedTexts[cmd.intent] !== undefined ? editedTexts[cmd.intent] : cmd.default_text;
              const isDirty = editedTexts[cmd.intent] !== undefined && editedTexts[cmd.intent] !== cmd.default_text;
              const isSaved = savedSuccess[cmd.intent];

              return (
                <div
                  key={cmd.intent}
                  className="p-2.5 bg-gray-950/70 border border-gray-800 rounded-lg space-y-1.5 focus-within:border-indigo-500/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-200 text-[11px]">
                      {cmd.display_name}
                    </span>
                    <div className="flex items-center gap-1">
                      {cmd.supported_modalities?.map((mod) => (
                        <span
                          key={mod}
                          className="text-[9px] px-1 py-0.2 bg-gray-800/80 text-gray-400 rounded font-mono uppercase"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={currentVal}
                      onChange={(e) => handleTextChange(cmd.intent, e.target.value)}
                      placeholder="Enter custom phrase..."
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700/80 rounded text-xs text-white focus:outline-none focus:border-indigo-400 placeholder-gray-600"
                    />
                    <button
                      onClick={() => handleSaveCommand(cmd.intent)}
                      disabled={!isDirty && !isSaved}
                      className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition ${
                        isSaved
                          ? 'bg-emerald-600 text-white'
                          : isDirty
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-500 opacity-50 cursor-not-allowed'
                      }`}
                      title="Save change"
                    >
                      {isSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Custom Command Section */}
          {showAddForm ? (
            <form onSubmit={handleAddCommand} className="p-3 bg-gray-950 border border-indigo-900/60 rounded-lg space-y-2 mt-2">
              <h3 className="text-xs font-semibold text-indigo-300">Add Custom Command</h3>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Intent ID (UPPERCASE)</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. WRAP_UP"
                  value={newIntent}
                  onChange={(e) => setNewIntent(e.target.value.toUpperCase())}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-indigo-400 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Display Name</label>
                <input
                  type="text"
                  placeholder="E.g. Wrap Up"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Spoken / Staged Text</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Let's wrap up this meeting."
                  value={newDefaultText}
                  onChange={(e) => setNewDefaultText(e.target.value)}
                  className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Modalities</label>
                <div className="flex gap-2 text-[11px]">
                  {['gesture', 'lip', 'speech'].map((mod) => (
                    <label key={mod} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newModalities.includes(mod)}
                        onChange={() => toggleModality(mod)}
                        className="rounded bg-gray-900 border-gray-700 text-indigo-600 focus:ring-0"
                      />
                      <span className="capitalize">{mod}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
                >
                  Add
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 border border-dashed border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-gray-400 hover:text-indigo-300 rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Command</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-gray-800 bg-gray-950/70 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-rose-400 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-medium transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
