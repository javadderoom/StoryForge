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
import { SelectedMapItem } from './CartographerInspector';
import {
  PixiCartographerEngine,
  DraggedNodeData,
} from '@/lib/engines/world/pixi/PixiCartographerEngine';
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
} from 'lucide-react';

interface PixiCartographerCanvasProps {
  worldBible: WorldBible;
  settings: WorldMapSettings;
  activeTool: CartographerTool;
  selectedItem: SelectedMapItem;
  onSelectItem: (item: SelectedMapItem) => void;
  onUpdateLocation: (id: string, updated: Partial<WorldLocation>) => void;
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

export const PixiCartographerCanvas: React.FC<PixiCartographerCanvasProps> = ({
  worldBible,
  settings,
  activeTool,
  selectedItem,
  onSelectItem,
  onUpdateLocation,
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
          selectedItem,
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
      selectedItem,
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
    selectedItem,
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

  // Mouse wheel zoom centered at cursor
  const handleWheel = (e: React.WheelEvent) => {
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
    const worldPoint = clientToWorld(e.clientX, e.clientY);

    // Pan with middle mouse or Alt
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

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
      onSelectItem({ type: 'location', data: newLoc });
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
            onSelectItem({ type: 'trade_route', data: newRoute });
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

    // Select Tool: Hit test via RBush spatial index
    if (activeTool === 'select' && engineRef.current) {
      const hit = engineRef.current.spatialIndex.findNearest(worldPoint.x, worldPoint.y, 30);

      if (hit) {
        if (hit.type === 'location') {
          const loc = hit.data as WorldLocation;
          onSelectItem({ type: 'location', data: loc });

          // Start dragging buffered settlement
          const nodeData: DraggedNodeData = {
            type: 'location',
            id: loc.id,
            startPoint: loc.coordinates!,
          };
          setDraggedNode(nodeData);
          draggedNodeRef.current = nodeData;
          setTransientPos(loc.coordinates!);
          transientPosRef.current = loc.coordinates!;
          return;
        } else if (hit.type === 'waypoint') {
          const wpData = hit.data as { routeId: string; index: number; point: MapPoint };
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
        } else if (hit.type === 'terrain') {
          onSelectItem({ type: 'terrain', data: hit.data });
          return;
        }
      } else {
        // Clicked empty parchment: start panning
        setIsPanning(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    }
  };

  // Mouse Move handler (silky 60fps local buffering)
  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPoint = clientToWorld(e.clientX, e.clientY);
    setHoveredCoord(worldPoint);

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
      if (hasMoved) {
        if (active.type === 'location') {
          onUpdateLocation(active.id, { coordinates: finalPos });
        } else if (active.type === 'waypoint' && active.routeId && active.index !== undefined) {
          const route = tradeRoutesRef.current.find((r) => r.id === active.routeId);
          if (route && route.waypoints) {
            const updatedWaypoints = [...route.waypoints];
            updatedWaypoints[active.index] = finalPos;
            onUpdateTradeRoute(route.id, { waypoints: updatedWaypoints });
          }
        }
      }
    }

    setIsPanning(false);
    setDraggedNode(null);
    setTransientPos(null);
    draggedNodeRef.current = null;
    transientPosRef.current = null;
  }, [
    onUpdateLocation,
    onUpdateTradeRoute,
    onReplaceTerrain,
    worldBible.mapData?.terrainFeatures,
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

  // Double click to finish drafting terrain feature
  const handleDoubleClick = () => {
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
      onSelectItem({ type: 'terrain', data: newFeature });
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
      onSelectItem({ type: 'terrain', data: newFeature });
    }

    setDraftPoints([]);
  };

  // Cancel drafting on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftPoints([]);
        setRulerPoints([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={commitDragEnd}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      className="relative w-full h-full overflow-hidden select-none cursor-crosshair"
      style={{ backgroundColor: VINTAGE_PARCHMENT.bgParchmentHex }}
    >
      {/* PixiJS WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Land Sculpt Brush Floating HUD */}
      {activeTool === 'land_brush' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-amber-800/50 shadow-2xl text-xs select-none">
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
                title: isPersian ? 'بازنشانی به اقیانوس' : 'Reset to Ocean',
                message: isPersian
                  ? 'آیا از پاک کردن تمامی خشکی‌ها و بازنشانی نقشه به اقیانوس بی‌کران اطمینان دارید؟'
                  : 'Clear all landmasses and reset canvas to open ocean water?',
              });
              if (confirmed && onReplaceTerrain) {
                onReplaceTerrain([]);
                notify.info(isPersian ? 'نقشه به آب زلال بازنشانی شد' : 'Map reset to open ocean');
              }
            }}
            title={isPersian ? 'پاکسازی کامل خشکی‌ها' : 'Clear land to ocean'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all"
          >
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">{isPersian ? 'پاکسازی به دریا' : 'Reset Sea'}</span>
          </button>
        </div>
      )}

      {/* Floating Viewport Status Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md border border-amber-800/40 text-stone-200 text-xs shadow-lg">
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
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded bg-stone-900/80 backdrop-blur-sm border border-stone-800 text-[11px] font-mono text-stone-400">
          <Navigation className="w-3 h-3 text-stone-500" />
          <span>
            X: {hoveredCoord.x} | Y: {hoveredCoord.y}
          </span>
          <span className="text-stone-600">|</span>
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
      )}
    </div>
  );
};
