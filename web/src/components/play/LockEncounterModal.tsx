'use client';

import React, { useState } from 'react';
import {
  Zap,
  X,
  Shield,
  Sparkles,
  Link as LinkIcon,
  Package,
  Scroll,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { StoryEncounter, StoryEncounterTriggerType, WorldCreature } from '@/lib/types';
import { notify } from '@/lib/notify';

interface LockEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  currentNarrative: string;
  currentLocationId: string;
  discoveredCreature?: WorldCreature | null;
  playerInventory?: Array<{ id: string; name: string }>;
  activeQuestIds?: string[];
  isRtl?: boolean;
  token?: string | null;
}

export function LockEncounterModal({
  isOpen,
  onClose,
  storyId,
  currentNarrative,
  currentLocationId,
  discoveredCreature,
  playerInventory = [],
  activeQuestIds = [],
  isRtl = true,
  token,
}: LockEncounterModalProps) {
  const [title, setTitle] = useState(
    discoveredCreature
      ? (isRtl ? `رویارویی با ${discoveredCreature.name}` : `Encounter: ${discoveredCreature.name}`)
      : (isRtl ? 'رویداد پویا' : 'Dynamic World Encounter')
  );
  const [narrativeText, setNarrativeText] = useState(currentNarrative);
  const [triggerType, setTriggerType] = useState<StoryEncounterTriggerType>('on_explore');
  const [locationId, setLocationId] = useState(currentLocationId);
  const [locationTagsInput, setLocationTagsInput] = useState('marsh, waterway, reeds');
  const [repeatable, setRepeatable] = useState(false);
  const [minTensionClock, setMinTensionClock] = useState<number>(0);

  // Item Trigger condition
  const [requiredItemId, setRequiredItemId] = useState<string>('');
  const [consumeItemOnTrigger, setConsumeItemOnTrigger] = useState(false);

  // Quest condition
  const [requiredQuestId, setRequiredQuestId] = useState<string>('');
  const [requiredQuestStatus, setRequiredQuestStatus] = useState<'active' | 'completed'>('active');

  // Event Chaining
  const [triggerAfterEventId, setTriggerAfterEventId] = useState('');
  const [triggerNextEventId, setTriggerNextEventId] = useState('');

  // RPG resolution guidance
  const [recommendedStat, setRecommendedStat] = useState('agility');
  const [recommendedDC, setRecommendedDC] = useState<number>(12);

  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim() || !narrativeText.trim()) {
      notify.error(isRtl ? 'عنوان و متن روایت الزامی هستند.' : 'Title and narrative text are required.');
      return;
    }

    setSaving(true);
    try {
      const encounterId = `enc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const locationTags = locationTagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload: StoryEncounter = {
        id: encounterId,
        title: title.trim(),
        narrativeText: narrativeText.trim(),
        creatureId: discoveredCreature?.id,
        locationId: locationId.trim() || undefined,
        locationTags,
        recommendedStat: recommendedStat.trim() || undefined,
        recommendedDC: recommendedDC > 0 ? recommendedDC : undefined,
        triggerConditions: {
          triggerType,
          weight: 70,
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

      const res = await fetch('/api/studio/encounters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ storyId, encounter: payload }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save encounter');
      }

      notify.success(
        isRtl
          ? 'رویداد پویا با موفقیت در جهان داستان قفل شد!'
          : 'World Encounter locked successfully into the story!'
      );
      onClose();
    } catch (err: any) {
      notify.error(err.message || (isRtl ? 'خطا در ثبت رویداد' : 'Error saving encounter'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-500/30 bg-zinc-950 p-6 text-zinc-100 shadow-2xl shadow-amber-500/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {isRtl ? 'قفل صحنه به عنوان رویداد / برخورد پویا' : 'Lock Scene as World Encounter'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isRtl
                  ? 'این صحنه به جای شاخه خطی، بر اساس شروط پویا در جهان داستان اجرا خواهد شد.'
                  : 'Saves this turn into the modular event pool with conditions rather than static branches.'}
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

        {/* Content Form */}
        <div className="mt-5 space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-300">
              {isRtl ? 'عنوان رویداد / برخورد:' : 'Encounter Title:'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Narrative Prose */}
          <div>
            <label className="mb-1 block font-semibold text-zinc-300">
              {isRtl ? 'متن روایت آغازین رویداد:' : 'Opening Narrative Prose:'}
            </label>
            <textarea
              rows={4}
              value={narrativeText}
              onChange={(e) => setNarrativeText(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-zinc-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Bound Creature & Location */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <MapPin className="h-3.5 w-3.5 text-amber-400" />
                <span>{isRtl ? 'شناسه مکان اختصاصی:' : 'Scoped Location ID:'}</span>
              </label>
              <input
                type="text"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="e.g. loc_pul_e_zarrin"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>{isRtl ? 'برچسب‌های زیست‌بوم (تگ‌ها):' : 'Biome / Location Tags:'}</span>
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

          {/* Trigger Type & Repeatability */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 font-semibold text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>{isRtl ? 'نوع راه‌انداز (Trigger Type):' : 'Trigger Mechanism:'}</span>
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as StoryEncounterTriggerType)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="on_explore">{isRtl ? 'کاوش در محیط (on_explore)' : 'Exploration Action (on_explore)'}</option>
                <option value="on_enter">{isRtl ? 'ورود به مکان (on_enter)' : 'Entering Location (on_enter)'}</option>
                <option value="item_trigger">{isRtl ? 'داشتن آیتم در کوله‌پشتی (item_trigger)' : 'Possessing Item (item_trigger)'}</option>
                <option value="quest_milestone">{isRtl ? 'وابسته به ماموریت (quest_milestone)' : 'Quest Milestone (quest_milestone)'}</option>
                <option value="event_chain">{isRtl ? 'زنجیره پس از رویداد قبلی (event_chain)' : 'Chained After Prior Event (event_chain)'}</option>
                <option value="threat_escalation">{isRtl ? 'افزایش تنش و خطر (threat_escalation)' : 'Threat Escalation (threat_escalation)'}</option>
                <option value="random_weighted">{isRtl ? 'شانسی وزنی (random_weighted)' : 'Random Weighted Roll'}</option>
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
                <span>{isRtl ? 'قابلیت تکرار (چندین بار در داستان)' : 'Repeatable Encounter'}</span>
              </label>
            </div>
          </div>

          {/* Condition Layer 1: Item Trigger Requirements */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <Package className="h-4 w-4" />
              <span>{isRtl ? 'شرط آیتم (Item Trigger):' : 'Item Possession Prerequisite:'}</span>
            </div>
            <p className="mb-2.5 text-[11px] text-zinc-400">
              {isRtl
                ? 'تنها در صورتی که بازیکن این آیتم یا شیء کهن را در کوله‌پشتی داشته باشد این رویداد فعال می‌شود.'
                : 'Encounter will only trigger if the player holds this specific item/relic in their inventory.'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <input
                  type="text"
                  value={requiredItemId}
                  onChange={(e) => setRequiredItemId(e.target.value)}
                  placeholder={isRtl ? 'شناسه آیتم (مثلاً item_serpent_fang)' : 'Item ID (e.g. item_serpent_fang)'}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                />
                {playerInventory.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[10px] text-zinc-500">{isRtl ? 'کوله‌پشتی فعلی:' : 'From Inventory:'}</span>
                    {playerInventory.slice(0, 4).map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setRequiredItemId(i.id)}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-amber-500/20 hover:text-amber-300"
                      >
                        {i.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={consumeItemOnTrigger}
                    onChange={(e) => setConsumeItemOnTrigger(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                  />
                  <span>{isRtl ? 'مصرف شدن آیتم هنگام شروع رویداد' : 'Consume item upon triggering'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Condition Layer 2: Quest Conditions */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <Scroll className="h-4 w-4" />
              <span>{isRtl ? 'شرط ماموریت (Quest Condition):' : 'Quest Status Prerequisite:'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <input
                  type="text"
                  value={requiredQuestId}
                  onChange={(e) => setRequiredQuestId(e.target.value)}
                  placeholder={isRtl ? 'شناسه ماموریت (اختیاری)' : 'Required Quest ID (optional)'}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                />
                {activeQuestIds.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="text-[10px] text-zinc-500">{isRtl ? 'فعال:' : 'Active:'}</span>
                    {activeQuestIds.slice(0, 3).map((qId) => (
                      <button
                        key={qId}
                        type="button"
                        onClick={() => setRequiredQuestId(qId)}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-amber-500/20 hover:text-amber-300"
                      >
                        {qId}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <select
                  value={requiredQuestStatus}
                  onChange={(e) => setRequiredQuestStatus(e.target.value as 'active' | 'completed')}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="active">{isRtl ? 'ماموریت در حال انجام باشد (Active)' : 'Quest must be Active'}</option>
                  <option value="completed">{isRtl ? 'ماموریت تکمیل شده باشد (Completed)' : 'Quest must be Completed'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Condition Layer 3: Event Chaining */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-amber-400">
              <LinkIcon className="h-4 w-4" />
              <span>{isRtl ? 'زنجیره رویدادها (Event Chaining / Cascades):' : 'Event Cascades & Chaining:'}</span>
            </div>
            <p className="mb-2.5 text-[11px] text-zinc-400">
              {isRtl
                ? 'پایان یک رویداد می‌تواند رویداد دیگری را بدون نیاز به گراف ثابت فراخوانی کند.'
                : 'Connect sequential encounters dynamically without drawing hardcoded story beat tree arrows.'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  {isRtl ? 'پس از اتمام رویداد زیر رخ دهد:' : 'Triggers after Event ID:'}
                </label>
                <input
                  type="text"
                  value={triggerAfterEventId}
                  onChange={(e) => setTriggerAfterEventId(e.target.value)}
                  placeholder="e.g. enc_viper_ambush"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-zinc-400">
                  {isRtl ? 'پس از پایان این رویداد، این رویداد فعال شود:' : 'Triggers Next Event ID upon completion:'}
                </label>
                <input
                  type="text"
                  value={triggerNextEventId}
                  onChange={(e) => setTriggerNextEventId(e.target.value)}
                  placeholder="e.g. enc_serpent_nest"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* RPG Guidance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-zinc-300">
                {isRtl ? 'ویژگی مهارت پیشنهادی (RPG Stat):' : 'Recommended Stat Check:'}
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
              <label className="mb-1 block font-semibold text-zinc-300">
                {isRtl ? 'درجه سختی تاس (Target DC):' : 'Target DC:'}
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

        {/* Action Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            {isRtl ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            <span>{saving ? (isRtl ? 'در حال ثبت...' : 'Saving...') : isRtl ? 'قفل رویداد در جهان داستان' : 'Lock Encounter'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
