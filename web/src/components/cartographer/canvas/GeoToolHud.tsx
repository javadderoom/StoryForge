'use client';

import React from 'react';
import {
  Layers,
  Square,
  Spline,
  Trees,
  Mountain,
  Waves,
  Split,
  Droplets,
  Sun,
  Snowflake,
} from 'lucide-react';
import type { CartographerTool } from '../CartographerHeader';

export type HighlandMode = 'plateau' | 'ridge';
export type BiomeType = 'forest' | 'jungle' | 'desert' | 'swamp' | 'tundra' | 'plains';
export type BiomeDensity = 'sparse' | 'medium' | 'dense';

export interface GeoToolHudProps {
  activeTool: CartographerTool;
  isPersian: boolean;
  stopOverlayMouse: (event: React.MouseEvent) => void;

  // Highland settings
  highlandMode: HighlandMode;
  onHighlandModeChange: (mode: HighlandMode) => void;
  cliffHeight: number;
  onCliffHeightChange: (height: number) => void;
  terraceTiers: number;
  onTerraceTiersChange: (tiers: number) => void;

  // Biome settings
  activeBiome: BiomeType;
  onBiomeChange: (biome: BiomeType) => void;
  biomeDensity: BiomeDensity;
  onBiomeDensityChange: (density: BiomeDensity) => void;

  // Valley settings
  valleyWidth: number;
  onValleyWidthChange: (width: number) => void;

  // Mountain settings
  mountainScale: number;
  onMountainScaleChange: (scale: number) => void;
  hasSnowcaps: boolean;
  onToggleSnowcaps: () => void;

  // River settings
  riverWidth: number;
  onRiverWidthChange: (width: number) => void;
}

