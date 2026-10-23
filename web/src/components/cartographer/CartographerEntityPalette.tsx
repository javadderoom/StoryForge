'use client';

import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  X,
  Search,
  Layers,
  Mountain,
  Waves,
  Split,
  Trees,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  WorldBible,
  WorldMapData,
  MapTerrainFeature,
  MapEntityPlacement,
} from '@/lib/types';
import { SelectedMapItem } from './CartographerInspector';
import { notify } from '@/lib/notify';
import {
  MAP_OBJECT_GROUP_ORDER,
  sortTerrainForList,
  terrainGroup,
  type MapObjectGroupKey,
} from '@/lib/engines/world/mapObjectOrder';
import { getMapSemanticReconciliation } from '@/lib/engines/world/mapSemantics';

interface CartographerEntityPaletteProps {
  worldBible: WorldBible;
  onSelectEntityForPlacement: (type: string, id: string) => void;
  onClose: () => void;
  isPersian: boolean;
  /**
   * Plan 21 — the map's own objects (terrain features and lore pins). These
   * are drawing primitives, not manifest place categories; a terrain feature
   * may link to a WorldLocation through its optional `locationId`.
   */
  mapData?: WorldMapData;
  onSelectMapObject?: (item: SelectedMapItem) => void;
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onRenameTerrain?: (id: string, name: string) => void;
  onReorderTerrain?: (id: string, direction: 'forward' | 'backward') => void;
  onDeleteTerrain?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onRenamePlacement?: (id: string, label: string) => void;
  onReorderPlacement?: (id: string, direction: 'forward' | 'backward') => void;
  onDeletePlacement?: (id: string) => void;
}

type PaletteTab = 'objects' | 'locations' | 'npcs' | 'bestiary' | 'artifacts' | 'religions' | 'timeline';

/** The bilingual heading of each object group. */
const GROUP_LABELS: Record<MapObjectGroupKey, { en: string; fa: string }> = {
  landmass: { en: 'Landmasses', fa: 'خشکی‌ها' },
  water: { en: 'Waters & Rivers', fa: 'آب‌ها و رودها' },
  range: { en: 'Ranges & Peaks', fa: 'رشته‌کوه‌ها و قله‌ها' },
  valley: { en: 'Valleys & Chasms', fa: 'دره‌ها و شکاف‌ها' },
  biome: { en: 'Biomes & Soil', fa: 'اقلیم‌ها و خاک' },
};

/** True when a feature carries no geometry at all, so it cannot be drawn. */
function hasNoGeometry(feature: MapTerrainFeature): boolean {
  if (feature.polygon && feature.polygon.length >= 3) return false;
  if (feature.points && feature.points.length >= 1) return false;
  if (typeof feature.x === 'number' && typeof feature.y === 'number') return false;
  return true;
}

