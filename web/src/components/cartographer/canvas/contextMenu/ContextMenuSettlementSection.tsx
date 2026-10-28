'use client';

import React, { useState } from 'react';
import { Castle } from 'lucide-react';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuSettlementSectionProps {
  isPersian: boolean;
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuSettlementSection: React.FC<ContextMenuSettlementSectionProps> = ({
  isPersian,
  onBack,
  onGenerate,
}) => {
  const [settlementCategory, setSettlementCategory] = useState<string>('oasis_camp');
  const [settlementDanger, setSettlementDanger] = useState<number>(2);

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
          {isPersian ? '🏰 سکونتگاه و پایگاه' : '🏰 Frontier Settlement'}
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
          {isPersian ? 'نوع سکونتگاه' : 'Settlement Type'}
        </label>
        <select
          value={settlementCategory}
          onChange={(e) => setSettlementCategory(e.target.value)}
          className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
        >
          <option value="oasis_camp">
            {isPersian ? 'اردوگاه واحه / پناهگاه کاروان' : 'Oasis Camp / Caravan Haven'}
          </option>
          <option value="watchtower">
            {isPersian ? 'برج دیده‌بانی مرزی' : 'Border Watchtower'}
          </option>
          <option value="caravanserai">
            {isPersian ? 'کاروانسرای حصین' : 'Walled Caravanserai'}
          </option>
          <option value="mining_post">
            {isPersian ? 'پایگاه معدن‌کاوی' : 'Mining Outpost / Quarry'}
          </option>
          <option value="fortified_citadel">
            {isPersian ? 'دژ و باروی استوار' : 'Fortified Citadel'}
          </option>
        </select>
      </div>

      {/* Danger Level */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'سطح خطر محیط:' : 'Danger Level:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            {settlementDanger}/5
          </span>
        </label>
        <div className="grid grid-cols-5 gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSettlementDanger(lvl)}
              className={`py-1 rounded text-center font-bold text-[11px] border transition-colors ${
                settlementDanger === lvl
                  ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() =>
            void onGenerate('settlement', {
              category: settlementCategory,
              dangerLevel: settlementDanger,
            })
          }
          className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <Castle className="w-3.5 h-3.5" />
          <span>{isPersian ? 'بنیان‌گذاری سکونتگاه' : 'Establish Settlement'}</span>
        </button>
      </div>
    </div>
  );
};
