'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Castle,
  History,
  Search,
  Skull,
  Sparkles,
  Sun,
  User,
  Wand2,
  X,
} from 'lucide-react';
import type { MapEntityPlacement, MapPoint, WorldBible } from '@/lib/types';
import {
  listLoreCandidates,
  loreKindLabel,
  type LorePinCandidate,
  type LorePinKind,
} from '@/lib/engines/world/lorePlacement';

interface LorePlacementPickerProps {
  kind: LorePinKind;
  worldPoint: MapPoint;
  clientX: number;
  clientY: number;
  worldBible: WorldBible;
  placements: MapEntityPlacement[];
  isPersian: boolean;
  onPlace: (candidate: LorePinCandidate) => void;
  /** Opens the AI generator for this kind at this point. Absent = unsupported. */
  onGenerateWithAi?: () => void;
  onClose: () => void;
}

const KIND_ICONS: Record<LorePinKind, React.ComponentType<{ className?: string }>> = {
  npc: User,
  bestiary: Skull,
  artifact: Sparkles,
  deity: Sun,
  timeline: History,
};

/** Where this entity type is authored when the map has none to place. */
const STUDIO_HREF: Record<LorePinKind, string> = {
  npc: '/studio/npcs',
  bestiary: '/studio/bestiary',
  artifact: '/studio/artifacts',
  deity: '/studio/religions',
  timeline: '/studio/timeline',
};

const PANEL_WIDTH = 320;

/**
 * The "what goes here?" list for a lore tool.
 *
 * The Cartographer is a view of the world bible, so the tool never invents an
 * unnamed entity: the author picks canon, or leaves to author it (or asks the
 * AI to draft one at this exact spot).
 */
export function LorePlacementPicker({
  kind,
  worldPoint,
  clientX,
  clientY,
  worldBible,
  placements,
  isPersian,
  onPlace,
  onGenerateWithAi,
  onClose,
}: LorePlacementPickerProps) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const Icon = KIND_ICONS[kind];
  const label = loreKindLabel(kind, isPersian);
  const candidates = useMemo(
    () => listLoreCandidates(worldBible, kind, placements, isPersian),
    [worldBible, kind, placements, isPersian]
  );

  const query = search.toLowerCase().trim();
  const visible = query
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.subtitle.toLowerCase().includes(query)
      )
    : candidates;

  // Keep the panel on screen without measuring twice: the height is capped by
  // CSS, so only the horizontal anchor needs the viewport width.
  const left = useMemo(() => {
    if (typeof window === 'undefined') return clientX;
    return Math.max(12, Math.min(clientX, window.innerWidth - PANEL_WIDTH - 12));
  }, [clientX]);
  const top = useMemo(() => {
    if (typeof window === 'undefined') return clientY;
    return Math.max(12, Math.min(clientY, window.innerHeight - 320));
  }, [clientY]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const placeLabel = isPersian ? 'استقرار' : 'Place';
  const hereLabel = isPersian ? 'در این نقطه' : 'here';

  return (
    <>
      {/* Click-away backdrop. Also keeps the click off the map underneath. */}
      <div className="fixed inset-0 z-40" onMouseDown={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        dir={isPersian ? 'rtl' : 'ltr'}
        style={{ left, top, width: PANEL_WIDTH }}
        className={`fixed z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-[#4a392a] bg-[#1a1410]/97 text-[#eedec8] shadow-2xl backdrop-blur-md select-none ${
          isPersian ? 'font-[Vazirmatn]' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#3d2f23] bg-[#241c16] p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#4a392a] bg-[#15100c]">
              <Icon className="h-3.5 w-3.5 text-[#d8ab6c]" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[#f1d6b0]">
                {isPersian ? `${label} — ${placeLabel} ${hereLabel}` : `${placeLabel} ${label} ${hereLabel}`}
              </div>
              <div dir="ltr" className="font-mono text-[9.5px] text-[#847160]">
                ({Math.round(worldPoint.x)}, {Math.round(worldPoint.y)})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            title={isPersian ? 'بستن' : 'Close'}
            className="rounded p-0.5 text-[#96806e] transition-colors hover:text-[#eedec8]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-b border-[#3d2f23]/70 p-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#3d2f23] bg-[#15100c] px-2 py-1">
            <Search className="h-3 w-3 shrink-0 text-[#7c6a5a]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isPersian ? `جست‌وجوی ${label}` : `Search ${label.toLowerCase()}…`}
              className="w-full bg-transparent text-[11.5px] text-[#eedec8] placeholder:text-[#7c6a5a] focus:outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.length === 0 ? (
            <div className="px-2 py-4 text-center text-[11px] leading-relaxed text-[#9c8774]">
              {candidates.length === 0
                ? isPersian
                  ? `هنوز ${label}ی در این جهان ثبت نشده است.`
                  : `No ${label.toLowerCase()} in this world yet.`
                : isPersian
                  ? 'چیزی با این جست‌وجو پیدا نشد.'
                  : 'Nothing matches that search.'}
              <div className="mt-2 text-[10.5px] text-[#7c6a5a]">
                {isPersian
                  ? 'می‌توانید همین‌جا با هوش مصنوعی بسازید، یا در استودیو بنویسید.'
                  : 'Draft one here with the AI, or author it in Studio.'}
              </div>
            </div>
          ) : (
            visible.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => onPlace(candidate)}
                title={
                  candidate.pinned
                    ? isPersian
                      ? 'این عنصر پیش‌تر روی نقشه سنجاق شده است'
                      : 'This entity is already pinned on the map'
                    : undefined
                }
                className="group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-[#2e231a]"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                    {candidate.name}
                  </div>
                  {candidate.subtitle && (
                    <div className="truncate text-[10px] text-[#9c8774]">
                      {candidate.subtitle}
                    </div>
                  )}
                </div>
                {candidate.pinned && (
                  <span className="mt-0.5 shrink-0 rounded border border-[#4a392a] bg-[#15100c] px-1 py-0.5 text-[9px] text-[#b99a72]">
                    {isPersian ? 'روی نقشه' : 'pinned'}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="space-y-1 border-t border-[#3d2f23] bg-[#18130f] p-1.5">
          {onGenerateWithAi && (
            <button
              onClick={onGenerateWithAi}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-[#2e231a]"
            >
              <Wand2 className="h-3.5 w-3.5 shrink-0 text-[#d48b4b]" />
              <div className="min-w-0">
                <div className="text-[11.5px] font-medium text-[#f5ebd9]">
                  {isPersian ? 'ساختن با هوش مصنوعی در این نقطه' : 'Generate one here with AI'}
                </div>
                <div className="truncate text-[10px] text-[#9c8774]">
                  {isPersian
                    ? 'سازگار با اقلیم و قوانین همین جهان'
                    : 'Fitted to this spot’s terrain and your canon'}
                </div>
              </div>
            </button>
          )}

          <a
            href={STUDIO_HREF[kind]}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#2e231a]"
          >
            <Castle className="h-3.5 w-3.5 shrink-0 text-[#96806e]" />
            <span className="text-[11px] text-[#bda791]">
              {isPersian ? `نوشتن ${label} در استودیو` : `Author ${label.toLowerCase()}s in Studio`}
            </span>
          </a>
        </div>
      </div>
    </>
  );
}