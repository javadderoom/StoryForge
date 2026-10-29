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
  Link2,
  Unlink,
  Sparkles,
} from 'lucide-react';
import type { CartographerTool } from '../CartographerHeader';
import {
  getFamilyById,
  type GeoSymbolCategory,
} from '@/lib/engines/world/pixi/symbolPalette';

export type HighlandMode = 'plateau' | 'ridge';
export type BiomeDrawMode = 'stroke' | 'area';
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
  biomeDrawMode?: BiomeDrawMode;
  onBiomeDrawModeChange?: (mode: BiomeDrawMode) => void;
  biomeCorridorWidth?: number;
  onBiomeCorridorWidthChange?: (width: number) => void;
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
  isElevationLinked?: boolean;
  onToggleElevationLink?: () => void;
  mountainElevation?: number;
  onMountainElevationChange?: (elevation: number) => void;

  // River settings
  riverWidth: number;
  onRiverWidthChange: (width: number) => void;

  // Ready-to-use Cartography Species Library
  equippedTreeFamily?: string;
  equippedMountainFamily?: string;
  onOpenSpeciesPicker?: (category: GeoSymbolCategory | 'all') => void;
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
  biomeDrawMode = 'area',
  onBiomeDrawModeChange,
  biomeCorridorWidth = 30,
  onBiomeCorridorWidthChange,
  biomeDensity,
  onBiomeDensityChange,
  valleyWidth,
  onValleyWidthChange,
  mountainScale,
  onMountainScaleChange,
  hasSnowcaps,
  onToggleSnowcaps,
  isElevationLinked = true,
  onToggleElevationLink,
  mountainElevation = 2750,
  onMountainElevationChange,
  riverWidth,
  onRiverWidthChange,
  equippedTreeFamily = 'oak',
  equippedMountainFamily = 'alpine_massif',
  onOpenSpeciesPicker,
}) => {
  const equippedTreeFamilyObj = getFamilyById(equippedTreeFamily);
  const equippedMountainFamilyObj = getFamilyById(equippedMountainFamily);

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
              min={5}
              max={90}
              step={1}
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
          {/* Biome Drawing Mode Toggle: Stroke/Copse vs Enclosed Area */}
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => onBiomeDrawModeChange?.('stroke')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                biomeDrawMode === 'stroke'
                  ? 'bg-lime-700 text-white shadow-md shadow-lime-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Spline className="w-3.5 h-3.5" />
              <span>{isPersian ? 'خطی و تک‌درخت' : 'Tree Line / Copse'}</span>
            </button>
            <button
              type="button"
              onClick={() => onBiomeDrawModeChange?.('area')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                biomeDrawMode === 'area'
                  ? 'bg-lime-700 text-white shadow-md shadow-lime-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isPersian ? 'ناحیه متراکم' : 'Dense Region'}</span>
            </button>
          </div>

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

          {/* Equipped Flora Species Pill & Modal Trigger */}
          {onOpenSpeciesPicker && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800">
              {equippedTreeFamilyObj && (
                <div className="w-5 h-5 rounded bg-[#f3e9d2]/20 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={equippedTreeFamilyObj.thumbnail}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <span className="text-[11px] font-medium text-amber-200 max-w-[90px] truncate">
                {equippedTreeFamilyObj
                  ? isPersian ? equippedTreeFamilyObj.name.fa : equippedTreeFamilyObj.name.en
                  : 'Oak'}
              </span>
              <button
                type="button"
                onClick={() => onOpenSpeciesPicker('tree')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-600/80 hover:bg-amber-600 text-white transition-all shadow-sm"
                title={isPersian ? 'باز کردن کتابخانه گونه‌ها' : 'Open species library'}
              >
                <Sparkles className="w-3 h-3" />
                <span>{isPersian ? 'گونه...' : 'Species...'}</span>
              </button>
            </div>
          )}

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

          {/* Corridor Width Slider (when in stroke / tree belt mode) */}
          {biomeDrawMode === 'stroke' && (
            <div className="flex items-center gap-1.5 px-2 border-l border-zinc-800">
              <span className="text-[11px] text-zinc-400 font-medium">
                {isPersian ? 'عرض نوار:' : 'Width:'}
              </span>
              <input
                type="range"
                min="12"
                max="75"
                value={biomeCorridorWidth}
                onChange={(e) => onBiomeCorridorWidthChange?.(Number(e.target.value))}
                className="w-16 accent-lime-400 h-1 bg-zinc-700 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-lime-300 w-7 text-right">
                {biomeCorridorWidth}px
              </span>
            </div>
          )}
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
              min={5}
              max={64}
              step={1}
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

          {/* Equipped Mountain Relief Species Pill & Modal Trigger */}
          {onOpenSpeciesPicker && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-zinc-900/90 border border-zinc-800">
              {equippedMountainFamilyObj && (
                <div className="w-5 h-5 rounded bg-[#f3e9d2]/20 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={equippedMountainFamilyObj.thumbnail}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <span className="text-[11px] font-medium text-amber-200 max-w-[90px] truncate">
                {equippedMountainFamilyObj
                  ? isPersian ? equippedMountainFamilyObj.name.fa : equippedMountainFamilyObj.name.en
                  : 'Massif'}
              </span>
              <button
                type="button"
                onClick={() => onOpenSpeciesPicker('mountain')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-orange-600/80 hover:bg-orange-600 text-white transition-all shadow-sm"
                title={isPersian ? 'باز کردن کتابخانه گونه‌ها' : 'Open species library'}
              >
                <Sparkles className="w-3 h-3" />
                <span>{isPersian ? 'گونه...' : 'Species...'}</span>
              </button>
            </div>
          )}

          {/* Peak Scale Slider */}
          <div className="flex items-center gap-2 px-2 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">
              {isPersian ? 'اندازه قله‌ها:' : 'Peak Scale:'}
            </span>
            <input
              type="range"
              min={5}
              max={85}
              step={1}
              value={mountainScale}
              onChange={(e) => {
                const val = Number(e.target.value);
                onMountainScaleChange(val);
                if (isElevationLinked && onMountainElevationChange) {
                  onMountainElevationChange(Math.round(val * 50));
                }
              }}
              className="w-24 accent-orange-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-orange-300 w-7 text-right">
              {mountainScale}px
            </span>
          </div>

          {/* Elevation & Link/Unlink Toggle */}
          <div className="flex items-center gap-1.5 px-2 border-l border-zinc-800">
            <button
              type="button"
              onClick={onToggleElevationLink}
              className={`p-1 rounded-lg border transition-all ${
                isElevationLinked
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title={
                isPersian
                  ? isElevationLinked
                    ? 'رابطه مستقیم اندازه و ارتفاع (۱ پیکسل = ۵۰ متر). برای قطع ارتباط و وارد کردن مقدار دقیق و دلخواه کلیک کنید.'
                    : 'ارتباط مستقیم قطع است (امکان وارد کردن مقدار دقیق و دلخواه). برای اتصال مجدد کلیک کنید.'
                  : isElevationLinked
                  ? 'Directly linked (1px = 50m). Click to unlink for custom values.'
                  : 'Unlinked. Click to link directly with scale.'
              }
            >
              {isElevationLinked ? (
                <Link2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Unlink className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>

            {isElevationLinked ? (
              <span
                className="text-[11px] font-mono text-zinc-300 min-w-[42px]"
                title={isPersian ? 'ارتفاع تخمینی متصل' : 'Linked elevation'}
              >
                {Math.round(mountainScale * 50)}m
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={mountainElevation}
                  onChange={(e) => {
                    const elev = Number(e.target.value);
                    if (onMountainElevationChange) onMountainElevationChange(elev);
                  }}
                  className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50 text-right"
                  placeholder="2750"
                  title={isPersian ? 'ارتفاع دقیق و دلخواه به متر' : 'Custom elevation in meters'}
                />
                <span className="text-[11px] font-mono text-zinc-400">m</span>
              </div>
            )}
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
              min={2}
              max={26}
              step={1}
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
