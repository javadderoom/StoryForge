import { useRef } from 'react';
import type { MapPoint, MapTerrainFeature, WorldMapData } from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import type { PixiCartographerEngine } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import type { CartographerTool } from '../../CartographerHeader';
import type { BiomeType, HighlandMode } from '../GeoToolHud';
import { distToPolyline } from '@/lib/engines/world/pixi/hydrologyNetwork';

export interface UseGeoStrokeDraftingOptions {
  activeTool: CartographerTool;
  isPersian: boolean;
  engineRef: React.RefObject<PixiCartographerEngine | null>;
  setDraftPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  onAddTerrain: (feature: MapTerrainFeature) => void;
  onSelectionChange: (refs: MapObjectRef[]) => void;
  mapData?: WorldMapData;

  // Mountain settings
  mountainScale: number;
  isMountainElevationLinked: boolean;
  mountainElevation: number;
  hasSnowcaps: boolean;

  // Highland settings
  highlandMode: HighlandMode;
  cliffHeight: number;
  terraceTiers: number;

  // Valley / river / biome settings
  valleyWidth: number;
  riverWidth: number;
  activeBiome: BiomeType;
}

const GEO_STROKE_TOOLS: CartographerTool[] = [
  'terrain_mountain',
  'terrain_river',
  'terrain_valley',
  'terrain_highland',
  'terrain_lake',
  'terrain_biome',
];

/**
 * Continuous drag-to-draw geography: mountains, rivers, valleys, highlands,
 * lakes and biomes are all drawn by dragging the pointer, previewed live and
 * committed as one terrain feature on release.
 */
