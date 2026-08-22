'use client';

import React, { useState, useEffect } from 'react';
import { Dices, ArrowRight, Sparkles } from 'lucide-react';
import { CheckResolution } from '@/lib/types/gameplay';
import { ThreeD20Dice } from './ThreeD20Dice';

interface DiceRollModalProps {
  isOpen: boolean;
  resolution: CheckResolution | null;
  actionText: string;
  isPersian?: boolean;
  onClose: () => void;
}

function getPersianSummary(summary: string, outcome: string): string {
  const map: Record<string, string> = {
    'Disaster strikes: complete failure with severe complications or damage.':
      'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.',
    'Flawless execution: effortless success with bonus insight or tactical advantage.':
      'اجرای بی‌نقص: موفقیت چشمگیر همراه با بینش تاکتیکی و برتری کامل.',
    'Decisive victory: achieved the objective with exceptional style and advantage.':
      'پیروزی قاطع: دستیابی به هدف با مهارت و برتری استثنایی.',
    'Clear success: objective accomplished as intended.':
      'موفقیت آشکار: هدف دقیقاً مطابق انتظار محقق شد.',
    'Mixed success: goal achieved, but with cost, minor injury, or alert raised.':
      'موفقیت نسبی: هدف حاصل شد، اما با پرداخت بها، جراحت جزئی یا جلب توجه.',
    'The attempt failed: unexpected obstacle arose or opportunity lost.':
      'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.',
  };

  if (map[summary]) return map[summary];

  const fallbackByOutcome: Record<string, string> = {
    critical_success: 'پیروزی چشمگیر: دستیابی به هدف با برتری کامل.',
    success: 'موفقیت‌آمیز: هدف مورد نظر با موفقیت انجام شد.',
    mixed_success: 'موفقیت نسبی: هدف حاصل شد اما با هزینه و چالش همراه بود.',
    failure: 'شکست در اقدام: مانعی بر سر راه قرار گرفت.',
    critical_failure: 'شکست فاجعه‌بار: پیامد ناگوار و خسارت رخ داد.',
  };

  return fallbackByOutcome[outcome] || summary;
}

const RESOURCE_LABELS_FA: Record<string, string> = {
  hp: 'سلامت',
  stamina: 'استقامت',
  mana: 'مانا',
  gold: 'طلا',
};

