'use client';

import React, { useState } from 'react';
import {
  User,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Link2,
  Unlink,
  Layers,
  Compass,
  Zap,
  ScrollText,
  AlertTriangle,
} from 'lucide-react';
import type {
  WorldLocation,
  MapTerrainFeature,
  NPCDossier,
  CustomPlaceCategory,
  StoryEncounter,
  WorldQuest,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { resolvePlaceCategoryMeta } from '@/lib/engines/world/placeCategories';
import { findTerrainCandidatesForPlace } from '@/lib/engines/world/terrainPlacePairing';

export interface LocationInspectorProps {
  loc: WorldLocation;
  npcs: NPCDossier[];
  encounters?: StoryEncounter[];
  quests?: WorldQuest[];
  placeCategories: CustomPlaceCategory[];
  terrainFeatures: MapTerrainFeature[];
  isPersian: boolean;
  onUpdateLocation: (id: string, updated: Partial<WorldLocation>) => void;
  onDeleteLocation: (id: string) => void;
  onToggleLocationVisibility?: (id: string) => void;
  onToggleLocationLock?: (id: string) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onClose: () => void;
}

export const LocationInspector: React.FC<LocationInspectorProps> = ({
  loc,
  npcs,
  encounters = [],
  quests = [],
  placeCategories,
  terrainFeatures,
  isPersian,
  onUpdateLocation,
  onDeleteLocation,
  onToggleLocationVisibility,
  onToggleLocationLock,
  onUpdateTerrain,
  onClose,
}) => {
  const [candidatePickerLocationId, setCandidatePickerLocationId] = useState<string | null>(null);
  const showTerrainCandidates = candidatePickerLocationId === loc.id;

  const stationedNpcs = npcs.filter((n) => n.currentLocationId === loc.id);
  const localEncounters = encounters.filter((e) => e.locationId === loc.id);
  const localQuests = quests.filter((q) => q.originLocationId === loc.id);
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

      {/* Per-object layer controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleLocationVisibility?.(loc.id)}
          title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            loc.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {loc.visible === false ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span>{isPersian ? 'نمایش' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleLocationLock?.(loc.id)}
          title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            loc.locked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
        >
          {loc.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'قفل' : 'Lock'}</span>
        </button>
        <button
          type="button"
          onClick={() => onUpdateLocation(loc.id, { isTransitHalt: !loc.isTransitHalt })}
          title={
            isPersian
              ? 'منزلگاه گذری: کاروان از آن رد می‌شود و نامش در گذر زمان می‌آید اما داستان را متوقف نمی‌کند'
              : 'Transit Halt: mentioned in travel montage without forcing a playable stop'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            loc.isTransitHalt
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
        >
          <span>{isPersian ? 'منزلگاه گذری' : 'Transit Halt'}</span>
        </button>
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
                          onUpdateTerrain(candidate.feature.id, { locationId: loc.id, name: loc.name });
                          notify.success(
                            isPersian
                              ? `عارضه «${loc.name}» به این مکان متصل شد`
                              : `"${loc.name}" linked to this place`
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
        <div dir="ltr">
          X: <span className="text-zinc-200">{loc.coordinates?.x ?? 0}</span>, Y:{' '}
          <span className="text-zinc-200">{loc.coordinates?.y ?? 0}</span>
        </div>
        <div dir="ltr">
          {isPersian ? 'ارتفاع' : 'Elevation'}: <span className="text-amber-400">{loc.elevation ?? 350}m</span>
        </div>
      </div>

      {/* Special Rules & Threat Clock */}
      {((loc.specialRules && loc.specialRules.length > 0) || loc.threatClockDefault) && (
        <div className="p-2.5 bg-amber-950/20 border border-amber-500/25 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {isPersian ? 'قوانین ویژه و تهدید مکان' : 'Special Rules & Threat Clock'}
            </span>
            {loc.threatClockDefault && (
              <span dir="ltr" className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200">
                Clock {loc.threatClockDefault.maxSegments}
              </span>
            )}
          </div>
          {loc.specialRules && loc.specialRules.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-zinc-300 leading-relaxed">
              {loc.specialRules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          )}
          {loc.threatClockDefault && (
            <div className="text-[10px] text-rose-300/90">
              {loc.threatClockDefault.name}: {loc.threatClockDefault.crisisDescription}
            </div>
          )}
        </div>
      )}

      {/* Sub-Zones (Tactical Quarters / POIs) */}
      {loc.subZones && loc.subZones.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-300 font-medium text-xs">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              {isPersian ? 'زیربخش‌ها و محله‌ها' : 'Sub-Zones'}
            </span>
            <span dir="ltr" className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-400">
              {loc.subZones.length}
            </span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
            {loc.subZones.map((sz) => (
              <div key={sz.id} className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-200 truncate">{sz.name}</span>
                  {sz.dangerLevel && (
                    <span dir="ltr" className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
                      D{sz.dangerLevel}
                    </span>
                  )}
                </div>
                {sz.atmosphere && (
                  <div className="text-[10.5px] text-zinc-400 leading-relaxed">{sz.atmosphere}</div>
                )}
                {sz.pointsOfInterest && sz.pointsOfInterest.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {sz.pointsOfInterest.map((poi, poiIdx) => (
                      <span
                        key={`${sz.id}_poi_${poiIdx}`}
                        className="text-[9.5px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300"
                      >
                        {poi.name}
                        {poi.skillCheck ? ` (DC ${poi.skillCheck.dc})` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top-Level Points of Interest */}
      {loc.pointsOfInterest && loc.pointsOfInterest.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-300 font-medium text-xs">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              {isPersian ? 'نقاط کلیدی و قابل کشف (POI)' : 'Points of Interest'}
            </span>
            <span dir="ltr" className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-400">
              {loc.pointsOfInterest.length}
            </span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {loc.pointsOfInterest.map((poi, poiIdx) => (
              <div key={`poi_${poiIdx}`} className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-200 truncate">{poi.name}</span>
                  {poi.skillCheck && (
                    <span dir="ltr" className="text-[9.5px] font-mono text-amber-300 shrink-0">
                      {poi.skillCheck.attribute} DC {poi.skillCheck.dc}
                    </span>
                  )}
                </div>
                {poi.description && (
                  <div className="text-[10.5px] text-zinc-400 mt-0.5 leading-relaxed">{poi.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Encounters & Quests */}
      {(localEncounters.length > 0 || localQuests.length > 0) && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          {localEncounters.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-zinc-300 font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  {isPersian ? 'رویارویی‌های این مکان' : 'Local Encounters'}
                </span>
                <span dir="ltr" className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-400">
                  {localEncounters.length}
                </span>
              </div>
              {localEncounters.map((enc) => (
                <div key={enc.id} className="p-2 bg-orange-950/20 border border-orange-500/25 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-zinc-200 truncate font-medium">{enc.title}</span>
                  <span className="text-[9.5px] font-mono text-orange-300 shrink-0">
                    {enc.triggerConditions.triggerType}
                  </span>
                </div>
              ))}
            </div>
          )}
          {localQuests.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-zinc-300 font-medium text-xs">
                <span className="flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
                  {isPersian ? 'مأموریت‌های آغازشده در اینجا' : 'Local Quests'}
                </span>
                <span dir="ltr" className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded-full border border-zinc-800 text-zinc-400">
                  {localQuests.length}
                </span>
              </div>
              {localQuests.map((q) => (
                <div key={q.id} className="p-2 bg-emerald-950/20 border border-emerald-500/25 rounded-xl text-zinc-200 truncate font-medium">
                  {q.title}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Delete action */}
      <div className="pt-2">
        <button
          type="button"
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
};
