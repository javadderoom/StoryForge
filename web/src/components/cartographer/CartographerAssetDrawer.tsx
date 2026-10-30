'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Trees,
  Mountain,
  Layers,
  Sparkles,
  Castle,
  Flower2,
  Stamp,
  Sliders,
  RotateCcw,
  MousePointerClick,
  Paintbrush,
} from 'lucide-react';
import {
  getAllSymbolFamilies,
  getFamilyById,
  type GeoSymbolCategory,
  type GeoSymbolFamily,
} from '@/lib/engines/world/pixi/symbolPalette';

export interface CartographerAssetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  armedFamilyId: string | null;
  onArmFamily: (familyId: string | null) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  mode: 'stamp' | 'scatter';
  onModeChange: (mode: 'stamp' | 'scatter') => void;
  spacing: number;
  onSpacingChange: (spacing: number) => void;
  randomRotation: boolean;
  onRandomRotationChange: (enabled: boolean) => void;
  isPersian?: boolean;
}

interface CategoryFilterTab {
  id: GeoSymbolCategory | 'all';
  labelEn: string;
  labelFa: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORY_TABS: CategoryFilterTab[] = [
  { id: 'all', labelEn: 'All', labelFa: 'همه', icon: Layers },
  { id: 'tree', labelEn: 'Trees', labelFa: 'درختان', icon: Trees },
  { id: 'hill', labelEn: 'Dunes & Hills', labelFa: 'رمل و تپه‌ها', icon: Mountain },
  { id: 'mountain', labelEn: 'Peaks', labelFa: 'قله‌ها', icon: Mountain },
  { id: 'grass_flora', labelEn: 'Reeds & Grass', labelFa: 'نیزار و علف', icon: Flower2 },
  { id: 'stone_rock', labelEn: 'Rocks', labelFa: 'صخره‌ها', icon: Layers },
  { id: 'landmark', labelEn: 'Landmarks', labelFa: 'دژ و بناها', icon: Castle },
];

export const CartographerAssetDrawer: React.FC<CartographerAssetDrawerProps> = ({
  isOpen,
  onClose,
  armedFamilyId,
  onArmFamily,
  scale,
  onScaleChange,
  mode,
  onModeChange,
  spacing,
  onSpacingChange,
  randomRotation,
  onRandomRotationChange,
  isPersian = false,
}) => {
  const [activeTab, setActiveTab] = useState<GeoSymbolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allFamilies = useMemo(() => getAllSymbolFamilies(), []);

  const filteredFamilies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allFamilies.filter((family) => {
      if (activeTab !== 'all' && family.category !== activeTab) {
        return false;
      }
      if (!query) return true;
      const matchEn = family.name.en.toLowerCase().includes(query);
      const matchFa = family.name.fa.toLowerCase().includes(query);
      const matchDescEn = family.description.en.toLowerCase().includes(query);
      const matchDescFa = family.description.fa.toLowerCase().includes(query);
      return matchEn || matchFa || matchDescEn || matchDescFa;
    });
  }, [allFamilies, activeTab, searchQuery]);

  const armedFamily = useMemo(
    () => (armedFamilyId ? getFamilyById(armedFamilyId) : null),
    [armedFamilyId]
  );

  if (!isOpen) return null;

  return (
    <aside
      className={`absolute top-0 bottom-0 left-0 w-80 bg-zinc-950/95 backdrop-blur-md border-r border-zinc-800 shadow-2xl z-30 flex flex-col transition-all duration-300 ${
        isPersian ? 'font-sans' : ''
      }`}
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Stamp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {isPersian ? 'کتابخانه نمادها و استامپ' : 'Asset & Stamp Shelf'}
            </h2>
            <p className="text-[10px] text-zinc-400">
              {isPersian ? 'انتخاب، درج تک‌کلیک و افشانه روی نقشه' : 'Pick, stamp & duplicate on canvas'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title={isPersian ? 'بستن کشو (Tab)' : 'Close shelf (Tab)'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-zinc-800/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-3 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isPersian ? 'جستجوی نماد، نخل، رمل، قله...' : 'Search trees, dunes, ruins...'}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 -translate-y-1/2 right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-950 font-semibold'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{isPersian ? tab.labelFa : tab.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start">
        {filteredFamilies.map((family) => {
          const isArmed = armedFamilyId === family.id;
          return (
            <button
              key={family.id}
              type="button"
              onClick={() => {
                if (isArmed) {
                  onArmFamily(null); // Toggle disarm
                } else {
                  onArmFamily(family.id);
                  onScaleChange(family.defaultScale);
                }
              }}
              className={`flex flex-col items-center p-2.5 rounded-xl border transition-all text-center relative group ${
                isArmed
                  ? 'bg-amber-500/15 border-amber-500 text-amber-200 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/80'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300'
              }`}
            >
              {/* Armed status badge */}
              {isArmed && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}

              {/* Thumbnail Container */}
              <div className="w-16 h-16 rounded-lg bg-[#f3e9d2]/15 border border-[#f3e9d2]/20 flex items-center justify-center p-1.5 mb-2 group-hover:scale-105 transition-transform">
                <img
                  src={family.thumbnail}
                  alt={family.name.en}
                  className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                  loading="lazy"
                />
              </div>

              {/* Title & Variants */}
              <div className="w-full">
                <span className="text-xs font-semibold block truncate leading-tight text-zinc-200">
                  {isPersian ? family.name.fa : family.name.en}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">
                  {isPersian
                    ? `${family.variants.length} گونه`
                    : `${family.variants.length} variant${family.variants.length > 1 ? 's' : ''}`}
                </span>
              </div>
            </button>
          );
        })}

        {filteredFamilies.length === 0 && (
          <div className="col-span-2 py-8 text-center text-zinc-500 text-xs">
            {isPersian ? 'نمادی با این عنوان یافت نشد.' : 'No symbol matching search.'}
          </div>
        )}
      </div>

      {/* Drawer Footer: Armed Stamp Controls & Placement Settings */}
      {armedFamily && (
        <div className="p-3 bg-zinc-900/90 border-t border-zinc-800 space-y-2.5 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-200 truncate max-w-[170px]">
                {isPersian ? armedFamily.name.fa : armedFamily.name.en}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onArmFamily(null)}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
            >
              {isPersian ? 'لغو انتخاب' : 'Disarm'}
            </button>
          </div>

          {/* Mode Toggle: Single Stamp vs Scatter Brush */}
          <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => onModeChange('stamp')}
              className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-medium transition-all ${
                mode === 'stamp'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MousePointerClick className="w-3 h-3" />
              <span>{isPersian ? 'تک استامپ' : 'Single Click'}</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('scatter')}
              className={`flex items-center justify-center gap-1 py-1 px-2 rounded text-xs font-medium transition-all ${
                mode === 'scatter'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Paintbrush className="w-3 h-3" />
              <span>{isPersian ? 'افشانه / قلم' : 'Scatter Brush'}</span>
            </button>
          </div>

          {/* Scale Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{isPersian ? 'اندازه نماد:' : 'Scale:'}</span>
              <span className="font-mono text-zinc-200">{scale}px</span>
            </div>
            <input
              type="range"
              min={18}
              max={100}
              step={2}
              value={scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Spacing Slider (for Scatter mode) */}
          {mode === 'scatter' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>{isPersian ? 'فاصله نمادها:' : 'Spacing:'}</span>
                <span className="font-mono text-zinc-200">{spacing}px</span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                step={4}
                value={spacing}
                onChange={(e) => onSpacingChange(Number(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* Organic Rotation Jitter Checkbox */}
          {armedFamily.category !== 'landmark' && (
            <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={randomRotation}
                onChange={(e) => onRandomRotationChange(e.target.checked)}
                className="rounded accent-amber-500 border-zinc-700 w-3.5 h-3.5"
              />
              <span>{isPersian ? 'زاویه تصادفی طبیعی (چرخش ارگانیک)' : 'Organic angle variation'}</span>
            </label>
          )}

          {/* Fast Duplication Hint */}
          <div className="pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-400 flex items-center justify-between">
            <span>{isPersian ? 'تکثیر سریع:' : 'Quick Clone:'}</span>
            <span className="font-mono text-amber-300/90 font-medium">Alt + Drag / Ctrl+D</span>
          </div>
        </div>
      )}
    </aside>
  );
};
