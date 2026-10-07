'use client';

import React, { useState } from 'react';
import {
  Castle,
  Route,
  Mountain,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  X,
  Trash2,
  Edit2,
  ExternalLink,
  MapPin,
  Shield,
  Layers,
  ArrowRight,
  Plus,
  Compass,
  AlertTriangle,
  Package,
} from 'lucide-react';
import {
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  NPCDossier,
  TradeRouteStatus,
  TradeFlowDirection,
  Faction,
} from '@/lib/types';
import { notify } from '@/lib/notify';

export type SelectedMapItem =
  | { type: 'location'; data: WorldLocation }
  | { type: 'trade_route'; data: WorldTradeRoute }
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
  npcs: NPCDossier[];
  factions: Faction[];
  locations: WorldLocation[];
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

const SETTLEMENT_CATEGORIES = [
  { id: 'capital', en: 'Imperial Capital', fa: 'پایتخت سلطنتی / پایتخت کهن' },
  { id: 'stronghold', en: 'Fortress / Citadel', fa: 'دژ نظامی / بارو' },
  { id: 'trade_port', en: 'Harbor & Trade Port', fa: 'بندرگاه و مرکز مبادلات' },
  { id: 'sanctuary', en: 'Forest / Mountain Sanctuary', fa: 'پناهگاه امن / دیر خلوت‌نشینان' },
  { id: 'settlement', en: 'Frontier Town / Oasis', fa: 'شهر مرزی / واحه کویری' },
  { id: 'dungeon', en: 'Subterranean Deep / Dungeon', fa: 'سیاه‌چال / ژرفنای زیرزمینی' },
  { id: 'ruins', en: 'Ancient Sunken Ruins', fa: 'خرابه‌های باستانی فراموش‌شده' },
];

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
  npcs,
  factions,
  locations,
  onStationNpc,
  isPersian,
}) => {
  if (!selectedItem) return null;

  return (
    <aside className="absolute right-4 top-20 z-20 w-92 bg-zinc-950/92 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 select-none animate-fadeIn max-h-[calc(100vh-110px)] overflow-y-auto scrollbar-thin">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
          {selectedItem.type === 'location' && <Castle className="w-4 h-4 text-amber-400" />}
          {selectedItem.type === 'trade_route' && <Route className="w-4 h-4 text-orange-400" />}
          {selectedItem.type === 'terrain' && <Mountain className="w-4 h-4 text-emerald-400" />}
          {selectedItem.type === 'placement' && <MapPin className="w-4 h-4 text-purple-400" />}
          <span className="truncate">
            {selectedItem.type === 'location' && (isPersian ? 'مشخصات شهر / مکان' : 'Location Inspector')}
            {selectedItem.type === 'trade_route' && (isPersian ? 'شاهراه کاروان تجاری' : 'Caravan Route Inspector')}
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
                  onChange={(e) => onUpdateLocation(loc.id, { dangerLevel: Number(e.target.value) as any })}
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
                {isPersian ? 'دسته‌بندی سکونتگاه' : 'Settlement Category'}
              </label>
              <select
                value={loc.category || 'settlement'}
                onChange={(e) => onUpdateLocation(loc.id, { category: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                {SETTLEMENT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {isPersian ? cat.fa : cat.en}
                  </option>
                ))}
              </select>
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
        const controllingFaction = factions.find((f) => f.id === route.controllingFactionId);

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
                onChange={(e) => onUpdateTradeRoute(route.id, { status: e.target.value as any })}
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
                  onChange={(e) => onUpdateTradeRoute(route.id, { dangerLevel: Number(e.target.value) as any })}
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

      {/* ----------------- TERRAIN FEATURE INSPECTOR ----------------- */}
      {selectedItem.type === 'terrain' && (() => {
        const feature = selectedItem.data;

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
                <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                  {isPersian ? 'ارتفاع نسبی' : 'Elevation (m)'}
                </label>
                <input
                  type="number"
                  value={feature.elevation ?? 0}
                  onChange={(e) => onUpdateTerrain(feature.id, { elevation: Number(e.target.value) })}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'اقلیم آب‌وهوایی' : 'Climate Zone'}
              </label>
              <select
                value={feature.climateZone || 'temperate'}
                onChange={(e) => onUpdateTerrain(feature.id, { climateZone: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="temperate">{isPersian ? 'معتدل' : 'Temperate'}</option>
                <option value="arid">{isPersian ? 'خشک و کویری' : 'Arid / Desert'}</option>
                <option value="polar">{isPersian ? 'قطبی و یخبندان' : 'Polar / Glacial'}</option>
                <option value="tropical">{isPersian ? 'حاره‌ای و استوایی' : 'Tropical'}</option>
                <option value="mystical">{isPersian ? 'جادویی / اثیری' : 'Mystical'}</option>
              </select>
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
                onClick={() => {
                  onDeleteTerrain(feature.id);
                  onClose();
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

            <div className="pt-2">
              <button
                onClick={() => {
                  onDeletePlacement(pin.id);
                  onClose();
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
