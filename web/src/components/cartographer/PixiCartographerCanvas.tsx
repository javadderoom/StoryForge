'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  WorldBible,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapPoint,
  MapRoute,
  MapGroup,
} from '@/lib/types';
import { CartographerTool } from './CartographerHeader';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import {
  screenToWorld,
  calculateZoomPan,
  calculateZoomToRect,
  clampZoom,
} from '@/lib/engines/world/pixi/pixiMath';
import { VINTAGE_PARCHMENT } from '@/lib/engines/world/pixi/vintageTheme';
import { usePixiEngine } from './canvas/usePixiEngine';
import { useMapDrafting } from './canvas/useMapDrafting';
import { CanvasOverlays } from './canvas/CanvasOverlays';
import { LandSculptHud } from './canvas/LandSculptHud';
import { CartographerContextMenu } from './canvas/CartographerContextMenu';
import { LorePlacementPicker } from './canvas/LorePlacementPicker';
import { EnvironmentalContext } from '@/lib/engines/world/environmentalContext';
import {
  loreKindForTool,
  loreKindLabel,
} from '@/lib/engines/world/lorePlacement';
import { GeoToolHud } from './canvas/GeoToolHud';
import { GeoSpeciesPickerModal } from './canvas/GeoSpeciesPickerModal';
import { useRoadDrafting } from './canvas/hooks/useRoadDrafting';
import { useLandSculptBrush } from './canvas/hooks/useLandSculptBrush';
import { useGeoStrokeDrafting } from './canvas/hooks/useGeoStrokeDrafting';
import {
  useCanvasGestures,
  MARQUEE_THRESHOLD_PX,
  SELECTION_DRAG_THRESHOLD_PX,
  ZOOM_RECT_THRESHOLD_PX,
} from './canvas/hooks/useCanvasGestures';
import { useVertexEditing } from './canvas/hooks/useVertexEditing';
import { useGeoHudSettings } from './canvas/hooks/useGeoHudSettings';
import { useCanvasContextMenu } from './canvas/hooks/useCanvasContextMenu';
import { useCanvasNodeDrag } from './canvas/hooks/useCanvasNodeDrag';
import { useCanvasSelectTool } from './canvas/hooks/useCanvasSelectTool';
import { findGroupForRef } from '@/lib/engines/world/mapGroups';

