'use client';

import React, { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface NpcDiscoveryCardProps {
  npc?: {
    id?: string;
    name?: string;
    title?: string;
    role?: string;
    archetype?: string;
    description?: string;
    appearance?: string | Record<string, unknown>;
    imageUrl?: string;
    image?: string;
    avatarUrl?: string;
  } | null;
  isRtl?: boolean;
  accentColor?: string;
  cardBorder?: string;
}

export function NpcDiscoveryCard({
  npc,
  isRtl = true,
  accentColor = '#A78BFA',
  cardBorder = 'rgba(167, 139, 250, 0.3)',
}: NpcDiscoveryCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  if (!npc || isDismissed) return null;

  const imageUrl = npc.imageUrl || npc.image || npc.avatarUrl;

  return (
    <aside
      aria-label={npc.name || (isRtl ? 'تصویر شخصیت' : 'Character Portrait')}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="relative my-6 overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-zinc-950/95 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3"
      style={{
        borderColor: cardBorder,
        boxShadow: `0 10px 30px -10px ${accentColor}25, inset 0 1px 0 0 ${accentColor}30`,
      }}
    >
      {imageUrl && !imageFailed ? (
        <div className="relative group">
          <img
            src={imageUrl}
            alt={npc.name || ''}
            onError={() => setImageFailed(true)}
            onClick={() => setLightbox(true)}
            className="w-full h-[440px] sm:h-[500px] object-cover object-top cursor-zoom-in"
          />

          {/* Floating Zoom Indicator */}
          <div className="absolute top-3 left-3 pointer-events-none rounded-lg bg-black/60 p-1.5 text-zinc-300 opacity-80 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="h-4 w-4" />
          </div>

          {/* Floating Dismiss Button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-zinc-300 hover:text-white hover:bg-black/80 transition-all"
            title={isRtl ? 'بستن' : 'Dismiss'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative flex items-center justify-center h-48 bg-zinc-900/50">
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-zinc-300 hover:text-white hover:bg-black/80 transition-all"
            title={isRtl ? 'بستن' : 'Dismiss'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            alt={npc.name || ''}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </aside>
  );
}
