'use client';

import { useEffect, useRef } from 'react';
import type { MapPoint, WorldBible, WorldMapSettings } from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import {
  PixiCartographerEngine,
  type DraggedNodeData,
} from '@/lib/engines/world/pixi/PixiCartographerEngine';
import type { CartographerTool } from '../CartographerHeader';

interface UsePixiEngineOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  worldBible: WorldBible;
  settings: WorldMapSettings;
  selection: MapObjectRef[];
  selectionDelta: MapPoint | null;
  activeTool: CartographerTool;
  draggedNode: DraggedNodeData | null;
  transientPos: MapPoint | null;
  draftPoints: MapPoint[];
  rulerPoints: MapPoint[];
  isPersian: boolean;
  vertexEditMode?: boolean;
  pan: { x: number; y: number };
  zoom: number;
}

/**
 * Owns the Pixi application lifecycle: init, resize, viewport transform and
 * every full render pass. Keeping it in one hook lets the canvas component stay
 * focused on pointer gestures and tool state.
 */
export function usePixiEngine({
  containerRef,
  canvasRef,
  worldBible,
  settings,
  selection,
  selectionDelta,
  activeTool,
  draggedNode,
  transientPos,
  draftPoints,
  rulerPoints,
  isPersian,
  vertexEditMode,
  pan,
  zoom,
}: UsePixiEngineOptions): React.RefObject<PixiCartographerEngine | null> {
  const engineRef = useRef<PixiCartographerEngine | null>(null);

  // Initialise once per canvas mount. The first render's props are exactly the
  // state the engine must paint before the normal render effect takes over.
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const engine = new PixiCartographerEngine();
    engineRef.current = engine;

    const rect = containerRef.current.getBoundingClientRect();
    engine
      .init(canvasRef.current, rect.width, rect.height)
      .then(() => {
        engine.setTransform(pan, zoom);
        engine.renderAll({
          worldBible,
          settings,
          selection,
          selectionDelta,
          activeTool,
          draggedNode,
          transientPos,
          draftPoints,
          rulerPoints,
          isPersian,
          vertexEditMode,
        });
      })
      .catch((error) => {
        console.error('Failed to initialize PixiCartographerEngine:', error);
      });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) engine.resize(width, height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync pan & zoom transforms to the Pixi viewport.
  useEffect(() => {
    engineRef.current?.setTransform(pan, zoom);
  }, [pan, zoom]);

  // Re-render when data or interaction state changes.
  useEffect(() => {
    engineRef.current?.renderAll({
      worldBible,
      settings,
      selection,
      selectionDelta,
      activeTool,
      draggedNode,
      transientPos,
      draftPoints,
      rulerPoints,
      isPersian,
      vertexEditMode,
    });
  }, [
    worldBible,
    settings,
    selection,
    selectionDelta,
    activeTool,
    draggedNode,
    transientPos,
    draftPoints,
    rulerPoints,
    isPersian,
    vertexEditMode,
  ]);

  return engineRef;
}