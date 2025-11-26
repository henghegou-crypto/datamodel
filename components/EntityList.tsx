
import React, { useState, useMemo, useEffect } from 'react';
import { EntityNode, Attribute, ModelType } from '../types';
import { Key, Table, Database, Edit, Search, ChevronRight, ChevronDown, Cuboid, ChevronsDown, ChevronsUp, FileText } from 'lucide-react';

interface EntityListProps {
  modelType: ModelType;
  entities: EntityNode[];
  onEditEntity: (entity: EntityNode) => void;
}

// Helper to highlight text based on search term
const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight || !text) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 text-slate-900 font-semibold rounded px-0.5 border border-yellow-300">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export const EntityList: React.FC<EntityListProps> = ({ modelType, entities, onEditEntity }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Filter logic: Match Entity Name, Chinese Name, or Attribute Names
  const filteredEntities = useMemo(() => {
    if (!searchTerm.trim()) return entities;
    const lower = searchTerm.toLowerCase();
    return entities.filter(e => {
      const matchEntity = e.name.toLowerCase().includes(lower) || (e.chineseName || '').toLowerCase().includes(lower);
      const matchAttr = e.attributes.some(a => a.name.toLowerCase().includes(lower) || (a.comment || '').toLowerCase().includes(lower));
      return matchEntity || matchAttr;
    });
  }, [entities, searchTerm]);

  // Effect: Auto-expand entities that match the search term
  useEffect(() => {
    if (searchTerm.trim()) {
      const newExpanded = new Set<string>();
      filteredEntities.forEach(e => newExpanded.add(e.id));
      setExpandedIds(newExpanded);
    } else {
      setExpandedIds(new Set()); // Collapse all when clearing search
    }
  }, [searchTerm]); // Deliberately dependent on searchTerm string changes to trigger auto-expand logic

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const expandAll = () => {
    const allIds = new Set(filteredEntities.map(e => e.id));
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Sticky Header with Search and Controls */}
      <div className="p-6 pb-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {modelType === ModelType.DIMENSIONAL ? <Cuboid className="text-indigo-600"/> : modelType === ModelType.PHYSICAL ? <Table className="text-slate-600"/> : <Database className="text-blue-600"/>}
            {modelType} Entities Dictionary
            <span className="ml-2 text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {filteredEntities.length} / {entities.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
             <button 
               onClick={expandAll} 
               className="p-2 text-slate-500 hover:bg-slate-100 rounded-md border border-transparent hover:border-slate-200 transition-colors" 
               title="Expand All"
             >
               <ChevronsDown size={18}/>
             </button>
             <button 
               onClick={collapseAll} 
               className="p-2 text-slate-500 hover:bg-slate-100 rounded-md border border-transparent hover:border-slate-200 transition-colors" 
               title="Collapse All"
             >
               <ChevronsUp size={18}/>
             </button>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search tables or columns (e.g., 'user', 'order_id')..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Accordion List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredEntities.map(entity => {
          const isExpanded = expandedIds.has(entity.id);
          const hasMatch = searchTerm && (
              entity.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              (entity.chineseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              entity.attributes.some(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
          );
          
          // Determine Header Style based on type
          let headerBorderClass = 'border-slate-200';
          let activeBorderClass = hasMatch ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-300 ring-1 ring-slate-200';
          
          return (
            <div 
              key={entity.id} 
              className={`bg-white rounded-lg border transition-all duration-200 ${isExpanded || hasMatch ? activeBorderClass : headerBorderClass} ${hasMatch ? 'shadow-md' : 'shadow-sm'}`}
            >
              {/* Accordion Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-lg select-none"
                onClick={() => toggleExpand(entity.id)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-1 rounded-md text-slate-400 hover:bg-slate-200 transition-all duration-200 ${isExpanded ? 'rotate-90 text-slate-600' : ''}`}>
                    <ChevronRight size={20} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 truncate">
                       <HighlightText text={entity.name} highlight={searchTerm} />
                       {entity.tableType === 'fact' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-indigo-200">Fact</span>}
                       {entity.tableType === 'dimension' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-200">Dim</span>}
                    </h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex gap-2 items-center truncate">
                       {entity.chineseName && (
                         <>
                           <span><HighlightText text={entity.chineseName} highlight={searchTerm} /></span>
                           <span className="text-slate-300">|</span>
                         </>
                       )}
                       <span className="flex items-center gap-1"><FileText size={10}/> {entity.attributes.length} fields</span>
                       <span className="text-slate-300">|</span>
                       <span className="italic">{entity.layer || 'ODS'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pl-4 shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditEntity(entity); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                  >
                    <Edit size={14} /> Edit
                  </button>
                </div>
              </div>
              
              {/* Accordion Body (Fields Table) */}
              {isExpanded && (
                <div className="border-t border-slate-100 animate-in slide-in-from-top-2 duration-200 origin-top">
                   <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-2.5 font-semibold w-12 text-center">#</th>
                                <th className="px-6 py-2.5 font-semibold w-16">Key</th>
                                <th className="px-6 py-2.5 font-semibold">Field Name</th>
                                <th className="px-6 py-2.5 font-semibold">Type</th>
                                <th className="px-6 py-2.5 font-semibold w-24">Nullable</th>
                                <th className="px-6 py-2.5 font-semibold">Comment</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {entity.attributes.map((attr, idx) => {
                                const isAttrMatch = searchTerm && (
                                  attr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  (attr.comment || '').toLowerCase().includes(searchTerm.toLowerCase())
                                );
                                return (
                                <tr key={attr.id} className={`group hover:bg-slate-50 transition-colors ${isAttrMatch ? 'bg-yellow-50/60' : ''}`}>
                                    <td className="px-6 py-2.5 text-slate-400 text-xs text-center font-mono">{idx + 1}</td>
                                    <td className="px-6 py-2.5">
                                        {attr.isPrimaryKey && <span title="Primary Key"><Key size={14} className="text-yellow-600" /></span>}
                                        {attr.isForeignKey && <span title="Foreign Key"><Key size={14} className="text-slate-400" /></span>}
                                    </td>
                                    <td className="px-6 py-2.5 font-medium text-slate-700">
                                        <HighlightText text={attr.name} highlight={searchTerm} />
                                    </td>
                                    <td className="px-6 py-2.5 font-mono text-purple-600 text-xs">{attr.dataType}</td>
                                    <td className="px-6 py-2.5 text-slate-500 text-xs">
                                      {attr.isNullable ? (
                                        <span className="text-slate-400">Yes</span>
                                      ) : (
                                        <span className="text-red-500 font-medium">No</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-2.5 text-slate-500 text-xs">
                                      {attr.comment ? <HighlightText text={attr.comment} highlight={searchTerm} /> : <span className="text-slate-300 italic">-</span>}
                                    </td>
                                </tr>
                                );
                            })}
                            {entity.attributes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic text-sm">No columns defined for this entity.</td>
                            </tr>
                            )}
                        </tbody>
                    </table>
                   </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredEntities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Search size={48} className="text-slate-200 mb-4"/>
            <p className="text-lg font-medium text-slate-500">No matching entities found</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
};
