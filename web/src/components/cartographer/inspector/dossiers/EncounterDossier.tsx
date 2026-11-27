'use client';

import React, { useMemo } from 'react';
import {
  Zap,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Skull,
  User,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import type {
  MapEntityPlacement,
  StoryEncounter,
  StoryEncounterTriggerType,
  WorldLocation,
  NPCDossier,
  WorldCreature,
  WorldArtifact,
  WorldQuest,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { SearchableCombobox, MultiSearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';

interface EncounterDossierProps {
  pin: MapEntityPlacement;
  encounter: StoryEncounter;
  locations: WorldLocation[];
  npcs: NPCDossier[];
  bestiary: WorldCreature[];
  artifacts: WorldArtifact[];
  quests: WorldQuest[];
  isPersian: boolean;
  onUpdateEncounter?: (id: string, updated: Partial<StoryEncounter>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

const TRIGGER_LABELS: Record<StoryEncounterTriggerType, { en: string; fa: string }> = {
  on_enter: { en: 'On Location Enter', fa: 'هنگام ورود به مکان' },
  on_explore: { en: 'On Explore', fa: 'هنگام کاوش' },
  threat_escalation: { en: 'Threat Escalation', fa: 'اوج‌گیری تهدید' },
  quest_milestone: { en: 'Quest Milestone', fa: 'نقطه عطف مأموریت' },
  event_chain: { en: 'Event Chain', fa: 'زنجیره رویداد' },
  item_trigger: { en: 'Item Trigger', fa: 'فعال‌سازی با شیء' },
  random_weighted: { en: 'Random Weighted', fa: 'تصادفی وزن‌دار' },
};

export const EncounterDossier: React.FC<EncounterDossierProps> = ({
  pin,
  encounter,
  locations,
  npcs,
  bestiary,
  artifacts,
  quests,
  isPersian,
  onUpdateEncounter,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const locationOptions: ComboboxOption[] = useMemo(
    () => locations.map((l) => ({ id: l.id, name: l.name, subtext: l.region || l.category })),
    [locations]
  );
  const npcOptions: ComboboxOption[] = useMemo(
    () => npcs.map((n) => ({ id: n.id, name: n.name, subtext: n.title || n.role })),
    [npcs]
  );
  const creatureOptions: ComboboxOption[] = useMemo(
    () =>
      bestiary.map((c) => ({
        id: c.id,
        name: c.name,
        badge: `D${c.dangerLevel}`,
        subtext: c.speciesCategory,
      })),
    [bestiary]
  );
  const artifactOptions: ComboboxOption[] = useMemo(
    () => artifacts.map((a) => ({ id: a.id, name: a.name, badge: a.rarity })),
    [artifacts]
  );
  const questOptions: ComboboxOption[] = useMemo(
    () => quests.map((q) => ({ id: q.id, name: q.title, subtext: q.category })),
    [quests]
  );

  const tc = encounter.triggerConditions;

  return (
    <div className="space-y-4 text-xs">
      {/* Header Card */}
      <div className="p-3.5 bg-zinc-900 border border-orange-500/35 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/35 flex items-center justify-center text-orange-400 shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={encounter.title}
            onChange={(e) => onUpdateEncounter?.(encounter.id, { title: e.target.value })}
            className="w-full bg-transparent font-bold text-zinc-100 text-sm focus:outline-none focus:border-b focus:border-orange-500/50 pb-0.5 truncate"
            placeholder={isPersian ? 'عنوان رویارویی' : 'Encounter Title'}
          />
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-300 border border-orange-500/30 text-[10px]">
              {isPersian ? TRIGGER_LABELS[tc.triggerType].fa : TRIGGER_LABELS[tc.triggerType].en}
            </span>
            {encounter.recommendedDC && (
              <span
                dir="ltr"
                className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-amber-300 border border-zinc-700 text-[10px] font-mono"
              >
                {encounter.recommendedStat ? `${encounter.recommendedStat} ` : ''}DC {encounter.recommendedDC}
              </span>
            )}
            <span dir="ltr" className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-mono">
              W:{tc.weight}
            </span>
          </div>
        </div>
      </div>

      {/* Trigger Type & Weight (static enum) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'نوع فعال‌سازی' : 'Trigger Type'}
          </label>
          <select
            value={tc.triggerType}
            onChange={(e) =>
              onUpdateEncounter?.(encounter.id, {
                triggerConditions: {
                  ...tc,
                  triggerType: e.target.value as StoryEncounterTriggerType,
                },
              })
            }
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-orange-500/50 cursor-pointer"
          >
            {(Object.keys(TRIGGER_LABELS) as StoryEncounterTriggerType[]).map((key) => (
              <option key={key} value={key}>
                {isPersian ? TRIGGER_LABELS[key].fa : TRIGGER_LABELS[key].en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'وزن وقوع (۱-۱۰۰)' : 'Weight (1-100)'}
          </label>
          <input
            type="number"
            min={1}
            max={100}
            dir="ltr"
            value={tc.weight}
            onChange={(e) =>
              onUpdateEncounter?.(encounter.id, {
                triggerConditions: {
                  ...tc,
                  weight: Math.max(1, Math.min(100, Number(e.target.value) || 50)),
                },
              })
            }
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Anchor Location */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'مکان میزبان' : 'Anchor Location'}
        </label>
        <SearchableCombobox
          value={encounter.locationId || ''}
          onChange={(id) => onUpdateEncounter?.(encounter.id, { locationId: id || undefined })}
          options={locationOptions}
          isPersian={isPersian}
          placeholder={isPersian ? 'انتخاب مکان…' : 'Select location…'}
        />
      </div>

      {/* Linked NPC & Creature */}
      <div className="grid grid-cols-1 gap-2.5">
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-medium">
            <User className="w-3 h-3 text-sky-400" />
            {isPersian ? 'شخصیت درگیر (NPC)' : 'Involved NPC'}
          </label>
          <SearchableCombobox
            value={encounter.npcId || ''}
            onChange={(id) => onUpdateEncounter?.(encounter.id, { npcId: id || undefined })}
            options={npcOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'بدون شخصیت متصل' : 'No linked NPC'}
          />
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-medium">
            <Skull className="w-3 h-3 text-rose-400" />
            {isPersian ? 'جانور / هیولای درگیر' : 'Involved Creature'}
          </label>
          <SearchableCombobox
            value={encounter.creatureId || ''}
            onChange={(id) => onUpdateEncounter?.(encounter.id, { creatureId: id || undefined })}
            options={creatureOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'بدون جانور متصل' : 'No linked creature'}
          />
        </div>
      </div>

      {/* Prompt / Situation Summary */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'شرح موقعیت و دستورالعمل رویارویی' : 'Encounter Situation Brief'}
        </label>
        <textarea
          rows={4}
          value={encounter.narrativeText}
          onChange={(e) => onUpdateEncounter?.(encounter.id, { narrativeText: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-orange-500/50 resize-y"
        />
      </div>

      {/* Rewards & Quest Link */}
      <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-medium">
            <ScrollText className="w-3 h-3 text-emerald-400" />
            {isPersian ? 'پیشبرد مأموریت پس از اتمام' : 'Advances Quest'}
          </label>
          <SearchableCombobox
            value={encounter.onComplete?.advanceQuestId || ''}
            onChange={(id) =>
              onUpdateEncounter?.(encounter.id, {
                onComplete: {
                  setFlags: encounter.onComplete?.setFlags ?? [],
                  rewardItemIds: encounter.onComplete?.rewardItemIds ?? [],
                  ...encounter.onComplete,
                  advanceQuestId: id || undefined,
                },
              })
            }
            options={questOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'مأموریتی انتخاب نشده' : 'No quest linked'}
          />
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-purple-400" />
            {isPersian ? 'جوایز شیء / عتیقه' : 'Reward Items'}
          </label>
          <MultiSearchableCombobox
            values={encounter.onComplete?.rewardItemIds ?? []}
            onChange={(ids) =>
              onUpdateEncounter?.(encounter.id, {
                onComplete: {
                  setFlags: encounter.onComplete?.setFlags ?? [],
                  ...encounter.onComplete,
                  rewardItemIds: ids,
                },
              })
            }
            options={artifactOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'افزودن عتیقه جایزه…' : 'Add reward artifact…'}
          />
        </div>
      </div>

      {/* Placement Coordinates & Layer Controls */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
        <span dir="ltr">X: {pin.x}</span>
        <span dir="ltr">Y: {pin.y}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePlacementVisibility?.(pin.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {pin.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'نمایش' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onTogglePlacementLock?.(pin.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.locked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
        >
          {pin.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'قفل' : 'Lock'}</span>
        </button>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={async () => {
            const confirmed = await notify.confirm({
              title: isPersian ? 'برداشتن سنجاق رویارویی' : 'Remove Encounter Pin',
              message: isPersian
                ? `آیا سنجاق «${encounter.title}» از نقشه برداشته شود؟`
                : `Remove pin for "${encounter.title}"?`,
            });
            if (confirmed) {
              onDeletePlacement(pin.id);
              onClose();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove Pin'}</span>
        </button>
      </div>
    </div>
  );
};
