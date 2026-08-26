'use client';

import React, { useEffect } from 'react';
import { ThreeD20Dice } from './ThreeD20Dice';
import { DiceResolution } from '@/lib/play/rpgEngine';
import { formatStatName } from '@/lib/play/rpgEngine';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { audioService } from '@/lib/play/audioService';

interface DiceRollModalProps {
  isOpen: boolean;
  resolution: DiceResolution | null;
  actionText: string;
  isPersian?: boolean;
  isRolling?: boolean;
  /** Inspect mode: no pending turn to reveal, so "Continue" just closes. */
  inspectMode?: boolean;
  onContinue: () => void;
  onClose: () => void;
}

function outcomeColor(outcome?: string): string {
  switch (outcome) {
    case 'critical_success':
      return '#10B981';
    case 'success':
      return '#14B8A6';
    case 'mixed_success':
      return '#F59E0B';
    case 'critical_failure':
      return '#DC2626';
    default:
      return '#F43F5E';
  }
}

function outcomeLabel(outcome: string, isPersian: boolean): string {
  if (isPersian) {
    switch (outcome) {
      case 'critical_success':
        return 'پیروزی چشمگیر';
      case 'success':
        return 'موفقیت‌آمیز';
      case 'mixed_success':
        return 'موفقیت نسبی';
      case 'critical_failure':
        return 'شکست فاجعه‌بار';
      default:
        return 'شکست در بررسی';
    }
  }
  switch (outcome) {
    case 'critical_success':
      return 'CRITICAL SUCCESS';
    case 'success':
      return 'SUCCESS';
    case 'mixed_success':
      return 'MIXED SUCCESS';
    case 'critical_failure':
      return 'CRITICAL FAILURE';
    default:
      return 'FAILURE';
  }
}

const CONSEQUENCE_FA: Record<string, string> = {
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

export function DiceRollModal({
  isOpen,
  resolution,
  actionText,
  isPersian = false,
  isRolling = false,
  inspectMode = false,
  onContinue,
  onClose,
}: DiceRollModalProps) {
  // Play settle sfx once the roll resolves.
  useEffect(() => {
    if (!isOpen || isRolling || !resolution) return;
    audioService.playSfx(resolution.outcome.includes('success') ? 'diceSuccess' : 'diceFail');
  }, [isOpen, isRolling, resolution]);

  if (!isOpen) return null;

  const color = outcomeColor(resolution?.outcome);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-6"
        style={{
          backgroundColor: '#10121D',
          borderColor: isRolling ? 'rgba(245,158,11,0.25)' : `${color}99`,
          boxShadow: `0 0 40px -8px ${isRolling ? 'rgba(245,158,11,0.15)' : `${color}55`}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center text-xs font-bold uppercase tracking-[1.2px]" style={{ color: '#F59E0B' }}>
          {isPersian ? 'پرتاب تاس و بررسی مهارت' : 'D20 SKILL CHECK'}
        </div>
        <p className="mt-2 text-center text-xs italic text-zinc-300" dir="auto">
          &ldquo;{actionText}&rdquo;
        </p>

        <div className="my-4 flex justify-center">
          <ThreeD20Dice
            resultNumber={resolution?.d20 ?? 10}
            isRolling={isRolling}
            size={160}
            onRollComplete={() => {}}
          />
        </div>

        {isRolling && (
          <p className="text-center text-xs font-bold" style={{ color: '#F59E0B' }}>
            {isPersian ? 'تاس در حال چرخش...' : 'Rolling D20...'}
          </p>
        )}

        {!isRolling && resolution && (
          <div dir="ltr">
            {/* Equation breakdown */}
            <div
              className="flex items-center justify-around rounded-2xl border px-4 py-3"
              style={{ backgroundColor: '#181926', borderColor: '#27272A' }}
            >
              <StatBox label={isPersian ? 'تاس' : 'Roll'} value={toPersianDigits(resolution.d20, isPersian)} />
              <span className="font-bold text-zinc-500">+</span>
              <StatBox
                label={formatStatName(resolution.requiredStat ?? '', isPersian)}
                value={`${resolution.statModifier >= 0 ? '+' : ''}${toPersianDigits(resolution.statModifier, isPersian)}`}
                color="#60A5FA"
              />
              <span className="font-bold text-zinc-500">=</span>
              <StatBox label={isPersian ? 'مجموع' : 'Total'} value={toPersianDigits(resolution.total, isPersian)} color="#F59E0B" />
              <span className="text-[11px] text-zinc-500">vs</span>
              <StatBox label={isPersian ? 'دشواری' : 'DC'} value={toPersianDigits(resolution.difficultyClass, isPersian)} />
            </div>

            <div
              className="mt-3 rounded-2xl border px-3 py-2.5 text-center"
              style={{ backgroundColor: `${color}26`, borderColor: `${color}80` }}
            >
              <div className="text-sm font-bold" style={{ color }}>
                {outcomeLabel(resolution.outcome, isPersian)}
              </div>
              <p className="mt-1 text-[11px] text-zinc-300">
                {isPersian ? CONSEQUENCE_FA[resolution.consequenceSummary] ?? resolution.consequenceSummary : resolution.consequenceSummary}
              </p>
            </div>

            <button
              onClick={onContinue}
              className="mt-4 w-full rounded-2xl py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01]"
              style={{ backgroundColor: '#F59E0B' }}
            >
              {inspectMode
                ? isPersian
                  ? 'بستن'
                  : 'Close'
                : isPersian
                  ? 'ادامه ماجراجویی'
                  : 'Continue Narrative'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = '#fff' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="font-bold" style={{ color, fontFamily: 'ui-monospace, monospace' }}>
        {value}
      </span>
    </div>
  );
}
