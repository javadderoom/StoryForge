'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Heart, Plus, Edit2, Trash2, X } from 'lucide-react';
import { ResourceDefinition } from '@/lib/types';
import { notify } from '@/lib/notify';

interface ResourcesSectionProps {
  resources: ResourceDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function ResourcesSection({ resources, isPersian, updateRpgSystem }: ResourcesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceDefinition>({
    id: '',
    name: '',
    current: 100,
    max: 100,
    min: 0,
    color: '#ef4444',
  });

  const openModal = (res?: ResourceDefinition) => {
    if (res) {
      setEditingResourceId(res.id);
      setResourceForm(res);
    } else {
      setEditingResourceId(null);
      setResourceForm({
        id: '',
        name: '',
        current: 100,
        max: 100,
        min: 0,
        color: '#ef4444',
      });
    }
    setModalOpen(true);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.name.trim() || !resourceForm.id.trim()) return;

    updateRpgSystem((prev: any) => {
      let updatedResources = prev.resources || [];
      if (editingResourceId) {
        updatedResources = updatedResources.map((r: ResourceDefinition) =>
          r.id === editingResourceId ? resourceForm : r
        );
      } else {
        updatedResources = [...updatedResources, resourceForm];
      }
      return { ...prev, resources: updatedResources };
    });

    setModalOpen(false);
    notify.success(isPersian ? 'منبع حیاتی ذخیره شد' : 'Resource pool saved');
  };

  const handleDeleteResource = async (res: ResourceDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف منبع حیاتی' : 'Delete Resource Pool',
      message: isPersian
        ? `آیا از حذف منبع "${res.name}" اطمینان دارید؟ اگر این منبع سلامت اصلی باشد، مرگ بازیکن قابل محاسبه نخواهد بود.`
        : `Are you sure you want to delete "${res.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev: any) => ({
        ...prev,
        resources: (prev.resources || []).filter((r: ResourceDefinition) => r.id !== res.id),
      }));
      notify.info(isPersian ? 'منبع حذف شد' : 'Resource removed');
    }
  };

  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>{isPersian ? 'حیات و منابع (Pools)' : 'Vitals & Resource Pools'}</span>
                <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-500/20">
                  {resources.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isPersian ? 'ذخایر مصرفی مثل جان، استقامت، عقل یا اعتبار' : 'Consumable pools like HP, Mana, Sanity'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-xs flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-1.5 rounded-xl border border-rose-500/30 transition-all font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ منبع جدید' : '+ Add Pool'}</span>
            </button>
          </div>

          {resources.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-4">
              {isPersian ? 'هیچ منبع حیاتی تعریف نشده است.' : 'No resource pools defined yet.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {resources.map((res) => (
                <div
                  key={res.id}
                  className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: res.color || '#ef4444' }}
                      />
                      <span className="text-sm font-bold text-zinc-100">{res.name}</span>
                      <span className="text-[10px] font-mono text-zinc-500">({res.id})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-300 font-bold bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-700">
                        {res.min} - {res.max}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(res)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteResource(res)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resource Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" />
                {editingResourceId ? (isPersian ? 'ویرایش منبع' : 'Edit Resource Pool') : (isPersian ? 'افزودن منبع حیاتی' : 'Add Resource Pool')}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'نام منبع' : 'Resource Name'}
                </label>
                <input
                  type="text"
                  value={resourceForm.name}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Health / Stamina / Sanity / Credits"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'شناسه یکتا (ID)' : 'Internal ID'}
                </label>
                <input
                  type="text"
                  value={resourceForm.id}
                  disabled={!!editingResourceId}
                  onChange={(e) =>
                    setResourceForm((prev) => ({
                      ...prev,
                      id: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                    }))
                  }
                  placeholder="e.g. hp"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'مقدار آغازین' : 'Current'}
                  </label>
                  <input
                    type="number"
                    value={resourceForm.current}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, current: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'حداقل' : 'Min'}
                  </label>
                  <input
                    type="number"
                    value={resourceForm.min}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, min: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'حداکثر' : 'Max'}
                  </label>
                  <input
                    type="number"
                    value={resourceForm.max}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, max: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'رنگ شاخص HUD' : 'HUD Accent Color'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={resourceForm.color || '#ef4444'}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-9 w-12 bg-zinc-950 border border-zinc-700 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={resourceForm.color || '#ef4444'}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
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
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
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
