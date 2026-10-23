'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  WorldBible,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapPoint,
} from '@/lib/types';
import { CartographerTool } from './CartographerHeader';
import type { DraggedNodeData } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import {
  marqueeSelectRefs,
  mergeMapObjectRefs,
  sameMapObjectRef,
  toggleMapObjectRef,
  type MapObjectRef,
} from '@/lib/engines/world/mapSelection';
import {
  screenToWorld,
  calculateZoomPan,
  calculateZoomToRect,
  clampZoom,
} from '@/lib/engines/world/pixi/pixiMath';
import { VINTAGE_PARCHMENT } from '@/lib/engines/world/pixi/vintageTheme';
import {
  interpolateStrokePoints,
  generateOrganicStamp,
  applySculptOperation,
} from '@/lib/engines/world/landSculptEngine';
import { usePixiEngine } from './canvas/usePixiEngine';
import { useMapDrafting } from './canvas/useMapDrafting';
import { CanvasOverlays } from './canvas/CanvasOverlays';
import { LandSculptHud } from './canvas/LandSculptHud';

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
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onAddTerrain: (feature: MapTerrainFeature) => void;
  onReplaceTerrain?: (features: MapTerrainFeature[]) => void;
  onAddLocation: (location: WorldLocation) => void;
  onAddPlacement: (placement: MapEntityPlacement) => void;
  isPersian: boolean;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

/**
 * A rubber band in progress, in container-relative screen pixels.
 *
 * `base` is the selection the band started from when Shift/Ctrl is held, so
 * an additive band unions with what was already selected instead of replacing
 * it.
 */
interface MarqueeState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
  base: MapObjectRef[];
}

/** A click that never moved further than this is not a rubber band. */
const MARQUEE_THRESHOLD_PX = 3;

/**
 * A group move in progress.
 *
 * `origin` and `delta` are world-space. The world is not mutated while the
 * pointer moves: the engine draws the selected objects translated by `delta`,
 * and only mouseup commits the move (one undo step, one world update).
 */
interface SelectionDragState {
  refs: MapObjectRef[];
  origin: MapPoint;
  delta: MapPoint;
  moved: boolean;
}

/** Screen-space distance before a press becomes a drag. */
const SELECTION_DRAG_THRESHOLD_PX = 3;

/**
 * An Alt + left-drag zoom box, in container-relative screen pixels.
 *
 * Released below the threshold it is a no-op: the gesture is navigation, so it
 * must never be mistaken for a selection click.
 */
