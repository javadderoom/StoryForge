import { useRef, useState } from 'react';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import type { PixiCartographerEngine } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import {
  generateOrganicStamp,
  interpolateStrokePoints,
  applySculptOperation,
} from '@/lib/engines/world/landSculptEngine';

export interface UseLandSculptBrushOptions {
  engineRef: React.RefObject<PixiCartographerEngine | null>;
  terrainFeatures: MapTerrainFeature[];
  onReplaceTerrain?: (features: MapTerrainFeature[]) => void;
  sculptMode?: 'paint' | 'carve';
  brushSize?: number;
  brushRoughness?: number;
}

/**
 * The continuous land-sculpt brush: an organic stamp is laid down along the
 * stroke, previewed live, and committed as one boolean operation when the
 * pointer is released.
 */
export function useLandSculptBrush({
  engineRef,
  terrainFeatures,
  onReplaceTerrain,
  sculptMode: externalSculptMode,
  brushSize: externalBrushSize,
  brushRoughness: externalBrushRoughness,
}: UseLandSculptBrushOptions) {
  const [internalSculptMode, setSculptMode] = useState<'paint' | 'carve'>('paint');
  const [internalBrushSize, setBrushSize] = useState<number>(65);
  const [internalBrushRoughness, setBrushRoughness] = useState<number>(0.35);

  const sculptMode = externalSculptMode ?? internalSculptMode;
  const brushSize = externalBrushSize ?? internalBrushSize;
  const brushRoughness = externalBrushRoughness ?? internalBrushRoughness;

  const isSculptingRef = useRef(false);
  const accumulatedStampsRef = useRef<MapPoint[][]>([]);
  const lastStrokePointRef = useRef<MapPoint | null>(null);
  const strokeSeedRef = useRef<number>(42);

  const handleBrushMouseDown = (worldPoint: MapPoint) => {
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
  };

  const handleBrushMouseMove = (worldPoint: MapPoint) => {
    engineRef.current?.renderBrushCursor(worldPoint, brushSize, sculptMode);

    if (!isSculptingRef.current || !lastStrokePointRef.current) return;

    const dist = Math.hypot(
      worldPoint.x - lastStrokePointRef.current.x,
      worldPoint.y - lastStrokePointRef.current.y
    );
    const stepSize = Math.max(10, brushSize * 0.35);
    if (dist < stepSize) return;

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
    engineRef.current?.renderBrushPreview(accumulatedStampsRef.current, sculptMode);
  };

  const handleBrushMouseUp = () => {
    if (!isSculptingRef.current) return;
    isSculptingRef.current = false;
    lastStrokePointRef.current = null;
    engineRef.current?.clearBrushPreview();

    if (accumulatedStampsRef.current.length > 0 && onReplaceTerrain) {
      const nextFeatures = applySculptOperation(
        terrainFeatures,
        accumulatedStampsRef.current,
        sculptMode,
        {
          simplifyTolerance: 1.5,
          minArea: 15,
          minHoleArea: 25,
        }
      );
      onReplaceTerrain(nextFeatures);
      accumulatedStampsRef.current = [];
    }
  };

  return {
    sculptMode,
    setSculptMode,
    brushSize,
    setBrushSize,
    brushRoughness,
    setBrushRoughness,
    isSculptingRef,
    handleBrushMouseDown,
    handleBrushMouseMove,
    handleBrushMouseUp,
  };
}
