import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { VersionControl } from './components/VersionControl';
import { AttributeEditor } from './components/AttributeEditor';
import { MaterializeModal } from './components/MaterializeModal';
import { EntityList } from './components/EntityList';
import { DataModel, ModelType, EntityNode, Relationship, ModelVersion, Attribute } from './types';
import { PanelRightClose, PanelRightOpen, Share2, Sparkles, Database, FileImage, FileText, Link, List, LayoutGrid, Undo2, Loader2, Cloud } from 'lucide-react';
import { explainModel } from './services/geminiService';
import { api, generateId } from './services/api'; // Import API service
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// History type
interface HistoryState {
  modelId: string;
  data: DataModel; // Snapshot of the whole model
}

const App: React.FC = () => {
  const [models, setModels] = useState<DataModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'list'>('diagram');
  const [isShareOpen, setIsShareOpen] = useState(false);
  
  // Async States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Debounce Ref for auto-saving
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track latest state for async operations to avoid stale closures if needed
  const modelsRef = useRef(models); 
  modelsRef.current = models;

  // Undo/Redo History
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);

  // Modal States
  const [editingEntity, setEditingEntity] = useState<EntityNode | null>(null);
  const [initialEditTab, setInitialEditTab] = useState<'basic' | 'fields'>('basic');
  const [isMaterializeOpen, setIsMaterializeOpen] = useState(false);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await api.fetchModels();
        setModels(data);
        if (data.length > 0 && !selectedModelId) {
          // Check URL for shared data or default to first
          const params = new URLSearchParams(window.location.search);
          const sharedData = params.get('data');
          if (!sharedData) {
            setSelectedModelId(data[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to load models:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Check for shared model in URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('data');
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData));
        const sharedModel: DataModel = {
          ...decoded,
          id: 'shared-' + Date.now(),
          name: decoded.name + ' (Shared)',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        // We add it to local state, but maybe ask user to save it?
        // For now, treat it as a temporary loaded model
        setModels(prev => [...prev, sharedModel]);
        setSelectedModelId(sharedModel.id);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error("Failed to load shared model", e);
      }
    }
  }, []);

  const selectedModel = models.find(m => m.id === selectedModelId);

  useEffect(() => {
    if (selectedModel) {
      setAiExplanation(null);
    }
  }, [selectedModelId]);

  // Keyboard listener for Undo (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, selectedModelId]);

  const pushToHistory = (model: DataModel) => {
    setHistoryStack(prev => {
        const newStack = [...prev, { modelId: model.id, data: JSON.parse(JSON.stringify(model)) }];
        if (newStack.length > 20) return newStack.slice(newStack.length - 20);
        return newStack;
    });
  };

  const handleUndo = () => {
    if (!selectedModelId || historyStack.length === 0) return;
    
    const lastState = historyStack[historyStack.length - 1];
    if (lastState.modelId === selectedModelId) {
        // Optimistic restore
        setModels(prev => prev.map(m => m.id === selectedModelId ? lastState.data : m));
        setHistoryStack(prev => prev.slice(0, prev.length - 1));
        
        // Async Sync
        triggerSave(selectedModelId, lastState.data);
    }
  };

  const triggerSave = useCallback((modelId: string, data: Partial<DataModel>) => {
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      saveTimeoutRef.current = setTimeout(async () => {
         try {
            await api.updateModel(modelId, data);
         } catch(e) {
            console.error("Auto-save failed", e);
            // Optionally revert UI here
         } finally {
            setIsSaving(false);
         }
      }, 1000); // 1s Debounce for API calls
  }, []);

  const handleCreateModel = async (type: ModelType) => {
    const newModel: DataModel = {
      id: generateId(),
      name: `New ${type} Model`,
      description: '',
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entities: [],
      relationships: [],
      versions: []
    };
    
    // Optimistic UI
    setModels(prev => [...prev, newModel]);
    setSelectedModelId(newModel.id);
    
    // API Call
    setIsSaving(true);
    try {
      await api.createModel(newModel);
    } catch(e) {
       console.error("Create failed", e);
       setModels(prev => prev.filter(m => m.id !== newModel.id)); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if(!confirm("Are you sure you want to delete this model?")) return;

    // Optimistic UI
    const prevModels = [...models];
    setModels(prev => prev.filter(m => m.id !== id));
    if (selectedModelId === id) setSelectedModelId(null);
    
    // API Call
    setIsSaving(true);
    try {
      await api.deleteModel(id);
    } catch(e) {
       console.error("Delete failed", e);
       setModels(prevModels); // Revert
       alert("Failed to delete model on server.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSelectedModel = (updates: Partial<DataModel>, saveHistory = true) => {
    if (!selectedModelId) return;

    setModels(prevModels => {
        const currentModel = prevModels.find(m => m.id === selectedModelId);
        if (!currentModel) return prevModels;
        
        if (saveHistory) {
            // We can't call setState inside setState easily for history, so we might need a ref or effect
            // But strict mode double invokes. 
            // Better to push history before calling updateSelectedModel in event handlers, OR
            // just accept that we use current state here.
            // For simplicity in this structure:
        }

        const updatedModel = { ...currentModel, ...updates, updatedAt: Date.now() };
        
        // Trigger background save
        // We use the 'updatedModel' data which is computed inside the setState callback
        // This avoids dependency on stale 'models' closure
        triggerSave(selectedModelId, updates);
        
        return prevModels.map(m => m.id === selectedModelId ? updatedModel : m);
    });
    
    // Handle history outside the setModels to avoid side-effects in render phase (though event handlers are fine)
    if (saveHistory && selectedModel) {
        pushToHistory(selectedModel);
    }
  };

  const handleSaveAttributes = (entityId: string, attributes: Attribute[], metadata: Partial<EntityNode>) => {
    setModels(prevModels => {
      const model = prevModels.find(m => m.id === selectedModelId);
      if(!model) return prevModels;
      
      const updatedEntities = model.entities.map(ent => 
        ent.id === entityId ? { ...ent, ...metadata, attributes } : ent
      );
      
      const newModel = { ...model, entities: updatedEntities };
      triggerSave(model.id, { entities: updatedEntities });
      return prevModels.map(m => m.id === selectedModelId ? newModel : m);
    });
  };

  const handleSaveVersion = async (name: string) => {
    if (!selectedModel) return;
    const newVersion: ModelVersion = {
      id: generateId(),
      timestamp: Date.now(),
      name,
      data: {
        entities: JSON.parse(JSON.stringify(selectedModel.entities)),
        relationships: JSON.parse(JSON.stringify(selectedModel.relationships))
      }
    };
    
    const newVersions = [...selectedModel.versions, newVersion];
    
    // Update local
    setModels(prev => prev.map(m => m.id === selectedModelId ? { ...m, versions: newVersions } : m));
    
    // Save to API
    setIsSaving(true);
    try {
       await api.updateModel(selectedModel.id, { versions: newVersions });
    } finally {
       setIsSaving(false);
    }
  };

  const handleRestoreVersion = (version: ModelVersion) => {
    if (!selectedModel) return;
    if (confirm(`Restore version "${version.name}"? Unsaved changes will be lost.`)) {
      updateSelectedModel({
        entities: version.data.entities,
        relationships: version.data.relationships
      });
    }
  };

  const handleGetExplanation = async () => {
    if (!selectedModel) return;
    const text = await explainModel(selectedModel.name, selectedModel.entities);
    setAiExplanation(text);
  };

  const handleExportImage = async () => {
    const element = document.getElementById('nexus-canvas');
    if (element) {
      const canvas = await html2canvas(element);
      const data = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = data;
      link.download = `${selectedModel?.name || 'model'}.png`;
      link.click();
    }
  };

  const handleExportPDF = async () => {
     const element = document.getElementById('nexus-canvas');
     if (element) {
       const canvas = await html2canvas(element);
       const imgData = canvas.toDataURL('image/png');
       const pdf = new jsPDF({ orientation: 'landscape' });
       const imgProps = pdf.getImageProperties(imgData);
       const pdfWidth = pdf.internal.pageSize.getWidth();
       const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
       pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
       pdf.save(`${selectedModel?.name || 'model'}.pdf`);
     }
  };

  const handleShare = () => {
    if (!selectedModel) return;
    const data = btoa(JSON.stringify(selectedModel));
    const url = `${window.location.origin}${window.location.pathname}?data=${data}`;
    navigator.clipboard.writeText(url);
    setIsShareOpen(true);
    setTimeout(() => setIsShareOpen(false), 2000);
  };

  const handleAutoLayout = () => {
    if (!selectedModel) return;

    // Simple Hierarchical Layout Algorithm
    const entities = [...selectedModel.entities];
    const rels = selectedModel.relationships;
    
    const levels: Record<string, number> = {};
    const inDegree: Record<string, number> = {};
    
    entities.forEach(e => { levels[e.id] = 0; inDegree[e.id] = 0; });
    rels.forEach(r => {
      inDegree[r.targetId] = (inDegree[r.targetId] || 0) + 1;
    });

    const queue = entities.filter(e => inDegree[e.id] === 0).map(e => e.id);
    const visited = new Set<string>();
    
    while(queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const outgoing = rels.filter(r => r.sourceId === currentId);
      outgoing.forEach(r => {
         levels[r.targetId] = Math.max(levels[r.targetId] || 0, (levels[currentId] || 0) + 1);
         queue.push(r.targetId);
      });
    }

    const nodesByLevel: Record<number, EntityNode[]> = {};
    entities.forEach(e => {
       const lvl = levels[e.id] || 0;
       if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
       nodesByLevel[lvl].push(e);
    });

    const LEVEL_WIDTH = 350;
    const LEVEL_HEIGHT = 200;
    const newEntities = entities.map(e => {
       const lvl = levels[e.id] || 0;
       const indexInLevel = nodesByLevel[lvl].indexOf(e);
       return {
         ...e,
         x: 100 + (lvl * LEVEL_WIDTH),
         y: 100 + (indexInLevel * LEVEL_HEIGHT)
       };
    });

    updateSelectedModel({ entities: newEntities });
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 size={48} className="animate-spin mb-4 text-blue-500"/>
        <h2 className="text-xl font-semibold">Loading Nexus...</h2>
        <p className="text-sm mt-2">Connecting to model service</p>
      </div>
    );
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <Sidebar 
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
        onCreateModel={handleCreateModel}
        onDeleteModel={handleDeleteModel}
      />

      <div className="flex-1 flex flex-col relative h-full">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10">
          <div className="flex items-center space-x-4">
             {selectedModel ? (
               <>
                 <h2 className="font-bold text-slate-800">{selectedModel.name}</h2>
                 <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide ${
                   selectedModel.type === 'Physical' ? 'bg-purple-100 text-purple-600' : 
                   selectedModel.type === 'Logical' ? 'bg-blue-100 text-blue-600' : 
                   selectedModel.type === 'Conceptual' ? 'bg-green-100 text-green-600' : 
                   selectedModel.type === 'Dimensional' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100'
                 }`}>
                   {selectedModel.type}
                 </span>
                 {isSaving && (
                   <span className="flex items-center text-xs text-slate-400 animate-pulse">
                     <Cloud size={12} className="mr-1"/> Saving...
                   </span>
                 )}
               </>
             ) : (
               <span className="text-slate-400">Select or create a model</span>
             )}
          </div>
          
          {selectedModel && (
            <div className="flex items-center space-x-2">
              <button 
                  onClick={handleUndo} 
                  disabled={historyStack.length === 0}
                  className="p-2 hover:bg-slate-100 rounded-md text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent" 
                  title="Undo (Ctrl+Z)"
              >
                  <Undo2 size={18}/>
              </button>

              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              {/* View Toggles */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
                 <button 
                   onClick={() => setViewMode('diagram')}
                   className={`p-1.5 rounded-md transition-all ${viewMode === 'diagram' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   title="Diagram View"
                 >
                   <LayoutGrid size={16} />
                 </button>
                 <button 
                   onClick={() => setViewMode('list')}
                   className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   title="Table View"
                 >
                   <List size={16} />
                 </button>
              </div>

               {/* Tools */}
              {(selectedModel.type === ModelType.LOGICAL || selectedModel.type === ModelType.PHYSICAL || selectedModel.type === ModelType.DIMENSIONAL) && (
                <button 
                  onClick={() => setIsMaterializeOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-sm"
                >
                   <Database size={14} /> Materialize
                </button>
              )}

              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              {/* Export/Share */}
              <div className="flex items-center space-x-1">
                 <button onClick={handleExportImage} className="p-2 hover:bg-slate-100 rounded-md text-slate-600" title="Export as PNG">
                   <FileImage size={18} />
                 </button>
                 <button onClick={handleExportPDF} className="p-2 hover:bg-slate-100 rounded-md text-slate-600" title="Export as PDF">
                   <FileText size={18} />
                 </button>
                 <button onClick={handleShare} className="p-2 hover:bg-slate-100 rounded-md text-slate-600 relative" title="Share Link">
                   <Link size={18} />
                   {isShareOpen && (
                     <div className="absolute top-full right-0 mt-2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                       Link copied!
                     </div>
                   )}
                 </button>
              </div>

              <div className="h-6 w-px bg-slate-200 mx-2"></div>

              {aiExplanation && (
                <div className="hidden md:flex items-center mr-2 bg-purple-50 text-purple-700 px-3 py-1 rounded text-xs max-w-xs truncate border border-purple-100">
                  <Sparkles size={12} className="mr-2"/>
                  {aiExplanation}
                </div>
              )}

              <button 
                onClick={handleGetExplanation}
                className="p-2 hover:bg-purple-100 rounded-md text-purple-600"
                title="AI Explain"
              >
                 <Sparkles size={18} />
              </button>

              <button 
                onClick={() => setShowVersions(!showVersions)}
                className={`p-2 rounded-md transition-colors ${showVersions ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100 text-slate-500'}`}
                title="Version History"
              >
                {showVersions ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>
            </div>
          )}
        </header>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          {selectedModel ? (
            viewMode === 'diagram' ? (
              <Canvas 
                modelType={selectedModel.type}
                entities={selectedModel.entities}
                relationships={selectedModel.relationships}
                onEntitiesChange={(ents) => updateSelectedModel({ entities: ents })}
                onRelationshipsChange={(rels) => updateSelectedModel({ relationships: rels })}
                onEditAttributes={(ent, tab) => {
                  setEditingEntity(ent);
                  setInitialEditTab(tab || 'basic');
                }}
                onAutoLayout={handleAutoLayout}
              />
            ) : (
              <div className="w-full h-full overflow-auto">
                 <EntityList 
                    modelType={selectedModel.type} 
                    entities={selectedModel.entities} 
                    onEditEntity={setEditingEntity}
                 />
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <Share2 size={32} className="text-slate-400" />
              </div>
              <p>Select a model to start designing</p>
            </div>
          )}

          {/* Right Panel: Versions */}
          {showVersions && selectedModel && (
            <VersionControl 
              versions={selectedModel.versions}
              currentVersionId={null}
              onSaveVersion={handleSaveVersion}
              onRestoreVersion={handleRestoreVersion}
            />
          )}
        </div>

        {/* Modals */}
        {editingEntity && selectedModel && (
          <AttributeEditor 
            entity={editingEntity}
            modelType={selectedModel.type}
            relationships={selectedModel.relationships}
            allEntities={selectedModel.entities}
            isOpen={true}
            initialTab={initialEditTab}
            onClose={() => setEditingEntity(null)}
            onSave={handleSaveAttributes}
          />
        )}

        {selectedModel && (
          <MaterializeModal 
            isOpen={isMaterializeOpen}
            onClose={() => setIsMaterializeOpen(false)}
            modelType={selectedModel.type}
            entities={selectedModel.entities}
            relationships={selectedModel.relationships}
          />
        )}
      </div>
    </div>
  );
};

export default App;
