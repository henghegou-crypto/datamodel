
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { EntityNode, Relationship, ModelType, Cardinality, LineStyle, MarkerType, EntityShape, TableType } from '../types';
import { GripVertical, Plus, X, Key, Database, Table, Sparkles, ZoomIn, ZoomOut, Copy, Clipboard, Settings, Trash2, ArrowRight, Square, Circle, Diamond, LayoutGrid, Search, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Cuboid, List, MousePointer2, Hand, Grid, Palette } from 'lucide-react';
import * as GeminiService from '../services/geminiService';
import { Minimap } from './Minimap';

// Safe ID generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {}
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#64748b', // Slate
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

interface CanvasProps {
  modelType: ModelType;
  entities: EntityNode[];
  relationships: Relationship[];
  onEntitiesChange: (entities: EntityNode[]) => void;
  onRelationshipsChange: (rels: Relationship[]) => void;
  onEditAttributes: (entity: EntityNode, initialTab?: 'basic' | 'fields') => void;
  onAutoLayout: () => void;
  readOnly?: boolean;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const Canvas: React.FC<CanvasProps> = ({
  modelType,
  entities,
  relationships,
  onEntitiesChange,
  onRelationshipsChange,
  onEditAttributes,
  onAutoLayout,
  readOnly = false
}) => {
  // --- State Management ---
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [selectedRelId, setSelectedRelId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  
  // Local temporary updates for smooth dragging (Performance Optimization)
  // Instead of updating the global 'entities' prop on every pixel, we store deltas here.
  const [dragUpdates, setDragUpdates] = useState<Record<string, Partial<EntityNode>>>({});
  const rafRef = useRef<number | null>(null);

  // Interactions
  const [dragState, setDragState] = useState<{
    type: 'entity' | 'pan' | 'selection' | 'resize';
    startMouseX: number;
    startMouseY: number;
    // For entity drag: store initial positions of all selected entities
    initialPositions?: Record<string, {x: number, y: number}>; 
    // For pan: store initial offset
    startOffset?: { x: number, y: number };
    // For resize
    entityId?: string;
    startW?: number;
    startH?: number;
  } | null>(null);

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  
  // Viewport
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  // Tools & UI
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<EntityNode[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, entityId?: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Computed Entities: Merging props with local drag updates for rendering
  const effectiveEntities = useMemo(() => {
    if (Object.keys(dragUpdates).length === 0) return entities;
    return entities.map(e => dragUpdates[e.id] ? { ...e, ...dragUpdates[e.id] } : e);
  }, [entities, dragUpdates]);

  // Resize observer
  useEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setViewportSize({
          width: canvasRef.current.clientWidth,
          height: canvasRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Handler for delete (called from keyboard or context menu)
  const handleDeleteSelectedEntities = useCallback(() => {
    if (readOnly) return;
    if (selectedEntityIds.size === 0) return;

    // Filter out entities
    const newEntities = entities.filter(e => !selectedEntityIds.has(e.id));
    
    // Also remove any relationships connected to deleted entities
    const newRelationships = relationships.filter(r => 
        !selectedEntityIds.has(r.sourceId) && !selectedEntityIds.has(r.targetId)
    );

    // Batch update via parent props - this triggers App history save
    // Important: Order matters. If we update rels first, then entities, history might capture intermediate state?
    // App handles individual updates. Ideally we should have a bulk update method.
    // For now, updating entities first is safer for rendering.
    
    // NOTE: To make history atomic, App should ideally accept a full model update or we trigger one state change.
    // Since props are separate callbacks, we call both. App's `updateSelectedModel` will trigger history push on each call.
    // This creates 2 undo steps (one for rels, one for entities). 
    // To fix: In a real app we'd consolidate. For this scope, it's acceptable or we just update entities and let App filter dangling rels?
    // Let's rely on callbacks.
    onRelationshipsChange(newRelationships);
    onEntitiesChange(newEntities);
    
    setSelectedEntityIds(new Set());
  }, [entities, relationships, selectedEntityIds, onEntitiesChange, onRelationshipsChange, readOnly]);

  const handleDeleteRel = useCallback((id: string) => {
    onRelationshipsChange(relationships.filter(r => r.id !== id));
    if (selectedRelId === id) setSelectedRelId(null);
  }, [relationships, selectedRelId, onRelationshipsChange]);


  // Keyboard Shortcuts & Modifiers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
      
      // Toggle tools with keys
      if (e.key === 'v' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        setInteractionMode('select');
      }
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
        setInteractionMode('pan');
      }

      if (readOnly) return;

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = entities.filter(ent => selectedEntityIds.has(ent.id));
        if (selected.length > 0) {
          setClipboard(selected);
        }
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard && clipboard.length > 0) {
        // Deselect current
        setSelectedEntityIds(new Set());

        const newEntities: EntityNode[] = [];
        const idMap = new Map<string, string>();

        // Create new entities with new IDs
        clipboard.forEach(item => {
          const newId = generateId();
          idMap.set(item.id, newId);
          newEntities.push({
            ...item,
            id: newId,
            x: item.x + 20,
            y: item.y + 20,
            name: `${item.name}_copy`, 
            attributes: item.attributes.map(a => ({ ...a, id: generateId() }))
          });
        });

        onEntitiesChange([...entities, ...newEntities]);
        // Select the newly pasted items
        setSelectedEntityIds(new Set(newEntities.map(e => e.id)));
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT') return;
        
        if (selectedEntityIds.size > 0) {
          handleDeleteSelectedEntities();
        } else if (selectedRelId) {
          handleDeleteRel(selectedRelId);
        }
      }

      // Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedEntityIds(new Set(entities.map(ent => ent.id)));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        // If we were panning via space, stop panning on key up
        if (dragState?.type === 'pan') {
          setDragState(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedEntityIds, selectedRelId, clipboard, entities, readOnly, dragState, handleDeleteSelectedEntities, handleDeleteRel]);

  // --- Actions ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Zoom if Ctrl/Meta is pressed OR we are in Pan mode
    if (e.ctrlKey || e.metaKey || interactionMode === 'pan') {
       // Zoom logic
       const mouseX = e.clientX - rect.left;
       const mouseY = e.clientY - rect.top;
       const sensitivity = 0.001;
       const delta = -e.deltaY;
       const scaleFactor = Math.pow(1 + sensitivity, delta);
       const nextZoom = Math.max(0.1, Math.min(5, zoom * scaleFactor));
       const scaleRatio = nextZoom / zoom;
       const newOffset = {
           x: mouseX - (mouseX - offset.x) * scaleRatio,
           y: mouseY - (mouseY - offset.y) * scaleRatio
       };
       setZoom(nextZoom);
       setOffset(newOffset);
    } else {
       // Pan logic with touchpad/wheel
       setOffset(prev => ({
         x: prev.x - e.deltaX,
         y: prev.y - e.deltaY
       }));
    }
  };

  const getEntityRect = (node: EntityNode) => {
    // Re-use existing geometry logic
    if (node.width && node.height) {
      return { x: node.x, y: node.y, w: node.width, h: node.height };
    }
    if (modelType === ModelType.CONCEPTUAL) {
      return { x: node.x, y: node.y, w: 160, h: 100 };
    }
    const width = 256; 
    const HEADER_HEIGHT = 44;
    const ROW_HEIGHT = 24;
    const FOOTER_HEIGHT = 24; 
    let visibleAttrsCount = node.attributes.length;
    let hasFooter = false;
    const isFiltering = searchTerm.length > 0;
    if (!isFiltering && node.collapsed && node.attributes.length > 5) {
       visibleAttrsCount = 5;
       hasFooter = true;
    }
    if (!isFiltering && !node.collapsed && node.attributes.length > 5) {
        hasFooter = true; 
    }
    if (isFiltering) {
        visibleAttrsCount = node.attributes.length;
        hasFooter = false;
    }
    const height = HEADER_HEIGHT + (visibleAttrsCount * ROW_HEIGHT) + (hasFooter ? FOOTER_HEIGHT : 4);
    return { x: node.x, y: node.y, w: width, h: height };
  };

  // --- Mouse Event Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // 0: Left, 1: Middle, 2: Right
    const isLeftClick = e.button === 0;
    const isMiddleClick = e.button === 1;
    
    // Close context menu on any interaction start (Left or Middle click)
    if (isLeftClick || isMiddleClick) {
      setContextMenu(null);
    }

    // Pan Mode Trigger: Middle Click OR (Left Click AND (Space Held OR Pan Mode))
    if (isMiddleClick || (isLeftClick && (isSpacePressed || interactionMode === 'pan'))) {
      setDragState({
        type: 'pan',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startOffset: { ...offset }
      });
      return;
    }

    if (!isLeftClick) return; // Ignore right click for drag start (handled by context menu)

    // Background Click -> Selection Box
    if (readOnly) return;
    
    // Clear selection if not holding shift and clicking background
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
       setSelectedEntityIds(new Set());
       setSelectedRelId(null);
    }

    setDragState({
      type: 'selection',
      startMouseX: e.clientX,
      startMouseY: e.clientY
    });
    
    // Initialize selection box
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left - offset.x) / zoom;
      const y = (e.clientY - rect.top - offset.y) / zoom;
      setSelectionBox({
         startX: x,
         startY: y,
         currentX: x,
         currentY: y
      });
    }
  };

  const handleEntityMouseDown = (e: React.MouseEvent, id: string) => {
    if (readOnly) return;
    
    // If in Pan mode, allow normal selection behavior (click), but dragging will be treated as PAN at container level if we propagate.
    // However, if we stop propagation, container won't get the event.
    // Logic: If Pan Mode is active, we don't start 'entity' drag, we let it bubble up to container 'pan' handler if user drags.
    // But we still want to select the entity on click.
    
    const isPanMode = interactionMode === 'pan' || isSpacePressed;

    if (!isPanMode) {
        e.stopPropagation();
    }

    // Connection Mode
    if (connectingSource) {
      if (connectingSource !== id) {
        const newRel: Relationship = {
          id: generateId(),
          sourceId: connectingSource,
          targetId: id,
          cardinality: Cardinality.ONE_TO_MANY,
          lineStyle: 'step',
          sourceMarker: 'one',
          targetMarker: 'crowfoot'
        };
        onRelationshipsChange([...relationships, newRel]);
        setConnectingSource(null);
      }
      return;
    }
    
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
    let newSelection = new Set(selectedEntityIds);

    if (isMultiSelect) {
      // Toggle
      if (newSelection.has(id)) newSelection.delete(id);
      else newSelection.add(id);
      setSelectedEntityIds(newSelection);
    } else {
      // If clicking an unselected item without shift, select only it
      // If clicking a selected item without shift, KEEP selection (to allow dragging multiple)
      if (!newSelection.has(id)) {
        newSelection = new Set([id]);
        setSelectedEntityIds(newSelection);
      }
    }
    
    // Prepare for Drag ONLY if NOT in Pan Mode
    if (!isPanMode) {
        // Capture initial positions of ALL selected items (including the one just clicked if it was added)
        const nodesToDrag = entities.filter(ent => newSelection.has(ent.id));
        const initialPos: Record<string, {x: number, y: number}> = {};
        nodesToDrag.forEach(n => {
           initialPos[n.id] = { x: n.x, y: n.y };
        });

        setDragState({
          type: 'entity',
          startMouseX: e.clientX,
          startMouseY: e.clientY,
          initialPositions: initialPos
        });
    }
    
    setSelectedRelId(null);
    setContextMenu(null);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, id: string) => {
    if (interactionMode === 'pan' || isSpacePressed) return;
    e.stopPropagation();
    e.preventDefault();
    const entity = entities.find(en => en.id === id);
    if (!entity) return;
    const rect = getEntityRect(entity);
    
    setDragState({
      type: 'resize',
      entityId: id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: rect.w,
      startH: rect.h
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    e.preventDefault();

    // PERFORMANCE: Use requestAnimationFrame to throttle updates
    if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
        if (dragState.type === 'pan' && dragState.startOffset) {
           setOffset({
             x: dragState.startOffset.x + (e.clientX - dragState.startMouseX),
             y: dragState.startOffset.y + (e.clientY - dragState.startMouseY)
           });
           return;
        }

        if (readOnly) return;

        const deltaX = (e.clientX - dragState.startMouseX) / zoom;
        const deltaY = (e.clientY - dragState.startMouseY) / zoom;

        if (dragState.type === 'entity' && dragState.initialPositions) {
           const updates: Record<string, Partial<EntityNode>> = {};
           Object.keys(dragState.initialPositions).forEach(id => {
               const init = dragState.initialPositions![id];
               updates[id] = {
                   x: init.x + deltaX,
                   y: init.y + deltaY
               };
           });
           setDragUpdates(updates);
        } else if (dragState.type === 'resize' && dragState.entityId) {
           const newW = Math.max(150, (dragState.startW || 0) + deltaX);
           const newH = Math.max(80, (dragState.startH || 0) + deltaY);
           setDragUpdates({
               [dragState.entityId]: { width: newW, height: newH }
           });
        } else if (dragState.type === 'selection' && selectionBox) {
           // Update selection box
           const rect = canvasRef.current?.getBoundingClientRect();
           if (rect) {
              const currentX = (e.clientX - rect.left - offset.x) / zoom;
              const currentY = (e.clientY - rect.top - offset.y) / zoom;
              setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null);
           }
        }
    });
  };

  const handleMouseUp = () => {
    // Commit Drag Updates
    if (dragState?.type === 'entity' || dragState?.type === 'resize') {
         if (Object.keys(dragUpdates).length > 0) {
             const newEntities = entities.map(e => {
                 if (dragUpdates[e.id]) {
                     return { ...e, ...dragUpdates[e.id] };
                 }
                 return e;
             });
             onEntitiesChange(newEntities);
             setDragUpdates({});
         }
    }

    if (dragState?.type === 'selection' && selectionBox) {
      // Calculate intersection
      const x1 = Math.min(selectionBox.startX, selectionBox.currentX);
      const y1 = Math.min(selectionBox.startY, selectionBox.currentY);
      const x2 = Math.max(selectionBox.startX, selectionBox.currentX);
      const y2 = Math.max(selectionBox.startY, selectionBox.currentY);

      const newSelected = new Set(selectedEntityIds);
      
      entities.forEach(ent => {
         const rect = getEntityRect(ent);
         // Check Intersection
         const entRight = rect.x + rect.w;
         const entBottom = rect.y + rect.h;
         
         const isOverlapping = !(rect.x > x2 || entRight < x1 || rect.y > y2 || entBottom < y1);
         
         if (isOverlapping) {
            newSelected.add(ent.id);
         }
      });
      setSelectedEntityIds(newSelected);
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setDragState(null);
    setSelectionBox(null);
  };

  const handleContextMenu = (e: React.MouseEvent, entityId?: string) => {
    // We allow context menu in pan mode now, as requested.
    e.preventDefault();
    e.stopPropagation();
    
    // If Right clicking on an entity that is NOT in the selection, select it exclusively
    if (entityId && !selectedEntityIds.has(entityId)) {
      setSelectedEntityIds(new Set([entityId]));
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, entityId });
  };

  // --- Helpers ---
  
  const handleAddEntity = (tableType: TableType = 'other') => {
    const id = generateId();
    onEntitiesChange([...entities, {
       id,
       name: tableType === 'fact' ? 'Fact_Table' : tableType === 'dimension' ? 'Dim_Table' : 'New_Entity',
       x: -offset.x/zoom + viewportSize.width/2/zoom - 128, 
       y: -offset.y/zoom + viewportSize.height/2/zoom - 50,
       attributes: [],
       type: modelType === ModelType.PHYSICAL || modelType === ModelType.DIMENSIONAL ? 'table' : 'entity',
       shape: 'rectangle',
       tableType,
       collapsed: false
    }]);
  };

  const handleUpdateShape = (id: string, shape: EntityShape) => {
    onEntitiesChange(entities.map(e => e.id === id ? { ...e, shape } : e));
    setContextMenu(null);
  };

  const handleUpdateColor = (color: string) => {
    const selected = entities.filter(e => selectedEntityIds.has(e.id));
    if (selected.length === 0) return;
    
    const ids = new Set(selected.map(e => e.id));
    onEntitiesChange(entities.map(e => ids.has(e.id) ? { ...e, color } : e));
    setContextMenu(null);
  }
  
  const handleAISuggest = async (entity: EntityNode) => {
    if (loadingSuggestion) return;
    setLoadingSuggestion(entity.id);
    try {
      const suggestions = await GeminiService.suggestAttributes(entity.name, modelType);
      if (suggestions.length > 0) {
        onEntitiesChange(entities.map(ent => {
          if (ent.id === entity.id) {
            const existingNames = new Set(ent.attributes.map(a => a.name.toLowerCase()));
            const newAttrs = suggestions.filter(s => !existingNames.has((s.name || '').toLowerCase()));
            return {
              ...ent,
              attributes: [...ent.attributes, ...newAttrs as any]
            };
          }
          return ent;
        }));
      }
    } finally {
      setLoadingSuggestion(null);
    }
  };

  const toggleCollapse = (id: string) => {
    onEntitiesChange(entities.map(e => e.id === id ? { ...e, collapsed: !e.collapsed } : e));
  };
  
  const setAllCollapsed = (collapsed: boolean) => {
    onEntitiesChange(entities.map(e => ({ ...e, collapsed })));
  };

  const updateRel = (id: string, updates: Partial<Relationship>) => {
    onRelationshipsChange(relationships.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  // --- Render Helpers (Geometry) ---

  const getPorts = (rect: {x: number, y: number, w: number, h: number}) => {
      const inset = 0; 
      return {
          top: { x: rect.x + rect.w / 2, y: rect.y + inset, side: 'top' },
          bottom: { x: rect.x + rect.w / 2, y: rect.y + rect.h - inset, side: 'bottom' },
          left: { x: rect.x + inset, y: rect.y + rect.h / 2, side: 'left' },
          right: { x: rect.x + rect.w - inset, y: rect.y + rect.h / 2, side: 'right' },
      };
  };

  const getBestConnection = (source: EntityNode, target: EntityNode) => {
    const sRect = getEntityRect(source);
    const tRect = getEntityRect(target);
    const sPorts = getPorts(sRect);
    const tPorts = getPorts(tRect);

    let min = Infinity;
    let best = { start: sPorts.right, end: tPorts.left };

    Object.values(sPorts).forEach(sp => {
        Object.values(tPorts).forEach(tp => {
            const d = Math.hypot(sp.x - tp.x, sp.y - tp.y);
            if (d < min) {
                min = d;
                best = { start: sp, end: tp };
            }
        });
    });
    return best;
  };

  const getPathData = (rel: Relationship, source: EntityNode, target: EntityNode) => {
    const { start, end } = getBestConnection(source, target);
    let path = '';
    let label = { x: 0, y: 0 };

    if (rel.lineStyle === 'straight') {
        path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    } 
    else if (rel.lineStyle === 'curve') {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const cp1 = { x: start.x, y: start.y };
        const cp2 = { x: end.x, y: end.y };
        const curvature = 0.5;
        if (start.side === 'left' || start.side === 'right') cp1.x += (start.side === 'right' ? 1 : -1) * Math.abs(dx) * curvature;
        else cp1.y += (start.side === 'bottom' ? 1 : -1) * Math.abs(dy) * curvature;
        if (end.side === 'left' || end.side === 'right') cp2.x += (end.side === 'right' ? 1 : -1) * Math.abs(dx) * curvature;
        else cp2.y += (end.side === 'bottom' ? 1 : -1) * Math.abs(dy) * curvature;
        path = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
        const t = 0.5;
        const mt = 1-t;
        label.x = mt*mt*mt*start.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*end.x;
        label.y = mt*mt*mt*start.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*end.y;
    } 
    else {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        if ((start.side === 'left' || start.side === 'right') && (end.side === 'left' || end.side === 'right')) {
            path = `M ${start.x} ${start.y} L ${mx} ${start.y} L ${mx} ${end.y} L ${end.x} ${end.y}`;
            label = { x: mx, y: my };
        } else if ((start.side === 'top' || start.side === 'bottom') && (end.side === 'top' || end.side === 'bottom')) {
            path = `M ${start.x} ${start.y} L ${start.x} ${my} L ${end.x} ${my} L ${end.x} ${end.y}`;
            label = { x: (start.x + end.x)/2, y: my };
        } else {
            if (start.side === 'left' || start.side === 'right') {
                 path = `M ${start.x} ${start.y} L ${end.x} ${start.y} L ${end.x} ${end.y}`;
                 label = { x: end.x, y: start.y };
            } else {
                 path = `M ${start.x} ${start.y} L ${start.x} ${end.y} L ${end.x} ${end.y}`;
                 label = { x: start.x, y: end.y };
            }
        }
    }
    return { path, label };
  };

  const selectedRel = relationships.find(r => r.id === selectedRelId);

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-hidden flex flex-col select-none">
       {/* Toolbar */}
       <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-white p-2 rounded-lg shadow-md border border-slate-200 items-center">
         
         {/* Mode Toggles */}
         <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 mr-2 items-center">
            <button 
               onClick={() => setInteractionMode('select')}
               className={`p-1.5 rounded-md flex items-center gap-1 text-xs font-medium transition-all ${interactionMode === 'select' && !isSpacePressed ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
               title="Select Tool (V)"
            >
               <MousePointer2 size={16} />
               <span className="hidden sm:inline">Select</span>
            </button>
            <button 
               onClick={() => setInteractionMode('pan')}
               className={`p-1.5 rounded-md flex items-center gap-1 text-xs font-medium transition-all ${interactionMode === 'pan' || isSpacePressed ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
               title="Pan Tool (H or Space)"
            >
               <Hand size={16} />
               <span className="hidden sm:inline">Pan</span>
            </button>
         </div>

         <div className="w-px h-6 bg-slate-200 mx-1"></div>
         <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={18}/></button>
         <span className="p-2 text-xs text-slate-400 font-mono flex items-center min-w-[40px] justify-center">{Math.round(zoom * 100)}%</span>
         <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={18}/></button>
         
         <div className="w-px h-6 bg-slate-200 mx-1"></div>
         <button 
            onClick={() => setShowGrid(!showGrid)} 
            className={`p-2 rounded transition-colors ${showGrid ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`} 
            title="Toggle Grid"
         >
             <Grid size={18}/>
         </button>
         <button onClick={onAutoLayout} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Auto Layout"><LayoutGrid size={18}/></button>
         
         {modelType !== ModelType.CONCEPTUAL && (
           <>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button onClick={() => setAllCollapsed(false)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Expand All"><ChevronsDown size={18}/></button>
              <button onClick={() => setAllCollapsed(true)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Collapse All"><ChevronsUp size={18}/></button>
              
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <div className="relative flex items-center">
                 <Search size={14} className="absolute left-2 text-slate-400"/>
                 <input 
                   type="text" 
                   placeholder="Filter canvas..." 
                   className="pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-500 w-32 focus:w-48 transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
           </>
         )}

         <div className="w-px h-6 bg-slate-200 mx-1"></div>
         {modelType === ModelType.DIMENSIONAL ? (
           <>
             <button 
                onClick={() => handleAddEntity('fact')}
                disabled={readOnly}
                className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
             >
               <Plus size={16}/> <span>Fact</span>
             </button>
             <button 
                onClick={() => handleAddEntity('dimension')}
                disabled={readOnly}
                className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
             >
               <Plus size={16}/> <span>Dim</span>
             </button>
           </>
         ) : (
           <button 
             onClick={() => handleAddEntity()}
             disabled={readOnly}
             className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
           >
             <Plus size={16}/> <span>Add {modelType === ModelType.PHYSICAL ? 'Table' : 'Entity'}</span>
           </button>
         )}
       </div>

       {connectingSource && (
         <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded-full z-50 shadow-lg text-sm font-medium animate-pulse flex items-center gap-2">
           Select target entity to connect
           <button onClick={() => setConnectingSource(null)} className="ml-2 p-1 hover:bg-blue-200 rounded-full"><X size={14} /></button>
         </div>
       )}

       {/* Relationship Editor */}
       {selectedRel && !readOnly && (
           <div className="absolute top-4 right-4 z-20 w-80 bg-white p-4 rounded-lg shadow-xl border border-blue-200 animate-in slide-in-from-right-10">
                <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><Settings size={14}/> Relationship Settings</span>
                    <button onClick={() => setSelectedRelId(null)} className="hover:bg-slate-100 rounded p-1"><X size={16}/></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Line Style</label>
                         <select 
                            value={selectedRel.lineStyle} 
                            onChange={(e) => updateRel(selectedRel.id, { lineStyle: e.target.value as LineStyle })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none bg-white"
                        >
                            <option value="straight">Straight</option>
                            <option value="curve">Curve</option>
                            <option value="step">Step (Orthogonal)</option>
                        </select>
                      </div>
                       <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Cardinality</label>
                        <select 
                            value={selectedRel.cardinality} 
                            onChange={(e) => updateRel(selectedRel.id, { cardinality: e.target.value as Cardinality })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none bg-white"
                        >
                            <option value={Cardinality.ONE_TO_ONE}>1 : 1</option>
                            <option value={Cardinality.ONE_TO_MANY}>1 : N</option>
                            <option value={Cardinality.MANY_TO_MANY}>M : N</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                       <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Source Marker</label>
                        <select 
                            value={selectedRel.sourceMarker || 'none'} 
                            onChange={(e) => updateRel(selectedRel.id, { sourceMarker: e.target.value as MarkerType })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none bg-white"
                        >
                            <option value="none">None</option>
                            <option value="arrow">Arrow</option>
                            <option value="diamond">Diamond</option>
                            <option value="circle">Circle</option>
                            <option value="crowfoot">Crowfoot</option>
                            <option value="one">One</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Target Marker</label>
                        <select 
                            value={selectedRel.targetMarker || 'none'} 
                            onChange={(e) => updateRel(selectedRel.id, { targetMarker: e.target.value as MarkerType })}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none bg-white"
                        >
                             <option value="none">None</option>
                            <option value="arrow">Arrow</option>
                            <option value="diamond">Diamond</option>
                            <option value="circle">Circle</option>
                            <option value="crowfoot">Crowfoot</option>
                            <option value="one">One</option>
                        </select>
                      </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Label</label>
                        <input
                            type="text"
                            value={selectedRel.label || ''}
                            onChange={(e) => updateRel(selectedRel.id, { label: e.target.value })}
                            placeholder="Relationship name"
                            className="w-full text-xs border border-slate-300 rounded p-1.5 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <button 
                        onClick={() => handleDeleteRel(selectedRel.id)} 
                        className="w-full py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-100 flex justify-center items-center gap-2 mt-2"
                    >
                        <Trash2 size={14}/> Delete Relationship
                    </button>
                </div>
           </div>
       )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed bg-white border border-slate-200 shadow-xl rounded-md z-50 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.entityId ? (
             <>
               <button 
                onClick={() => { 
                  const selected = entities.filter(e => selectedEntityIds.has(e.id));
                  setClipboard(selected);
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 flex items-center gap-2"
              >
                <Copy size={14}/> Copy {selectedEntityIds.size > 1 ? `(${selectedEntityIds.size})` : ''}
              </button>
              
              {modelType === ModelType.CONCEPTUAL && selectedEntityIds.size === 1 && (
                <>
                  <div className="px-4 py-1 text-xs text-slate-400 font-semibold uppercase">Change Shape</div>
                  <button onClick={() => handleUpdateShape(contextMenu.entityId!, 'rectangle')} className="w-full text-left px-4 py-1.5 text-sm hover:bg-blue-50 flex gap-2"><Square size={14}/> Rectangle</button>
                  <button onClick={() => handleUpdateShape(contextMenu.entityId!, 'circle')} className="w-full text-left px-4 py-1.5 text-sm hover:bg-blue-50 flex gap-2"><Circle size={14}/> Circle</button>
                  <button onClick={() => handleUpdateShape(contextMenu.entityId!, 'diamond')} className="w-full text-left px-4 py-1.5 text-sm hover:bg-blue-50 flex gap-2"><Diamond size={14}/> Diamond</button>
                  <div className="border-t border-slate-100 my-1"></div>
                </>
              )}
              
              <div className="px-4 py-1 mt-1 text-xs text-slate-400 font-semibold uppercase flex items-center gap-2">
                 <Palette size={12}/> Color
              </div>
              <div className="px-4 py-1 flex flex-wrap gap-1">
                 {COLORS.map(c => (
                    <button 
                      key={c} 
                      onClick={() => handleUpdateColor(c)}
                      className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-slate-200"
                      style={{ backgroundColor: c }}
                    />
                 ))}
                 <button 
                    onClick={() => handleUpdateColor('')} 
                    className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-slate-200 bg-white relative flex items-center justify-center"
                    title="Reset Color"
                 >
                    <div className="w-3 h-0.5 bg-red-400 transform rotate-45"></div>
                 </button>
              </div>
              <div className="border-t border-slate-100 my-1"></div>

              {selectedEntityIds.size === 1 && (
                <button 
                    onClick={() => { 
                    const ent = entities.find(e => e.id === contextMenu.entityId);
                    if (ent) onEditAttributes(ent);
                    setContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 flex items-center gap-2"
                >
                    <Settings size={14}/> Edit {modelType === ModelType.CONCEPTUAL ? 'Name' : 'Attributes'}
                </button>
              )}
              
              <div className="border-t border-slate-100 my-1"></div>
              <button 
                onClick={() => { 
                  handleDeleteSelectedEntities();
                  setContextMenu(null);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={14}/> Delete {selectedEntityIds.size > 1 ? `(${selectedEntityIds.size})` : ''}
              </button>
             </>
          ) : (
             <button 
               onClick={() => {
                 if (clipboard && clipboard.length > 0) {
                     // Trigger paste logic manually if needed or via event dispatch
                     const event = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, metaKey: true });
                     window.dispatchEvent(event);
                 }
                 setContextMenu(null);
               }}
               disabled={!clipboard}
               className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
             >
               <Clipboard size={14}/> Paste
             </button>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className={`flex-1 overflow-hidden relative select-none ${(interactionMode === 'pan' || isSpacePressed) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${showGrid ? 'grid-bg' : 'bg-slate-50'}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => handleContextMenu(e)}
        onWheel={handleWheel}
        id="nexus-canvas"
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
          
          {/* Selection Box Visual */}
          {selectionBox && (
              <div 
                className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                style={{
                    left: Math.min(selectionBox.startX, selectionBox.currentX),
                    top: Math.min(selectionBox.startY, selectionBox.currentY),
                    width: Math.abs(selectionBox.currentX - selectionBox.startX),
                    height: Math.abs(selectionBox.currentY - selectionBox.startY)
                }}
              />
          )}

          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
            <defs>
              <marker id="marker-arrow" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                <path d="M0,0 L12,6 L0,12 L0,0" fill="#94a3b8" />
              </marker>
              <marker id="marker-arrow-selected" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                <path d="M0,0 L12,6 L0,12 L0,0" fill="#3b82f6" />
              </marker>
              <marker id="marker-diamond" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L6,0 L12,6 L6,12 L0,6" fill="#fff" stroke="#94a3b8" strokeWidth="1.5"/>
              </marker>
               <marker id="marker-diamond-selected" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L6,0 L12,6 L6,12 L0,6" fill="#fff" stroke="#3b82f6" strokeWidth="1.5"/>
              </marker>
              <marker id="marker-circle" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <circle cx="6" cy="6" r="5" fill="#fff" stroke="#94a3b8" strokeWidth="1.5"/>
              </marker>
              <marker id="marker-circle-selected" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <circle cx="6" cy="6" r="5" fill="#fff" stroke="#3b82f6" strokeWidth="1.5"/>
              </marker>
              <marker id="marker-crowfoot" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L12,6 M12,0 L0,6 L12,12" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
               </marker>
               <marker id="marker-crowfoot-selected" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L12,6 M12,0 L0,6 L12,12" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
               </marker>
               <marker id="marker-one" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L12,6 M12,0 L12,12" fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
               </marker>
               <marker id="marker-one-selected" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                 <path d="M0,6 L12,6 M12,0 L12,12" fill="none" stroke="#3b82f6" strokeWidth="1.5"/>
               </marker>
            </defs>

            {relationships.map(rel => {
              const source = effectiveEntities.find(e => e.id === rel.sourceId);
              const target = effectiveEntities.find(e => e.id === rel.targetId);
              if (!source || !target) return null;
              
              const isSelected = selectedRelId === rel.id;
              // Check if related entities are selected to highlight relation implicitly? Maybe not.
              const { path, label } = getPathData(rel, source, target);

              const startMarkerId = rel.sourceMarker && rel.sourceMarker !== 'none' 
                ? `url(#marker-${rel.sourceMarker}${isSelected ? '-selected' : ''})` 
                : undefined;
              const endMarkerId = rel.targetMarker && rel.targetMarker !== 'none' 
                ? `url(#marker-${rel.targetMarker}${isSelected ? '-selected' : ''})` 
                : undefined;

              return (
                <g 
                  key={rel.id} 
                  onClick={(e) => { e.stopPropagation(); setSelectedRelId(rel.id); setSelectedEntityIds(new Set()); }}
                  className="pointer-events-auto cursor-pointer group"
                >
                  <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                  <path 
                    d={path} 
                    stroke={isSelected ? '#3b82f6' : '#94a3b8'} 
                    strokeWidth={isSelected ? 2 : 1.5} 
                    fill="none" 
                    markerStart={startMarkerId}
                    markerEnd={endMarkerId}
                    className="transition-colors duration-200"
                  />
                  <foreignObject 
                    x={label.x - 30} 
                    y={label.y - 12} 
                    width="60" 
                    height="24"
                    style={{ overflow: 'visible' }}
                  >
                     <div className={`flex items-center justify-center w-full h-full bg-white rounded-full shadow-sm border ${isSelected ? 'border-blue-400' : 'border-slate-300'} px-2`}>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-600' : 'text-slate-600'} whitespace-nowrap`}>
                          {rel.label ? rel.label : rel.cardinality}
                        </span>
                     </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Entities Layer */}
          {effectiveEntities.map(entity => {
            const isConceptual = modelType === ModelType.CONCEPTUAL;
            const rect = getEntityRect(entity);
            const isSelected = selectedEntityIds.has(entity.id);
            
            // Conceptual Styles
            if (isConceptual) {
               const isCircle = entity.shape === 'circle';
               const isDiamond = entity.shape === 'diamond';
               
               // For conceptual, color applies to background
               const bgColor = entity.color || 'white';
               const borderColor = entity.color ? entity.color : (isSelected ? '#22c55e' : '#16a34a');

               return (
                 <div
                    key={entity.id}
                    className={`absolute flex items-center justify-center z-10 select-none`}
                    style={{ left: entity.x, top: entity.y, width: rect.w, height: rect.h }}
                    onMouseDown={(e) => handleEntityMouseDown(e, entity.id)}
                    onContextMenu={(e) => handleContextMenu(e, entity.id)}
                    onDoubleClick={(e) => { 
                      e.stopPropagation(); 
                      !readOnly && onEditAttributes(entity, 'basic'); 
                    }}
                 >
                    <div 
                      className={`absolute inset-0 border-2 shadow-md transition-all ${
                         isSelected ? 'ring-2 ring-green-200' : ''
                      } ${connectingSource === entity.id ? 'ring-4 ring-blue-300' : ''}`}
                      style={{
                        borderRadius: isCircle ? '50%' : '0.5rem',
                        clipPath: isDiamond ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' : undefined,
                        backgroundColor: bgColor,
                        borderColor: isSelected && !entity.color ? '#22c55e' : borderColor,
                        opacity: entity.color ? 0.9 : 1
                      }}
                    />
                    
                    <div className="z-20 text-center px-2 pointer-events-none relative">
                       <div className={`font-bold text-sm ${entity.color ? 'text-white' : 'text-slate-800'}`}>{entity.name}</div>
                    </div>
                    
                    {!readOnly && isSelected && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); setConnectingSource(entity.id); }}
                         className="absolute -top-2 -right-2 p-1.5 bg-white border border-green-200 hover:bg-green-100 rounded-full text-green-600 transition-colors shadow-sm z-30"
                       >
                          <GripVertical size={14}/>
                       </button>
                    )}
                 </div>
               );
            }

            // Logical / Physical
            let headerClass = 'bg-blue-50';
            let icon = <Database size={14} className="text-blue-500 shrink-0"/>;

            if (entity.color) {
               // If Custom color, we use inline style mostly, but keep structure
               headerClass = ''; // cleared
            } else if (modelType === ModelType.PHYSICAL) {
              headerClass = 'bg-slate-100';
              icon = <Table size={14} className="text-slate-500 shrink-0"/>;
            } else if (modelType === ModelType.DIMENSIONAL) {
               if (entity.tableType === 'fact') {
                  headerClass = 'bg-indigo-100';
                  icon = <Cuboid size={14} className="text-indigo-600 shrink-0"/>;
               } else if (entity.tableType === 'dimension') {
                  headerClass = 'bg-emerald-100';
                  icon = <Table size={14} className="text-emerald-600 shrink-0"/>;
               } else {
                  headerClass = 'bg-orange-50';
                  icon = <Table size={14} className="text-orange-500 shrink-0"/>;
               }
            }

            const isFiltering = searchTerm.length > 0;
            const visibleAttributes = (!isFiltering && entity.collapsed && entity.attributes.length > 5) 
               ? entity.attributes.slice(0, 5) 
               : entity.attributes;
            
            const customHeaderStyle = entity.color ? { backgroundColor: entity.color, color: 'white' } : {};
            const iconColorClass = entity.color ? 'text-white' : '';

            return (
              <div
                key={entity.id}
                className={`absolute bg-white rounded-lg shadow-md border-2 flex flex-col transition-all z-10 select-none group/entity ${
                  isSelected ? 'border-blue-500 shadow-xl ring-2 ring-blue-200' : 'border-slate-200'
                } ${connectingSource === entity.id ? 'ring-4 ring-blue-300' : ''}`}
                style={{ 
                    left: entity.x, top: entity.y, width: rect.w, height: rect.h,
                    borderColor: entity.color && isSelected ? entity.color : undefined 
                }}
                onMouseDown={(e) => handleEntityMouseDown(e, entity.id)}
                onContextMenu={(e) => handleContextMenu(e, entity.id)}
              >
                {/* Header */}
                <div 
                  className={`p-2 border-b flex items-center justify-between handle ${headerClass} rounded-t-lg shrink-0 h-[44px] cursor-move`}
                  style={customHeaderStyle}
                  onDoubleClick={(e) => { 
                    e.stopPropagation(); 
                    !readOnly && onEditAttributes(entity, 'basic'); 
                  }}
                >
                  <div className="flex flex-col overflow-hidden pointer-events-none">
                      <div className="flex items-center space-x-2">
                          {React.cloneElement(icon as React.ReactElement<any>, { className: `${(icon as React.ReactElement<any>).props.className} ${iconColorClass}` })}
                          <span className={`font-bold text-sm truncate ${entity.color ? 'text-white' : 'text-slate-800'}`} title={entity.name}>{entity.name}</span>
                      </div>
                      {entity.chineseName && (
                          <span className={`text-[10px] ml-6 truncate block ${entity.color ? 'text-white/80' : 'text-slate-500'}`}>{entity.chineseName}</span>
                      )}
                  </div>
                  {!readOnly && (
                    <div className="flex items-center space-x-1 shrink-0">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setConnectingSource(entity.id); }}
                         className={`p-1.5 hover:bg-blue-200 rounded transition-colors ${connectingSource === entity.id ? 'text-blue-600 bg-blue-200' : (entity.color ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-slate-500')}`}
                         onMouseDown={(e) => e.stopPropagation()}
                       >
                          <GripVertical size={14}/>
                       </button>
                       <button 
                          onClick={(e) => { e.stopPropagation(); handleAISuggest(entity); }}
                          className={`p-1.5 hover:bg-purple-100 rounded animate-in fade-in transition-colors ${entity.color ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-purple-500'}`}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                         {loadingSuggestion === entity.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Sparkles size={14}/>}
                       </button>
                    </div>
                  )}
                </div>

                {/* Attributes */}
                <div 
                  className="p-2 space-y-1 bg-white rounded-b-lg cursor-default overflow-hidden flex-1 relative" 
                  onDoubleClick={(e) => { 
                    e.stopPropagation(); 
                    !readOnly && onEditAttributes(entity, 'fields'); 
                  }}
                >
                  {visibleAttributes.map(attr => {
                    const isMatch = searchTerm && attr.name.toLowerCase().includes(searchTerm.toLowerCase());
                    return (
                      <div 
                        key={attr.id} 
                        className={`flex items-center space-x-2 text-xs text-slate-600 group hover:bg-slate-50 p-0.5 rounded ${isMatch ? 'bg-yellow-100 font-semibold text-slate-900 ring-1 ring-yellow-300' : ''}`}
                      >
                        <span className={`w-3 flex justify-center shrink-0 ${attr.isPrimaryKey ? 'text-yellow-600' : attr.isForeignKey ? 'text-slate-400' : 'text-transparent'}`}><Key size={10} /></span>
                        <span className="flex-1 truncate" title={attr.name}>{attr.name}</span>
                        <span className="text-slate-400 truncate max-w-[60px] text-[10px] font-mono shrink-0 text-right">{attr.dataType}</span>
                      </div>
                    );
                  })}
                  {!isFiltering && (entity.attributes.length > 5) && (
                     <div 
                       className="absolute bottom-0 left-0 right-0 h-6 bg-slate-50 border-t flex justify-center items-center cursor-pointer hover:bg-slate-100 text-slate-400 hover:text-blue-500 transition-colors"
                       onClick={(e) => { e.stopPropagation(); toggleCollapse(entity.id); }}
                     >
                        {entity.collapsed ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                     </div>
                  )}
                </div>

                {!readOnly && isSelected && !isSpacePressed && interactionMode !== 'pan' && (
                   <div 
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 hover:bg-blue-100 rounded-tl opacity-0 group-hover/entity:opacity-100 transition-opacity"
                      onMouseDown={(e) => handleResizeMouseDown(e, entity.id)}
                   >
                     <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-slate-400"></div>
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <Minimap 
        entities={effectiveEntities} 
        viewX={offset.x} 
        viewY={offset.y} 
        zoom={zoom} 
        containerWidth={viewportSize.width} 
        containerHeight={viewportSize.height}
        onViewChange={(x, y) => setOffset({ x, y })}
      />
    </div>
  );
};
