'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  { id: 'all', labelEn: 'All Species', labelFa: 'همه نمادها', icon: <Layers className="w-4 h-4" /> },
  { id: 'tree', labelEn: 'Trees & Woodlands', labelFa: 'درختان و بیشه‌ها', icon: <Trees className="w-4 h-4" /> },
  { id: 'mountain', labelEn: 'Mountains & Ridges', labelFa: 'کوه‌ها و تیغه‌ها', icon: <Mountain className="w-4 h-4" /> },
  { id: 'hill', labelEn: 'Hills & Knolls', labelFa: 'تپه‌ها و ماهورها', icon: <Mountain className="w-4 h-4 opacity-75" /> },
  { id: 'stone_rock', labelEn: 'Stones & Rocks', labelFa: 'سنگ‌ها و صخره‌ها', icon: <Layers className="w-4 h-4 opacity-75" /> },
  { id: 'grass_flora', labelEn: 'Grass & Flora', labelFa: 'علفزار و نیزار', icon: <Flower2 className="w-4 h-4" /> },
  { id: 'landmark', labelEn: 'Landmarks & POIs', labelFa: 'دژها و نمادها', icon: <Castle className="w-4 h-4" /> },
];

export const GeoSpeciesPickerModal: React.FC<GeoSpeciesPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectFamily,
  currentlySelectedFamily,
  categoryFilter = 'all',
  isPersian = false,
}) => {
  const [activeTab, setActiveTab] = useState<GeoSymbolCategory | 'all'>(categoryFilter);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredFamilies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allFamilies.filter((family) => {
      // 1. Tab filter
      if (activeTab !== 'all' && family.category !== activeTab) {
        return false;
      }
      // 2. Search query filter
      if (!query) return true;
      const matchEn = family.name.en.toLowerCase().includes(query) ||
        family.description.en.toLowerCase().includes(query) ||
        family.id.toLowerCase().includes(query);
      const matchFa = family.name.fa.toLowerCase().includes(query) ||
        family.description.fa.toLowerCase().includes(query);
      return matchEn || matchFa;
    });
  }, [allFamilies, activeTab, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-zinc-950 border border-amber-900/40 shadow-2xl overflow-hidden text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-amber-100">
                {isPersian ? 'کتابخانه گونه‌ها و نمادهای طبیعی' : 'Cartography Species & Symbol Library'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isPersian
                  ? 'انتخاب گونه‌های درختان، کوه‌ها، تپه‌ها و نمادهای آماده برای نقشه‌نگاری باکیفیت'
                  : 'Equip ready-to-use vector relief massifs and flora sprites for your map'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title={isPersian ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Tabs */}
        <div className="px-6 py-3 border-b border-zinc-800/60 bg-zinc-900/30 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isPersian
                  ? 'جستجوی گونه، کوه، درخت، تپه یا دژ...'
                  : 'Search species by name, type, or landscape feature...'
              }
              className="w-full pl-9 pr-9 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800'
                  }`}
                >
                  {tab.icon}
                  <span>{isPersian ? tab.labelFa : tab.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Species Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredFamilies.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <p className="text-sm font-medium">
                {isPersian ? 'گونه‌ای با این مشخصات یافت نشد.' : 'No species found matching your search.'}
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
                    className={`group relative flex flex-col justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isEquipped
                        ? 'bg-amber-950/20 border-amber-500/80 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50'
                        : 'bg-zinc-900/40 hover:bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      {/* Thumbnail Box */}
                      <div className="relative w-full h-28 rounded-xl bg-gradient-to-b from-[#f3e9d2]/15 to-[#e6d8ba]/10 border border-amber-900/20 flex items-center justify-center p-3 overflow-hidden mb-3 group-hover:scale-[1.02] transition-transform">
                        <img
                          src={family.thumbnail}
                          alt={family.name.en}
                          className="max-h-20 max-w-[85%] object-contain drop-shadow-md select-none"
                          loading="lazy"
                        />
                        {isEquipped && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>{isPersian ? 'فعال' : 'Equipped'}</span>
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-950/80 text-zinc-300 border border-zinc-800">
                          {family.variants.length}{' '}
                          {isPersian ? 'نگاره' : 'variants'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-xs font-bold text-zinc-100 group-hover:text-amber-200 transition-colors">
                        {isPersian ? family.name.fa : family.name.en}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {isPersian ? family.description.fa : family.description.en}
                      </p>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 font-mono">
                        {family.defaultScale}px · sp {family.defaultSpacing}
                      </span>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-lg font-medium transition-all ${
                          isEquipped
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'bg-zinc-800 hover:bg-amber-600 hover:text-white text-zinc-300'
                        }`}
                      >
                        {isEquipped
                          ? isPersian ? 'انتخاب‌شده' : 'Selected'
                          : isPersian ? 'انتخاب و استفاده' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-400">
          <span>
            {isPersian
              ? `${filteredFamilies.length} گونه در دسترس`
              : `${filteredFamilies.length} species available`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            {isPersian ? 'بستن' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
