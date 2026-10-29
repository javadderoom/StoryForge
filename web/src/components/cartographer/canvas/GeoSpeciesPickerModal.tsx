'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';
import {
  GEO_SYMBOL_FAMILIES,
  getAllSymbolFamilies,
  type GeoSymbolCategory,
  type GeoSymbolFamily,
} from '@/lib/engines/world/pixi/symbolPalette';

export interface GeoSpeciesPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFamily: (familyId: string) => void;
  currentlySelectedFamily?: string;
  categoryFilter?: GeoSymbolCategory | 'all';
  isPersian?: boolean;
}

interface CategoryTab {
  id: GeoSymbolCategory | 'all';
  labelEn: string;
  labelFa: string;
  icon: React.ReactNode;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', labelEn: 'All Species', labelFa: 'همه نمادها', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'tree', labelEn: 'Trees & Woodlands', labelFa: 'درختان و بیشه‌ها', icon: <Trees className="w-3.5 h-3.5" /> },
  { id: 'mountain', labelEn: 'Mountains & Ridges', labelFa: 'کوه‌ها و تیغه‌ها', icon: <Mountain className="w-3.5 h-3.5" /> },
  { id: 'hill', labelEn: 'Hills & Knolls', labelFa: 'تپه‌ها و ماهورها', icon: <Mountain className="w-3.5 h-3.5 opacity-70" /> },
  { id: 'stone_rock', labelEn: 'Stones & Rocks', labelFa: 'سنگ‌ها و صخره‌ها', icon: <Layers className="w-3.5 h-3.5 opacity-70" /> },
  { id: 'grass_flora', labelEn: 'Grass & Groundcover', labelFa: 'علفزار و نیزار', icon: <Flower2 className="w-3.5 h-3.5" /> },
  { id: 'landmark', labelEn: 'Landmarks & POIs', labelFa: 'دژها و نمادها', icon: <Castle className="w-3.5 h-3.5" /> },
];

