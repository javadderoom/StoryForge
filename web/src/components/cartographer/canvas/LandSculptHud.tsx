'use client';

import React from 'react';
import { Eraser, Paintbrush, Waves } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';
import { notify } from '@/lib/notify';

/** The terrain types the "Clear land & water" action removes. */
const LAND_AND_WATER_TYPES = new Set(['continent', 'island', 'ocean', 'sea', 'lake']);

interface LandSculptHudProps {
  isPersian: boolean;
  sculptMode: 'paint' | 'carve';
  onModeChange: (mode: 'paint' | 'carve') => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushRoughness: number;
  onBrushRoughnessChange: (roughness: number) => void;
  terrainFeatures: MapTerrainFeature[];
  onReplaceTerrain?: (features: MapTerrainFeature[]) => void;
  stopOverlayMouse: (event: React.MouseEvent) => void;
}

/**
 * Brush controls live inside the map container. Every handler stops pointer
 * events from reaching the canvas so changing a slider never paints a stroke.
 */
export const LandSculptHud: React.FC<LandSculptHudProps> = ({
  isPersian,
  sculptMode,
  onModeChange,
  brushSize,
  onBrushSizeChange,
  brushRoughness,
  onBrushRoughnessChange,
  terrainFeatures,
  onReplaceTerrain,
  stopOverlayMouse,
}) => {
  const clearLandAndWater = async () => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'پاکسازی خشکی و آب' : 'Clear land & water',
      message: isPersian
        ? 'همهٔ خشکی‌ها، جزیره‌ها و آب‌های نقشه حذف می‌شوند. رشته‌کوه‌ها، دره‌ها، رودها و اقلیم‌ها دست‌نخورده می‌مانند.'
        : 'All landmasses, islands and water bodies are removed. Mountain ranges, valleys, rivers and biomes are kept.',
    });
    if (!confirmed || !onReplaceTerrain) return;

    // Plan 21: this used to clear EVERY terrain feature while the label
    // claimed "landmasses" — it silently destroyed the author's ranges,
    // rivers and biomes. Now it removes land and standing water only, and the
    // action stays undoable.
    const kept = terrainFeatures.filter((feature) => !LAND_AND_WATER_TYPES.has(feature.type));
    onReplaceTerrain(kept);
    notify.info(
      isPersian
        ? 'خشکی و آب نقشه پاک شد'
        : 'Land and water cleared — ranges, rivers and biomes kept'
    );
  };

  return (
    <div
      onMouseDown={stopOverlayMouse}
      onMouseMove={stopOverlayMouse}
      onMouseUp={stopOverlayMouse}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-amber-800/50 shadow-2xl text-xs select-none"
    >
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
        <button
          type="button"
          onClick={() => onModeChange('paint')}
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
          onClick={() => onModeChange('carve')}
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

      {/* Brush size */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-[11px] text-zinc-400 font-medium">
          {isPersian ? 'اندازه قلم:' : 'Size:'}
        </span>
        <input
          type="range"
          min={5}
          max={180}
          step={1}
          value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
          className="w-24 accent-amber-500 cursor-pointer"
        />
        <span className="text-[11px] font-mono text-amber-400 w-10 text-right" dir="ltr">
          {brushSize}px
        </span>
      </div>

      <div className="h-4 w-px bg-zinc-800" />

      {/* Roughness */}
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
          onChange={(event) => onBrushRoughnessChange(Number(event.target.value))}
          className="w-20 accent-amber-500 cursor-pointer"
        />
        <span className="text-[11px] font-mono text-amber-400 w-9 text-right" dir="ltr">
          {Math.round(brushRoughness * 100)}%
        </span>
      </div>

      <div className="h-4 w-px bg-zinc-800" />

      {/* Reset to ocean */}
      <button
        type="button"
        onClick={() => void clearLandAndWater()}
        title={isPersian ? 'پاکسازی خشکی و آب' : 'Clear land and water'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 transition-all"
      >
        <Waves className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[11px]">{isPersian ? 'پاکسازی خشکی و آب' : 'Clear Land'}</span>
      </button>
    </div>
  );
};