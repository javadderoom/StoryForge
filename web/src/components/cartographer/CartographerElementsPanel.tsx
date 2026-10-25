'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Globe,
  Layers,
  Mountain,
  Waves,
  Split,
  Trees,
  Castle,
  Route,
  MapPin,
  ListTree,
  Crosshair,
} from 'lucide-react';
import {
  WorldBible,
  WorldMapData,
  MapTerrainFeature,
  MapEntityPlacement,
  MapRoute,
  WorldLocation,
  WorldTradeRoute,
  CustomPlaceCategory,
} from '@/lib/types';
import { SelectedMapItem } from './CartographerInspector';
import { isObjectLocked, isObjectVisible } from '@/lib/engines/world/mapObjectOrder';
import { routeDifficultyLabel, routeKindLabel } from '@/lib/engines/world/mapRoutes';
import { resolvePlaceCategoryMeta } from '@/lib/engines/world/placeCategories';

export type ElementCategoryKey =
  | 'landmass'
  | 'highland'
  | 'mountain'
  | 'water'
  | 'valley'
  | 'biome'
  | 'settlement'
  | 'road'
  | 'route'
  | 'pin';

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

interface CategoryDefinition {
  key: ElementCategoryKey;
  label: { en: string; fa: string };
  emptyMessage: { en: string; fa: string };
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: 'landmass',
    label: { en: 'Landmasses & Islands', fa: 'قاره‌ها و جزایر' },
    emptyMessage: { en: 'No landmasses drawn yet', fa: 'هنوز خشکی رسم نشده است' },
    icon: Globe,
    color: 'text-amber-400',
  },
  {
    key: 'highland',
    label: { en: 'Highlands & Plateaus', fa: 'فلات‌ها و زمین‌های مرتفع' },
    emptyMessage: { en: 'No highlands or plateaus drawn', fa: 'هنوز فلات یا بلندی رسم نشده است' },
    icon: Layers,
    color: 'text-stone-300',
  },
  {
    key: 'mountain',
    label: { en: 'Mountains & Peaks', fa: 'رشته‌کوه‌ها و قله‌ها' },
    emptyMessage: { en: 'No mountains or peaks placed', fa: 'هنوز کوهستانی افزوده نشده است' },
    icon: Mountain,
    color: 'text-orange-400',
  },
  {
    key: 'water',
    label: { en: 'Rivers, Lakes & Waters', fa: 'رودخانه‌ها، دریاچه‌ها و آب‌ها' },
    emptyMessage: { en: 'No rivers or lakes drawn', fa: 'هنوز رود یا دریاچه‌ای رسم نشده است' },
    icon: Waves,
    color: 'text-cyan-400',
  },
  {
    key: 'valley',
    label: { en: 'Valleys & Chasms', fa: 'دره‌ها و شکاف‌ها' },
    emptyMessage: { en: 'No valleys or canyons drawn', fa: 'هنوز دره یا شکافی رسم نشده است' },
    icon: Split,
    color: 'text-zinc-400',
  },
  {
    key: 'biome',
    label: { en: 'Biomes & Vegetation', fa: 'اقلیم‌ها و پوشش گیاهی' },
    emptyMessage: { en: 'No biomes (forests, deserts) painted', fa: 'هنوز اقلیم یا جنگلی رنگ‌آمیزی نشده است' },
    icon: Trees,
    color: 'text-emerald-400',
  },
  {
    key: 'settlement',
    label: { en: 'Settlements & Sites', fa: 'شهرها، دژها و مکان‌ها' },
    emptyMessage: { en: 'No locations placed on map', fa: 'هیچ مکانی روی نقشه قرار نگرفته است' },
    icon: Castle,
    color: 'text-amber-300',
  },
  {
    key: 'road',
    label: { en: 'Roads & Paths', fa: 'جاده‌ها و راه‌ها' },
    emptyMessage: { en: 'No roads drawn yet', fa: 'هنوز جاده‌ای رسم نشده است' },
    icon: Route,
    color: 'text-amber-300',
  },
  {
    key: 'route',
    label: { en: 'Trade Corridors', fa: 'مسیرهای تجاری کاروان' },
    emptyMessage: { en: 'No trade corridors linked', fa: 'هیچ مسیر تجاری متصل نشده است' },
    icon: Route,
    color: 'text-orange-400',
  },
  {
    key: 'pin',
    label: { en: 'Lore Pins & Entities', fa: 'شخصیت‌ها و نشان‌های داستانی' },
    emptyMessage: { en: 'No lore markers or NPCs placed', fa: 'هیچ نشان داستانی مستقر نشده است' },
    icon: MapPin,
    color: 'text-indigo-400',
  },
];

