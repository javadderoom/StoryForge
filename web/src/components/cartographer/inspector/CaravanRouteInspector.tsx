'use client';

import React from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import type {
  WorldTradeRoute,
  WorldLocation,
  Faction,
  TradeRouteStatus,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { TRADE_STATUSES, STATUS_LABELS } from './types';

export interface CaravanRouteInspectorProps {
  route: WorldTradeRoute;
  locations: WorldLocation[];
  factions: Faction[];
  isPersian: boolean;
  onUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  onDeleteTradeRoute: (id: string) => void;
  onClose: () => void;
}

export const CaravanRouteInspector: React.FC<CaravanRouteInspectorProps> = ({
  route,
  locations,
  factions,
  isPersian,
  onUpdateTradeRoute,
  onDeleteTradeRoute,
  onClose,
}) => {
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
            {origin ? origin.name : isPersian ? 'نامشخص' : 'Unknown'}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mx-2" />
        <div className="truncate text-right">
          <div className="text-[10px] text-zinc-500 font-medium uppercase">{isPersian ? 'مقصد' : 'Destination'}</div>
          <div className="font-semibold text-zinc-200 truncate mt-0.5">
            {destination ? destination.name : isPersian ? 'نامشخص' : 'Unknown'}
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
                {lvl} - {lvl <= 2 ? (isPersian ? 'کم‌خطر' : 'Low') : isPersian ? 'راهزنان / هیولا' : 'Hazardous'}
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
          type="button"
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
};