export function useGeoStrokeDrafting({
  activeTool,
  isPersian,
  engineRef,
  setDraftPoints,
  onAddTerrain,
  onSelectionChange,
  mountainScale,
  isMountainElevationLinked,
  mountainElevation,
  hasSnowcaps,
  highlandMode,
  cliffHeight,
  terraceTiers,
  valleyWidth,
  riverWidth,
  activeBiome,
  mapData,
}: UseGeoStrokeDraftingOptions) {
  const isDraggingGeoStrokeRef = useRef(false);
  const geoStrokePointsRef = useRef<MapPoint[]>([]);
  const geoStrokeSeedRef = useRef<number>(42);

  const isGeoStrokeTool = GEO_STROKE_TOOLS.includes(activeTool);

  const handleGeoStrokeMouseDown = (worldPoint: MapPoint) => {
    isDraggingGeoStrokeRef.current = true;
    geoStrokeSeedRef.current = Math.floor(Math.random() * 100000);
    geoStrokePointsRef.current = [worldPoint];
  };

  const handleGeoStrokeMouseMove = (worldPoint: MapPoint) => {
    if (!isDraggingGeoStrokeRef.current || !engineRef.current) return;

    const pts = geoStrokePointsRef.current;
    const lastPt = pts[pts.length - 1];
    const dist = lastPt ? Math.hypot(worldPoint.x - lastPt.x, worldPoint.y - lastPt.y) : 999;
    if (dist < 12) return;

    pts.push(worldPoint);

    if (activeTool === 'terrain_mountain') {
      engineRef.current.renderMountainStrokePreview(pts, {
        seed: geoStrokeSeedRef.current,
        scale: mountainScale,
        rangeWidth: Math.round(mountainScale * 0.58),
        hasSnowcaps,
      });
    } else if (activeTool === 'terrain_river') {
      engineRef.current.renderRiverStrokePreview(pts, {
        seed: geoStrokeSeedRef.current,
        startWidth: Math.min(1.2, Math.max(0.4, riverWidth * 0.25)),
        endWidth: riverWidth,
        meanderRoughness: 0.3,
      });
    } else if (activeTool === 'terrain_valley') {
      engineRef.current.renderValleyStrokePreview(pts, {
        seed: geoStrokeSeedRef.current,
        width: valleyWidth,
      });
    } else if (activeTool === 'terrain_highland') {
      engineRef.current.renderHighlandStrokePreview(pts, {
        seed: geoStrokeSeedRef.current,
        cliffHeight,
        terraceTiers,
        isPolygon: highlandMode === 'plateau',
      });
    } else if (activeTool === 'terrain_lake') {
      engineRef.current.renderLakeStrokePreview(pts);
    } else if (activeTool === 'terrain_biome') {
      engineRef.current.renderBiomeStrokePreview(pts, activeBiome);
    }
  };

  const handleGeoStrokeMouseUp = () => {
    if (!isDraggingGeoStrokeRef.current) return;
    isDraggingGeoStrokeRef.current = false;
    engineRef.current?.clearBrushPreview();

    const strokePts = [...geoStrokePointsRef.current];
    geoStrokePointsRef.current = [];

    let totalStrokeDist = 0;
    for (let i = 0; i < strokePts.length - 1; i++) {
      totalStrokeDist += Math.hypot(
        strokePts[i + 1].x - strokePts[i].x,
        strokePts[i + 1].y - strokePts[i].y
      );
    }

    if (strokePts.length < 2 || totalStrokeDist <= 20) return;

    const isMountain = activeTool === 'terrain_mountain';
    const isRiver = activeTool === 'terrain_river';
    const isValley = activeTool === 'terrain_valley';
    const isHighlandRidge = activeTool === 'terrain_highland' && highlandMode === 'ridge';
    const isHighlandPlateau = activeTool === 'terrain_highland' && highlandMode === 'plateau';
    const isLake = activeTool === 'terrain_lake';
    const isBiome = activeTool === 'terrain_biome';

    // Closed loop for area shapes
    const closedPts = [...strokePts];
    if (
      Math.hypot(
        closedPts[0].x - closedPts[closedPts.length - 1].x,
        closedPts[0].y - closedPts[closedPts.length - 1].y
      ) > 5
    ) {
      closedPts.push({ ...closedPts[0] });
    }

    if (isMountain || isRiver || isValley || isHighlandRidge) {
      let connectedRiverId: string | undefined = undefined;
      if (isRiver && mapData?.terrainFeatures && strokePts.length >= 2) {
        const otherRivers = mapData.terrainFeatures.filter((f) => f.type === 'river');
        for (const other of otherRivers) {
          if (!other.points || other.points.length < 2) continue;
          if (distToPolyline(strokePts[0], other.points) <= 22) {
            connectedRiverId = other.id;
            break;
          }
          if (distToPolyline(strokePts[strokePts.length - 1], other.points) <= 22) {
            connectedRiverId = other.id;
            break;
          }
        }
      }

      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isMountain
          ? (isPersian ? 'رشته‌کوه کهن' : 'Ancient Mountain Ridge')
          : isRiver
          ? (isPersian ? 'رودخانه خروشان' : 'Winding River')
          : isValley
          ? (isPersian ? 'دره و شکاف زمین' : 'Rift Valley')
          : (isPersian ? 'دیواره صخره‌ای و فلات' : 'Highland Escarpment'),
        type: isMountain
          ? 'mountain_range'
          : isRiver
          ? 'river'
          : isValley
          ? 'valley'
          : 'highland',
        points: strokePts,
        elevation: isMountain
          ? (isMountainElevationLinked ? Math.round(mountainScale * 50) : mountainElevation)
          : isRiver
          ? 150
          : isValley
          ? -200
          : (terraceTiers > 1 ? 1800 : 800),
        syncElevationScale: isMountain ? isMountainElevationLinked : undefined,
        scale: isMountain ? mountainScale : undefined,
        hasSnowcaps: isMountain ? hasSnowcaps : undefined,
        width: isMountain
          ? Math.round(mountainScale * 0.58)
          : isRiver
          ? riverWidth
          : isValley
          ? valleyWidth
          : cliffHeight,
        connectedRiverId,
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      setDraftPoints([]);
    } else if (isHighlandPlateau) {
      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isPersian ? 'فلات مرتفع' : 'Elevated Plateau',
        type: 'plateau',
        polygon: closedPts,
        elevation: terraceTiers > 1 ? 1800 : 800,
        width: cliffHeight,
        description: isPersian ? 'زمین‌های مرتفع با سقف صاف' : 'Elevated flat-topped tablelands',
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      setDraftPoints([]);
    } else if (isLake) {
      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isPersian ? 'دریاچه لاجوردی' : 'Inland Lake',
        type: 'lake',
        polygon: closedPts,
        color: '#5a7b91',
        description: isPersian ? 'دریاچه عمیق آب شیرین' : 'Deep inland freshwater lake',
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      setDraftPoints([]);
    } else if (isBiome) {
      const biomeNames: Record<string, { en: string; fa: string }> = {
        forest: { en: 'Ancient Forest', fa: 'جنگل کهن' },
        jungle: { en: 'Primeval Jungle', fa: 'جنگل گرمسیری' },
        desert: { en: 'Sand Dune Desert', fa: 'کویر و ریگزار' },
        swamp: { en: 'Foul Marshland', fa: 'مرداب و لجنزار' },
        tundra: { en: 'Frozen Tundra', fa: 'تندرای یخی' },
        plains: { en: 'Golden Plains', fa: 'دشت بی‌کران' },
      };
      const selectedName = biomeNames[activeBiome];
      const newFeature: MapTerrainFeature = {
        id: `terr_${Date.now().toString(36)}`,
        name: isPersian
          ? selectedName?.fa || 'ناحیه اقلیمی'
          : selectedName?.en || 'Biome Region',
        type: activeBiome,
        polygon: closedPts,
        description: isPersian
          ? 'عنصر جغرافیایی ترسیم‌شده'
          : 'User-created geographical feature',
      };
      onAddTerrain(newFeature);
      onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      setDraftPoints([]);
    }
  };

  return {
    isGeoStrokeTool,
    isDraggingGeoStrokeRef,
    geoStrokePointsRef,
    geoStrokeSeedRef,
    handleGeoStrokeMouseDown,
    handleGeoStrokeMouseMove,
    handleGeoStrokeMouseUp,
  };
}
