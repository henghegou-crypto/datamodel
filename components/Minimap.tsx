
import React, { useState, useRef, useEffect } from 'react';
import { EntityNode } from '../types';

interface MinimapProps {
  entities: EntityNode[];
  viewX: number;
  viewY: number;
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  onViewChange: (x: number, y: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  entities,
  viewX,
  viewY,
  zoom,
  containerWidth,
  containerHeight,
  onViewChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const minimapRef = useRef<HTMLDivElement>(null);

  if (entities.length === 0) return null;

  // Calculate bounding box of all entities
  const minX = Math.min(...entities.map(e => e.x), 0);
  const minY = Math.min(...entities.map(e => e.y), 0);
  const maxX = Math.max(...entities.map(e => e.x + 256), 2000); 
  const maxY = Math.max(...entities.map(e => e.y + 200), 2000);

  const worldWidth = maxX - minX + 500;
  const worldHeight = maxY - minY + 500;
  const scale = 150 / Math.max(worldWidth, worldHeight);

  // Viewfinder geometry
  const viewfinderX = (-viewX / zoom - minX) * scale;
  const viewfinderY = (-viewY / zoom - minY) * scale;
  const viewfinderW = (containerWidth / zoom) * scale;
  const viewfinderH = (containerHeight / zoom) * scale;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Delta in minimap pixels
      const dx = e.movementX;
      const dy = e.movementY;

      // Convert delta to world pixels, then to viewport offset (inverted)
      // dx / scale = world_dx
      // offset_dx = -world_dx * zoom
      const offsetDx = -(dx / scale) * zoom;
      const offsetDy = -(dy / scale) * zoom;

      onViewChange(viewX + offsetDx, viewY + offsetDy);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, scale, zoom, viewX, viewY, onViewChange]);

  return (
    <div 
      className="absolute bottom-4 right-4 w-[150px] bg-white border-2 border-slate-200 shadow-lg rounded-lg overflow-hidden z-40 opacity-90 hover:opacity-100 transition-opacity"
      ref={minimapRef}
    >
      <div 
        className="relative bg-slate-50 cursor-pointer"
        style={{ height: worldHeight * scale }}
        onClick={(e) => {
           // Click to jump (simplified)
           if (minimapRef.current) {
               const rect = minimapRef.current.getBoundingClientRect();
               const clickX = e.clientX - rect.left;
               const clickY = e.clientY - rect.top;
               // Map clickX to worldX
               const worldX = clickX / scale + minX;
               const worldY = clickY / scale + minY;
               // Center view on this world point
               // offset = -world * zoom + center
               onViewChange(
                   -worldX * zoom + containerWidth / 2,
                   -worldY * zoom + containerHeight / 2
               );
           }
        }}
      >
        {/* Entities */}
        {entities.map(ent => (
          <div
            key={ent.id}
            className="absolute bg-blue-400 rounded-sm"
            style={{
              left: (ent.x - minX) * scale,
              top: (ent.y - minY) * scale,
              width: 256 * scale,
              height: 100 * scale,
            }}
          />
        ))}

        {/* Viewport Viewfinder */}
        <div
          className={`absolute border-2 border-red-500 bg-red-500/10 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            left: viewfinderX,
            top: viewfinderY,
            width: viewfinderW,
            height: viewfinderH,
          }}
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()} // Prevent jump on drag start
        />
      </div>
    </div>
  );
};
