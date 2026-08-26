'use client';

import React from 'react';
import { Type, Palette, AlignLeft, X, Sparkles } from 'lucide-react';
import { RealmPreset, ALL_REALM_PRESETS, REALM_THEMES } from '@/lib/play/realmTheme';
import { FontSize, LineHeight } from '@/lib/play/realmTheme';
import { audioService } from '@/lib/play/audioService';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  theme: RealmPreset;
  fontSize: FontSize;
  lineHeight: LineHeight;
  enableParticles: boolean;
  isPersian?: boolean;
  onThemeChange: (theme: RealmPreset) => void;
  onFontSizeChange: (size: FontSize) => void;
  onLineHeightChange: (lh: LineHeight) => void;
  onParticlesToggled: (v: boolean) => void;
  onClose: () => void;
}

export function ReaderSettingsModal({
  isOpen,
  theme,
  fontSize,
  lineHeight,
  enableParticles,
  isPersian = false,
  onThemeChange,
  onFontSizeChange,
  onLineHeightChange,
  onParticlesToggled,
  onClose,
}: ReaderSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-[#11121d] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
            <Palette className="h-4 w-4 text-amber-400" />
            {isPersian ? 'تنظیمات اتمسفر' : 'REALM ATMOSPHERE'}
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Realm presets */}
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
            <Palette className="h-3.5 w-3.5" />
            {isPersian ? 'پوسته قلمرو' : 'Realm Theme'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_REALM_PRESETS.map((preset) => {
              const t = REALM_THEMES[preset];
              const sel = theme === preset;
              return (
                <button
                  key={preset}
                  onClick={() => {
                    audioService.playSfx('buttonClick');
                    onThemeChange(preset);
                  }}
                  style={{ background: `linear-gradient(135deg, ${t.bgGradientStart}, ${t.bgGradientEnd})`, borderColor: sel ? t.primaryAccent : t.cardBorder }}
                  className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium transition-all ${sel ? 'ring-2 ring-amber-500/40' : ''}`}
                >
                  <span style={{ color: t.primaryAccent }}>{isPersian ? t.titleFa : t.title}</span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.primaryAccent }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Font size */}
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
            <Type className="h-3.5 w-3.5" />
            {isPersian ? 'اندازه قلم' : 'Font Scale'}
          </label>
          <div className="grid grid-cols-4 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 text-xs">
            {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => onFontSizeChange(size)}
                className={`rounded-lg py-1.5 text-center transition-all ${fontSize === size ? 'bg-zinc-800 font-bold text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                {size === 'sm' ? 'A-' : size === 'base' ? 'A' : size === 'lg' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>
        </div>

        {/* Line height */}
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
            <AlignLeft className="h-3.5 w-3.5" />
            {isPersian ? 'فاصله خطوط' : 'Line Spacing'}
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 text-xs">
            {(['normal', 'relaxed', 'loose'] as LineHeight[]).map((lh) => (
              <button
                key={lh}
                onClick={() => onLineHeightChange(lh)}
                className={`rounded-lg py-1.5 text-center transition-all ${lineHeight === lh ? 'bg-zinc-800 font-bold text-amber-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                {lh === 'normal' ? (isPersian ? 'فشرده' : 'Compact') : lh === 'relaxed' ? (isPersian ? 'استاندارد' : 'Standard') : isPersian ? 'باز' : 'Relaxed'}
              </button>
            ))}
          </div>
        </div>

        {/* Particles */}
        <button
          onClick={() => onParticlesToggled(!enableParticles)}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs"
        >
          <span className="flex items-center gap-1.5 text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {isPersian ? 'ذرات اتمسفر' : 'Ambient Particles'}
          </span>
          <span className={`h-4 w-7 rounded-full transition-colors ${enableParticles ? 'bg-amber-500' : 'bg-zinc-700'}`}>
            <span className={`block h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${enableParticles ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
        </button>

        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-zinc-800 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700">
          {isPersian ? 'بستن' : 'Done'}
        </button>
      </div>
    </div>
  );
}
