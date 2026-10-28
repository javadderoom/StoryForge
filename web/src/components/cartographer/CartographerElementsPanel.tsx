'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ListTree,
} from 'lucide-react';
import {
  WorldBible,
  WorldMapData,
  CustomPlaceCategory,
} from '@/lib/types';
import { SelectedMapItem } from './CartographerInspector';
import {
  ElementCategoryKey,
  ItemWrapper,
  CATEGORY_DEFINITIONS,
} from './elements/types';
import { useCategorizedElements } from './elements/useCategorizedElements';
import { ElementItemRow } from './elements/ElementItemRow';

export type { ElementCategoryKey };

interface CartographerElementsPanelProps {
  worldBible: WorldBible;
  mapData: WorldMapData;
  onClose: () => void;
  isPersian: boolean;
  onSelectMapObject?: (item: SelectedMapItem) => void;
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onDeleteTerrain?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onDeletePlacement?: (id: string) => void;
  onToggleLocationVisibility?: (id: string) => void;
  onToggleLocationLock?: (id: string) => void;
  onDeleteLocation?: (id: string) => void;
  onToggleRouteVisibility?: (id: string) => void;
  onToggleRouteLock?: (id: string) => void;
  onDeleteRoute?: (id: string) => void;
  /** Plan 25 — drawn roads and paths. */
  onToggleRoadVisibility?: (id: string) => void;
  onToggleRoadLock?: (id: string) => void;
  onDeleteRoad?: (id: string) => void;
  /**
   * Plan 24 place-category metadata — the same source of truth the renderer,
   * hit test and inspector use. It decides whether a location is a point
   * place (settlement bucket) or a semantic line/area place filed under the
   * matching geographical bucket.
   */
  placeCategories?: CustomPlaceCategory[];
  /**
   * Plan 25: applies one visibility state to many elements as a single
   * undoable action with a single notification. Falls back to per-item
   * toggles when absent.
   */
  onSetElementsVisibility?: (
    targets: Array<{ kind: ItemWrapper['kind']; id: string }>,
    visible: boolean
  ) => void;
}

