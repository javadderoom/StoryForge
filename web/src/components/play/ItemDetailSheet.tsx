'use client';

import React from 'react';
import { RealmTheme } from '@/lib/play/realmTheme';
import { GameItem, ItemRarity } from '@/lib/types/rpg';
import { PlayerState } from '@/lib/types/gameplay';
import {
  RARITY_COLORS,
  RARITY_TITLES_FA,
  isConsumableItem,
  isTwoHanded,
  isOffHandOnly,
  formatStatName,
} from '@/lib/play/rpgEngine';
import { isEquipped, getItem } from '@/lib/play/inventory';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { audioService } from '@/lib/play/audioService';

interface ItemDetailSheetProps {
  isOpen: boolean;
  itemId: string | null;
  playerState: PlayerState;
  theme: RealmTheme;
  isPersian?: boolean;
  onClose: () => void;
  onEquip: (itemId: string, slot?: 'mainHand' | 'offHand') => void;
  onUnequip: (slot: 'mainHand' | 'offHand' | 'armor' | 'relic') => void;
  onUse: (itemId: string) => void;
}

function typeIcon(item: GameItem): string {
  if (item.type === 'weapon') return item.grip === 'two_handed' ? '⚔' : '🗡';
  if (item.type === 'shield' || item.grip === 'off_hand_only') return '🛡';
  if (item.type === 'relic') return '✶';
  if (item.healValue != null || item.staminaValue != null) return '🧪';
  if (isConsumableItem(item)) return '⚡';
  return '🔑';
}
function typeLabel(item: GameItem, isPersian: boolean): string {
  if (!isPersian) {
    if (item.type === 'shield' || item.grip === 'off_hand_only') return 'Shield / Off-Hand';
    if (item.grip === 'two_handed') return 'Two-Handed Weapon';
    if (item.grip === 'one_handed' || item.type === 'weapon') return 'One-Handed Weapon';
    if (item.type === 'armor') return 'Armor';
    if (item.type === 'relic') return 'Ancient Relic';
    if (item.healValue != null || item.staminaValue != null) return 'Restorative Potion';
    if (isConsumableItem(item)) return 'Tactical Consumable';
    return 'Quest Item';
  }
  if (item.type === 'shield' || item.grip === 'off_hand_only') return 'سپر و دست فرعی';
  if (item.grip === 'two_handed') return 'سلاح دو دست';
  if (item.grip === 'one_handed' || item.type === 'weapon') return 'سلاح یک‌دست';
  if (item.type === 'armor') return 'زره و بالاپوش';
  if (item.type === 'relic') return 'اثر جادویی باستانی';
  if (item.healValue != null || item.staminaValue != null) return 'معجون حیات';
  if (isConsumableItem(item)) return 'ابزار تاکتیکی مصرفی';
  return 'شیء ماجراجویی';
}

