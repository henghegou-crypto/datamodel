
import React, { useState, useEffect } from 'react';
import { EntityNode, Relationship, DatabaseType, ModelType } from '../types';
import { generateDDL } from '../services/sqlGenerator';
import { X, Database, Copy, Check, Settings, Code, Terminal, Play, Loader2, CheckCircle, ArrowRight, ArrowLeft, ChevronRight, ChevronDown, Key } from 'lucide-react';

interface MaterializeModalProps {
  modelType: ModelType;
  entities: EntityNode[];
  relationships: Relationship[];
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'config' | 'preview' | 'execute';

export const MaterializeModal: React.FC<MaterializeModalProps> = ({
  modelType,
  entities,
  relationships,
  isOpen,
  onClose
}) => {
  const [step, setStep] = useState<Step>('config');
  const [dbType, setDbType] = useState<DatabaseType>(DatabaseType.POSTGRESQL);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [expandedEntityIds, setExpandedEntityIds] = useState<Set<string>>(new Set());
  const [generatedSql, setGeneratedSql] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Execution Simulation State
  const [logs, setLogs] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setSelectedEntityIds(new Set(entities.map(e => e.id))); // Select all by default
      setExpandedEntityIds(new Set());
      setLogs([]);
      setIsExecuting(false);
      setIsSuccess(false);
    }
  }, [isOpen, entities]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 'config') {
       // Generate SQL based on selection
       const selectedEntities = entities.filter(e => selectedEntityIds.has(e.id));
       const relevantRels = relationships.filter(r => 
         selectedEntityIds.has(r.sourceId) && selectedEntityIds.has(r.targetId)
       );
       const sql = generateDDL(selectedEntities, relevantRels, dbType, modelType);
       setGeneratedSql(sql);
       setStep('preview');
    } else if (step === 'preview') {
       setStep('execute');
       runSimulation();
    }
  };

  const handleBack = () => {
    if (step === 'preview') setStep('config');
    if (step === 'execute') setStep('preview');
  };

  const toggleEntitySelection = (id: string) => {
    const newSet = new Set(selectedEntityIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEntityIds(newSet);
  };

  const toggleEntityExpansion = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedEntityIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedEntityIds(newSet);
  };

  const toggleAll = () => {
    if (selectedEntityIds.size === entities.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(entities.map(e => e.id)));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runSimulation = () => {
    setIsExecuting(true);
    setLogs(['> Initializing connection to ' + dbType + '...']);
    setIsSuccess(false);

    const steps = [
      'Connected successfully.',
      'Checking schema compatibility...',
      'Starting transaction...',
      ...entities.filter(e => selectedEntityIds.has(e.id)).map(e => `Creating table ${e.name}... OK`),
      'Applying foreign keys...',
      'Committing transaction...',
      'Materialization complete.'
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i >= steps.length) {
        clearInterval(interval);
        setIsExecuting(false);
        setIsSuccess(true);
        return;
      }
      setLogs(prev => [...prev, '> ' + steps[i]]);
      i++;
    }, 400); // Faster simulation
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg text-white ${step === 'execute' && isSuccess ? 'bg-green-500' : 'bg-blue-600'}`}>
               <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Materialize to Database</h3>
              <p className="text-xs text-slate-500">Deploy {modelType} model to SQL environment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="flex items-center justify-center max-w-2xl mx-auto">
             <div className={`flex flex-col items-center relative z-10 ${step === 'config' ? 'text-blue-600' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${step === 'config' ? 'bg-white border-blue-600' : (step === 'preview' || step === 'execute' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white')}`}>
                   {step === 'preview' || step === 'execute' ? <Check size={16}/> : '1'}
                </div>
                <span className="text-xs font-medium mt-1">Configure</span>
             </div>
             <div className={`flex-1 h-0.5 mx-2 ${step === 'preview' || step === 'execute' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
             
             <div className={`flex flex-col items-center relative z-10 ${step === 'preview' ? 'text-blue-600' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${step === 'preview' ? 'bg-white border-blue-600' : (step === 'execute' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white')}`}>
                   {step === 'execute' ? <Check size={16}/> : '2'}
                </div>
                <span className="text-xs font-medium mt-1">Review SQL</span>
             </div>
             <div className={`flex-1 h-0.5 mx-2 ${step === 'execute' ? 'bg-blue-600' : 'bg-slate-300'}`}></div>

             <div className={`flex flex-col items-center relative z-10 ${step === 'execute' ? 'text-blue-600' : 'text-slate-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${step === 'execute' ? 'bg-white border-blue-600' : 'border-slate-300 bg-white'}`}>
                   3
                </div>
                <span className="text-xs font-medium mt-1">Execute</span>
             </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative bg-white">
            
            {/* Step 1: Config */}
            {step === 'config' && (
              <div className="h-full flex flex-col p-6 animate-in fade-in slide-in-from-right-4">
                  <div className="mb-6">
                    <label className="text-sm font-bold text-slate-700 block mb-2">Target Database Engine</label>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { id: DatabaseType.POSTGRESQL, label: 'PostgreSQL', icon: '🐘' },
                        { id: DatabaseType.MYSQL, label: 'MySQL', icon: '🐬' },
                        { id: DatabaseType.ORACLE, label: 'Oracle', icon: '🔴' },
                        { id: DatabaseType.SQLSERVER, label: 'SQL Server', icon: '🏢' },
                        { id: DatabaseType.HIVE, label: 'Apache Hive', icon: '🐝' },
                        { id: DatabaseType.DAMENG, label: 'Dameng', icon: '🐉' },
                        { id: DatabaseType.KINGBASE, label: 'Kingbase', icon: '👑' },
                        { id: DatabaseType.GAUSSDB, label: 'GaussDB', icon: '📊' }
                      ].map(db => (
                        <div 
                          key={db.id}
                          onClick={() => setDbType(db.id)}
                          className={`cursor-pointer border-2 rounded-lg p-3 flex flex-col items-center gap-1 transition-all ${dbType === db.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                          <span className="text-xl">{db.icon}</span>
                          <span className="font-medium text-xs whitespace-nowrap">{db.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 border rounded-lg overflow-hidden">
                     <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                        <span className="font-bold text-sm text-slate-700">Select Entities to Materialize</span>
                        <button onClick={toggleAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {selectedEntityIds.size === entities.length ? 'Deselect All' : 'Select All'}
                        </button>
                     </div>
                     <div className="overflow-y-auto flex-1 p-2 space-y-2 bg-slate-50/50">
                        {entities.map(ent => {
                           const isSelected = selectedEntityIds.has(ent.id);
                           const isExpanded = expandedEntityIds.has(ent.id);
                           return (
                             <div key={ent.id} className={`border rounded-md bg-white transition-all ${isSelected ? 'border-blue-300 shadow-sm' : 'border-slate-200'}`}>
                               <div 
                                 onClick={() => toggleEntitySelection(ent.id)}
                                 className="flex items-center p-3 cursor-pointer hover:bg-slate-50 rounded-t-md"
                               >
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                     {isSelected && <Check size={14} className="text-white"/>}
                                  </div>
                                  <div className="flex-1">
                                     <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                                         {ent.name}
                                         <span className="text-xs font-normal text-slate-400 bg-slate-100 px-1.5 rounded">{ent.type}</span>
                                     </div>
                                     <div className="text-xs text-slate-500">
                                       {ent.chineseName || 'No alias'} • {ent.attributes.length} columns
                                     </div>
                                  </div>
                                  <button 
                                      onClick={(e) => toggleEntityExpansion(ent.id, e)}
                                      className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400"
                                  >
                                      {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                  </button>
                               </div>

                               {isExpanded && (
                                   <div className="border-t border-slate-100 bg-slate-50/50 p-3 animate-in slide-in-from-top-1">
                                       <table className="w-full text-xs text-left">
                                           <thead className="text-slate-500 border-b border-slate-200">
                                               <tr>
                                                   <th className="pb-2 w-8">PK</th>
                                                   <th className="pb-2">Name</th>
                                                   <th className="pb-2">Type</th>
                                                   <th className="pb-2 text-slate-400">Comment</th>
                                               </tr>
                                           </thead>
                                           <tbody className="divide-y divide-slate-100">
                                               {ent.attributes.map(attr => (
                                                   <tr key={attr.id}>
                                                       <td className="py-1.5 text-center">
                                                           {attr.isPrimaryKey && <Key size={10} className="text-yellow-600 inline"/>}
                                                       </td>
                                                       <td className="py-1.5 font-medium text-slate-700">{attr.name}</td>
                                                       <td className="py-1.5 font-mono text-purple-600">{attr.dataType}</td>
                                                       <td className="py-1.5 text-slate-500">{attr.comment || '-'}</td>
                                                   </tr>
                                               ))}
                                               {ent.attributes.length === 0 && (
                                                   <tr><td colSpan={4} className="py-2 text-center text-slate-400 italic">No attributes</td></tr>
                                               )}
                                           </tbody>
                                       </table>
                                   </div>
                               )}
                             </div>
                           );
                        })}
                     </div>
                  </div>
              </div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && (
              <div className="h-full flex flex-col p-0 relative animate-in fade-in slide-in-from-right-4">
                  <div className="absolute top-0 right-0 p-4 z-10">
                    <button 
                      onClick={handleCopy}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur text-slate-300 hover:text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-all border border-white/10"
                    >
                      {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14}/>}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 bg-[#1e1e1e] overflow-auto">
                    <textarea 
                      className="w-full h-full p-6 font-mono text-sm bg-[#1e1e1e] text-blue-100 resize-none focus:outline-none leading-relaxed"
                      readOnly
                      value={generatedSql}
                    />
                  </div>
              </div>
            )}

            {/* Step 3: Execute */}
            {step === 'execute' && (
               <div className="h-full flex flex-col p-6 bg-slate-900 text-green-400 font-mono text-sm animate-in fade-in slide-in-from-right-4">
                  <div className="flex-1 overflow-y-auto space-y-1 p-2">
                     {logs.map((log, i) => (
                       <div key={i} className="break-all opacity-90">{log}</div>
                     ))}
                     {isExecuting && (
                        <div className="flex items-center gap-2 mt-2 opacity-70">
                           <Loader2 size={14} className="animate-spin"/> Processing...
                        </div>
                     )}
                     {isSuccess && (
                        <div className="mt-4 p-4 border border-green-500/30 bg-green-500/10 rounded text-green-300 flex items-center gap-3">
                           <CheckCircle size={20} className="text-green-400"/>
                           <div>
                              <div className="font-bold">Execution Successful</div>
                              <div className="text-xs opacity-70">All tables and constraints have been applied to {dbType}.</div>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center">
            <div>
               {step !== 'config' && step !== 'execute' && (
                 <button onClick={handleBack} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium flex items-center gap-1">
                   <ArrowLeft size={16}/> Back
                 </button>
               )}
            </div>
            
            <div className="flex gap-2">
              {step === 'execute' && isSuccess ? (
                 <button onClick={onClose} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow-sm text-sm font-medium">
                   Finish
                 </button>
              ) : step === 'execute' ? (
                 <button disabled className="px-6 py-2 bg-slate-100 text-slate-400 rounded text-sm font-medium flex items-center gap-2 cursor-wait">
                   <Loader2 size={16} className="animate-spin"/> Executing...
                 </button>
              ) : (
                <>
                  <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded text-sm font-medium">
                    Cancel
                  </button>
                  <button 
                    onClick={handleNext} 
                    disabled={step === 'config' && selectedEntityIds.size === 0}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {step === 'config' ? (
                      <>Next <ArrowRight size={16}/></>
                    ) : (
                      <>Start Materialization <Play size={16}/></>
                    )}
                  </button>
                </>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};