export const CartographerElementsPanel: React.FC<CartographerElementsPanelProps> = ({
  worldBible,
  mapData,
  onClose,
  isPersian,
  onSelectMapObject,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onDeleteTerrain,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onDeletePlacement,
  onToggleLocationVisibility,
  onToggleLocationLock,
  onDeleteLocation,
  onToggleRouteVisibility,
  onToggleRouteLock,
  onDeleteRoute,
  onToggleRoadVisibility,
  onToggleRoadLock,
  onDeleteRoad,
  placeCategories,
  onSetElementsVisibility,
}) => {
  // Accordion state: null initially so all categories start collapsed.
  // Opening any category automatically closes all others.
  const [expandedCategory, setExpandedCategory] = useState<ElementCategoryKey | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { categorizedItems, filteredCategories, totalCount } = useCategorizedElements({
    worldBible,
    mapData,
    placeCategories,
    isPersian,
    searchQuery,
  });

  // Accordion toggle: clicking an open category closes it; clicking any other opens it and closes others
  const handleToggleCategory = (categoryKey: ElementCategoryKey) => {
    setExpandedCategory((curr) => (curr === categoryKey ? null : categoryKey));
  };

  // Toggle visibility of a specific item
  const handleToggleItemVisibility = (e: React.MouseEvent, item: ItemWrapper) => {
    e.stopPropagation();
    if (item.kind === 'terrain') {
      onToggleTerrainVisibility?.(item.id);
    } else if (item.kind === 'placement') {
      onTogglePlacementVisibility?.(item.id);
    } else if (item.kind === 'location') {
      onToggleLocationVisibility?.(item.id);
    } else if (item.kind === 'route') {
      onToggleRouteVisibility?.(item.id);
    } else if (item.kind === 'road') {
      onToggleRoadVisibility?.(item.id);
    }
  };

  // Toggle lock of a specific item
  const handleToggleItemLock = (e: React.MouseEvent, item: ItemWrapper) => {
    e.stopPropagation();
    if (item.kind === 'terrain') {
      onToggleTerrainLock?.(item.id);
    } else if (item.kind === 'placement') {
      onTogglePlacementLock?.(item.id);
    } else if (item.kind === 'location') {
      onToggleLocationLock?.(item.id);
    } else if (item.kind === 'route') {
      onToggleRouteLock?.(item.id);
    } else if (item.kind === 'road') {
      onToggleRoadLock?.(item.id);
    }
  };

  // Delete a specific item
  const handleDeleteItem = (e: React.MouseEvent, item: ItemWrapper) => {
    e.stopPropagation();
    if (item.kind === 'terrain') {
      onDeleteTerrain?.(item.id);
    } else if (item.kind === 'placement') {
      onDeletePlacement?.(item.id);
    } else if (item.kind === 'location') {
      onDeleteLocation?.(item.id);
    } else if (item.kind === 'route') {
      onDeleteRoute?.(item.id);
    } else if (item.kind === 'road') {
      onDeleteRoad?.(item.id);
    }
  };

  // Select and focus on the map
  const handleSelectItem = (item: ItemWrapper) => {
    if (item.kind === 'terrain') {
      onSelectMapObject?.({ type: 'terrain', data: item.raw });
    } else if (item.kind === 'placement') {
      onSelectMapObject?.({ type: 'placement', data: item.raw });
    } else if (item.kind === 'location') {
      onSelectMapObject?.({ type: 'location', data: item.raw });
    } else if (item.kind === 'route') {
      onSelectMapObject?.({ type: 'trade_route', data: item.raw });
    } else if (item.kind === 'road') {
      onSelectMapObject?.({ type: 'route', data: item.raw });
    }
  };

  // Category-level bulk visibility toggle: if any is visible, hide all; if all
  // hidden, show all. One batched action — one undo step, one notification —
  // instead of a toast per element.
  const handleToggleCategoryBulkVisibility = (e: React.MouseEvent, categoryKey: ElementCategoryKey) => {
    e.stopPropagation();
    const items = categorizedItems[categoryKey];
    if (items.length === 0) return;

    const anyVisible = items.some((it) => it.visible);
    const targetState = !anyVisible;
    const targets = items
      .filter((it) => it.visible !== targetState)
      .map((it) => ({ kind: it.kind, id: it.id }));

    if (targets.length === 0) return;

    if (onSetElementsVisibility) {
      onSetElementsVisibility(targets, targetState);
      return;
    }

    for (const item of items) {
      if (item.visible !== targetState) {
        if (item.kind === 'terrain') onToggleTerrainVisibility?.(item.id);
        else if (item.kind === 'placement') onTogglePlacementVisibility?.(item.id);
        else if (item.kind === 'location') onToggleLocationVisibility?.(item.id);
        else if (item.kind === 'route') onToggleRouteVisibility?.(item.id);
        else if (item.kind === 'road') onToggleRoadVisibility?.(item.id);
      }
    }
  };

  const ChevronIcon = isPersian ? ChevronLeft : ChevronRight;

  return (
    <aside
      className={`absolute top-4 ${
        isPersian ? 'left-4' : 'right-4'
      } w-88 sm:w-96 bg-zinc-950/95 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-4 shadow-2xl z-20 flex flex-col gap-3 max-h-[calc(100vh-6rem)] animate-in fade-in slide-in-from-${
        isPersian ? 'left' : 'right'
      }-4 duration-200 select-none text-zinc-100`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ListTree className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-wide">
                {isPersian ? 'المنت‌های نقشه' : 'Map Elements'}
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {totalCount}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              {isPersian
                ? 'فهرست و مدیریت تک‌تک اجزای ترسیم‌شده'
                : 'Browse & toggle drawn geographical features'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl transition-colors"
          title={isPersian ? 'بستن' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute ${isPersian ? 'right-3' : 'left-3'} top-2.5 w-3.5 h-3.5 text-zinc-500`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isPersian ? 'جستجوی نام یا نوع المنت...' : 'Search elements by name...'}
          className={`w-full bg-zinc-900/90 border border-zinc-800/90 rounded-2xl ${
            isPersian ? 'pr-9 pl-8' : 'pl-9 pr-8'
          } py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={`absolute ${isPersian ? 'left-2.5' : 'right-2.5'} top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Accordion Categories Container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {CATEGORY_DEFINITIONS.map((def) => {
          const items = filteredCategories[def.key];
          const isExpanded = expandedCategory === def.key;
          const totalCategoryItems = categorizedItems[def.key].length;
          const anyVisible = items.some((it) => it.visible);
          const allHidden = items.length > 0 && !anyVisible;
          const Icon = def.icon;

          return (
            <div
              key={def.key}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'border-amber-500/40 bg-zinc-900/70 shadow-lg shadow-black/20'
                  : 'border-zinc-800/70 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-zinc-700/70'
              }`}
            >
              {/* Category Accordion Header */}
              <div
                onClick={() => handleToggleCategory(def.key)}
                className="p-2.5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 ${def.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {isPersian ? def.label.fa : def.label.en}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-zinc-950/70 text-zinc-400 border border-zinc-800/60">
                    {searchQuery ? `${items.length}/${totalCategoryItems}` : items.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Category-level Bulk Visibility Toggle */}
                  {items.length > 0 && (
                    <button
                      onClick={(e) => handleToggleCategoryBulkVisibility(e, def.key)}
                      className={`p-1 rounded-lg hover:bg-zinc-800 transition-colors ${
                        allHidden ? 'text-zinc-600' : 'text-amber-400/80 hover:text-amber-300'
                      }`}
                      title={
                        isPersian
                          ? allHidden
                            ? 'نمایش همه در این دسته'
                            : 'پنهان‌سازی همه در این دسته'
                          : allHidden
                          ? 'Show all in this category'
                          : 'Hide all in this category'
                      }
                    >
                      {allHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Accordion Chevron */}
                  <div className="text-zinc-500 transition-transform duration-200">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <ChevronIcon className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Category Expanded Items List */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 pt-1 space-y-1.5 border-t border-zinc-800/50">
                  {items.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-[11px] text-zinc-500 italic">
                        {isPersian ? def.emptyMessage.fa : def.emptyMessage.en}
                      </p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <ElementItemRow
                        key={item.id}
                        item={item}
                        isPersian={isPersian}
                        onSelect={handleSelectItem}
                        onToggleVisibility={handleToggleItemVisibility}
                        onToggleLock={handleToggleItemLock}
                        onDelete={handleDeleteItem}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
