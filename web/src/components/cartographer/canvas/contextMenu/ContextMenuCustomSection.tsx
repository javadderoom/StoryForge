'use client';

import React, { useState } from 'react';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuCustomSectionProps {
  isPersian: boolean;
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuCustomSection: React.FC<ContextMenuCustomSectionProps> = ({
  isPersian,
  onBack,
  onGenerate,
}) => {
  const [customPrompt, setCustomPrompt] = useState<string>('');

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
          {isPersian ? '✍️ دستور و ایده سفارشی' : '✍️ Custom Prompt'}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] font-medium">
          {isPersian
            ? 'مایلید چه چیزی در این نقطه پدید آید؟'
            : 'What would you like to spawn here?'}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={
            isPersian
              ? 'مثلاً: سوسک اسکلتی غول‌پیکر از جنس ابسیدین که طوفان‌های شن را می‌بلعد...'
              : 'e.g. A colossal obsidian scarab that burrows under sand dunes...'
          }
          rows={3}
          className="w-full bg-[#241c16] border border-[#3d2f23] rounded-lg p-2 text-xs text-[#eedec8] placeholder:text-[#6e5d4e] focus:border-[#d8ab6c] outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          disabled={!customPrompt.trim()}
          onClick={() =>
            void onGenerate('beast', {
              customPrompt,
              dangerLevel: 3,
            })
          }
          className="py-1.5 bg-[#3b2d20] hover:bg-[#4a3928] disabled:opacity-50 text-[#eedec8] font-medium rounded-lg text-center transition-colors"
        >
          {isPersian ? '🐉 به عنوان جانور' : '🐉 As Beast'}
        </button>
        <button
          type="button"
          disabled={!customPrompt.trim()}
          onClick={() =>
            void onGenerate('story_event', {
              customPrompt,
              category: 'Custom Event',
            })
          }
          className="py-1.5 bg-[#3b2d20] hover:bg-[#4a3928] disabled:opacity-50 text-[#eedec8] font-medium rounded-lg text-center transition-colors"
        >
          {isPersian ? '⚔️ به عنوان رویداد' : '⚔️ As Encounter'}
        </button>
      </div>
    </div>
  );
};
