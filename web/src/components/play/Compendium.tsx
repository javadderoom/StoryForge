'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { RealmTheme } from '@/lib/play/realmTheme';
import { PlayerState } from '@/lib/types/gameplay';
import { GameItem } from '@/lib/types/rpg';
import {
  getEffectiveStatValue,
  RARITY_COLORS,
  isConsumableItem,
  formatStatName,
} from '@/lib/play/rpgEngine';
import { equipItem, unequipItem, consumeItem, getItem, isEquipped } from '@/lib/play/inventory';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { ItemDetailSheet } from './ItemDetailSheet';

interface CompendiumProps {
  isOpen: boolean;
  onClose: () => void;
  playerState: PlayerState;
  storyMeta: any;
  lore: { laws: any[]; locations: { id: string; name: string }[]; npcs: { id: string; name: string }[] };
  theme: RealmTheme;
  isPersian?: boolean;
  onInventoryChange: (newState: PlayerState, toast?: { kind: 'success' | 'warning' | 'info'; text: string }) => void;
}

const TABS = (isPersian: boolean) =>
  isPersian
    ? ['قهرمان', 'کوله‌پشتی', 'شخصیت‌ها', 'ماموریت‌ها', 'دانشنامه']
    : ['Hero', 'Inventory', 'NPCs', 'Quests', 'Codex'];

function npcName(lore: any, id: string): string {
  return lore.npcs.find((n: any) => n.id === id)?.name ?? id;
}
function trustTier(trust: number, isPersian: boolean) {
  if (trust >= 60) return isPersian ? 'هم‌پیمان وفادار' : 'Devoted Ally';
  if (trust >= 20) return isPersian ? 'مورد اعتماد' : 'Trusted';
  if (trust >= -20) return isPersian ? 'بی‌طرف' : 'Neutral';
  return isPersian ? 'خصم' : 'Hostile';
}
function trustColor(trust: number): string {
  if (trust >= 60) return '#10B981';
  if (trust >= 20) return '#34D399';
  if (trust >= -20) return '#F59E0B';
  return '#EF4444';
}

