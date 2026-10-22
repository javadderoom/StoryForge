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
import {
  PixiCartographerEngine,
  DraggedNodeData,
} from '@/lib/engines/world/pixi/PixiCartographerEngine';
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
  clampZoom,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '@/lib/engines/world/pixi/pixiMath';
import { VINTAGE_PARCHMENT } from '@/lib/engines/world/pixi/vintageTheme';
import {
  interpolateStrokePoints,
  generateOrganicStamp,
  applySculptOperation,
} from '@/lib/engines/world/landSculptEngine';
import { notify } from '@/lib/notify';
import {
  Compass,
  Sparkles,
  Navigation,
  Paintbrush,
  Eraser,
  Waves,
  Trash2,
  MousePointer,
} from 'lucide-react';

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
 * The terrain types the "Clear land & water" action removes. Everything else
 * — ranges, valleys, rivers, biomes, anomalies — is the author's work and
 * survives.
 */
const LAND_AND_WATER_TYPES = new Set(['continent', 'island', 'ocean', 'sea', 'lake']);

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

export const PixiCartographerCanvas: React.FC<PixiCartographerCanvasProps> = ({
  worldBible,
  settings,
  activeTool,
  selection,
  onSelectionChange,
  onMoveSelection,
  onUpdateTradeRoute,
  onAddTradeRoute,
  onUpdateTerrain,
  onAddTerrain,
  onReplaceTerrain,
  onAddLocation,
  onAddPlacement,
  isPersian,
  zoom,
  setZoom,
  pan,
  setPan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixiCartographerEngine | null>(null);

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

  // Creation & tool drafting state
  const [draftPoints, setDraftPoints] = useState<MapPoint[]>([]);
  const [rulerPoints, setRulerPoints] = useState<MapPoint[]>([]);

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

  const draggedNodeRef = useRef<DraggedNodeData | null>(null);
  const transientPosRef = useRef<MapPoint | null>(null);
  const tradeRoutesRef = useRef(worldBible.tradeRoutes || []);

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
  }, [activeTool]);

  // A draft belongs to the tool that started it. Switching tools drops the
  // in-progress preview (the blue line and its vertex dots) so a stray click
  // never leaves a stray line on the map — and one tool's vertices can never
  // leak into the next tool's shape.
  useEffect(() => {
    setDraftPoints([]);
    setRulerPoints([]);
  }, [activeTool]);

  // Initialize Pixi Engine on mount
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
          activeTool,
          draggedNode,
          transientPos,
          draftPoints,
          rulerPoints,
          isPersian,
        });
      })
      .catch((err) => {
        console.error('Failed to initialize PixiCartographerEngine:', err);
      });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          engine.resize(width, height);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Sync pan & zoom transforms to Pixi viewport
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTransform(pan, zoom);
    }
  }, [pan, zoom]);

  // Re-render when data or interaction state changes
  useEffect(() => {
    if (!engineRef.current) return;

    engineRef.current.renderAll({
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
    });
  }, [
    worldBible,
    settings,
    selection,
    selectionDrag,
    activeTool,
    draggedNode,
    transientPos,
    draftPoints,
    rulerPoints,
    isPersian,
  ]);

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

    // Pan with the middle button, the right button, or Alt + drag. Suppressing
    // the browser menu hands the secondary button to the map, and right-drag to
    // pan is the map-editor convention — it also means the gesture a user
    // reaches for first works, instead of silently doing nothing.
    if (e.button === 1 || e.button === 2 || e.altKey) {
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

    // Multi-point drafting tool (continents, mountains, rivers, biomes)
    if (
      activeTool === 'terrain_continent' ||
      activeTool === 'terrain_mountain' ||
      activeTool === 'terrain_river' ||
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
          (window as any).__pixiDraftOriginLocId = clickedLoc.id;
        } else {
          const originId = (window as any).__pixiDraftOriginLocId;
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
          delete (window as any).__pixiDraftOriginLocId;
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
    // the middle/right button or Alt, so the primary button is free for the
    // design-tool gesture authors expect.
    if (activeTool === 'select' && engineRef.current) {
      const hit = engineRef.current.pickAt(worldPoint);
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
    if (!isPanning && !marqueeRef.current && !selectionDragRef.current && !isCanvasSurface(e)) return;
    const worldPoint = clientToWorld(e.clientX, e.clientY);
    setHoveredCoord(worldPoint);

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
    onMoveSelection,
    onUpdateTradeRoute,
    onReplaceTerrain,
    onSelectionChange,
    setMarqueeState,
    setSelectionDragState,
    worldBible.tradeRoutes,
    worldBible.mapData?.terrainFeatures,
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

  // Double click finishes the draft (Enter does the same — see the key handler).
  const handleDoubleClick = useCallback(() => {
    if (draftPoints.length < 2) return;
    if (activeTool === 'terrain_continent' || activeTool === 'terrain_biome') {
      const isBiome = activeTool === 'terrain_biome';
      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isBiome
          ? isPersian
            ? 'ناحیه اقلیمی نو'
            : 'New Biome Region'
          : isPersian
          ? 'خشکی نوبنیاد'
          : 'New Landmass',
        type: isBiome ? 'forest' : 'continent',
        polygon: draftPoints,
        color: isBiome ? '#4d5f3e' : VINTAGE_PARCHMENT.landFillHex,
        description: isPersian ? 'عنصر جغرافیایی ترسیم‌شده' : 'User-created geographical feature',
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
    } else if (
      activeTool === 'terrain_mountain' ||
      activeTool === 'terrain_river' ||
      activeTool === 'terrain_valley'
    ) {
      const type =
        activeTool === 'terrain_mountain'
          ? 'mountain_range'
          : activeTool === 'terrain_river'
          ? 'river'
          : 'valley';

      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name:
          type === 'mountain_range'
            ? isPersian
              ? 'رشته‌کوه کهن'
              : 'Ancient Mountain Ridge'
            : type === 'river'
            ? isPersian
              ? 'رودخانه خروشان'
              : 'Winding River'
            : isPersian
            ? 'دره و شکاف زمین'
            : 'Rift Valley',
        type,
        points: draftPoints,
        elevation: type === 'mountain_range' ? 3200 : type === 'valley' ? -200 : 150,
        width: type === 'river' ? 4 : 28,
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
    }

    setDraftPoints([]);
  }, [draftPoints, activeTool, isPersian, onAddTerrain, onSelectionChange]);

  // Escape cancels the draft, Enter commits it.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftPoints([]);
        setRulerPoints([]);
      } else if (e.key === 'Enter' && draftPoints.length >= 2) {
        e.preventDefault();
        handleDoubleClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDoubleClick, draftPoints.length]);

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
        isPanning || selectionDrag ? 'cursor-grabbing' : 'cursor-crosshair'
      }`}
      style={{ backgroundColor: VINTAGE_PARCHMENT.bgParchmentHex }}
    >
      {/* PixiJS WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Rubber-band selection (Plan 23). Screen-space, so it stays crisp at
          every zoom level; pointer-events-none keeps it out of the gesture. */}
      {marquee &&
        Math.abs(marquee.x1 - marquee.x0) > MARQUEE_THRESHOLD_PX &&
        Math.abs(marquee.y1 - marquee.y0) > MARQUEE_THRESHOLD_PX && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 border border-amber-500/90 bg-amber-300/15 shadow-[0_0_0_1px_rgba(255,247,226,0.55)]"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

      {/* Land Sculpt Brush Floating HUD */}
      {activeTool === 'land_brush' && (
        <div
          onMouseDown={stopOverlayMouse}
          onMouseMove={stopOverlayMouse}
          onMouseUp={stopOverlayMouse}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-amber-800/50 shadow-2xl text-xs select-none"
        >
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setSculptMode('paint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                sculptMode === 'paint'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>{isPersian ? 'افزودن خشکی' : 'Paint Land'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSculptMode('carve')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                sculptMode === 'carve'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>{isPersian ? 'تراشیدن آب / دریا' : 'Carve Water'}</span>
            </button>
          </div>

          {/* Brush Size Slider */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'اندازه قلم:' : 'Size:'}
            </span>
            <input
              type="range"
              min={20}
              max={180}
              step={5}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-amber-400 w-10 text-right" dir="ltr">
              {brushSize}px
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Roughness Slider */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'زبری ساحل:' : 'Roughness:'}
            </span>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={brushRoughness}
              onChange={(e) => setBrushRoughness(Number(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-amber-400 w-9 text-right" dir="ltr">
              {Math.round(brushRoughness * 100)}%
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Reset to Ocean Button */}
          <button
            type="button"
            onClick={async () => {
              const confirmed = await notify.confirm({
                title: isPersian ? 'پاکسازی خشکی و آب' : 'Clear land & water',
                message: isPersian
                  ? 'همهٔ خشکی‌ها، جزیره‌ها و آب‌های نقشه حذف می‌شوند. رشته‌کوه‌ها، دره‌ها، رودها و اقلیم‌ها دست‌نخورده می‌مانند.'
                  : 'All landmasses, islands and water bodies are removed. Mountain ranges, valleys, rivers and biomes are kept.',
              });
              if (confirmed && onReplaceTerrain) {
                // Plan 21: this used to clear EVERY terrain feature while the
                // label claimed "landmasses" — it silently destroyed the
                // author's ranges, rivers and biomes. Now it removes land and
                // standing water only, and the action stays undoable.
                const kept = (worldBible.mapData?.terrainFeatures ?? []).filter(
                  (f) => !LAND_AND_WATER_TYPES.has(f.type)
                );
                onReplaceTerrain(kept);
                notify.info(
                  isPersian
                    ? 'خشکی و آب نقشه پاک شد'
                    : 'Land and water cleared — ranges, rivers and biomes kept'
                );
              }
            }}
            title={isPersian ? 'پاکسازی خشکی و آب' : 'Clear land and water'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">{isPersian ? 'پاکسازی خشکی و آب' : 'Clear Land'}</span>
          </button>
        </div>
      )}

      {/* Floating Viewport Status Badge */}
      <div
        onMouseDown={stopOverlayMouse}
        onMouseMove={stopOverlayMouse}
        onMouseUp={stopOverlayMouse}
        className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md border border-amber-800/40 text-stone-200 text-xs shadow-lg"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className="font-serif font-medium tracking-wide">
          {isPersian ? 'موتور شتاب‌یافته WebGL • سبک چرمینه کلاسیک' : 'PixiJS WebGL • Vintage Parchment Engine'}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-700/50">
          v8 GPU
        </span>
      </div>

      {/* Coordinate HUD */}
      {hoveredCoord && (
        <div
          onMouseDown={stopOverlayMouse}
          onMouseMove={stopOverlayMouse}
          onMouseUp={stopOverlayMouse}
          className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded bg-stone-900/80 backdrop-blur-sm border border-stone-800 text-[11px] font-mono text-stone-400"
        >
          <Navigation className="w-3 h-3 text-stone-500" />
          <span>
            X: {hoveredCoord.x} | Y: {hoveredCoord.y}
          </span>
          <span className="text-stone-600">|</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
          <span className="text-stone-600">|</span>
          <span className="text-stone-500">
            {isPersian ? 'کشیدن: انتخاب · راست: جابجایی' : 'Drag: select · Right-drag: pan'}
          </span>
        </div>
      )}

      {/* Draft hint — the preview alone never says how to finish a shape */}
      {draftPoints.length > 0 && (
        <div
          onMouseDown={stopOverlayMouse}
          onMouseMove={stopOverlayMouse}
          onMouseUp={stopOverlayMouse}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-950/85 backdrop-blur-sm border border-sky-800/60 text-[11px] text-sky-100 shadow-lg"
        >
          <MousePointer className="w-3 h-3 text-sky-400" />
          <span>
            {isPersian
              ? `${draftPoints.length} نقطه — برای ثبت دوبار کلیک کنید یا Enter بزنید · Esc برای لغو`
              : `${draftPoints.length} point${draftPoints.length === 1 ? '' : 's'} — double-click or press Enter to commit · Esc to cancel`}
          </span>
        </div>
      )}
    </div>
  );
};
