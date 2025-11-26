
import React, { useState, useEffect, useMemo } from 'react';
import { Attribute, EntityNode, DbIndex, DbPartition, ModelType, Relationship } from '../types';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save, BookOpen, Search, Folder, FolderOpen, ChevronRight, ChevronDown, CheckSquare, Square, Filter, Database, Share2, Layers } from 'lucide-react';

// Safe ID generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

interface AttributeEditorProps {
  entity: EntityNode;
  modelType: ModelType;
  relationships?: Relationship[]; // Passed for Dimensional view
  allEntities?: EntityNode[]; // Passed to resolve relationship names
  isOpen: boolean;
  initialTab?: 'basic' | 'fields';
  onClose: () => void;
  onSave: (entityId: string, attributes: Attribute[], metadata: Partial<EntityNode>) => void;
}

// --- Mock Data: Standard Categories (Tree Structure) ---
interface StandardCategory {
  id: string;
  name: string;
  parentId: string | null;
}

const STANDARD_CATEGORIES: StandardCategory[] = [
  { id: 'root', name: 'Standard Library', parentId: null },
  { id: 'biz', name: 'Business Domain', parentId: 'root' },
  { id: 'person', name: 'Personnel Info', parentId: 'biz' },
  { id: 'finance', name: 'Finance & Accounting', parentId: 'biz' },
  { id: 'product', name: 'Product Data', parentId: 'biz' },
  { id: 'tech', name: 'Technical', parentId: 'root' },
  { id: 'meta', name: 'Metadata', parentId: 'tech' },
  { id: 'audit', name: 'Audit Fields', parentId: 'tech' },
];

// --- Mock Data: Data Standards ---
interface DataStandard {
  code: string;
  name: string;
  dataType: string;
  comment: string;
  categoryId: string;
}

const DATA_STANDARDS: DataStandard[] = [
  { code: 'STD_UUID', name: 'Primary ID (UUID)', dataType: 'UUID', comment: 'System Unique Identifier', categoryId: 'meta' },
  { code: 'STD_ID_INT', name: 'Primary ID (Int)', dataType: 'BIGINT', comment: 'Auto-increment ID', categoryId: 'meta' },
  { code: 'STD_NAME', name: 'Person Name', dataType: 'VARCHAR(100)', comment: 'Full legal name', categoryId: 'person' },
  { code: 'STD_MOBILE', name: 'Mobile Number', dataType: 'VARCHAR(20)', comment: 'E.164 format', categoryId: 'person' },
  { code: 'STD_EMAIL', name: 'Email Address', dataType: 'VARCHAR(100)', comment: 'Contact email', categoryId: 'person' },
  { code: 'STD_ADDR', name: 'Full Address', dataType: 'VARCHAR(255)', comment: 'Postal address', categoryId: 'person' },
  { code: 'STD_AMOUNT', name: 'Monetary Amount', dataType: 'DECIMAL(18,2)', comment: 'Standard currency field', categoryId: 'finance' },
  { code: 'STD_BALANCE', name: 'Account Balance', dataType: 'DECIMAL(18,2)', comment: 'Current balance', categoryId: 'finance' },
  { code: 'STD_SKU', name: 'Product SKU', dataType: 'VARCHAR(50)', comment: 'Stock Keeping Unit', categoryId: 'product' },
  { code: 'STD_PRICE', name: 'Unit Price', dataType: 'DECIMAL(10,2)', comment: 'Product price', categoryId: 'product' },
  { code: 'STD_CREATED', name: 'Created Time', dataType: 'TIMESTAMP', comment: 'Record creation time', categoryId: 'audit' },
  { code: 'STD_UPDATED', name: 'Updated Time', dataType: 'TIMESTAMP', comment: 'Record update time', categoryId: 'audit' },
  { code: 'STD_CREATOR', name: 'Creator ID', dataType: 'VARCHAR(64)', comment: 'User who created record', categoryId: 'audit' },
  { code: 'STD_STATUS', name: 'Status Code', dataType: 'INTEGER', comment: '0:Inactive, 1:Active', categoryId: 'meta' },
  { code: 'STD_IS_DEL', name: 'Is Deleted', dataType: 'BOOLEAN', comment: 'Soft delete flag', categoryId: 'meta' },
];

