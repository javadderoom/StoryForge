'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Scroll, Plus, Edit2, Trash2, X } from 'lucide-react';
import { BackgroundOriginDefinition, StatDefinition } from '@/lib/types';
import { notify } from '@/lib/notify';

interface BackgroundsSectionProps {
  backgrounds: BackgroundOriginDefinition[];
  stats: StatDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function BackgroundsSection({
  backgrounds,
  stats,
  isPersian,
  updateRpgSystem,
}: BackgroundsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBackgroundId, setEditingBackgroundId] = useState<string | null>(null);
  const [backgroundForm, setBackgroundForm] = useState<BackgroundOriginDefinition>({
    id: '',
    name: '',
    description: '',
    trait: '',
    narrativePromptHook: '',
    statBonuses: {},
  });

  const openModal = (bg?: BackgroundOriginDefinition) => {
    if (bg) {
      setEditingBackgroundId(bg.id);
      setBackgroundForm({
        ...bg,
        statBonuses: { ...(bg.statBonuses || {}) },
      });
    } else {
      setEditingBackgroundId(null);
      setBackgroundForm({
        id: `bg_${Date.now().toString(36)}`,
        name: '',
        description: '',
        trait: '',
        narrativePromptHook: '',
        statBonuses: {},
      });
    }
    setModalOpen(true);
  };

  const handleSaveBackground = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backgroundForm.name.trim()) return;

    updateRpgSystem((prev: any) => {
      const existing = (prev.backgrounds || []).find((b: any) => b.id === backgroundForm.id);
      let updated = prev.backgrounds || [];
      if (editingBackgroundId || existing) {
        updated = updated.map((b: any) =>
          b.id === (editingBackgroundId || backgroundForm.id) ? backgroundForm : b
        );
      } else {
        updated = [...updated, backgroundForm];
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
                      {bg.trait && (
                        <span className="inline-block text-[10.5px] bg-emerald-500/15 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/25 mt-1">
                          ✨ {bg.trait}
                        </span>
                      )}
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
                      {Object.entries(bg.statBonuses).map(([statId, bonus]) => (
                        <span
                          key={statId}
                          className="text-[10px] bg-emerald-500/10 text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/20"
                        >
                          {statId}: +{String(bonus)}
                        </span>
                      ))}
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

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'ویژگی منحصربه‌فرد (Trait)' : 'Unique Trait'}
                </label>
                <input
                  type="text"
                  value={backgroundForm.trait}
                  onChange={(e) => setBackgroundForm((prev) => ({ ...prev, trait: e.target.value }))}
                  placeholder="e.g. شناخت گذرگاه‌های مخفی دژ"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
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
                  ✨ {isPersian ? 'پاداش ویژگی‌های پیشینه (+)' : 'Origin Stat Modifiers (+)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                  {stats.map((st) => (
                    <div key={st.id} className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-zinc-300 truncate">{st.name}:</span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={backgroundForm.statBonuses?.[st.id] ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBackgroundForm((prev) => {
                            const bonuses = { ...(prev.statBonuses || {}) };
                            if (val > 0) bonuses[st.id] = val;
                            else delete bonuses[st.id];
                            return { ...prev, statBonuses: bonuses };
                          });
                        }}
                        className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-emerald-300"
                      />
                    </div>
                  ))}
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
