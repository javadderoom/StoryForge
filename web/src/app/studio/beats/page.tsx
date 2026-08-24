'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StoryTreeCanvas } from '@/components/studio/StoryTreeCanvas';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
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
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { BranchingStoryTree } from '@/lib/types/world';

export default function StoryBeatsStudioPage() {
  const { story, isPersian, updateStoryBeats } = useStudioStory();

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

  const t = {
    heading: isPersian ? 'درخت روایی و شاخه‌بندی صحنه‌ها' : 'Branching Story Beats Tree',
    subheading: isPersian
      ? 'طراحی جریان سناریو، شرایط موفقیت/شکست تاس و ساختار تصمیم‌گیری داستان'
      : 'Visual narrative flowchart editor to map scenes, decision branches, and RPG skill check checkpoints.',
    totalBeats: isPersian ? 'صحنه‌های تعریف‌شده:' : 'Defined Story Beats:',
    aiSceneBtn: isPersian ? '⚡ خلق تک‌صحنه' : '⚡ Add Single Beat',
    aiTreeBtn: isPersian ? '🌳 سنتز درخت ۳ پرده‌ای' : '🌳 Synthesize 3-Act Tree',
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
          worldContext: buildWorldContextString(story),
          isPersian,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const beat = json.data;
        const newSceneId = `scene_${Date.now().toString(36)}`;
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <GitBranch className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{t.subheading}</p>
        </div>
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Plan 06: 3-Act Branching Plot Tree Synthesizer Trigger */}
          <button
            type="button"
            onClick={handleSynthesizeStoryTree}
            disabled={isSynthesizingTree}
            className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isSynthesizingTree
                ? isPersian
                  ? 'سنتز درخت ۳ پرده‌ای...'
                  : 'Synthesizing Tree...'
                : t.aiTreeBtn}
            </span>
          </button>

          <button
            onClick={() => setAiSceneModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.aiSceneBtn}
          </button>
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-2 rounded-xl font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {story.initialStoryBeats?.length || 1} {isPersian ? 'صحنه' : 'Beats'}
          </span>
        </div>
      </div>

      {/* Interactive Story Tree Canvas */}
      <StoryTreeCanvas story={story} isPersian={isPersian} />

      {/* Plan 06: 3-Act Branching Plot Tree Synthesis Preview Modal */}
      {treeSynthesisPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
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

      {/* AI Scene Synthesis Modal */}
      {aiSceneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
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