export function ItemDetailSheet({
  isOpen,
  itemId,
  playerState,
  theme,
  isPersian = false,
  onClose,
  onEquip,
  onUnequip,
  onUse,
}: ItemDetailSheetProps) {
  if (!isOpen || !itemId) return null;
  const item = getItem(playerState, itemId);
  if (!item) return null;
  const it = item;

  const rarity = (item.rarity ?? 'common') as ItemRarity;
  const rColor = RARITY_COLORS[rarity];
  const equipped = isEquipped(playerState, item.id);
  const currentSlot: 'mainHand' | 'offHand' | 'armor' | 'relic' | undefined = playerState.equipment.mainHand === item.id
    ? 'mainHand'
    : playerState.equipment.offHand === item.id
      ? 'offHand'
      : playerState.equipment.armor === item.id
        ? 'armor'
        : playerState.equipment.relic === item.id
          ? 'relic'
          : undefined;

  function handleUse() {
    onUse(it.id);
    onClose();
  }

  const accent = theme.primaryAccent;

  return (
    <div className="fixed inset-0 z-[58] flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border p-6"
        style={{ backgroundColor: '#0F111D', borderColor: `${rColor}4D`, borderTopWidth: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-11 rounded bg-white/20" />
        <div className="flex gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl"
            style={{ borderColor: `${rColor}99`, backgroundColor: `${rColor}26`, boxShadow: `0 0 16px -4px ${rColor}` }}
          >
            {typeIcon(item)}
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-white">{item.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ color: rColor, backgroundColor: `${rColor}26` }}>
                {isPersian ? RARITY_TITLES_FA[rarity] : rarity.toUpperCase()}
              </span>
              <span className="text-[12px] text-zinc-400">{typeLabel(item, isPersian)}</span>
            </div>
          </div>
        </div>

        {(item.statModifiers && Object.keys(item.statModifiers).length > 0) || item.healValue != null || item.staminaValue != null ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.statModifiers &&
              Object.entries(item.statModifiers).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1 rounded-lg border border-blue-500/50 bg-blue-500/15 px-2.5 py-1 text-[12px] font-bold text-blue-300">
                  ⚡ +{v} {formatStatName(k, isPersian)}
                </span>
              ))}
            {item.healValue != null && (
              <span className="flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300">
                ❤ +{toPersianDigits(item.healValue, isPersian)} {isPersian ? 'سلامت' : 'HP'}
              </span>
            )}
          </div>
        ) : null}

        {item.description && (
          <div className="mt-4 w-full rounded-2xl border border-white/10 bg-[#141726] p-3.5 text-[13px] leading-relaxed text-zinc-300">
            {item.description}
          </div>
        )}

        <div className="mt-5">
          {equipped ? (
            <button
              onClick={() => { audioService.playSfx('equipGear'); onUnequip(currentSlot!); onClose(); }}
              className="w-full rounded-2xl py-3 text-[13px] font-bold text-white"
              style={{ backgroundColor: '#27272A' }}
            >
              {isPersian ? 'خارج کردن از تجهیز' : 'Unequip'}
            </button>
          ) : isConsumableItem(item) ? (
            item.healValue != null || item.staminaValue != null ? (
              <button
                onClick={handleUse}
                className="w-full rounded-2xl py-3 text-[14px] font-bold text-black"
                style={{ backgroundColor: '#10B981' }}
              >
                {isPersian ? `نوشیدن معجون (+${toPersianDigits(item.healValue ?? 30, isPersian)} سلامت)` : `Drink Potion (+${item.healValue ?? 30} HP)`}
              </button>
            ) : (
              <button
                onClick={() => { audioService.playSfx('equipGear'); onClose(); }}
                className="w-full rounded-2xl py-3 text-[14px] font-bold text-white"
                style={{ backgroundColor: '#6366F1' }}
              >
                {isPersian ? 'استفاده در روایت داستان' : 'Deploy in Story Action'}
              </button>
            )
          ) : isOffHandOnly(item) || item.type === 'shield' ? (
            <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id); onClose(); }} className="w-full rounded-2xl py-3 text-[13.5px] font-bold text-black" style={{ backgroundColor: accent }}>
              {isPersian ? 'تجهیز در دست فرعی' : 'Equip in Off-Hand'}
            </button>
          ) : isTwoHanded(item) ? (
            <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id); onClose(); }} className="w-full rounded-2xl py-3 text-[13.5px] font-bold text-black" style={{ backgroundColor: accent }}>
              {isPersian ? 'تجهیز در هر دو دست' : 'Equip Two-Handed'}
            </button>
          ) : item.grip === 'one_handed' || item.type === 'weapon' ? (
            <div className="flex gap-3">
              <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id, 'mainHand'); onClose(); }} className="flex-1 rounded-2xl py-3 text-[13px] font-bold text-black" style={{ backgroundColor: accent }}>
                {isPersian ? 'دست اصلی' : 'Main Hand'}
              </button>
              <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id, 'offHand'); onClose(); }} className="flex-1 rounded-2xl border py-3 text-[13px] font-bold" style={{ color: accent, borderColor: accent }}>
                {isPersian ? 'دست فرعی' : 'Off Hand'}
              </button>
            </div>
          ) : item.type === 'armor' ? (
            <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id); onClose(); }} className="w-full rounded-2xl py-3 text-[13.5px] font-bold text-black" style={{ backgroundColor: accent }}>
              {isPersian ? 'تجهیز زره' : 'Equip Armor'}
            </button>
          ) : item.type === 'relic' ? (
            <button onClick={() => { audioService.playSfx('equipGear'); onEquip(item.id); onClose(); }} className="w-full rounded-2xl py-3 text-[13.5px] font-bold text-black" style={{ backgroundColor: accent }}>
              {isPersian ? 'تجهیز این آیتم' : 'Equip Item'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
