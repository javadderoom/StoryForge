'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StatDefinition, ResourceDefinition, GameItem } from '@/lib/types';
import { notify } from '@/lib/notify';
import {
  Sword,
  Shield,
  Package,
  Dice5,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Heart,
  Zap,
  Sliders,
  Sparkles,
} from 'lucide-react';

export default function RpgMechanicsPage() {
  const { story, isPersian, updateRpgSystem } = useStudioStory();

  // Settings Edit State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    diceType: story.rpgSystem.diceType,
    inventoryCapacity: story.rpgSystem.inventoryCapacity,
    hasCombat: story.rpgSystem.hasCombat,
  });

  // Stat Modal
  const [statModalOpen, setStatModalOpen] = useState(false);
  const [editingStatId, setEditingStatId] = useState<string | null>(null);
  const [statForm, setStatForm] = useState<StatDefinition>({
    id: '',
    name: '',
    description: '',
    baseValue: 10,
  });

  // Resource Modal
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<ResourceDefinition>({
    id: '',
    name: '',
    current: 100,
    max: 100,
    min: 0,
    color: '#ef4444',
  });

  // Inventory Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<GameItem>({
    id: '',
    name: '',
    description: '',
    type: 'weapon',
    quantity: 1,
    rarity: 'common',
    grip: 'one_handed',
    statModifiers: {},
  });
  const [itemModStat, setItemModStat] = useState<string>('');
  const [itemModVal, setItemModVal] = useState<number>(1);

  const t = {
    heading: isPersian ? 'مکانیک‌های نقش‌آفرینی و آمار' : 'RPG System & Ruleset Matrix',
    subheading: isPersian
      ? 'ویژگی‌های اصلی، منابع حیاتی و ظرفیت تجهیزات این جهان'
      : 'Core attributes, vital resource pools, and starting equipment definitions.',
    primaryAttributes: isPersian ? 'ویژگی‌های اصلی کاراکتر' : 'Primary Attributes',
    vitalsAndPools: isPersian ? 'حیات و منابع (Pools)' : 'Vitals & Resource Pools',
    initialEquipment: isPersian ? 'تجهیزات اولیه' : 'Starting Inventory Items',
    diceType: isPersian ? 'نوع تاس:' : 'Dice Engine:',
    capacity: isPersian ? 'ظرفیت کوله:' : 'Inventory Cap:',
    addStat: isPersian ? '+ ویژگی جدید' : '+ Add Stat',
    addResource: isPersian ? '+ منبع جدید' : '+ Add Pool',
    addItem: isPersian ? '+ آیتم جدید' : '+ Add Item',
    editSettings: isPersian ? 'تنظیمات قوانین' : 'Edit Rules',
    save: isPersian ? 'ذخیره' : 'Save',
    cancel: isPersian ? 'انصراف' : 'Cancel',
    statName: isPersian ? 'نام ویژگی' : 'Stat Name',
    baseValue: isPersian ? 'مقدار پایه' : 'Base Value',
    description: isPersian ? 'توضیحات' : 'Description',
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateRpgSystem((prev) => ({
      ...prev,
      diceType: settingsForm.diceType,
      inventoryCapacity: settingsForm.inventoryCapacity,
      hasCombat: settingsForm.hasCombat,
    }));
    setIsEditingSettings(false);
    notify.success(isPersian ? 'تنظیمات قوانین RPG ذخیره شد' : 'RPG system rules updated');
  };

  // Stat Handlers
  const openStatModal = (stat?: StatDefinition) => {
    if (stat) {
      setEditingStatId(stat.id);
      setStatForm({ ...stat });
    } else {
      setEditingStatId(null);
      setStatForm({
        id: `stat_${Date.now().toString(36)}`,
        name: '',
        description: '',
        baseValue: 10,
      });
    }
    setStatModalOpen(true);
  };

  const handleSaveStat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statForm.name.trim()) return;

    updateRpgSystem((prev) => {
      const existing = prev.stats.find((s) => s.id === statForm.id);
      let updatedStats = prev.stats;
      if (editingStatId || existing) {
        updatedStats = prev.stats.map((s) => (s.id === (editingStatId || statForm.id) ? statForm : s));
      } else {
        updatedStats = [...prev.stats, statForm];
      }
      return { ...prev, stats: updatedStats };
    });

    setStatModalOpen(false);
    notify.success(isPersian ? 'ویژگی ذخیره شد' : 'Stat attribute saved');
  };

  const handleDeleteStat = async (stat: StatDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف ویژگی' : 'Delete Stat',
      message: isPersian
        ? `آیا از حذف ویژگی "${stat.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the stat "${stat.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev) => ({
        ...prev,
        stats: prev.stats.filter((s) => s.id !== stat.id),
      }));
      notify.info(isPersian ? 'ویژگی حذف شد' : 'Stat removed');
    }
  };

  // Resource Handlers
  const openResourceModal = (res?: ResourceDefinition) => {
    if (res) {
      setEditingResourceId(res.id);
      setResourceForm({ ...res });
    } else {
      setEditingResourceId(null);
      setResourceForm({
        id: `res_${Date.now().toString(36)}`,
        name: '',
        current: 50,
        max: 50,
        min: 0,
        color: '#3b82f6',
      });
    }
    setResourceModalOpen(true);
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceForm.name.trim()) return;

    updateRpgSystem((prev) => {
      const existing = prev.resources.find((r) => r.id === resourceForm.id);
      let updatedResources = prev.resources;
      if (editingResourceId || existing) {
        updatedResources = prev.resources.map((r) =>
          r.id === (editingResourceId || resourceForm.id) ? resourceForm : r
        );
      } else {
        updatedResources = [...prev.resources, resourceForm];
      }
      return { ...prev, resources: updatedResources };
    });

    setResourceModalOpen(false);
    notify.success(isPersian ? 'منبع حیاتی ذخیره شد' : 'Resource pool saved');
  };

  const handleDeleteResource = async (res: ResourceDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف منبع حیاتی' : 'Delete Resource',
      message: isPersian
        ? `آیا از حذف منبع "${res.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the resource pool "${res.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev) => ({
        ...prev,
        resources: prev.resources.filter((r) => r.id !== res.id),
      }));
      notify.info(isPersian ? 'منبع حذف شد' : 'Resource pool removed');
    }
  };

  // Item Handlers
  const openItemModal = (item?: GameItem) => {
    if (item) {
      setEditingItemId(item.id);
      setItemForm({ ...item });
      const firstModKey = Object.keys(item.statModifiers || {})[0] || '';
      setItemModStat(firstModKey);
      setItemModVal(firstModKey && item.statModifiers ? item.statModifiers[firstModKey] : 1);
    } else {
      setEditingItemId(null);
      setItemForm({
        id: `item_${Date.now().toString(36)}`,
        name: '',
        description: '',
        type: 'weapon',
        quantity: 1,
        rarity: 'common',
        grip: 'one_handed',
        statModifiers: {},
      });
      setItemModStat(story.rpgSystem.stats[0]?.id || '');
      setItemModVal(1);
    }
    setItemModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;

    const finalModifiers: Record<string, number> = {};
    if (itemModStat) {
      finalModifiers[itemModStat] = Number(itemModVal);
    }

    const payload: GameItem = {
      ...itemForm,
      statModifiers: Object.keys(finalModifiers).length > 0 ? finalModifiers : undefined,
    };

    updateRpgSystem((prev) => {
      let updatedItems = prev.startingInventory;
      if (editingItemId) {
        updatedItems = prev.startingInventory.map((i) => (i.id === editingItemId ? payload : i));
      } else {
        updatedItems = [...prev.startingInventory, payload];
      }
      return { ...prev, startingInventory: updatedItems };
    });

    setItemModalOpen(false);
    notify.success(isPersian ? 'آیتم ذخیره شد' : 'Starting item saved');
  };

  const handleDeleteItem = async (item: GameItem) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف آیتم' : 'Delete Item',
      message: isPersian
        ? `آیا از حذف آیتم "${item.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the item "${item.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev) => ({
        ...prev,
        startingInventory: prev.startingInventory.filter((i) => i.id !== item.id),
      }));
      notify.info(isPersian ? 'آیتم حذف شد' : 'Item removed');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info & Global Rules Settings */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
        {!isEditingSettings ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Sword className="w-5 h-5 text-amber-400" />
                <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
              </div>
              <p className="text-sm text-zinc-400">{t.subheading}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setSettingsForm({
                    diceType: story.rpgSystem.diceType,
                    inventoryCapacity: story.rpgSystem.inventoryCapacity,
                    hasCombat: story.rpgSystem.hasCombat,
                  });
                  setIsEditingSettings(true);
                }}
                className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-500/20 font-semibold cursor-pointer transition-all"
              >
                <Sliders className="w-3.5 h-3.5" />
                {t.editSettings}
              </button>
              <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
                <Dice5 className="w-3.5 h-3.5" />
                {t.diceType} {story.rpgSystem.diceType.toUpperCase()}
              </span>
              <span className="text-xs bg-zinc-800 border border-zinc-700/80 text-zinc-300 px-3 py-1.5 rounded-xl font-mono">
                {t.capacity} {story.rpgSystem.inventoryCapacity}
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sliders className="w-4 h-4" /> {t.editSettings}
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSettings(false)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="text-xs px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> {t.save}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Dice Engine</label>
                <select
                  value={settingsForm.diceType}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      diceType: e.target.value as 'd20' | '2d6' | 'd100',
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="d20">d20 (Standard D&D / High Variance)</option>
                  <option value="2d6">2d6 (Bell Curve / PbtA Style)</option>
                  <option value="d100">d100 (Percentile / Call of Cthulhu)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Inventory Capacity (Slots)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settingsForm.inventoryCapacity}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      inventoryCapacity: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Combat Mechanics Enabled</label>
                <select
                  value={settingsForm.hasCombat ? 'true' : 'false'}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      hasCombat: e.target.value === 'true',
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="true">Yes (Lethal Combat Supported)</option>
                  <option value="false">No (Pure Narrative / Investigation)</option>
                </select>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* 3-Column RPG Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Primary Stats Column */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Sword className="w-4 h-4 text-amber-400" /> {t.primaryAttributes}
                <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  {story.rpgSystem.stats.length}
                </span>
              </h3>
              <button
                onClick={() => openStatModal()}
                className="text-xs flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-2.5 py-1.5 rounded-xl border border-amber-500/30 transition-all font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addStat}
              </button>
            </div>

            <div className="space-y-3.5">
              {story.rpgSystem.stats.map((stat) => (
                <div
                  key={stat.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700 transition-all group flex items-center justify-between"
                >
                  <div className="pr-2 flex-1">
                    <h4 className="text-sm font-bold text-zinc-200">{stat.name}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">{stat.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                      {stat.baseValue}
                    </span>
                    <div className="flex items-center opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openStatModal(stat)}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStat(stat)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vitals & Resources Column */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" /> {t.vitalsAndPools}
                <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-500/20">
                  {story.rpgSystem.resources.length}
                </span>
              </h3>
              <button
                onClick={() => openResourceModal()}
                className="text-xs flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-2.5 py-1.5 rounded-xl border border-rose-500/30 transition-all font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addResource}
              </button>
            </div>

            <div className="space-y-3.5">
              {story.rpgSystem.resources.map((res) => (
                <div
                  key={res.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: res.color || '#ef4444' }}
                      />
                      <h4 className="text-sm font-bold text-zinc-200">{res.name}</h4>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openResourceModal(res)}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteResource(res)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                    <span>
                      Current: <strong className="text-zinc-200">{res.current}</strong>
                    </span>
                    <span>
                      Range: [{res.min} .. {res.max}]
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((res.current - res.min) / (res.max - res.min || 1)) * 100))}%`,
                        backgroundColor: res.color || '#ef4444',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Starting Inventory Column */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" /> {t.initialEquipment}
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {story.rpgSystem.startingInventory.length}
                </span>
              </h3>
              <button
                onClick={() => openItemModal()}
                className="text-xs flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2.5 py-1.5 rounded-xl border border-emerald-500/30 transition-all font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addItem}
              </button>
            </div>

            <div className="space-y-3.5">
              {story.rpgSystem.startingInventory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{item.name}</h4>
                      <span className="text-[10px] text-emerald-400 font-mono uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {item.type} {item.quantity > 1 ? `x${item.quantity}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openItemModal(item)}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.description}</p>
                  {item.statModifiers && Object.keys(item.statModifiers).length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex flex-wrap gap-1">
                      {Object.entries(item.statModifiers).map(([statId, mod]) => (
                        <span
                          key={statId}
                          className="text-[10px] bg-amber-500/10 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-500/20"
                        >
                          {statId}: +{mod}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stat Modal */}
      {statModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                {editingStatId ? 'Edit Attribute' : 'Add Primary Attribute'}
              </h3>
              <button
                onClick={() => setStatModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStat} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.statName}</label>
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
                <label className="block text-xs text-zinc-400 mb-1">Internal Stat ID</label>
                <input
                  type="text"
                  value={statForm.id}
                  disabled={!!editingStatId}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g. cunning"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.baseValue}</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={statForm.baseValue}
                  onChange={(e) => setStatForm((prev) => ({ ...prev, baseValue: Number(e.target.value) }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
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
                  onClick={() => setStatModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resource Modal */}
      {resourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-400" />
                {editingResourceId ? 'Edit Resource Pool' : 'Add Vital Resource Pool'}
              </h3>
              <button
                onClick={() => setResourceModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResource} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Resource Name</label>
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
                <label className="block text-xs text-zinc-400 mb-1">Resource ID</label>
                <input
                  type="text"
                  value={resourceForm.id}
                  disabled={!!editingResourceId}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g. hp"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Current</label>
                  <input
                    type="number"
                    value={resourceForm.current}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, current: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Min</label>
                  <input
                    type="number"
                    value={resourceForm.min}
                    onChange={(e) => setResourceForm((prev) => ({ ...prev, min: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max</label>
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
                <label className="block text-xs text-zinc-400 mb-1">HUD Accent Color</label>
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
                  onClick={() => setResourceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingItemId ? 'Edit Inventory Item' : 'Add Starting Item'}
              </h3>
              <button
                onClick={() => setItemModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Item Name</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Iron Dagger / Lockpicks"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Item Type</label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, type: e.target.value as GameItem['type'] }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="shield">Shield</option>
                    <option value="consumable">Consumable</option>
                    <option value="quest_item">Quest Item</option>
                    <option value="valuable">Valuable</option>
                    <option value="relic">Relic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={itemForm.description}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Physical description, history, or gameplay effect..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Stat Bonus Modifier</label>
                  <select
                    value={itemModStat}
                    onChange={(e) => setItemModStat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">(None)</option>
                    {story.rpgSystem.stats.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Bonus Amount (+)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={itemModVal}
                    onChange={(e) => setItemModVal(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
