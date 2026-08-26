'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Sparkles, Film, ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { notify } from '@/lib/notify';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { StoryBeat, StoryChapter, ScopeTier } from '@/lib/types/world';

const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const SCOPE_OPTIONS: { value: ScopeTier; en: string; fa: string }[] = [
  { value: 'street', en: 'Street — personal stakes', fa: 'خیابانی — مخاطرات شخصی' },
  { value: 'regional', en: 'Regional — city/faction politics', fa: 'منطقه‌ای — سیاست شهر و جناح‌ها' },
  { value: 'continental', en: 'Continental — war & kingdoms', fa: 'قاره‌ای — جنگ و پادشاهی‌ها' },
  { value: 'mythic', en: 'Mythic — cosmic climax', fa: 'اسطوره‌ای — اوج کیهانی' },
];

interface ArcForm {
  title: string;
  scopeTier: ScopeTier;
  narrativeGoal: string;
  playerInvolvement: string;
  prerequisiteFlags: string;
  completionSummaryPrompt: string;
}

const EMPTY_FORM: ArcForm = {
  title: '',
  scopeTier: 'street',
  narrativeGoal: '',
  playerInvolvement: '',
  prerequisiteFlags: '',
  completionSummaryPrompt: '',
};

interface DraftScene {
  title?: string;
  settingLocationName?: string;
  narrativeText?: string;
  primaryConflict?: string;
  presentedChoices?: Array<{
    textFa?: string;
    textEn?: string;
    style?: string;
    statCheck?: { stat?: string; dc?: number };
  }>;
}

