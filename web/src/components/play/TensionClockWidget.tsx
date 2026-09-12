'use client';

import React from 'react';
import { TensionClock } from '@/lib/types/gameplay';

function segments(clock: TensionClock): boolean[] {
  const max = Math.max(2, clock.maxSegments || 4);
  const cur = Math.min(max, Math.max(0, clock.currentSegments || 0));
  return Array.from({ length: max }, (_, i) => i < cur);
}

/**
 * Plan 13: dark-fantasy glowing segmented threat meter.
 * Renders nothing when no clocks are active.
 */
export function TensionClockWidget({ clocks, isRtl }: { clocks: TensionClock[]; isRtl: boolean }) {
  if (!clocks || clocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      {clocks.map((clock) => {
        const segs = segments(clock);
        const nearCrisis = !clock.isTriggered && clock.currentSegments >= clock.maxSegments - 1;
        return (
          <div
            key={clock.id}
            title={clock.crisisDescription || clock.name}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] backdrop-blur-md transition-all ${
              clock.isTriggered
                ? 'border-red-500/70 bg-red-950/60 shadow-[0_0_18px_rgba(239,68,68,0.45)]'
                : nearCrisis
                  ? 'border-amber-500/60 bg-amber-950/40 shadow-[0_0_14px_rgba(245,158,11,0.35)] animate-pulse'
                  : 'border-zinc-700/60 bg-zinc-900/70'
            }`}
          >
            <span className={`font-bold ${clock.isTriggered ? 'text-red-300' : nearCrisis ? 'text-amber-300' : 'text-zinc-300'}`}>
              {clock.isTriggered ? (isRtl ? 'بحران!' : 'CRISIS!') : ''} {clock.name}
            </span>
            <span className="flex items-center gap-0.5" dir="ltr">
              {segs.map((filled, i) => (
                <span
                  key={i}
                  className={`inline-block h-3 w-2.5 rounded-[3px] border ${
                    filled
                      ? clock.isTriggered
                        ? 'border-red-400 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                        : nearCrisis
                          ? 'border-amber-400 bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.7)]'
                          : 'border-rose-400/70 bg-rose-500/80'
                      : 'border-zinc-600 bg-zinc-800'
                  }`}
                />
              ))}
            </span>
            <span className="font-mono text-[10px] text-zinc-400" dir="ltr">
              {clock.currentSegments}/{clock.maxSegments}
            </span>
          </div>
        );
      })}
    </div>
  );
}