interface ZoomRectState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Both axes must clear this before a zoom box is worth applying. */
const ZOOM_RECT_THRESHOLD_PX = 8;

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
  onAddTerrain,
  onReplaceTerrain,
  onAddLocation,
  isPersian,
  zoom,
  setZoom,
  pan,
  setPan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan and drag states
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredCoord, setHoveredCoord] = useState<MapPoint | null>(null);

  // Rubber-band selection (Plan 23). The ref mirrors the state so the mouseup
  // path can read the band synchronously without re-binding global listeners
  // on every pointer move.
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const setMarqueeState = useCallback((next: MarqueeState | null) => {
    marqueeRef.current = next;
    setMarquee(next);
  }, []);

  // Group move in progress (Plan 23). Same ref-mirror trick: the mouseup path
  // needs the live delta without re-binding the global mouseup listener.
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragState | null>(null);
  const selectionDragRef = useRef<SelectionDragState | null>(null);
  const setSelectionDragState = useCallback((next: SelectionDragState | null) => {
    selectionDragRef.current = next;
    setSelectionDrag(next);
  }, []);

  // Alt + left-drag zoom box. The ref mirror lets mouseup read the final
  // rectangle without rebinding the global listener on every pixel.
  const [zoomRect, setZoomRect] = useState<ZoomRectState | null>(null);
  const zoomRectRef = useRef<ZoomRectState | null>(null);
  const setZoomRectState = useCallback((next: ZoomRectState | null) => {
    zoomRectRef.current = next;
    setZoomRect(next);
  }, []);

  // Show the zoom cursor while Alt is held, even before the drag starts.
  const [isAltHeld, setIsAltHeld] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(false);
    };
    const onBlur = () => setIsAltHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Buffered drag state for zero-server-request 60fps moves
  const [draggedNode, setDraggedNode] = useState<DraggedNodeData | null>(null);
  const [transientPos, setTransientPos] = useState<MapPoint | null>(null);

  // Land Sculpt Brush controls
  const [sculptMode, setSculptMode] = useState<'paint' | 'carve'>('paint');
  const [brushSize, setBrushSize] = useState<number>(65);
  const [brushRoughness, setBrushRoughness] = useState<number>(0.35);

  const isSculptingRef = useRef(false);
  const accumulatedStampsRef = useRef<MapPoint[][]>([]);
  const lastStrokePointRef = useRef<MapPoint | null>(null);
  const strokeSeedRef = useRef<number>(42);

  // Drag-to-Generate geography strokes (Mountains & Rivers)
  const isDraggingGeoStrokeRef = useRef(false);
  const geoStrokePointsRef = useRef<MapPoint[]>([]);
  const geoStrokeSeedRef = useRef<number>(42);

  const draggedNodeRef = useRef<DraggedNodeData | null>(null);
  const transientPosRef = useRef<MapPoint | null>(null);
  const tradeRoutesRef = useRef(worldBible.tradeRoutes || []);
  const cancelZoomBox = useCallback(() => setZoomRectState(null), [setZoomRectState]);

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
    pan,
    zoom,
  });

  useEffect(() => {
    draggedNodeRef.current = draggedNode;
  }, [draggedNode]);

  useEffect(() => {
    transientPosRef.current = transientPos;
  }, [transientPos]);

  useEffect(() => {
    tradeRoutesRef.current = worldBible.tradeRoutes || [];
  }, [worldBible.tradeRoutes]);

  useEffect(() => {
    if (activeTool !== 'land_brush' && engineRef.current) {
      engineRef.current.clearBrushCursor();
      engineRef.current.clearBrushPreview();
    }
  }, [activeTool, engineRef]);


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

  /**
   * True when the event happened on the map surface itself.
   *
   * The floating overlays (brush HUD, coordinate readout, engine badge) live
   * INSIDE the canvas container, so their events bubble into the container's
   * handlers. Without this guard, dragging the brush-size slider painted land
   * and clicking the HUD started a sculpt stroke.
   */
  const isCanvasSurface = useCallback((e: React.MouseEvent | React.WheelEvent): boolean => {
    return e.target === canvasRef.current;
  }, []);

  /** Stops an overlay's mouse events from reaching the canvas handlers. */
  const stopOverlayMouse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  /**
   * Right-click belongs to the map, not to the browser.
   *
   * Without this the canvas behaves like an image: the browser menu ("Save
   * image as…", "Reload", "Inspect") opens in the middle of drawing and would
   * also fire at the end of a right-drag pan. Suppressing it is what lets the
   * secondary button be a navigation gesture.
   */
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
    // Overlays (brush HUD, HUD badges) are children of this container — a click
    // on them must never start a stroke, a drag, or a pan.
    if (!isCanvasSurface(e)) return;
    const worldPoint = clientToWorld(e.clientX, e.clientY);

    // Alt + left-drag is the design-tool zoom box. It runs before every tool,
    // so holding Alt can never drop a vertex or start a sculpt stroke.
    if (e.button === 0 && e.altKey) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setZoomRectState({ x0: x, y0: y, x1: x, y1: y });
      return;
    }

    // Pan with the middle or right button. Suppressing the browser menu hands
    // the secondary button to the map, and right-drag to pan is the map-editor
    // convention — it also means the gesture a user reaches for first works,
    // instead of silently doing nothing.
    if (e.button === 1 || e.button === 2) {
      // Also stops Chrome's middle-click autoscroll and any native drag.
      e.preventDefault();
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Only the primary button runs a tool; the side buttons stay inert here, so
    // a mis-click cannot drop a vertex or a settlement.
    if (e.button !== 0) return;

    // Land Sculpt Brush continuous drag
    if (activeTool === 'land_brush') {
      if (e.button === 0 && !e.altKey) {
        isSculptingRef.current = true;
        strokeSeedRef.current = Math.floor(Math.random() * 10000);
        const stamp = generateOrganicStamp(
          worldPoint.x,
          worldPoint.y,
          brushSize,
          brushRoughness,
          strokeSeedRef.current
        );
        accumulatedStampsRef.current = [stamp];
        lastStrokePointRef.current = worldPoint;
        engineRef.current?.renderBrushPreview(accumulatedStampsRef.current, sculptMode);
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

    // Continuous drag-to-draw for Mountains and Rivers
    if (activeTool === 'terrain_mountain' || activeTool === 'terrain_river') {
      isDraggingGeoStrokeRef.current = true;
      geoStrokeSeedRef.current = Math.floor(Math.random() * 100000);
      geoStrokePointsRef.current = [worldPoint];
      setDraftPoints((prev) => [...prev, worldPoint]);
      return;
    }

    // Multi-point drafting tool (continents, valleys, biomes)
    if (
      activeTool === 'terrain_continent' ||
      activeTool === 'terrain_valley' ||
      activeTool === 'terrain_biome'
    ) {
      setDraftPoints((prev) => [...prev, worldPoint]);
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

    // Select Tool: pick the map object under the cursor.
    //
    // Plan 21: the pick is geometry-accurate (point-in-polygon for landmasses,
    // distance-to-segment for rivers and routes), so every authored shape can
    // be selected — and therefore opened in the Inspector and deleted.
    //
    // Plan 23: Shift/Ctrl-click toggles one object in the selection, and a
    // drag that starts on empty parchment draws a rubber band. Panning is on
    // the middle/right button, and Alt + left-drag is the zoom box, so the
    // primary button is free for the design-tool gestures authors expect.
    if (activeTool === 'select' && engineRef.current) {
      // Layer switches hide objects visually; they must hide them from the
      // picker too, otherwise clicking their empty spot still selects them.
      const hit = engineRef.current.pickAt(worldPoint, settings.visibleLayers);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;

      if (hit) {
        const hitRef: MapObjectRef =
          hit.kind === 'waypoint'
            ? { kind: 'trade_route', id: hit.candidate.routeId }
            : hit.kind === 'location'
            ? { kind: 'location', id: hit.candidate.location.id }
            : hit.kind === 'terrain'
            ? { kind: 'terrain', id: hit.candidate.feature.id }
            : hit.kind === 'placement'
            ? { kind: 'placement', id: hit.candidate.placement.id }
            : { kind: 'trade_route', id: hit.candidate.route.id };

        if (additive) {
          onSelectionChange(toggleMapObjectRef(selection, hitRef));
          return;
        }

        // A waypoint is an edit handle, not a selection member: select the
        // owning route, then drag only that vertex.
        if (hit.kind === 'waypoint') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const wpData = hit.candidate;
          const nodeData: DraggedNodeData = {
            type: 'waypoint',
            id: hit.id,
            routeId: wpData.routeId,
            index: wpData.index,
            startPoint: wpData.point,
          };
          setDraggedNode(nodeData);
          draggedNodeRef.current = nodeData;
          setTransientPos(wpData.point);
          transientPosRef.current = wpData.point;
          return;
        }

        const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
        // Plan 23: a member of a multi-selection stays selected when pressed,
        // because dragging now moves the whole set — the design-tool behaviour.
        if (!alreadySelected) onSelectionChange([hitRef]);

        const dragRefs = alreadySelected ? selection : [hitRef];
        const hasMovableGeometry = dragRefs.some((ref) => {
          if (ref.kind !== 'trade_route') return true;
          const route = (worldBible.tradeRoutes ?? []).find((r) => r.id === ref.id);
          return Boolean(route?.waypoints?.length);
        });
        // A route with no waypoints has nothing of its own to move (its ends
        // are towns). Leave it selected without starting a dead drag.
        if (!hasMovableGeometry) return;

        // No preventDefault: pressing the map should blur a focused Inspector
        // field so arrow-key nudges reach the map again.
        setSelectionDragState({
          refs: dragRefs,
          origin: worldPoint,
          delta: { x: 0, y: 0 },
          moved: false,
        });
        return;
      }

      // Empty parchment: begin a rubber band. A press-and-release without
      // movement clears the selection when it ends.
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      setMarqueeState({
        x0: e.clientX - rect.left,
        y0: e.clientY - rect.top,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
        additive,
        base: additive ? selection : [],
      });
      return;
    }
  };

  // Mouse Move handler (silky 60fps local buffering)
  const handleMouseMove = (e: React.MouseEvent) => {
    // A pan or rubber band in progress owns the pointer: keep tracking it even
    // when the drag crosses a floating overlay, otherwise the map (or the
    // band) freezes for as long as the cursor is over the badge.
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
    setHoveredCoord(worldPoint);

    // Zoom box in progress: track it even when the pointer crosses an overlay.
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

    // Group move in progress: track the delta; the world is untouched until
    // mouseup and the engine renders the selected objects translated.
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
      engineRef.current.renderBrushCursor(worldPoint, brushSize, sculptMode);

      if (isSculptingRef.current && lastStrokePointRef.current) {
        const dist = Math.hypot(
          worldPoint.x - lastStrokePointRef.current.x,
          worldPoint.y - lastStrokePointRef.current.y
        );
        const stepSize = Math.max(10, brushSize * 0.35);
        if (dist >= stepSize) {
          const subPoints = interpolateStrokePoints(
            lastStrokePointRef.current,
            worldPoint,
            stepSize,
            false
          );
          for (const pt of subPoints) {
            strokeSeedRef.current = (strokeSeedRef.current + 1) % 10000;
            accumulatedStampsRef.current.push(
              generateOrganicStamp(
                pt.x,
                pt.y,
                brushSize,
                brushRoughness,
                strokeSeedRef.current
              )
            );
          }
          lastStrokePointRef.current = worldPoint;
          engineRef.current.renderBrushPreview(accumulatedStampsRef.current, sculptMode);
        }
        return;
      }
    }

    // Mountain & River continuous drag-to-draw accumulation (60 FPS local preview)
    if (
      isDraggingGeoStrokeRef.current &&
      (activeTool === 'terrain_mountain' || activeTool === 'terrain_river') &&
      engineRef.current
    ) {
      const pts = geoStrokePointsRef.current;
      const lastPt = pts[pts.length - 1];
      const dist = lastPt ? Math.hypot(worldPoint.x - lastPt.x, worldPoint.y - lastPt.y) : 999;
      if (dist >= 14) {
        pts.push(worldPoint);
        if (activeTool === 'terrain_mountain') {
          engineRef.current.renderMountainStrokePreview(pts, {
            seed: geoStrokeSeedRef.current,
            scale: 55,
            rangeWidth: 32,
          });
        } else {
          engineRef.current.renderRiverStrokePreview(pts, {
            seed: geoStrokeSeedRef.current,
            startWidth: 2.0,
            endWidth: 10.0,
            meanderRoughness: 0.35,
          });
        }
      }
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    // Update transient drag position locally without sending network requests
    if (draggedNode) {
      setTransientPos(worldPoint);
      transientPosRef.current = worldPoint;
    }
  };

  // Commit drag on mouse release
  const commitDragEnd = useCallback(() => {
    // Finish an Alt-drag zoom box: fit that area into the viewport. A box that
    // never cleared the threshold is a click, not a zoom, and leaves the view
    // untouched.
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

    // Finish a group move: one translation for the whole selection, committed
    // once (the page turns it into a single undo step).
    const move = selectionDragRef.current;
    if (move) {
      setSelectionDragState(null);
      if (move.moved) {
        const dx = Math.round(move.delta.x);
        const dy = Math.round(move.delta.y);
        if (dx !== 0 || dy !== 0) onMoveSelection(move.refs, dx, dy);
      }
    }

    // Finish a rubber-band selection first: it is a viewport gesture and must
    // not fall through to the sculpt/drag cleanup below.
    const band = marqueeRef.current;
    if (band) {
      setMarqueeState(null);
      const moved =
        Math.abs(band.x1 - band.x0) > MARQUEE_THRESHOLD_PX ||
        Math.abs(band.y1 - band.y0) > MARQUEE_THRESHOLD_PX;

      if (!moved) {
        // A plain click on empty parchment clears; Shift/Ctrl-click keeps it.
        if (!band.additive) onSelectionChange([]);
      } else {
        const topLeft = screenToWorld(
          Math.min(band.x0, band.x1),
          Math.min(band.y0, band.y1),
          pan,
          zoom
        );
        const bottomRight = screenToWorld(
          Math.max(band.x0, band.x1),
          Math.max(band.y0, band.y1),
          pan,
          zoom
        );
        const bandMapData = worldBible.mapData ?? worldBible.ontology?.mapData;
        const hits = marqueeSelectRefs(
          {
            locations: worldBible.locations,
            tradeRoutes: worldBible.tradeRoutes,
            terrainFeatures: bandMapData?.terrainFeatures,
            placements: bandMapData?.placements,
            placeCategories: worldBible.ontology?.placeCategories,
          },
          {
            minX: topLeft.x,
            minY: topLeft.y,
            maxX: bottomRight.x,
            maxY: bottomRight.y,
          },
          settings
        );
        onSelectionChange(band.additive ? mergeMapObjectRefs(band.base, hits) : hits);
      }
    }

    // Finalize Land Sculpt stroke
    if (isSculptingRef.current) {
      isSculptingRef.current = false;
      lastStrokePointRef.current = null;
      engineRef.current?.clearBrushPreview();

      const stamps = [...accumulatedStampsRef.current];
      accumulatedStampsRef.current = [];

      if (stamps.length > 0 && onReplaceTerrain) {
        const currentTerrain = worldBible.mapData?.terrainFeatures || [];
        const updated = applySculptOperation(
          currentTerrain,
          stamps,
          sculptMode,
          {
            simplifyTolerance: 1.5,
            minArea: 15,
            minHoleArea: 25,
          }
        );
        onReplaceTerrain(updated);
      }
    }

    // Finalize Mountain or River continuous drag stroke
    if (isDraggingGeoStrokeRef.current) {
      isDraggingGeoStrokeRef.current = false;
      engineRef.current?.clearBrushPreview();

      const strokePts = [...geoStrokePointsRef.current];
      geoStrokePointsRef.current = [];

      let totalStrokeDist = 0;
      for (let i = 0; i < strokePts.length - 1; i++) {
        totalStrokeDist += Math.hypot(strokePts[i + 1].x - strokePts[i].x, strokePts[i + 1].y - strokePts[i].y);
      }

      if (strokePts.length >= 2 && totalStrokeDist > 25) {
        const isMountain = activeTool === 'terrain_mountain';
        const isRiver = activeTool === 'terrain_river';
        if (isMountain || isRiver) {
          const newFeature: MapTerrainFeature = {
            id: `terr_${Date.now().toString(36)}`,
            name: isMountain
              ? (isPersian ? 'رشته‌کوه کهن' : 'Ancient Mountain Ridge')
              : (isPersian ? 'رودخانه خروشان' : 'Winding River'),
            type: isMountain ? 'mountain_range' : 'river',
            points: strokePts,
            elevation: isMountain ? 3200 : 150,
            width: isMountain ? 28 : 10,
          };
          onAddTerrain(newFeature);
          onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
          setDraftPoints([]);
        }
      }
    }

    const active = draggedNodeRef.current;
    const finalPos = transientPosRef.current;

    if (active && finalPos) {
      const hasMoved = active.startPoint.x !== finalPos.x || active.startPoint.y !== finalPos.y;
      if (hasMoved && active.type === 'waypoint' && active.routeId && active.index !== undefined) {
        const route = tradeRoutesRef.current.find((r) => r.id === active.routeId);
        if (route && route.waypoints) {
          const updatedWaypoints = [...route.waypoints];
          updatedWaypoints[active.index] = finalPos;
          onUpdateTradeRoute(route.id, { waypoints: updatedWaypoints });
        }
      }
    }

    setIsPanning(false);
    setDraggedNode(null);
    setTransientPos(null);
    draggedNodeRef.current = null;
    transientPosRef.current = null;
  }, [
    onAddTerrain,
    activeTool,
    isPersian,
    setDraftPoints,
    engineRef,
    onMoveSelection,
    onUpdateTradeRoute,
    onReplaceTerrain,
    onSelectionChange,
    setMarqueeState,
    setSelectionDragState,
    setZoomRectState,
    setZoom,
    setPan,
    worldBible.locations,
    worldBible.tradeRoutes,
    worldBible.mapData,
    worldBible.ontology?.mapData,
    worldBible.ontology?.placeCategories,
    settings,
    pan,
    zoom,
    sculptMode,
  ]);

  const handleMouseLeave = () => {
    engineRef.current?.clearBrushCursor();
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

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={commitDragEnd}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
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
        isPersian={isPersian}
        marqueeThresholdPx={MARQUEE_THRESHOLD_PX}
        zoomRectThresholdPx={ZOOM_RECT_THRESHOLD_PX}
        stopOverlayMouse={stopOverlayMouse}
      />

      {activeTool === 'land_brush' && (
        <LandSculptHud
          isPersian={isPersian}
          sculptMode={sculptMode}
          onModeChange={setSculptMode}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          brushRoughness={brushRoughness}
          onBrushRoughnessChange={setBrushRoughness}
          terrainFeatures={worldBible.mapData?.terrainFeatures ?? []}
          onReplaceTerrain={onReplaceTerrain}
          stopOverlayMouse={stopOverlayMouse}
        />
      )}
    </div>
  );
};
