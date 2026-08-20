'use client';

import React from 'react';
import { Type, Palette, AlignLeft, X } from 'lucide-react';

export type ReaderTheme = 'charcoal' | 'oled' | 'sepia' | 'midnight';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl';
export type LineHeight = 'normal' | 'relaxed' | 'loose';

interface ReaderSettingsModalProps {
  isOpen: boolean;
  theme: ReaderTheme;
  fontSize: FontSize;
  lineHeight: LineHeight;
  isPersian?: boolean;
  onThemeChange: (theme: ReaderTheme) => void;
  onFontSizeChange: (size: FontSize) => void;
  onLineHeightChange: (lh: LineHeight) => void;
  onClose: () => void;
}

export function ReaderSettingsModal({
  isOpen,
  theme,
  fontSize,
  lineHeight,
  isPersian = false,
  onThemeChange,
  onFontSizeChange,
  onLineHeightChange,
  onClose,
}: ReaderSettingsModalProps) {
  if (!isOpen) return null;

  const themes: Array<{ id: ReaderTheme; nameEn: string; nameFa: string; bg: string; border: string }> = [
    { id: 'charcoal', nameEn: 'Charcoal', nameFa: 'زغالی کلاسیک', bg: '#0d0e14', border: '#27272a' },
    { id: 'oled', nameEn: 'OLED Void', nameFa: 'مشکی مطلق', bg: '#050608', border: '#18181b' },
    { id: 'sepia', nameEn: 'Warm Sepia', nameFa: 'کاغذ پوستین', bg: '#18130e', border: '#3f2e21' },
    { id: 'midnight', nameEn: 'Midnight', nameFa: 'نیمه‌شب مخملی', bg: '#090d1a', border: '#1e293b' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#11121d] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <span className="text-xs font-bold text-zinc-300 flex items-center gap-2 uppercase tracking-wider">
            <Palette className="w-4 h-4 text-amber-400" />
            {isPersian ? 'تنظیمات ظاهر رمان' : 'Reading Atmosphere'}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Themes Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            {isPersian ? 'پوسته پس‌زمینه' : 'Background Theme'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                style={{ backgroundColor: t.bg, borderColor: theme === t.id ? '#f59e0b' : t.border }}
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                  theme === t.id ? 'ring-2 ring-amber-500/40 font-bold text-amber-300' : 'text-zinc-400'
                }`}
              >
                <span>{isPersian ? t.nameFa : t.nameEn}</span>
                <span
                  className="w-3 h-3 rounded-full border border-zinc-700"
                  style={{ backgroundColor: t.bg }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Font Size Scaling */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            {isPersian ? 'اندازه قلم' : 'Font Scale'}
          </label>
          <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
            {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => onFontSizeChange(size)}
                className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  fontSize === size
                    ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {size === 'sm' ? 'A-' : size === 'base' ? 'A' : size === 'lg' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>
        </div>

        {/* Line Height Spacing */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
            <AlignLeft className="w-3.5 h-3.5" />
            {isPersian ? 'فاصله خطوط' : 'Line Spacing'}
          </label>
          <div className="grid grid-cols-3 gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
            {(['normal', 'relaxed', 'loose'] as LineHeight[]).map((lh) => (
              <button
                key={lh}
                onClick={() => onLineHeightChange(lh)}
                className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                  lineHeight === lh
                    ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {lh === 'normal'
                  ? isPersian
                    ? 'فشرده'
                    : 'Compact'
                  : lh === 'relaxed'
                  ? isPersian
                    ? 'استاندارد'
                    : 'Standard'
                  : isPersian
                  ? 'باز'
                  : 'Relaxed'}
              </button>
            ))}
          </div>
        </div>

        {/* Apply & Close */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
        >
          {isPersian ? 'بستن' : 'Done'}
        </button>
      </div>
    </div>
  );
}
