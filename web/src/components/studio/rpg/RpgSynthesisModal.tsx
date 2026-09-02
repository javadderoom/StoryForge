'use client';

import React from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { ThemeRpgSystemPayload } from '@/lib/types/world';

interface RpgSynthesisModalProps {
  preview: ThemeRpgSystemPayload | null;
  isPersian: boolean;
  onClose: () => void;
  onCommit: () => void;
}

export function RpgSynthesisModal({
  preview,
  isPersian,
  onClose,
  onCommit,
}: RpgSynthesisModalProps) {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            {isPersian
              ? 'پیش‌نمایش سیستم نقش‌آفرینی بر اساس تم جهان'
              : 'Theme-Tailored RPG System Preview'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Justification */}
        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
          <span className="text-amber-400 font-bold block text-[11px]">
            📜 {isPersian ? 'فلسفه و تطابق با تم داستان:' : 'Theme Justification & Rationale:'}
          </span>
          <p className="text-zinc-300 leading-relaxed italic">{preview.themeJustification}</p>
        </div>

        {/* Stats Preview */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-amber-400 block">
            ⚔️ {isPersian ? 'ویژگی‌های اصلی شخصیت (Attributes):' : 'Core Attributes:'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {preview.stats.map((st, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-zinc-100">{isPersian ? st.nameFa : st.nameEn}</strong>
                  <span className="text-amber-400 font-mono text-[10px]" dir="ltr">
                    Base: {st.defaultValue}
                  </span>
                </div>
                <p className="text-zinc-400 text-[10.5px]">{st.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Resources Preview */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <span className="text-xs font-bold text-red-400 block">
            ❤️ {isPersian ? 'منابع و ذخایر حیاتی (Resource Pools):' : 'Vital Resource Pools:'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {preview.resources.map((res, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-zinc-100">{isPersian ? res.nameFa : res.nameEn}</strong>
                  <span className="text-red-400 font-mono text-[10px]" dir="ltr">
                    Max: {res.maxValue}
                  </span>
                </div>
                {res.decayRule && (
                  <p className="text-zinc-400 text-[10.5px] italic">⚠️ {res.decayRule}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Archetypes Preview */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <span className="text-xs font-bold text-purple-400 block">
            👑 {isPersian ? 'کلاس‌ها و کهن‌الگوهای آغازین:' : 'Starting Class Archetypes:'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {preview.archetypes.map((arch, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1"
              >
                <strong className="text-purple-300 block">{arch.name}</strong>
                <p className="text-zinc-400 text-[10.5px]">{arch.description}</p>
                <div className="text-[10px] text-amber-300/90 font-mono">
                  ⭐ {arch.signaturePerk}
                </div>
                <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-900">
                  {arch.startingInventory.map((it, iIdx) => (
                    <span
                      key={iIdx}
                      className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[9.5px]"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
          >
            {isPersian ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onCommit}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isPersian ? '📥 اعمال سیستم RPG به داستان' : '📥 Apply RPG System'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
