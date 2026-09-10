'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { Package, Plus, Edit2, Trash2, X, Heart, Coins } from 'lucide-react';
import { GameItem, StatDefinition, ResourceDefinition, CurrencySystem } from '@/lib/types';
import { DEFAULT_CURRENCY_PRESETS } from '@/lib/types/rpg';
import { notify } from '@/lib/notify';

interface InventorySectionProps {
  items: GameItem[];
  stats: StatDefinition[];
  resources?: ResourceDefinition[];
  currencySystem?: CurrencySystem;
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
  quests?: Array<{ id: string; title: string }>;
}

export function InventorySection({
  items,
  stats,
  resources = [],
  currencySystem,
  isPersian,
  updateRpgSystem,
  quests = [],
}: InventorySectionProps) {
  const activeCurrency = currencySystem || DEFAULT_CURRENCY_PRESETS.fantasy;
  const baseDenom = activeCurrency.denominations[activeCurrency.denominations.length - 1];
  const baseCurrencyName = baseDenom ? (isPersian ? baseDenom.nameFa : baseDenom.nameEn) : isPersian ? 'سکه' : 'Coins';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<GameItem>({
    id: '',
    name: '',
    description: '',
    type: 'consumable',
    quantity: 1,
    rarity: 'common',
    grip: 'one_handed',
    price: 0,
    statModifiers: {},
    resourceRestoration: undefined,
    startsQuestId: undefined,
  });
  const [itemModStat, setItemModStat] = useState<string>('');
  const [itemModVal, setItemModVal] = useState<number>(1);
  const [restoreResId, setRestoreResId] = useState<string>('');
  const [restoreVal, setRestoreVal] = useState<number>(15);

  const openModal = (item?: GameItem) => {
    if (item) {
      setEditingItemId(item.id);
      setItemForm({
        ...item,
        name: item.name || '',
        description: item.description || '',
      });
      const modKey = item.statModifiers ? Object.keys(item.statModifiers)[0] : '';
      setItemModStat(modKey || '');
      setItemModVal(modKey && item.statModifiers ? item.statModifiers[modKey] : 1);

      if (item.resourceRestoration) {
        setRestoreResId(item.resourceRestoration.targetResourceId);
        setRestoreVal(item.resourceRestoration.amount);
      } else {
        setRestoreResId(resources[0]?.id || '');
        setRestoreVal(15);
      }
    } else {
      setEditingItemId(null);
      setItemForm({
        id: `item_${Date.now().toString(36)}`,
        name: '',
        description: '',
        type: 'consumable',
        quantity: 1,
        rarity: 'common',
        grip: 'one_handed',
        price: 0,
        statModifiers: {},
        resourceRestoration: undefined,
        startsQuestId: undefined,
      });
      setItemModStat('');
      setItemModVal(1);
      setRestoreResId(resources[0]?.id || '');
      setRestoreVal(15);
    }
    setModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = (itemForm.name || '').trim();
    if (!safeName) return;

    const finalModifiers: Record<string, number> = {};
    if (itemModStat) {
      finalModifiers[itemModStat] = Number(itemModVal);
    }

    const finalRestoration =
      itemForm.type === 'consumable' && restoreResId && restoreVal
        ? { targetResourceId: restoreResId, amount: Number(restoreVal) }
        : undefined;

    const payload: GameItem = {
      ...itemForm,
      name: safeName,
      description: (itemForm.description || '').trim(),
      statModifiers: Object.keys(finalModifiers).length > 0 ? finalModifiers : undefined,
      resourceRestoration: finalRestoration,
      price: itemForm.price ? Number(itemForm.price) : undefined,
      // Drop empty quest links so stale ids never persist
      startsQuestId: itemForm.startsQuestId?.trim() ? itemForm.startsQuestId.trim() : undefined,
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
                {isPersian ? 'معجون‌ها، جیره‌ها و ابزار آغازین بازیکن' : 'Consumables, supplies, and tools for the player'}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-100">{item.name}</span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                        {item.type}
                      </span>
                      {item.nonEquippable && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                          title={isPersian ? 'این آیتم قابل تجهیز نیست' : 'This item can never be equipped'}
                        >
                          {isPersian ? 'غیرقابل تجهیز' : 'non-equippable'}
                        </span>
                      )}
                      {item.startsQuestId && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          title={isPersian ? 'این آیتم یک ماموریت را فعال می‌کند' : 'Possessing this item triggers a quest'}
                        >
                          ▶ {quests.find((q) => q.id === item.startsQuestId)?.title || item.startsQuestId}
                        </span>
                      )}
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
                  {item.resourceRestoration && item.resourceRestoration.targetResourceId && (
                    <div className="mt-2 pt-1.5 border-t border-zinc-800/60 flex flex-wrap gap-1">
                      {(() => {
                        const rName =
                          resources.find((r) => r.id === item.resourceRestoration?.targetResourceId)?.name ||
                          item.resourceRestoration.targetResourceId;
                        return (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                            <Heart className="w-2.5 h-2.5 text-emerald-400" />
                            <span>
                              +{item.resourceRestoration.amount} {rName}
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  {item.price !== undefined && item.price > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-amber-300">
                      <Coins className="w-3 h-3 text-amber-400" />
                      <span>{item.price} {baseCurrencyName}</span>
                    </div>
                  )}
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'نوع آیتم' : 'Item Type'}
                  </label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, type: e.target.value as GameItem['type'] }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="consumable">{isPersian ? 'مصرفی (معجون، جیره)' : 'Consumable'}</option>
                    <option value="quest_item">{isPersian ? 'کلید / مأموریتی' : 'Quest Item / Key'}</option>
                    <option value="valuable">{isPersian ? 'کالای باارزش' : 'Valuable / Trade'}</option>
                    <option value="document">{isPersian ? 'نامه / سند' : 'Document / Map'}</option>
                    <option value="relic">{isPersian ? 'یادگار / طلسم' : 'Relic / Charm'}</option>
                    <option value="weapon">{isPersian ? 'سلاح ساده' : 'Basic Weapon'}</option>
                    <option value="armor">{isPersian ? 'زره ساده' : 'Basic Armor'}</option>
                    <option value="shield">{isPersian ? 'سپر' : 'Shield'}</option>
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
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                    dir="ltr"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? `ارزش (${baseCurrencyName})` : `Value (${baseCurrencyName})`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={itemForm.price ?? 0}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Consumable Restoration Block */}
              {itemForm.type === 'consumable' && resources.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5" />
                      <span>{isPersian ? 'بازیابی منابع حیاتی در هنگام مصرف' : 'Resource Restoration on Consumption'}</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {isPersian ? 'منبع بازیابی' : 'Restored Resource'}
                      </label>
                      <select
                        value={restoreResId}
                        onChange={(e) => setRestoreResId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">{isPersian ? '-- بدون بازیابی --' : '-- None --'}</option>
                        {resources.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">
                        {isPersian ? 'میزان بازیابی (+)' : 'Restoration Amount (+)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={restoreVal}
                        onChange={(e) => setRestoreVal(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

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

              <div>
                <label className="flex items-center gap-2 cursor-pointer bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-200">
                  <input
                    type="checkbox"
                    checked={!!itemForm.nonEquippable}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, nonEquippable: e.target.checked || undefined }))}
                    className="accent-amber-500"
                  />
                  <span>
                    {isPersian ? 'غیرقابل تجهیز (شیء داستانی/مأموریتی)' : 'Non-equippable (quest / plot token)'}
                  </span>
                </label>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {isPersian
                    ? 'نامه، کتاب، طلسم مهرشده یا سلاح تشریفاتی: در کوله می‌ماند و هیچ‌وقت تجهیز نمی‌شود.'
                    : 'Letters, books, sealed tokens, ceremonial arms: stays in the pack, never occupies a slot.'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'شروع ماموریت با این آیتم (محرک)' : 'Starts quest on pickup (trigger)'}
                </label>
                <select
                  value={itemForm.startsQuestId || ''}
                  onChange={(e) =>
                    setItemForm((prev) => ({ ...prev, startsQuestId: e.target.value || undefined }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">({isPersian ? 'هیچکدام' : 'None'})</option>
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {isPersian
                    ? 'اگر بازیکن این آیتم را به دست آورد، ماموریت انتخاب‌شده خودکار فعال می‌شود.'
                    : 'When the player obtains this item, the selected quest auto-activates.'}
                </p>
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