export const GeoSpeciesPickerModal: React.FC<GeoSpeciesPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFamily,
  currentlySelectedFamily,
  categoryFilter = 'all',
  isPersian = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<GeoSymbolCategory | 'all'>(categoryFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Mount check for safe Next.js DOM Portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync category filter when opened for a specific category
  useEffect(() => {
    if (categoryFilter) {
      setActiveTab(categoryFilter);
    }
  }, [categoryFilter, isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allFamilies = useMemo(() => getAllSymbolFamilies(), []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allFamilies.length };
    for (const f of allFamilies) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return counts;
  }, [allFamilies]);

  const filteredFamilies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allFamilies.filter((family) => {
      // 1. Tab filter
      if (activeTab !== 'all' && family.category !== activeTab) {
        return false;
      }
      // 2. Search query filter
      if (!query) return true;
      const matchEn =
        family.name.en.toLowerCase().includes(query) ||
        family.description.en.toLowerCase().includes(query) ||
        family.id.toLowerCase().includes(query);
      const matchFa =
        family.name.fa.toLowerCase().includes(query) ||
        family.description.fa.toLowerCase().includes(query);
      return matchEn || matchFa;
    });
  }, [allFamilies, activeTab, searchQuery]);

  if (!isOpen || !mounted) return null;

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[96vw] max-w-5xl h-[88vh] max-h-[820px] min-h-[520px] flex flex-col rounded-3xl bg-zinc-950 border border-amber-600/30 shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden text-zinc-100"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-amber-100">
                {isPersian ? 'کتابخانه گونه‌ها و نمادهای طبیعی' : 'Cartography Species & Symbol Library'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isPersian
                  ? 'انتخاب گونه‌های درختان، کوه‌ها، تپه‌ها و نمادهای آماده برای نقشه‌نگاری حرفه‌ای'
                  : 'Equip ready-to-use vector relief massifs and retina flora sprites for your map'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition-colors"
            title={isPersian ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls: Search Bar & Category Pills */}
        <div className="px-5 sm:px-7 py-3 border-b border-zinc-800/70 bg-zinc-900/40 space-y-3 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isPersian
                  ? 'جستجوی گونه، کوه، درخت، تپه یا دژ...'
                  : 'Search species by name, landscape feature, or keyword...'
              }
              className="w-full pl-10 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = categoryCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/70 hover:bg-zinc-800/70 border border-zinc-800/80'
                  }`}
                >
                  {tab.icon}
                  <span>{isPersian ? tab.labelFa : tab.labelEn}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-amber-800 text-amber-100' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Species Card Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
          {filteredFamilies.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">
              <p className="text-sm font-medium">
                {isPersian ? 'گونه‌ای با این مشخصات یافت نشد.' : 'No species found matching your query.'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {isPersian ? 'جستجوی دیگری را امتحان کنید یا دسته‌بندی را تغییر دهید.' : 'Try adjusting your search query or category filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFamilies.map((family) => {
                const isEquipped = currentlySelectedFamily === family.id;
                return (
                  <div
                    key={family.id}
                    onClick={() => {
                      onSelectFamily(family.id);
                      onClose();
                    }}
                    className={`group relative flex flex-col justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                      isEquipped
                        ? 'bg-amber-950/25 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
                        : 'bg-zinc-900/50 hover:bg-zinc-900/90 border-zinc-800/80 hover:border-amber-500/40'
                    }`}
                  >
                    <div>
                      {/* Image Preview Area */}
                      <div className="relative w-full h-32 rounded-xl bg-gradient-to-b from-[#f3e9d2]/15 to-[#e6d8ba]/10 border border-amber-900/30 flex items-center justify-center p-3 overflow-hidden mb-3.5 group-hover:scale-[1.02] transition-transform">
                        <img
                          src={family.thumbnail}
                          alt={family.name.en}
                          className="max-h-24 max-w-[85%] object-contain drop-shadow-md select-none"
                          loading="lazy"
                        />
                        {isEquipped && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>{isPersian ? 'فعال' : 'Equipped'}</span>
                          </div>
                        )}
                        <span className="absolute bottom-2.5 left-2.5 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-950/80 text-zinc-300 border border-zinc-800">
                          {family.variants.length} {isPersian ? 'نگاره' : 'variants'}
                        </span>
                        <span className="absolute top-2.5 left-2.5 text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-900/90 text-amber-300/80 border border-zinc-800 capitalize">
                          {family.category.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Title & Persian Translation */}
                      <div className="space-y-0.5">
                        <h3 className="text-xs sm:text-sm font-bold text-zinc-100 group-hover:text-amber-200 transition-colors">
                          {isPersian ? family.name.fa : family.name.en}
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          {isPersian ? family.name.en : family.name.fa}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-zinc-400/90 mt-2 line-clamp-2 leading-relaxed">
                        {isPersian ? family.description.fa : family.description.en}
                      </p>

                      {/* Variant Mini-Thumbnail Strip */}
                      <div className="mt-3 pt-2 border-t border-zinc-800/60">
                        <div className="text-[10px] text-zinc-400 mb-1 font-medium">
                          {isPersian ? 'نگاره‌های گنجانده‌شده:' : 'Included Variants:'}
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                          {family.variants.map((v) => (
                            <div
                              key={v.id}
                              className="w-7 h-7 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-center p-0.5 shrink-0"
                              title={isPersian ? v.name.fa : v.name.en}
                            >
                              <img
                                src={v.src}
                                alt={v.name.en}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-3.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-mono text-[10px]">
                        scale {family.defaultScale}px · sp {family.defaultSpacing}px
                      </span>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-xl font-medium text-xs transition-all ${
                          isEquipped
                            ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-950'
                            : 'bg-zinc-800 hover:bg-amber-600 hover:text-white text-zinc-300'
                        }`}
                      >
                        {isEquipped
                          ? isPersian ? 'انتخاب‌شده' : 'Selected'
                          : isPersian ? 'انتخاب و تجهیز' : 'Equip Species'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span>
            {isPersian
              ? `${filteredFamilies.length} گونه در دسترس`
              : `${filteredFamilies.length} species available in collection`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            {isPersian ? 'بستن' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