export const GeoToolHud: React.FC<GeoToolHudProps> = ({
  activeTool,
  isPersian,
  stopOverlayMouse,
  highlandMode,
  onHighlandModeChange,
  cliffHeight,
  onCliffHeightChange,
  terraceTiers,
  onTerraceTiersChange,
  activeBiome,
  onBiomeChange,
  biomeDensity,
  onBiomeDensityChange,
  valleyWidth,
  onValleyWidthChange,
  mountainScale,
  onMountainScaleChange,
  hasSnowcaps,
  onToggleSnowcaps,
  riverWidth,
  onRiverWidthChange,
}) => {
  const isGeoTool =
    activeTool === 'terrain_highland' ||
    activeTool === 'terrain_biome' ||
    activeTool === 'terrain_lake' ||
    activeTool === 'terrain_valley' ||
    activeTool === 'terrain_mountain' ||
    activeTool === 'terrain_river';

  if (!isGeoTool) return null;

  return (
    <div
      onMouseDown={stopOverlayMouse}
      onMouseMove={stopOverlayMouse}
      onMouseUp={stopOverlayMouse}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-amber-800/50 shadow-2xl text-xs select-none animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* 1. HIGHLAND / PLATEAU CONTROLS */}
      {activeTool === 'terrain_highland' && (
        <>
          {/* Mode Switch: Plateau (polygon) vs Escarpment (ridge) */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => onHighlandModeChange('plateau')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                highlandMode === 'plateau'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isPersian ? 'فلات بسته' : 'Plateau Polygon'}</span>
            </button>
            <button
              type="button"
              onClick={() => onHighlandModeChange('ridge')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                highlandMode === 'ridge'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Spline className="w-3.5 h-3.5" />
              <span>{isPersian ? 'دیواره صخره‌ای' : 'Cliff Escarpment'}</span>
            </button>
          </div>

          {/* Cliff Drop Height Slider */}
          <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'ارتفاع دیواره:' : 'Cliff Drop:'}
            </span>
            <input
              type="range"
              min={12}
              max={50}
              step={2}
              value={cliffHeight}
              onChange={(e) => onCliffHeightChange(Number(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-amber-300 w-7 text-right">
              {cliffHeight}px
            </span>
          </div>

          {/* Terrace Tiers Button Group */}
          <div className="flex items-center gap-1 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium mr-1">
              {isPersian ? 'پله‌ها:' : 'Tiers:'}
            </span>
            {[1, 2, 3].map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => onTerraceTiersChange(tier)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                  terraceTiers === tier
                    ? 'bg-amber-700/80 text-amber-100 font-bold border border-amber-500/60'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 2. BIOME CONTROLS */}
      {activeTool === 'terrain_biome' && (
        <>
          {/* Biome Type Selector Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            {(
              [
                { id: 'forest', labelEn: 'Forest', labelFa: 'جنگل', icon: '🌲' },
                { id: 'jungle', labelEn: 'Jungle', labelFa: 'جنگل انبوه', icon: '🌴' },
                { id: 'desert', labelEn: 'Desert', labelFa: 'کویر و ریگزار', icon: '🏜️' },
                { id: 'swamp', labelEn: 'Swamp', labelFa: 'مرداب و لجنزار', icon: '🌾' },
                { id: 'tundra', labelEn: 'Tundra', labelFa: 'تندرا و یخسار', icon: '❄️' },
                { id: 'plains', labelEn: 'Plains', labelFa: 'دشت و علفزار', icon: '🌾' },
              ] as const
            ).map((biome) => (
              <button
                key={biome.id}
                type="button"
                onClick={() => onBiomeChange(biome.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeBiome === biome.id
                    ? 'bg-lime-700 text-white shadow-md shadow-lime-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="text-xs">{biome.icon}</span>
                <span>{isPersian ? biome.labelFa : biome.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Symbol Density Toggle */}
          <div className="flex items-center gap-1.5 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'تراکم نمادها:' : 'Density:'}
            </span>
            {(
              [
                { id: 'sparse', labelEn: 'Sparse', labelFa: 'کم' },
                { id: 'medium', labelEn: 'Med', labelFa: 'متوسط' },
                { id: 'dense', labelEn: 'Dense', labelFa: 'زیاد' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onBiomeDensityChange(d.id)}
                className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                  biomeDensity === d.id
                    ? 'bg-lime-600/80 text-white font-bold border border-lime-400/50'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 border border-zinc-800'
                }`}
              >
                {isPersian ? d.labelFa : d.labelEn}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 3. LAKE CONTROLS */}
      {activeTool === 'terrain_lake' && (
        <div className="flex items-center gap-2 px-2 text-sky-300">
          <Droplets className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="text-xs font-medium">
            {isPersian
              ? 'کلیک و درگ موس برای قلم‌زنی دریاچه (رها کردن موس برای بستن خودکار)'
              : 'Click & drag mouse to sculpt organic lake (auto-closes on release)'}
          </span>
          <span className="text-[11px] text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800 ml-2">
            {isPersian ? 'عمق دوبانده خودکار' : 'Auto 2-tier depth wash'}
          </span>
        </div>
      )}

      {/* 4. VALLEY CONTROLS */}
      {activeTool === 'terrain_valley' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-stone-300">
            <Split className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-medium">{isPersian ? 'دره و تنگه' : 'Canyon / Rift'}</span>
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'پهنای دره:' : 'Gorge Width:'}
            </span>
            <input
              type="range"
              min={16}
              max={64}
              step={2}
              value={valleyWidth}
              onChange={(e) => onValleyWidthChange(Number(e.target.value))}
              className="w-24 accent-stone-400 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-stone-300 w-7 text-right">
              {valleyWidth}px
            </span>
          </div>
        </div>
      )}

      {/* 5. MOUNTAIN CONTROLS */}
      {activeTool === 'terrain_mountain' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-orange-300">
            <Mountain className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-medium">{isPersian ? 'رشته‌کوه' : 'Mountain Range'}</span>
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'اندازه قله‌ها:' : 'Peak Scale:'}
            </span>
            <input
              type="range"
              min={14}
              max={85}
              step={2}
              value={mountainScale}
              onChange={(e) => onMountainScaleChange(Number(e.target.value))}
              className="w-24 accent-orange-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-orange-300 w-7 text-right">
              {mountainScale}px
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleSnowcaps}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
              hasSnowcaps
                ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Snowflake className="w-3 h-3 text-sky-400" />
            <span>{isPersian ? 'کلاهک برفی' : 'Snowcaps'}</span>
          </button>
        </div>
      )}

      {/* 6. RIVER CONTROLS */}
      {activeTool === 'terrain_river' && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <Waves className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium">{isPersian ? 'رودخانه پیچان' : 'Winding River'}</span>
          </div>
          <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'پهنای مصب:' : 'Mouth Width:'}
            </span>
            <input
              type="range"
              min={6}
              max={26}
              step={2}
              value={riverWidth}
              onChange={(e) => onRiverWidthChange(Number(e.target.value))}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-cyan-300 w-7 text-right">
              {riverWidth}px
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
