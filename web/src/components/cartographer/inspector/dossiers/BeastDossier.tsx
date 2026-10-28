'use client';

import React, { useState } from 'react';
import {
  Skull,
  Flame,
  ShieldAlert,
  Shield,
  Plus,
  X,
  MapPin,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import type { MapEntityPlacement, WorldCreature } from '@/lib/types';
import { notify } from '@/lib/notify';

interface BeastDossierProps {
  pin: MapEntityPlacement;
  creature: WorldCreature;
  isPersian: boolean;
  onUpdateCreature?: (id: string, updated: Partial<WorldCreature>) => void;
  onDeleteCreature?: (id: string) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const BeastDossier: React.FC<BeastDossierProps> = ({
  pin,
  creature,
  isPersian,
  onUpdateCreature,
  onDeleteCreature,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const [newWeaknessText, setNewWeaknessText] = useState('');
  const [newResistanceText, setNewResistanceText] = useState('');

  const dangerLevel = creature.dangerLevel || 3;
  const rarity = creature.rarity || 'common';
  const speciesCategory = creature.speciesCategory || 'beast';

  const dangerBadgeClass =
    dangerLevel === 5
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-950/40 animate-pulse'
      : dangerLevel === 4
      ? 'bg-orange-500/15 text-orange-300 border-orange-500/50'
      : dangerLevel === 3
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';

  const rarityBadgeClass =
    rarity === 'legendary'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
      : rarity === 'rare'
      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
      : rarity === 'uncommon'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
      : 'bg-zinc-800 text-zinc-300 border-zinc-700';

  return (
    <div className="space-y-4 text-xs">
      {/* Beast Card Hero Banner */}
      <div className="p-3.5 bg-gradient-to-br from-rose-950/40 via-zinc-900 to-zinc-950 border border-rose-500/30 rounded-2xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold shrink-0 ${dangerBadgeClass}`}>
              {dangerLevel >= 4 ? <Skull className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={creature.name}
                onChange={(e) => onUpdateCreature?.(creature.id, { name: e.target.value })}
                className="w-full bg-transparent font-bold text-zinc-100 text-sm focus:outline-none focus:border-b focus:border-rose-500/50 pb-0.5 truncate"
                placeholder={isPersian ? 'نام هیولا' : 'Beast Name'}
              />
              <div className="text-[10px] text-zinc-400 font-mono">
                {isPersian ? 'شناسنامه بوم‌شناسی و هیولانامه' : 'Bestiary Creature Dossier'}
              </div>
            </div>
          </div>
        </div>

        {/* Badges strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${dangerBadgeClass}`}>
            <span dir="ltr">
              {isPersian
                ? dangerLevel === 5
                  ? `خطر \u200E۵/۵ (فاجعه باستانی)`
                  : `خطر \u200E${dangerLevel}/5`
                : dangerLevel === 5
                ? `Danger 5/5 (Mythic Calamity)`
                : `Danger ${dangerLevel}/5`}
            </span>
          </span>
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border capitalize ${rarityBadgeClass}`}>
            {isPersian
              ? rarity === 'legendary'
                ? 'افسانه‌ای'
                : rarity === 'rare'
                ? 'کمیاب'
                : rarity === 'uncommon'
                ? 'غیرمعمول'
                : 'شایع'
              : rarity}
          </span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700 capitalize">
            {isPersian
              ? speciesCategory === 'beast'
                ? 'جانور طبیعی'
                : speciesCategory === 'monstrosity'
                ? 'هیولای دگرگون‌شده'
                : speciesCategory === 'undead'
                ? 'نامیرا'
                : speciesCategory === 'elemental'
                ? 'عنصری'
                : speciesCategory === 'draconic'
                ? 'اژدهاگونه'
                : speciesCategory
              : speciesCategory}
          </span>
        </div>
      </div>

      {/* Danger 5 Mythic Warning Banner */}
      {dangerLevel === 5 && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-2xl flex items-start gap-2.5 text-rose-300 animate-pulse">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            {isPersian
              ? 'هشدار فاجعه اساطیری: این موجود از مرگبارترین پدیده‌های جهان است. تیغه‌های معمولی در برخورد با آن می‌شکنند و نزدیک شدن مستقیم به آن مرگ حتمی است.'
              : 'Mythic Calamity Warning: Ordinary weapons deflect or shatter against this titan; standard direct approach results in immediate annihilation.'}
          </div>
        </div>
      )}

      {/* Danger & Rarity Quick Adjustment */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'سطح خطر (۱ تا ۵)' : 'Danger Level'}
          </label>
          <select
            value={dangerLevel}
            onChange={(e) =>
              onUpdateCreature?.(creature.id, {
                dangerLevel: Number(e.target.value) as WorldCreature['dangerLevel'],
              })
            }
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500/50 cursor-pointer"
          >
            {[1, 2, 3, 4, 5].map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl} - {lvl === 1 ? (isPersian ? 'امن و بی‌آزار' : 'Docile') : lvl === 5 ? (isPersian ? 'فاجعه باستانی' : 'Calamity') : (isPersian ? `خطرناک ${lvl}` : `Level ${lvl}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'سطح فراوانی و کمیابی' : 'Rarity / Abundance'}
          </label>
          <select
            value={rarity}
            onChange={(e) =>
              onUpdateCreature?.(creature.id, {
                rarity: e.target.value as WorldCreature['rarity'],
              })
            }
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500/50 cursor-pointer"
          >
            <option value="common">{isPersian ? 'شایع (Common)' : 'Common'}</option>
            <option value="uncommon">{isPersian ? 'غیرمعمول (Uncommon)' : 'Uncommon'}</option>
            <option value="rare">{isPersian ? 'کمیاب (Rare)' : 'Rare'}</option>
            <option value="legendary">{isPersian ? 'افسانه‌ای (Legendary)' : 'Legendary'}</option>
          </select>
        </div>
      </div>

      {/* Species Category */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'رسته زیستی (Species Category)' : 'Species Category'}
        </label>
        <select
          value={speciesCategory}
          onChange={(e) =>
            onUpdateCreature?.(creature.id, {
              speciesCategory: e.target.value as WorldCreature['speciesCategory'],
            })
          }
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500/50 cursor-pointer"
        >
          <option value="beast">{isPersian ? 'جانور طبیعی / شکاری' : 'Beast'}</option>
          <option value="monstrosity">{isPersian ? 'هیولای دگرگون‌شده' : 'Monstrosity'}</option>
          <option value="draconic">{isPersian ? 'اژدهاگونه / خزندگان کهن' : 'Draconic'}</option>
          <option value="undead">{isPersian ? 'نامیرا / شبح باستانی' : 'Undead'}</option>
          <option value="elemental">{isPersian ? 'عنصری / پدیده طبیعت' : 'Elemental'}</option>
          <option value="flora">{isPersian ? 'گیاهی / گوشتخوار' : 'Flora'}</option>
          <option value="mineral">{isPersian ? 'سنگی / کانی زیستی' : 'Mineral'}</option>
          <option value="humanoid">{isPersian ? 'شبه‌انسان / وحشی' : 'Humanoid'}</option>
        </select>
      </div>

      {/* Lore Description */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'شرح بوم‌شناسی و روایت (Lore)' : 'Sensory Lore & Ecology'}
        </label>
        <textarea
          rows={4}
          value={creature.loreDescription || ''}
          onChange={(e) => onUpdateCreature?.(creature.id, { loreDescription: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-rose-500/50 resize-none leading-relaxed"
          placeholder={isPersian ? 'شرح روایت...' : 'Creature lore and description...'}
        />
      </div>

      {/* Predator-Prey Niche */}
      {creature.predatorPreyNiche !== undefined && (
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'جایگاه در زنجیره غذایی و اکوسیستم' : 'Predator / Prey Ecological Niche'}
          </label>
          <textarea
            rows={2}
            value={creature.predatorPreyNiche || ''}
            onChange={(e) => onUpdateCreature?.(creature.id, { predatorPreyNiche: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-rose-500/50 resize-none leading-relaxed"
          />
        </div>
      )}

      {/* Behavioral Tactics */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'تاکتیک‌های رزمی، کمین و شکار' : 'Behavioral & Combat Tactics'}
        </label>
        <textarea
          rows={3}
          value={creature.behavioralTactics || ''}
          onChange={(e) => onUpdateCreature?.(creature.id, { behavioralTactics: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-rose-500/50 resize-none leading-relaxed"
        />
      </div>

      {/* Weaknesses List */}
      <div className="space-y-2">
        <label className="text-[11px] text-zinc-400 block font-medium">
          {isPersian ? 'نقاط ضعف و آسیب‌پذیری‌ها' : 'Vulnerabilities & Weaknesses'}
        </label>
        <div className="space-y-1.5">
          {(creature.weaknesses || []).map((w, idx) => (
            <div
              key={idx}
              className="p-2 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 flex items-start justify-between gap-2 text-xs"
            >
              <div className="flex items-start gap-1.5 leading-relaxed">
                <span className="text-rose-400 shrink-0 mt-0.5">•</span>
                <span>{w}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = (creature.weaknesses || []).filter((_, i) => i !== idx);
                  onUpdateCreature?.(creature.id, { weaknesses: updated });
                }}
                className="text-zinc-500 hover:text-rose-400 p-0.5 shrink-0"
                title={isPersian ? 'حذف' : 'Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newWeaknessText}
              onChange={(e) => setNewWeaknessText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWeaknessText.trim()) {
                  const updated = [...(creature.weaknesses || []), newWeaknessText.trim()];
                  onUpdateCreature?.(creature.id, { weaknesses: updated });
                  setNewWeaknessText('');
                }
              }}
              placeholder={isPersian ? 'افزودن نقطه ضعف جدید...' : 'Add weakness...'}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500/50"
            />
            <button
              type="button"
              onClick={() => {
                if (newWeaknessText.trim()) {
                  const updated = [...(creature.weaknesses || []), newWeaknessText.trim()];
                  onUpdateCreature?.(creature.id, { weaknesses: updated });
                  setNewWeaknessText('');
                }
              }}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Resistances List */}
      <div className="space-y-2">
        <label className="text-[11px] text-zinc-400 block font-medium">
          {isPersian ? 'مقاومت‌ها و برتری‌های دفاعی' : 'Resistances & Defenses'}
        </label>
        <div className="space-y-1.5">
          {(creature.resistances || []).map((r, idx) => (
            <div
              key={idx}
              className="p-2 rounded-xl bg-sky-500/5 border border-sky-500/20 text-sky-300 flex items-start justify-between gap-2 text-xs"
            >
              <div className="flex items-start gap-1.5 leading-relaxed">
                <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = (creature.resistances || []).filter((_, i) => i !== idx);
                  onUpdateCreature?.(creature.id, { resistances: updated });
                }}
                className="text-zinc-500 hover:text-rose-400 p-0.5 shrink-0"
                title={isPersian ? 'حذف' : 'Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newResistanceText}
              onChange={(e) => setNewResistanceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newResistanceText.trim()) {
                  const updated = [...(creature.resistances || []), newResistanceText.trim()];
                  onUpdateCreature?.(creature.id, { resistances: updated });
                  setNewResistanceText('');
                }
              }}
              placeholder={isPersian ? 'افزودن مقاومت جدید...' : 'Add resistance...'}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500/50"
            />
            <button
              type="button"
              onClick={() => {
                if (newResistanceText.trim()) {
                  const updated = [...(creature.resistances || []), newResistanceText.trim()];
                  onUpdateCreature?.(creature.id, { resistances: updated });
                  setNewResistanceText('');
                }
              }}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Harvestable Loot */}
      {(creature.harvestableLoot || []).length > 0 && (
        <div className="space-y-2">
          <label className="text-[11px] text-zinc-400 block font-medium">
            {isPersian ? 'غنایم و اجزای قابل استحصال (Loot)' : 'Harvestable Loot'}
          </label>
          <div className="space-y-1.5">
            {creature.harvestableLoot.map((loot, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between text-xs"
              >
                <span className="text-zinc-200">{loot.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-amber-300 font-mono">
                  {loot.dropRate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placement Coordinates & Layer controls */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
        <span dir="ltr">X: {pin.x}</span>
        <span dir="ltr">Y: {pin.y}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePlacementVisibility?.(pin.id)}
          title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {pin.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'نمایش روی نقشه' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onTogglePlacementLock?.(pin.id)}
          title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.locked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
        >
          {pin.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'قفل موقعیت' : 'Lock'}</span>
        </button>
      </div>

      {/* Action Buttons: Remove Pin vs Delete Creature */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={async () => {
            const confirmed = await notify.confirm({
              title: isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove pin from map',
              message: isPersian
                ? `آیا سنجاق هیولای "${creature.name}" از نقشه برداشته شود؟ (داده هیولا در کتاب جهان حفظ می‌شود)`
                : `Remove pin for "${creature.name}" from the map? (Creature remains in World Bible)`,
            });
            if (confirmed) {
              onDeletePlacement(pin.id);
              onClose();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove Pin from Map'}</span>
        </button>

        {onDeleteCreature && (
          <button
            type="button"
            onClick={async () => {
              const confirmed = await notify.confirm({
                title: isPersian ? 'حذف کامل هیولا از کتاب جهان' : 'Delete creature from World Bible',
                message: isPersian
                  ? `آیا از حذف کامل هیولای "${creature.name}" از کتاب جهان و تمامی نقشه‌ها اطمینان دارید؟`
                  : `Permanently delete "${creature.name}" from the Bestiary and all maps?`,
              });
              if (confirmed) {
                onDeleteCreature(creature.id);
                onClose();
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPersian ? 'حذف کامل از هیولانامه' : 'Delete Creature Permanently'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
