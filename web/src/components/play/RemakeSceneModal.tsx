'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, X, Sparkles, Ghost, Repeat, Swords, BookOpen, HelpCircle } from 'lucide-react';
import type { ContinuityIssueType } from '@/lib/engines/narrative/RemakeValidator';

interface RemakeSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { issueType: ContinuityIssueType; reason: string }) => Promise<void>;
  isPersian?: boolean;
  isSubmitting?: boolean;
  turnNumber: number;
}

interface IssueOption {
  id: ContinuityIssueType;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
  icon: React.ElementType;
}

const ISSUE_OPTIONS: IssueOption[] = [
  {
    id: 'ghost_npc',
    titleFa: 'حضور شخصیت ناممکن',
    titleEn: 'Ghost NPC / Absent Character',
    descFa: 'شخصیتی در صحنه ظاهر شده که در این کاروان، مکان یا گروه همراهان حضور ندارد.',
    descEn: 'An NPC appeared who is not in the current location or party roster.',
    icon: Ghost,
  },
  {
    id: 'repeated_event',
    titleFa: 'تکرار رویداد پیشین',
    titleEn: 'Repeated Event / Amnesia',
    descFa: 'رویداد، کنش یا گفت‌وگویی عیناً مشابه صحنه یا نوبت قبلی تکرار شده است.',
    descEn: 'A dialogue or event from the previous turn was repeated.',
    icon: Repeat,
  },
  {
    id: 'outcome_disconnect',
    titleFa: 'ناهماهنگی توصیف با اقدام',
    titleEn: 'Outcome Disconnect',
    descFa: 'توصیف صحنه با موفقیت یا نتیجهٔ اقدام انجام‌شده همخوانی منطقی ندارد.',
    descEn: 'The scene narrative does not align with the action outcome.',
    icon: Swords,
  },
  {
    id: 'lore_contradiction',
    titleFa: 'تناقض با قوانین جهان',
    titleEn: 'Lore Contradiction',
    descFa: 'اتفاقی رخ داده که با قواعد فیزیکی، جادویی یا تاریخی جهان داستان در تضاد است.',
    descEn: 'An event contradicted world laws, magic systems, or established history.',
    icon: BookOpen,
  },
  {
    id: 'other',
    titleFa: 'ناهماهنگی دیگر',
    titleEn: 'Other Continuity Error',
    descFa: 'خطای تداومی یا اشتباه منطقی دیگری در روایت صحنه رخ داده است.',
    descEn: 'Another narrative inconsistency or hallucination.',
    icon: HelpCircle,
  },
];

export function RemakeSceneModal({
  isOpen,
  onClose,
  onSubmit,
  isPersian = true,
  isSubmitting = false,
  turnNumber,
}: RemakeSceneModalProps) {
  const [selectedIssue, setSelectedIssue] = useState<ContinuityIssueType>('ghost_npc');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMinLength = reason.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isMinLength) {
      setErrorMsg(
        isPersian
          ? 'لطفاً دست‌کم ۱۰ حرف دربارهٔ ناهماهنگی صحنه توضیح دهید.'
          : 'Please provide at least 10 characters explaining the issue.'
      );
      return;
    }

    try {
      await onSubmit({ issueType: selectedIssue, reason: reason.trim() });
    } catch (err: any) {
      setErrorMsg(err.message || (isPersian ? 'خطا در بازسازی صحنه' : 'Failed to remake scene'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" dir={isPersian ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 shadow-2xl shadow-black/80 ring-1 ring-white/10 sm:p-7">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute left-4 top-4 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-start gap-3.5 pr-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-100 sm:text-lg">
                {isPersian ? 'بازسازی صحنه (رفع ناهماهنگی)' : 'Remake Scene (Fix Inconsistency)'}
              </h2>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                {isPersian ? '۱ بار رایگان' : '1x Free'}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              {isPersian
                ? 'اگر این صحنه دچار فراموشی، حضور شخصیت ناممکن یا تناقض با وقایع شده است، گزارش دهید تا مجدداً بازنویسی شود.'
                : 'If this scene contains a continuity defect, absent NPC, or repetition, report it to be rewritten.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Categories */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              {isPersian ? 'نوع ناهماهنگی یا خطای تداوم:' : 'Select Continuity Issue Type:'}
            </label>
            <div className="space-y-2">
              {ISSUE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedIssue === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedIssue(opt.id)}
                    className={`w-full text-right flex items-start gap-3 rounded-xl border p-2.5 text-xs transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/50'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <div className="flex-1">
                      <div className="font-semibold text-zinc-200">
                        {isPersian ? opt.titleFa : opt.titleEn}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {isPersian ? opt.descFa : opt.descEn}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason Textarea */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                {isPersian ? 'توضیح ناهماهنگی:' : 'Explanation of the Inconsistency:'}
              </label>
              <span className={`text-[10px] font-mono ${isMinLength ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {reason.trim().length} / 10 {isPersian ? 'حرف حداقل' : 'chars min'}
              </span>
            </div>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder={
                isPersian
                  ? 'دقیق بنویسید چه چیزی اشتباه است (مثلاً: مازیار همراه ما نیست و در درهٔ سرخ جا مانده بود)...'
                  : 'Specify what went wrong (e.g., Maziar is not with us, he stayed behind in the canyon)...'
              }
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
            />
          </div>

          {/* Canonical Dice Note */}
          <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-[11px] text-zinc-400">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              {isPersian
                ? 'پیامد تاس و میزان آسیب در این اقدام قطعی است؛ بازسازی صحنه فقط نقص‌های روایی و عدم تداوم را برطرف می‌کند.'
                : 'Mechanical rolls and damage are canonical. Remake rewrites the prose and resolves continuity errors.'}
            </span>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
            >
              {isPersian ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!isMinLength || isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-amber-400 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  <span>{isPersian ? 'در حال بازنویسی صحنه...' : 'Remaking scene...'}</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isPersian ? 'بازنویسی و اصلاح صحنه' : 'Remake Scene'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
