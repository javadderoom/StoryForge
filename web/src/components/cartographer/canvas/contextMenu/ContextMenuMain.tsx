'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PenTool,
  Sparkles,
} from 'lucide-react';
import type { EnvironmentalContext } from '@/lib/engines/world/environmentalContext';
import type { MenuSection } from './types';

interface ContextMenuMainProps {
  isPersian: boolean;
  worldPoint: { x: number; y: number };
  environmentalContext: EnvironmentalContext;
  setActiveSection: (section: MenuSection) => void;
  onAskOracle?: (coord: { x: number; y: number }, envContext: EnvironmentalContext) => void;
  onClose: () => void;
}

export const ContextMenuMain: React.FC<ContextMenuMainProps> = ({
  isPersian,
  worldPoint,
  environmentalContext,
  setActiveSection,
  onAskOracle,
  onClose,
}) => {
  const ArrowIcon = isPersian ? ChevronLeft : ChevronRight;

  return (
    <>
      <div className="text-[10px] font-semibold text-[#8e7a68] uppercase tracking-wider px-2 py-0.5">
        {isPersian ? 'تولید هوشمند روی نقشه (دیپ‌سیک)' : 'AI In-Map Generation (DeepSeek)'}
      </div>

      {/* Beasts Submenu Entry */}
      <button
        type="button"
        onClick={() => setActiveSection('beast')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🐉</span>
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'هیولا و جانور وحشی' : 'Beast & Monster'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'شکارچی سازگار با اقلیم، گله یا جانور وحشی'
                : 'Adapted predator, pack, or wild creature'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      {/* Stationed NPC Submenu Entry */}
      <button
        type="button"
        onClick={() => setActiveSection('npc')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">👤</span>
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'شخصیت مستقر (NPC)' : 'Stationed NPC'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'گوشه‌نشین، کوچ‌نشین، دیده‌بان یا بازرگان'
                : 'Hermit, nomad, scout, or trader'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      {/* Story Event Submenu Entry */}
      <button
        type="button"
        onClick={() => setActiveSection('event')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚔️</span>
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'رویداد داستانی و رویارویی' : 'Story Encounter & Dilemma'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'کمینگاه، پدیده طبیعی یا معمای باستانی'
                : 'Ambush, natural hazard, or ancient mystery'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      {/* Relic & Artifact Submenu Entry */}
      <button
        type="button"
        onClick={() => setActiveSection('artifact')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'عتیقه و یادگار مدفون' : 'Buried Relic & Artifact'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'دست‌سازه کهن، سلاح افسانه‌ای یا گنجینه'
                : 'Enshrined wonder or hidden antiquity'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      {/* Frontier Settlement Submenu Entry */}
      <button
        type="button"
        onClick={() => setActiveSection('settlement')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏰</span>
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'سکونتگاه و پایگاه مرزی' : 'Frontier Settlement'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'اردوگاه واحه، برج دیده‌بانی یا کاروانسرا'
                : 'Oasis camp, watchtower, or haven'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      <div className="my-1 border-t border-[#3d2f23]/70" />

      {/* Custom Prompt */}
      <button
        type="button"
        onClick={() => setActiveSection('custom')}
        className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
      >
        <div className="flex items-center gap-2">
          <PenTool className="w-3.5 h-3.5 text-[#d8ab6c]" />
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'دستور و توصیف دلخواه...' : 'Custom Prompt...'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'توصیف آزاد هر نوع موجود، نشانه یا پدیده'
                : 'Describe any specific creature or landmark'}
            </div>
          </div>
        </div>
        <ArrowIcon className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
      </button>

      {/* Ask Oracle Here */}
      {onAskOracle && (
        <button
          type="button"
          onClick={() => {
            onAskOracle(worldPoint, environmentalContext);
            onClose();
          }}
          className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center gap-2 group transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#d48b4b]" />
          <div>
            <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
              {isPersian ? 'پرسش از هاتف غیب درباره این نقطه' : 'Ask Oracle About This Spot'}
            </div>
            <div className="text-[10px] text-[#9c8774]">
              {isPersian
                ? 'مشورت با هوش جهان همراه با داده‌های اقلیمی'
                : 'Consult world intelligence with local context'}
            </div>
          </div>
        </button>
      )}
    </>
  );
};