export default function NarrativeArcsPage() {
  const { story, isPersian, isRtl, updateSaga } = useStudioStory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ArcForm>(EMPTY_FORM);
  const [generatingActId, setGeneratingActId] = useState<string | null>(null);

  const chapters = useMemo(
    () => [...(story.saga?.chapters ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [story.saga]
  );

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, title: isPersian ? `پرده ${chapters.length + 1}` : `Act ${chapters.length + 1}` });
    setIsModalOpen(true);
  };

  const openEditModal = (act: StoryChapter) => {
    setEditingId(act.id);
    setForm({
      title: act.title,
      scopeTier: act.scopeTier,
      narrativeGoal: act.narrativeGoal,
      playerInvolvement: act.playerInvolvement ?? '',
      prerequisiteFlags: (act.prerequisiteFlags ?? []).join(', '),
      completionSummaryPrompt: act.completionSummaryPrompt ?? '',
    });
    setIsModalOpen(true);
  };

  const persistChapters = (mutate: (prev: StoryChapter[]) => StoryChapter[]) => {
    updateSaga((prev) => {
      const base = prev ?? {
        sagaTitle: story.title || 'Untitled Saga',
        premise: '',
        chapters: [],
      };
      return { ...base, chapters: mutate([...base.chapters]) };
    });
  };

  const handleSaveAct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.narrativeGoal.trim()) return;

    const flags = form.prerequisiteFlags
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    if (editingId) {
      persistChapters((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                title: form.title.trim(),
                scopeTier: form.scopeTier,
                narrativeGoal: form.narrativeGoal.trim(),
                playerInvolvement: form.playerInvolvement.trim() || undefined,
                prerequisiteFlags: flags,
                completionSummaryPrompt: form.completionSummaryPrompt.trim(),
              }
            : c
        )
      );
      notify.success(isPersian ? 'پرده به‌روزرسانی شد' : 'Act updated');
    } else {
      const nextNumber = chapters.length + 1;
      const newAct: StoryChapter = {
        id: makeId('act'),
        chapterNumber: nextNumber,
        title: form.title.trim(),
        scopeTier: form.scopeTier,
        narrativeGoal: form.narrativeGoal.trim(),
        playerInvolvement: form.playerInvolvement.trim() || undefined,
        prerequisiteFlags: flags,
        scenes: [],
        completionSummaryPrompt: form.completionSummaryPrompt.trim(),
      };
      persistChapters((prev) => [...prev, newAct]);
      notify.success(isPersian ? 'پرده جدید ثبت شد' : 'Act created');
    }
    setIsModalOpen(false);
  };

  const handleDeleteAct = async (act: StoryChapter) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف پرده' : 'Delete Act',
      message: isPersian
        ? `«${act.title}» و تمام ${act.scenes.length} صحنه آن حذف شود؟`
        : `Delete "${act.title}" and its ${act.scenes.length} scene(s)?`,
      confirmText: isPersian ? 'حذف' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    persistChapters((prev) =>
      prev.filter((c) => c.id !== act.id).map((c, i) => ({ ...c, chapterNumber: i + 1 }))
    );
    notify.info(isPersian ? 'پرده حذف شد' : 'Act removed');
  };

  const mapDraftScenesToBeats = (act: StoryChapter, draftScenes: DraftScene[]): StoryBeat[] => {
    const locationList = story.worldBible.locations || [];
    const defaultLocId = locationList[0]?.id || 'loc_hub';

    return draftScenes.map((sc) => {
      const matchedLoc = locationList.find((l) =>
        l.name.toLowerCase().includes((sc.settingLocationName || '').toLowerCase())
      );
      const sceneId = makeId(`arc${act.chapterNumber}_s`);
      return {
        sceneId,
        locationId: matchedLoc?.id || defaultLocId,
        narrativeText: `[${act.title}] ${sc.title || ''}\n\n${sc.narrativeText || ''}${
          sc.primaryConflict ? `\n\n⚔ ${sc.primaryConflict}` : ''
        }`.trim(),
        choices: (sc.presentedChoices || []).map((choice, idx) => ({
          id: `choice_${sceneId}_${idx + 1}`,
          text: (isPersian ? choice.textFa : choice.textEn) || choice.textEn || choice.textFa || '…',
          style:
            choice.style === 'defensive_diplomatic'
              ? ('defensive' as const)
              : choice.style === 'tactical_agile'
                ? ('agile' as const)
                : ('aggressive' as const),
          riskLevel:
            choice.style === 'aggressive_daring'
              ? ('high' as const)
              : choice.style === 'tactical_agile'
                ? ('medium' as const)
                : ('low' as const),
          targetDC: choice.statCheck?.dc,
          requiredStatId: choice.statCheck?.stat,
        })),
      };
    });
  };

  const handleGenerateScenes = async (act: StoryChapter) => {
    if (!act.narrativeGoal.trim()) {
      notify.error(isPersian ? 'ابتدا خط داستانی این پرده را بنویسید' : 'Write this act\'s storyline first');
      return;
    }
    setGeneratingActId(act.id);
    try {
      const promptParts = [
        `Act ${act.chapterNumber} — "${act.title}"`,
        `Scope tier: ${act.scopeTier}`,
        `AUTHORED STORYLINE (dramatize exactly this): ${act.narrativeGoal}`,
        act.playerInvolvement ? `PLAYER INVOLVEMENT (choices must enable this): ${act.playerInvolvement}` : '',
        (act.prerequisiteFlags ?? []).length ? `Leads from prior flags: ${(act.prerequisiteFlags ?? []).join(', ')}` : '',
      ].filter(Boolean);

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chapter_scenes',
          prompt: promptParts.join('\n'),
          themeContext: story.worldBible.themeNotes,
          worldContext: buildWorldContextString(story),
          isPersian,
        }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      const json = await res.json();
      if (!json.success || !json.data?.scenes?.length) {
        throw new Error(json.error || (isPersian ? 'پاسخ نامعتبر' : 'Invalid generation response'));
      }

      const beats = mapDraftScenesToBeats(act, json.data.scenes as DraftScene[]);
      persistChapters((prev) =>
        prev.map((c) => (c.id === act.id ? { ...c, scenes: [...c.scenes, ...beats] } : c))
      );
      notify.success(
        isPersian
          ? `${beats.length} صحنه از این روایت ساخته شد — در «سناریو» قابل ویرایش است`
          : `${beats.length} scene(s) generated from your arc — edit them in Beats`
      );
    } catch (err) {
      notify.error(err instanceof Error ? err.message : isPersian ? 'خطا در تولید صحنه‌ها' : 'Scene generation failed');
    } finally {
      setGeneratingActId(null);
    }
  };

  const scopeLabel = (tier: ScopeTier) => {
    const opt = SCOPE_OPTIONS.find((o) => o.value === tier);
    return opt ? (isPersian ? opt.fa.split(' — ')[0] : opt.en.split(' — ')[0]) : tier;
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Film className="w-6 h-6 text-amber-400" />
            {isPersian ? 'قوس‌های روایی' : 'Narrative Arcs'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            {isPersian
              ? 'اول روایت را خودت بساز: هر پرده یک خط داستانی کلی است (مثلاً: جناح الف با جناح ب در جنگ است). بعد هوش مصنوعی صحنه‌های playable را از همین روایت می‌سازد.'
              : 'Build the narrative first: each act is a high-level storyline (e.g. "Faction A is at war with Faction B"). Then let the AI generate playable scenes grounded in YOUR outline.'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-3.5 py-2 rounded-xl border border-zinc-700 font-semibold transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          {isPersian ? '+ پرده جدید' : '+ New Act'}
        </button>
      </div>

      {/* Act list */}
      {chapters.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center space-y-3">
          <Film className="w-10 h-10 mx-auto text-zinc-700" />
          <h3 className="text-sm font-bold text-zinc-300">
            {isPersian ? 'هنوز پرده‌ای نساخته‌اید' : 'No acts yet'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {isPersian
              ? 'با «پرده جدید» شروع کنید؛ مثلاً: «جناح شر کیهانی به قلمرو پادشاهی حمله می‌کند و بازیکن ممکن است در این جنگ بجنگد.»'
              : 'Start with "+ New Act" — e.g. "The cosmic evil faction invades the kingdom, and the player may take part in this war".'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((act) => (
            <div
              key={act.id}
              className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-sm flex items-center justify-center">
                    {act.chapterNumber}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-100 truncate">{act.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md uppercase">
                        {scopeLabel(act.scopeTier)}
                      </span>
                      {act.playerInvolvement && (
                        <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          {isPersian ? 'بازیکن مشارکت دارد' : 'player participates'}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500">
                        {act.scenes.length} {isPersian ? 'صحنه' : 'scene(s)'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEditModal(act)} className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800" title={isPersian ? 'ویرایش روایت' : 'Edit arc'}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteAct(act)} className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800" title={isPersian ? 'حذف' : 'Delete'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-300 leading-relaxed line-clamp-3">{act.narrativeGoal}</p>
              {act.playerInvolvement && (
                <p className="mt-2 text-[11px] text-emerald-300/90 leading-relaxed flex items-start gap-1.5">
                  <Users className="w-3 h-3 mt-0.5 shrink-0" />
                  {act.playerInvolvement}
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => handleGenerateScenes(act)}
                  disabled={generatingActId === act.id}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-950 hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50 shadow-md shadow-amber-500/20"
                >
                  <Sparkles className={`w-3 h-3 ${generatingActId === act.id ? 'animate-spin' : ''}`} />
                  {generatingActId === act.id
                    ? isPersian ? 'در حال ساخت صحنه‌ها…' : 'Generating scenes…'
                    : isPersian ? 'ساخت صحنه از این روایت' : 'Generate scenes from this arc'}
                </button>
                {act.scenes.length > 0 && (
                  <Link href="/studio/beats" className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono">
                    {isPersian ? 'ویرایش صحنه‌ها در سناریو' : 'Edit scenes in Beats'}
                    {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-400" />
                {editingId ? (isPersian ? 'ویرایش پرده' : 'Edit Act') : isPersian ? 'پرده جدید' : 'New Act'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1 rounded-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{isPersian ? 'عنوان پرده' : 'Act Title'}</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={isPersian ? 'مثلاً: جرقه جنگ' : 'e.g. The War Ignites'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{isPersian ? 'گستره (اسکوپ)' : 'Scope Tier'}</label>
                  <select
                    value={form.scopeTier}
                    onChange={(e) => setForm((p) => ({ ...p, scopeTier: e.target.value as ScopeTier }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {SCOPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {isPersian ? o.fa : o.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'خط داستانی (روایت اصلی)' : 'Storyline (the narrative itself)'}
                  <span className="text-zinc-600 ml-1">{isPersian ? '— قلب این پرده' : '— the heart of this act'}</span>
                </label>
                <textarea
                  rows={3}
                  value={form.narrativeGoal}
                  onChange={(e) => setForm((p) => ({ ...p, narrativeGoal: e.target.value }))}
                  placeholder={
                    isPersian
                      ? 'مثلاً: جناح الف با جناح ب در جنگ تمام‌عیار است؛ محاصره شهر در پیش است و...'
                      : 'e.g. Faction A is at war with Faction B; the siege of the capital begins and...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'مشارکت بازیکن' : 'Player Involvement'}
                  <span className="text-zinc-600 ml-1">({isPersian ? 'اختیاری' : 'optional'})</span>
                </label>
                <input
                  type="text"
                  value={form.playerInvolvement}
                  onChange={(e) => setForm((p) => ({ ...p, playerInvolvement: e.target.value }))}
                  placeholder={isPersian ? 'مثلاً: بازیکن ممکن است برای هر طرف جنگ بجنگد' : 'e.g. the player may fight for either side of the war'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'پیش‌نیازها (فلگ‌ها)' : 'Prerequisite Flags'}
                    <span className="text-zinc-600 ml-1">, جدا</span>
                  </label>
                  <input
                    type="text"
                    value={form.prerequisiteFlags}
                    onChange={(e) => setForm((p) => ({ ...p, prerequisiteFlags: e.target.value }))}
                    placeholder="flag_war_declared, flag_met_spy"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'دستور خلاصه پایانی' : 'Completion Summary Prompt'}
                    <span className="text-zinc-600 ml-1">({isPersian ? 'پیشرفته' : 'advanced'})</span>
                  </label>
                  <input
                    type="text"
                    value={form.completionSummaryPrompt}
                    onChange={(e) => setForm((p) => ({ ...p, completionSummaryPrompt: e.target.value }))}
                    placeholder={isPersian ? 'چطور این پرده در خاطره فشرده شود' : 'How to compress this act into a milestone'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700">
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400">
                  {isPersian ? 'ذخیره پرده' : 'Save Act'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
