'use client';

import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';

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

  if (!npc || isDismissed) return null;

  const imageUrl = npc.imageUrl || npc.image || npc.avatarUrl;
  const subtitle = [npc.title, npc.role || npc.archetype].filter(Boolean).join(' • ');
  const appearanceText = typeof npc.appearance === 'string' ? npc.appearance : '';
  const description = npc.description || appearanceText || '';

  return (
    <aside
      aria-label={isRtl ? 'آشنایی با شخصیت تازه' : 'New Character'}
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
          <UserPlus className="h-3.5 w-3.5 animate-pulse" />
          <span>{isRtl ? 'آشنایی با شخصیت تازه' : 'NEW CHARACTER'}</span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-zinc-800"
          title={isRtl ? 'بستن این کادر' : 'Dismiss'}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Portrait with gradient name overlay, or name header when imageless */}
      {imageUrl && !imageFailed ? (
        <div className="relative">
          <img
            src={imageUrl}
            alt={npc.name}
            onError={() => setImageFailed(true)}
            className="w-full h-56 sm:h-64 object-cover object-center"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(9,10,16,0.92) 0%, rgba(9,10,16,0.4) 45%, transparent 75%)' }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 font-serif">
              {npc.name}
            </h4>
            {subtitle && (
              <span
                className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold"
                style={{ color: accentColor, backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
              >
                {subtitle}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 sm:px-5 pt-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ color: accentColor, backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}50` }}
          >
            {(npc.name || '?').charAt(0).toUpperCase()}
          </span>
          <div>
            <h4 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 font-serif">
              {npc.name}
            </h4>
            {subtitle && (
              <div className="text-[11px] font-semibold" style={{ color: accentColor }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Short Description */}
      {description && (
        <div className="p-4 sm:p-5">
          <p className="text-xs sm:text-sm leading-relaxed text-zinc-300/90 font-sans">
            {description}
          </p>
        </div>
      )}
    </aside>
  );
}
