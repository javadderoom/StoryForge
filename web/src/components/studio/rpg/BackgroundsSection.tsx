'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Scroll, Plus, Edit2, Trash2, X, Coins, Heart, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BackgroundOriginDefinition,
  BackgroundTrait,
  StatDefinition,
  ResourceDefinition,
  CurrencySystem,
  CurrencyDenomination,
} from '@/lib/types';
import { DEFAULT_CURRENCY_PRESETS } from '@/lib/types/rpg';
import { formatPurse } from '@/lib/engines/game/currencyEngine';
import { notify } from '@/lib/notify';
import { RollModifierEditor } from './RollModifierEditor';
import { describeRollModifier } from '@/lib/engines/game/abilityEffects';

interface BackgroundsSectionProps {
  backgrounds: BackgroundOriginDefinition[];
  stats: StatDefinition[];
  resources?: ResourceDefinition[];
  currencySystem?: CurrencySystem;
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function BackgroundsSection({
  backgrounds,
  stats,
  resources = [],
  currencySystem,
  isPersian,
  updateRpgSystem,
}: BackgroundsSectionProps) {
  const activeCurrency = currencySystem || DEFAULT_CURRENCY_PRESETS.fantasy;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBackgroundId, setEditingBackgroundId] = useState<string | null>(null);
  const [activeTraitIndex, setActiveTraitIndex] = useState<number | null>(null);
  const [backgroundForm, setBackgroundForm] = useState<BackgroundOriginDefinition>({
    id: '',
    name: '',
    description: '',
    trait: '',
    traits: [],
    narrativePromptHook: '',
    statBonuses: {},
    resourceBonuses: {},
    startingPurse: {},
  });

  const openModal = (bg?: BackgroundOriginDefinition) => {
    setActiveTraitIndex(null);
    if (bg) {
      setEditingBackgroundId(bg.id);
      setBackgroundForm({
        ...bg,
        name: bg.name || '',
        description: bg.description || '',
        trait: bg.trait || '',
        traits: bg.traits
          ? bg.traits.map((t) => ({
              ...t,
              rollModifiers: t.rollModifiers ? [...t.rollModifiers] : [],
            }))
          : [],
        narrativePromptHook: bg.narrativePromptHook || '',
        statBonuses: { ...(bg.statBonuses || {}) },
        resourceBonuses: { ...(bg.resourceBonuses || {}) },
        startingPurse: { ...(bg.startingPurse || {}) },
      });
    } else {
      setEditingBackgroundId(null);
      setBackgroundForm({
        id: `bg_${Date.now().toString(36)}`,
        name: '',
        description: '',
        trait: '',
        traits: [],
        narrativePromptHook: '',
        statBonuses: {},
        resourceBonuses: {},
        startingPurse: {},
      });
    }
    setModalOpen(true);
  };

  const handleSaveBackground = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = (backgroundForm.name || '').trim();
    if (!safeName) return;

    // Sync structured traits and legacy trait prose string
    let resolvedTraits: BackgroundTrait[] = (backgroundForm.traits || [])
      .map((t, idx) => ({
        id: t.id?.trim() || `trait_${idx}_${Date.now().toString(36)}`,
        name: t.name?.trim() || '',
        description: t.description?.trim() || undefined,
        rollModifiers: t.rollModifiers && t.rollModifiers.length > 0 ? t.rollModifiers : undefined,
      }))
      .filter((t) => t.name.length > 0);

    let traitProse = (backgroundForm.trait || '').trim();

    // If traits were authored, make sure trait prose has their names
    if (resolvedTraits.length > 0) {
      traitProse = resolvedTraits.map((t) => t.name).join('\n');
    } else if (traitProse) {
      // If user only authored trait lines, convert them to basic traits so engine resolves them
      resolvedTraits = traitProse
        .split(/[,،\n؛;]+/)
        .map((s) => s.trim().replace(/^[•\-\*]\s*/, ''))
        .filter(Boolean)
        .map((name, idx) => ({
          id: `trait_${idx}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || Date.now().toString(36)}`,
          name,
        }));
    }

    const payload: BackgroundOriginDefinition = {
      ...backgroundForm,
      name: safeName,
      description: (backgroundForm.description || '').trim(),
      trait: traitProse || '',
      traits: resolvedTraits.length > 0 ? resolvedTraits : undefined,
      narrativePromptHook: (backgroundForm.narrativePromptHook || '').trim(),
      resourceBonuses:
        backgroundForm.resourceBonuses && Object.keys(backgroundForm.resourceBonuses).length > 0
          ? backgroundForm.resourceBonuses
          : undefined,
      startingPurse:
        backgroundForm.startingPurse && Object.keys(backgroundForm.startingPurse).length > 0
          ? backgroundForm.startingPurse
          : undefined,
    };

