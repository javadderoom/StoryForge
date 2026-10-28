'use client';

import React, { useState } from 'react';
import { Swords } from 'lucide-react';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuEventSectionProps {
  isPersian: boolean;
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuEventSection: React.FC<ContextMenuEventSectionProps> = ({
  isPersian,
  onBack,
  onGenerate,
}) => {
  const [eventCategory, setEventCategory] = useState<string>('Ambush & Hazard');
  const [eventDc, setEventDc] = useState<number>(15);

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
        <button
          type="button"
          onClick={onBack}
          className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
        >
          {isPersian ? 'بازگشت →' : '← Back'}
        </button>
        <div className="font-semibold text-[#f1d6b0]">
          {isPersian ? '⚔️ تنظیمات رویداد و رویارویی' : '⚔️ Story Encounter'}
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
          {isPersian ? 'نوع رویارویی' : 'Encounter Type'}
        </label>
        <select
          value={eventCategory}
          onChange={(e) => setEventCategory(e.target.value)}
          className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
        >
          <option value="Ambush & Threat">
            {isPersian ? 'شبیخون و تهدید رزمی' : 'Ambush & Combat Threat'}
          </option>
          <option value="Ancient Mystery">
            {isPersian ? 'معمای زمین‌شناختی کهن' : 'Ancient Geological Mystery'}
          </option>
          <option value="Moral Dilemma">
            {isPersian ? 'دوراهی اخلاقی / یاران درمانده' : 'Moral Dilemma / Stranded Party'}
          </option>
          <option value="Arcane Ritual">
            {isPersian ? 'آیین کهن / فوران جادو' : 'Arcane Ritual / Ley Flare'}
          </option>
          <option value="Forgotten Ruins">
            {isPersian ? 'خرابه‌های فراموش‌شده و تله' : 'Forgotten Ruins & Trap'}
          </option>
          <option value="Environmental Hazard">
            {isPersian ? 'خطر طبیعی و گودال فرونشست' : 'Environmental Hazard & Sinkhole'}
          </option>
        </select>
      </div>

      {/* Challenge DC */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'درجه سختی رفع بحران (DC):' : 'Resolution DC:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            \u200EDC {eventDc}
          </span>
        </label>
        <div className="grid grid-cols-6 gap-1" dir="ltr">
          {[10, 12, 14, 16, 18, 20].map((dc) => (
            <button
              key={dc}
              type="button"
              onClick={() => setEventDc(dc)}
              className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                eventDc === dc
                  ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {dc}
            </button>
          ))}
        </div>
      </div>

      {/* Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() =>
            void onGenerate('story_event', {
              category: eventCategory,
              dc: eventDc,
            })
          }
          className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <Swords className="w-3.5 h-3.5" />
          <span>{isPersian ? 'ترسیم سنجاق رویداد' : 'Generate Encounter Pin'}</span>
        </button>
      </div>
    </div>
  );
};