export const AttributeEditor: React.FC<AttributeEditorProps> = ({
  entity,
  modelType,
  relationships = [],
  allEntities = [],
  isOpen,
  initialTab = 'basic',
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'fields' | 'indexes' | 'partitions' | 'relations'>(initialTab);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [indexes, setIndexes] = useState<DbIndex[]>([]);
  const [partitions, setPartitions] = useState<DbPartition[]>([]);
  
  // Metadata State
  const [name, setName] = useState('');
  const [chineseName, setChineseName] = useState('');
  const [layer, setLayer] = useState('ODS');
  const [subject, setSubject] = useState('General');

  // Standard Picker State
  const [showStandardPicker, setShowStandardPicker] = useState(false);
  const [standardSearchTerm, setStandardSearchTerm] = useState('');
  const [selectedStandardCategoryId, setSelectedStandardCategoryId] = useState<string>('root');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['root', 'biz', 'tech']));
  const [tempSelectedStandards, setTempSelectedStandards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setAttributes(JSON.parse(JSON.stringify(entity.attributes)));
      setIndexes(JSON.parse(JSON.stringify(entity.indexes || [])));
      setPartitions(JSON.parse(JSON.stringify(entity.partitions || [])));
      setName(entity.name);
      setChineseName(entity.chineseName || '');
      setLayer(entity.layer || 'ODS');
      setSubject(entity.subject || 'General');
      setActiveTab(initialTab);
    }
  }, [isOpen, entity, initialTab]);

  if (!isOpen) return null;

  // --- Handlers ---

  const handleAdd = () => {
    setAttributes([...attributes, {
      id: generateId(),
      name: 'new_column',
      dataType: 'VARCHAR(255)',
      isNullable: true,
      isPrimaryKey: false
    }]);
  };
  
  // Index Handlers
  const handleAddIndex = () => {
    setIndexes([...indexes, {
      id: generateId(),
      name: `idx_${name}_${indexes.length + 1}`,
      isUnique: false,
      columns: [],
      type: 'BTREE'
    }]);
  };

  const handleUpdateIndex = (id: string, field: keyof DbIndex, value: any) => {
    setIndexes(indexes.map(idx => idx.id === id ? { ...idx, [field]: value } : idx));
  };
  
  const toggleIndexColumn = (indexId: string, colId: string) => {
    const idx = indexes.find(i => i.id === indexId);
    if (!idx) return;
    
    let newCols = [...idx.columns];
    if (newCols.includes(colId)) {
        newCols = newCols.filter(c => c !== colId);
    } else {
        newCols.push(colId);
    }
    handleUpdateIndex(indexId, 'columns', newCols);
  };

  const handleDeleteIndex = (id: string) => {
    setIndexes(indexes.filter(i => i.id !== id));
  };

  // Partition Handlers
  const handleAddPartition = () => {
    setPartitions([...partitions, {
      id: generateId(),
      name: `p_${partitions.length + 1}`,
      type: 'RANGE',
      expression: ''
    }]);
  };

  const handleUpdatePartition = (id: string, field: keyof DbPartition, value: any) => {
    setPartitions(partitions.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleDeletePartition = (id: string) => {
    setPartitions(partitions.filter(p => p.id !== id));
  };


  const handleOpenStandardPicker = () => {
    setShowStandardPicker(true);
    setTempSelectedStandards(new Set());
    setStandardSearchTerm('');
  };

  const handleToggleStandardSelection = (code: string) => {
    const newSet = new Set(tempSelectedStandards);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setTempSelectedStandards(newSet);
  };

  const handleAddSelectedStandards = () => {
    const selected = DATA_STANDARDS.filter(std => tempSelectedStandards.has(std.code));
    const newAttributes = selected.map(std => ({
      id: generateId(),
      name: std.code.toLowerCase(),
      dataType: std.dataType,
      dataStandard: std.code,
      comment: std.name,
      isNullable: true,
      isPrimaryKey: false
    }));
    setAttributes([...attributes, ...newAttributes]);
    setShowStandardPicker(false);
  };

  const handleChange = (id: string, field: keyof Attribute, value: any) => {
    setAttributes(attributes.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleDelete = (id: string) => {
    setAttributes(attributes.filter(a => a.id !== id));
  };

  const move = (index: number, direction: -1 | 1) => {
    const newAttrs = [...attributes];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newAttrs.length) {
      [newAttrs[index], newAttrs[targetIndex]] = [newAttrs[targetIndex], newAttrs[index]];
      setAttributes(newAttrs);
    }
  };

  const handleSave = () => {
    onSave(entity.id, attributes, {
      name,
      chineseName,
      layer,
      subject,
      indexes,
      partitions
    });
    onClose();
  };

  // --- Dimensional Model Relations Helper ---
  const getRelatedEntities = () => {
    const related: { relation: Relationship, entity: EntityNode, role: 'Source' | 'Target' }[] = [];
    relationships.forEach(rel => {
       if (rel.sourceId === entity.id) {
           const target = allEntities.find(e => e.id === rel.targetId);
           if (target) related.push({ relation: rel, entity: target, role: 'Target' });
       } else if (rel.targetId === entity.id) {
           const source = allEntities.find(e => e.id === rel.sourceId);
           if (source) related.push({ relation: rel, entity: source, role: 'Source' });
       }
    });
    return related;
  };

  // --- Tree Logic ---
  const toggleCategoryExpand = (id: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedCategories(newSet);
  };

  const getDescendantCategoryIds = (rootId: string): string[] => {
    const children = STANDARD_CATEGORIES.filter(c => c.parentId === rootId);
    let ids = [rootId];
    children.forEach(c => {
      ids = [...ids, ...getDescendantCategoryIds(c.id)];
    });
    return ids;
  };

  const filteredStandards = useMemo(() => {
    const targetCategories = new Set(getDescendantCategoryIds(selectedStandardCategoryId));
    return DATA_STANDARDS.filter(std => {
       const matchesCategory = targetCategories.has(std.categoryId);
       const matchesSearch = !standardSearchTerm || 
         std.name.toLowerCase().includes(standardSearchTerm.toLowerCase()) || 
         std.code.toLowerCase().includes(standardSearchTerm.toLowerCase());
       return matchesCategory && matchesSearch;
    });
  }, [selectedStandardCategoryId, standardSearchTerm]);

  const renderTreeNode = (node: StandardCategory, level: number) => {
     const hasChildren = STANDARD_CATEGORIES.some(c => c.parentId === node.id);
     const isExpanded = expandedCategories.has(node.id);
     const isSelected = selectedStandardCategoryId === node.id;

     return (
        <div key={node.id}>
          <div 
             className={`flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-md transition-colors select-none ${isSelected ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100 text-slate-700'}`}
             style={{ paddingLeft: `${level * 16 + 8}px` }}
             onClick={() => setSelectedStandardCategoryId(node.id)}
          >
             <div 
               className={`p-0.5 rounded mr-1 hover:bg-slate-200 text-slate-400 ${!hasChildren ? 'opacity-0' : ''}`}
               onClick={(e) => {
                 e.stopPropagation();
                 toggleCategoryExpand(node.id);
               }}
             >
                {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
             </div>
             <div className="mr-2 text-blue-500/80">
                {isExpanded ? <FolderOpen size={16}/> : <Folder size={16}/>}
             </div>
             <span className="truncate">{node.name}</span>
          </div>
          {hasChildren && isExpanded && (
             <div>
                {STANDARD_CATEGORIES.filter(c => c.parentId === node.id).map(child => renderTreeNode(child, level + 1))}
             </div>
          )}
        </div>
     );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit Entity: <span className="text-blue-600">{name}</span></h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
          <button 
            onClick={() => setActiveTab('basic')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'basic' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Basic Info
          </button>
          <button 
            onClick={() => setActiveTab('fields')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fields' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Columns
          </button>
          {modelType === ModelType.PHYSICAL && (
            <>
              <button 
                onClick={() => setActiveTab('indexes')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'indexes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Indexes & Keys
              </button>
               <button 
                onClick={() => setActiveTab('partitions')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'partitions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Partitions
              </button>
            </>
          )}
          {modelType === ModelType.DIMENSIONAL && (
             <button 
                onClick={() => setActiveTab('relations')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'relations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Star Schema Links
              </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          
          {/* TAB 1: Basic Info */}
          {activeTab === 'basic' && (
            <div className="max-w-2xl mx-auto space-y-6 bg-white p-8 rounded-lg shadow-sm border border-slate-200">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Entity/Table Name</label>
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. users"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Chinese Name</label>
                  <input 
                    value={chineseName}
                    onChange={(e) => setChineseName(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. 用户表"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Layer</label>
                  <select 
                    value={layer}
                    onChange={(e) => setLayer(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="ODS">ODS (Operational Data Store)</option>
                    <option value="DWD">DWD (Data Warehouse Detail)</option>
                    <option value="DWS">DWS (Data Warehouse Summary)</option>
                    <option value="ADS">ADS (Application Data Store)</option>
                    <option value="DIM">DIM (Dimension)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Subject / Theme</label>
                  <select 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="General">General</option>
                    <option value="Customer">Customer Domain</option>
                    <option value="Product">Product Domain</option>
                    <option value="Order">Order Domain</option>
                    <option value="Finance">Finance Domain</option>
                    <option value="Logistics">Logistics Domain</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Fields */}
          {activeTab === 'fields' && (
            <div className="flex flex-col h-full">
              <div className="mb-4 flex justify-between items-center">
                 <h4 className="text-sm font-bold text-slate-700">Attributes List</h4>
                 <div className="flex gap-2">
                   <button 
                     onClick={handleOpenStandardPicker}
                     className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-md text-sm font-medium hover:bg-purple-200 transition-colors"
                   >
                     <BookOpen size={16} /> Based on Standard
                   </button>
                   <button 
                     onClick={handleAdd}
                     className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                   >
                     <Plus size={16} /> Add Field
                   </button>
                 </div>
              </div>

              <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 w-10">#</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-purple-600">Standard</th>
                      <th className="px-4 py-3 text-center w-16">PK</th>
                      <th className="px-4 py-3 text-center w-16">NN</th>
                      <th className="px-4 py-3">Comment</th>
                      <th className="px-4 py-3 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attributes.map((attr, idx) => (
                      <tr key={attr.id} className="hover:bg-blue-50/30 group transition-colors">
                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <input 
                            value={attr.name}
                            onChange={(e) => handleChange(attr.id, 'name', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 focus:outline-none transition-all"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            value={attr.dataType}
                            onChange={(e) => handleChange(attr.id, 'dataType', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 focus:outline-none font-mono text-xs text-blue-600"
                          />
                        </td>
                         <td className="px-4 py-2">
                          <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 truncate max-w-[100px]" title={attr.dataStandard}>
                            {attr.dataStandard || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={attr.isPrimaryKey}
                            onChange={(e) => handleChange(attr.id, 'isPrimaryKey', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input 
                            type="checkbox" 
                            checked={!attr.isNullable}
                            onChange={(e) => handleChange(attr.id, 'isNullable', !e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            value={attr.comment || ''}
                            onChange={(e) => handleChange(attr.id, 'comment', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-2 py-1 focus:outline-none text-slate-500 text-xs"
                            placeholder="Description..."
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                           <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ArrowUp size={14}/></button>
                            <button onClick={() => move(idx, 1)} disabled={idx === attributes.length - 1} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ArrowDown size={14}/></button>
                            <button onClick={() => handleDelete(attr.id)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Indexes (Physical) */}
          {activeTab === 'indexes' && (
             <div className="flex flex-col h-full space-y-4">
                 <div className="flex justify-between items-center">
                     <h4 className="text-sm font-bold text-slate-700">Table Indexes</h4>
                     <button 
                         onClick={handleAddIndex}
                         className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                     >
                         <Plus size={16} /> Add Index
                     </button>
                 </div>
                 
                 <div className="space-y-4">
                     {indexes.map((idx, i) => (
                         <div key={idx.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                             <div className="flex justify-between items-start mb-4">
                                 <div className="flex gap-4 items-center flex-1">
                                     <div className="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">{i+1}</div>
                                     <div className="space-y-1 flex-1">
                                         <input 
                                             value={idx.name}
                                             onChange={(e) => handleUpdateIndex(idx.id, 'name', e.target.value)}
                                             className="font-mono text-sm font-semibold text-slate-800 border-b border-transparent focus:border-blue-500 focus:outline-none w-full bg-transparent"
                                             placeholder="Index Name"
                                         />
                                         <div className="flex gap-4">
                                            <label className="flex items-center gap-1 text-xs text-slate-600">
                                                <input 
                                                    type="checkbox" 
                                                    checked={idx.isUnique} 
                                                    onChange={(e) => handleUpdateIndex(idx.id, 'isUnique', e.target.checked)}
                                                    className="rounded text-blue-600"
                                                /> Unique
                                            </label>
                                            <select 
                                                value={idx.type}
                                                onChange={(e) => handleUpdateIndex(idx.id, 'type', e.target.value)}
                                                className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-slate-50"
                                            >
                                                <option value="BTREE">BTREE</option>
                                                <option value="HASH">HASH</option>
                                                <option value="BITMAP">BITMAP</option>
                                                <option value="GIN">GIN</option>
                                            </select>
                                         </div>
                                     </div>
                                 </div>
                                 <button onClick={() => handleDeleteIndex(idx.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                             </div>
                             
                             <div className="border-t border-slate-100 pt-3">
                                 <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">Included Columns</p>
                                 <div className="flex flex-wrap gap-2">
                                     {attributes.map(attr => (
                                         <button 
                                            key={attr.id}
                                            onClick={() => toggleIndexColumn(idx.id, attr.id)}
                                            className={`text-xs px-2 py-1 rounded border transition-colors ${idx.columns.includes(attr.id) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'}`}
                                         >
                                             {attr.name}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     ))}
                     {indexes.length === 0 && (
                         <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                             No indexes defined.
                         </div>
                     )}
                 </div>
             </div>
          )}

          {/* TAB 4: Partitions (Physical) */}
          {activeTab === 'partitions' && (
             <div className="flex flex-col h-full space-y-4">
                 <div className="flex justify-between items-center">
                     <h4 className="text-sm font-bold text-slate-700">Table Partitioning</h4>
                     <button 
                         onClick={handleAddPartition}
                         className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                     >
                         <Plus size={16} /> Add Partition Rule
                     </button>
                 </div>
                 
                 <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                             <tr>
                                 <th className="px-4 py-3">Partition Name</th>
                                 <th className="px-4 py-3">Type</th>
                                 <th className="px-4 py-3">Expression / Criteria</th>
                                 <th className="px-4 py-3 text-right">Action</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {partitions.map(p => (
                                 <tr key={p.id}>
                                     <td className="px-4 py-2">
                                         <input 
                                             value={p.name}
                                             onChange={(e) => handleUpdatePartition(p.id, 'name', e.target.value)}
                                             className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                             placeholder="p_2023"
                                         />
                                     </td>
                                     <td className="px-4 py-2">
                                         <select 
                                             value={p.type}
                                             onChange={(e) => handleUpdatePartition(p.id, 'type', e.target.value)}
                                             className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                         >
                                             <option value="RANGE">RANGE</option>
                                             <option value="LIST">LIST</option>
                                             <option value="HASH">HASH</option>
                                         </select>
                                     </td>
                                     <td className="px-4 py-2">
                                         <input 
                                             value={p.expression}
                                             onChange={(e) => handleUpdatePartition(p.id, 'expression', e.target.value)}
                                             className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono text-slate-600 focus:border-blue-500 focus:outline-none"
                                             placeholder="VALUES LESS THAN (2024)"
                                         />
                                     </td>
                                     <td className="px-4 py-2 text-right">
                                         <button onClick={() => handleDeletePartition(p.id)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                     </td>
                                 </tr>
                             ))}
                             {partitions.length === 0 && (
                                 <tr><td colSpan={4} className="py-8 text-center text-slate-400 text-sm">No partitions defined.</td></tr>
                             )}
                         </tbody>
                     </table>
                 </div>
             </div>
          )}

          {/* TAB 5: Relationships (Dimensional) */}
          {activeTab === 'relations' && (
             <div className="flex flex-col h-full space-y-4">
                 <h4 className="text-sm font-bold text-slate-700">Star Schema Connections</h4>
                 <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                     <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase py-3 px-4">
                         <div>Related Table</div>
                         <div>Role</div>
                         <div>Relationship</div>
                     </div>
                     <div className="divide-y divide-slate-100">
                         {getRelatedEntities().map((item, i) => (
                             <div key={i} className="grid grid-cols-3 py-3 px-4 items-center text-sm hover:bg-slate-50">
                                 <div className="font-medium text-slate-800 flex items-center gap-2">
                                    <Database size={14} className="text-slate-400"/>
                                    {item.entity.name} 
                                    <span className="text-xs text-slate-400 font-normal">({item.entity.tableType || 'table'})</span>
                                 </div>
                                 <div>
                                     <span className={`px-2 py-1 rounded text-xs font-semibold ${item.role === 'Source' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                         {item.role === 'Source' ? 'Parent / Source' : 'Child / Target'}
                                     </span>
                                 </div>
                                 <div className="text-slate-500 text-xs font-mono bg-slate-100 rounded px-2 py-1 inline-block w-fit">
                                     {item.relation.cardinality} ({item.relation.sourceMarker || 'none'} → {item.relation.targetMarker || 'none'})
                                 </div>
                             </div>
                         ))}
                         {getRelatedEntities().length === 0 && (
                             <div className="py-8 text-center text-slate-400 text-sm">
                                 No relationships connected to this entity.
                             </div>
                         )}
                     </div>
                 </div>
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded text-xs text-blue-700 flex items-start gap-2">
                     <Share2 size={16} className="shrink-0 mt-0.5"/>
                     <p>Relationships in dimensional models define the grain and navigation paths. To edit relationships, please use the canvas connection tools or click on the relationship line directly.</p>
                 </div>
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm text-sm font-medium flex items-center gap-2">
            <Save size={16} /> Save & Close
          </button>
        </div>
      </div>

      {/* Standard Picker Modal (Overlay) */}
      {showStandardPicker && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-lg shadow-xl w-[900px] h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-3 border-b flex justify-between items-center bg-purple-50 shrink-0">
               <h4 className="font-bold text-purple-900 flex items-center gap-2"><BookOpen size={16}/> Standard Library</h4>
               <button onClick={() => setShowStandardPicker(false)} className="p-1 hover:bg-purple-100 rounded-full text-purple-900"><X size={18}/></button>
            </div>
            
            {/* Modal Body: Split View */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Tree */}
                <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
                   <div className="p-3 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Categories
                   </div>
                   <div className="flex-1 overflow-y-auto p-2">
                      {renderTreeNode(STANDARD_CATEGORIES.find(c => c.id === 'root')!, 0)}
                   </div>
                </div>

                {/* Right Content: List */}
                <div className="w-2/3 flex flex-col bg-white">
                   {/* Toolbar */}
                   <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                       <div className="relative flex-1">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                          <input 
                            type="text" 
                            placeholder="Search standard name or code..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            value={standardSearchTerm}
                            onChange={(e) => setStandardSearchTerm(e.target.value)}
                          />
                       </div>
                       <div className="text-xs text-slate-500 font-medium">
                          {filteredStandards.length} items
                       </div>
                   </div>
                   
                   {/* List */}
                   <div className="flex-1 overflow-y-auto p-2 space-y-2">
                       {filteredStandards.map(std => {
                         const isSelected = tempSelectedStandards.has(std.code);
                         return (
                           <div 
                             key={std.code} 
                             onClick={() => handleToggleStandardSelection(std.code)}
                             className={`p-3 border rounded-md cursor-pointer transition-all group flex items-start gap-3 ${isSelected ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
                           >
                              <div className={`mt-0.5 ${isSelected ? 'text-purple-600' : 'text-slate-300 group-hover:text-purple-400'}`}>
                                 {isSelected ? <CheckSquare size={18} fill="currentColor" className="text-purple-100" stroke="currentColor"/> : <Square size={18}/>}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className={`font-bold text-sm ${isSelected ? 'text-purple-800' : 'text-slate-700'}`}>{std.name}</span>
                                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono border border-slate-200">{std.dataType}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                   <div className="text-xs text-slate-400">{std.code}</div>
                                   <div className="text-xs text-slate-500 italic truncate max-w-[200px]">{std.comment}</div>
                                </div>
                              </div>
                           </div>
                         );
                       })}
                       {filteredStandards.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                             <Filter size={24} className="mb-2 opacity-50"/>
                             <p className="text-sm">No standards found in this category.</p>
                          </div>
                       )}
                   </div>

                   {/* Footer Actions */}
                   <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                       <span className="text-xs text-slate-500">
                          {tempSelectedStandards.size} selected
                       </span>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => setShowStandardPicker(false)}
                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded text-sm font-medium"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleAddSelectedStandards}
                            disabled={tempSelectedStandards.size === 0}
                            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Add Selected
                          </button>
                       </div>
                   </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