export function DiceRollModal({
  isOpen,
  resolution,
  actionText,
  isPersian = false,
  onClose,
}: DiceRollModalProps) {
  const [completedResolution, setCompletedResolution] = useState<CheckResolution | null>(null);

  // Synchronously compute roll state from active resolution identity
  const hasSettled = isOpen && resolution !== null && completedResolution === resolution;
  const isRolling = isOpen && resolution !== null && !hasSettled;

  // Derive completed/rolling resolution state from the active resolution + open state.
  // Intentional setState-in-effect: cleared on close and committed after a timed
  // roll animation keyed to the `resolution` identity (not every commit).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen || !resolution) {
      setCompletedResolution(null);
      return;
    }

    const timer = setTimeout(() => {
      setCompletedResolution(resolution);
    }, 1400);

    return () => clearTimeout(timer);
  }, [isOpen, resolution]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen || !resolution) return null;

  const outcomeColors: Record<
    string,
    { border: string; bg: string; text: string; glow: string; labelFa: string; labelEn: string }
  > = {
    critical_success: {
      border: 'border-emerald-500/80',
      bg: 'bg-emerald-500/10 shadow-emerald-500/30',
      text: 'text-emerald-400',
      glow: 'shadow-[0_0_50px_rgba(16,185,129,0.4)]',
      labelFa: 'پیروزی چشمگیر',
      labelEn: 'CRITICAL SUCCESS',
    },
    success: {
      border: 'border-teal-500/80',
      bg: 'bg-teal-500/10 shadow-teal-500/20',
      text: 'text-teal-400',
      glow: 'shadow-[0_0_35px_rgba(20,184,166,0.3)]',
      labelFa: 'موفقیت‌آمیز',
      labelEn: 'SUCCESS',
    },
    mixed_success: {
      border: 'border-amber-500/80',
      bg: 'bg-amber-500/10 shadow-amber-500/20',
      text: 'text-amber-400',
      glow: 'shadow-[0_0_35px_rgba(245,158,11,0.3)]',
      labelFa: 'موفقیت نسبی',
      labelEn: 'MIXED SUCCESS (WITH COST)',
    },
    failure: {
      border: 'border-rose-500/80',
      bg: 'bg-rose-500/10 shadow-rose-500/20',
      text: 'text-rose-400',
      glow: 'shadow-[0_0_35px_rgba(244,63,94,0.3)]',
      labelFa: 'شکست در بررسی',
      labelEn: 'FAILURE',
    },
    critical_failure: {
      border: 'border-red-600',
      bg: 'bg-red-600/15 shadow-red-600/40',
      text: 'text-red-400',
      glow: 'shadow-[0_0_60px_rgba(220,38,38,0.5)]',
      labelFa: 'شکست فاجعه‌بار',
      labelEn: 'CRITICAL FAILURE',
    },
  };

  const outcomeStyle = outcomeColors[resolution.outcome] || outcomeColors.success;
  const isNat20 = resolution.diceRoll === 20;
  const isNat1 = resolution.diceRoll === 1;

  return (
    <div dir={isPersian ? 'rtl' : 'ltr'} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md bg-[#10121d] border-2 rounded-3xl p-6 shadow-2xl transition-all duration-500 transform scale-100 relative overflow-hidden ${hasSettled
          ? `${outcomeStyle.border} ${outcomeStyle.bg} ${outcomeStyle.glow}`
          : 'border-zinc-800/90 shadow-[0_0_40px_rgba(245,158,11,0.06)]'
          }`}
      >
        {/* Glow ambient background effect */}
        <div
          className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${hasSettled
            ? outcomeStyle.bg
            : 'bg-amber-500/5'
            }`}
        />

        {/* Action Title */}
        <div className="text-center space-y-1 mb-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Dices className="w-4 h-4 text-amber-400" />
            {isPersian ? 'پرتاب تاس و بررسی مهارت' : 'D20 Skill Check Resolution'}
          </span>
          <p className="text-xs text-zinc-300 font-medium line-clamp-1 italic px-4">
            "{actionText}"
          </p>
        </div>

        {/* Real D20 Die Container */}
        <div className="flex flex-col items-center justify-center my-2">
          <ThreeD20Dice
            resultNumber={resolution.diceRoll}
            isRolling={isRolling}
            onRollComplete={() => setCompletedResolution(resolution)}
            size={220}
          />

          <span className="text-[11px] text-zinc-400 -mt-2 font-mono flex items-center gap-1">
            {!hasSettled ? (
              <>
                <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                <span>{isPersian ? 'تاس در حال چرخش...' : 'Rolling D20...'}</span>
              </>
            ) : isNat20 ? (
              <span className="text-emerald-400 font-bold">
                {isPersian ? '✨ بیست طبیعی! پیروزی درخشان ✨' : '✨ NATURAL 20! ✨'}
              </span>
            ) : isNat1 ? (
              <span className="text-red-400 font-bold">
                {isPersian ? '💀 شکست فاجعه‌بار 💀' : '💀 CRITICAL FAILURE 💀'}
              </span>
            ) : (
              <span>
                {isPersian ? 'تاس طبیعی' : 'Natural Roll'}: <strong>{resolution.diceRoll}</strong>
              </span>
            )}
          </span>
        </div>

        {/* Breakdown Equation */}
        {hasSettled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 flex items-center justify-around text-xs font-mono text-center">
              <div>
                <div className="text-zinc-400 text-[10px]">{isPersian ? 'تاس' : 'Roll'}</div>
                <div className="text-zinc-100 font-bold text-sm">{resolution.diceRoll}</div>
              </div>
              <span className="text-zinc-500 font-bold">+</span>
              <div>
                <div className="text-zinc-400 text-[10px]">{isPersian ? 'اصلاحگر' : 'Modifier'}</div>
                <div className="text-zinc-100 font-bold text-sm">
                  {resolution.statModifier >= 0 ? `+${resolution.statModifier}` : resolution.statModifier}
                </div>
              </div>
              <span className="text-zinc-500 font-bold">=</span>
              <div>
                <div className="text-amber-400 text-[10px]">{isPersian ? 'مجموع' : 'Total'}</div>
                <div className="text-amber-400 font-bold text-sm">{resolution.totalScore}</div>
              </div>
              <span className="text-zinc-500 font-bold">vs</span>
              <div>
                <div className="text-zinc-400 text-[10px]">{isPersian ? 'دشواری (DC)' : 'Target DC'}</div>
                <div className="text-zinc-100 font-bold text-sm">{resolution.difficultyClass}</div>
              </div>
            </div>

            {/* Outcome Badge */}
            <div
              className={`p-3 rounded-xl border ${outcomeStyle.border} ${outcomeStyle.bg} text-center space-y-1`}
            >
              <div className={`font-black text-xs uppercase tracking-wider ${outcomeStyle.text}`}>
                {isPersian ? outcomeStyle.labelFa : outcomeStyle.labelEn}
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {isPersian
                  ? getPersianSummary(resolution.consequenceSummary, resolution.outcome)
                  : resolution.consequenceSummary}
              </p>
            </div>

            {/* State Diffs (Damage / Rewards) */}
            {resolution.stateDiff && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {resolution.stateDiff.resourceChanges &&
                  Object.entries(resolution.stateDiff.resourceChanges).map(([k, v]) => {
                    const num = Number(v);
                    const label = isPersian ? (RESOURCE_LABELS_FA[k.toLowerCase()] || k.toUpperCase()) : k.toUpperCase();
                    return (
                      <span
                        key={k}
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${num < 0
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                      >
                        {label}: {num > 0 ? `+${num}` : num}
                      </span>
                    );
                  })}
                {resolution.stateDiff.itemsAdded?.map((item) => (
                  <span
                    key={item.id}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300"
                  >
                    +{item.name}
                  </span>
                ))}
              </div>
            )}

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-500 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <span>{isPersian ? 'ادامه ماجراجویی' : 'Continue Narrative'}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isPersian ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
