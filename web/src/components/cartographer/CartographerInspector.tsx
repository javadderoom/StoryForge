'use client';

import React, { useState } from 'react';
import {
  Castle,
  Route,
  Mountain,
  User,
  X,
  Trash2,
  MapPin,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Snowflake,
  Link2,
  Unlink,
  GitFork,
  Waves,
  Wind,
  Trees,
  Type,
} from 'lucide-react';
import {
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapRoute,
  MapRouteDifficulty,
  MapRouteKind,
  MapRouteLineStyle,
  NPCDossier,
  TradeRouteStatus,
  Faction,
  CustomPlaceCategory,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { resolvePlaceCategoryMeta } from '@/lib/engines/world/placeCategories';
import {
  MAP_ROUTE_DIFFICULTY_LABELS,
  MAP_ROUTE_KIND_META,
  endpointLabelForRef,
  resolveRouteEndpointPoint,
  routeKindLabel,
  snapRouteEndpoint,
} from '@/lib/engines/world/mapRoutes';
import {
  findTerrainCandidatesForPlace,
  placeAcceptsTerrainType,
} from '@/lib/engines/world/terrainPlacePairing';

export type SelectedMapItem =
  | { type: 'location'; data: WorldLocation }
  | { type: 'trade_route'; data: WorldTradeRoute }
  | { type: 'route'; data: MapRoute }
  | { type: 'terrain'; data: MapTerrainFeature }
  | { type: 'placement'; data: MapEntityPlacement }
  | null;

interface CartographerInspectorProps {
  selectedItem: SelectedMapItem;
  onClose: () => void;
  onUpdateLocation: (id: string, updated: Partial<WorldLocation>) => void;
  onDeleteLocation: (id: string) => void;
  onUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  onDeleteTradeRoute: (id: string) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onDeleteTerrain: (id: string) => void;
  onDeletePlacement: (id: string) => void;
  /** Plan 25 — drawn roads and paths. */
  onUpdateRoute: (id: string, updated: Partial<MapRoute>) => void;
  onDeleteRoute: (id: string) => void;
  onToggleRouteVisibility?: (id: string) => void;
  onToggleRouteLock?: (id: string) => void;
  /** Plan 21 — per-object layer controls. */
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  npcs: NPCDossier[];
  factions: Faction[];
  locations: WorldLocation[];
  /** Plan 24: the ontology categories, including author-created ones. */
  placeCategories: CustomPlaceCategory[];
  /** Plan 24: used to show which terrain realizes a non-point place. */
  terrainFeatures: MapTerrainFeature[];
  /** Plan 25: used to label and re-snap route endpoints. */
  placements: MapEntityPlacement[];
  onStationNpc: (npcId: string, locationId: string) => void;
  isPersian: boolean;
}

const TRADE_STATUSES: TradeRouteStatus[] = ['active', 'raided', 'blockaded', 'seasonal', 'secret'];

const STATUS_LABELS: Record<TradeRouteStatus, { en: string; fa: string; color: string }> = {
  active: { en: 'Active Flow', fa: 'فعال و روان', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  raided: { en: 'Raided / In Peril', fa: 'غارت‌شده و ناامن', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  blockaded: { en: 'Blockaded / Severed', fa: 'مسدود و محاصره', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  seasonal: { en: 'Seasonal Pass', fa: 'گذرگاه فصلی', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  secret: { en: 'Secret Smuggling Corridor', fa: 'مسیر مخفی قاچاق', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
};



export const CartographerInspector: React.FC<CartographerInspectorProps> = ({
  selectedItem,
  onClose,
  onUpdateLocation,
  onDeleteLocation,
  onUpdateTradeRoute,
  onDeleteTradeRoute,
  onUpdateTerrain,
  onDeleteTerrain,
  onDeletePlacement,
  onUpdateRoute,
  onDeleteRoute,
  onToggleRouteVisibility,
  onToggleRouteLock,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  npcs,
  factions,
  locations,
  placeCategories,
  terrainFeatures,
  placements,
  isPersian,
}) => {
  // The picker is keyed by location, not a bare boolean: switching selection
  // closes it automatically, so a candidate chosen for one place can never be
  // attributed to another.
  const [candidatePickerLocationId, setCandidatePickerLocationId] = useState<string | null>(null);
  const selectedLocationId =
    selectedItem?.type === 'location' ? selectedItem.data.id : null;
  const showTerrainCandidates =
    selectedLocationId !== null && candidatePickerLocationId === selectedLocationId;

  if (!selectedItem) return null;

  return (
    <aside className="absolute right-4 top-20 z-20 w-92 bg-zinc-950/92 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 select-none animate-fadeIn max-h-[calc(100vh-110px)] overflow-y-auto scrollbar-thin">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
          {selectedItem.type === 'location' && <Castle className="w-4 h-4 text-amber-400" />}
          {selectedItem.type === 'trade_route' && <Route className="w-4 h-4 text-orange-400" />}
          {selectedItem.type === 'route' && <Route className="w-4 h-4 text-amber-300" />}
          {selectedItem.type === 'terrain' && <Mountain className="w-4 h-4 text-emerald-400" />}
          {selectedItem.type === 'placement' && <MapPin className="w-4 h-4 text-purple-400" />}
          <span className="truncate">
            {selectedItem.type === 'location' && (isPersian ? 'مشخصات شهر / مکان' : 'Location Inspector')}
            {selectedItem.type === 'trade_route' && (isPersian ? 'شاهراه کاروان تجاری' : 'Caravan Route Inspector')}
            {selectedItem.type === 'route' && (isPersian ? 'جاده و گذرگاه نقشه' : 'Road & Path Inspector')}
            {selectedItem.type === 'terrain' && (isPersian ? 'عنصر فیزیکی جغرافیایی' : 'Terrain Feature Inspector')}
            {selectedItem.type === 'placement' && (isPersian ? 'نقطه سنجاق‌شده' : 'Pinned Entity')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ----------------- LOCATION INSPECTOR ----------------- */}
      {selectedItem.type === 'location' && (() => {
        const loc = selectedItem.data;
        const stationedNpcs = npcs.filter((n) => n.currentLocationId === loc.id);
        const currentCategoryId = loc.category || 'settlement';
        const categoryOptions = placeCategories.some((category) => category.id === currentCategoryId)
          ? placeCategories
          : [
              {
                id: currentCategoryId,
                name: currentCategoryId,
                description: '',
                color: '#a1a1aa',
              } as CustomPlaceCategory,
              ...placeCategories,
            ];
        const categoryMeta = resolvePlaceCategoryMeta(loc.category, placeCategories);
        const linkedFeatures = terrainFeatures.filter((feature) => feature.locationId === loc.id);
        const terrainCandidates = findTerrainCandidatesForPlace(
          loc,
          terrainFeatures,
          placeCategories
        );

        return (
          <div className="space-y-4 text-xs">
            {/* Name & Region */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'نام مکان' : 'Location Name'}
              </label>
              <input
                type="text"
                value={loc.name}
                onChange={(e) => onUpdateLocation(loc.id, { name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'اقلیم / منطقه' : 'Region'}
                </label>
                <input
                  type="text"
                  value={loc.region || ''}
                  onChange={(e) => onUpdateLocation(loc.id, { region: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سطح خطر (۱ تا ۵)' : 'Danger Level'}
                </label>
                <select
                  value={loc.dangerLevel}
                  onChange={(e) =>
                    onUpdateLocation(loc.id, {
                      dangerLevel: Number(e.target.value) as WorldLocation['dangerLevel'],
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} - {lvl === 1 ? (isPersian ? 'امن' : 'Safe') : lvl === 5 ? (isPersian ? 'مرگبار' : 'Deadly') : (isPersian ? 'متوسط' : 'Moderate')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'دسته‌بندی مکان' : 'Place Category'}
              </label>
              <select
                value={currentCategoryId}
                onChange={(e) => onUpdateLocation(loc.id, { category: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Plan 24: how this place is realized on the map */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'نمایش روی نقشه' : 'Drawn on the map as'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {categoryMeta.renderAs === 'settlement' ? (
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {isPersian ? 'سنجاق نقطه‌ای' : 'Point pin'}
                  </span>
                ) : linkedFeatures.length > 0 ? (
                  linkedFeatures.map((feature) => (
                    <span
                      key={feature.id}
                      className="inline-flex items-center gap-1 text-[10px] pl-2 pr-1 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    >
                      <span className="max-w-[150px] truncate">{feature.name}</span>
                      <button
                        onClick={() => {
                          onUpdateTerrain(feature.id, { locationId: undefined });
                          notify.info(
                            isPersian
                              ? 'اتصال عارضه از این مکان برداشته شد'
                              : 'Terrain link removed'
                          );
                        }}
                        title={isPersian ? 'برداشتن اتصال' : 'Unlink terrain'}
                        className="p-0.5 rounded-md text-emerald-400/70 hover:text-white hover:bg-emerald-500/20 transition-colors"
                      >
                        <Unlink className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    {isPersian ? 'هیچ عارضه‌ای متصل نیست' : 'No linked terrain yet'}
                  </span>
                )}
              </div>

              {categoryMeta.renderAs !== 'settlement' && (
                <div className="mt-2 space-y-1.5">
                  <button
                    onClick={() =>
                      setCandidatePickerLocationId((current) =>
                        current === loc.id ? null : loc.id
                      )
                    }
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                      showTerrainCandidates
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-amber-500/35 hover:text-amber-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      {isPersian ? 'اتصال یک عارضه موجود' : 'Link existing terrain'}
                    </span>
                    {terrainCandidates.length > 0 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-950/60 border border-zinc-800">
                        {terrainCandidates.length}
                      </span>
                    )}
                  </button>

                  {showTerrainCandidates && (
                    <div className="space-y-1 p-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 max-h-52 overflow-y-auto scrollbar-thin">
                      {terrainCandidates.length === 0 ? (
                        <p className="px-1.5 py-1 text-[10px] leading-relaxed text-zinc-500">
                          {isPersian
                            ? 'عارضه بدون اتصال و سازگاری پیدا نشد. یک عارضه از نوع مناسب برای این مکان رسم کنید.'
                            : 'No unlinked compatible terrain. Draw the appropriate feature for this place first.'}
                        </p>
                      ) : (
                        terrainCandidates.map((candidate) => {
                          const reason =
                            candidate.nameMatch === 'exact'
                              ? (isPersian ? 'نام یکسان' : 'Exact name')
                              : candidate.nameMatch === 'contains'
                              ? (isPersian ? 'نام مرتبط' : 'Related name')
                              : candidate.distance !== null
                              ? (isPersian ? 'نزدیک مکان' : 'Near the place pin')
                              : (isPersian ? 'هندسه سازگار' : 'Compatible geometry');
                          const distance =
                            candidate.distance !== null
                              ? ` · ${Math.round(candidate.distance)}u`
                              : '';

                          return (
                            <button
                              key={candidate.feature.id}
                              onClick={() => {
                                onUpdateTerrain(candidate.feature.id, { locationId: loc.id });
                                notify.success(
                                  isPersian
                                    ? `عارضه «${candidate.feature.name}» به این مکان متصل شد`
                                    : `"${candidate.feature.name}" linked to this place`
                                );
                                setCandidatePickerLocationId(null);
                              }}
                              className="w-full text-left p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-zinc-200 truncate">
                                  {candidate.feature.name}
                                </span>
                                <span className="text-[9px] uppercase tracking-wide text-emerald-400/80 font-mono shrink-0">
                                  {candidate.feature.type}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">
                                {reason}{distance}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Atmosphere Keywords */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'فضاسازی و لحن اتمسفر' : 'Atmosphere Keywords'}
              </label>
              <input
                type="text"
                value={loc.atmosphere || ''}
                onChange={(e) => onUpdateLocation(loc.id, { atmosphere: e.target.value })}
                placeholder={isPersian ? 'مه‌آلود، سنگ‌های مرطوب، بازار شلوغ ادویه' : 'Gloomy, spice bazaar, echoing bells'}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'شرح و پیشینه داستانی' : 'Lore Description'}
              </label>
              <textarea
                rows={3}
                value={loc.description}
                onChange={(e) => onUpdateLocation(loc.id, { description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
              />
            </div>

            {/* Coordinates & Elevation HUD */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-[11px]">
              <div>
                X: <span className="text-zinc-200">{loc.coordinates?.x ?? 0}</span>, Y:{' '}
                <span className="text-zinc-200">{loc.coordinates?.y ?? 0}</span>
              </div>
              <div>
                {isPersian ? 'ارتفاع' : 'Elevation'}: <span className="text-amber-400">{loc.elevation ?? 350}m</span>
              </div>
            </div>

            {/* Stationed NPCs List */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-zinc-300 font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  {isPersian ? 'شخصیت‌های مستقر در این مکان' : 'Stationed NPCs'}
                </span>
                <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-400">
                  {stationedNpcs.length}
                </span>
              </div>

              {stationedNpcs.length === 0 ? (
                <div className="p-3 bg-zinc-900/40 rounded-xl text-center text-zinc-500 text-[11px]">
                  {isPersian ? 'هیچ شخصیتی در این شهر مستقر نیست' : 'No NPCs stationed here'}
                </div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                  {stationedNpcs.map((n) => (
                    <div
                      key={n.id}
                      className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-zinc-200">{n.name}</span>
                        {n.role && <span className="text-zinc-400 text-[10px] ml-1.5">({n.role})</span>}
                      </div>
                      <span className="text-[10px] text-indigo-300 font-mono">
                        CR {n.statCalibration?.challengeRating ?? 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Danger action */}
            <div className="pt-2">
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'حذف مکان' : 'Delete Location',
                    message: isPersian
                      ? `آیا از حذف مکان "${loc.name}" از نقشه و انجیل جهان اطمینان دارید؟`
                      : `Are you sure you want to delete "${loc.name}"?`,
                  });
                  if (confirmed) {
                    onDeleteLocation(loc.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'حذف این مکان' : 'Delete Location'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ----------------- CARAVAN TRADE ROUTE INSPECTOR ----------------- */}
      {selectedItem.type === 'trade_route' && (() => {
        const route = selectedItem.data;
        const origin = locations.find((l) => l.id === route.originLocationId);
        const destination = locations.find((l) => l.id === route.destinationLocationId);

        return (
          <div className="space-y-4 text-xs">
            {/* Route Name */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'نام شاهراه کاروان' : 'Caravan Route Name'}
              </label>
              <input
                type="text"
                value={route.name}
                onChange={(e) => onUpdateTradeRoute(route.id, { name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Terminus Endpoints */}
            <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs">
              <div className="truncate">
                <div className="text-[10px] text-zinc-500 font-medium uppercase">{isPersian ? 'مبدأ' : 'Origin'}</div>
                <div className="font-semibold text-zinc-200 truncate mt-0.5">
                  {origin ? origin.name : (isPersian ? 'نامشخص' : 'Unknown')}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mx-2" />
              <div className="truncate text-right">
                <div className="text-[10px] text-zinc-500 font-medium uppercase">{isPersian ? 'مقصد' : 'Destination'}</div>
                <div className="font-semibold text-zinc-200 truncate mt-0.5">
                  {destination ? destination.name : (isPersian ? 'نامشخص' : 'Unknown')}
                </div>
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'وضعیت عبور و امنیت کاروان' : 'Route Status'}
              </label>
              <select
                value={route.status || 'active'}
                onChange={(e) =>
                  onUpdateTradeRoute(route.id, { status: e.target.value as TradeRouteStatus })
                }
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {TRADE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {isPersian ? STATUS_LABELS[st].fa : STATUS_LABELS[st].en}
                  </option>
                ))}
              </select>
            </div>

            {/* Danger Level & Smuggling DC */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سطح خطر مسیر' : 'Danger Level'}
                </label>
                <select
                  value={route.dangerLevel ?? 2}
                  onChange={(e) =>
                  onUpdateTradeRoute(route.id, {
                    dangerLevel: Number(e.target.value) as WorldTradeRoute['dangerLevel'],
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl} - {lvl <= 2 ? (isPersian ? 'کم‌خطر' : 'Low') : (isPersian ? 'راهزنان / هیولا' : 'Hazardous')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سختی گشت/قاچاق (DC)' : 'Smuggle DC'}
                </label>
                <input
                  type="number"
                  min={8}
                  max={25}
                  value={route.smugglingRiskDC ?? 12}
                  onChange={(e) => onUpdateTradeRoute(route.id, { smugglingRiskDC: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Controlling Faction */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'جناح مسلط و محافظ شاهراه' : 'Controlling Faction'}
              </label>
              <select
                value={route.controllingFactionId || ''}
                onChange={(e) => onUpdateTradeRoute(route.id, { controllingFactionId: e.target.value || undefined })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="">{isPersian ? 'بدون تسلط مستقیم (بی‌طرف)' : 'None (Neutral corridor)'}</option>
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'شرح و روایات مسیر' : 'Lore & Description'}
              </label>
              <textarea
                rows={3}
                value={route.description || ''}
                onChange={(e) => onUpdateTradeRoute(route.id, { description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                placeholder={isPersian ? 'کاروان‌های ابریشم و ادویه در امتداد گردنه کوهستان...' : 'Silk caravans moving along mountain passes...'}
              />
            </div>

            {/* Waypoints Counter */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between text-zinc-400 text-xs">
              <span>{isPersian ? 'ایستگاه‌های میانی کاروان' : 'Intermediate Waypoints'}:</span>
              <span className="font-mono text-amber-400 font-semibold">
                {route.waypoints?.length ?? 0} {isPersian ? 'نقطه' : 'pts'}
              </span>
            </div>

            {/* Delete button */}
            <div className="pt-2">
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'حذف مسیر تجاری' : 'Delete Trade Route',
                    message: isPersian
                      ? `آیا از حذف مسیر "${route.name}" اطمینان دارید؟`
                      : `Are you sure you want to delete trade route "${route.name}"?`,
                  });
                  if (confirmed) {
                    onDeleteTradeRoute(route.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'حذف این شاهراه' : 'Delete Route'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ----------------- DRAWN ROAD / PATH INSPECTOR (Plan 25) ----------------- */}
      {selectedItem.type === 'route' && (() => {
        const route = selectedItem.data;
        const source = { locations, terrainFeatures, placements, placeCategories };
        const originLabel = route.origin.label ||
          endpointLabelForRef(
            route.origin.ref,
            source,
            route.origin.ref
              ? isPersian ? 'هدف یافت نشد' : 'Missing target'
              : isPersian ? 'انتهای آزاد' : 'Free end'
          );
        const destinationLabel = route.destination.label ||
          endpointLabelForRef(
            route.destination.ref,
            source,
            route.destination.ref
              ? isPersian ? 'هدف یافت نشد' : 'Missing target'
              : isPersian ? 'انتهای آزاد' : 'Free end'
          );
        const originDangling = resolveRouteEndpointPoint(route.origin, source).dangling;
        const destinationDangling = resolveRouteEndpointPoint(route.destination, source).dangling;

        const updateEndpoint = (which: 'origin' | 'destination') => {
          const endpoint = route[which];
          const point = resolveRouteEndpointPoint(endpoint, source).point;
          const snap = snapRouteEndpoint(point, source);
          if (!snap) {
            notify.info(isPersian ? 'عنصر نزدیکی برای اتصال یافت نشد' : 'No nearby element to snap to');
            return;
          }
          onUpdateRoute(
            route.id,
            which === 'origin' ? { origin: snap.endpoint } : { destination: snap.endpoint }
          );
        };

        const detachEndpoint = (which: 'origin' | 'destination') => {
          const endpoint = route[which];
          const point = resolveRouteEndpointPoint(endpoint, source).point;
          onUpdateRoute(
            route.id,
            which === 'origin'
              ? { origin: { ...endpoint, ref: undefined, anchor: undefined, fallback: point } }
              : { destination: { ...endpoint, ref: undefined, anchor: undefined, fallback: point } }
          );
        };

        return (
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'نام جاده' : 'Road Name'}
              </label>
              <input
                type="text"
                value={route.name}
                onChange={(e) => onUpdateRoute(route.id, { name: e.target.value })}
                onBlur={(e) => {
                  if (!e.target.value.trim()) {
                    onUpdateRoute(route.id, { name: routeKindLabel(route.kind, isPersian) });
                  }
                }}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Endpoints with re-snap / detach controls */}
            <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-2">
              {(['origin', 'destination'] as const).map((which) => {
                const endpoint = route[which];
                const dangling = which === 'origin' ? originDangling : destinationDangling;
                const label = which === 'origin' ? originLabel : destinationLabel;
                return (
                  <div key={which} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] text-zinc-500 font-medium uppercase">
                        {which === 'origin'
                          ? isPersian ? 'مبدأ' : 'Origin'
                          : isPersian ? 'مقصد' : 'Destination'}
                      </div>
                      <div className={`font-semibold truncate mt-0.5 ${dangling ? 'text-rose-300' : 'text-zinc-200'}`}>
                        {label}
                        {dangling && (
                          <span className="ml-1 text-[10px] text-rose-400">
                            {isPersian ? '(قطع‌شده)' : '(detached)'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateEndpoint(which)}
                        className="p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                        title={isPersian ? 'اتصال مجدد به نزدیک‌ترین عنصر' : 'Re-snap to nearest element'}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => detachEndpoint(which)}
                        disabled={!endpoint.ref}
                        className="p-1 rounded-md text-zinc-500 hover:text-rose-300 hover:bg-zinc-800 transition-colors disabled:opacity-30"
                        title={isPersian ? 'آزاد کردن انتها' : 'Detach this end'}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-zinc-500">
                {isPersian
                  ? 'انتهای متصل با جابجایی عنصر هدف همراه می‌شود.'
                  : 'Attached ends follow their target when it moves.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'نوع راه' : 'Road Type'}
                </label>
                <select
                  value={route.kind}
                  onChange={(e) => {
                    const kind = e.target.value as MapRouteKind;
                    const meta = MAP_ROUTE_KIND_META[kind];
                    onUpdateRoute(route.id, {
                      kind,
                      difficulty: meta.defaultDifficulty,
                      lineStyle: meta.lineStyle,
                      width: meta.width,
                      travelMultiplier: meta.travelMultiplier,
                    });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {(Object.keys(MAP_ROUTE_KIND_META) as MapRouteKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {routeKindLabel(kind, isPersian)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سختی مسیر' : 'Difficulty'}
                </label>
                <select
                  value={route.difficulty}
                  onChange={(e) =>
                    onUpdateRoute(route.id, {
                      difficulty: Number(e.target.value) as MapRouteDifficulty,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {([1, 2, 3, 4, 5] as MapRouteDifficulty[]).map((level) => (
                    <option key={level} value={level}>
                      {level} - {isPersian ? MAP_ROUTE_DIFFICULTY_LABELS[level].fa : MAP_ROUTE_DIFFICULTY_LABELS[level].en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سبک خط' : 'Line Style'}
                </label>
                <select
                  value={route.lineStyle ?? MAP_ROUTE_KIND_META[route.kind].lineStyle}
                  onChange={(e) =>
                    onUpdateRoute(route.id, { lineStyle: e.target.value as MapRouteLineStyle })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  <option value="solid">{isPersian ? 'یکدست' : 'Solid'}</option>
                  <option value="dashed">{isPersian ? 'خط‌چین' : 'Dashed'}</option>
                  <option value="dotted">{isPersian ? 'نقطه‌چین' : 'Dotted'}</option>
                  <option value="double">{isPersian ? 'دوطرفه / دوبل' : 'Double'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'ضخامت' : 'Width'}
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={route.width ?? MAP_ROUTE_KIND_META[route.kind].width}
                  onChange={(e) =>
                    onUpdateRoute(route.id, {
                      width:
                        e.target.value === ''
                          ? undefined
                          : Math.max(0.5, Number(e.target.value)),
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'ضریب سفر' : 'Travel Multiplier'}
                </label>
                <input
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={route.travelMultiplier ?? MAP_ROUTE_KIND_META[route.kind].travelMultiplier}
                  onChange={(e) =>
                    onUpdateRoute(route.id, {
                      travelMultiplier:
                        e.target.value === ''
                          ? undefined
                          : Math.max(0.1, Number(e.target.value)),
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'سختی عبور (DC)' : 'Travel Check DC'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={route.checkDC ?? ''}
                  placeholder={isPersian ? 'اختیاری' : 'Optional'}
                  onChange={(e) =>
                    onUpdateRoute(route.id, {
                      checkDC: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'خطای جانبی (برای مسیرهای موازی)' : 'Lane Offset (parallel routes)'}
              </label>
              <input
                type="number"
                min={-40}
                max={40}
                step={1}
                value={route.offset ?? 0}
                onChange={(e) => onUpdateRoute(route.id, { offset: Number(e.target.value) })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'شرح و روایت مسیر' : 'Lore & Description'}
              </label>
              <textarea
                rows={3}
                value={route.description || ''}
                onChange={(e) => onUpdateRoute(route.id, { description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                placeholder={isPersian ? 'کاروان‌ها و مسافران از این گردنه می‌گذرند...' : 'Travellers cross this pass in summer...'}
              />
            </div>

            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex items-center justify-between text-zinc-400 text-xs">
              <span>{isPersian ? 'نقاط میانی ترسیم‌شده' : 'Drawn path vertices'}:</span>
              <span className="font-mono text-amber-400 font-semibold">
                {(route.path ?? []).length} {isPersian ? 'نقطه' : 'pts'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleRouteVisibility?.(route.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 transition-all"
              >
                {route.visible !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>
                  {route.visible !== false
                    ? isPersian ? 'پنهان‌سازی' : 'Hide'
                    : isPersian ? 'نمایش' : 'Show'}
                </span>
              </button>
              <button
                onClick={() => onToggleRouteLock?.(route.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 transition-all"
              >
                {route.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>
                  {route.locked
                    ? isPersian ? 'بازکردن قفل' : 'Unlock'
                    : isPersian ? 'قفل' : 'Lock'}
                </span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'حذف جاده' : 'Delete Road',
                    message: isPersian
                      ? `آیا از حذف جاده "${route.name}" اطمینان دارید؟`
                      : `Are you sure you want to delete "${route.name}"?`,
                  });
                  if (confirmed) {
                    onDeleteRoute(route.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'حذف این جاده' : 'Delete Road'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ----------------- TERRAIN FEATURE INSPECTOR ----------------- */}
      {selectedItem.type === 'terrain' && (() => {
        const feature = selectedItem.data;
        const compatibleLocations = locations.filter((location) =>
          placeAcceptsTerrainType(location, feature.type, placeCategories)
        );
        const compatibleIds = new Set(compatibleLocations.map((location) => location.id));
        const otherLocations = locations.filter((location) => !compatibleIds.has(location.id));
        const linkedLocation = feature.locationId
          ? locations.find((location) => location.id === feature.locationId)
          : undefined;
        const linkedToMissingPlace = Boolean(feature.locationId && !linkedLocation);
        const linkedToIncompatiblePlace = Boolean(linkedLocation && !compatibleIds.has(linkedLocation.id));
        const isMountain =
          feature.type === 'mountain_range' ||
          feature.type === 'peak' ||
          feature.type === 'volcano';
        const isElevationLinked = isMountain ? feature.syncElevationScale !== false : false;

        return (
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'نام عارضه طبیعی' : 'Feature Name'}
              </label>
              <input
                type="text"
                value={feature.name}
                onChange={(e) => onUpdateTerrain(feature.id, { name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Plan 21: per-object layer controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleTerrainVisibility?.(feature.id)}
                title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                  feature.visible === false
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {feature.visible === false ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{isPersian ? 'نمایش' : 'Visible'}</span>
              </button>
              <button
                onClick={() => onToggleTerrainLock?.(feature.id)}
                title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                  feature.locked
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                }`}
              >
                {feature.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{isPersian ? 'قفل' : 'Lock'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'نوع عارضه' : 'Terrain Type'}
                </label>
                <input
                  type="text"
                  disabled
                  value={feature.type}
                  className="w-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 rounded-xl px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-zinc-400 font-medium">
                    {isPersian ? 'ارتفاع نسبی' : 'Elevation (m)'}
                  </label>
                  {isMountain && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTerrain(feature.id, {
                          syncElevationScale: !isElevationLinked,
                        })
                      }
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                        isElevationLinked
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                          : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                      title={
                        isPersian
                          ? isElevationLinked
                            ? 'رابطه مستقیم ارتفاع و اندازه به پیکسل برقرار است (۱ پیکسل = ۵۰ متر). برای قطع ارتباط و تنظیم مقدار دقیق و دلخواه کلیک کنید.'
                            : 'ارتباط مستقیم قطع است (امکان تنظیم مقدار دقیق و دلخواه). برای اتصال مجدد کلیک کنید.'
                          : isElevationLinked
                          ? 'Elevation is directly linked to peak scale (1px = 50m). Click to unlink for custom values.'
                          : 'Unlinked. Click to link directly with peak scale.'
                      }
                    >
                      {isElevationLinked ? (
                        <>
                          <Link2 className="w-2.5 h-2.5 text-amber-400" />
                          <span>{isPersian ? 'متصل به پیکسل' : 'Linked'}</span>
                        </>
                      ) : (
                        <>
                          <Unlink className="w-2.5 h-2.5 text-zinc-400" />
                          <span>{isPersian ? 'دلخواه' : 'Custom'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={
                    feature.elevation ??
                    (isMountain
                      ? feature.scale
                        ? Math.round(feature.scale * 50)
                        : 2000
                      : 0)
                  }
                  onChange={(e) => {
                    const elev = Number(e.target.value);
                    if (isMountain && isElevationLinked) {
                      const newScale = Math.max(14, Math.min(100, Math.round(elev / 50)));
                      onUpdateTerrain(feature.id, {
                        elevation: elev,
                        scale: newScale,
                        width: Math.round(newScale * 0.58),
                      });
                    } else {
                      onUpdateTerrain(feature.id, { elevation: elev });
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Plan 24: the semantic place this geometry realizes */}
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'مکان روایی متصل' : 'Narrative Place'}
              </label>
              <select
                value={feature.locationId || ''}
                onChange={(e) =>
                  onUpdateTerrain(feature.id, { locationId: e.target.value || undefined })
                }
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="">{isPersian ? 'بدون مکان روایی' : 'No narrative place'}</option>
                {linkedToMissingPlace && (
                  <option value={feature.locationId}>
                    {feature.locationId} ({isPersian ? 'ناموجود' : 'missing'})
                  </option>
                )}
                {compatibleLocations.length > 0 && (
                  <optgroup label={isPersian ? 'مکان‌های سازگار' : 'Compatible places'}>
                    {compatibleLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherLocations.length > 0 && (
                  <optgroup label={isPersian ? 'سایر مکان‌ها' : 'Other places'}>
                    {otherLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                {compatibleLocations.length > 0
                  ? isPersian
                    ? `${compatibleLocations.length} مکان سازگار با هندسه ${feature.type} در ابتدا فهرست شده است.`
                    : `${compatibleLocations.length} place(s) compatible with ${feature.type} geometry are listed first.`
                  : isPersian
                  ? `هیچ مکانی با هندسه ${feature.type} سازگار نیست.`
                  : `No place currently accepts ${feature.type} geometry.`}
              </p>
              {linkedToIncompatiblePlace && (
                <p className="mt-1 text-[10px] leading-relaxed text-amber-300/90">
                  {isPersian
                    ? 'مکان متصل از دسته‌ای است که معمولاً با این نوع هندسه ترسیم نمی‌شود.'
                    : 'The linked place belongs to a category that normally does not use this geometry.'}
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'اقلیم آب‌وهوایی' : 'Climate Zone'}
              </label>
              <select
                value={feature.climateZone || 'temperate'}
                onChange={(e) =>
                  onUpdateTerrain(feature.id, {
                    climateZone: e.target.value as MapTerrainFeature['climateZone'],
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="temperate">{isPersian ? 'معتدل' : 'Temperate'}</option>
                <option value="arid">{isPersian ? 'خشک و کویری' : 'Arid / Desert'}</option>
                <option value="polar">{isPersian ? 'قطبی و یخبندان' : 'Polar / Glacial'}</option>
                <option value="tropical">{isPersian ? 'حاره‌ای و استوایی' : 'Tropical'}</option>
                <option value="mystical">{isPersian ? 'جادویی / اثیری' : 'Mystical'}</option>
              </select>
            </div>

            {/* Width / Scale control for mountain ranges, rivers, valleys, and highlands */}
            {(feature.type === 'mountain_range' ||
              feature.type === 'river' ||
              feature.type === 'valley' ||
              feature.type === 'highland' ||
              feature.type === 'plateau') && (
              <div>
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {feature.type === 'mountain_range'
                    ? (isPersian ? 'اندازه قله‌ها (مقیاس رشته‌کوه)' : 'Peak Scale & Range Width')
                    : feature.type === 'river'
                    ? (isPersian ? 'پهنای دهانه رودخانه' : 'River Mouth Width')
                    : feature.type === 'highland' || feature.type === 'plateau'
                    ? (isPersian ? 'ارتفاع دیواره صخره‌ای' : 'Cliff Drop Height')
                    : (isPersian ? 'عرض دره' : 'Valley Width')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={
                      feature.type === 'river'
                        ? 4
                        : feature.type === 'mountain_range'
                        ? 14
                        : feature.type === 'highland' || feature.type === 'plateau'
                        ? 16
                        : 10
                    }
                    max={
                      feature.type === 'river'
                        ? 28
                        : feature.type === 'mountain_range'
                        ? 85
                        : feature.type === 'highland' || feature.type === 'plateau'
                        ? 90
                        : 75
                    }
                    step={feature.type === 'mountain_range' ? 2 : 1}
                    value={
                      feature.type === 'mountain_range'
                        ? feature.scale || (feature.width ? Math.round(feature.width / 0.58) : 55)
                        : feature.width ||
                          (feature.type === 'river'
                            ? 10
                            : feature.type === 'highland' || feature.type === 'plateau'
                            ? 36
                            : 28)
                    }
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (feature.type === 'mountain_range') {
                        if (isElevationLinked) {
                          onUpdateTerrain(feature.id, {
                            scale: val,
                            width: Math.round(val * 0.58),
                            elevation: Math.round(val * 50),
                          });
                        } else {
                          onUpdateTerrain(feature.id, {
                            scale: val,
                            width: Math.round(val * 0.58),
                          });
                        }
                      } else {
                        onUpdateTerrain(feature.id, { width: val });
                      }
                    }}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-mono text-zinc-300 w-auto min-w-[50px] justify-end">
                    <span>
                      {feature.type === 'mountain_range'
                        ? `${feature.scale || (feature.width ? Math.round(feature.width / 0.58) : 55)}px`
                        : `${
                            feature.width ||
                            (feature.type === 'river'
                              ? 10
                              : feature.type === 'highland' || feature.type === 'plateau'
                              ? 36
                              : 28)
                          }px`}
                    </span>
                    {feature.type === 'mountain_range' && isElevationLinked && (
                      <span className="text-[10px] text-zinc-500">
                        ({Math.round((feature.scale || 55) * 50)}m)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mountain Range Summit Snowcaps Toggle */}
            {feature.type === 'mountain_range' && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-medium text-zinc-300">
                    {isPersian ? 'کلاهک‌های برفی قله‌ها' : 'Summit Snowcaps'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTerrain(feature.id, {
                      hasSnowcaps: feature.hasSnowcaps !== undefined ? !feature.hasSnowcaps : false,
                    })
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                    feature.hasSnowcaps !== false
                      ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {feature.hasSnowcaps !== false
                    ? isPersian
                      ? 'فعال'
                      : 'Enabled'
                    : isPersian
                    ? 'غیرفعال'
                    : 'Disabled'}
                </button>
              </div>
            )}

            {/* River Delta Distributaries (Plan 27 — Module 1) */}
            {feature.type === 'river' && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {isPersian ? 'دلتا و شاخه‌های مصب' : 'Delta Distributary Fan'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const enabled = !feature.deltaConfig?.enabled;
                      onUpdateTerrain(feature.id, {
                        deltaConfig: {
                          ...feature.deltaConfig,
                          enabled,
                          distributariesCount: feature.deltaConfig?.distributariesCount ?? 4,
                          spreadAngleDegrees: feature.deltaConfig?.spreadAngleDegrees ?? 48,
                          apexFraction: feature.deltaConfig?.apexFraction ?? 0.8,
                        },
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      feature.deltaConfig?.enabled
                        ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {feature.deltaConfig?.enabled
                      ? isPersian
                        ? 'فعال'
                        : 'Enabled'
                      : isPersian
                      ? 'غیرفعال'
                      : 'Disabled'}
                  </button>
                </div>

                {feature.deltaConfig?.enabled && (
                  <div className="space-y-2.5 pt-1 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'تعداد شاخه‌های مصب' : 'Distributary Branches'}</span>
                        <span className="font-mono text-cyan-300">
                          {feature.deltaConfig.distributariesCount ?? 4}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={6}
                        step={1}
                        value={feature.deltaConfig.distributariesCount ?? 4}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            deltaConfig: {
                              ...feature.deltaConfig,
                              distributariesCount: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'زاویه گستردگی فن' : 'Fan Spread Angle'}</span>
                        <span className="font-mono text-cyan-300">
                          {feature.deltaConfig.spreadAngleDegrees ?? 48}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={75}
                        step={5}
                        value={feature.deltaConfig.spreadAngleDegrees ?? 48}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            deltaConfig: {
                              ...feature.deltaConfig,
                              spreadAngleDegrees: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </div>

                    {/* Lush Delta Canopy Groves Toggle */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">
                        {isPersian ? 'پوشش گیاهی و بیشه‌های دلتا' : 'Delta Canopy Groves'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTerrain(feature.id, {
                            deltaConfig: {
                              ...feature.deltaConfig,
                              showVegetation: !(feature.deltaConfig?.showVegetation ?? true),
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                          (feature.deltaConfig?.showVegetation ?? true)
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50'
                        }`}
                      >
                        {(feature.deltaConfig?.showVegetation ?? true)
                          ? isPersian
                            ? 'روشن'
                            : 'ENABLED'
                          : isPersian
                          ? 'خاموش'
                          : 'DISABLED'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sinuous Barchan Dune Field (Plan 27 — Module 3.B: Hiram Steppe) */}
            {(feature.type === 'desert' || feature.type === 'wasteland') && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {isPersian ? 'تپه‌های ماسه‌ای برخان' : 'Barchan Dune Field'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEnabled = feature.duneConfig?.enabled ?? true;
                      onUpdateTerrain(feature.id, {
                        duneConfig: {
                          ...feature.duneConfig,
                          enabled: !currentEnabled,
                          density: feature.duneConfig?.density ?? 'medium',
                          windAngleDegrees: feature.duneConfig?.windAngleDegrees ?? 35,
                          duneScale: feature.duneConfig?.duneScale ?? 1.0,
                          rippleHatching: feature.duneConfig?.rippleHatching ?? true,
                        },
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      (feature.duneConfig?.enabled ?? true)
                        ? 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {(feature.duneConfig?.enabled ?? true)
                      ? isPersian
                        ? 'فعال'
                        : 'Enabled'
                      : isPersian
                      ? 'غیرفعال'
                      : 'Disabled'}
                  </button>
                </div>

                {(feature.duneConfig?.enabled ?? true) && (
                  <div className="space-y-2.5 pt-1 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'تراکم تپه‌ها' : 'Dune Density'}</span>
                        <span className="font-mono text-amber-300 capitalize">
                          {feature.duneConfig?.density ?? 'medium'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['sparse', 'medium', 'dense'] as const).map((density) => (
                          <button
                            key={density}
                            type="button"
                            onClick={() =>
                              onUpdateTerrain(feature.id, {
                                duneConfig: {
                                  ...feature.duneConfig,
                                  density,
                                },
                              })
                            }
                            className={`py-1 rounded text-[10px] font-medium transition-all border ${
                              (feature.duneConfig?.density ?? 'medium') === density
                                ? 'bg-amber-900/60 border-amber-500/80 text-amber-200'
                                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {density === 'sparse'
                              ? isPersian
                                ? 'تنک'
                                : 'Sparse'
                              : density === 'medium'
                              ? isPersian
                                ? 'متوسط'
                                : 'Medium'
                              : isPersian
                              ? 'متراکم'
                              : 'Dense'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'جهت وزش باد غالب' : 'Prevailing Wind Heading'}</span>
                        <span className="font-mono text-amber-300">
                          {feature.duneConfig?.windAngleDegrees ?? 35}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={5}
                        value={feature.duneConfig?.windAngleDegrees ?? 35}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            duneConfig: {
                              ...feature.duneConfig,
                              windAngleDegrees: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'مقیاس برخان‌ها' : 'Dune Scale'}</span>
                        <span className="font-mono text-amber-300">
                          {(feature.duneConfig?.duneScale ?? 1.0).toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={1.8}
                        step={0.1}
                        value={feature.duneConfig?.duneScale ?? 1.0}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            duneConfig: {
                              ...feature.duneConfig,
                              duneScale: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400">
                        {isPersian ? 'موج‌های موازی شیب بادگیر' : 'Windward Ripple Striae'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTerrain(feature.id, {
                            duneConfig: {
                              ...feature.duneConfig,
                              rippleHatching: !(feature.duneConfig?.rippleHatching ?? true),
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                          (feature.duneConfig?.rippleHatching ?? true)
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {(feature.duneConfig?.rippleHatching ?? true)
                          ? isPersian
                            ? 'فعال'
                            : 'On'
                          : isPersian
                          ? 'غیرفعال'
                          : 'Off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Coastal & Shoreline Waterlining (Plan 27 — Module 2) */}
            {(feature.type === 'continent' || feature.type === 'island' || feature.type === 'lake') && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {isPersian ? 'موج‌های متحدالمرکز ساحل' : 'Shoreline Waterlining'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEnabled = feature.waterliningConfig?.enabled ?? true;
                      onUpdateTerrain(feature.id, {
                        waterliningConfig: {
                          ...feature.waterliningConfig,
                          enabled: !currentEnabled,
                          ringCount: feature.waterliningConfig?.ringCount ?? 4,
                          baseDistance: feature.waterliningConfig?.baseDistance ?? 4,
                          distanceStep: feature.waterliningConfig?.distanceStep ?? 5,
                          stippledOuter: feature.waterliningConfig?.stippledOuter ?? true,
                        },
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      (feature.waterliningConfig?.enabled ?? true)
                        ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {(feature.waterliningConfig?.enabled ?? true)
                      ? isPersian
                        ? 'فعال'
                        : 'Enabled'
                      : isPersian
                      ? 'غیرفعال'
                      : 'Disabled'}
                  </button>
                </div>

                {(feature.waterliningConfig?.enabled ?? true) && (
                  <div className="space-y-2.5 pt-1 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'تعداد حلقه‌های موج' : 'Wave Echo Rings'}</span>
                        <span className="font-mono text-sky-300">
                          {feature.waterliningConfig?.ringCount ?? 4}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={6}
                        step={1}
                        value={feature.waterliningConfig?.ringCount ?? 4}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            waterliningConfig: {
                              ...feature.waterliningConfig,
                              ringCount: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'فاصله نخستین موج' : 'First Ring Distance'}</span>
                        <span className="font-mono text-sky-300">
                          {feature.waterliningConfig?.baseDistance ?? 4}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={8}
                        step={0.5}
                        value={feature.waterliningConfig?.baseDistance ?? 4}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            waterliningConfig: {
                              ...feature.waterliningConfig,
                              baseDistance: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'فاصله میان موج‌ها' : 'Ring Distance Step'}</span>
                        <span className="font-mono text-sky-300">
                          {feature.waterliningConfig?.distanceStep ?? 5}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={3}
                        max={10}
                        step={0.5}
                        value={feature.waterliningConfig?.distanceStep ?? 5}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            waterliningConfig: {
                              ...feature.waterliningConfig,
                              distanceStep: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400">
                        {isPersian ? 'تاج‌های مقطع موج بیرونی' : 'Broken Outer Crests'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTerrain(feature.id, {
                            waterliningConfig: {
                              ...feature.waterliningConfig,
                              stippledOuter: !(feature.waterliningConfig?.stippledOuter ?? true),
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                          (feature.waterliningConfig?.stippledOuter ?? true)
                            ? 'bg-sky-950/80 border-sky-500/60 text-sky-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {(feature.waterliningConfig?.stippledOuter ?? true)
                          ? isPersian
                            ? 'فعال'
                            : 'On'
                          : isPersian
                          ? 'غیرفعال'
                          : 'Off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Continuous Forest Canopy Massing (Plan 27 — Module 3.C: Jangal-e Shabnam) */}
            {(feature.type === 'forest' || feature.type === 'jungle') && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trees className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {isPersian ? 'توده‌های پیوسته تاج جنگل' : 'Forest Canopy Massing'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEnabled = feature.canopyConfig?.enabled ?? true;
                      onUpdateTerrain(feature.id, {
                        canopyConfig: {
                          ...feature.canopyConfig,
                          enabled: !currentEnabled,
                          density: feature.canopyConfig?.density ?? 'medium',
                          scallopScale: feature.canopyConfig?.scallopScale ?? 1.0,
                          hatchShading: feature.canopyConfig?.hatchShading ?? true,
                          sentinelTrees: feature.canopyConfig?.sentinelTrees ?? true,
                        },
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      (feature.canopyConfig?.enabled ?? true)
                        ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {(feature.canopyConfig?.enabled ?? true)
                      ? isPersian
                        ? 'فعال'
                        : 'Enabled'
                      : isPersian
                      ? 'غیرفعال'
                      : 'Disabled'}
                  </button>
                </div>

                {(feature.canopyConfig?.enabled ?? true) && (
                  <div className="space-y-2.5 pt-1 text-[11px]">
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'تراکم بیشه‌ها' : 'Grove Density'}</span>
                        <span className="font-mono text-emerald-300 capitalize">
                          {feature.canopyConfig?.density ?? 'medium'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['sparse', 'medium', 'dense'] as const).map((density) => (
                          <button
                            key={density}
                            type="button"
                            onClick={() =>
                              onUpdateTerrain(feature.id, {
                                canopyConfig: {
                                  ...feature.canopyConfig,
                                  density,
                                },
                              })
                            }
                            className={`py-1 rounded text-[10px] font-medium transition-all border ${
                              (feature.canopyConfig?.density ?? 'medium') === density
                                ? 'bg-emerald-900/60 border-emerald-500/80 text-emerald-200'
                                : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {density === 'sparse'
                              ? isPersian
                                ? 'تنک'
                                : 'Sparse'
                              : density === 'medium'
                              ? isPersian
                                ? 'متوسط'
                                : 'Medium'
                              : isPersian
                              ? 'متراکم'
                              : 'Dense'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span>{isPersian ? 'مقیاس چین‌خوردگی تاج' : 'Canopy Lobe Scale'}</span>
                        <span className="font-mono text-emerald-300">
                          {(feature.canopyConfig?.scallopScale ?? 1.0).toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={1.8}
                        step={0.1}
                        value={feature.canopyConfig?.scallopScale ?? 1.0}
                        onChange={(e) =>
                          onUpdateTerrain(feature.id, {
                            canopyConfig: {
                              ...feature.canopyConfig,
                              scallopScale: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400">
                        {isPersian ? 'هاشور سایه جنوب‌شرقی' : 'Southeast Shadow Hatching'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTerrain(feature.id, {
                            canopyConfig: {
                              ...feature.canopyConfig,
                              hatchShading: !(feature.canopyConfig?.hatchShading ?? true),
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                          (feature.canopyConfig?.hatchShading ?? true)
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {(feature.canopyConfig?.hatchShading ?? true)
                          ? isPersian
                            ? 'فعال'
                            : 'On'
                          : isPersian
                          ? 'غیرفعال'
                          : 'Off'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-zinc-400">
                        {isPersian ? 'درختان نگهبان حاشیه' : 'Edge Sentinel Trees'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTerrain(feature.id, {
                            canopyConfig: {
                              ...feature.canopyConfig,
                              sentinelTrees: !(feature.canopyConfig?.sentinelTrees ?? true),
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                          (feature.canopyConfig?.sentinelTrees ?? true)
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {(feature.canopyConfig?.sentinelTrees ?? true)
                          ? isPersian
                            ? 'فعال'
                            : 'On'
                          : isPersian
                          ? 'غیرفعال'
                          : 'Off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Curved & Spline-Aligned Typography (Plan 27 — Module 4) */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-200">
                    {isPersian ? 'عنوان منحنی خطی / جغرافیایی' : 'Curved Geographic Title'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentEnabled = feature.labelConfig?.enabled ?? false;
                    onUpdateTerrain(feature.id, {
                      labelConfig: {
                        ...feature.labelConfig,
                        enabled: !currentEnabled,
                        fontSize: feature.labelConfig?.fontSize ?? 15,
                        letterSpacing: feature.labelConfig?.letterSpacing ?? 5,
                        baselineOffset: feature.labelConfig?.baselineOffset ?? 0,
                        alignment: feature.labelConfig?.alignment ?? 'center',
                        uppercase: feature.labelConfig?.uppercase ?? true,
                      },
                    });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                    (feature.labelConfig?.enabled ?? false)
                      ? 'bg-purple-950/80 border-purple-400/60 text-purple-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {(feature.labelConfig?.enabled ?? false)
                    ? isPersian
                      ? 'فعال'
                      : 'Enabled'
                    : isPersian
                    ? 'غیرفعال'
                    : 'Disabled'}
                </button>
              </div>

              {(feature.labelConfig?.enabled ?? false) && (
                <div className="space-y-2.5 pt-1 text-[11px]">
                  <div>
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                      <span>{isPersian ? 'اندازه قلم' : 'Font Size'}</span>
                      <span className="font-mono text-purple-300">
                        {feature.labelConfig?.fontSize ?? 15}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={11}
                      max={26}
                      step={1}
                      value={feature.labelConfig?.fontSize ?? 15}
                      onChange={(e) =>
                        onUpdateTerrain(feature.id, {
                          labelConfig: {
                            ...feature.labelConfig,
                            fontSize: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                      <span>{isPersian ? 'فاصله حروف (Tracking)' : 'Letter Spacing'}</span>
                      <span className="font-mono text-purple-300">
                        {feature.labelConfig?.letterSpacing ?? 5}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={14}
                      step={1}
                      value={feature.labelConfig?.letterSpacing ?? 5}
                      onChange={(e) =>
                        onUpdateTerrain(feature.id, {
                          labelConfig: {
                            ...feature.labelConfig,
                            letterSpacing: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                      <span>{isPersian ? 'جابجایی از خط مبنا' : 'Baseline Offset'}</span>
                      <span className="font-mono text-purple-300">
                        {feature.labelConfig?.baselineOffset ?? 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-24}
                      max={24}
                      step={2}
                      value={feature.labelConfig?.baselineOffset ?? 0}
                      onChange={(e) =>
                        onUpdateTerrain(feature.id, {
                          labelConfig: {
                            ...feature.labelConfig,
                            baselineOffset: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-zinc-400">
                      {isPersian ? 'حروف بزرگ تاریخی' : 'Uppercase Manuscript'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTerrain(feature.id, {
                          labelConfig: {
                            ...feature.labelConfig,
                            uppercase: !(feature.labelConfig?.uppercase ?? true),
                          },
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                        (feature.labelConfig?.uppercase ?? true)
                          ? 'bg-purple-950/80 border-purple-500/60 text-purple-200'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {(feature.labelConfig?.uppercase ?? true)
                        ? isPersian
                          ? 'فعال'
                          : 'On'
                        : isPersian
                        ? 'غیرفعال'
                        : 'Off'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'توضیحات جغرافیایی' : 'Geographic Notes'}
              </label>
              <textarea
                rows={3}
                value={feature.description || ''}
                onChange={(e) => onUpdateTerrain(feature.id, { description: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'حذف عارضه طبیعی' : 'Delete terrain feature',
                    message: isPersian
                      ? `آیا از حذف "${feature.name}" اطمینان دارید؟`
                      : `Delete "${feature.name}" from the map?`,
                  });
                  if (confirmed) {
                    onDeleteTerrain(feature.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'حذف این عارضه طبیعی' : 'Delete Terrain'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ----------------- ENTITY PLACEMENT PIN INSPECTOR ----------------- */}
      {selectedItem.type === 'placement' && (() => {
        const pin = selectedItem.data;

        return (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-zinc-100 text-sm">{pin.customLabel || pin.entityId}</div>
                <div className="text-[11px] text-zinc-400 capitalize">{pin.entityType}</div>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
              <span>X: {pin.x}</span>
              <span>Y: {pin.y}</span>
            </div>

            {/* Plan 21: per-object layer controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTogglePlacementVisibility?.(pin.id)}
                title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                  pin.visible === false
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {pin.visible === false ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{isPersian ? 'نمایش' : 'Visible'}</span>
              </button>
              <button
                onClick={() => onTogglePlacementLock?.(pin.id)}
                title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
                  pin.locked
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                }`}
              >
                {pin.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{isPersian ? 'قفل' : 'Lock'}</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'برداشتن سنجاق' : 'Remove pin',
                    message: isPersian
                      ? 'آیا این سنجاق از نقشه برداشته شود؟'
                      : 'Remove this pin from the map?',
                  });
                  if (confirmed) {
                    onDeletePlacement(pin.id);
                    onClose();
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove Pin'}</span>
              </button>
            </div>
          </div>
        );
      })()}
    </aside>
  );
};
