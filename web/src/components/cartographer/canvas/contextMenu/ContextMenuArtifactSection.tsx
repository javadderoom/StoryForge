'use client';

import React, { useState } from 'react';
import { Sparkle } from 'lucide-react';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuArtifactSectionProps {
  isPersian: boolean;
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuArtifactSection: React.FC<ContextMenuArtifactSectionProps> = ({
  isPersian,
  onBack,
  onGenerate,
}) => {
  const [artifactRarity, setArtifactRarity] = useState<string>('rare');
  const [artifactDc, setArtifactDc] = useState<number>(16);

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
          {isPersian ? '✨ یادگار و دست‌سازه کهن' : '✨ Relic & Artifact'}
        </div>
      </div>

      {/* Rarity */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
          {isPersian ? 'مرتبه کمیابی' : 'Rarity Tier'}
        </label>
        <select
          value={artifactRarity}
          onChange={(e) => setArtifactRarity(e.target.value)}
          className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
        >
          <option value="uncommon">{isPersian ? 'نامتداول (Uncommon)' : 'Uncommon'}</option>
          <option value="rare">{isPersian ? 'کمیاب (Rare)' : 'Rare'}</option>
          <option value="epic">{isPersian ? 'حماسی (Epic)' : 'Epic'}</option>
          <option value="legendary">{isPersian ? 'افسانه‌ای (Legendary)' : 'Legendary'}</option>
          <option value="mythic">{isPersian ? 'اسطوره‌ای (Mythic)' : 'Mythic'}</option>
        </select>
      </div>

      {/* Attunement DC */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'درجه سختی رام‌کردن/کشف (DC):' : 'Attunement DC:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            \u200EDC {artifactDc}
          </span>
        </label>
        <div className="grid grid-cols-5 gap-1" dir="ltr">
          {[12, 14, 16, 18, 20].map((dc) => (
            <button
              key={dc}
              type="button"
              onClick={() => setArtifactDc(dc)}
              className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                artifactDc === dc
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
            void onGenerate('artifact', {
              rarity: artifactRarity,
              dc: artifactDc,
            })
          }
          className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <Sparkle className="w-3.5 h-3.5" />
          <span>{isPersian ? 'تولید دست‌سازه باستانی' : 'Generate Buried Relic'}</span>
        </button>
      </div>
    </div>
  );
};