export const CartographerEntityPalette: React.FC<CartographerEntityPaletteProps> = ({
  worldBible,
  onSelectEntityForPlacement,
  onClose,
  isPersian,
  mapData,
  onSelectMapObject,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onRenameTerrain,
  onReorderTerrain,
  onDeleteTerrain,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onRenamePlacement,
  onReorderPlacement,
  onDeletePlacement,
}) => {
  const [activeTab, setActiveTab] = useState<PaletteTab>('objects');
  const [search, setSearch] = useState('');
  /** Which row is being renamed inline. */
  const [editing, setEditing] = useState<{ kind: 'terrain' | 'placement'; id: string } | null>(null);
  const [draftName, setDraftName] = useState('');

  const locations = worldBible.locations || [];
  const npcs = worldBible.npcs || [];
  const creatures = worldBible.bestiary || [];
  const artifacts = worldBible.artifacts || [];
  const deities = worldBible.religions || [];
  const timeline = worldBible.timeline || [];
  const terrainFeatures = mapData?.terrainFeatures || [];
  const placements = mapData?.placements || [];
  const reconciliation = getMapSemanticReconciliation(worldBible, mapData);

  const tabs = [
    {
      id: 'objects' as const,
      label: { en: 'Map Objects', fa: 'عوارض نقشه' },
      icon: Layers,
      count: terrainFeatures.length + placements.length,
    },
    { id: 'locations' as const, label: { en: 'Locations', fa: 'مکان‌ها' }, icon: MapPin, count: locations.length },
    { id: 'npcs' as const, label: { en: 'NPCs', fa: 'شخصیت‌ها' }, icon: User, count: npcs.length },
    { id: 'bestiary' as const, label: { en: 'Bestiary', fa: 'جانوران' }, icon: Skull, count: creatures.length },
    { id: 'artifacts' as const, label: { en: 'Relics', fa: 'عتیقه‌ها' }, icon: Sparkles, count: artifacts.length },
    { id: 'religions' as const, label: { en: 'Deities', fa: 'ایزدان' }, icon: Sun, count: deities.length },
    { id: 'timeline' as const, label: { en: 'Timeline', fa: 'رویدادها' }, icon: History, count: timeline.length },
  ];

  const filterQuery = search.toLowerCase().trim();

  /** Resolves a lore pin's display name from the manifest it points at. */
  const resolvePinName = (pin: MapEntityPlacement): string => {
    if (pin.customLabel) return pin.customLabel;
    switch (pin.entityType) {
      case 'npc':
        return npcs.find((n) => n.id === pin.entityId)?.name || pin.entityId;
      case 'bestiary':
        return creatures.find((c) => c.id === pin.entityId)?.name || pin.entityId;
      case 'artifact':
        return artifacts.find((a) => a.id === pin.entityId)?.name || pin.entityId;
      case 'deity':
        return deities.find((d) => d.id === pin.entityId)?.name || pin.entityId;
      case 'timeline':
        return timeline.find((t) => t.id === pin.entityId)?.title || pin.entityId;
      case 'location':
        return locations.find((l) => l.id === pin.entityId)?.name || pin.entityId;
      default:
        return pin.entityId;
    }
  };

  const commitRename = () => {
    if (!editing) return;
    const value = draftName.trim();
    if (value) {
      if (editing.kind === 'terrain') onRenameTerrain?.(editing.id, value);
      else onRenamePlacement?.(editing.id, value);
    }
    setEditing(null);
  };

  const startRename = (kind: 'terrain' | 'placement', id: string, current: string) => {
    setEditing({ kind, id });
    setDraftName(current);
  };

  const groups = MAP_OBJECT_GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: sortTerrainForList(terrainFeatures).filter((f) => terrainGroup(f.type) === key),
  })).filter((group) => group.items.length > 0);

  const matchesFilter = (name: string) => !filterQuery || name.toLowerCase().includes(filterQuery);

  const visiblePlacements = placements.filter((p) => matchesFilter(resolvePinName(p)));

  return (
    <div className="absolute right-4 top-20 z-20 w-88 bg-zinc-950/92 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-4 shadow-2xl flex flex-col gap-3.5 select-none animate-fadeIn max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
          <Globe className="w-4 h-4 text-amber-400" />
          <span>{isPersian ? 'موجودی پرونده‌های جهان' : 'World Bible Palette'}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 border-b border-zinc-800/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{isPersian ? tab.label.fa : tab.label.en}</span>
              <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-zinc-950/30 text-zinc-900' : 'bg-zinc-800 text-zinc-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isPersian ? 'جستجو در موجودیت‌ها...' : 'Filter entities...'}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl pl-9 pr-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-1.5 min-h-[220px]">
        {/* Map Objects — the geography the author draws, plus lore pins */}
        {activeTab === 'objects' && (
          <div className="space-y-3">
            {(reconciliation.unlinkedPlaces.length > 0 ||
              reconciliation.missingPlaceLinks.length > 0) && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-200 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {isPersian ? 'ناسازگاری نقشه و روایت' : 'Map / story reconciliation'}
                </div>
                {reconciliation.unlinkedPlaces.length > 0 && (
                  <div className="mt-1 text-amber-200/80">
                    {isPersian
                      ? `${reconciliation.unlinkedPlaces.length} مکان غیرنقطه‌ای هندسه‌ای متصل ندارد.`
                      : `${reconciliation.unlinkedPlaces.length} non-point place(s) have no linked terrain.`}
                  </div>
                )}
                {reconciliation.missingPlaceLinks.length > 0 && (
                  <div className="mt-0.5 text-rose-300/90">
                    {isPersian
                      ? `${reconciliation.missingPlaceLinks.length} عارضه به مکان حذف‌شده اشاره می‌کند.`
                      : `${reconciliation.missingPlaceLinks.length} terrain feature(s) link to a missing place.`}
                  </div>
                )}
              </div>
            )}
            {groups.map((group) => {
              const GroupIcon =
                group.key === 'landmass'
                  ? Globe
                  : group.key === 'water'
                  ? Waves
                  : group.key === 'range'
                  ? Mountain
                  : group.key === 'valley'
                  ? Split
                  : Trees;
              const items = group.items.filter((f) => matchesFilter(f.name));
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1 pt-1">
                    <GroupIcon className="w-3 h-3 text-amber-400/70" />
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                      {isPersian ? group.label.fa : group.label.en}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono">{items.length}</span>
                  </div>

                  {items.map((feature) => (
                    <div
                      key={feature.id}
                      className="p-2 bg-zinc-900/70 border border-zinc-800/80 rounded-xl flex items-center gap-1.5 hover:border-zinc-700 transition-colors"
                    >
                      <button
                        onClick={() => onToggleTerrainVisibility?.(feature.id)}
                        title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                        className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                      >
                        {feature.visible === false ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-amber-400/80" />
                        )}
                      </button>
                      <button
                        onClick={() => onToggleTerrainLock?.(feature.id)}
                        title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                        className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                      >
                        {feature.locked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {editing?.kind === 'terrain' && editing.id === feature.id ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          className="flex-1 min-w-0 bg-zinc-900 border border-amber-500/50 text-zinc-100 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => onSelectMapObject?.({ type: 'terrain', data: feature })}
                          className="flex-1 min-w-0 text-left"
                          title={isPersian ? 'انتخاب روی نقشه' : 'Select on the map'}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-zinc-200 truncate">
                              {feature.name}
                            </span>
                            {hasNoGeometry(feature) && (
                              <AlertTriangle
                                className="w-3 h-3 text-amber-500 shrink-0"
                                aria-label={isPersian ? 'بدون هندسه' : 'No geometry'}
                              />
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">
                            {feature.type}
                            {feature.locationId
                              ? ` · ${locations.find((loc) => loc.id === feature.locationId)?.name || feature.locationId}`
                              : ''}
                          </div>
                        </button>
                      )}

                      <button
                        onClick={() => startRename('terrain', feature.id, feature.name)}
                        title={isPersian ? 'تغییر نام' : 'Rename'}
                        className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onReorderTerrain?.(feature.id, 'forward')}
                        title={isPersian ? 'یک پله جلوتر' : 'Bring forward'}
                        className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onReorderTerrain?.(feature.id, 'backward')}
                        title={isPersian ? 'یک پله عقب‌تر' : 'Send backward'}
                        className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={async () => {
                          const confirmed = await notify.confirm({
                            title: isPersian ? 'حذف عارضه طبیعی' : 'Delete terrain feature',
                            message: isPersian
                              ? `آیا از حذف "${feature.name}" اطمینان دارید؟`
                              : `Delete "${feature.name}" from the map?`,
                          });
                          if (confirmed) onDeleteTerrain?.(feature.id);
                        }}
                        title={isPersian ? 'حذف' : 'Delete'}
                        className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Lore pins */}
            {visiblePlacements.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <MapPin className="w-3 h-3 text-amber-400/70" />
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                    {isPersian ? 'سنجاق‌های داستانی' : 'Lore Pins'}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {visiblePlacements.length}
                  </span>
                </div>

                {visiblePlacements.map((pin) => (
                  <div
                    key={pin.id}
                    className="p-2 bg-zinc-900/70 border border-zinc-800/80 rounded-xl flex items-center gap-1.5 hover:border-zinc-700 transition-colors"
                  >
                    <button
                      onClick={() => onTogglePlacementVisibility?.(pin.id)}
                      title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                      className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                    >
                      {pin.visible === false ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-amber-400/80" />
                      )}
                    </button>
                    <button
                      onClick={() => onTogglePlacementLock?.(pin.id)}
                      title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                      className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                    >
                      {pin.locked ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {editing?.kind === 'placement' && editing.id === pin.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        className="flex-1 min-w-0 bg-zinc-900 border border-amber-500/50 text-zinc-100 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onSelectMapObject?.({ type: 'placement', data: pin })}
                        className="flex-1 min-w-0 text-left"
                        title={isPersian ? 'انتخاب روی نقشه' : 'Select on the map'}
                      >
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {resolvePinName(pin)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">{pin.entityType}</div>
                      </button>
                    )}

                    <button
                      onClick={() => startRename('placement', pin.id, resolvePinName(pin))}
                      title={isPersian ? 'تغییر نام' : 'Rename'}
                      className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onReorderPlacement?.(pin.id, 'forward')}
                      title={isPersian ? 'یک پله جلوتر' : 'Bring forward'}
                      className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onReorderPlacement?.(pin.id, 'backward')}
                      title={isPersian ? 'یک پله عقب‌تر' : 'Send backward'}
                      className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await notify.confirm({
                          title: isPersian ? 'برداشتن سنجاق' : 'Remove pin',
                          message: isPersian
                            ? 'آیا این سنجاق از نقشه برداشته شود؟'
                            : 'Remove this pin from the map?',
                        });
                        if (confirmed) onDeletePlacement?.(pin.id);
                      }}
                      title={isPersian ? 'حذف' : 'Delete'}
                      className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {terrainFeatures.length === 0 && placements.length === 0 && (
              <div className="text-center py-8 text-xs text-zinc-500">
                {isPersian
                  ? 'هنوز هیچ عارضه‌ای روی نقشه ترسیم نشده است'
                  : 'No map objects yet — draw some on the canvas'}
              </div>
            )}
          </div>
        )}
        {/* Locations */}
        {activeTab === 'locations' && (
          locations.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'مکانی ثبت نشده است' : 'No locations found'}
            </div>
          ) : (
            locations
              .filter((loc) => !filterQuery || loc.name.toLowerCase().includes(filterQuery) || loc.region?.toLowerCase().includes(filterQuery))
              .map((loc) => {
                const isPlaced = loc.coordinates && loc.coordinates.x > 0;
                return (
                  <div
                    key={loc.id}
                    className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{loc.name}</span>
                        {isPlaced ? (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 rounded font-mono">
                            {isPersian ? 'مستقر' : 'Placed'}
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 rounded font-mono">
                            {isPersian ? 'نامستقر' : 'Unplaced'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {loc.region || (isPersian ? 'منطقه نامشخص' : 'Unknown region')} • {isPersian ? `سطح خطر ${loc.dangerLevel}` : `Danger ${loc.dangerLevel}`}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectEntityForPlacement('location', loc.id)}
                      className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/30 rounded-xl text-xs font-medium transition-all shrink-0"
                    >
                      {isPlaced ? (isPersian ? 'جابجایی' : 'Move') : (isPersian ? 'استقرار' : 'Place')}
                    </button>
                  </div>
                );
              })
          )
        )}

        {/* NPCs */}
        {activeTab === 'npcs' && (
          npcs.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'شخصیتی ثبت نشده است' : 'No NPCs found'}
            </div>
          ) : (
            npcs
              .filter((n) => !filterQuery || n.name.toLowerCase().includes(filterQuery) || n.title?.toLowerCase().includes(filterQuery))
              .map((npc) => {
                const assignedLoc = locations.find((l) => l.id === npc.currentLocationId);
                return (
                  <div
                    key={npc.id}
                    className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{npc.name}</span>
                        {npc.role && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">
                            {npc.role}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {assignedLoc ? assignedLoc.name : (isPersian ? 'بدون مقر ثابت' : 'No station')}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectEntityForPlacement('npc', npc.id)}
                      className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                    >
                      {isPersian ? 'نشاندن' : 'Station'}
                    </button>
                  </div>
                );
              })
          )
        )}

        {/* Creatures */}
        {activeTab === 'bestiary' && (
          creatures.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'هیولایی در جانورنامه نیست' : 'No creatures registered'}
            </div>
          ) : (
            creatures
              .filter((c) => !filterQuery || c.name.toLowerCase().includes(filterQuery))
              .map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="truncate">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{c.name}</span>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {c.speciesCategory} • {isPersian ? `خطر ${c.dangerLevel}` : `Danger ${c.dangerLevel}`}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectEntityForPlacement('bestiary', c.id)}
                    className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                  >
                    {isPersian ? 'ثبت قلمرو' : 'Place Den'}
                  </button>
                </div>
              ))
          )
        )}

        {/* Relics */}
        {activeTab === 'artifacts' && (
          artifacts.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'عتیقه‌ای ثبت نشده است' : 'No relics registered'}
            </div>
          ) : (
            artifacts
              .filter((a) => !filterQuery || a.name.toLowerCase().includes(filterQuery))
              .map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="truncate">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{a.name}</span>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {a.rarity} • {a.originEra || (isPersian ? 'باستانی' : 'Ancient')}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectEntityForPlacement('artifact', a.id)}
                    className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                  >
                    {isPersian ? 'دفن عتیقه' : 'Place Vault'}
                  </button>
                </div>
              ))
          )
        )}

        {/* Religions / Deities */}
        {activeTab === 'religions' && (
          deities.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'ایزدی ثبت نشده است' : 'No deities registered'}
            </div>
          ) : (
            deities
              .filter((d) => !filterQuery || d.name.toLowerCase().includes(filterQuery))
              .map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="truncate">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{d.name}</span>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {d.domain} • {d.sacredSymbol || (isPersian ? 'نماد مقدس' : 'Sacred')}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectEntityForPlacement('deity', d.id)}
                    className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500 text-yellow-300 hover:text-zinc-950 border border-yellow-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                  >
                    {isPersian ? 'بنای معبد' : 'Place Shrine'}
                  </button>
                </div>
              ))
          )
        )}

        {/* Timeline Events */}
        {activeTab === 'timeline' && (
          timeline.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'رویدادی ثبت نشده است' : 'No timeline events'}
            </div>
          ) : (
            timeline
              .filter((t) => !filterQuery || t.title.toLowerCase().includes(filterQuery))
              .map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="truncate">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{t.title}</span>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                      {t.yearOrEra} • {t.eraCategory}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectEntityForPlacement('timeline', t.id)}
                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                  >
                    {isPersian ? 'ثبت نبرد' : 'Pin Event'}
                  </button>
                </div>
              ))
          )
        )}
      </div>
    </div>
  );
};
