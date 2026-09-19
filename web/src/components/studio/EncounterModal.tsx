'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  X,
  Package,
  Scroll,
  Link as LinkIcon,
  MapPin,
  Shield,
  Sparkles,
  Dices,
} from 'lucide-react';
import {
  StoryEncounter,
  StoryEncounterTriggerType,
  WorldLocation,
  WorldCreature,
  NPCDossier,
  WorldQuest,
  WorldArtifact,
} from '@/lib/types';
import { notify } from '@/lib/notify';

interface EncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (encounter: StoryEncounter) => void;
  encounter?: StoryEncounter | null;
  existingEncounters?: StoryEncounter[];
  locations?: WorldLocation[];
  creatures?: WorldCreature[];
  npcs?: NPCDossier[];
  quests?: WorldQuest[];
  artifacts?: WorldArtifact[];
  isPersian?: boolean;
}

export default function EncounterModal({
  isOpen,
  onClose,
  onSave,
  encounter,
  existingEncounters = [],
  locations = [],
  creatures = [],
  npcs = [],
  quests = [],
  artifacts = [],
  isPersian = false,
}: EncounterModalProps) {
  const isEditing = Boolean(encounter);

  const [title, setTitle] = useState('');
  const [narrativeText, setNarrativeText] = useState('');
  const [triggerType, setTriggerType] = useState<StoryEncounterTriggerType>('on_explore');
  const [locationId, setLocationId] = useState('');
  const [locationTagsInput, setLocationTagsInput] = useState('');
  const [creatureId, setCreatureId] = useState('');
  const [npcId, setNpcId] = useState('');
  const [repeatable, setRepeatable] = useState(false);
  const [weight, setWeight] = useState(50);
  const [minTensionClock, setMinTensionClock] = useState(0);

  // Item condition
  const [requiredItemId, setRequiredItemId] = useState('');
  const [consumeItemOnTrigger, setConsumeItemOnTrigger] = useState(false);

  // Quest condition
  const [requiredQuestId, setRequiredQuestId] = useState('');
  const [requiredQuestStatus, setRequiredQuestStatus] = useState<'active' | 'completed'>('active');

  // Event Chaining
  const [triggerAfterEventId, setTriggerAfterEventId] = useState('');
  const [triggerNextEventId, setTriggerNextEventId] = useState('');

  // RPG guidance
  const [recommendedStat, setRecommendedStat] = useState('agility');
  const [recommendedDC, setRecommendedDC] = useState<number>(12);

  useEffect(() => {
    if (encounter) {
      setTitle(encounter.title || '');
      setNarrativeText(encounter.narrativeText || '');
      setTriggerType(encounter.triggerConditions?.triggerType || 'on_explore');
      setLocationId(encounter.locationId || '');
      setLocationTagsInput((encounter.locationTags || []).join(', '));
      setCreatureId(encounter.creatureId || '');
      setNpcId(encounter.npcId || '');
      setRepeatable(encounter.triggerConditions?.repeatable || false);
      setWeight(encounter.triggerConditions?.weight ?? 50);
      setMinTensionClock(encounter.triggerConditions?.minTensionClock ?? 0);

      const items = encounter.triggerConditions?.requiredItemIds || [];
      setRequiredItemId(items[0] || '');
      setConsumeItemOnTrigger(encounter.triggerConditions?.consumeItemOnTrigger || false);

      setRequiredQuestId(encounter.triggerConditions?.requiredQuestId || '');
      setRequiredQuestStatus(encounter.triggerConditions?.requiredQuestStatus || 'active');

      setTriggerAfterEventId(encounter.triggerConditions?.triggerAfterEventId || '');
      setTriggerNextEventId(encounter.onComplete?.triggerNextEventId || '');

      setRecommendedStat(encounter.recommendedStat || 'agility');
      setRecommendedDC(encounter.recommendedDC || 12);
    } else {
      setTitle('');
      setNarrativeText('');
      setTriggerType('on_explore');
      setLocationId('');
      setLocationTagsInput('');
      setCreatureId('');
      setNpcId('');
      setRepeatable(false);
      setWeight(70);
      setMinTensionClock(0);
      setRequiredItemId('');
      setConsumeItemOnTrigger(false);
      setRequiredQuestId('');
      setRequiredQuestStatus('active');
      setTriggerAfterEventId('');
      setTriggerNextEventId('');
      setRecommendedStat('agility');
      setRecommendedDC(12);
    }
  }, [encounter, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim() || !narrativeText.trim()) {
      notify.error(isPersian ? 'عنوان و متن روایت الزامی هستند' : 'Title and narrative text are required');
      return;
    }

    const encId = encounter?.id || `enc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const locationTags = locationTagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const updated: StoryEncounter = {
      id: encId,
      title: title.trim(),
      narrativeText: narrativeText.trim(),
      locationId: locationId.trim() || undefined,
      locationTags,
      creatureId: creatureId.trim() || undefined,
      npcId: npcId.trim() || undefined,
      recommendedStat: recommendedStat.trim() || undefined,
      recommendedDC: recommendedDC > 0 ? recommendedDC : undefined,
      triggerConditions: {
        triggerType,
        weight,
        repeatable,
        minTensionClock: minTensionClock > 0 ? minTensionClock : undefined,
        requiredItemIds: requiredItemId.trim() ? [requiredItemId.trim()] : [],
        consumeItemOnTrigger,
        requiredQuestId: requiredQuestId.trim() || undefined,
        requiredQuestStatus: requiredQuestId.trim() ? requiredQuestStatus : undefined,
        triggerAfterEventId: triggerAfterEventId.trim() || undefined,
        requiredCompletedEventIds: [],
        forbiddenEventIds: [],
      },
      onComplete: triggerNextEventId.trim()
        ? {
            triggerNextEventId: triggerNextEventId.trim(),
            setFlags: [],
            rewardItemIds: [],
          }
        : undefined,
    };

    onSave(updated);
    notify.success(
      isPersian
        ? isEditing
          ? 'رویداد ویرایش شد'
          : 'رویداد پویا ایجاد شد'
        : isEditing
        ? 'Encounter updated'
        : 'Modular encounter created'
    );
    onClose();
  };

  const otherEncounters = existingEncounters.filter((e) => e.id !== encounter?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        dir={isPersian ? 'rtl' : 'ltr'}
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 text-zinc-100 shadow-2xl shadow-amber-500/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {isPersian
                  ? isEditing
                    ? 'ویرایش رویداد / برخورد پویا'
                    : 'ایجاد رویداد / برخورد پویای جدید'
                  : isEditing
                  ? 'Edit World Encounter'
                  : 'New Modular World Encounter'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isPersian
                  ? 'این رویداد به جای شاخه‌بندی ثابت، با شروط آیتم، ماموریت و زنجیره رویدادها در بازی فعال می‌شود.'
                  : 'Triggers conditionally based on player items, quests, biome, or chained event cascades.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-300">
              {isPersian ? 'عنوان رویداد:' : 'Encounter Title:'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPersian ? 'مثلاً: نبرد با افعی رسوبی در نیزار' : 'e.g. Sediment Viper Ambush in Reeds'}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Narrative Prose */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-300">
              {isPersian ? 'متن روایت رویداد:' : 'Narrative Prose:'}
            </label>
            <textarea
              rows={4}
              value={narrativeText}
              onChange={(e) => setNarrativeText(e.target.value)}
              placeholder={isPersian ? 'توصیف اتفاق، فضاسازی و تهدید پیش‌رو...' : 'Opening prose describing the encounter...'}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Scoped Location & Biome Tags */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span>{isPersian ? 'مکان مشخص (اختیاری):' : 'Scoped Location (optional):'}</span>
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">{isPersian ? 'همه مکان‌ها (یا بر اساس تگ)' : 'Any location (or by tag)'}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>{isPersian ? 'برچسب‌های زیست‌بوم (تگ‌ها):' : 'Biome / Location Tags:'}</span>
              </label>
              <input
                type="text"
                value={locationTagsInput}
                onChange={(e) => setLocationTagsInput(e.target.value)}
                placeholder="marsh, wilderness, riverbank"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Associated Creature & NPC */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-zinc-300">
                {isPersian ? 'موجود مرتبط از بهترین‌ها (Bestiary):' : 'Bound Creature (Bestiary):'}
              </label>
              <select
                value={creatureId}
                onChange={(e) => setCreatureId(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">{isPersian ? 'بدون موجود جانوری' : 'None'}</option>
                {creatures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-zinc-300">
                {isPersian ? 'شخصیت مرتبط (NPC):' : 'Bound NPC:'}
              </label>
              <select
                value={npcId}
                onChange={(e) => setNpcId(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">{isPersian ? 'بدون NPC مشخص' : 'None'}</option>
                {npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Trigger Mechanism & Repeatability */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>{isPersian ? 'مکانیسم راه‌انداز:' : 'Trigger Type:'}</span>
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as StoryEncounterTriggerType)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="on_explore">{isPersian ? 'کاوش / گشت‌وگذار (on_explore)' : 'Exploration Action (on_explore)'}</option>
                <option value="on_enter">{isPersian ? 'ورود به مکان (on_enter)' : 'Entering Location (on_enter)'}</option>
                <option value="item_trigger">{isPersian ? 'داشتن آیتم خاص (item_trigger)' : 'Possessing Item (item_trigger)'}</option>
                <option value="quest_milestone">{isPersian ? 'وابسته به ماموریت (quest_milestone)' : 'Quest Milestone (quest_milestone)'}</option>
                <option value="event_chain">{isPersian ? 'زنجیره پس از رویداد قبلی (event_chain)' : 'Chained After Prior Event (event_chain)'}</option>
                <option value="threat_escalation">{isPersian ? 'افزایش تنش و خطر (threat_escalation)' : 'Threat Escalation (threat_escalation)'}</option>
                <option value="random_weighted">{isPersian ? 'تاس وزنی تصادفی (random_weighted)' : 'Random Weighted Roll'}</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-300">
                <input
                  type="checkbox"
                  checked={repeatable}
                  onChange={(e) => setRepeatable(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                />
                <span>{isPersian ? 'قابلیت تکرار (چندین بار در داستان)' : 'Repeatable Encounter'}</span>
              </label>
            </div>
          </div>

          {/* Condition 1: Item Requirements */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <Package className="h-4 w-4" />
              <span>{isPersian ? 'شرط آیتم (Item Possession Trigger):' : 'Item Possession Requirement:'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <select
                  value={requiredItemId}
                  onChange={(e) => setRequiredItemId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">{isPersian ? 'بدون پیش‌نیاز آیتم' : 'No Item Requirement'}</option>
                  {artifacts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={consumeItemOnTrigger}
                    onChange={(e) => setConsumeItemOnTrigger(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                  />
                  <span>{isPersian ? 'مصرف شدن آیتم هنگام شروع رویداد' : 'Consume item upon triggering'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Condition 2: Quest Conditions */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <Scroll className="h-4 w-4" />
              <span>{isPersian ? 'شرط ماموریت (Quest Condition):' : 'Quest Status Prerequisite:'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <select
                  value={requiredQuestId}
                  onChange={(e) => setRequiredQuestId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">{isPersian ? 'بدون پیش‌نیاز ماموریت' : 'No Quest Requirement'}</option>
                  {quests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={requiredQuestStatus}
                  onChange={(e) => setRequiredQuestStatus(e.target.value as 'active' | 'completed')}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="active">{isPersian ? 'ماموریت در حال انجام باشد (Active)' : 'Quest must be Active'}</option>
                  <option value="completed">{isPersian ? 'ماموریت تکمیل شده باشد (Completed)' : 'Quest must be Completed'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Condition 3: Event Chaining */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <LinkIcon className="h-4 w-4" />
              <span>{isPersian ? 'زنجیره رویدادها (Event Chaining & Cascades):' : 'Event Cascades & Chaining:'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  {isPersian ? 'پس از اتمام رویداد زیر رخ دهد:' : 'Triggers after Event:'}
                </label>
                <select
                  value={triggerAfterEventId}
                  onChange={(e) => setTriggerAfterEventId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">{isPersian ? 'بدون پیش‌نیاز رویدادی' : 'None (Independently Triggered)'}</option>
                  {otherEncounters.map((oe) => (
                    <option key={oe.id} value={oe.id}>
                      {oe.title} ({oe.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  {isPersian ? 'پس از پایان، رویداد بعدی زیر را فراخوانی کند:' : 'Triggers Next Event upon resolution:'}
                </label>
                <select
                  value={triggerNextEventId}
                  onChange={(e) => setTriggerNextEventId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">{isPersian ? 'پایان زنجیره' : 'End of Chain'}</option>
                  {otherEncounters.map((oe) => (
                    <option key={oe.id} value={oe.id}>
                      {oe.title} ({oe.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* RPG Guidance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Dices className="h-3.5 w-3.5 text-amber-400" />
                <span>{isPersian ? 'ویژگی مهارت پیشنهادی (RPG Stat):' : 'Recommended Stat Check:'}</span>
              </label>
              <input
                type="text"
                value={recommendedStat}
                onChange={(e) => setRecommendedStat(e.target.value)}
                placeholder="agility / vigilance / might"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Dices className="h-3.5 w-3.5 text-amber-400" />
                <span>{isPersian ? 'درجه سختی تاس (Target DC):' : 'Target DC:'}</span>
              </label>
              <input
                type="number"
                value={recommendedDC}
                onChange={(e) => setRecommendedDC(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {isPersian ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:brightness-110"
          >
            <Zap className="h-4 w-4" />
            <span>{isPersian ? (isEditing ? 'بروزرسانی رویداد' : 'ذخیره رویداد') : isEditing ? 'Update Encounter' : 'Save Encounter'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