interface PixiCartographerCanvasProps {
  worldBible: WorldBible;
  settings: WorldMapSettings;
  activeTool: CartographerTool;
  /** Plan 23: every selected object, not only the one in the Inspector. */
  selection: MapObjectRef[];
  onSelectionChange: (refs: MapObjectRef[]) => void;
  /** Plan 23: commit a finished group drag as one undoable translation. */
  onMoveSelection: (refs: MapObjectRef[], dx: number, dy: number) => void;
  onUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  onAddTradeRoute: (route: WorldTradeRoute) => void;
  /** Plan 25 — drawn roads and paths. */
  onUpdateRoute: (id: string, updated: Partial<MapRoute>) => void;
  onAddRoute: (route: MapRoute) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onAddTerrain: (feature: MapTerrainFeature) => void;
  onReplaceTerrain?: (features: MapTerrainFeature[]) => void;
  onAddLocation: (location: WorldLocation) => void;
  onAddPlacement: (placement: MapEntityPlacement) => void;
  onAddGeneratedElement?: (payload: {
    entityType: 'bestiary' | 'npc' | 'timeline' | 'artifact' | 'location';
    entity: any;
    placement: MapEntityPlacement;
  }) => void;
  onAskOracle?: (coord: MapPoint, envContext: EnvironmentalContext) => void;
  onDeleteObject?: (ref: { kind: string; id: string }) => void;
  isPersian: boolean;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

/** Draft state that must survive the handler's local scope while a route is being drawn. */
type DraftWindow = Window & { __pixiDraftOriginLocId?: string };
const draftWindow = (): DraftWindow => window as DraftWindow;

export const PixiCartographerCanvas: React.FC<PixiCartographerCanvasProps> = ({
  worldBible,
  settings,
  activeTool,
  selection,
  onSelectionChange,
  onMoveSelection,
  onUpdateTradeRoute,
  onAddTradeRoute,
  onUpdateRoute,
  onAddRoute,
  onUpdateTerrain,
  onAddTerrain,
  onReplaceTerrain,
  onAddLocation,
  onAddPlacement,
  onAddGeneratedElement,
  onAskOracle,
  onDeleteObject,
  isPersian,
  zoom,
  setZoom,
  pan,
  setPan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredCoord, setHoveredCoord] = useState<MapPoint | null>(null);
  const coordRafRef = useRef<number | null>(null);
  const pendingCoordRef = useRef<MapPoint | null>(null);

  const updateHoveredCoordThrottled = useCallback((worldPoint: MapPoint) => {
    pendingCoordRef.current = worldPoint;
    if (coordRafRef.current === null) {
      coordRafRef.current = requestAnimationFrame(() => {
        coordRafRef.current = null;
        if (pendingCoordRef.current) {
          setHoveredCoord(pendingCoordRef.current);
        }
      });
    }
  }, []);

  const tradeRoutesRef = useRef(worldBible.tradeRoutes || []);
  const mapRoutesRef = useRef(worldBible.mapData?.routes || []);
  const terrainFeaturesRef = useRef(worldBible.mapData?.terrainFeatures || []);

  useEffect(() => {
    tradeRoutesRef.current = worldBible.tradeRoutes || [];
  }, [worldBible.tradeRoutes]);

  useEffect(() => {
    mapRoutesRef.current = worldBible.mapData?.routes || [];
  }, [worldBible.mapData?.routes]);

  useEffect(() => {
    terrainFeaturesRef.current = worldBible.mapData?.terrainFeatures || [];
  }, [worldBible.mapData?.terrainFeatures]);

  // Convert client coordinates to World Map coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): MapPoint => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return screenToWorld(screenX, screenY, pan, zoom);
    },
    [pan, zoom]
  );

  // Viewport gestures: panning, rubber-band selection, group move, the
  // Alt-drag zoom box and the keyboard zoom.
  const {
    isPanning,
    setIsPanning,
    dragStart,
    setDragStart,
    marquee,
    marqueeRef,
    setMarqueeState,
    selectionDrag,
    selectionDragRef,
    setSelectionDragState,
    zoomRect,
    zoomRectRef,
    setZoomRectState,
    isAltHeld,
    lastMousePosRef,
    cancelZoomBox,
  } = useCanvasGestures({ zoom, pan, setZoom, setPan, containerRef });

  // Vertex edit mode: A toggles it, V leaves it, Delete removes a vertex.
  const {
    selectVertex,
    clearActiveVertex,
    isVertexEditMode,
    setIsVertexEditMode,
  } = useVertexEditing({ terrainFeaturesRef, onUpdateTerrain });

  // Live HUD settings and sliders
  const geoHud = useGeoHudSettings();

  // Node dragging and transient 60fps moves
  const {
    draggedNode,
    transientPos,
    draggedNodeRef,
    updateTransientPos,
    startDraggingNode,
    commitNodeDragEnd,
  } = useCanvasNodeDrag({
    tradeRoutesRef,
    mapRoutesRef,
    terrainFeaturesRef,
    onUpdateTradeRoute,
    onUpdateRoute,
    onUpdateTerrain,
    selectVertex,
  });

  const {
    draftPoints,
    setDraftPoints,
    rulerPoints,
    setRulerPoints,
    handleDoubleClick,
  } = useMapDrafting({
    activeTool,
    isPersian,
    onAddTerrain,
    onSelectionChange,
    onCancelZoom: cancelZoomBox,
    activeBiome: geoHud.activeBiome,
    highlandMode: geoHud.highlandMode,
    cliffHeight: geoHud.cliffHeight,
    terraceTiers: geoHud.terraceTiers,
    valleyWidth: geoHud.valleyWidth,
    mountainScale: geoHud.mountainScale,
    hasSnowcaps: geoHud.hasSnowcaps,
  });

  const engineRef = usePixiEngine({
    containerRef,
    canvasRef,
    worldBible,
    settings,
    selection,
    selectionDelta: selectionDrag?.moved ? selectionDrag.delta : null,
    activeTool,
    draggedNode,
    transientPos,
    draftPoints,
    rulerPoints,
    isPersian,
    vertexEditMode: isVertexEditMode,
    pan,
    zoom,
  });

  useEffect(() => {
    if (activeTool !== 'land_brush' && engineRef.current) {
      engineRef.current.clearBrushCursor();
      engineRef.current.clearBrushPreview();
    }
  }, [activeTool, engineRef]);

  // Context menu and canon entity placement
  const {
    contextMenuState,
    setContextMenuState,
    loreDraft,
    setLoreDraft,
    loreDraftIsLive,
    canGenerateHere,
    recordRightClickStart,
    checkRightClickRelease,
    handlePlaceLore,
    handleGenerateLore,
  } = useCanvasContextMenu({
    worldBible,
    settings,
    activeTool,
    engineRef,
    clientToWorld,
    onAddPlacement,
    onSelectionChange,
  });

  // Select tool hit-testing, vertex drag start, group move & marquee commits
  const groups = worldBible.mapData?.groups ?? worldBible.ontology?.mapData?.groups;
  const groupsRef = useRef<MapGroup[] | undefined>(groups);
  groupsRef.current = groups;

  const {
    handleSelectMouseDown,
    commitSelectionDragEnd,
    commitMarqueeEnd,
  } = useCanvasSelectTool({
    engineRef,
    settings,
    selection,
    worldBible,
    groupsRef,
    terrainFeaturesRef,
    mapRoutesRef,
    containerRef,
    pan,
    zoom,
    onSelectionChange,
    onMoveSelection,
    onUpdateTerrain,
    selectVertex,
    clearActiveVertex,
    startDraggingNode,
    setSelectionDragState,
    setMarqueeState,
  });

  // -----------------------------------------------------------------------
  // Extracted gesture hooks
  // -----------------------------------------------------------------------
  const {
    handleRoadMouseDown,
    handleRoadMouseMove,
    handleRoadMouseUp,
    finishRouteDraft,
    snapRouteAt,
  } = useRoadDrafting({
    activeTool,
    worldBible,
    isPersian,
    zoom,
    engineRef,
    setDraftPoints,
    onAddRoute,
    onSelectionChange,
  });

  const {
    isSculptingRef,
    handleBrushMouseDown,
    handleBrushMouseMove,
    handleBrushMouseUp,
  } = useLandSculptBrush({
    engineRef,
    terrainFeatures: worldBible.mapData?.terrainFeatures ?? [],
    onReplaceTerrain,
    sculptMode: geoHud.sculptMode,
    brushSize: geoHud.brushSize,
    brushRoughness: geoHud.brushRoughness,
  });

  const {
    isGeoStrokeTool,
    isDraggingGeoStrokeRef,
    handleGeoStrokeMouseDown,
    handleGeoStrokeMouseMove,
    handleGeoStrokeMouseUp,
  } = useGeoStrokeDrafting({
    activeTool,
    isPersian,
    engineRef,
    setDraftPoints,
    onAddTerrain,
    onSelectionChange,
    mountainScale: geoHud.mountainScale,
    isMountainElevationLinked: geoHud.isMountainElevationLinked,
    mountainElevation: geoHud.mountainElevation,
    hasSnowcaps: geoHud.hasSnowcaps,
    highlandMode: geoHud.highlandMode,
    cliffHeight: geoHud.cliffHeight,
    terraceTiers: geoHud.terraceTiers,
    valleyWidth: geoHud.valleyWidth,
    riverWidth: geoHud.riverWidth,
    activeBiome: geoHud.activeBiome,
    biomeDrawMode: geoHud.biomeDrawMode,
    biomeCorridorWidth: geoHud.biomeCorridorWidth,
    biomeDensity: geoHud.biomeDensity,
    equippedTreeFamily: geoHud.equippedTreeFamily,
    equippedMountainFamily: geoHud.equippedMountainFamily,
    mapData: worldBible.mapData,
  });

  const isCanvasSurface = useCallback((e: React.MouseEvent | React.WheelEvent): boolean => {
    return e.target === canvasRef.current;
  }, []);

  const stopOverlayMouse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Mouse wheel zoom centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
    if (!isCanvasSurface(e)) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = clampZoom(zoom * zoomFactor);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const newPan = calculateZoomPan(cursorX, cursorY, pan, zoom, newZoom);

    setZoom(newZoom);
    setPan(newPan);
  };

  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenuState) {
      setContextMenuState(null);
    }
    if (!isCanvasSurface(e)) return;
    const worldPoint = clientToWorld(e.clientX, e.clientY);

    // Alt + left-drag zoom box
    if (e.button === 0 && e.altKey) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setZoomRectState({ x0: x, y0: y, x1: x, y1: y });
      return;
    }

    // Pan with middle or right button
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      if (e.button === 2) {
        recordRightClickStart(e.clientX, e.clientY);
      }
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    // Land Sculpt Brush continuous drag
    if (activeTool === 'land_brush') {
      if (!e.altKey) {
        handleBrushMouseDown(worldPoint);
        return;
      }
    }

    // Ruler measurement tool
    if (activeTool === 'ruler') {
      if (rulerPoints.length >= 2) {
        setRulerPoints([worldPoint]);
      } else {
        setRulerPoints((prev) => [...prev, worldPoint]);
      }
      return;
    }

    // Continuous drag-to-draw for ALL geographical elements
    if (isGeoStrokeTool) {
      handleGeoStrokeMouseDown(worldPoint);
      setDraftPoints([worldPoint]);
      return;
    }

    // Multi-point drafting tool for continents
    if (activeTool === 'terrain_continent') {
      setDraftPoints((prev) => [...prev, worldPoint]);
      return;
    }

    // Civilization & Lore tools
    const loreKind = loreKindForTool(activeTool);
    if (loreKind) {
      setLoreDraft({
        kind: loreKind,
        worldPoint,
        clientX: e.clientX,
        clientY: e.clientY,
      });
      return;
    }

    // Place settlement tool
    if (activeTool === 'place_settlement') {
      const newLoc: WorldLocation = {
        id: `loc_${Date.now().toString(36)}`,
        name: isPersian
          ? `سکونتگاه نو (${worldPoint.x}, ${worldPoint.y})`
          : `New Settlement (${worldPoint.x}, ${worldPoint.y})`,
        region: isPersian ? 'فلات باستانی' : 'Ancient Plateau',
        description: isPersian
          ? 'شهری بر روی نقشه چرمینه با راه‌های تجاری کهن'
          : 'A fortified settlement charted on parchment',
        dangerLevel: 2,
        connectedLocationIds: [],
        atmosphere: isPersian ? 'بارانداز کاروان‌ها و باروهای سنگی' : 'Caravan quays and granite ramparts',
        coordinates: worldPoint,
        elevation: 320,
        category: 'settlement',
      };
      onAddLocation(newLoc);
      onSelectionChange([{ kind: 'location', id: newLoc.id }]);
      return;
    }

    // Draw Roads & Paths tool (Plan 25)
    if (activeTool === 'draw_route') {
      handleRoadMouseDown(worldPoint);
      return;
    }

    // Draw Caravan Route tool
    if (activeTool === 'draw_caravan') {
      const locations = worldBible.locations || [];
      const clickedLoc = locations.find((l) => {
        if (!l.coordinates) return false;
        return Math.hypot(l.coordinates.x - worldPoint.x, l.coordinates.y - worldPoint.y) <= 30;
      });

      if (clickedLoc) {
        if (draftPoints.length === 0) {
          setDraftPoints([clickedLoc.coordinates!]);
          draftWindow().__pixiDraftOriginLocId = clickedLoc.id;
        } else {
          const originId = draftWindow().__pixiDraftOriginLocId;
          if (originId && originId !== clickedLoc.id) {
            const intermediate = draftPoints.slice(1);
            const origLoc = locations.find((l) => l.id === originId);
            const newRoute: WorldTradeRoute = {
              id: `tr_${Date.now().toString(36)}`,
              name: isPersian
                ? `جاده کاروان ${origLoc?.name || ''} به ${clickedLoc.name}`
                : `Caravan Route: ${origLoc?.name || ''} - ${clickedLoc.name}`,
              originLocationId: originId,
              destinationLocationId: clickedLoc.id,
              status: 'active',
              dangerLevel: 2,
              waypoints: intermediate,
              description: isPersian ? 'شاهراه بازرگانی کهن' : 'Historical commercial thoroughfare',
              commodities: [{ entityId: 'comm_goods', name: isPersian ? 'ادویه و غلات' : 'Spices & Silk' }],
            };
            onAddTradeRoute(newRoute);
            onSelectionChange([{ kind: 'trade_route', id: newRoute.id }]);
          }
          setDraftPoints([]);
          delete draftWindow().__pixiDraftOriginLocId;
        }
      } else {
        if (draftPoints.length > 0) {
          setDraftPoints((prev) => [...prev, worldPoint]);
        }
      }
      return;
    }

    // Select Tool: pick the map object under the cursor
    if (activeTool === 'select') {
      handleSelectMouseDown(e, worldPoint);
    }
  };

  // Mouse Move handler (silky 60fps local buffering)
  const handleMouseMove = (e: React.MouseEvent) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

    if (
      !isPanning &&
      !marqueeRef.current &&
      !selectionDragRef.current &&
      !zoomRectRef.current &&
      !isCanvasSurface(e)
    ) {
      return;
    }
    const worldPoint = clientToWorld(e.clientX, e.clientY);

    const isInteracting =
      isPanning ||
      Boolean(marqueeRef.current) ||
      Boolean(selectionDragRef.current) ||
      Boolean(zoomRectRef.current) ||
      Boolean(draggedNode) ||
      isDraggingGeoStrokeRef.current;

    if (!isInteracting) {
      updateHoveredCoordThrottled(worldPoint);
    }

    // Zoom box in progress
    if (zoomRectRef.current) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setZoomRectState({
        ...zoomRectRef.current,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
      });
      return;
    }

    // Marquee band in progress
    if (marqueeRef.current) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setMarqueeState({
        ...marqueeRef.current,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
      });
      return;
    }

    // Group move in progress
    if (selectionDragRef.current) {
      const move = selectionDragRef.current;
      const delta = {
        x: worldPoint.x - move.origin.x,
        y: worldPoint.y - move.origin.y,
      };
      const moved =
        move.moved ||
        Math.hypot(delta.x, delta.y) * zoom > SELECTION_DRAG_THRESHOLD_PX;
      setSelectionDragState({ ...move, delta, moved });
      return;
    }

    // Land Sculpt Brush cursor and continuous stroke accumulation
    if (activeTool === 'land_brush' && engineRef.current) {
      handleBrushMouseMove(worldPoint);
      if (isSculptingRef.current) return;
    }

    // Continuous drag-to-draw accumulation
    if (isDraggingGeoStrokeRef.current && isGeoStrokeTool && engineRef.current) {
      handleGeoStrokeMouseMove(worldPoint);
      return;
    }

    // Road drawing
    if (activeTool === 'draw_route') {
      handleRoadMouseMove(worldPoint);
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    // Update transient drag position locally
    if (draggedNode) {
      updateTransientPos(worldPoint);
    }
  };

  // Commit drag on mouse release
  const commitDragEnd = useCallback(
    (e?: React.MouseEvent | MouseEvent) => {
      // Check right-click stationary click (<5px) vs drag
      const pos = e
        ? { clientX: e.clientX, clientY: e.clientY }
        : lastMousePosRef.current;
      checkRightClickRelease(pos);

      // Finish an Alt-drag zoom box
      const box = zoomRectRef.current;
      if (box) {
        setZoomRectState(null);
        const container = containerRef.current;
        const boxWidth = Math.abs(box.x1 - box.x0);
        const boxHeight = Math.abs(box.y1 - box.y0);
        if (
          container &&
          boxWidth >= ZOOM_RECT_THRESHOLD_PX &&
          boxHeight >= ZOOM_RECT_THRESHOLD_PX
        ) {
          const rect = container.getBoundingClientRect();
          const view = calculateZoomToRect(
            box,
            { width: rect.width, height: rect.height },
            pan,
            zoom
          );
          if (view) {
            setZoom(view.zoom);
            setPan(view.pan);
          }
        }
      }

      // Finish road gesture
      handleRoadMouseUp();

      // Finish group move
      commitSelectionDragEnd(selectionDragRef.current);

      // Finish marquee selection
      commitMarqueeEnd(marqueeRef.current);

      // Finalize Land Sculpt stroke
      handleBrushMouseUp();

      // Finalize Mountain, River, Valley, or Highland continuous drag stroke
      handleGeoStrokeMouseUp();

      // Commit node drag (waypoint, route vertex, terrain vertex, transform handle)
      commitNodeDragEnd();

      setIsPanning(false);
    },
    [
      checkRightClickRelease,
      commitMarqueeEnd,
      commitNodeDragEnd,
      commitSelectionDragEnd,
      handleBrushMouseUp,
      handleGeoStrokeMouseUp,
      handleRoadMouseUp,
      lastMousePosRef,
      marqueeRef,
      pan,
      selectionDragRef,
      setIsPanning,
      setPan,
      setZoom,
      setZoomRectState,
      zoom,
      zoomRectRef,
    ]
  );

  const handleMouseLeave = () => {
    lastMousePosRef.current = null;
    if (coordRafRef.current !== null) {
      cancelAnimationFrame(coordRafRef.current);
      coordRafRef.current = null;
    }
    setHoveredCoord(null);
    engineRef.current?.clearBrushCursor();
    if (activeTool === 'draw_route') {
      engineRef.current?.renderRouteSnapPreview(null);
    }
  };

  const placements = worldBible.mapData?.placements ?? [];

  const toolHint = useMemo(() => {
    if (activeTool === 'draw_caravan') {
      return draftPoints.length === 0
        ? isPersian
          ? 'برای آغاز مسیر تجاری روی یک سکونتگاه کلیک کنید'
          : 'Click a settlement to start a trade corridor'
        : isPersian
          ? 'روی سکونتگاه مقصد کلیک کنید تا مسیر کامل شود'
          : 'Click the destination settlement to finish the corridor';
    }
    const kind = loreKindForTool(activeTool);
    if (kind) {
      return isPersian
        ? `${loreKindLabel(kind, true)} — روی نقشه کلیک کنید تا جای آن را برگزینید`
        : `${loreKindLabel(kind, false)} — click the map to choose the spot`;
    }
    return null;
  }, [activeTool, draftPoints.length, isPersian]);

  const handleCanvasDoubleClick = (event: React.MouseEvent) => {
    if (activeTool === 'select' && engineRef.current) {
      const worldPoint = clientToWorld(event.clientX, event.clientY);
      const hit = engineRef.current.pickAt(worldPoint, settings.visibleLayers);
      if (hit && (hit.kind === 'terrain' || hit.kind === 'terrain_vertex' || hit.kind === 'transform_handle')) {
        setIsVertexEditMode((prev) => !prev);
        return;
      }
    }
    if (activeTool === 'draw_route') {
      const point = clientToWorld(event.clientX, event.clientY);
      const snap = snapRouteAt(point);
      finishRouteDraft(point, snap?.endpoint);
      return;
    }
    handleDoubleClick(event);
  };

  // Window mouseup listener for off-canvas releases
  useEffect(() => {
    const onGlobalMouseUp = () => {
      commitDragEnd();
    };

    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [commitDragEnd]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuState(null);
  }, [setContextMenuState]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={commitDragEnd}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleCanvasDoubleClick}
      onContextMenu={handleContextMenu}
      className={`relative w-full h-full overflow-hidden select-none ${
        isPanning || selectionDrag
          ? 'cursor-grabbing'
          : zoomRect || isAltHeld
          ? 'cursor-zoom-in'
          : 'cursor-crosshair'
      }`}
      style={{ backgroundColor: VINTAGE_PARCHMENT.bgParchmentHex }}
    >
      {/* PixiJS WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      <CanvasOverlays
        marquee={marquee}
        zoomRect={zoomRect}
        hoveredCoord={hoveredCoord}
        zoom={zoom}
        draftPointCount={draftPoints.length}
        toolHint={toolHint}
        isPersian={isPersian}
        marqueeThresholdPx={MARQUEE_THRESHOLD_PX}
        zoomRectThresholdPx={ZOOM_RECT_THRESHOLD_PX}
        stopOverlayMouse={stopOverlayMouse}
      />

      {activeTool === 'land_brush' && (
        <LandSculptHud
          isPersian={isPersian}
          sculptMode={geoHud.sculptMode}
          onModeChange={geoHud.setSculptMode}
          brushSize={geoHud.brushSize}
          onBrushSizeChange={geoHud.setBrushSize}
          brushRoughness={geoHud.brushRoughness}
          onBrushRoughnessChange={geoHud.setBrushRoughness}
          terrainFeatures={worldBible.mapData?.terrainFeatures ?? []}
          onReplaceTerrain={onReplaceTerrain}
          stopOverlayMouse={stopOverlayMouse}
        />
      )}

      <GeoToolHud
        activeTool={activeTool}
        isPersian={isPersian}
        stopOverlayMouse={stopOverlayMouse}
        highlandMode={geoHud.highlandMode}
        onHighlandModeChange={geoHud.setHighlandMode}
        cliffHeight={geoHud.cliffHeight}
        onCliffHeightChange={geoHud.setCliffHeight}
        terraceTiers={geoHud.terraceTiers}
        onTerraceTiersChange={geoHud.setTerraceTiers}
        activeBiome={geoHud.activeBiome}
        onBiomeChange={geoHud.setActiveBiome}
        biomeDrawMode={geoHud.biomeDrawMode}
        onBiomeDrawModeChange={geoHud.setBiomeDrawMode}
        biomeCorridorWidth={geoHud.biomeCorridorWidth}
        onBiomeCorridorWidthChange={geoHud.setBiomeCorridorWidth}
        biomeDensity={geoHud.biomeDensity}
        onBiomeDensityChange={geoHud.setBiomeDensity}
        valleyWidth={geoHud.valleyWidth}
        onValleyWidthChange={geoHud.setValleyWidth}
        mountainScale={geoHud.mountainScale}
        onMountainScaleChange={geoHud.handleMountainScaleChange}
        isElevationLinked={geoHud.isMountainElevationLinked}
        onToggleElevationLink={geoHud.toggleElevationLink}
        mountainElevation={geoHud.mountainElevation}
        onMountainElevationChange={geoHud.handleMountainElevationChange}
        hasSnowcaps={geoHud.hasSnowcaps}
        onToggleSnowcaps={geoHud.toggleSnowcaps}
        riverWidth={geoHud.riverWidth}
        onRiverWidthChange={geoHud.setRiverWidth}
        equippedTreeFamily={geoHud.equippedTreeFamily}
        equippedMountainFamily={geoHud.equippedMountainFamily}
        onOpenSpeciesPicker={geoHud.openSpeciesPicker}
      />

      <GeoSpeciesPickerModal
        isOpen={geoHud.isSpeciesPickerOpen}
        onClose={geoHud.closeSpeciesPicker}
        categoryFilter={geoHud.speciesPickerCategory}
        currentlySelectedFamily={
          geoHud.speciesPickerCategory === 'mountain'
            ? geoHud.equippedMountainFamily
            : geoHud.equippedTreeFamily
        }
        onSelectFamily={(familyId) => {
          if (geoHud.speciesPickerCategory === 'mountain' || activeTool === 'terrain_mountain') {
            geoHud.setEquippedMountainFamily(familyId);
          } else {
            geoHud.setEquippedTreeFamily(familyId);
          }
        }}
        isPersian={isPersian}
      />

      {contextMenuState && (
        <CartographerContextMenu
          x={contextMenuState.clientX}
          y={contextMenuState.clientY}
          worldPoint={contextMenuState.worldPoint}
          environmentalContext={contextMenuState.environmentalContext}
          worldBible={worldBible}
          targetHitObject={contextMenuState.targetHitObject}
          initialSection={contextMenuState.initialSection}
          isPersian={isPersian}
          onClose={handleCloseContextMenu}
          onSelectObject={(ref) => {
            const hitRef: MapObjectRef = { kind: ref.kind as any, id: ref.id };
            const group = findGroupForRef(groupsRef.current, hitRef);
            onSelectionChange(group ? group.memberRefs : [hitRef]);
          }}
          onDeleteObject={onDeleteObject}
          onAskOracle={onAskOracle}
          onAddGeneratedElement={(payload) => {
            if (onAddGeneratedElement) {
              onAddGeneratedElement(payload);
            }
            setContextMenuState(null);
          }}
        />
      )}

      {loreDraftIsLive && loreDraft && (
        <LorePlacementPicker
          kind={loreDraft.kind}
          worldPoint={loreDraft.worldPoint}
          clientX={loreDraft.clientX}
          clientY={loreDraft.clientY}
          worldBible={worldBible}
          placements={placements}
          isPersian={isPersian}
          onPlace={handlePlaceLore}
          onGenerateWithAi={canGenerateHere ? handleGenerateLore : undefined}
          onClose={() => setLoreDraft(null)}
        />
      )}
    </div>
  );
};
