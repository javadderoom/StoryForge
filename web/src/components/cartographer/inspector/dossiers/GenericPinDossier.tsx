'use client';

import React from 'react';
import {
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
} from 'lucide-react';
import type { MapEntityPlacement } from '@/lib/types';
import { notify } from '@/lib/notify';

interface GenericPinDossierProps {
  pin: MapEntityPlacement;
  isPersian: boolean;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const GenericPinDossier: React.FC<GenericPinDossierProps> = ({
  pin,
  isPersian,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-zinc-100 text-sm truncate">{pin.customLabel || pin.entityId}</div>
          <div className="text-[11px] text-zinc-400 capitalize">{pin.entityType}</div>
        </div>
      </div>

      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
        <span dir="ltr">X: {pin.x}</span>
        <span dir="ltr">Y: {pin.y}</span>
      </div>

      {/* Plan 21: per-object layer controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePlacementVisibility?.(pin.id)}
          title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
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
          type="button"
          onClick={() => onTogglePlacementLock?.(pin.id)}
          title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
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
          type="button"
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
};
