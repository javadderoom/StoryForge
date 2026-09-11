'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StoryTreeCanvas } from '@/components/studio/StoryTreeCanvas';
import {
  GitBranch,
  Sparkles,
  BookOpen,
  Layers,
  Plus,
  ChevronRight,
  Crown,
  Trash2,
  Target,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import {
  StoryChapter,
  StoryBeat,
} from '@/lib/types/world';
import SceneAiCopilotModal, { CopilotMode } from '@/components/studio/SceneAiCopilotModal';

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

  // Multi-Chapter Epic Saga state
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  // Unified Scene AI Copilot state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMode, setCopilotMode] = useState<CopilotMode>('choices');
  const [copilotTargetBeat, setCopilotTargetBeat] = useState<StoryBeat | null>(null);
  const [copilotSelectedChoice, setCopilotSelectedChoice] = useState<any | null>(null);

  const sagaChapters: StoryChapter[] = story.saga?.chapters ?? [];
  const activeChapter = sagaChapters.find((c) => c.id === activeChapterId) || null;

  const currentBeats: StoryBeat[] = (
    activeChapter
      ? (activeChapter.scenes && activeChapter.scenes.length > 0
          ? activeChapter.scenes
          : (story.initialStoryBeats || []).filter((b) => b.chapterId === activeChapter.id))
      : (story.initialStoryBeats || [])
  ) as StoryBeat[];

  const t = {
    heading: isPersian ? 'درخت روایی و شاخه‌بندی صحنه‌ها' : 'Branching Story Beats Tree',
    subheading: isPersian
      ? 'طراحی جریان سناریو، شرایط موفقیت/شکست تاس و ساختار تصمیم‌گیری داستان'
      : 'Visual narrative flowchart editor to map scenes, decision branches, and RPG skill check checkpoints.',
    totalBeats: isPersian ? 'صحنه‌های تعریف‌شده:' : 'Defined Story Beats:',
    aiCopilotBtn: isPersian ? '✨ دستیار هوشمند سناریو' : '✨ AI Scene Copilot',
    flatBeatsTab: isPersian ? '📜 صحنه‌های تکی' : '📜 Flat Beats',
    addChapterBtn: isPersian ? '+ فصل جدید' : '+ Add Chapter',
    goalLabel: isPersian ? 'هدف روایی فصل:' : 'Chapter Goal:',
    prereqLabel: isPersian ? 'پیش‌نیازها:' : 'Prerequisites:',
    summaryPromptLabel: isPersian ? 'دستور خلاصه پایان فصل:' : 'Completion Rollup Prompt:',
    deleteChapterBtn: isPersian ? 'حذف فصل' : 'Delete Chapter',
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

  // ----------------------------------------------------------------
  // Unified Scene AI Copilot Commits
  // ----------------------------------------------------------------
  const handleCommitCopilotChoices = (sceneId: string, newChoices: any[]) => {
    const updateFn = (scenes: StoryBeat[]) =>
      scenes.map((b) =>
        b.sceneId === sceneId
          ? { ...b, choices: [...(b.choices || []), ...newChoices] }
          : b
      );

    if (activeChapter) {
      handleChapterScenesChange(updateFn(currentBeats));
    } else {
      updateStoryBeats((prev) => updateFn(prev || []));
    }
  };

  const handleCommitCopilotNextScene = (
    sourceSceneId: string,
    choiceId: string,
    newBeat: StoryBeat
  ) => {
    const beatWithChapter: StoryBeat = {
      ...newBeat,
      chapterId: activeChapter ? activeChapter.id : undefined,
    };

    const updateFn = (scenes: StoryBeat[]) => {
      const updated = scenes.map((b) => {
        if (b.sceneId === sourceSceneId) {
          return {
            ...b,
            choices: (b.choices || []).map((c) =>
              c.id === choiceId ? { ...c, targetSceneId: beatWithChapter.sceneId } : c
            ),
          };
        }
        return b;
      });
      return [...updated, beatWithChapter];
    };

    if (activeChapter) {
      handleChapterScenesChange(updateFn(currentBeats));
    } else {
      updateStoryBeats((prev) => updateFn(prev || []));
    }
  };

  const handleCommitCopilotBridge = (
    startSceneId: string,
    startChoiceId: string | undefined,
    targetSceneId: string,
    newBeats: StoryBeat[]
  ) => {
    if (newBeats.length === 0) return;
    const firstBridgeId = newBeats[0].sceneId;

    const formattedBeats = newBeats.map((b) => ({
      ...b,
      chapterId: activeChapter ? activeChapter.id : undefined,
    }));

    const updateFn = (scenes: StoryBeat[]) => {
      const updated = scenes.map((b) => {
        if (b.sceneId === startSceneId) {
          if (startChoiceId) {
            return {
              ...b,
              choices: (b.choices || []).map((c) =>
                c.id === startChoiceId ? { ...c, targetSceneId: firstBridgeId } : c
              ),
            };
          } else {
            const connectorChoice = {
              id: makeId('choice'),
              text: isPersian ? 'ادامه مسیر به سوی هدف' : 'Advance toward destination',
              style: 'inquisitive' as const,
              riskLevel: 'medium' as const,
              targetSceneId: firstBridgeId,
            };
            return { ...b, choices: [...(b.choices || []), connectorChoice] };
          }
        }
        return b;
      });
      return [...updated, ...formattedBeats];
    };

    if (activeChapter) {
      handleChapterScenesChange(updateFn(currentBeats));
    } else {
      updateStoryBeats((prev) => updateFn(prev || []));
    }
  };

  const handleAddBlankScene = () => {
    const newSceneId = `scene_${Date.now().toString(36)}`;
    const newBeat: StoryBeat = {
      sceneId: newSceneId,
      chapterId: activeChapter ? activeChapter.id : undefined,
      locationId: story.worldBible?.locations?.[0]?.id || 'loc_default',
      narrativeText: isPersian ? 'متن توصیفی صحنه جدید...' : 'New scene narrative text...',
      choices: [],
    };
    if (activeChapter) {
      handleChapterScenesChange([...currentBeats, newBeat]);
    } else {
      updateStoryBeats((prev) => [...(prev || []), newBeat]);
    }
    if (!story.initialSceneId) {
      updateStoryMeta({ initialSceneId: newSceneId });
    }
    notify.success(isPersian ? 'صحنه جدید ایجاد شد' : 'New blank scene created');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative z-40 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <GitBranch className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{t.subheading}</p>
        </div>
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Mobile group */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={handleAddBlankScene}
              title={isPersian ? 'صحنه جدید دستی' : 'New Blank Scene'}
              className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 w-9 h-9 rounded-xl font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCopilotMode('choices');
                setCopilotTargetBeat(currentBeats[0] || null);
                setCopilotSelectedChoice(null);
                setCopilotOpen(true);
              }}
              disabled={currentBeats.length === 0}
              title={t.aiCopilotBtn}
              className="flex items-center justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 w-9 h-9 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2.5 py-2 rounded-xl font-mono flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              {(activeChapter ? activeChapter.scenes.length : story.initialStoryBeats?.length) || 0}
            </span>
          </div>

          {/* Desktop group */}
          <button
            type="button"
            onClick={handleAddBlankScene}
            className="hidden md:flex items-center gap-1.5 text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isPersian ? 'صحنه جدید دستی' : 'New Blank Scene'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCopilotMode('choices');
              setCopilotTargetBeat(currentBeats[0] || null);
              setCopilotSelectedChoice(null);
              setCopilotOpen(true);
            }}
            disabled={currentBeats.length === 0}
            className="hidden md:flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.aiCopilotBtn}</span>
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
        onFlatBeatsChange={(newScenes) => {
          updateStoryBeats(() => newScenes as any);
        }}
        onSetInitialSceneId={(sceneId) => {
          updateStoryMeta({ initialSceneId: sceneId });
          notify.success(
            isPersian
              ? `صحنه «${sceneId}» به عنوان نقطه شروع ماجراجویی تنظیم شد`
              : `Scene "${sceneId}" set as the adventure starting scene`
          );
        }}
        onOpenCopilot={(mode, beat, choice) => {
          setCopilotMode(mode);
          setCopilotTargetBeat(beat || null);
          setCopilotSelectedChoice(choice || null);
          setCopilotOpen(true);
        }}
      />

      {/* Contextual AI Scene Copilot Modal */}
      {copilotOpen && (
        <SceneAiCopilotModal
          isOpen={copilotOpen}
          initialMode={copilotMode}
          activeBeat={copilotTargetBeat}
          selectedChoice={copilotSelectedChoice}
          allBeats={currentBeats}
          story={story}
          isPersian={isPersian}
          onClose={() => {
            setCopilotOpen(false);
            setCopilotTargetBeat(null);
            setCopilotSelectedChoice(null);
          }}
          onCommitChoices={handleCommitCopilotChoices}
          onCommitNextScene={handleCommitCopilotNextScene}
          onCommitBridge={handleCommitCopilotBridge}
        />
      )}
    </div>
  );
}
