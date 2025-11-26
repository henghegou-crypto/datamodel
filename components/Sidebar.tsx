
import React from 'react';
import { DataModel, ModelType } from '../types';
import { Database, Folder, Plus, Trash2, Box, Network } from 'lucide-react';

interface SidebarProps {
  models: DataModel[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  onCreateModel: (type: ModelType) => void;
  onDeleteModel: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  onCreateModel,
  onDeleteModel
}) => {
  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-700 shadow-xl">
      <div className="p-4 border-b border-slate-700 flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Box size={20} className="text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Nexus</h1>
      </div>

      <div className="p-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Create New</h2>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => onCreateModel(ModelType.CONCEPTUAL)}
            className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-xs"
            title="Conceptual Model"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 mb-1"></div>
            CDM (Concept)
          </button>
          <button 
            onClick={() => onCreateModel(ModelType.LOGICAL)}
            className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-xs"
            title="Logical Model"
          >
            <div className="w-2 h-2 rounded-full bg-blue-400 mb-1"></div>
            LDM (Logical)
          </button>
          <button 
            onClick={() => onCreateModel(ModelType.PHYSICAL)}
            className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-xs"
            title="Physical Model"
          >
            <div className="w-2 h-2 rounded-full bg-purple-400 mb-1"></div>
            PDM (Physical)
          </button>
          <button 
            onClick={() => onCreateModel(ModelType.DIMENSIONAL)}
            className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors text-xs"
            title="Dimensional Model"
          >
            <div className="w-2 h-2 rounded-full bg-orange-400 mb-1"></div>
            Dim. Modeling
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <h2 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">Projects</h2>
        <div className="space-y-1">
          {models.map(model => (
            <div
              key={model.id}
              className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-all ${
                selectedModelId === model.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
              onClick={() => onSelectModel(model.id)}
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                <Database size={16} className={`shrink-0 ${
                  model.type === ModelType.PHYSICAL ? 'text-purple-400' :
                  model.type === ModelType.LOGICAL ? 'text-blue-400' : 
                  model.type === ModelType.DIMENSIONAL ? 'text-orange-400' : 'text-green-400'
                }`} />
                <div className="flex flex-col truncate">
                  <span className="text-sm font-medium truncate">{model.name}</span>
                  <span className="text-[10px] opacity-70">{model.type}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteModel(model.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-300 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {models.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No models yet.
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        v1.2.0
      </div>
    </div>
  );
};
