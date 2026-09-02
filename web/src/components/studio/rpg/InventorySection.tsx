'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Package, Plus, Edit2, Trash2, X } from 'lucide-react';
import { GameItem, StatDefinition } from '@/lib/types';
import { notify } from '@/lib/notify';

interface InventorySectionProps {
  items: GameItem[];
  stats: StatDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function InventorySection({
  items,
  stats,
  isPersian,
  updateRpgSystem,
}: InventorySectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
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

  const openModal = (item?: GameItem) => {
    if (item) {
      setEditingItemId(item.id);
      setItemForm(item);
      const modKey = item.statModifiers ? Object.keys(item.statModifiers)[0] : '';
      setItemModStat(modKey || '');
      setItemModVal(modKey && item.statModifiers ? item.statModifiers[modKey] : 1);
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
      setItemModStat('');
      setItemModVal(1);
    }
    setModalOpen(true);
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

    updateRpgSystem((prev: any) => {
      let updatedItems = prev.startingInventory || [];
      if (editingItemId) {
        updatedItems = updatedItems.map((i: GameItem) => (i.id === editingItemId ? payload : i));
      } else {
        updatedItems = [...updatedItems, payload];
      }
      return { ...prev, startingInventory: updatedItems };
    });

    setModalOpen(false);
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
      updateRpgSystem((prev: any) => ({
        ...prev,
        startingInventory: (prev.startingInventory || []).filter((i: GameItem) => i.id !== item.id),
      }));
      notify.info(isPersian ? 'آیتم حذف شد' : 'Item removed');
    }
  };

  return (
    <>
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>{isPersian ? 'تجهیزات اولیه' : 'Starting Inventory Items'}</span>
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {items.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isPersian ? 'سلاح‌ها، معجون‌ها و ابزار آغازین بازیکن' : 'Default gear gifted to the player'}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="text-xs flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 transition-all font-semibold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ آیتم جدید' : '+ Add Item'}</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-4">
              {isPersian ? 'هیچ آیتم اولیه‌ای در کوله تعریف نشده است.' : 'No starting items defined yet.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">{item.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">×{item.quantity}</span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(item)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                          {statId}: +{String(mod)}
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

      {/* Item Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingItemId ? (isPersian ? 'ویرایش آیتم' : 'Edit Inventory Item') : (isPersian ? 'افزودن آیتم کوله' : 'Add Starting Item')}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'نام آیتم' : 'Item Name'}
                </label>
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
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'نوع آیتم' : 'Item Type'}
                  </label>
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
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'تعداد' : 'Quantity'}
                  </label>
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
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'توضیحات آیتم' : 'Description'}
                </label>
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
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'پاداش ویژگی' : 'Stat Bonus Modifier'}
                  </label>
                  <select
                    value={itemModStat}
                    onChange={(e) => setItemModStat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">(None)</option>
                    {stats.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'مقدار پاداش (+)' : 'Bonus Amount (+)'}
                  </label>
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
