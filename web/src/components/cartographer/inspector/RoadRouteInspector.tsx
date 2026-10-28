'use client';

import React from 'react';
import {
  Link2,
  Unlink,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import type {
  MapRoute,
  MapRouteDifficulty,
  MapRouteKind,
  MapRouteLineStyle,
  WorldLocation,
  MapTerrainFeature,
  MapEntityPlacement,
  CustomPlaceCategory,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import {
  MAP_ROUTE_DIFFICULTY_LABELS,
  MAP_ROUTE_KIND_META,
  endpointLabelForRef,
  resolveRouteEndpointPoint,
  routeKindLabel,
  snapRouteEndpoint,
} from '@/lib/engines/world/mapRoutes';

export interface RoadRouteInspectorProps {
  route: MapRoute;
  locations: WorldLocation[];
  terrainFeatures: MapTerrainFeature[];
  placements: MapEntityPlacement[];
  placeCategories: CustomPlaceCategory[];
  isPersian: boolean;
  onUpdateRoute: (id: string, updated: Partial<MapRoute>) => void;
  onDeleteRoute: (id: string) => void;
  onToggleRouteVisibility?: (id: string) => void;
  onToggleRouteLock?: (id: string) => void;
  onClose: () => void;
}

export const RoadRouteInspector: React.FC<RoadRouteInspectorProps> = ({
  route,
  locations,
  terrainFeatures,
  placements,
  placeCategories,
  isPersian,
  onUpdateRoute,
  onDeleteRoute,
  onToggleRouteVisibility,
  onToggleRouteLock,
  onClose,
}) => {
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
                  type="button"
                  onClick={() => updateEndpoint(which)}
                  className="p-1 rounded-md text-zinc-500 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                  title={isPersian ? 'اتصال مجدد به نزدیک‌ترین عنصر' : 'Re-snap to nearest element'}
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
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
          type="button"
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
          type="button"
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
          type="button"
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
};
