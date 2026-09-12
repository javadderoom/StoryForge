'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Crown, Plus, Edit2, Trash2, X, Coins, Heart } from 'lucide-react';
import {
  ArchetypeDefinition,
  StatDefinition,
  WorldArtifact,
  ResourceDefinition,
  CurrencySystem,
  CurrencyDenomination,
  AbilityDefinition,
} from '@/lib/types';
import { DEFAULT_CURRENCY_PRESETS } from '@/lib/types/rpg';
import { formatPurse } from '@/lib/engines/game/currencyEngine';
import { notify } from '@/lib/notify';

interface ArchetypesSectionProps {
  archetypes: ArchetypeDefinition[];
  stats: StatDefinition[];
  resources?: ResourceDefinition[];
  abilities?: AbilityDefinition[];
  currencySystem?: CurrencySystem;
  /** Vault artifacts from /studio/artifacts (worldBible.artifacts). */
  vaultItems: WorldArtifact[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

/** Which vault artifacts are valid for each equipment slot (mirrors runtime equip rules). */
type EquipmentSlot = 'mainHand' | 'offHand' | 'armor' | 'relic';

function fitsSlot(slot: EquipmentSlot, artifact: WorldArtifact): boolean {
  if (artifact.nonEquippable) return false;
  const s = artifact.slot || 'relic'; // vault form defaults new artifacts to 'relic'
  switch (slot) {
    case 'mainHand':
      return s === 'main_hand' || s === 'two_handed';
    case 'offHand':
      return s === 'off_hand' || s === 'shield';
    case 'armor':
      return s === 'armor';
    case 'relic':
      return s === 'relic';
  }
}

export function ArchetypesSection({
  archetypes,
  stats,
  resources = [],
  abilities = [],
  currencySystem,
  vaultItems,
  isPersian,
  updateRpgSystem,
}: ArchetypesSectionProps) {
  const activeCurrency = currencySystem || DEFAULT_CURRENCY_PRESETS.fantasy;

  /** Resolve a stored equipment slot value (vault artifact id) to a display name. */
  const vaultItemName = (slotValue?: string): string => {
    if (!slotValue) return '';
    const found = vaultItems.find((a) => a.id === slotValue);
    if (found) return found.name;
    // Legacy fallback: if an author previously saved a free-form name, show it
    return slotValue;
  };

  /** Filter artifacts that match a slot. Always includes the currently-assigned item even if slot shifted. */
  const slotOptions = (slot: EquipmentSlot): WorldArtifact[] =>
    vaultItems.filter((a) => fitsSlot(slot, a));

  const renderSlotSelect = (slot: EquipmentSlot, label: string) => {
    const current = archetypeForm.startingEquipment?.[slot] || '';
    const isLegacy = current && !vaultItems.some((a) => a.id === current);
    const mainHandItem = vaultItems.find((a) => a.id === archetypeForm.startingEquipment?.mainHand);
    const disabled = slot === 'offHand' && (mainHandItem?.slot === 'two_handed');

    return (
      <div className="space-y-1">
        <label className="text-[11px] text-zinc-400 block">{label}</label>
        <select
          disabled={disabled}
          value={disabled ? '' : current}
          onChange={(e) =>
            setArchetypeForm((prev) => ({
              ...prev,
              startingEquipment: {
                ...(prev.startingEquipment || {}),
                [slot]: e.target.value || undefined,
              },
            }))
          }
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 disabled:opacity-40"
        >
          <option value="">
            {disabled
              ? isPersian
                ? '— سلاح دومست، دست دوم آزاد نیست —'
                : '— two-handed weapon equipped —'
              : isPersian
                ? '— بدون انتخاب —'
                : '— none —'}
          </option>
          {isLegacy && <option value={current}>{current}</option>}
          {slotOptions(slot).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.slot || 'relic'} · {a.rarity})
            </option>
          ))}
        </select>
      </div>
    );
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArchetypeId, setEditingArchetypeId] = useState<string | null>(null);
  const [archetypeForm, setArchetypeForm] = useState<ArchetypeDefinition>({
    id: '',
    name: '',
    tagline: '',
    description: '',
    statBonuses: {},
    resourceBonuses: {},
    startingPurse: {},
    startingAbilities: [],
    startingEquipment: {
      mainHand: '',
      offHand: '',
      armor: '',
      relic: '',
    },
  });

  const openModal = (arch?: ArchetypeDefinition) => {
    if (arch) {
      setEditingArchetypeId(arch.id);
      setArchetypeForm({
        ...arch,
        statBonuses: { ...(arch.statBonuses || {}) },
        resourceBonuses: { ...(arch.resourceBonuses || {}) },
        startingPurse: { ...(arch.startingPurse || {}) },
        startingAbilities: arch.startingAbilities ? [...arch.startingAbilities] : [],
        startingEquipment: { ...(arch.startingEquipment || {}) },
      });
    } else {
      setEditingArchetypeId(null);
      setArchetypeForm({
        id: `arch_${Date.now().toString(36)}`,
        name: '',
        tagline: '',
        description: '',
        statBonuses: {},
        resourceBonuses: {},
        startingPurse: {},
        startingAbilities: [],
        startingEquipment: {
          mainHand: '',
          offHand: '',
          armor: '',
          relic: '',
        },
      });
    }
    setModalOpen(true);
  };

  const handleSaveArchetype = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = (archetypeForm.name || '').trim();
    if (!safeName) return;

    const payload: ArchetypeDefinition = {
      ...archetypeForm,
      name: safeName,
      tagline: (archetypeForm.tagline || '').trim(),
      description: (archetypeForm.description || '').trim(),
      startingAbilities:
        archetypeForm.startingAbilities && archetypeForm.startingAbilities.length > 0
          ? archetypeForm.startingAbilities
          : undefined,
      resourceBonuses:
        archetypeForm.resourceBonuses && Object.keys(archetypeForm.resourceBonuses).length > 0
          ? archetypeForm.resourceBonuses
          : undefined,
      startingPurse:
        archetypeForm.startingPurse && Object.keys(archetypeForm.startingPurse).length > 0
          ? archetypeForm.startingPurse
          : undefined,
    };

    updateRpgSystem((prev: any) => {
      const existing = (prev.archetypes || []).find((a: any) => a.id === payload.id);
      let updated = prev.archetypes || [];
      if (editingArchetypeId || existing) {
        updated = updated.map((a: any) =>
          a.id === (editingArchetypeId || payload.id) ? payload : a
        );
      } else {
        updated = [...updated, payload];
      }
      return { ...prev, archetypes: updated };
    });

    setModalOpen(false);
    notify.success(isPersian ? 'کهن‌الگوی شخصیتی ذخیره شد' : 'Character archetype saved');
  };

  const handleDeleteArchetype = async (arch: ArchetypeDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف کهن‌الگو' : 'Delete Archetype',
      message: isPersian
        ? `آیا از حذف کهن‌الگوی "${arch.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the archetype "${arch.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev: any) => ({
        ...prev,
        archetypes: (prev.archetypes || []).filter((a: any) => a.id !== arch.id),
      }));
      notify.info(isPersian ? 'کهن‌الگو حذف شد' : 'Archetype removed');
    }
  };

  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-400" />
                <span>{isPersian ? 'کلاس‌ها و کهن‌الگوهای شخصیتی' : 'Character Archetypes'}</span>
                <span className="text-xs font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-500/20">
                  {archetypes.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isPersian
                  ? 'شخصیت‌های آماده برای انتخاب در آغاز ماجراجویی'
                  : 'Pre-made class templates for quick start'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-xs flex items-center gap-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 px-3 py-1.5 rounded-xl border border-purple-500/30 transition-all font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ کهن‌الگوی جدید' : '+ Add Archetype'}</span>
            </button>
          </div>

          {archetypes.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-4">
              {isPersian
                ? 'هیچ کهن‌الگویی ثبت نشده است. کهن‌الگوهای پیش‌فرض یا اختصاصی اضافه کنید.'
                : 'No custom archetypes defined yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {archetypes.map((arch) => (
                <div
                  key={arch.id}
                  className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-purple-500/40 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <span>{arch.name}</span>
                        <span className="text-[10px] font-mono text-zinc-500">({arch.id})</span>
                      </strong>
                      {arch.tagline && (
                        <p className="text-xs text-purple-400/90 font-medium mt-0.5">{arch.tagline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(arch)}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteArchetype(arch)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed">{arch.description}</p>

                  {arch.statBonuses && Object.keys(arch.statBonuses).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(arch.statBonuses).map(([statId, bonus]) => {
                        const stName = stats.find((s) => s.id === statId)?.name || statId;
                        return (
                          <span
                            key={statId}
                            className="text-[10px] bg-purple-500/10 text-purple-300 font-mono px-2 py-0.5 rounded-md border border-purple-500/20"
                          >
                            {stName}: +{String(bonus)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {arch.resourceBonuses && Object.keys(arch.resourceBonuses).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(arch.resourceBonuses).map(([resId, bonus]) => {
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

                  {arch.startingPurse && Object.values(arch.startingPurse).some((v) => v > 0) && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] bg-amber-500/10 text-amber-300 font-mono px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-amber-400" />
                        <span>{formatPurse(arch.startingPurse, activeCurrency)}</span>
                      </span>
                    </div>
                  )}

                  {arch.startingAbilities && arch.startingAbilities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {arch.startingAbilities.map((abId) => {
                        const ab = abilities.find((a) => a.id === abId);
                        return (
                          <span
                            key={abId}
                            className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/20 flex items-center gap-1"
                          >
                            <span>{ab?.icon || '✨'}</span>
                            <span>{ab?.name || abId}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {arch.startingEquipment && Object.values(arch.startingEquipment).some(Boolean) && (
                    <div className="text-[10.5px] text-zinc-400 flex flex-wrap gap-2 pt-1 border-t border-zinc-900">
                      {arch.startingEquipment.mainHand && (
                        <span>⚔️ {vaultItemName(arch.startingEquipment.mainHand)}</span>
                      )}
                      {arch.startingEquipment.armor && (
                        <span>🛡️ {vaultItemName(arch.startingEquipment.armor)}</span>
                      )}
                      {arch.startingEquipment.offHand && (
                        <span>🗡️ {vaultItemName(arch.startingEquipment.offHand)}</span>
                      )}
                      {arch.startingEquipment.relic && (
                        <span>🔮 {vaultItemName(arch.startingEquipment.relic)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Archetype Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-400" />
                <span>
                  {editingArchetypeId
                    ? isPersian
                      ? 'ویرایش کهن‌الگو'
                      : 'Edit Archetype'
                    : isPersian
                    ? 'افزودن کهن‌الگوی شخصیتی'
                    : 'Add Archetype'}
                </span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArchetype} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'نام کهن‌الگو' : 'Archetype Name'}
                  </label>
                  <input
                    type="text"
                    value={archetypeForm.name}
                    onChange={(e) => setArchetypeForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Shadowblade / سایه‌تیغ"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ID</label>
                  <input
                    type="text"
                    value={archetypeForm.id}
                    disabled={!!editingArchetypeId}
                    onChange={(e) =>
                      setArchetypeForm((prev) => ({
                        ...prev,
                        id: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      }))
                    }
                    placeholder="e.g. shadowblade"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'شعار / عنوان کوتاه' : 'Tagline / Short Title'}
                </label>
                <input
                  type="text"
                  value={archetypeForm.tagline || ''}
                  onChange={(e) => setArchetypeForm((prev) => ({ ...prev, tagline: e.target.value }))}
                  placeholder="e.g. استاد نفوذ بی‌صدا، قفل‌گشایی و ضربات غافلگیرکننده"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'توصیف و هویت داستانی' : 'Description & Lore'}
                </label>
                <textarea
                  rows={2}
                  value={archetypeForm.description}
                  onChange={(e) => setArchetypeForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="توضیحاتی در مورد مهارت‌ها، خاستگاه و سبک مبارزه..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Stat Bonuses for story attributes */}
              <div>
                <label className="block text-xs font-bold text-purple-400 mb-2">
                  ⚔️ {isPersian ? 'پاداش‌های ویژگی‌های اصلی (+)' : 'Stat Modifiers (+)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  {stats.map((st) => (
                    <div key={st.id} className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-zinc-300 truncate">{st.name}:</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={archetypeForm.statBonuses?.[st.id] ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setArchetypeForm((prev) => {
                            const bonuses = { ...(prev.statBonuses || {}) };
                            if (val > 0) bonuses[st.id] = val;
                            else delete bonuses[st.id];
                            return { ...prev, statBonuses: bonuses };
                          });
                        }}
                        className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-purple-300"
                      />
                    </div>
                  ))}
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
                          value={archetypeForm.resourceBonuses?.[res.id] ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setArchetypeForm((prev) => {
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
                            value={archetypeForm.startingPurse?.[d.id] ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setArchetypeForm((prev) => {
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

              {/* Starting Abilities & Spells */}
              {abilities.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>{isPersian ? 'توانایی‌ها و طلسم‌های آغازین' : 'Starting Abilities & Spells'}</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                    {abilities
                      .filter(
                        (ab) =>
                          !ab.allowedArchetypeIds ||
                          ab.allowedArchetypeIds.length === 0 ||
                          (archetypeForm.id && ab.allowedArchetypeIds.includes(archetypeForm.id))
                      )
                      .map((ab) => {
                        const isChecked = archetypeForm.startingAbilities?.includes(ab.id) ?? false;
                        return (
                          <label
                            key={ab.id}
                            className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200'
                                : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const cur = archetypeForm.startingAbilities ? [...archetypeForm.startingAbilities] : [];
                                if (e.target.checked) {
                                  if (!cur.includes(ab.id)) cur.push(ab.id);
                                } else {
                                  const idx = cur.indexOf(ab.id);
                                  if (idx !== -1) cur.splice(idx, 1);
                                }
                                setArchetypeForm({ ...archetypeForm, startingAbilities: cur });
                              }}
                              className="rounded border-zinc-700 text-cyan-600 focus:ring-cyan-500"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{ab.icon || '✨'}</span>
                                <span className="text-xs font-bold truncate">{ab.name}</span>
                              </div>
                              {ab.effectSummary && (
                                <p className="text-[10px] text-zinc-400 truncate">{ab.effectSummary}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Starting Equipment */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  🛡️ {isPersian ? 'تجهیزات آغازین کاراکتر' : 'Starting Equipment'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {renderSlotSelect('mainHand', isPersian ? 'سلاح اصلی (Main Hand)' : 'Main Hand Weapon')}
                  {renderSlotSelect('armor', isPersian ? 'زره / لباس (Armor)' : 'Armor')}
                  {renderSlotSelect('offHand', isPersian ? 'دست دوم / سپر (Off Hand)' : 'Off Hand')}
                  {renderSlotSelect('relic', isPersian ? 'دست‌سازه / نشان (Relic)' : 'Relic / Accessory')}
                </div>
                {vaultItems.length === 0 && (
                  <p className="text-[10.5px] text-amber-400/90 mt-1.5">
                    {isPersian
                      ? 'خزانه اقلام خالی است — ابتدا در /studio/artifacts قلم اضافه کنید.'
                      : 'The vault is empty — add artifacts in /studio/artifacts first.'}
                  </p>
                )}
              </div>

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
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
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
