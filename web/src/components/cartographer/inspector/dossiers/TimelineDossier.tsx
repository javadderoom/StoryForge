'use client';

import React from 'react';
import {
  Swords,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import type { MapEntityPlacement, TimelineEvent } from '@/lib/types';
import { notify } from '@/lib/notify';

interface TimelineDossierProps {
  pin: MapEntityPlacement;
  event: TimelineEvent;
  isPersian: boolean;
  onUpdateTimelineEvent?: (id: string, updated: Partial<TimelineEvent>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const TimelineDossier: React.FC<TimelineDossierProps> = ({
  pin,
  event,
  isPersian,
  onUpdateTimelineEvent,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  return (
    <div className="space-y-4 text-xs">
      <div className="p-3.5 bg-zinc-900 border border-purple-500/30 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold shrink-0">
          <Swords className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={event.title}
            onChange={(e) => onUpdateTimelineEvent?.(event.id, { title: e.target.value })}
            className="w-full bg-transparent font-bold text-zinc-100 text-sm focus:outline-none focus:border-b focus:border-purple-500/50 pb-0.5 truncate"
            placeholder={isPersian ? 'عنوان رویداد' : 'Event Title'}
          />
          <div className="text-[11px] text-zinc-400 truncate">
            {event.yearOrEra ? `${event.yearOrEra}` : isPersian ? 'وقایع‌نگاری تاریخی' : 'Timeline Event'}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'خلاصه واقعه (Summary)' : 'Summary'}
        </label>
        <textarea
          rows={3}
          value={event.summary || ''}
          onChange={(e) => onUpdateTimelineEvent?.(event.id, { summary: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
        />
      </div>

      {event.significance && (
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'اهمیت تاریخی' : 'Historical Significance'}
          </label>
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs leading-relaxed">
            {event.significance}
          </div>
        </div>
      )}

      {/* Placement Coordinates & Controls */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
        <span dir="ltr">X: {pin.x}</span>
        <span dir="ltr">Y: {pin.y}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePlacementVisibility?.(pin.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {pin.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'نمایش' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onTogglePlacementLock?.(pin.id)}
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
              title: isPersian ? 'برداشتن سنجاق واقعه' : 'Remove Event Pin',
              message: isPersian ? `آیا سنجاق واقعه "${event.title}" از نقشه برداشته شود؟` : `Remove pin for "${event.title}"?`,
            });
            if (confirmed) {
              onDeletePlacement(pin.id);
              onClose();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove Pin'}</span>
        </button>
      </div>
    </div>
  );
};
