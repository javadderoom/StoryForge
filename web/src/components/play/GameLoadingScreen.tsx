'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Dices, ShieldAlert, Compass } from 'lucide-react';
import { RealmTheme } from '@/lib/play/realmTheme';
import { toPersianDigits } from '@/lib/play/persianNumbers';

interface GameLoadingScreenProps {
  isLoading: boolean;
  progress: number; // 0 to 100
  storyTitle?: string;
  storyTagline?: string;
  isPersian?: boolean;
  theme?: RealmTheme;
  onFinish?: () => void;
}

const HINTS_FA = [
  'بارگذاری تاس بیست‌وجهی سرنوشت و صیقل‌دادن وجوه طلایی...',
  'احضار قوانین جهان و هماهنگ‌سازی کانون روایت...',
  'تنظیم تارهای تقدیر و پیوند پیامدهای احتمالی...',
  'گشودن دروازه و نگارش نخستین سطر‌های ماجراجویی...',
];

const HINTS_EN = [
  "Forging destiny's D20 die and polishing golden facets...",
  'Summoning realm laws and harmonizing world canon...',
  'Weaving threads of fate and branching contingencies...',
  'Unlocking the gateway and inscribing the first chronicle...',
];

export function GameLoadingScreen({
  isLoading,
  progress,
  storyTitle,
  storyTagline,
  isPersian = true,
  theme,
  onFinish,
}: GameLoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(isLoading);
  const [hintIndex, setHintIndex] = useState(0);

  const hints = isPersian ? HINTS_FA : HINTS_EN;

  // Cycle through atmospheric lore cues
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % hints.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isLoading, hints.length]);

  // Handle smooth exit transition after loading finishes
  useEffect(() => {
    if (isLoading) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
        onFinish?.();
      }, 700); // matches transition duration
      return () => clearTimeout(timer);
    }
  }, [isLoading, onFinish]);

  if (!shouldRender) return null;

  const primaryAccent = theme?.primaryAccent || '#F59E0B';
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      dir={isPersian ? 'rtl' : 'ltr'}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#07080D] transition-opacity duration-700 ease-in-out ${isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
    >
      {/* Dynamic Realm Ambient Background Glow */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full blur-[140px] opacity-25"
        style={{ background: primaryAccent }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full blur-[140px] opacity-20"
        style={{ background: '#7C3AED' }}
      />

      {/* Subtle Grid / Starfield Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #FFFFFF 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Central Interactive Loading Container */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        {/* Arcane Rotating Sigil / Glowing D20 Emblem */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Outer Pulsing Aura */}
          <div
            className="absolute h-28 w-28 rounded-full blur-xl opacity-40 animate-pulse"
            style={{ backgroundColor: primaryAccent }}
          />

          {/* Outer Rotating Arcane Ring */}
          <div
            className="h-24 w-24 rounded-full border border-amber-500/20 border-t-amber-400 border-r-amber-500/60 animate-spin"
            style={{ animationDuration: '6s' }}
          />

          {/* Inner Counter-Rotating Ring */}
          <div
            className="absolute h-16 w-16 rounded-full border border-dashed border-amber-400/30 border-b-amber-300 animate-spin"
            style={{ animationDuration: '4s', animationDirection: 'reverse' }}
          />

          {/* Central Emblem Icon */}
          <div
            className="absolute flex h-12 w-12 items-center justify-center rounded-2xl shadow-xl backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(16,18,29,0.85) 100%)',
              border: `1px solid ${primaryAccent}55`,
              boxShadow: `0 0 25px -5px ${primaryAccent}66`,
            }}
          >
            <Dices className="h-6 w-6 text-amber-300 animate-bounce" style={{ animationDuration: '2s' }} />
          </div>
        </div>

        {/* Story Title & Realm Header */}
        <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mb-2 drop-shadow-md">
          {storyTitle || (isPersian ? 'دروازه سرنوشت' : 'The Threshold of Fate')}
        </h2>

        {storyTagline && (
          <p className="text-xs text-zinc-400 mb-6 max-w-sm line-clamp-2 italic leading-relaxed">
            &ldquo;{storyTagline}&rdquo;
          </p>
        )}

        {/* Atmospheric Progress Bar */}
        <div className="w-full mt-2 mb-3">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800/80 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{
                width: `${clampedProgress}%`,
                background: `linear-gradient(90deg, #F59E0B 0%, #FBBF24 50%, #FDE68A 100%)`,
                boxShadow: `0 0 16px ${primaryAccent}99`,
              }}
            >
              {/* Shimmer Light Reflection Sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />
            </div>
          </div>

          {/* Metric Status Readout with explicit LTR container for RTL BiDi safety */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
            <span className="flex items-center gap-1.5 text-amber-400/90 font-sans text-xs">
              <Sparkles className="h-3 w-3 animate-spin text-amber-400" style={{ animationDuration: '3s' }} />
              <span>{isPersian ? 'در حال آماده‌سازی جهان...' : 'Materializing realm...'}</span>
            </span>

            {/* Enforce LTR wrapper & LRM character to eliminate number/percent sign reversal bugs */}
            <div dir="ltr" className="font-mono font-bold text-amber-300 tracking-wider">
              <span>{'\u200E'}{isPersian ? toPersianDigits(clampedProgress) : clampedProgress}%</span>
            </div>
          </div>
        </div>

        {/* Cycling Lore / Narrative Cues */}
        <div className="h-10 flex items-center justify-center">
          <p
            key={hintIndex}
            className="text-xs text-zinc-400/90 italic animate-fade-in transition-all duration-500 line-clamp-2"
          >
            {hints[hintIndex]}
          </p>
        </div>
      </div>

      {/* Subtle Footer Watermark */}
      <div className="absolute bottom-6 flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
        <Compass className="h-3 w-3 text-amber-500/40" />
        <span>AfsanehSaz World Engine</span>
      </div>
    </div>
  );
}
