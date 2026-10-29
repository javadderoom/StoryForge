'use client';

import React, { useMemo } from 'react';
import {
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Snowflake,
  Link2,
  Unlink,
  Layers,
  Folder,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import type {
  MapTerrainFeature,
  WorldLocation,
  CustomPlaceCategory,
  MapGroup,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { placeAcceptsTerrainType } from '@/lib/engines/world/terrainPlacePairing';
import { SearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';
import { simplifyPoints, simplifyPolygon } from '@/lib/engines/world/pixi/pathSimplification';
import { TerrainDeltaSection } from './sections/TerrainDeltaSection';
import { TerrainDuneSection } from './sections/TerrainDuneSection';
import { TerrainWaterliningSection } from './sections/TerrainWaterliningSection';
import { TerrainCanopySection } from './sections/TerrainCanopySection';
import { TerrainCurvedTextSection } from './sections/TerrainCurvedTextSection';

export interface TerrainInspectorProps {
  feature: MapTerrainFeature;
  locations: WorldLocation[];
  placeCategories: CustomPlaceCategory[];
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onDeleteTerrain: (id: string) => void;
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onClose: () => void;
  onAddTerrain?: (feature: MapTerrainFeature) => void;
  allFeatures?: MapTerrainFeature[];
  onSelectFeature?: (id: string) => void;
  groups?: MapGroup[];
  onSelectGroup?: (groupId: string) => void;
}

export const TerrainInspector: React.FC<TerrainInspectorProps> = ({
  feature,
  locations,
  placeCategories,
  isPersian,
  onUpdateTerrain,
  onDeleteTerrain,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onClose,
  onAddTerrain,
  allFeatures,
  onSelectFeature,
  groups,
  onSelectGroup,
}) => {
  const owningGroup = feature.groupId
    ? groups?.find((g) => g.id === feature.groupId)
    : undefined;

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

  const locationOptions = useMemo<ComboboxOption[]>(() => {
    const options: ComboboxOption[] = [];
    if (linkedToMissingPlace && feature.locationId) {
      options.push({
        id: feature.locationId,
        name: `${feature.locationId} (${isPersian ? 'ناموجود' : 'missing'})`,
        badge: isPersian ? 'ناموجود' : 'missing',
        badgeColor: 'red',
      });
    }
    for (const loc of compatibleLocations) {
      options.push({
        id: loc.id,
        name: loc.name,
        subtext: loc.category || undefined,
        badge: isPersian ? 'سازگار' : 'Compatible',
        badgeColor: 'emerald',
      });
    }
    for (const loc of otherLocations) {
      options.push({
        id: loc.id,
        name: loc.name,
        subtext: loc.category || undefined,
        badge: isPersian ? 'سایر' : 'Other',
        badgeColor: 'amber',
      });
    }
    return options;
  }, [compatibleLocations, otherLocations, linkedToMissingPlace, feature.locationId, isPersian]);

  const isMountain =
    feature.type === 'mountain_range' ||
    feature.type === 'peak' ||
    feature.type === 'volcano';
  const isElevationLinked = isMountain ? feature.syncElevationScale !== false : false;

  return (
    <div className="space-y-4 text-xs">
      {/* Group / Unified Entity Membership Banner */}
      {owningGroup && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {owningGroup.mode === 'unified_entity' ? (
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-stone-300 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold block">
                {owningGroup.mode === 'unified_entity'
                  ? isPersian ? 'عضو انتینتی واحد داستان' : 'Unified Story Entity'
                  : isPersian ? 'عضو پوشه سازمانی' : 'Folder Group'}
              </span>
              <p className="text-xs font-semibold text-zinc-100 truncate">
                {owningGroup.name}
              </p>
            </div>
          </div>
          {onSelectGroup && (
            <button
              type="button"
              onClick={() => onSelectGroup(owningGroup.id)}
              className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-medium transition-all"
            >
              {isPersian ? 'بازرسی گروه' : 'Inspect Group'}
            </button>
          )}
        </div>
      )}

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
          type="button"
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
          type="button"
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
        <label className="text-[11px] text-zinc-400 mb-1.5 block font-medium">
          {isPersian ? 'مکان روایی متصل' : 'Narrative Place'}
        </label>
        <SearchableCombobox
          value={feature.locationId || ''}
          onChange={(targetLocId) => {
            const targetLoc = targetLocId ? locations.find((l) => l.id === targetLocId) : undefined;
            onUpdateTerrain(feature.id, {
              locationId: targetLocId || undefined,
              ...(targetLoc ? { name: targetLoc.name } : {}),
            });
          }}
          options={locationOptions}
          placeholder={isPersian ? 'بدون مکان روایی (انتخاب برای اتصال)...' : 'No narrative place (select to link)...'}
          searchPlaceholder={isPersian ? 'جستجوی مکان روایی...' : 'Search narrative place...'}
          emptyMessage={isPersian ? 'مکانی یافت نشد' : 'No narrative places found'}
          isPersian={isPersian}
          clearable
        />
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
                  ? 2
                  : 5
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
              step={1}
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

      {/* Plan 27 feature sub-sections */}
      <TerrainDeltaSection
        feature={feature}
        isPersian={isPersian}
        onUpdateTerrain={onUpdateTerrain}
        onAddTerrain={onAddTerrain}
        allFeatures={allFeatures}
        onSelectFeature={onSelectFeature}
      />

      <TerrainDuneSection
        feature={feature}
        isPersian={isPersian}
        onUpdateTerrain={onUpdateTerrain}
      />

      <TerrainWaterliningSection
        feature={feature}
        isPersian={isPersian}
        onUpdateTerrain={onUpdateTerrain}
      />

      <TerrainCanopySection
        feature={feature}
        isPersian={isPersian}
        onUpdateTerrain={onUpdateTerrain}
      />

      <TerrainCurvedTextSection
        feature={feature}
        isPersian={isPersian}
        onUpdateTerrain={onUpdateTerrain}
      />

      {/* Path Geometry & Vertex Optimization */}
      {((feature.polygon && feature.polygon.length >= 3) ||
        (feature.points && feature.points.length >= 2)) && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-medium">
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{isPersian ? 'گره‌های کنترلی هندسه' : 'Control Vertices'}</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              {feature.polygon?.length ?? feature.points?.length ?? 0}{' '}
              {isPersian ? 'نقطه' : 'pts'}
            </span>
          </div>

          {(feature.polygon?.length ?? feature.points?.length ?? 0) > 6 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/80">
              <span className="text-[10px] text-zinc-400">
                {isPersian
                  ? 'کاهش نقاط برای ویرایش نرم‌تر'
                  : 'Optimize points for smoother editing'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (feature.polygon && feature.polygon.length > 3) {
                    const before = feature.polygon.length;
                    const simplified = simplifyPolygon(feature.polygon, 8);
                    onUpdateTerrain(feature.id, { polygon: simplified });
                    notify.success(
                      isPersian
                        ? `تعداد نقاط از ${before} به ${simplified.length} بهینه‌سازی شد.`
                        : `Simplified vertices from ${before} to ${simplified.length}.`
                    );
                  } else if (feature.points && feature.points.length > 2) {
                    const before = feature.points.length;
                    const simplified = simplifyPoints(feature.points, 6);
                    onUpdateTerrain(feature.id, { points: simplified });
                    notify.success(
                      isPersian
                        ? `تعداد نقاط از ${before} به ${simplified.length} بهینه‌سازی شد.`
                        : `Simplified vertices from ${before} to ${simplified.length}.`
                    );
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{isPersian ? 'بهینه‌سازی نقاط' : 'Simplify Vertices'}</span>
              </button>
            </div>
          )}
        </div>
      )}

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
          type="button"
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
};
