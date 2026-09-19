'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { PlayerState } from '@/lib/types/gameplay';
import { StatDefinition, AbilityDefinition, RPGSystemSchema, ResourceDefinition } from '@/lib/types/rpg';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { computeMaxResources } from '@/lib/engines/game/vitalScaling';
import { notify } from '@/lib/notify';
import { Sparkles, Plus, Minus, ArrowUpCircle, Check, X, Shield, Zap } from 'lucide-react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerState: PlayerState;
  rpgSystem?: RPGSystemSchema;
  isPersian?: boolean;
  sessionId: string;
  onLevelUpCompleted: (updatedState: PlayerState) => void;
}

export function LevelUpModal({
  isOpen,
  onClose,
  playerState,
  rpgSystem,
  isPersian = false,
  sessionId,
  onLevelUpCompleted,
}: LevelUpModalProps) {
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [chosenAbilityId, setChosenAbilityId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const unspentStats = playerState.unspentStatPoints ?? 0;
  const unspentAbilities = playerState.unspentAbilityPicks ?? 0;
  const currentLevel = playerState.level ?? 1;

  const totalAllocated = Object.values(allocations).reduce((sum, n) => sum + (n || 0), 0);
  const remainingPoints = unspentStats - totalAllocated;

  const stats: StatDefinition[] = rpgSystem?.stats ?? [];
  const allAbilities: AbilityDefinition[] = rpgSystem?.abilities ?? [];
  const knownAbilityIds = new Set(playerState.abilities ?? []);
  const availableAbilities = allAbilities.filter((a) => !knownAbilityIds.has(a.id));

  // Compute hypothetical stats & vitals preview
  const previewStats: Record<string, number> = { ...(playerState.stats || {}) };
  for (const [statId, added] of Object.entries(allocations)) {
    previewStats[statId] = (previewStats[statId] || 10) + (added || 0);
  }

  const baseVitals: ResourceDefinition[] = rpgSystem?.resources || [];
  const currentMaxResources = playerState.maxResources || {};
  const previewMaxResources = rpgSystem ? computeMaxResources(previewStats, rpgSystem) : currentMaxResources;

  const handleIncrement = (statId: string) => {
    if (remainingPoints <= 0) return;
    setAllocations((prev) => ({
      ...prev,
      [statId]: (prev[statId] || 0) + 1,
    }));
  };

  const handleDecrement = (statId: string) => {
    if ((allocations[statId] || 0) <= 0) return;
    setAllocations((prev) => {
      const next = { ...prev };
      if (next[statId] <= 1) {
        delete next[statId];
      } else {
        next[statId] -= 1;
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (totalAllocated === 0 && !chosenAbilityId) {
      notify.info(
        isPersian
          ? 'هیچ امتیازی برای ارتقا انتخاب نشده است.'
          : 'No stat points or abilities selected to commit.'
      );
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/play/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          statAllocations: allocations,
          chosenAbilityId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.playerState) {
        notify.success(
          isPersian
            ? `ارتقای سطح و ویژگی‌ها با موفقیت اعمال شد!`
            : `Level-up upgrades committed successfully!`
        );
        onLevelUpCompleted(json.playerState);
        onClose();
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err: any) {
      notify.error(err.message || 'Failed to commit level-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-zinc-950 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{isPersian ? 'ارتقای سطح و تخصیص امتیاز' : 'Level Up & Advancement'}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-mono">
                  {isPersian ? `سطح ${toPersianDigits(currentLevel)}` : `Lvl ${currentLevel}`}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isPersian
                  ? 'ویژگی‌های پایه‌ای قهرمان خود را تقویت کنید تا حداکثر جان، مانا و کارایی تاس‌ها افزایش یابد.'
                  : 'Distribute earned points into core attributes to increase vitals pools and dice checks.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Points Remaining Pill Banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-950/25 border border-emerald-500/30">
            <div className="flex items-center gap-2.5">
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-zinc-200">
                {isPersian ? 'امتیازهای باقی‌مانده برای ویژگی‌ها:' : 'Available Stat Points:'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xl font-bold font-mono px-3 py-1 rounded-xl border ${
                  remainingPoints > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {toPersianDigits(remainingPoints)}
              </span>
            </div>
          </div>

          {/* Stat Allocation List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>{isPersian ? 'ویژگی‌های بنیادین (Stats)' : 'Core Attributes'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.map((st) => {
                const currentVal = playerState.stats?.[st.id] ?? st.baseValue ?? 10;
                const allocated = allocations[st.id] || 0;
                const nextVal = currentVal + allocated;

                return (
                  <div
                    key={st.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      allocated > 0
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-zinc-900/70 border-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-zinc-200">{st.name}</span>
                      <div className="flex items-center gap-1 font-mono text-xs" dir="ltr">
                        <span className="text-zinc-400">{toPersianDigits(currentVal)}</span>
                        {allocated > 0 && (
                          <>
                            <span className="text-emerald-400">→</span>
                            <span className="font-bold text-emerald-400">
                              {toPersianDigits(nextVal)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 line-clamp-1 mb-3">
                      {st.description || (isPersian ? 'تاثیرگذار در تاس‌ها و منابع' : 'Affects rolls & vitals')}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <span className="text-xs text-zinc-500">
                        {allocated > 0 ? (
                          <span className="text-emerald-400 font-semibold" dir="ltr">
                            +{toPersianDigits(allocated)}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={allocated <= 0}
                          onClick={() => handleDecrement(st.id)}
                          className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={remainingPoints <= 0}
                          onClick={() => handleIncrement(st.id)}
                          className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-600/50 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vitals Preview Section (Scaling Impact) */}
          {baseVitals.length > 0 && (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {isPersian ? 'پیش‌نمایش تغییر حداکثر منابع حیاتی (Vitals)' : 'Vitals Max Capacity Preview'}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {baseVitals.map((v) => {
                  const curMax = currentMaxResources[v.id] ?? v.max ?? 100;
                  const nxtMax = previewMaxResources[v.id] ?? curMax;
                  const delta = nxtMax - curMax;

                  return (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="text-zinc-300 font-medium">{v.name}</span>
                      <div className="font-mono text-xs flex items-center gap-1" dir="ltr">
                        <span>{toPersianDigits(curMax)}</span>
                        {delta > 0 && (
                          <span className="text-emerald-400 font-bold">
                            (+{toPersianDigits(delta)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional Ability Pick */}
          {unspentAbilities > 0 && availableAbilities.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>
                  {isPersian
                    ? `انتخاب توانایی جدید (${toPersianDigits(unspentAbilities)} انتخاب در دسترس)`
                    : `Pick an Ability (${unspentAbilities} pick available)`}
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableAbilities.map((ab) => {
                  const isSelected = chosenAbilityId === ab.id;
                  return (
                    <div
                      key={ab.id}
                      onClick={() => setChosenAbilityId(isSelected ? undefined : ab.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/30'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-zinc-100">{ab.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2">{ab.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 px-6 py-4 bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isPersian ? 'انصراف' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={isSubmitting || (totalAllocated === 0 && !chosenAbilityId)}
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>{isPersian ? 'در حال ثبت...' : 'Committing...'}</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isPersian ? 'تایید و اعمال ارتقا' : 'Confirm & Apply'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
