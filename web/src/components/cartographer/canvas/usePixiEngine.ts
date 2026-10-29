'use client';

import { useEffect, useRef } from 'react';
import type { MapPoint, WorldBible, WorldMapSettings } from '@/lib/types';
import { mapObjectKey, type MapObjectRef } from '@/lib/engines/world/mapSelection';
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

  const hasFullRenderedRef = useRef(false);

  // 1. Full re-render when underlying map data, settings, or locale changes
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
    hasFullRenderedRef.current = true;
  }, [
    worldBible,
    settings,
    isPersian,
  ]);

  // 2. Selection overlay updates (handles node dragging & transient moves)
  useEffect(() => {
    if (!hasFullRenderedRef.current) return;
    if (draggedNode || transientPos || selectionDelta) {
      // During active node drag, full render ensures connected paths/settlements track smoothly
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
    } else {
      const selectionKeys = new Set<string>();
      for (const ref of selection) {
        selectionKeys.add(mapObjectKey(ref.kind as any, ref.id));
      }
      engineRef.current?.renderSelectionOnly({
        selectionKeys,
        vertexEditMode,
      });
    }
  }, [selection, selectionDelta, draggedNode, transientPos, vertexEditMode]);

  // 3. Fast-path interaction tools (activeTool changes, drafting clicks, ruler moves)
  useEffect(() => {
    if (!hasFullRenderedRef.current) return;
    engineRef.current?.renderInteractionOnly({
      activeTool,
      draftPoints,
      rulerPoints,
      isPersian,
    });
  }, [activeTool, draftPoints, rulerPoints, isPersian]);

  return engineRef;
}