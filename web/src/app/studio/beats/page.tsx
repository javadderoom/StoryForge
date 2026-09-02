'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StoryTreeCanvas } from '@/components/studio/StoryTreeCanvas';
import { buildWorldContextString, buildChapterContextString } from '@/lib/engines/narrative/worldContext';
import {
  GitBranch,
  Sparkles,
  BookOpen,
  Layers,
  Plus,
  Terminal,
  RotateCcw,
  X,
  MapPin,
  Check,
  ChevronRight,
  Shield,
  Zap,
  Sword,
  Target,
  Crown,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import {
  BranchingStoryTree,
  SagaManifest,
  StoryChapter,
  StoryBeat,
  EpicSagaSynthesis,
  EpicSagaSynthesisSchema,
} from '@/lib/types/world';

const SCOPE_TIER_META: Record<
  string,
  { labelEn: string; labelFa: string; color: string }
> = {
  street: { labelEn: 'Street', labelFa: 'خیابانی', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  regional: { labelEn: 'Regional', labelFa: 'منطقه‌ای', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  continental: { labelEn: 'Continental', labelFa: 'قاره‌ای', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  mythic: { labelEn: 'Mythic', labelFa: 'اسطوره‌ای', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
};

// Module-scope so the React Compiler never treats timestamped IDs as
// render-phase side effects.
const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export default function StoryBeatsStudioPage() {
  const { story, isPersian, updateStoryBeats, updateSaga, updateStoryMeta } = useStudioStory();

  const [aiSceneModalOpen, setAiSceneModalOpen] = useState(false);
  const [sceneLocationId, setSceneLocationId] = useState(story.worldBible.locations[0]?.id || 'loc_dungeon_cell');
  const [scenePrompt, setScenePrompt] = useState('');
  const [sceneSystemPrompt, setSceneSystemPrompt] = useState(
    story.worldBible.aiSystemPrompt ||
      (isPersian
        ? 'تو راوی ارشد بازی StoryForge هستی. صحنه را با تعلیق، انتخاب‌های معنادار و پیامدهای متناسب با قوانین جهان بنویس.'
        : 'You are the Master Storyteller for StoryForge. Generate intense story beats with branching meaningful choices.')
  );
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);

  // Plan 06: 3-Act Branching Plot Tree Synthesizer State
  const [isSynthesizingTree, setIsSynthesizingTree] = useState(false);
  const [treeSynthesisPreview, setTreeSynthesisPreview] = useState<BranchingStoryTree | null>(null);

  // Plan 07: Multi-Chapter Epic Saga state
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isSynthesizingSaga, setIsSynthesizingSaga] = useState(false);
  const [sagaPreview, setSagaPreview] = useState<SagaManifest | null>(null);
  // Plan responsiveness: mobile ⋯ overflow menu for header tools.
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  const sagaChapters: StoryChapter[] = story.saga?.chapters ?? [];
  const activeChapter = sagaChapters.find((c) => c.id === activeChapterId) || null;

  const t = {
    heading: isPersian ? 'درخت روایی و شاخه‌بندی صحنه‌ها' : 'Branching Story Beats Tree',
    subheading: isPersian
      ? 'طراحی جریان سناریو، شرایط موفقیت/شکست تاس و ساختار تصمیم‌گیری داستان'
      : 'Visual narrative flowchart editor to map scenes, decision branches, and RPG skill check checkpoints.',
    totalBeats: isPersian ? 'صحنه‌های تعریف‌شده:' : 'Defined Story Beats:',
    aiSceneBtn: isPersian ? '⚡ خلق تک‌صحنه' : '⚡ Add Single Beat',
    aiTreeBtn: isPersian ? '🌳 سنتز درخت ۳ پرده‌ای' : '🌳 Synthesize 3-Act Tree',
    aiSagaBtn: isPersian ? '👑 سنتز حماسه ۵ فصلی' : '👑 Synthesize Full 5-Chapter Epic Saga',
    flatBeatsTab: isPersian ? '📜 صحنه‌های تکی' : '📜 Flat Beats',
    addChapterBtn: isPersian ? '+ فصل جدید' : '+ Add Chapter',
    goalLabel: isPersian ? 'هدف روایی فصل:' : 'Chapter Goal:',
    prereqLabel: isPersian ? 'پیش‌نیازها:' : 'Prerequisites:',
    summaryPromptLabel: isPersian ? 'دستور خلاصه پایان فصل:' : 'Completion Rollup Prompt:',
    deleteChapterBtn: isPersian ? 'حذف فصل' : 'Delete Chapter',
  };

  const handleGenerateScene = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingScene(true);

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scene',
          taskType: 'scene',
          prompt: `${scenePrompt}. Location: ${sceneLocationId}`,
          customSystemPrompt: sceneSystemPrompt,
          themeContext: story.worldBible.themeNotes,
          // Plan 07: inside an active chapter, inject only the lore slice
          // relevant to that chapter's scope and scene locations.
          worldContext: activeChapter
            ? buildChapterContextString(
                story,
                { scopeTier: activeChapter.scopeTier, scenes: activeChapter.scenes },
                story.saga?.ledger
              )
            : buildWorldContextString(story),
          isPersian,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const beat = json.data;
        const newSceneId = makeId('scene');
        updateStoryBeats((prev) => [
          ...(prev || []),
          {
            sceneId: newSceneId,
            locationId: sceneLocationId,
            narrativeText: beat.narrativeText || (isPersian ? 'روایت جدید...' : 'New beat text...'),
            choices: (beat.choices || []).map((c: any, idx: number) => ({
              id: `choice_${newSceneId}_${idx + 1}`,
              text: c.text || (isPersian ? 'انتخاب' : 'Choice'),
              style: c.style || 'defensive',
              riskLevel: c.riskLevel || 'low',
              targetDC: c.targetDC,
              requiredStatId: c.requiredStatId,
            })),
          },
        ]);

        setAiSceneModalOpen(false);
        notify.success(
          isPersian
            ? `صحنه جدید توسط مدل ${json.modelUsed || 'AI'} با موفقیت خلق شد`
            : `New story beat synthesized by ${json.modelUsed || 'AI'}`
        );
      } else {
        notify.error(isPersian ? 'خطا در خلق صحنه' : 'Failed to generate scene');
      }
    } catch {
      notify.error(isPersian ? 'خطا در ارتباط با هوش مصنوعی' : 'AI connection error');
    } finally {
      setIsGeneratingScene(false);
    }
  };

  // ----------------------------------------------------------------
  // Plan 06: 3-Act Branching Plot Tree Synthesizer
  // ----------------------------------------------------------------
  const handleSynthesizeStoryTree = async () => {
    try {
      setIsSynthesizingTree(true);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'branching_story_tree',
          prompt: 'Synthesize a cohesive 3-Act branching narrative structure with 3 distinct choice archetypes (defensive/diplomatic, tactical/agile, aggressive/daring) per scene.',
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to synthesize story tree (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.acts) && json.data.acts.length === 3) {
        setTreeSynthesisPreview(json.data);
      } else {
        notify.error(isPersian ? 'قالب درخت روایی ۳ پرده‌ای نامعتبر بود' : 'Invalid 3-act story tree response');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error synthesizing story tree');
    } finally {
      setIsSynthesizingTree(false);
    }
  };

  const handleCommitStoryTree = () => {
    if (!treeSynthesisPreview) return;

    const allNewBeats: any[] = [];
    const locationList = story.worldBible.locations || [];
    const defaultLocId = locationList[0]?.id || 'loc_hub';

    for (const act of treeSynthesisPreview.acts) {
      for (const scene of act.scenes) {
        const matchedLoc = locationList.find((l) =>
          l.name.toLowerCase().includes(scene.settingLocationName.toLowerCase())
        );

        allNewBeats.push({
          sceneId: scene.sceneId || `scene_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          locationId: matchedLoc ? matchedLoc.id : defaultLocId,
          narrativeText: `[${act.actTitle}] ${scene.title}\n\n${scene.primaryConflict}`,
          choices: scene.presentedChoices.map((choice, idx) => ({
            id: `choice_${scene.sceneId}_${idx + 1}`,
            text: isPersian ? choice.textFa : choice.textEn,
            style: choice.style === 'defensive_diplomatic' ? 'defensive' : choice.style === 'tactical_agile' ? 'agile' : 'aggressive',
            riskLevel: choice.style === 'aggressive_daring' ? 'high' : choice.style === 'tactical_agile' ? 'medium' : 'low',
            targetDC: choice.statCheck?.dc,
            requiredStatId: choice.statCheck?.stat,
            destinationSceneId: choice.leadToSceneId,
          })),
        });
      }
    }

    updateStoryBeats(() => allNewBeats);
    setTreeSynthesisPreview(null);
    notify.success(
      isPersian
        ? `درخت روایی ۳ پرده‌ای شامل ${allNewBeats.length} صحنه با موفقیت تزریق شد`
        : `Committed 3-Act branching tree with ${allNewBeats.length} scenes to narrative beats`
    );
  };

  // ----------------------------------------------------------------
  // Plan 07: Multi-Arc Epic Saga Synthesizer (5-chapter campaign)
  // ----------------------------------------------------------------
  const normalizeSagaFromDraft = (draft: EpicSagaSynthesis): SagaManifest => {
    const locationList = story.worldBible.locations || [];
    const defaultLocId = locationList[0]?.id || 'loc_hub';

    const chapters: StoryChapter[] = draft.chapters
      .slice()
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map((ch, i) => {
        const chapterId = makeId(`chapter${ch.chapterNumber || i + 1}`);
        const scenes: StoryBeat[] = (ch.scenes || []).map((sc) => {
          const matchedLoc = locationList.find((l) =>
            l.name.toLowerCase().includes(sc.settingLocationName.toLowerCase())
          );
          const sceneId = sc.sceneId || `scene_${chapterId}_${Math.random().toString(36).slice(2, 6)}`;
          return {
            sceneId,
            locationId: matchedLoc?.id || defaultLocId,
            narrativeText: `[${ch.title}] ${sc.title}\n\n${sc.primaryConflict}`,
            choices: (sc.presentedChoices || []).map((choice, idx) => ({
              id: `choice_${sceneId}_${idx + 1}`,
              text: isPersian ? choice.textFa : choice.textEn,
              style:
                choice.style === 'defensive_diplomatic'
                  ? 'defensive'
                  : choice.style === 'tactical_agile'
                  ? 'agile'
                  : 'aggressive',
              riskLevel:
                choice.style === 'aggressive_daring'
                  ? 'high'
                  : choice.style === 'tactical_agile'
                  ? 'medium'
                  : 'low',
              targetDC: choice.statCheck?.dc,
              requiredStatId: choice.statCheck?.stat,
              targetSceneId: choice.leadToSceneId,
            })),
          };
        });

        return {
          id: chapterId,
          chapterNumber: ch.chapterNumber || i + 1,
          title: ch.title,
          scopeTier: ch.scopeTier,
          narrativeGoal: ch.narrativeGoal || '',
          prerequisiteFlags: ch.prerequisiteFlags || [],
          scenes,
          completionSummaryPrompt: ch.completionSummaryPrompt || '',
        };
      });

    return {
      sagaTitle: draft.sagaTitle,
      premise: draft.premise,
      chapters,
      ledger: {
        factionReputations: [],
        npcStatuses: [],
        keyItems: [],
        chapterSummaries: [],
        openPlotThreads: [],
      },
    };
  };

  const handleSynthesizeEpicSaga = async () => {
    try {
      setIsSynthesizingSaga(true);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'epic_saga_synthesis',
          prompt:
            'Synthesize a cohesive 5-chapter epic saga with escalating scope tiers and dramatic branching checkpoints grounded in this world.',
          themeContext: story.worldBible.themeNotes,
          worldContext: buildWorldContextString(story),
          isPersian,
        }),
      });

      if (!res.ok) throw new Error(`Failed to synthesize saga (${res.status})`);
      const json = await res.json();

      const parsed = EpicSagaSynthesisSchema.safeParse(json?.data);
      if (!parsed.success) {
        notify.error(isPersian ? 'قالب حماسه چندفصلی نامعتبر بود' : 'Invalid epic saga response');
        return;
      }

      setSagaPreview(normalizeSagaFromDraft(parsed.data));
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : 'Error synthesizing epic saga'
      );
    } finally {
      setIsSynthesizingSaga(false);
    }
  };

  const handleCommitSaga = () => {
    if (!sagaPreview) return;
    updateSaga(() => sagaPreview);
    setActiveChapterId(sagaPreview.chapters[0]?.id || null);
    setSagaPreview(null);
    notify.success(
      isPersian
        ? `حماسه «${sagaPreview.sagaTitle}» با ${sagaPreview.chapters.length} فصل ثبت شد`
        : `Epic saga "${sagaPreview.sagaTitle}" committed with ${sagaPreview.chapters.length} chapters`
    );
  };

  const handleAddChapter = () => {
    const nextNumber = sagaChapters.length + 1;
    const newChapter: StoryChapter = {
      id: makeId('chapter'),
      chapterNumber: nextNumber,
      title: isPersian ? `فصل ${nextNumber}` : `Chapter ${nextNumber}`,
      scopeTier: nextNumber <= 1 ? 'street' : nextNumber === 2 ? 'regional' : nextNumber < 5 ? 'continental' : 'mythic',
      narrativeGoal: '',
      prerequisiteFlags: [],
      scenes: [],
      completionSummaryPrompt: '',
    };
    updateSaga(
      (prev) =>
        prev
          ? { ...prev, chapters: [...prev.chapters, newChapter] }
          : { sagaTitle: story.title || 'Untitled Saga', premise: '', chapters: [newChapter] }
    );
    setActiveChapterId(newChapter.id);
  };

  const handleDeleteChapter = (chapterId: string) => {
    const remaining = sagaChapters.filter((c) => c.id !== chapterId);
    updateSaga((prev) =>
      prev
        ? { ...prev, chapters: remaining.map((c, i) => ({ ...c, chapterNumber: i + 1 })) }
        : { sagaTitle: story.title || 'Untitled Saga', premise: '', chapters: [] }
    );
    if (activeChapterId === chapterId) setActiveChapterId(null);
    notify.info(isPersian ? 'فصل حذف شد' : 'Chapter removed');
  };

  const handleUpdateChapterGoal = (chapterId: string, goal: string) => {
    updateSaga((prev) =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters.map((c) => (c.id === chapterId ? { ...c, narrativeGoal: goal } : c)),
          }
        : { sagaTitle: story.title || 'Untitled Saga', premise: '', chapters: [] }
    );
  };

  const handleChapterScenesChange = (scenes: StoryBeat[]) => {
    if (!activeChapter) return;
    updateSaga((prev) =>
      prev
        ? { ...prev, chapters: prev.chapters.map((c) => (c.id === activeChapter.id ? { ...c, scenes } : c)) }
        : { sagaTitle: story.title || 'Untitled Saga', premise: '', chapters: [] }
    );
  };

  const getChoiceStyleMeta = (style: string) => {
    switch (style) {
      case 'defensive_diplomatic':
        return { label: isPersian ? 'دیپلماتیک / دفاعی' : 'Defensive / Diplomatic', icon: Shield, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'tactical_agile':
        return { label: isPersian ? 'تاکتیکی / چابک' : 'Tactical / Agile', icon: Zap, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
      case 'aggressive_daring':
        return { label: isPersian ? 'تهاجمی / پرخطر' : 'Aggressive / Daring', icon: Sword, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      default:
        return { label: style, icon: Target, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
    }
  };

  // Plan responsiveness: single source for header actions (inline on desktop,
  // collapsed into the ⋯ overflow menu on mobile).
  const headerActions = [
    {
      key: 'saga',
      label:
        isSynthesizingSaga
          ? isPersian
            ? 'در حال سنتز حماسه...'
            : 'Synthesizing Saga...'
          : t.aiSagaBtn,
      icon: Crown,
      onClick: handleSynthesizeEpicSaga,
      disabled: isSynthesizingSaga,
      className:
        'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 shadow-amber-500/20',
    },
    {
      key: 'tree',
      label:
        isSynthesizingTree
          ? isPersian
            ? 'سنتز درخت ۳ پرده‌ای...'
            : 'Synthesizing Tree...'
          : t.aiTreeBtn,
      icon: Sparkles,
      onClick: handleSynthesizeStoryTree,
      disabled: isSynthesizingTree,
      className:
        'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20',
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      {/* Header Banner — z-40 lifts it (and any popup inside it) above the
          canvas despite the backdrop-blur stacking-context trap */}
      <div className="relative z-40 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <GitBranch className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{t.subheading}</p>
        </div>
        {/* Plan responsiveness: config-driven actions — inline on desktop,
            collapsed into a ⋯ overflow menu on mobile. */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Mobile group */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setAiSceneModalOpen(true)}
              title={t.aiSceneBtn}
              className="flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-zinc-950 w-9 h-9 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-2 rounded-xl font-mono flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              {(activeChapter ? activeChapter.scenes.length : story.initialStoryBeats?.length) || 0}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionsMenuOpen((v) => !v)}
                title={isPersian ? 'ابزارها' : 'Tools'}
                className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer ${
                  actionsMenuOpen
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {actionsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[99]" onClick={() => setActionsMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-[100] w-60 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 space-y-1 animate-fadeIn">
                    {headerActions.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        disabled={a.disabled}
                        onClick={() => {
                          setActionsMenuOpen(false);
                          a.onClick();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 text-start cursor-pointer"
                      >
                        <a.icon className="w-4 h-4 shrink-0" />
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop group */}
          {headerActions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className={`hidden md:flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-lg cursor-pointer disabled:opacity-50 ${a.className}`}
            >
              <a.icon className="w-3.5 h-3.5" />
              <span>{a.label}</span>
            </button>
          ))}
          <button
            onClick={() => setAiSceneModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.aiSceneBtn}
          </button>
          <span className="hidden md:flex text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-2 rounded-xl font-mono items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {(activeChapter ? activeChapter.scenes.length : story.initialStoryBeats?.length) || 0}{' '}
            {isPersian ? 'صحنه' : 'Beats'}
          </span>
        </div>
      </div>

      {/* Chapter Tabs (Campaign Flowchart Navigation) */}
      <div className="relative z-40 flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setActiveChapterId(null)}
          className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
            !activeChapter
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          {t.flatBeatsTab}
        </button>
        {sagaChapters.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />}
        {sagaChapters.map((ch) => {
          const meta = SCOPE_TIER_META[ch.scopeTier] || SCOPE_TIER_META.street;
          const isActive = activeChapter?.id === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => setActiveChapterId(ch.id)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                isActive
                  ? `${meta.color} ring-2 ring-offset-0`
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <span className="font-mono opacity-70">#{ch.chapterNumber}</span>
              <span className="max-w-[160px] truncate">{ch.title}</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-mono ${meta.color}`}>
                {isPersian ? meta.labelFa : meta.labelEn}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleAddChapter}
          className="shrink-0 whitespace-nowrap flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-bold border border-dashed border-zinc-700 text-zinc-500 hover:text-amber-300 hover:border-amber-500/50 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.addChapterBtn}
        </button>
      </div>

      {/* Target Milestone / Narrative Gap-Filler Control Bar */}
      <div className="bg-gradient-to-r from-amber-950/25 via-zinc-900/85 to-zinc-900/85 border border-amber-500/30 rounded-2xl p-4 shadow-xl space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Target className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isPersian
                ? 'برخورد هدف روایی (پر کردن شکاف توسط هوش مصنوعی)'
                : 'Target Encounter Milestone (AI Gap-Filler)'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-400">
            {isPersian
              ? 'هوش مصنوعی مسیر را به شکل نامحسوس تا این برخورد خلق می‌کند؛ نیازی به کشیدن خط و ربط دستی نیست.'
              : 'The AI will naturally bridge the turns toward this encounter; no manual arrows required.'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={activeChapter ? activeChapter.narrativeGoal : (story.activeMilestoneGoal || '')}
            onChange={(e) => {
              const val = e.target.value;
              if (activeChapter) {
                handleUpdateChapterGoal(activeChapter.id, val);
              } else {
                updateStoryMeta({ activeMilestoneGoal: val });
              }
            }}
            placeholder={
              isPersian
                ? 'مثلاً: رویارویی با NPC شماره ۱۲ در کوچه تاریک برای دریافت طومار رمزنگاری‌شده...'
                : 'e.g., Cross paths with NPC #12 in the dark alley to receive the encrypted scroll...'
            }
            className="w-full sm:flex-1 bg-zinc-950 border border-zinc-700/80 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all"
          />
          {story.initialStoryBeats && story.initialStoryBeats.length > 1 && (
            <select
              onChange={(e) => {
                const targetScene = story.initialStoryBeats.find((b) => b.sceneId === e.target.value);
                if (targetScene) {
                  const goalSnippet = targetScene.narrativeText.slice(0, 120).replace(/\n/g, ' ');
                  if (activeChapter) {
                    handleUpdateChapterGoal(activeChapter.id, goalSnippet);
                  } else {
                    updateStoryMeta({ activeMilestoneGoal: goalSnippet });
                  }
                }
              }}
              defaultValue=""
              className="w-full sm:w-auto shrink-0 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2.5 text-xs text-amber-300 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                {isPersian ? '📌 تنظیم بر اساس یکی از صحنه‌ها...' : '📌 Quick-fill from a scene...'}
              </option>
              {story.initialStoryBeats.map((b, i) => (
                <option key={b.sceneId} value={b.sceneId}>
                  #{i + 1}: {b.sceneId} ({b.locationId || 'مکان نامشخص'})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Active Chapter Briefing Strip */}
      {activeChapter && (
        <div className="bg-gradient-to-r from-purple-950/40 via-zinc-900/60 to-zinc-900/60 border border-purple-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <h4 className="text-sm font-bold text-purple-200 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  {activeChapter.chapterNumber}. {activeChapter.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-mono shrink-0 ${
                    (SCOPE_TIER_META[activeChapter.scopeTier] || SCOPE_TIER_META.street).color
                  }`}
                >
                  {isPersian
                    ? (SCOPE_TIER_META[activeChapter.scopeTier] || SCOPE_TIER_META.street).labelFa
                    : (SCOPE_TIER_META[activeChapter.scopeTier] || SCOPE_TIER_META.street).labelEn}
                </span>
              </h4>
              {activeChapter.prerequisiteFlags.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400">{t.prereqLabel}</span>
                  {activeChapter.prerequisiteFlags.map((flag) => (
                    <span
                      key={flag}
                      dir="ltr"
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDeleteChapter(activeChapter.id)}
              title={t.deleteChapterBtn}
              className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Story Tree Canvas */}
      <StoryTreeCanvas
        story={story}
        isPersian={isPersian}
        chapter={activeChapter || undefined}
        onScenesChange={handleChapterScenesChange}
      />

      {/* Plan 06: 3-Act Branching Plot Tree Synthesis Preview Modal */}
      {treeSynthesisPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {isPersian ? 'پیش‌نمایش درخت روایی ۳ پرده‌ای' : '3-Act Branching Narrative Tree Preview'}
              </h3>
              <button
                onClick={() => setTreeSynthesisPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <h4 className="font-bold text-amber-300 text-sm">{treeSynthesisPreview.title}</h4>
              <p className="text-zinc-300 leading-relaxed italic">{treeSynthesisPreview.premise}</p>
            </div>

            {/* Acts & Scenes List */}
            <div className="space-y-4">
              {treeSynthesisPreview.acts.map((act) => (
                <div key={act.actNumber} className="space-y-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-zinc-800">
                    <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold font-mono">
                      Act {act.actNumber}
                    </span>
                    <strong className="text-zinc-200 text-xs">{act.actTitle}</strong>
                  </div>

                  <div className="space-y-2 pl-2">
                    {act.scenes.map((scene, sIdx) => (
                      <div
                        key={sIdx}
                        className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-zinc-100">{scene.title}</strong>
                          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {scene.settingLocationName}
                          </span>
                        </div>

                        <p className="text-zinc-300 text-[11px] leading-relaxed">{scene.primaryConflict}</p>

                        <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                          <span className="text-[10px] text-zinc-500 block">
                            {isPersian ? 'انتخاب‌های ۳ گانه صحنه:' : 'Three-Tier Choices:'}
                          </span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {scene.presentedChoices.map((ch, cIdx) => {
                              const meta = getChoiceStyleMeta(ch.style);
                              const Icon = meta.icon;
                              return (
                                <div
                                  key={cIdx}
                                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-start gap-2 text-[11px]"
                                >
                                  <span className={`px-2 py-0.5 rounded-lg border text-[9.5px] font-bold shrink-0 flex items-center gap-1 mt-0.5 ${meta.color}`}>
                                    <Icon className="w-2.5 h-2.5" />
                                    {meta.label}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-zinc-200">{isPersian ? ch.textFa : ch.textEn}</p>
                                    {ch.statCheck && (
                                      <span className="text-[9.5px] text-amber-400/90 font-mono mt-0.5 inline-block" dir="ltr">
                                        Check: {ch.statCheck.stat.toUpperCase()} (DC {ch.statCheck.dc})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setTreeSynthesisPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitStoryTree}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 تزریق درخت روایی به داستان' : '📥 Commit Story Tree'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan 07: Epic Saga Synthesis Preview Modal */}
      {sagaPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                {isPersian ? 'پیش‌نمایش حماسه چندفصلی' : 'Epic Saga Campaign Preview'}
              </h3>
              <button
                onClick={() => setSagaPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <h4 className="font-bold text-amber-300 text-sm">{sagaPreview.sagaTitle}</h4>
              <p className="text-zinc-300 leading-relaxed italic">{sagaPreview.premise}</p>
            </div>

            {/* Chapters List */}
            <div className="space-y-3">
              {sagaPreview.chapters.map((ch) => {
                const meta = SCOPE_TIER_META[ch.scopeTier] || SCOPE_TIER_META.street;
                return (
                  <div
                    key={ch.id}
                    className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold font-mono">
                        Ch {ch.chapterNumber}
                      </span>
                      <strong className="text-zinc-100">{ch.title}</strong>
                      <span className={`px-2 py-0.5 rounded-md border text-[9.5px] font-bold ${meta.color}`}>
                        {isPersian ? meta.labelFa : meta.labelEn}
                      </span>
                    </div>

                    {ch.narrativeGoal && (
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        <strong className="text-purple-300">{t.goalLabel}</strong> {ch.narrativeGoal}
                      </p>
                    )}
                    {ch.prerequisiteFlags.length > 0 && (
                      <p className="text-[10px] text-sky-300/80 font-mono" dir="ltr">
                        requires: [{ch.prerequisiteFlags.join(', ')}]
                      </p>
                    )}

                    <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-500 block">
                        {isPersian ? 'صحنه‌های فصل:' : 'Chapter Scenes:'} ({ch.scenes.length})
                      </span>
                      {ch.scenes.map((sc, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-[11px] p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/70">
                          <MapPin className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-200 truncate">
                              {sc.narrativeText.split('\n')[0]?.replace(/^\[.*?\]\s*/, '')}
                            </p>
                            <span className="text-[9.5px] text-zinc-500">
                              {(isPersian ? 'انتخاب‌ها' : 'Choices')}: {sc.choices.length} ·{' '}
                              {(sc.narrativeText.split('\n\n')[1] || '').slice(0, 90)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSagaPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitSaga}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت حماسه در داستان' : '📥 Commit Epic Saga'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Scene Synthesis Modal */}
      {aiSceneModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100">
                  {isPersian ? 'خلق صحنه روایی با هوش مصنوعی' : 'Synthesize Story Beat'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAiSceneModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateScene} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'مکان رویداد صحنه:' : 'Scene Location:'}
                </label>
                <select
                  value={sceneLocationId}
                  onChange={(e) => setSceneLocationId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  {story.worldBible.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'شرح موقعیت و چالش صحنه:' : 'Scene Premise & Conflict:'}
                </label>
                <textarea
                  rows={3}
                  value={scenePrompt}
                  onChange={(e) => setScenePrompt(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: بازیکن در راهروی نگهبانان با فرمانده رولان روبرو می‌شود و باید بین فریب کلامی یا درگیری فیزیکی تصمیم بگیرد...'
                      : 'e.g. Player encounters Captain Rolan in the guard corridor and must choose between deception or combat...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    {isPersian ? 'دستورالعمل سیستم هوش مصنوعی (System Prompt):' : 'System Prompt Override:'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSceneSystemPrompt(
                        story.worldBible.aiSystemPrompt ||
                          (isPersian
                            ? 'تو راوی ارشد بازی StoryForge هستی. صحنه را با تعلیق و انتخاب‌های معنادار بنویس.'
                            : 'You are the Master Storyteller for StoryForge.')
                      )
                    }
                    className="text-[10px] text-zinc-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> {isPersian ? 'پیش‌فرض' : 'Reset'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={sceneSystemPrompt}
                  onChange={(e) => setSceneSystemPrompt(e.target.value)}
                  className="w-full bg-zinc-950 border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAiSceneModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingScene}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingScene ? 'animate-spin' : ''}`} />
                  <span>
                    {isGeneratingScene
                      ? isPersian
                        ? 'در حال خلق...'
                        : 'Generating...'
                      : isPersian
                      ? 'خلق صحنه'
                      : 'Generate Beat'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
