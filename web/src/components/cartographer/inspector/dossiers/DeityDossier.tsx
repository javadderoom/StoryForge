'use client';

import React from 'react';
import {
  Sparkle,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import type { MapEntityPlacement, WorldDeity } from '@/lib/types';
import { notify } from '@/lib/notify';

interface DeityDossierProps {
  pin: MapEntityPlacement;
  deity: WorldDeity;
  isPersian: boolean;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const DeityDossier: React.FC<DeityDossierProps> = ({
  pin,
  deity,
  isPersian,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const domainLabels: Record<string, { en: string; fa: string }> = {
    light: { en: 'Light & Order', fa: 'نور و نظم' },
    death: { en: 'Death & Passage', fa: 'مرگ و گذر' },
    war: { en: 'War & Conquest', fa: 'جنگ و کشورگشایی' },
    secrets: { en: 'Secrets & Knowledge', fa: 'راز و دانش' },
    nature: { en: 'Nature & Growth', fa: 'طبیعت و رویش' },
    chaos: { en: 'Chaos & Change', fa: 'آشوب و دگرگونی' },
    forge: { en: 'Forge & Craft', fa: 'آهنگری و پیشه' },
  };
  const domain = domainLabels[deity.domain] ?? { en: deity.domain, fa: deity.domain };

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-300">
          <Sparkle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-zinc-100 text-sm truncate">{deity.name}</div>
          <div className="text-[11px] text-zinc-400 truncate">
            {isPersian ? 'زیارتگاه و یادمان' : 'Shrine & Deity'}
            {deity.title ? ` · ${deity.title}` : ''}
          </div>
        </div>
        <span className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium bg-yellow-500/10 border border-yellow-500/30 text-yellow-300">
          {isPersian ? domain.fa : domain.en}
        </span>
      </div>

      {deity.sacredSymbol && (
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'نماد مقدس' : 'Sacred Symbol'}
          </label>
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs leading-relaxed">
            {deity.sacredSymbol}
          </div>
        </div>
      )}

      {deity.coreDogma && (
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'هستهٔ باور' : 'Core Dogma'}
          </label>
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs leading-relaxed">
            {deity.coreDogma}
          </div>
        </div>
      )}

      {(deity.taboos?.length > 0 || deity.divineBlessings?.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {deity.taboos?.length > 0 && (
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'محرمات' : 'Taboos'}
              </label>
              <ul className="space-y-1">
                {deity.taboos.map((taboo, i) => (
                  <li
                    key={i}
                    className="p-2 bg-rose-950/20 border border-rose-900/40 rounded-xl text-[11px] text-rose-200/90 leading-relaxed"
                  >
                    {taboo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {deity.divineBlessings?.length > 0 && (
            <div>
              <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
                {isPersian ? 'برکات الهی' : 'Divine Blessings'}
              </label>
              <ul className="space-y-1">
                {deity.divineBlessings.map((blessing, i) => (
                  <li
                    key={i}
                    className="p-2 bg-yellow-950/20 border border-yellow-900/40 rounded-xl text-[11px] text-yellow-100/90 leading-relaxed"
                  >
                    {blessing}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
              title: isPersian ? 'برداشتن سنجاق زیارتگاه' : 'Remove Shrine Pin',
              message: isPersian
                ? `آیا سنجاق زیارتگاه "${deity.name}" از نقشه برداشته شود؟`
                : `Remove the shrine pin for "${deity.name}"?`,
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