export function Compendium({
  isOpen,
  onClose,
  playerState,
  storyMeta,
  lore,
  theme,
  isPersian = false,
  onInventoryChange,
}: CompendiumProps) {
  const [tab, setTab] = useState(0);
  const [detailItem, setDetailItem] = useState<string | null>(null);
  if (!isOpen) return null;

  const resources = storyMeta?.rpgSystem?.resources ?? [];
  const stats = storyMeta?.rpgSystem?.stats ?? [];
  const accent = theme.primaryAccent;

  const charName =
    playerState.characterName ||
    playerState.archetypeName ||
    playerState.backgroundName ||
    (isPersian ? 'ماجراجوی بی‌نام' : 'Obsidian Adventurer');

  function handleEquip(itemId: string, slot?: 'mainHand' | 'offHand') {
    onInventoryChange(equipItem(playerState, itemId, slot));
  }
  function handleUnequip(slot: any) {
    onInventoryChange(unequipItem(playerState, slot));
  }
  function handleUse(itemId: string) {
    const { playerState: next, result } = consumeItem(playerState, itemId);
    if (result.isFull) {
      onInventoryChange(next, { kind: 'warning', text: isPersian ? 'سلامتی شما پر است؛ معجون ذخیره ماند.' : 'Already at full health; potion preserved.' });
    } else if (result.success) {
      onInventoryChange(next, { kind: 'success', text: isPersian ? `+${toPersianDigits(result.healedAmount)} سلامت بازیابی شد` : `+${result.healedAmount} HP restored` });
    }
  }

  const tabs = TABS(isPersian);

  return (
    <div className="fixed inset-0 z-[57] flex items-stretch justify-center bg-black/85 backdrop-blur-sm sm:p-6">
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-none bg-[#0B0C14] sm:rounded-3xl"
        style={{ border: `1px solid ${theme.cardBorder}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: theme.cardBorder }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" style={{ color: accent }}>📖</span>
            <span className="text-sm font-bold text-white">{isPersian ? 'دفترچه دانش' : 'COMPENDIUM'}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: theme.cardBorder }}>
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className="flex-1 py-2.5 text-[12px] font-semibold transition-colors"
              style={{ color: i === tab ? accent : '#9CA3AF', borderBottom: i === tab ? `2px solid ${accent}` : '2px solid transparent' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* HERO */}
          {tab === 0 && (
            <div className="space-y-5">
              <div className="rounded-2xl border p-4" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold" style={{ backgroundColor: `${accent}26`, color: accent }}>
                    {charName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white">{charName}</div>
                    <div className="text-[11px] text-zinc-400">
                      {[playerState.archetypeName, playerState.backgroundName].filter(Boolean).join(' • ') || (isPersian ? 'ماجراجو' : 'Adventurer')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-3">
                {resources.map((res: any) => {
                  const cur = playerState.resources?.[res.id] ?? res.current ?? 0;
                  const max = res.max ?? 100;
                  return (
                    <div key={res.id}>
                      <div className="mb-1 flex justify-between text-xs font-semibold">
                        <span className="text-zinc-300">{res.name}</span>
                        <span style={{ color: res.color }}>{toPersianDigits(cur)} / {toPersianDigits(max)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (cur / max) * 100)}%`, backgroundColor: res.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Equipment paperdoll */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{isPersian ? 'تجهیزات' : 'EQUIPMENT'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['mainHand', 'offHand', 'armor', 'relic'] as const).map((slot) => {
                    const itemId = playerState.equipment[slot];
                    const item = itemId ? getItem(playerState, itemId) : undefined;
                    const rColor = item ? RARITY_COLORS[item.rarity ?? 'common'] : '#3f3f46';
                    const slotLabel = isPersian
                      ? { mainHand: 'دست اصلی', offHand: 'دست فرعی', armor: 'زره', relic: 'دست‌سازه' }[slot]
                      : { mainHand: 'Main Hand', offHand: 'Off Hand', armor: 'Armor', relic: 'Relic' }[slot];
                    return (
                      <button
                        key={slot}
                        disabled={!item}
                        onClick={() => item && setDetailItem(item.id)}
                        className="rounded-xl border p-2.5 text-start disabled:opacity-60"
                        style={{ borderColor: `${rColor}80`, backgroundColor: `${rColor}14` }}
                      >
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: rColor }}>{slotLabel}</div>
                        <div className="truncate text-sm font-medium text-zinc-100">{item ? item.name : (isPersian ? 'خالی' : 'Empty')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attributes */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{isPersian ? 'ویژگی‌ها' : 'ATTRIBUTES'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {stats.map((s: any) => {
                    const eff = getEffectiveStatValue(playerState, s.id);
                    const mod = Math.floor((eff - 10) / 2);
                    const base = playerState.stats?.[s.id] ?? s.baseValue ?? 10;
                    const bonus = eff - base;
                    return (
                      <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-300">{formatStatName(s.id, isPersian)}</span>
                          <span className="flex items-center gap-1">
                            <span
                              className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                              style={{ color: mod >= 0 ? '#10B981' : '#EF4444', backgroundColor: mod >= 0 ? '#10B98126' : '#EF444426' }}
                            >
                              {mod >= 0 ? `+${mod}` : mod}
                            </span>
                            <span className="font-mono text-sm font-bold" style={{ color: accent }}>{toPersianDigits(eff)}</span>
                          </span>
                        </div>
                        {bonus > 0 && <div className="mt-0.5 text-[10px] text-zinc-500">(Base {toPersianDigits(base)} + Eq {toPersianDigits(bonus)})</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* INVENTORY */}
          {tab === 1 && <InventoryTab playerState={playerState} isPersian={isPersian} onOpen={setDetailItem} />}

          {/* NPCs */}
          {tab === 2 && (
            <div className="space-y-3">
              {Object.entries(playerState.relationships ?? {}).length === 0 && (
                <p className="text-xs text-zinc-500">{isPersian ? 'هنوز با کسی تعامل نداشته‌اید.' : 'No relationships yet — interact via dialogue choices.'}</p>
              )}
              {Object.entries(playerState.relationships ?? {}).map(([id, rel]: any) => {
                const t = rel.trust ?? 0;
                return (
                  <div key={id} className="rounded-2xl border p-4" style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-200">{npcName(lore, id).charAt(0).toUpperCase()}</span>
                      <div className="ml-2 flex-1">
                        <div className="text-sm font-semibold text-zinc-100">{npcName(lore, id)}</div>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: trustColor(t), backgroundColor: `${trustColor(t)}26` }}>
                        {trustTier(t, isPersian)}
                      </span>
                    </div>
                    {rel.knownSecrets?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {rel.knownSecrets.map((sec: string, i: number) => (
                          <li key={i} className="flex gap-1.5 text-[12px] text-zinc-300"><span style={{ color: accent }}>🔒</span>{sec}</li>
                        ))}
                      </ul>
                    )}
                    {rel.notes?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {rel.notes.map((n: string, i: number) => (
                          <p key={i} className="text-[12px] italic text-zinc-400">📝 {n}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* QUESTS */}
          {tab === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border px-3 py-2 text-center text-xs text-zinc-300" style={{ borderColor: theme.cardBorder, backgroundColor: theme.cardBg }}>
                {isPersian ? 'سیاهه ماجراجویی' : 'Adventure Log'}
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{isPersian ? 'اهداف فعال' : 'ACTIVE OBJECTIVES'}</div>
                {(playerState.activeQuestIds ?? []).length === 0 && <p className="text-xs text-zinc-500">{isPersian ? 'در حال حاضر هدف فعالی نداری.' : 'No active objectives.'}</p>}
                {(playerState.activeQuestIds ?? []).map((q: string) => (
                  <div key={q} className="mb-1.5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">🎯 {q}</div>
                ))}
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">{isPersian ? 'دستاوردهای تکمیل‌شده' : 'COMPLETED MILESTONES'}</div>
                {(playerState.completedQuestIds ?? []).length === 0 && <p className="text-xs text-zinc-500">{isPersian ? 'هنوز ماموریتی کامل نشده.' : 'No completed quests yet.'}</p>}
                {(playerState.completedQuestIds ?? []).map((q: string) => (
                  <div key={q} className="mb-1.5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">✓ {q}</div>
                ))}
              </div>
            </div>
          )}

          {/* CODEX */}
          {tab === 4 && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{isPersian ? 'مکان‌های کشف‌شده' : 'DISCOVERED LOCATIONS'}</div>
                <div className="space-y-1.5">
                  {(playerState.discoveredLocationIds ?? []).map((lid: string) => {
                    const loc = lore.locations.find((l: any) => l.id === lid);
                    const current = lid === playerState.currentLocationId;
                    return (
                      <div key={lid} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-[12px]">
                        <span className="text-zinc-200">{loc?.name ?? lid}</span>
                        {current && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{isPersian ? 'موقعیت فعلی' : 'Current'}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-rose-400/80">{isPersian ? 'قوانین تغییرناپذیر جهان' : 'IMMUTABLE WORLD LAWS'}</div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
                  {(lore.laws ?? []).map((law: any, i: number) => (
                    <div key={i}>
                      <div className="text-[12px] font-bold text-rose-200">⚖ {law.rule}</div>
                      <div className="text-[11px] text-zinc-400">{law.description}</div>
                    </div>
                  ))}
                  {(lore.laws ?? []).length === 0 && <p className="text-[11px] text-zinc-500">{isPersian ? 'قانونی ثبت نشده.' : 'No laws recorded.'}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ItemDetailSheet
        isOpen={!!detailItem}
        itemId={detailItem}
        playerState={playerState}
        theme={theme}
        isPersian={isPersian}
        onClose={() => setDetailItem(null)}
        onEquip={handleEquip}
        onUnequip={handleUnequip}
        onUse={handleUse}
      />
    </div>
  );
}

function InventoryTab({ playerState, isPersian, onOpen }: { playerState: PlayerState; isPersian: boolean; onOpen: (id: string) => void }) {
  const [cat, setCat] = useState('all');
  const cats = isPersian
    ? ['همه', 'سلاح‌ها', 'زره و سپر', 'مصرفی', 'دست‌سازه و ماجرایی']
    : ['All', 'Weapons', 'Armor & Shields', 'Consumables', 'Relics & Quest'];
  function matches(item: GameItem): boolean {
    if (cat === 'all') return true;
    if (cat === cats[1]) return item.type === 'weapon';
    if (cat === cats[2]) return item.type === 'armor' || item.type === 'shield';
    if (cat === cats[3]) return isConsumableItem(item);
    return item.type === 'relic' || item.type === 'quest_item';
  }
  const list = (playerState.inventory ?? []).filter(matches);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: cat === c ? '#F59E0B' : '#27272A',
              color: cat === c ? '#000' : '#A1A1AA',
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {list.map((item) => {
          const rColor = RARITY_COLORS[item.rarity ?? 'common'];
          const eq = isEquipped(playerState, item.id);
          return (
            <button
              key={item.id}
              onClick={() => onOpen(item.id)}
              className="rounded-xl border p-2.5 text-start"
              style={{ borderColor: `${rColor}80`, backgroundColor: `${rColor}12` }}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium text-zinc-100">{item.name}</span>
                {eq ? (
                  <span className="rounded bg-amber-500/20 px-1.5 text-[9px] font-bold text-amber-300">{isPersian ? 'مجهز' : 'EQ'}</span>
                ) : (
                  <span className="font-mono text-[10px] text-zinc-500">×{item.quantity}</span>
                )}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: rColor }}>{item.rarity ?? 'common'}</div>
            </button>
          );
        })}
        {list.length === 0 && <p className="col-span-2 text-xs text-zinc-500">{isPersian ? 'موردی یافت نشد.' : 'No items in this category.'}</p>}
      </div>
    </div>
  );
}
