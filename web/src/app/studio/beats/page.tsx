'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StoryTreeCanvas } from '@/components/studio/StoryTreeCanvas';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { GitBranch, Sparkles, BookOpen, Layers, Plus, Terminal, RotateCcw, X, MapPin } from 'lucide-react';
import { notify } from '@/lib/notify';

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

  const t = {
    heading: isPersian ? 'درخت روایی و شاخه‌بندی صحنه‌ها' : 'Branching Story Beats Tree',
    subheading: isPersian
      ? 'طراحی جریان سناریو، شرایط موفقیت/شکست تاس و ساختار تصمیم‌گیری داستان'
      : 'Visual narrative flowchart editor to map scenes, decision branches, and RPG skill check checkpoints.',
    totalBeats: isPersian ? 'صحنه‌های تعریف‌شده:' : 'Defined Story Beats:',
    aiSceneBtn: isPersian ? '⚡ خلق صحنه با هوش مصنوعی' : '⚡ Synthesize Beat with AI',
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
          taskType: 'scene', // Routes through fast 500 RPD queue (Gemini 3.5/3.1 Flash Lite)
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
              text: c.text || 'انتخاب',
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
          <button
            onClick={() => setAiSceneModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
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
