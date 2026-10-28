'use client';

import React, { useState } from 'react';
import { Sparkles, Dice5 } from 'lucide-react';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuBeastSectionProps {
  isPersian: boolean;
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuBeastSection: React.FC<ContextMenuBeastSectionProps> = ({
  isPersian,
  onBack,
  onGenerate,
}) => {
  const [beastDanger, setBeastDanger] = useState<number>(3);
  const [beastDc, setBeastDc] = useState<number>(15);
  const [beastRole, setBeastRole] = useState<string>('Apex Predator');
  const [beastRarity, setBeastRarity] = useState<'common' | 'uncommon' | 'rare' | 'legendary'>('rare');

  const triggerGenerate = () => {
    void onGenerate('beast', {
      dangerLevel: beastDanger,
      dc: beastDc,
      role: beastRole,
      rarity: beastRarity,
    });
  };

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
          {isPersian ? '🐉 تنظیمات جانور و هیولا' : '🐉 Beast Configuration'}
        </div>
      </div>

      {/* Danger Level */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'سطح خطر:' : 'Danger Level:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            {beastDanger}/5
          </span>
        </label>
        <div className="grid grid-cols-5 gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => {
                setBeastDanger(lvl);
                if (lvl === 5) {
                  setBeastRarity('legendary');
                  if (beastDc < 20) setBeastDc(22);
                  setBeastRole('Ancient Calamity');
                } else if (lvl === 4) {
                  if (beastRarity === 'common') setBeastRarity('rare');
                  if (beastDc < 16) setBeastDc(18);
                } else if (lvl === 1) {
                  setBeastRarity('common');
                  setBeastDc(10);
                  setBeastRole('Docile Herbivore');
                }
              }}
              className={`py-1 rounded text-center font-bold text-[11px] border transition-colors ${
                beastDanger === lvl
                  ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Rarity & Abundance */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'سطح فراوانی و کمیابی:' : 'Rarity & Abundance:'}</span>
          <span className="text-[#baa48d] text-[10px] font-medium">
            {beastRarity === 'legendary'
              ? isPersian ? 'افسانه‌ای / فاجعه‌بار' : 'Mythic Calamity'
              : beastRarity === 'rare'
              ? isPersian ? 'کمیاب و درنده' : 'Rare Apex'
              : beastRarity === 'uncommon'
              ? isPersian ? 'نامتداول' : 'Uncommon'
              : isPersian ? 'رایج' : 'Common'}
          </span>
        </label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: 'common' as const, en: 'Common', fa: 'رایج' },
            { id: 'uncommon' as const, en: 'Uncommon', fa: 'نامتداول' },
            { id: 'rare' as const, en: 'Rare', fa: 'کمیاب' },
            { id: 'legendary' as const, en: 'Legendary', fa: 'افسانه‌ای' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setBeastRarity(r.id)}
              className={`py-1 rounded text-center text-[10px] border transition-colors ${
                beastRarity === r.id
                  ? 'bg-[#d8ab6c] text-[#1a1410] font-bold border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {isPersian ? r.fa : r.en}
            </button>
          ))}
        </div>
      </div>

      {/* Encounter DC */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'درجه سختی چالش (DC):' : 'Challenge DC:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            DC {beastDc}
          </span>
        </label>
        <div className="grid grid-cols-7 gap-1" dir="ltr">
          {[10, 12, 14, 16, 18, 20, 22].map((dc) => (
            <button
              key={dc}
              type="button"
              onClick={() => setBeastDc(dc)}
              className={`py-1 rounded text-center font-semibold text-[10px] border transition-colors ${
                beastDc === dc
                  ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {dc}
            </button>
          ))}
        </div>
      </div>

      {/* Ecological Role */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
          {isPersian ? 'نقش در بوم‌سازگان (اکوسیستم)' : 'Ecological Niche'}
        </label>
        <select
          value={beastRole}
          onChange={(e) => setBeastRole(e.target.value)}
          className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
        >
          <option value="Apex Predator">
            {isPersian ? 'شکارچی راس هرم غذایی' : 'Apex Predator'}
          </option>
          <option value="Ancient Calamity">
            {isPersian ? 'بلای باستانی / لویاتان دست‌نیافتنی' : 'Ancient Calamity / Unapproachable Titan'}
          </option>
          <option value="Pack Hunter">
            {isPersian ? 'شکارچی گروهی و گله‌ای' : 'Pack Hunter'}
          </option>
          <option value="Ambush Lurker">
            {isPersian ? 'کمین‌کننده پنهان در شن / شاخسار' : 'Ambush Lurker'}
          </option>
          <option value="Subterranean Burrower">
            {isPersian ? 'موجود نقب‌زن زیرزمینی' : 'Subterranean Burrower'}
          </option>
          <option value="Venomous Stalker">
            {isPersian ? 'ردیاب زهرآگین' : 'Venomous Stalker'}
          </option>
          <option value="Docile Herbivore">
            {isPersian ? 'گیاه‌خوار آرام / رام‌شدنی' : 'Docile Herbivore'}
          </option>
        </select>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-1.5 pt-1">
        <button
          type="button"
          onClick={triggerGenerate}
          className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isPersian ? 'تولید جانور سازگار با اقلیم' : 'Generate Adapted Beast'}</span>
        </button>

        <button
          type="button"
          onClick={triggerGenerate}
          className="w-full py-1 bg-[#2e231a] hover:bg-[#3d2f23] text-[#baa48d] hover:text-[#eedec8] font-medium rounded-lg flex items-center justify-center gap-1.5 text-[11px] border border-[#4a392a] transition-colors"
        >
          <Dice5 className="w-3.5 h-3.5 text-[#d8ab6c]" />
          <span>{isPersian ? '🎲 زایش آنی هیولای غافلگیرکننده' : '🎲 Instant Surprise Beast'}</span>
        </button>
      </div>
    </div>
  );
};
