'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Crown, Plus, Edit2, Trash2, X } from 'lucide-react';
import { ArchetypeDefinition, StatDefinition } from '@/lib/types';
import { notify } from '@/lib/notify';

interface ArchetypesSectionProps {
  archetypes: ArchetypeDefinition[];
  stats: StatDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function ArchetypesSection({
  archetypes,
  stats,
  isPersian,
  updateRpgSystem,
}: ArchetypesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArchetypeId, setEditingArchetypeId] = useState<string | null>(null);
  const [archetypeForm, setArchetypeForm] = useState<ArchetypeDefinition>({
    id: '',
    name: '',
    tagline: '',
    description: '',
    statBonuses: {},
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
    if (!archetypeForm.name.trim()) return;

    updateRpgSystem((prev: any) => {
      const existing = (prev.archetypes || []).find((a: any) => a.id === archetypeForm.id);
      let updated = prev.archetypes || [];
      if (editingArchetypeId || existing) {
        updated = updated.map((a: any) =>
          a.id === (editingArchetypeId || archetypeForm.id) ? archetypeForm : a
        );
      } else {
        updated = [...updated, archetypeForm];
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
                      {Object.entries(arch.statBonuses).map(([statId, bonus]) => (
                        <span
                          key={statId}
                          className="text-[10px] bg-purple-500/10 text-purple-300 font-mono px-2 py-0.5 rounded-md border border-purple-500/20"
                        >
                          {statId}: +{String(bonus)}
                        </span>
                      ))}
                    </div>
                  )}

                  {arch.startingEquipment && Object.values(arch.startingEquipment).some(Boolean) && (
                    <div className="text-[10.5px] text-zinc-400 flex flex-wrap gap-2 pt-1 border-t border-zinc-900">
                      {arch.startingEquipment.mainHand && (
                        <span>⚔️ {arch.startingEquipment.mainHand}</span>
                      )}
                      {arch.startingEquipment.armor && (
                        <span>🛡️ {arch.startingEquipment.armor}</span>
                      )}
                      {arch.startingEquipment.offHand && (
                        <span>🗡️ {arch.startingEquipment.offHand}</span>
                      )}
                      {arch.startingEquipment.relic && (
                        <span>🔮 {arch.startingEquipment.relic}</span>
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

              {/* Starting Equipment */}
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-2">
                  🛡️ {isPersian ? 'تجهیزات آغازین کاراکتر' : 'Starting Equipment'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {isPersian ? 'سلاح اصلی (Main Hand)' : 'Main Hand Weapon'}
                    </span>
                    <input
                      type="text"
                      value={archetypeForm.startingEquipment?.mainHand || ''}
                      onChange={(e) =>
                        setArchetypeForm((prev) => ({
                          ...prev,
                          startingEquipment: {
                            ...(prev.startingEquipment || {}),
                            mainHand: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. خنجر پولادین"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {isPersian ? 'زره / لباس (Armor)' : 'Armor'}
                    </span>
                    <input
                      type="text"
                      value={archetypeForm.startingEquipment?.armor || ''}
                      onChange={(e) =>
                        setArchetypeForm((prev) => ({
                          ...prev,
                          startingEquipment: {
                            ...(prev.startingEquipment || {}),
                            armor: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. زره چرمی سبک"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {isPersian ? 'دست دوم / سپر (Off Hand)' : 'Off Hand'}
                    </span>
                    <input
                      type="text"
                      value={archetypeForm.startingEquipment?.offHand || ''}
                      onChange={(e) =>
                        setArchetypeForm((prev) => ({
                          ...prev,
                          startingEquipment: {
                            ...(prev.startingEquipment || {}),
                            offHand: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. قلاب کمند"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-0.5">
                      {isPersian ? 'دست‌سازه / نشان (Relic)' : 'Relic / Accessory'}
                    </span>
                    <input
                      type="text"
                      value={archetypeForm.startingEquipment?.relic || ''}
                      onChange={(e) =>
                        setArchetypeForm((prev) => ({
                          ...prev,
                          startingEquipment: {
                            ...(prev.startingEquipment || {}),
                            relic: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. نشان محفل سایه‌ها"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
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
