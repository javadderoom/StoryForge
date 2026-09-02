'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Sword, Plus, Edit2, Trash2, X } from 'lucide-react';
import { StatDefinition } from '@/lib/types';
import { notify } from '@/lib/notify';

interface StatsSectionProps {
  stats: StatDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function StatsSection({ stats, isPersian, updateRpgSystem }: StatsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [statForm, setStatForm] = useState<StatDefinition>({
    id: '',
    name: '',
    description: '',
    baseValue: 10,
  });

  const openModal = (stat?: StatDefinition) => {
    if (stat) {
      setEditingStatId(stat.id);
      setStatForm(stat);
    } else {
      setEditingStatId(null);
      setStatForm({
        id: '',
        name: '',
        description: '',
        baseValue: 10,
      });
    }
    setModalOpen(true);
  };

  const handleSaveStat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statForm.name.trim() || !statForm.id.trim()) return;

    updateRpgSystem((prev: any) => {
      let updatedStats = prev.stats || [];
      if (editingStatId) {
        updatedStats = updatedStats.map((s: StatDefinition) =>
          s.id === editingStatId ? statForm : s
        );
      } else {
        updatedStats = [...updatedStats, statForm];
      }
      return { ...prev, stats: updatedStats };
    });

    setModalOpen(false);
    notify.success(isPersian ? 'ویژگی ذخیره شد' : 'Attribute saved');
  };

  const handleDeleteStat = async (stat: StatDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف ویژگی' : 'Delete Attribute',
      message: isPersian
        ? `آیا از حذف ویژگی "${stat.name}" اطمینان دارید؟ تمامی مهارت‌های وابسته ممکن است تحت تاثیر قرار گیرند.`
        : `Are you sure you want to delete "${stat.name}"? Dependent skills may be affected.`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev: any) => ({
        ...prev,
        stats: (prev.stats || []).filter((s: StatDefinition) => s.id !== stat.id),
      }));
      notify.info(isPersian ? 'ویژگی حذف شد' : 'Attribute removed');
    }
  };

  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Sword className="w-4 h-4 text-amber-400" />
                <span>{isPersian ? 'ویژگی‌های اصلی کاراکتر' : 'Primary Attributes'}</span>
                <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  {stats.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isPersian ? 'آمارهای اصلی برای تست‌های تاس و چالش‌ها' : 'Core stats for resolution checks'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-xs flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ ویژگی جدید' : '+ Add Stat'}</span>
            </button>
          </div>

          {stats.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-4">
              {isPersian ? 'هیچ ویژگی اولیه‌ای تعریف نشده است.' : 'No primary attributes defined yet.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.map((stat) => (
                <div
                  key={stat.id}
                  className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">{stat.name}</span>
                      <span className="text-[10px] font-mono text-zinc-500">({stat.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                        Base: {stat.baseValue}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(stat)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteStat(stat)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{stat.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                {editingStatId ? (isPersian ? 'ویرایش ویژگی' : 'Edit Attribute') : (isPersian ? 'افزودن ویژگی اصلی' : 'Add Primary Attribute')}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStat} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'نام ویژگی' : 'Stat Name'}
                </label>
                <input
                  type="text"
                  value={statForm.name}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Cunning / Arcana / Logic"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'شناسه یکتا (ID)' : 'Internal Stat ID'}
                </label>
                <input
                  type="text"
                  value={statForm.id}
                  disabled={!!editingStatId}
                  onChange={(e) =>
                    setStatForm((prev) => ({
                      ...prev,
                      id: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                    }))
                  }
                  placeholder="e.g. cunning"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'مقدار پایه پیش‌فرض' : 'Base Value'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={statForm.baseValue}
                  onChange={(e) =>
                    setStatForm((prev) => ({
                      ...prev,
                      baseValue: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'توضیحات و کاربرد' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={statForm.description}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What actions, skill rolls, or checks does this stat govern?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold"
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
