'use client';

import React, { useState, useEffect } from 'react';
import { StoryBeat } from '@/lib/types/world';
import { StoryManifest } from '@/lib/types';
import {
  Sparkles,
  X,
  Dices,
  ArrowRight,
  Check,
  Compass,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

export type CopilotMode = 'choices' | 'next_scene' | 'bridge';

interface SceneAiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryManifest;
  isPersian?: boolean;
  activeBeat?: StoryBeat | null;
  selectedChoice?: any | null;
  allBeats: StoryBeat[];
  initialMode?: CopilotMode;
  onCommitChoices: (sceneId: string, choices: any[]) => void;
  onCommitNextScene: (sourceSceneId: string, choiceId: string, newBeat: StoryBeat) => void;
  onCommitBridge: (
    startSceneId: string,
    startChoiceId: string | undefined,
    targetSceneId: string,
    newBeats: StoryBeat[]
  ) => void;
}

const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export default function SceneAiCopilotModal({
  isOpen,
  onClose,
  story,
  isPersian = true,
  activeBeat,
  selectedChoice,
  allBeats,
  initialMode = 'choices',
  onCommitChoices,
  onCommitNextScene,
  onCommitBridge,
}: SceneAiCopilotModalProps) {
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [step, setStep] = useState<'config' | 'review'>('config');
  const [isLoading, setIsLoading] = useState(false);

  // Mode 1: Choices Generator State
  const [choicesTargetSceneId, setChoicesTargetSceneId] = useState<string>(activeBeat?.sceneId || '');
  const [choicesAuthorPrompt, setChoicesAuthorPrompt] = useState('');
  const [generatedChoices, setGeneratedChoices] = useState<
    Array<{
      id: string;
      text: string;
      style: 'defensive' | 'agile' | 'aggressive' | 'diplomatic' | 'inquisitive';
      statCheck?: { stat: string; dc: number };
      narrativeConsequence?: string;
      selected: boolean;
    }>
  >([]);

  // Mode 2: Next Scene Generator State
  const [nextSourceSceneId, setNextSourceSceneId] = useState<string>(activeBeat?.sceneId || '');
  const [nextSourceChoiceId, setNextSourceChoiceId] = useState<string>(selectedChoice?.id || '');
  const [nextAuthorPrompt, setNextAuthorPrompt] = useState('');
  const [nextPreferredLocationId, setNextPreferredLocationId] = useState('');
  const [generatedNextScene, setGeneratedNextScene] = useState<{
    sceneId: string;
    locationId: string;
    narrativeText: string;
    choices: any[];
  } | null>(null);

  // Mode 3: Bridge to Target State
  const [bridgeStartSceneId, setBridgeStartSceneId] = useState<string>(activeBeat?.sceneId || '');
  const [bridgeStartChoiceId, setBridgeStartChoiceId] = useState<string>('');
  const [bridgeTargetType, setBridgeTargetType] = useState<'existing' | 'custom'>('existing');
  const [bridgeTargetSceneId, setBridgeTargetSceneId] = useState<string>('');
  const [bridgeCustomGoal, setBridgeCustomGoal] = useState('');
  const [bridgeBeatCount, setBridgeBeatCount] = useState<number>(2);
  const [bridgeAuthorPrompt, setBridgeAuthorPrompt] = useState('');
  const [generatedBridgeBeats, setGeneratedBridgeBeats] = useState<
    Array<{
      sceneId: string;
      locationId: string;
      narrativeText: string;
      stepNumber: number;
      primaryTransitionChoice: {
        text: string;
        style: any;
        statCheck?: { stat: string; dc: number };
        leadToSceneId: string;
      };
      alternativeChoices: Array<{
        text: string;
        style: any;
        statCheck?: { stat: string; dc: number };
      }>;
    }>
  >([]);

  // Sync state whenever activeBeat or selectedChoice changes
  useEffect(() => {
    if (activeBeat) {
      setChoicesTargetSceneId(activeBeat.sceneId);
      setNextSourceSceneId(activeBeat.sceneId);
      setBridgeStartSceneId(activeBeat.sceneId);
      if (activeBeat.choices && activeBeat.choices.length > 0) {
        setNextSourceChoiceId(selectedChoice?.id || activeBeat.choices[0].id);
      }
    }
    if (initialMode) {
      setMode(initialMode);
    }
  }, [activeBeat, selectedChoice, initialMode, isOpen]);

  if (!isOpen) return null;

  const currentChoicesBeat = allBeats.find((b) => b.sceneId === choicesTargetSceneId) || activeBeat;
  const currentNextBeat = allBeats.find((b) => b.sceneId === nextSourceSceneId) || activeBeat;
  const currentNextChoice = currentNextBeat?.choices.find((c: any) => c.id === nextSourceChoiceId);
  const currentBridgeStartBeat = allBeats.find((b) => b.sceneId === bridgeStartSceneId) || activeBeat;
  const targetBeatsList = allBeats.filter((b) => b.sceneId !== bridgeStartSceneId);

  const availableLocations = (story.worldBible?.locations || []).map((l: any) => ({
    id: l.id,
    name: l.name,
  }));
  const rpgStatIds = (story.rpgSystem?.stats || []).map((s: any) => s.id);

  // ----------------------------------------------------------------
  // Mode 1: Generate Choices Handler
  // ----------------------------------------------------------------
  const handleGenerateChoices = async () => {
    if (!currentChoicesBeat) return;
    setIsLoading(true);
    try {
      const worldContext = buildWorldContextString(story);

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scene_choices',
          prompt: choicesAuthorPrompt,
          isPersian,
          themeContext: story.worldBible?.themeNotes,
          worldContext,
          rpgStatIds,
          scene: {
            sceneId: currentChoicesBeat.sceneId,
            locationId: currentChoicesBeat.locationId,
            locationName:
              availableLocations.find((l: any) => l.id === currentChoicesBeat.locationId)?.name ||
              currentChoicesBeat.locationId,
            narrativeText: currentChoicesBeat.narrativeText,
            existingChoices: currentChoicesBeat.choices || [],
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.choices && Array.isArray(json.data.choices)) {
        setGeneratedChoices(
          json.data.choices.map((c: any) => ({
            id: c.id || makeId('choice'),
            text: c.text,
            style: c.style || 'inquisitive',
            statCheck: c.statCheck,
            narrativeConsequence: c.narrativeConsequence || '',
            selected: true,
          }))
        );
        setStep('review');
      } else {
        notify.error(isPersian ? 'خطا در تولید انتخاب‌ها' : 'Failed to generate choices');
      }
    } catch {
      notify.error(isPersian ? 'خطای اتصال به هوش مصنوعی' : 'AI connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // Mode 2: Generate Next Scene Handler
  // ----------------------------------------------------------------
  const handleGenerateNextScene = async () => {
    if (!currentNextBeat) return;
    setIsLoading(true);
    try {
      const worldContext = buildWorldContextString(story);

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scene_next',
          prompt: nextAuthorPrompt,
          isPersian,
          themeContext: story.worldBible?.themeNotes,
          worldContext,
          rpgStatIds,
          availableLocations,
          scene: {
            sceneId: currentNextBeat.sceneId,
            locationId: currentNextBeat.locationId,
            locationName:
              availableLocations.find((l: any) => l.id === currentNextBeat.locationId)?.name ||
              currentNextBeat.locationId,
            narrativeText: currentNextBeat.narrativeText,
          },
          choice: currentNextChoice
            ? {
                id: currentNextChoice.id,
                text: currentNextChoice.text,
                style: currentNextChoice.style,
                statCheck: currentNextChoice.targetDC
                  ? { stat: currentNextChoice.requiredStatId || '', dc: currentNextChoice.targetDC }
                  : undefined,
              }
            : { id: 'choice_action', text: 'ادامه مسیر', style: 'inquisitive' },
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setGeneratedNextScene({
          sceneId: d.sceneId || makeId('scene'),
          locationId: nextPreferredLocationId || d.locationId || currentNextBeat.locationId || availableLocations[0]?.id || 'loc_hub',
          narrativeText: d.narrativeText || '',
          choices: (d.choices || []).map((c: any) => ({
            id: c.id || makeId('choice'),
            text: c.text,
            style: c.style || 'inquisitive',
            riskLevel: 'medium',
            targetDC: c.statCheck?.dc,
            requiredStatId: c.statCheck?.stat,
          })),
        });
        setStep('review');
      } else {
        notify.error(isPersian ? 'خطا در خلق صحنه بعدی' : 'Failed to generate next scene');
      }
    } catch {
      notify.error(isPersian ? 'خطای اتصال به هوش مصنوعی' : 'AI connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // Mode 3: Generate Multi-Beat Bridge Handler
  // ----------------------------------------------------------------
  const handleGenerateBridge = async () => {
    if (!currentBridgeStartBeat) return;
    setIsLoading(true);
    try {
      const worldContext = buildWorldContextString(story);

      const targetBeat = allBeats.find((b) => b.sceneId === bridgeTargetSceneId);
      const startChoice = currentBridgeStartBeat.choices?.find((c: any) => c.id === bridgeStartChoiceId);

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scene_bridge',
          prompt: bridgeAuthorPrompt,
          isPersian,
          themeContext: story.worldBible?.themeNotes,
          worldContext,
          rpgStatIds,
          availableLocations,
          beatCount: bridgeBeatCount,
          startScene: {
            sceneId: currentBridgeStartBeat.sceneId,
            locationId: currentBridgeStartBeat.locationId,
            locationName:
              availableLocations.find((l: any) => l.id === currentBridgeStartBeat.locationId)?.name ||
              currentBridgeStartBeat.locationId,
            narrativeText: currentBridgeStartBeat.narrativeText,
          },
          startChoice: startChoice ? { id: startChoice.id, text: startChoice.text } : undefined,
          targetScene:
            bridgeTargetType === 'existing' && targetBeat
              ? {
                  sceneId: targetBeat.sceneId,
                  locationId: targetBeat.locationId,
                  locationName:
                    availableLocations.find((l: any) => l.id === targetBeat.locationId)?.name ||
                    targetBeat.locationId,
                  narrativeText: targetBeat.narrativeText,
                }
              : {
                  sceneId: makeId('target_scene'),
                  title: bridgeCustomGoal || 'هدف برخورد',
                  goal: bridgeCustomGoal,
                },
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.bridgeBeats && Array.isArray(json.data.bridgeBeats)) {
        setGeneratedBridgeBeats(json.data.bridgeBeats);
        setStep('review');
      } else {
        notify.error(isPersian ? 'خطا در ساخت پل روایی' : 'Failed to generate narrative bridge');
      }
    } catch {
      notify.error(isPersian ? 'خطای اتصال به هوش مصنوعی' : 'AI connection error');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // Commits / Approval Actions
  // ----------------------------------------------------------------
  const handleCommitChoicesAction = () => {
    const selected = generatedChoices.filter((c: any) => c.selected);
    if (selected.length === 0) {
      notify.error(isPersian ? 'حداقل یک انتخاب را مشخص کنید' : 'Select at least one choice');
      return;
    }
    const finalChoices = selected.map((c: any) => ({
      id: c.id,
      text: c.text,
      style: c.style,
      riskLevel: 'medium',
      targetDC: c.statCheck?.dc,
      requiredStatId: c.statCheck?.stat,
    }));
    onCommitChoices(choicesTargetSceneId, finalChoices);
    notify.success(
      isPersian
        ? `${selected.length} انتخاب با موفقیت به صحنه افزوده شد`
        : `Added ${selected.length} choices to scene`
    );
    onClose();
  };

  const handleCommitNextSceneAction = () => {
    if (!generatedNextScene) return;
    const newBeat: StoryBeat = {
      sceneId: generatedNextScene.sceneId,
      locationId: generatedNextScene.locationId,
      narrativeText: generatedNextScene.narrativeText,
      choices: generatedNextScene.choices,
    };
    onCommitNextScene(nextSourceSceneId, nextSourceChoiceId, newBeat);
    notify.success(
      isPersian
        ? `صحنه جدید «${newBeat.sceneId}» خلق و به شاخه انتخاب متصل شد`
        : `Scene "${newBeat.sceneId}" created and linked to choice branch`
    );
    onClose();
  };

  const handleCommitBridgeAction = () => {
    if (generatedBridgeBeats.length === 0) return;
    const targetId =
      bridgeTargetType === 'existing' ? bridgeTargetSceneId : makeId('target_encounter');

    const newBeats: StoryBeat[] = generatedBridgeBeats.map((b: any, idx: number) => {
      const isLast = idx === generatedBridgeBeats.length - 1;
      const nextId = isLast ? targetId : generatedBridgeBeats[idx + 1].sceneId;

      const mainChoice = {
        id: makeId('choice'),
        text: b.primaryTransitionChoice.text,
        style: b.primaryTransitionChoice.style || 'inquisitive',
        riskLevel: 'medium' as const,
        targetDC: b.primaryTransitionChoice.statCheck?.dc,
        requiredStatId: b.primaryTransitionChoice.statCheck?.stat,
        targetSceneId: nextId,
      };

      const altChoices = (b.alternativeChoices || []).map((alt: any) => ({
        id: makeId('choice'),
        text: alt.text,
        style: alt.style || 'defensive',
        riskLevel: 'medium' as const,
        targetDC: alt.statCheck?.dc,
        requiredStatId: alt.statCheck?.stat,
      }));

      return {
        sceneId: b.sceneId,
        locationId: b.locationId || availableLocations[0]?.id || 'loc_hub',
        narrativeText: b.narrativeText,
        choices: [mainChoice, ...altChoices],
      };
    });

    onCommitBridge(bridgeStartSceneId, bridgeStartChoiceId || undefined, targetId, newBeats);
    notify.success(
      isPersian
        ? `پل روایی شامل ${newBeats.length} صحنه میانی با موفقیت در درخت سناریو ادغام شد`
        : `Bridge path with ${newBeats.length} scenes inserted into story tree`
    );
    onClose();
  };

  return (
    <div
      dir={isPersian ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-[#0C0E1B] border border-zinc-700/80 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>{isPersian ? 'دستیار هوشمند سناریو' : 'AI Scene Copilot'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                  Contextual
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                {isPersian
                  ? 'خلق انتخاب‌ها، ادامه داستان پس از یک تصمیم یا پل‌سازی چندمرحله‌ای تا مقصد'
                  : 'Context-rich generation for choices, next scenes, or multi-beat bridge paths'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (only in config step) */}
        {step === 'config' && (
          <div className="grid grid-cols-3 border-b border-zinc-800/80 bg-zinc-950/60 p-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setMode('choices')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold transition-all cursor-pointer ${
                mode === 'choices'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Dices className="w-4 h-4" />
              <span>{isPersian ? 'تولید انتخاب‌های صحنه' : 'Generate Choices'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('next_scene')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold transition-all cursor-pointer ${
                mode === 'next_scene'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <ArrowRight className={`w-4 h-4 ${isPersian ? 'rotate-180' : ''}`} />
              <span>{isPersian ? 'خلق صحنه بعدی' : 'Next Scene'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('bridge')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl font-bold transition-all cursor-pointer ${
                mode === 'bridge'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{isPersian ? 'پل‌سازی تا صحنه مقصد' : 'Bridge to Target'}</span>
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ======================================================= */}
          {/* STEP 1: CONFIGURATION */}
          {/* ======================================================= */}
          {step === 'config' && (
            <>
              {/* MODE 1: CHOICES */}
              {mode === 'choices' && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian ? 'صحنه هدف برای تولید انتخاب:' : 'Target Scene for Choices:'}
                    </label>
                    <select
                      value={choicesTargetSceneId}
                      onChange={(e) => setChoicesTargetSceneId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    >
                      {allBeats.map((b, i) => (
                        <option key={b.sceneId} value={b.sceneId}>
                          #{i + 1}: {b.sceneId} (
                          {availableLocations.find((l: any) => l.id === b.locationId)?.name || b.locationId || 'نامشخص'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentChoicesBeat && (
                    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-2">
                      <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                        <span className="flex items-center gap-1 text-sky-400">
                          <MapPin className="w-3.5 h-3.5" />
                          {availableLocations.find((l: any) => l.id === currentChoicesBeat.locationId)?.name ||
                            currentChoicesBeat.locationId}
                        </span>
                        <span>
                          {currentChoicesBeat.choices?.length || 0}{' '}
                          {isPersian ? 'انتخاب از قبل موجود' : 'existing choices'}
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed italic line-clamp-3 font-serif">
                        {currentChoicesBeat.narrativeText}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian
                        ? 'دستور یا هدایت روایی برای انتخاب‌ها (اختیاری):'
                        : 'Author Direction for Choices (Optional):'}
                    </label>
                    <textarea
                      rows={2}
                      value={choicesAuthorPrompt}
                      onChange={(e) => setChoicesAuthorPrompt(e.target.value)}
                      placeholder={
                        isPersian
                          ? 'مثلاً: یک انتخاب مخفی‌کاری محتاطانه، یک ترفند دیپلماتیک و یک حمله پرریسک...'
                          : 'e.g. A cautious stealth infiltration, a diplomatic compromise, or a risky arcane gamble...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      {isPersian
                        ? 'هوش مصنوعی بر اساس قوانین و شخصیت‌های جهان ۲ الی ۴ انتخاب ادبی و معنادار بدون برچسب سختی مصنوعی خلق می‌کند.'
                        : 'AI will generate 2–4 literary narrative choices honoring world lore without artificial risk badges.'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading || !currentChoicesBeat}
                    onClick={handleGenerateChoices}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <span>{isPersian ? 'در حال خلق انتخاب‌ها...' : 'Generating Choices...'}</span>
                    ) : (
                      <>
                        <Dices className="w-4 h-4" />
                        <span>{isPersian ? 'تولید انتخاب‌های هوشمند' : 'Generate Choices'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* MODE 2: NEXT SCENE */}
              {mode === 'next_scene' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        {isPersian ? 'صحنه مبدأ:' : 'Origin Scene:'}
                      </label>
                      <select
                        value={nextSourceSceneId}
                        onChange={(e) => {
                          setNextSourceSceneId(e.target.value);
                          const target = allBeats.find((b) => b.sceneId === e.target.value);
                          if (target?.choices && target.choices.length > 0) {
                            setNextSourceChoiceId(target.choices[0].id);
                          }
                        }}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                      >
                        {allBeats.map((b, i) => (
                          <option key={b.sceneId} value={b.sceneId}>
                            #{i + 1}: {b.sceneId}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        {isPersian ? 'تصمیم یا انتخابی که داستان را ادامه می‌دهد:' : 'Choice Leading to Next Scene:'}
                      </label>
                      <select
                        value={nextSourceChoiceId}
                        onChange={(e) => setNextSourceChoiceId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                      >
                        {(currentNextBeat?.choices || []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.text.slice(0, 50)}...
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentNextChoice && (
                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200">
                      <strong>{isPersian ? 'عمل انتخاب‌شده بازیکن:' : 'Selected Action:'}</strong>{' '}
                      «{currentNextChoice.text}»
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian
                        ? 'مکان وقوع صحنه بعدی (اختیاری — پیش‌فرض هوش مصنوعی):'
                        : 'Destination Location (Optional):'}
                    </label>
                    <select
                      value={nextPreferredLocationId}
                      onChange={(e) => setNextPreferredLocationId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">{isPersian ? '✨ انتخاب خودکار بر اساس روایت' : '✨ Auto-select by narrative'}</option>
                      {availableLocations.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian
                        ? 'راهنمایی و جهت‌دهی به ادامه ماجرا (اختیاری):'
                        : 'Narrative Direction for Next Scene (Optional):'}
                    </label>
                    <textarea
                      rows={2}
                      value={nextAuthorPrompt}
                      onChange={(e) => setNextAuthorPrompt(e.target.value)}
                      placeholder={
                        isPersian
                          ? 'مثلاً: در پی این اقدام، شخصیت وارد آب‌انبار مخفی می‌شود و با یک شبح باستانی روبه‌رو می‌گردد...'
                          : 'e.g. As a result, the protagonist enters the submerged crypt and confronts an ancient wraith...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-sky-500 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isLoading || !currentNextBeat}
                    onClick={handleGenerateNextScene}
                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <span>{isPersian ? 'در حال خلق صحنه بعدی...' : 'Synthesizing Next Scene...'}</span>
                    ) : (
                      <>
                        <ArrowRight className={`w-4 h-4 ${isPersian ? 'rotate-180' : ''}`} />
                        <span>{isPersian ? 'خلق صحنه بعدی و اتصال شاخه' : 'Synthesize Next Scene'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* MODE 3: BRIDGE */}
              {mode === 'bridge' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        {isPersian ? 'صحنه مبدأ (نقطه شروع پل):' : 'Starting Scene:'}
                      </label>
                      <select
                        value={bridgeStartSceneId}
                        onChange={(e) => setBridgeStartSceneId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-teal-400"
                      >
                        {allBeats.map((b, i) => (
                          <option key={b.sceneId} value={b.sceneId}>
                            #{i + 1}: {b.sceneId}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        {isPersian ? 'تعداد صحنه‌های میانی (طول پل):' : 'Intermediate Beats Count:'}
                      </label>
                      <div className="flex items-center gap-2">
                        {[2, 3, 4].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setBridgeBeatCount(count)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              bridgeBeatCount === count
                                ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {count} {isPersian ? 'صحنه' : 'Beats'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian ? 'مقصد نهایی پل روایی:' : 'Bridge Destination:'}
                    </label>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setBridgeTargetType('existing')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          bridgeTargetType === 'existing'
                            ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isPersian ? 'انتخاب از صحنه‌های موجود' : 'Pick Existing Scene'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBridgeTargetType('custom')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                          bridgeTargetType === 'custom'
                            ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isPersian ? 'برخورد هدف جدید (Milestone)' : 'New Target Encounter'}
                      </button>
                    </div>

                    {bridgeTargetType === 'existing' ? (
                      <select
                        value={bridgeTargetSceneId}
                        onChange={(e) => setBridgeTargetSceneId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-teal-400"
                      >
                        <option value="" disabled>
                          {isPersian ? 'صحنه مقصد را انتخاب کنید...' : 'Select destination scene...'}
                        </option>
                        {targetBeatsList.map((b, i) => (
                          <option key={b.sceneId} value={b.sceneId}>
                            #{i + 1}: {b.sceneId} ({b.narrativeText.slice(0, 45)}...)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={bridgeCustomGoal}
                        onChange={(e) => setBridgeCustomGoal(e.target.value)}
                        placeholder={
                          isPersian
                            ? 'مثلاً: رویارویی با استاد کیمیاگر در قلعه کوهستانی برای شکستن مهر طومار...'
                            : 'e.g. Confronting the Master Alchemist at the mountain citadel to break the seal...'
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                      {isPersian
                        ? 'دستورات ریتم، خطرات و حوادث مسیر (اختیاری):'
                        : 'Pacing, Hazards, and Route Guidance (Optional):'}
                    </label>
                    <textarea
                      rows={2}
                      value={bridgeAuthorPrompt}
                      onChange={(e) => setBridgeAuthorPrompt(e.target.value)}
                      placeholder={
                        isPersian
                          ? 'مثلاً: ابتدا فرار از گشتی‌های شهر، سپس برخورد با یک قاچاقچی در فاضلاب و نهایتاً رسیدن به مقصد...'
                          : 'e.g. First evade city patrols, then encounter a smuggler in the aqueduct, then arrive...'
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-500 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={
                      isLoading ||
                      !currentBridgeStartBeat ||
                      (bridgeTargetType === 'existing' && !bridgeTargetSceneId) ||
                      (bridgeTargetType === 'custom' && !bridgeCustomGoal.trim())
                    }
                    onClick={handleGenerateBridge}
                    className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <span>{isPersian ? 'در حال طراحی پل روایی...' : 'Building Narrative Bridge...'}</span>
                    ) : (
                      <>
                        <Compass className="w-4 h-4" />
                        <span>
                          {isPersian
                            ? `تولید پل روایی (${bridgeBeatCount} صحنه میانی)`
                            : `Generate Bridge (${bridgeBeatCount} Intermediate Beats)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ======================================================= */}
          {/* STEP 2: REVIEW BEFORE COMMIT */}
          {/* ======================================================= */}
          {step === 'review' && (
            <div className="space-y-6 animate-fadeIn">
              {/* REVIEW MODE 1: CHOICES */}
              {mode === 'choices' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Dices className="w-4 h-4 text-amber-400" />
                        <span>{isPersian ? 'بازبینی انتخاب‌های تولیدشده' : 'Review Generated Choices'}</span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        {isPersian
                          ? 'انتخاب‌های دلخواه را علامت بزنید یا متن آن‌ها را ویرایش کنید:'
                          : 'Select and fine-tune choices before adding to the scene:'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isPersian ? 'تغییر تنظیمات' : 'Back to Settings'}</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {generatedChoices.map((choice: any, idx: number) => (
                      <div
                        key={choice.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          choice.selected
                            ? 'bg-zinc-900 border-amber-500/40 shadow-sm'
                            : 'bg-zinc-950/60 border-zinc-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={choice.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setGeneratedChoices((prev: any[]) =>
                                prev.map((c: any, i: number) => (i === idx ? { ...c, selected: checked } : c))
                              );
                            }}
                            className="mt-1 w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                          <div className="flex-1 space-y-2">
                            <textarea
                              rows={2}
                              value={choice.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGeneratedChoices((prev: any[]) =>
                                  prev.map((c: any, i: number) => (i === idx ? { ...c, text: val } : c))
                                );
                              }}
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/80 rounded-xl p-2 text-xs text-zinc-100 leading-relaxed focus:outline-none"
                            />

                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                                {choice.style}
                              </span>
                              {choice.statCheck && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono">
                                  {choice.statCheck.stat} (DC {choice.statCheck.dc})
                                </span>
                              )}
                              {choice.narrativeConsequence && (
                                <span className="text-zinc-500 italic truncate max-w-sm">
                                  {choice.narrativeConsequence}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                    >
                      {isPersian ? 'بازگشت' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitChoicesAction}
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPersian ? 'تأیید و درج در صحنه' : 'Approve & Insert Choices'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* REVIEW MODE 2: NEXT SCENE */}
              {mode === 'next_scene' && generatedNextScene && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <ArrowRight className={`w-4 h-4 text-sky-400 ${isPersian ? 'rotate-180' : ''}`} />
                        <span>{isPersian ? 'بازبینی صحنه بعدی خلق‌شده' : 'Review Next Scene'}</span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        {isPersian
                          ? 'متن روایت و انتخاب‌های صحنه را بررسی و در صورت تمایل ویرایش کنید:'
                          : 'Verify and edit narrative prose and choices before committing:'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isPersian ? 'تغییر تنظیمات' : 'Back'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">
                        {isPersian ? 'شناسه صحنه جدید:' : 'New Scene ID:'}
                      </label>
                      <input
                        type="text"
                        value={generatedNextScene.sceneId}
                        onChange={(e) =>
                          setGeneratedNextScene({ ...generatedNextScene, sceneId: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 mb-1">
                        {isPersian ? 'مکان وقوع:' : 'Location Context:'}
                      </label>
                      <select
                        value={generatedNextScene.locationId}
                        onChange={(e) =>
                          setGeneratedNextScene({ ...generatedNextScene, locationId: e.target.value })
                        }
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-sky-400"
                      >
                        {availableLocations.map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 mb-1">
                      {isPersian ? 'متن روایت ادبی صحنه:' : 'Literary Narrative Prose:'}
                    </label>
                    <textarea
                      rows={6}
                      value={generatedNextScene.narrativeText}
                      onChange={(e) =>
                        setGeneratedNextScene({ ...generatedNextScene, narrativeText: e.target.value })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-sky-500 rounded-2xl p-3.5 text-xs text-zinc-100 leading-relaxed font-serif focus:outline-none"
                    />
                  </div>

                  {/* Generated follow-up choices */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-400">
                      {isPersian ? 'انتخاب‌های پیش‌روی بازیکن در این صحنه:' : 'Follow-up Choices:'}
                    </label>
                    {generatedNextScene.choices.map((c: any, i: number) => (
                      <div
                        key={c.id || i}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                      >
                        <span className="text-zinc-200">{c.text}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400">
                          {c.style}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                    >
                      {isPersian ? 'بازگشت' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitNextSceneAction}
                      className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPersian ? 'تأیید و اتصال به درخت داستان' : 'Approve & Link Scene'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* REVIEW MODE 3: BRIDGE */}
              {mode === 'bridge' && generatedBridgeBeats.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Compass className="w-4 h-4 text-teal-400" />
                        <span>{isPersian ? 'بازبینی پل روایی چندمرحله‌ای' : 'Review Narrative Bridge'}</span>
                      </h4>
                      <p className="text-xs text-zinc-400">
                        {isPersian
                          ? `مسیر از «${bridgeStartSceneId}» تا «${
                              bridgeTargetType === 'existing' ? bridgeTargetSceneId : 'صحنه مقصد'
                            }» با ${generatedBridgeBeats.length} صحنه میانی متصل می‌شود:`
                          : `Bridge from "${bridgeStartSceneId}" to target via ${generatedBridgeBeats.length} intermediate scenes:`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isPersian ? 'تغییر تنظیمات' : 'Back'}</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {generatedBridgeBeats.map((beat: any, idx: number) => (
                      <div
                        key={beat.sceneId}
                        className="p-4 rounded-2xl bg-zinc-950 border border-teal-500/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5 font-mono">
                            <span className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            {beat.sceneId}
                          </span>
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            {availableLocations.find((l: any) => l.id === beat.locationId)?.name || beat.locationId}
                          </span>
                        </div>

                        <textarea
                          rows={3}
                          value={beat.narrativeText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGeneratedBridgeBeats((prev: any[]) =>
                              prev.map((b: any, i: number) => (i === idx ? { ...b, narrativeText: val } : b))
                            );
                          }}
                          className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 leading-relaxed font-serif focus:outline-none focus:border-teal-500"
                        />

                        <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-200 flex items-center justify-between">
                          <span className="truncate max-w-sm">
                            <strong>{isPersian ? 'انتخاب پیشروی به مرحله بعد:' : 'Forward Choice:'}</strong>{' '}
                            «{beat.primaryTransitionChoice?.text}»
                          </span>
                          <span className="text-[10px] font-mono text-teal-300">
                            →{' '}
                            {idx === generatedBridgeBeats.length - 1
                              ? bridgeTargetType === 'existing'
                                ? bridgeTargetSceneId
                                : 'صحنه مقصد'
                              : generatedBridgeBeats[idx + 1]?.sceneId}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStep('config')}
                      className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                    >
                      {isPersian ? 'بازگشت' : 'Back'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitBridgeAction}
                      className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPersian ? 'تأیید و درج پل در سناریو' : 'Approve & Commit Bridge'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
