'use client';

import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';
import { WorldCreature } from '@/lib/types/world';

interface CreatureDiscoveryCardProps {
  creature?: (WorldCreature & { image?: string; description?: string }) | null;
  isRtl?: boolean;
  accentColor?: string;
  cardBorder?: string;
}

export function CreatureDiscoveryCard({
  creature,
  isRtl = true,
  accentColor = '#F59E0B',
  cardBorder = 'rgba(245, 158, 11, 0.3)',
}: CreatureDiscoveryCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  if (!creature || isDismissed) return null;

  if (!creature || isDismissed) return null;

  const imageUrl = creature.imageUrl || creature.image;
  const description = creature.loreDescription || creature.description || '';

  return (
    <aside
      aria-label={isRtl ? 'رویارویی با موجود' : 'Creature Encounter'}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="my-6 overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3"
      style={{
        borderColor: cardBorder,
        boxShadow: `0 10px 30px -10px ${accentColor}25, inset 0 1px 0 0 ${accentColor}30`,
      }}
    >
      {/* Top Banner Ribbon */}
      <div
        className="flex items-center justify-between px-4 py-2 text-xs font-semibold tracking-wider uppercase border-b"
        style={{
          borderColor: `${accentColor}20`,
          backgroundColor: `${accentColor}12`,
          color: accentColor,
        }}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 animate-pulse" />
          <span>{isRtl ? 'رویارویی با موجود ناشناخته' : 'CREATURE ENCOUNTER'}</span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-zinc-800"
          title={isRtl ? 'بستن این کادر' : 'Dismiss'}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Card Content */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Possible Image */}
        {imageUrl && !imageFailed && (
          <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 max-h-56 w-full flex items-center justify-center">
            <img
              src={imageUrl}
              alt={creature.name}
              onError={() => setImageFailed(true)}
              onClick={() => setLightbox(true)}
              className="w-full h-48 sm:h-56 object-cover object-center transition-transform duration-500 hover:scale-105 cursor-zoom-in"
            />
          </div>
        )}

        {/* Creature Name */}
        <h4 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 font-serif">
          {creature.name}
        </h4>

        {/* Short Description */}
        {description && (
          <p className="text-xs sm:text-sm leading-relaxed text-zinc-300/90 font-sans">
            {description}
          </p>
        )}
      </div>

      {/* Fullscreen lightbox */}
      {lightbox && imageUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
            title={isRtl ? 'بستن' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={imageUrl}
            alt={creature.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </aside>
  );
}
