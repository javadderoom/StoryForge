'use client';

import React, { useState } from 'react';
import { Skull, Sparkles, ChevronDown, ChevronUp, ShieldAlert, Eye, X } from 'lucide-react';
import { WorldCreature } from '@/lib/types/world';

interface CreatureDiscoveryCardProps {
  creature?: WorldCreature | null;
  isRtl?: boolean;
  accentColor?: string;
  cardBorder?: string;
}

const CATEGORY_LABELS_FA: Record<string, string> = {
  beast: 'جانور وحشی',
  monstrosity: 'هیولا و دگرگون‌شده',
  undead: 'نامیرا',
  elemental: 'عنصری',
  flora: 'گیاه / قارچ بومی',
  mineral: 'کانی و منبع طبیعی',
  draconic: 'اژدهاسان',
  humanoid: 'گونهٔ شبه‌انسان',
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  beast: 'Wild Beast',
  monstrosity: 'Monstrosity',
  undead: 'Undead',
  elemental: 'Elemental',
  flora: 'Flora / Native Fungi',
  mineral: 'Mineral & Resource',
  draconic: 'Draconic',
  humanoid: 'Humanoid',
};

const DANGER_LABELS_FA: Record<number, string> = {
  1: 'ناچیز / کم‌خطر',
  2: 'متوسط / چالش‌برانگیز',
  3: 'خطرناک / کشنده',
  4: 'مهیب / ویرانگر',
  5: 'فاجعه‌بار / حماسی',
};

const DANGER_LABELS_EN: Record<number, string> = {
  1: 'Minor / Low Threat',
  2: 'Moderate / Challenging',
  3: 'Dangerous / Lethal',
  4: 'Dreadful / Devastating',
  5: 'Cataclysmic / Mythic',
};

export function CreatureDiscoveryCard({
  creature,
  isRtl = true,
  accentColor = '#F59E0B',
  cardBorder = 'rgba(245, 158, 11, 0.3)',
}: CreatureDiscoveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!creature || isDismissed) return null;

  const categoryName = isRtl
    ? CATEGORY_LABELS_FA[creature.speciesCategory] || creature.speciesCategory
    : CATEGORY_LABELS_EN[creature.speciesCategory] || creature.speciesCategory;

  const dangerRating = creature.dangerLevel || 1;
  const dangerLabel = isRtl
    ? DANGER_LABELS_FA[dangerRating] || `سطح ${dangerRating}`
    : DANGER_LABELS_EN[dangerRating] || `Level ${dangerRating}`;

  return (
    <aside
      aria-label={isRtl ? 'کشف موجود در کتاب جانوران' : 'Bestiary Discovery'}
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
          <span>{isRtl ? 'ثبت جدید در کتاب جانوران' : 'NEW BESTIARY CODEX ENTRY'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100 transition-opacity"
            title={isRtl ? (isExpanded ? 'جمع کردن' : 'گسترش') : (isExpanded ? 'Collapse' : 'Expand')}
          >
            {isExpanded ? (
              <>
                <span>{isRtl ? 'بستن جزئیات' : 'Less'}</span>
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>{isRtl ? 'مشاهده ویژگی‌ها' : 'Details'}</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity hover:bg-zinc-800"
            title={isRtl ? 'بستن این کادر' : 'Dismiss'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Card Content */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Creature Title & Category */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg border text-sm"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                }}
              >
                <Skull className="h-4 w-4" />
              </span>
              <h4 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 font-serif">
                {creature.name}
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 font-medium text-zinc-300 border border-zinc-700/50">
                {categoryName}
              </span>
              {creature.rarity && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-300 border border-amber-500/20">
                  {creature.rarity}
                </span>
              )}
            </div>
          </div>

          {/* Threat / Danger Rating */}
          <div
            className="flex flex-col items-end rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5"
            dir="ltr"
          >
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    level <= dangerRating
                      ? dangerRating >= 4
                        ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                        : dangerRating >= 3
                        ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                        : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
            <span
              className={`mt-1 text-[11px] font-semibold tracking-wide ${
                dangerRating >= 4
                  ? 'text-rose-400'
                  : dangerRating >= 3
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {dangerLabel}
            </span>
          </div>
        </div>

        {/* Expanded Details Section */}
        {isExpanded && (
          <div className="mt-3.5 space-y-3 pt-3 border-t border-zinc-800/70 text-xs sm:text-sm">
            {/* Lore & Physical Characteristics */}
            {creature.loreDescription && (
              <p className="leading-relaxed text-zinc-300/90 font-sans">
                {creature.loreDescription}
              </p>
            )}

            {/* Behavioral Tactics / Instinct */}
            {creature.behavioralTactics && (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <span className="block font-semibold text-amber-300/90 text-xs mb-1">
                  {isRtl ? 'رفتار و شگرد شکار:' : 'Instinct & Combat Behavior:'}
                </span>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {creature.behavioralTactics}
                </p>
              </div>
            )}

            {/* Weaknesses & Resistances */}
            {((creature.weaknesses && creature.weaknesses.length > 0) ||
              (creature.resistances && creature.resistances.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {creature.weaknesses && creature.weaknesses.length > 0 && (
                  <div className="rounded-lg border border-rose-950/40 bg-rose-950/15 p-2.5">
                    <span className="font-semibold text-rose-300 block mb-1">
                      {isRtl ? 'نقاط ضعف آسیب‌پذیر:' : 'Key Vulnerabilities:'}
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-zinc-300">
                      {creature.weaknesses.map((w, idx) => (
                        <li key={idx} className="leading-snug">{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {creature.resistances && creature.resistances.length > 0 && (
                  <div className="rounded-lg border border-sky-950/40 bg-sky-950/15 p-2.5">
                    <span className="font-semibold text-sky-300 block mb-1">
                      {isRtl ? 'مقاومت‌ها و مصونیت‌ها:' : 'Resistances & Defenses:'}
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-zinc-300">
                      {creature.resistances.map((r, idx) => (
                        <li key={idx} className="leading-snug">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