type ItemWrapper =
  | {
      kind: 'terrain';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapTerrainFeature;
    }
  | {
      kind: 'location';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: WorldLocation;
    }
  | {
      kind: 'route';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: WorldTradeRoute;
    }
  | {
      kind: 'road';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapRoute;
    }
  | {
      kind: 'placement';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapEntityPlacement;
    };

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

  // Classify all elements into their respective categories
  const categorizedItems = useMemo<Record<ElementCategoryKey, ItemWrapper[]>>(() => {
    const terrainFeatures = mapData.terrainFeatures || [];
    const placements = mapData.placements || [];
    const locations = worldBible.locations || [];
    const routes = worldBible.tradeRoutes || [];
    const roads = mapData.routes || [];

    const result: Record<ElementCategoryKey, ItemWrapper[]> = {
      landmass: [],
      highland: [],
      mountain: [],
      water: [],
      valley: [],
      biome: [],
      settlement: [],
      road: [],
      route: [],
      pin: [],
    };

    // Classify terrain features
    for (const feat of terrainFeatures) {
      const isVis = isObjectVisible(feat);
      const isLck = isObjectLocked(feat);
      const label = feat.name || feat.type;

      if (feat.type === 'continent' || feat.type === 'island') {
        result.landmass.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: feat.type === 'continent' ? (isPersian ? 'قاره' : 'Continent') : (isPersian ? 'جزیره' : 'Island'),
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'highland' || feat.type === 'plateau') {
        result.highland.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: feat.type === 'highland' ? (isPersian ? 'زمین مرتفع' : 'Highland') : (isPersian ? 'فلات کوهستانی' : 'Plateau'),
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'mountain_range' || feat.type === 'peak' || feat.type === 'volcano') {
        const sub =
          feat.type === 'volcano'
            ? isPersian ? 'آتشفشان' : 'Volcano'
            : feat.type === 'peak'
            ? isPersian ? 'قله منفرد' : 'Peak'
            : isPersian ? 'رشته‌کوه' : 'Mountain Range';
        result.mountain.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'river' || feat.type === 'lake' || feat.type === 'ocean' || feat.type === 'sea') {
        const sub =
          feat.type === 'river'
            ? isPersian ? 'رودخانه' : 'River'
            : feat.type === 'lake'
            ? isPersian ? 'دریاچه' : 'Lake'
            : isPersian ? 'پهنه آبی' : 'Sea / Ocean';
        result.water.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'valley' || feat.type === 'canyon' || feat.type === 'chasm') {
        const sub =
          feat.type === 'chasm'
            ? isPersian ? 'شکاف عمیق' : 'Chasm'
            : feat.type === 'canyon'
            ? isPersian ? 'دره تنگ (کنیون)' : 'Canyon'
            : isPersian ? 'دره' : 'Valley';
        result.valley.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else {
        // Biomes: forest, jungle, desert, tundra, swamp, wasteland, plains, oasis, arcane_anomaly
        const sub =
          feat.type === 'forest'
            ? isPersian ? 'جنگل معتدل' : 'Forest'
            : feat.type === 'jungle'
            ? isPersian ? 'جنگل بارانی' : 'Jungle'
            : feat.type === 'desert'
            ? isPersian ? 'بیابان / کویر' : 'Desert'
            : feat.type === 'swamp'
            ? isPersian ? 'مرداب / باتلاق' : 'Swamp'
            : feat.type === 'tundra'
            ? isPersian ? 'توندرا' : 'Tundra'
            : feat.type === 'oasis'
            ? isPersian ? 'واحه بیابانی' : 'Oasis'
            : feat.type === 'wasteland'
            ? isPersian ? 'زمین‌های بایر' : 'Wasteland'
            : feat.type === 'plains'
            ? isPersian ? 'دشت' : 'Plains'
            : feat.type === 'arcane_anomaly'
            ? isPersian ? 'ناهنجاری اسرارآمیز' : 'Arcane Anomaly'
            : isPersian ? 'اقلیم طبیعی' : 'Biome Wash';
        result.biome.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      }
    }

    // Settlements & semantic places. Plan 24 metadata is the single source of
    // truth the renderer and hit test already use, so the list agrees with the
    // map: a point place (settlement, stronghold, ruin, dungeon, custom pin)
    // belongs here, while a place drawn as a line/area (waterway, sea, plains
    // region, anomaly) is filed under its geographical bucket instead of
    // masquerading as a settlement.
    for (const loc of locations) {
      const isVis = isObjectVisible(loc);
      const isLck = isObjectLocked(loc);
      const meta = resolvePlaceCategoryMeta(loc.category, placeCategories);
      const categoryLabel =
        placeCategories?.find((category) => category.id === loc.category)?.name ||
        (loc.category
          ? loc.category.charAt(0).toUpperCase() + loc.category.slice(1)
          : isPersian ? 'سکونت‌گاه' : 'Settlement');
      const wrapper = {
        kind: 'location' as const,
        id: loc.id,
        name: loc.name || (isPersian ? 'مکان نامشخص' : 'Unnamed Location'),
        subtitle: categoryLabel,
        visible: isVis,
        locked: isLck,
        raw: loc,
      };

      if (meta.renderAs === 'settlement') {
        result.settlement.push(wrapper);
      } else if (meta.renderAs === 'water' || meta.renderAs === 'line') {
        // A waterway or sea is a body of water, not a city.
        result.water.push(wrapper);
      } else {
        // Plains, wilderness regions and arcane anomalies sit with biomes.
        result.biome.push(wrapper);
      }
    }

    // Caravan Routes
    for (const r of routes) {
      const isVis = isObjectVisible(r);
      const isLck = isObjectLocked(r);
      result.route.push({
        kind: 'route',
        id: r.id,
        name: r.name || (isPersian ? 'مسیر کاروان' : 'Trade Route'),
        subtitle: r.status
          ? r.status.charAt(0).toUpperCase() + r.status.slice(1)
          : isPersian ? 'مسیر کاروان' : 'Trade Route',
        visible: isVis,
        locked: isLck,
        raw: r,
      });
    }

    // Drawn roads and paths (Plan 25)
    for (const road of roads) {
      const isVis = isObjectVisible(road);
      const isLck = isObjectLocked(road);
      const kindLabel = routeKindLabel(road.kind, isPersian);
      const difficultyLabel = routeDifficultyLabel(road.difficulty, isPersian);
      result.road.push({
        kind: 'road',
        id: road.id,
        name: road.name || kindLabel,
        subtitle: `${kindLabel} · ${difficultyLabel}`,
        visible: isVis,
        locked: isLck,
        raw: road,
      });
    }

    // Placements / Lore Pins
    for (const p of placements) {
      const isVis = isObjectVisible(p);
      const isLck = isObjectLocked(p);
      let label = p.customLabel;
      if (!label) {
        if (p.entityType === 'npc') {
          label = worldBible.npcs?.find((n) => n.id === p.entityId)?.name || 'NPC';
        } else if (p.entityType === 'bestiary') {
          label = worldBible.bestiary?.find((b) => b.id === p.entityId)?.name || 'Creature';
        } else if (p.entityType === 'artifact') {
          label = worldBible.artifacts?.find((a) => a.id === p.entityId)?.name || 'Artifact';
        } else if (p.entityType === 'deity') {
          label = worldBible.religions?.find((r) => r.id === p.entityId)?.name || 'Deity / Shrine';
        } else {
          label = p.entityType;
        }
      }
      result.pin.push({
        kind: 'placement',
        id: p.id,
        name: label,
        subtitle: p.entityType.toUpperCase(),
        visible: isVis,
        locked: isLck,
        raw: p,
      });
    }

    return result;
  }, [mapData.terrainFeatures, mapData.placements, mapData.routes, worldBible, placeCategories, isPersian]);

  // Total element count across all categories
  const totalCount = useMemo(() => {
    return Object.values(categorizedItems).reduce((sum, list) => sum + list.length, 0);
  }, [categorizedItems]);

  // Filter items per category according to search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categorizedItems;

    const filtered: Record<ElementCategoryKey, ItemWrapper[]> = {
      landmass: [],
      highland: [],
      mountain: [],
      water: [],
      valley: [],
      biome: [],
      settlement: [],
      road: [],
      route: [],
      pin: [],
    };

    for (const [key, items] of Object.entries(categorizedItems) as [ElementCategoryKey, ItemWrapper[]][]) {
      filtered[key] = items.filter(
        (it) => it.name.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [categorizedItems, searchQuery]);

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
                      <div
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`group px-2 py-1.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          item.visible
                            ? 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-900/90 hover:border-zinc-700'
                            : 'bg-zinc-950/30 border-zinc-800/30 opacity-60 hover:opacity-80'
                        }`}
                        title={isPersian ? 'کلیک برای زوم و انتخاب' : 'Click to select and center on map'}
                      >
                        {/* Left: Eye Visibility Toggle + Name & Subtitle */}
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={(e) => handleToggleItemVisibility(e, item)}
                            className={`p-1 rounded-md transition-colors shrink-0 ${
                              item.visible
                                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                                : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
                            }`}
                            title={
                              isPersian
                                ? item.visible
                                  ? 'پنهان‌سازی این المنت'
                                  : 'نمایش این المنت'
                                : item.visible
                                ? 'Hide this element'
                                : 'Show this element'
                            }
                          >
                            {item.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <div className="min-w-0 flex flex-col">
                            <span
                              className={`text-xs font-medium truncate ${
                                item.visible ? 'text-zinc-200' : 'text-zinc-500 line-through'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate font-mono">
                              {item.subtitle}
                            </span>
                          </div>
                        </div>

                        {/* Right: Quick Lock, Focus & Delete Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Center / Focus Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectItem(item);
                            }}
                            className="p-1 text-zinc-500 hover:text-amber-300 hover:bg-zinc-800 rounded-md transition-colors"
                            title={isPersian ? 'نمایش در مرکز نقشه' : 'Focus on map'}
                          >
                            <Crosshair className="w-3 h-3" />
                          </button>

                          {/* Lock / Unlock Button */}
                          <button
                            onClick={(e) => handleToggleItemLock(e, item)}
                            className={`p-1 rounded-md transition-colors ${
                              item.locked
                                ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
                                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title={
                              isPersian
                                ? item.locked
                                  ? 'بازکردن قفل'
                                  : 'قفل کردن جهت جلوگیری از جابجایی'
                                : item.locked
                                ? 'Unlock element'
                                : 'Lock element position'
                            }
                          >
                            {item.locked ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={(e) => handleDeleteItem(e, item)}
                            className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                            title={isPersian ? 'حذف المنت' : 'Delete element'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
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
