import React from 'react';
import { ModelVersion } from '../types';
import { History, Save, RotateCcw } from 'lucide-react';

interface VersionControlProps {
  versions: ModelVersion[];
  currentVersionId: string | null;
  onSaveVersion: (name: string) => void;
  onRestoreVersion: (version: ModelVersion) => void;
}

export const VersionControl: React.FC<VersionControlProps> = ({
  versions,
  currentVersionId,
  onSaveVersion,
  onRestoreVersion
}) => {
  const [newVersionName, setNewVersionName] = React.useState('');

  const handleSave = () => {
    if (!newVersionName.trim()) return;
    onSaveVersion(newVersionName);
    setNewVersionName('');
  };

  return (
    <div className="w-72 border-l border-slate-200 bg-white h-screen flex flex-col shadow-lg z-20">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <History size={18} />
          Version Control
        </h3>
      </div>
      
      <div className="p-4 border-b border-slate-200">
        <label className="text-xs font-medium text-slate-500 uppercase">Save Snapshot</label>
        <div className="mt-2 flex gap-2">
          <input 
            type="text" 
            placeholder="v1.0 - Initial Design"
            className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
          />
          <button 
            onClick={handleSave}
            disabled={!newVersionName}
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {versions.length === 0 && <p className="text-slate-400 text-sm text-center italic mt-10">No versions saved yet.</p>}
        {[...versions].reverse().map(ver => (
          <div key={ver.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow bg-slate-50">
            <div className="flex justify-between items-start mb-2">
              <span className="font-medium text-sm text-slate-800">{ver.name}</span>
              <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                {new Date(ver.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              {new Date(ver.timestamp).toLocaleDateString()} • {ver.data.entities.length} Entities
            </div>
            <button 
              onClick={() => onRestoreVersion(ver)}
              className="w-full flex items-center justify-center gap-2 text-xs bg-white border border-slate-300 text-slate-700 py-1.5 rounded hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <RotateCcw size={12} />
              Restore this version
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};