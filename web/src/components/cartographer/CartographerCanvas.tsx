'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  WorldBible,
  WorldLocation,
  WorldTradeRoute,
  NPCDossier,
  MapTerrainFeature,
  MapPoint,
  MapEntityPlacement,
  WorldMapSettings,
} from '@/lib/types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  THEME_PALETTES,
  pointsToSmoothSvgPath,
  polygonToSvgPath,
  calculateMapDistance,
  calculateCaravanTravelDays,
} from '@/lib/engines/world/cartographerEngine';
import { CartographerTool } from './CartographerHeader';
import { SelectedMapItem } from './CartographerInspector';
import {
  Castle,
  Route as RouteIcon,
  Mountain,
  MapPin,
  Compass,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  AlertTriangle,
  Waves,
} from 'lucide-react';

interface CartographerCanvasProps {
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
  onAddLocation: (location: WorldLocation) => void;
  onAddPlacement: (placement: MapEntityPlacement) => void;
  isPersian: boolean;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
}

export const CartographerCanvas: React.FC<CartographerCanvasProps> = ({
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
  onAddLocation,
  onAddPlacement,
  isPersian,
  zoom,
  setZoom,
  pan,
  setPan,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredCoord, setHoveredCoord] = useState<MapPoint | null>(null);

  // In-progress drafting state for creation tools
  const [draftPoints, setDraftPoints] = useState<MapPoint[]>([]);
  const [draggedNode, setDraggedNode] = useState<{
    type: 'location' | 'waypoint';
    id: string;
    routeId?: string;
    index?: number;
  } | null>(null);

  // Ruler measurement state
  const [rulerPoints, setRulerPoints] = useState<MapPoint[]>([]);

  const palette = THEME_PALETTES[settings.theme] || THEME_PALETTES.parchment;

  const locations = worldBible.locations || [];
  const tradeRoutes = worldBible.tradeRoutes || [];
  const terrainFeatures = worldBible.mapData?.terrainFeatures || [];
  const placements = worldBible.mapData?.placements || [];
  const npcs = worldBible.npcs || [];

  // Convert screen client coordinates to World SVG coordinates
  const clientToWorldCoords = useCallback(
    (clientX: number, clientY: number): MapPoint => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left - pan.x;
      const rawY = clientY - rect.top - pan.y;
      return {
        x: Math.round(rawX / zoom),
        y: Math.round(rawY / zoom),
      };
    },
    [pan, zoom]
  );

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(3.0, Math.max(0.25, zoom * zoomFactor));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Mouse down on canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || activeTool === 'select') {
      // Pan mode
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const worldPoint = clientToWorldCoords(e.clientX, e.clientY);

    // If using the travel ruler
    if (activeTool === 'ruler') {
      if (rulerPoints.length >= 2) {
        setRulerPoints([worldPoint]);
      } else {
        setRulerPoints([...rulerPoints, worldPoint]);
      }
      return;
    }

    // If drafting a multi-point feature (continent, mountain, river, valley, biome)
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

    // If placing a new Settlement with click
    if (activeTool === 'place_settlement') {
      const newLoc: WorldLocation = {
        id: `loc_${Date.now().toString(36)}`,
        name: isPersian ? `سکونتگاه نو (${worldPoint.x}, ${worldPoint.y})` : `New Settlement (${worldPoint.x}, ${worldPoint.y})`,
        region: isPersian ? 'فلات مرکزی' : 'Central Plateau',
        description: isPersian ? 'شهری نوبنیاد در امتداد دشت و منابع آبی' : 'A newly charted city on fertile lands',
        dangerLevel: 2,
        connectedLocationIds: [],
        atmosphere: isPersian ? 'بازار پویا، دیوارهای سنگی، کاروان‌های پرهیاهو' : 'Lively markets, stone ramparts, busy caravans',
        coordinates: worldPoint,
        elevation: 350,
        category: 'settlement',
      };
      onAddLocation(newLoc);
      onSelectItem({ type: 'location', data: newLoc });
      return;
    }

    // If drawing a caravan route
    if (activeTool === 'draw_caravan') {
      // Find clicked location or place waypoint
      const clickedLoc = locations.find((l) => {
        if (!l.coordinates) return false;
        const d = Math.hypot(l.coordinates.x - worldPoint.x, l.coordinates.y - worldPoint.y);
        return d <= 30;
      });

      if (clickedLoc) {
        if (draftPoints.length === 0) {
          // Set origin
          setDraftPoints([clickedLoc.coordinates!]);
          (window as any).__draftOriginLocId = clickedLoc.id;
        } else {
          // Set destination and finish route
          const originId = (window as any).__draftOriginLocId;
          if (originId && originId !== clickedLoc.id) {
            const intermediate = draftPoints.slice(1);
            const origLoc = locations.find((l) => l.id === originId);
            const newRoute: WorldTradeRoute = {
              id: `tr_${Date.now().toString(36)}`,
              name: isPersian
                ? `جاده کاروان ${origLoc?.name || ''} به ${clickedLoc.name}`
                : `Caravan Trail: ${origLoc?.name || ''} - ${clickedLoc.name}`,
              originLocationId: originId,
              destinationLocationId: clickedLoc.id,
              status: 'active',
              dangerLevel: 2,
              waypoints: intermediate,
              description: isPersian ? 'شاهراه رفت‌وآمد کاروان‌های بازرگانی' : 'Active commercial trade thoroughfare',
              commodities: [{ entityId: 'comm_goods', name: isPersian ? 'ادویه و غلات' : 'Spices & Grain' }],
            };
            onAddTradeRoute(newRoute);
            onSelectItem({ type: 'trade_route', data: newRoute });
          }
          setDraftPoints([]);
          delete (window as any).__draftOriginLocId;
        }
      } else {
        // Add intermediate waypoint
        if (draftPoints.length > 0) {
          setDraftPoints((prev) => [...prev, worldPoint]);
        }
      }
      return;
    }
  };

  // Mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPoint = clientToWorldCoords(e.clientX, e.clientY);
    setHoveredCoord(worldPoint);

    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    // Dragging a location pin or route waypoint
    if (draggedNode) {
      if (draggedNode.type === 'location') {
        onUpdateLocation(draggedNode.id, { coordinates: worldPoint });
      } else if (draggedNode.type === 'waypoint' && draggedNode.routeId && draggedNode.index !== undefined) {
        const route = tradeRoutes.find((r) => r.id === draggedNode.routeId);
        if (route && route.waypoints) {
          const updatedWaypoints = [...route.waypoints];
          updatedWaypoints[draggedNode.index] = worldPoint;
          onUpdateTradeRoute(route.id, { waypoints: updatedWaypoints });
        }
      }
    }
  };

  // Mouse up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  // Double click to finish drafting terrain feature
  const handleDoubleClick = () => {
    if (draftPoints.length < 2) return;

    if (activeTool === 'terrain_continent' || activeTool === 'terrain_biome') {
      const isBiome = activeTool === 'terrain_biome';
      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isBiome ? (isPersian ? 'ناحیه اقلیمی نو' : 'New Biome Region') : (isPersian ? 'خشکی نوبنیاد' : 'New Landmass'),
        type: isBiome ? 'forest' : 'continent',
        polygon: draftPoints,
        color: isBiome ? '#166534' : palette.landFill,
        description: isPersian ? 'عنصر جغرافیایی ترسیم‌شده توسط نویسنده' : 'User-created geographical feature',
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
            ? (isPersian ? 'رشته‌کوه جدید' : 'New Mountain Range')
            : type === 'river'
            ? (isPersian ? 'رودخانه خروشان' : 'New River')
            : (isPersian ? 'دره و شکاف زمین' : 'New Rift Valley'),
        type,
        points: draftPoints,
        elevation: type === 'mountain_range' ? 3200 : type === 'valley' ? -200 : 150,
        width: type === 'river' ? 4 : 35,
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
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className="relative w-full h-full overflow-hidden select-none cursor-crosshair bg-zinc-950"
      style={{ backgroundColor: palette.bg }}
    >
      {/* SVG Canvas Map */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="w-full h-full block"
      >
        <defs>
          {/* Animated Water Flow Stroke Pattern */}
          <linearGradient id="riverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Caravan Dash Stroke Flow Animation */}
          <style>{`
            @keyframes caravanFlow {
              from { stroke-dashoffset: 24; }
              to { stroke-dashoffset: 0; }
            }
            .animate-caravan {
              stroke-dasharray: 8 6;
              animation: caravanFlow 1.8s linear infinite;
            }
            .animate-river {
              stroke-dasharray: 12 4;
              animation: caravanFlow 2.4s linear infinite;
            }
          `}</style>

          {/* Filters for subtle elevation shading & glow */}
          <filter id="shadowHalo" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <filter id="relicGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Global Transform Layer for Pan & Zoom */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Base Ocean / Canvas Background Rect */}
          <rect
            x={0}
            y={0}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            fill={palette.oceanBg}
          />

          {/* 2. Grid Overlay (Optional) */}
          {settings.visibleLayers.grid && settings.gridType !== 'none' && (
            <g className="pointer-events-none opacity-60">
              {settings.gridType === 'square' && (
                <>
                  {Array.from({ length: Math.ceil(CANVAS_WIDTH / settings.gridSize) }).map((_, i) => (
                    <line
                      key={`vx_${i}`}
                      x1={i * settings.gridSize}
                      y1={0}
                      x2={i * settings.gridSize}
                      y2={CANVAS_HEIGHT}
                      stroke={palette.gridColor}
                      strokeWidth={1}
                    />
                  ))}
                  {Array.from({ length: Math.ceil(CANVAS_HEIGHT / settings.gridSize) }).map((_, j) => (
                    <line
                      key={`hy_${j}`}
                      x1={0}
                      y1={j * settings.gridSize}
                      x2={CANVAS_WIDTH}
                      y2={j * settings.gridSize}
                      stroke={palette.gridColor}
                      strokeWidth={1}
                    />
                  ))}
                </>
              )}

              {settings.gridType === 'hex' && (
                <>
                  {Array.from({ length: Math.ceil(CANVAS_WIDTH / (settings.gridSize * 1.5)) }).map((_, col) =>
                    Array.from({ length: Math.ceil(CANVAS_HEIGHT / settings.gridSize) }).map((_, row) => {
                      const hx = col * settings.gridSize * 1.5;
                      const hy = row * settings.gridSize + (col % 2 === 1 ? settings.gridSize / 2 : 0);
                      const r = settings.gridSize * 0.55;
                      const hexPts = Array.from({ length: 6 }).map((_, a) => {
                        const ang = (Math.PI / 3) * a;
                        return `${(hx + r * Math.cos(ang)).toFixed(1)},${(hy + r * Math.sin(ang)).toFixed(1)}`;
                      }).join(' ');

                      return (
                        <polygon
                          key={`hex_${col}_${row}`}
                          points={hexPts}
                          fill="none"
                          stroke={palette.gridColor}
                          strokeWidth={0.8}
                        />
                      );
                    })
                  )}
                </>
              )}
            </g>
          )}

          {/* 3. Continents & Landmasses Layer */}
          {settings.visibleLayers.terrain && (
            <g id="layer-continents">
              {terrainFeatures
                .filter((f) => f.type === 'continent' || f.type === 'island')
                .map((f) => {
                  if (!f.polygon) return null;
                  const path = polygonToSvgPath(f.polygon);

                  return (
                    <g key={f.id} className="cursor-pointer">
                      {/* Coastline Shallow Buffer Halo */}
                      <path
                        d={path}
                        fill="none"
                        stroke={palette.coastlineColor}
                        strokeWidth={14}
                        strokeLinejoin="round"
                        opacity={0.35}
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={palette.landStroke}
                        strokeWidth={3}
                        strokeLinejoin="round"
                      />
                      {/* Land Fill */}
                      <path
                        d={path}
                        fill={f.color || palette.landFill}
                        stroke={palette.landStroke}
                        strokeWidth={1.5}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem({ type: 'terrain', data: f });
                        }}
                      />
                    </g>
                  );
                })}
            </g>
          )}

          {/* 4. Biomes Layer (Forests, Deserts, Swamps) */}
          {settings.visibleLayers.biomes && (
            <g id="layer-biomes" opacity={0.65}>
              {terrainFeatures
                .filter((f) => f.type === 'forest' || f.type === 'desert' || f.type === 'tundra' || f.type === 'swamp')
                .map((f) => {
                  if (!f.polygon) return null;
                  const path = polygonToSvgPath(f.polygon);

                  return (
                    <path
                      key={f.id}
                      d={path}
                      fill={f.color || '#166534'}
                      stroke={f.color || '#14532d'}
                      strokeWidth={1}
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem({ type: 'terrain', data: f });
                      }}
                    />
                  );
                })}
            </g>
          )}

          {/* 5. Lakes and Water Bodies */}
          {settings.visibleLayers.water && (
            <g id="layer-lakes">
              {terrainFeatures
                .filter((f) => f.type === 'lake')
                .map((f) => {
                  if (!f.polygon) return null;
                  const path = polygonToSvgPath(f.polygon);

                  return (
                    <path
                      key={f.id}
                      d={path}
                      fill={f.color || '#4f728c'}
                      stroke={palette.landStroke}
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem({ type: 'terrain', data: f });
                      }}
                    />
                  );
                })}
            </g>
          )}

          {/* 6. Winding Rivers Layer */}
          {settings.visibleLayers.water && (
            <g id="layer-rivers">
              {terrainFeatures
                .filter((f) => f.type === 'river' && f.points && f.points.length > 1)
                .map((f) => {
                  const d = pointsToSmoothSvgPath(f.points!);

                  return (
                    <g key={f.id} className="cursor-pointer">
                      {/* River water path with animated flow */}
                      <path
                        d={d}
                        fill="none"
                        stroke={f.color || palette.riverColor}
                        strokeWidth={f.width || palette.riverWidth}
                        strokeLinecap="round"
                        className="animate-river"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem({ type: 'terrain', data: f });
                        }}
                      />
                    </g>
                  );
                })}
            </g>
          )}

          {/* 7. Valleys, Chasms & Canyons */}
          {settings.visibleLayers.valleys && (
            <g id="layer-valleys">
              {terrainFeatures
                .filter((f) => f.type === 'canyon' || f.type === 'valley' || f.type === 'chasm')
                .map((f) => {
                  if (!f.points || f.points.length < 2) return null;
                  const d = pointsToSmoothSvgPath(f.points);

                  return (
                    <path
                      key={f.id}
                      d={d}
                      fill="none"
                      stroke={f.color || palette.valleyColor}
                      strokeWidth={f.width || 18}
                      strokeLinecap="round"
                      strokeDasharray="4 3"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem({ type: 'terrain', data: f });
                      }}
                    />
                  );
                })}
            </g>
          )}

          {/* 8. Mountain Ranges and Peaks Layer */}
          {settings.visibleLayers.mountains && (
            <g id="layer-mountains">
              {/* Ridge Lines */}
              {terrainFeatures
                .filter((f) => f.type === 'mountain_range' && f.points && f.points.length > 1)
                .map((f) => {
                  const d = pointsToSmoothSvgPath(f.points!);

                  return (
                    <g key={f.id}>
                      <path
                        d={d}
                        fill="none"
                        stroke={palette.mountainFill}
                        strokeWidth={f.width || 40}
                        strokeLinecap="round"
                        opacity={0.7}
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={palette.mountainStroke}
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}

              {/* Peaks, Summits & Volcanoes */}
              {terrainFeatures
                .filter((f) => f.type === 'peak' || f.type === 'volcano')
                .map((f) => {
                  const x = f.x || 0;
                  const y = f.y || 0;
                  const r = f.radius || 30;

                  return (
                    <g
                      key={f.id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem({ type: 'terrain', data: f });
                      }}
                    >
                      {/* Mountain Triangle Symbol */}
                      <polygon
                        points={`0,${-r} ${-r * 0.8},${r * 0.7} ${r * 0.8},${r * 0.7}`}
                        fill={f.type === 'volcano' ? '#7f1d1d' : palette.mountainFill}
                        stroke={f.type === 'volcano' ? '#ef4444' : palette.mountainStroke}
                        strokeWidth={2}
                      />
                      {/* Snowcap / Lava vent */}
                      <polygon
                        points={`0,${-r} ${-r * 0.3},${-r * 0.3} ${r * 0.3},${-r * 0.3}`}
                        fill={f.type === 'volcano' ? '#fbbf24' : '#ffffff'}
                      />
                      {/* Elevation Label */}
                      {f.elevation && settings.visibleLayers.labels && (
                        <text
                          x={0}
                          y={r * 0.7 + 14}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight="600"
                          fill={palette.textSecondary}
                          className="font-mono select-none"
                        >
                          ▲ {f.elevation}m
                        </text>
                      )}
                    </g>
                  );
                })}
            </g>
          )}

          {/* 9. Caravan Routes & Trade Corridors Layer */}
          {settings.visibleLayers.caravanRoutes && (
            <g id="layer-caravans">
              {tradeRoutes.map((route) => {
                const originLoc = locations.find((l) => l.id === route.originLocationId);
                const destLoc = locations.find((l) => l.id === route.destinationLocationId);
                if (!originLoc?.coordinates || !destLoc?.coordinates) return null;

                const fullPathPoints: MapPoint[] = [
                  originLoc.coordinates,
                  ...(route.waypoints || []),
                  destLoc.coordinates,
                ];
                const d = pointsToSmoothSvgPath(fullPathPoints);

                let strokeColor = palette.caravanRouteColor;
                if (route.status === 'active') strokeColor = '#10b981';
                else if (route.status === 'raided') strokeColor = '#f59e0b';
                else if (route.status === 'blockaded') strokeColor = '#ef4444';
                else if (route.status === 'secret') strokeColor = '#8b5cf6';
                else if (route.status === 'seasonal') strokeColor = '#0284c7';

                const isSelected = selectedItem?.type === 'trade_route' && selectedItem.data.id === route.id;

                return (
                  <g
                    key={route.id}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectItem({ type: 'trade_route', data: route });
                    }}
                  >
                    {/* Background wider hit target */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                    />
                    {/* Shadow halo */}
                    <path
                      d={d}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={isSelected ? 6 : 4}
                      opacity={0.3}
                    />
                    {/* Animated Dashed Caravan Path */}
                    <path
                      d={d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4 : 2.8}
                      className="animate-caravan"
                      strokeLinecap="round"
                    />

                    {/* Draggable intermediate waypoints */}
                    {isSelected &&
                      route.waypoints?.map((wp, wpIdx) => (
                        <circle
                          key={`wp_${wpIdx}`}
                          cx={wp.x}
                          cy={wp.y}
                          r={6}
                          fill="#f59e0b"
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="cursor-move hover:scale-125 transition-transform"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggedNode({
                              type: 'waypoint',
                              id: `wp_${wpIdx}`,
                              routeId: route.id,
                              index: wpIdx,
                            });
                          }}
                        />
                      ))}

                    {/* Moving Caravan Wagon Marker */}
                    <circle r={5} fill={strokeColor} stroke="#ffffff" strokeWidth={1.5}>
                      <animateMotion path={d} dur="12s" repeatCount="indefinite" />
                    </circle>
                  </g>
                );
              })}
            </g>
          )}

          {/* 10. Settlements & Cities Layer */}
          {settings.visibleLayers.settlements && (
            <g id="layer-settlements">
              {locations
                .filter((loc) => loc.coordinates && loc.coordinates.x > 0)
                .map((loc) => {
                  const { x, y } = loc.coordinates!;
                  const isSelected = selectedItem?.type === 'location' && selectedItem.data.id === loc.id;
                  const isCapital = loc.category === 'capital';
                  const isDungeon = loc.category === 'dungeon';
                  const isFortress = loc.category === 'stronghold';
                  const stationed = npcs.filter((n) => n.currentLocationId === loc.id);

                  return (
                    <g
                      key={loc.id}
                      transform={`translate(${x}, ${y})`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectItem({ type: 'location', data: loc });
                      }}
                      onMouseDown={(e) => {
                        if (activeTool === 'select') {
                          e.stopPropagation();
                          setDraggedNode({ type: 'location', id: loc.id });
                        }
                      }}
                    >
                      {/* Selection Aura */}
                      {isSelected && (
                        <circle
                          r={isCapital ? 26 : 20}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          strokeDasharray="4 2"
                          className="animate-spin"
                          style={{ animationDuration: '8s' }}
                        />
                      )}

                      {/* Settlement Node Shield / Circle */}
                      <circle
                        r={isCapital ? 16 : isFortress ? 13 : 11}
                        fill={isCapital ? '#d97706' : isDungeon ? '#7f1d1d' : '#1e293b'}
                        stroke={isSelected ? '#f59e0b' : '#ffffff'}
                        strokeWidth={2}
                        filter="url(#shadowHalo)"
                      />

                      {/* Icon inside Node */}
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={isCapital ? 14 : 11}
                        fill="#ffffff"
                        className="select-none pointer-events-none"
                      >
                        {isCapital ? '👑' : isDungeon ? '💀' : isFortress ? '🛡️' : '🏰'}
                      </text>

                      {/* Danger rating badge */}
                      {loc.dangerLevel >= 3 && (
                        <circle
                          cx={isCapital ? 12 : 9}
                          cy={isCapital ? -12 : -9}
                          r={4.5}
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      )}

                      {/* Settlement Name Plaque */}
                      {settings.visibleLayers.labels && (
                        <g transform={`translate(0, ${isCapital ? 26 : 22})`}>
                          <rect
                            x={-(loc.name.length * 4.5 + 8)}
                            y={-10}
                            width={loc.name.length * 9 + 16}
                            height={18}
                            rx={6}
                            fill={palette.bg}
                            stroke={palette.landStroke}
                            strokeWidth={1}
                            opacity={0.92}
                          />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight="bold"
                            fill={palette.textPrimary}
                            className="select-none pointer-events-none tracking-wide"
                          >
                            {loc.name}
                          </text>
                        </g>
                      )}

                      {/* Stationed NPCs Avatar Tokens */}
                      {stationed.length > 0 && settings.visibleLayers.npcs && (
                        <g transform={`translate(0, ${isCapital ? 38 : 34})`}>
                          <circle r={6} fill="#6366f1" stroke="#ffffff" strokeWidth={1} />
                          <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fontSize={8}
                            fill="#ffffff"
                            fontWeight="bold"
                            className="pointer-events-none"
                          >
                            {stationed.length}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </g>
          )}

          {/* 11. Placed Entities (NPC Pins, Beast Dens, Relics, Shrines, Timeline Events) */}
          {placements.map((p) => {
            let icon = '📍';
            let color = '#6366f1';
            let isVisible = true;

            if (p.entityType === 'npc') {
              icon = '👤';
              color = '#4f46e5';
              isVisible = settings.visibleLayers.npcs;
            } else if (p.entityType === 'bestiary') {
              icon = '🐉';
              color = '#dc2626';
              isVisible = settings.visibleLayers.bestiary;
            } else if (p.entityType === 'artifact') {
              icon = '🔮';
              color = '#9333ea';
              isVisible = settings.visibleLayers.relics;
            } else if (p.entityType === 'deity') {
              icon = '⚡';
              color = '#eab308';
              isVisible = settings.visibleLayers.deities;
            } else if (p.entityType === 'timeline') {
              icon = '⚔️';
              color = '#b91c1c';
              isVisible = settings.visibleLayers.timeline;
            }

            if (!isVisible) return null;

            return (
              <g
                key={p.id}
                transform={`translate(${p.x}, ${p.y})`}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem({ type: 'placement', data: p });
                }}
              >
                <circle r={11} fill={color} stroke="#ffffff" strokeWidth={1.5} filter="url(#shadowHalo)" />
                <text x={0} y={4} textAnchor="middle" fontSize={11} className="pointer-events-none select-none">
                  {icon}
                </text>
                {p.customLabel && (
                  <text
                    x={0}
                    y={22}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="600"
                    fill={palette.textPrimary}
                    className="select-none pointer-events-none"
                  >
                    {p.customLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* 12. Active Drafting Line / Polygon Preview */}
          {draftPoints.length > 0 && (
            <g className="pointer-events-none">
              {draftPoints.map((pt, idx) => (
                <circle key={idx} cx={pt.x} cy={pt.y} r={5} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} />
              ))}
              {draftPoints.length > 1 && (
                <path
                  d={pointsToSmoothSvgPath(draftPoints)}
                  fill={activeTool === 'terrain_continent' || activeTool === 'terrain_biome' ? 'rgba(245, 158, 11, 0.2)' : 'none'}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                />
              )}
            </g>
          )}

          {/* 13. Ruler Measurement Line */}
          {rulerPoints.length > 0 && (
            <g className="pointer-events-none">
              {rulerPoints.map((pt, idx) => (
                <circle key={`ruler_${idx}`} cx={pt.x} cy={pt.y} r={6} fill="#fbbf24" stroke="#000" strokeWidth={2} />
              ))}
              {rulerPoints.length === 2 && (() => {
                const p1 = rulerPoints[0];
                const p2 = rulerPoints[1];
                const dist = calculateMapDistance(p1, p2);
                const days = calculateCaravanTravelDays(dist);
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="#fbbf24"
                      strokeWidth={3}
                      strokeDasharray="6 4"
                    />
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-60}
                        y={-14}
                        width={120}
                        height={28}
                        rx={8}
                        fill="#09090b"
                        stroke="#fbbf24"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight="bold"
                        fill="#fbbf24"
                        className="font-mono"
                      >
                        {dist} km • {days} {isPersian ? 'روز کاروان' : 'days'}
                      </text>
                    </g>
                  </>
                );
              })()}
            </g>
          )}

          {/* 14. Antique Compass Rose Emblem */}
          <g transform={`translate(${CANVAS_WIDTH - 140}, 140)`} className="pointer-events-none opacity-45">
            <circle r={60} fill="none" stroke={palette.textSecondary} strokeWidth={1.5} strokeDasharray="3 3" />
            <polygon points="0,-75 14,-20 0,0 -14,-20" fill={palette.mountainStroke} />
            <polygon points="0,-75 0,0 -14,-20" fill={palette.mountainFill} />
            <polygon points="0,75 14,20 0,0 -14,20" fill={palette.textSecondary} />
            <polygon points="-75,0 -20,-14 0,0 -20,14" fill={palette.textSecondary} />
            <polygon points="75,0 20,-14 0,0 20,14" fill={palette.textSecondary} />
            <text x={0} y={-84} textAnchor="middle" fontSize={14} fontWeight="bold" fill={palette.textPrimary}>
              N
            </text>
          </g>
        </g>
      </svg>

      {/* Floating Coordinate & Biome HUD (Bottom-Left) */}
      <div className="absolute left-4 bottom-4 z-20 flex items-center gap-3 px-3.5 py-2 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 rounded-2xl text-xs font-mono text-zinc-400 select-none shadow-xl">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>
            X: <strong className="text-amber-400">{hoveredCoord?.x ?? 0}</strong>, Y:{' '}
            <strong className="text-amber-400">{hoveredCoord?.y ?? 0}</strong>
          </span>
        </div>
        <div className="h-3.5 w-px bg-zinc-800" />
        <div>
          {isPersian ? 'مقیاس' : 'Scale'}: <span className="text-zinc-200">1:50,000</span>
        </div>
      </div>

      {/* Minimap Radar Preview (Bottom-Right) */}
      <div className="absolute right-4 bottom-4 z-20 w-52 h-36 bg-zinc-950/90 backdrop-blur-md border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full h-full block cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
            const clickY = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
            if (containerRef.current) {
              const contRect = containerRef.current.getBoundingClientRect();
              setPan({
                x: contRect.width / 2 - clickX * zoom,
                y: contRect.height / 2 - clickY * zoom,
              });
            }
          }}
        >
          {/* Minimap Ocean */}
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={palette.oceanBg} />

          {/* Minimap Landmasses */}
          {terrainFeatures
            .filter((f) => f.type === 'continent' || f.type === 'island')
            .map((f) => {
              if (!f.polygon) return null;
              return <path key={`mm_${f.id}`} d={polygonToSvgPath(f.polygon)} fill={palette.landFill} />;
            })}

          {/* Minimap Settlements */}
          {locations.map((loc) => {
            if (!loc.coordinates) return null;
            return (
              <circle
                key={`mm_loc_${loc.id}`}
                cx={loc.coordinates.x}
                cy={loc.coordinates.y}
                r={24}
                fill="#f59e0b"
              />
            );
          })}

          {/* Minimap Current Camera Viewport Box */}
          {containerRef.current && (() => {
            const contRect = containerRef.current.getBoundingClientRect();
            const vpX = -pan.x / zoom;
            const vpY = -pan.y / zoom;
            const vpW = contRect.width / zoom;
            const vpH = contRect.height / zoom;

            return (
              <rect
                x={vpX}
                y={vpY}
                width={vpW}
                height={vpH}
                fill="rgba(245, 158, 11, 0.15)"
                stroke="#f59e0b"
                strokeWidth={14}
                rx={12}
              />
            );
          })()}
        </svg>
      </div>
    </div>
  );
};