    updateRpgSystem((prev: any) => {
      const existing = (prev.backgrounds || []).find((b: any) => b.id === payload.id);
      let updated = prev.backgrounds || [];
      if (editingBackgroundId || existing) {
        updated = updated.map((b: any) =>
          b.id === (editingBackgroundId || payload.id) ? payload : b
        );
      } else {
        updated = [...updated, payload];
      }
      return { ...prev, backgrounds: updated };
    });

    setModalOpen(false);
    notify.success(isPersian ? 'پیشینه شخصیتی ذخیره شد' : 'Character origin saved');
  };

  const handleDeleteBackground = async (bg: BackgroundOriginDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف پیشینه' : 'Delete Background',
      message: isPersian
        ? `آیا از حذف پیشینه "${bg.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the origin "${bg.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev: any) => ({
        ...prev,
        backgrounds: (prev.backgrounds || []).filter((b: any) => b.id !== bg.id),
      }));
      notify.info(isPersian ? 'پیشینه حذف شد' : 'Origin removed');
    }
  };

  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Scroll className="w-4 h-4 text-emerald-400" />
                <span>{isPersian ? 'پیشینه‌ها و خاستگاه‌های شخصیتی' : 'Character Backgrounds & Origins'}</span>
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {backgrounds.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isPersian
                  ? 'خاستگاه و ویژگی منحصربه‌فرد برای قلاب‌های روایی داستان'
                  : 'Origins granting special traits and narrative hooks'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-xs flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ پیشینه جدید' : '+ Add Origin'}</span>
            </button>
          </div>

          {backgrounds.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-4">
              {isPersian
                ? 'هیچ پیشینه‌ای ثبت نشده است. پیشینه‌های داستانی اضافه کنید.'
                : 'No custom backgrounds defined yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {backgrounds.map((bg) => (
                <div
                  key={bg.id}
                  className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-emerald-500/40 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>{bg.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">({bg.id})</span>
                      </strong>
                      {(bg.traits && bg.traits.length > 0) ? (
                        <div
                          className="mt-1.5 flex flex-col gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5"
                          dir={isPersian ? 'rtl' : 'ltr'}
                        >
                          {bg.traits.map((t, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <div className="flex items-start gap-1.5 text-[11px] font-medium text-emerald-200">
                                <span className="mt-0.5 shrink-0">✨</span>
                                <span className="font-semibold">{t.name}</span>
                              </div>
                              {t.description && (
                                <p className="text-[10.5px] text-emerald-300/80 mr-4 ml-4">
                                  {t.description}
                                </p>
                              )}
                              {t.rollModifiers && t.rollModifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mr-4 ml-4">
                                  {t.rollModifiers.map((spec, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300"
                                    >
                                      <span>{describeRollModifier(spec, isPersian)}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : bg.trait ? (
                        <div
                          className="mt-1.5 flex flex-col gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2"
                          dir={isPersian ? 'rtl' : 'ltr'}
                        >
                          {bg.trait
                            .split(/[,،\n؛;]+/)
                            .map((s) => s.trim().replace(/^[•\-\*]\s*/, ''))
                            .filter(Boolean)
                            .map((t, i) => (
                              <span key={i} className="flex items-start gap-1.5 text-[11px] font-medium text-emerald-200">
                                <span className="mt-0.5 shrink-0">✨</span>
                                <span>{t}</span>
                              </span>
                            ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(bg)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackground(bg)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{bg.description}</p>

                  {bg.narrativePromptHook && (
                    <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-300 italic">
                      🪝 {bg.narrativePromptHook}
                    </div>
                  )}

                  {/* Stat Bonuses */}
                  {bg.statBonuses && Object.keys(bg.statBonuses).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(bg.statBonuses).map(([statId, bonus]) => {
                        const stName = stats.find((s) => s.id === statId)?.name || statId;
                        const num = Number(bonus);
                        const isPositive = num > 0;
                        return (
                          <span
                            key={statId}
                            dir="ltr"
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                              isPositive
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {stName}: {isPositive ? `+${num}` : num}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Vital Pool Bonuses */}
                  {bg.resourceBonuses && Object.keys(bg.resourceBonuses).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(bg.resourceBonuses).map(([resId, bonus]) => {
                        const resName = resources.find((r) => r.id === resId)?.name || resId;
                        return (
                          <span
                            key={resId}
                            className="text-[10px] bg-emerald-500/10 text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/20"
                          >
                            ❤️ {resName}: +{String(bonus)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Starting Purse */}
                  {bg.startingPurse && Object.values(bg.startingPurse).some((v) => v > 0) && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 font-mono px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span>{formatPurse(bg.startingPurse, activeCurrency)}</span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Background Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Scroll className="w-5 h-5 text-emerald-400" />
                <span>
                  {editingBackgroundId
                    ? isPersian
                      ? 'ویرایش پیشینه'
                      : 'Edit Origin'
                    : isPersian
                    ? 'افزودن پیشینه شخصیتی'
                    : 'Add Background'}
                </span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBackground} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'نام پیشینه' : 'Origin Name'}
                  </label>
                  <input
                    type="text"
                    value={backgroundForm.name}
                    onChange={(e) => setBackgroundForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Citadel Outcast / رانده‌شده از دژ"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ID</label>
                  <input
                    type="text"
                    value={backgroundForm.id}
                    disabled={!!editingBackgroundId}
                    onChange={(e) =>
                      setBackgroundForm((prev) => ({
                        ...prev,
                        id: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      }))
                    }
                    placeholder="e.g. citadel_outcast"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Structured Traits & Roll Modifiers */}
              <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-zinc-950 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{isPersian ? 'ویژگی‌های منحصربه‌فرد پیشینه (Background Traits)' : 'Background Traits & Effects'}</span>
                    </label>
                    <p className="text-[10.5px] text-zinc-400">
                      {isPersian
                        ? 'هر پیشینه می‌تواند دارای چند ویژگی خاص با پاداش‌های ساختاریافته بر تاس باشد.'
                        : 'Discrete traits granting deterministic bonuses to actions.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newIdx = (backgroundForm.traits || []).length;
                      const newTrait: BackgroundTrait = {
                        id: `trait_${Date.now().toString(36)}`,
                        name: '',
                        description: '',
                        rollModifiers: [],
                      };
                      setBackgroundForm((prev) => ({
                        ...prev,
                        traits: [...(prev.traits || []), newTrait],
                      }));
                      setActiveTraitIndex(newIdx);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{isPersian ? 'افزودن ویژگی' : 'Add Trait'}</span>
                  </button>
                </div>

                {/* Trait Cards */}
                {(backgroundForm.traits || []).length > 0 ? (
                  <div className="space-y-2">
                    {(backgroundForm.traits || []).map((t, idx) => {
                      const isExpanded = activeTraitIndex === idx;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={t.name}
                                onChange={(e) => {
                                  const name = e.target.value;
                                  setBackgroundForm((prev) => {
                                    const updated = [...(prev.traits || [])];
                                    updated[idx] = { ...updated[idx], name };
                                    return { ...prev, traits: updated };
                                  });
                                }}
                                placeholder={isPersian ? 'نام ویژگی، مثلاً: شناخت گذرگاه‌های مخفی دژ' : 'Trait name, e.g. Secret Pass Lore'}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 font-medium focus:border-emerald-500 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setActiveTraitIndex(isExpanded ? null : idx)}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                              >
                                <span>{isPersian ? 'اثرات بر تاس' : 'Roll Effects'}</span>
                                <span className="font-mono text-emerald-400">
                                  ({(t.rollModifiers || []).length})
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBackgroundForm((prev) => ({
                                    ...prev,
                                    traits: (prev.traits || []).filter((_, i) => i !== idx),
                                  }));
                                  if (activeTraitIndex === idx) setActiveTraitIndex(null);
                                }}
                                className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-md"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Optional Trait Description */}
                          <input
                            type="text"
                            value={t.description || ''}
                            onChange={(e) => {
                              const description = e.target.value;
                              setBackgroundForm((prev) => {
                                const updated = [...(prev.traits || [])];
                                updated[idx] = { ...updated[idx], description };
                                return { ...prev, traits: updated };
                              });
                            }}
                            placeholder={isPersian ? 'توضیح کوتاه (اختیاری)...' : 'Short description (optional)...'}
                            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 focus:border-emerald-500 focus:outline-none"
                          />

                          {/* Expanded RollModifierEditor */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-zinc-800/80">
                              <RollModifierEditor
                                specs={t.rollModifiers || []}
                                onChange={(rollModifiers) => {
                                  setBackgroundForm((prev) => {
                                    const updated = [...(prev.traits || [])];
                                    updated[idx] = { ...updated[idx], rollModifiers };
                                    return { ...prev, traits: updated };
                                  });
                                }}
                                stats={stats}
                                isPersian={isPersian}
                                title={isPersian ? `اثرات تاس «${t.name || 'ویژگی'}»` : `Roll Modifiers for "${t.name || 'Trait'}"`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <textarea
                      rows={3}
                      value={backgroundForm.trait}
                      onChange={(e) =>
                        setBackgroundForm((prev) => ({ ...prev, trait: e.target.value }))
                      }
                      placeholder={
                        isPersian
                          ? 'هر ویژگی در یک خط جدا، مثل:\nشناخت گذرگاه‌های مخفی دژ\nزخم‌بندی در میدان نبرد'
                          : 'One trait per line, e.g.:\nSecret pass lore\nBattlefield first aid'
                      }
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'قلاب روایی هوش مصنوعی (Narrative Hook)' : 'AI Narrative Prompt Hook'}
                </label>
                <input
                  type="text"
                  value={backgroundForm.narrativePromptHook || ''}
                  onChange={(e) =>
                    setBackgroundForm((prev) => ({ ...prev, narrativePromptHook: e.target.value }))
                  }
                  placeholder="e.g. فراری از محفل سایه‌ها، در جستجوی شمشیر گمشده پدرش"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'توصیف پیشینه' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={backgroundForm.description}
                  onChange={(e) =>
                    setBackgroundForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="توصیفی از سرگذشت گذشته کاراکتر..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Stat Bonuses */}
              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-2">
                  ✨ {isPersian ? 'اصلاحگرهای ویژگی‌های پیشینه (+ / -)' : 'Origin Stat Modifiers (+ / -)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  {stats.map((st) => {
                    const currentVal = backgroundForm.statBonuses?.[st.id] ?? 0;
                    return (
                      <div key={st.id} className="flex items-center justify-between gap-1 text-xs">
                        <span className="text-zinc-300 truncate">{st.name}:</span>
                        <input
                          type="number"
                          min={-10}
                          max={10}
                          value={currentVal}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBackgroundForm((prev) => {
                              const bonuses = { ...(prev.statBonuses || {}) };
                              if (val !== 0) bonuses[st.id] = val;
                              else delete bonuses[st.id];
                              return { ...prev, statBonuses: bonuses };
                            });
                          }}
                          className={`w-14 bg-zinc-900 border rounded-lg px-2 py-1 text-xs text-center font-mono transition-colors ${
                            currentVal > 0
                              ? 'border-emerald-500/50 text-emerald-300'
                              : currentVal < 0
                              ? 'border-rose-500/50 text-rose-300'
                              : 'border-zinc-700 text-zinc-500'
                          }`}
                          dir="ltr"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vitals & Resource Pool Modifiers */}
              {resources.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-2">
                    ❤️ {isPersian ? 'افزایش سقف منابع حیاتی (Max Pools)' : 'Vital Pool Bonuses (+)'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                    {resources.map((res) => (
                      <div key={res.id} className="flex items-center justify-between gap-1 text-xs">
                        <span className="text-zinc-300 truncate" title={res.name}>
                          {res.name}:
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={backgroundForm.resourceBonuses?.[res.id] ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBackgroundForm((prev) => {
                              const rBonuses = { ...(prev.resourceBonuses || {}) };
                              if (val > 0) rBonuses[res.id] = val;
                              else delete rBonuses[res.id];
                              return { ...prev, resourceBonuses: rBonuses };
                            });
                          }}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-emerald-300"
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Starting Purse */}
              {activeCurrency.denominations && activeCurrency.denominations.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-2">
                    💰 {isPersian ? 'کیسه پول آغازین (سکه)' : 'Starting Purse (Coins)'}
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                    {activeCurrency.denominations.map((d: CurrencyDenomination) => {
                      const denomName = isPersian ? d.nameFa : d.nameEn;
                      return (
                        <div key={d.id} className="space-y-1">
                          <label className="text-[11px] text-zinc-300 block truncate" title={denomName}>
                            {d.symbol ? `${d.symbol} ` : ''}
                            {denomName}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={backgroundForm.startingPurse?.[d.id] ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setBackgroundForm((prev) => {
                                const purse = { ...(prev.startingPurse || {}) };
                                if (val > 0) purse[d.id] = val;
                                else delete purse[d.id];
                                return { ...prev, startingPurse: purse };
                              });
                            }}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-amber-300"
                            dir="ltr"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  {isPersian ? 'ذخیره' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
