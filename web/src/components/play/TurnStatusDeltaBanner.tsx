'use client';

import React, { useEffect } from 'react';
import {
  Heart,
  HeartCrack,
  Zap,
  ZapOff,
  Coins,
  Package,
  X,
} from 'lucide-react';
import { StatusDeltaItem } from '@/lib/play/turnStatusDelta';

interface TurnStatusDeltaBannerProps {
  items: StatusDeltaItem[];
  isRtl?: boolean;
  onDismiss: () => void;
}

export function TurnStatusDeltaBanner({
  items,
  isRtl = false,
  onDismiss,
}: TurnStatusDeltaBannerProps) {
  useEffect(() => {
    if (items.length === 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4200);
    return () => clearTimeout(timer);
  }, [items, onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex max-w-lg w-full px-4 pointer-events-none justify-center animate-slideUp"
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-zinc-800/90 bg-[#0F111D]/95 p-2.5 shadow-2xl backdrop-blur-xl">
        {items.map((item) => {
          let IconComp = Zap;
          if (item.type === 'healthLoss') IconComp = HeartCrack;
          else if (item.type === 'healthGain') IconComp = Heart;
          else if (item.type === 'resourceLoss') IconComp = ZapOff;
          else if (item.type === 'resourceGain') IconComp = Zap;
          else if (item.type === 'currencyGain' || item.type === 'currencyLoss') IconComp = Coins;
          else if (item.type === 'itemAcquired' || item.type === 'itemLost') IconComp = Package;

          const sign = item.delta != null ? (item.delta > 0 ? `+${item.delta}` : `${item.delta}`) : null;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-md transition-all ${item.colorClass}`}
            >
              <IconComp className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[130px]">{item.label}</span>
              {sign && (
                <span dir="ltr" className="font-mono text-[11px] font-bold">
                  {sign}
                </span>
              )}
              {item.subtitle && !sign && (
                <span className="text-[10px] opacity-80">({item.subtitle})</span>
              )}
            </div>
          );
        })}

        <button
          onClick={onDismiss}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title={isRtl ? 'بستن' : 'Dismiss'}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
