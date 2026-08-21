'use client';

import React, { useState, useEffect } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Sparkles,
  Dice5,
  Eye,
  AlertCircle,
  CheckCircle,
  Play,
  Sliders,
  Shield,
  MapPin,
  Heart,
  RotateCcw,
  Zap,
} from 'lucide-react';

export default function AiSandboxPage() {
  const { story, isPersian } = useStudioStory();
  const [testAction, setTestAction] = useState('');
  const [actionStyle, setActionStyle] = useState<string>('free_text');
  const [forcedRoll, setForcedRoll] = useState<number | undefined>(undefined);
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Mock player attributes for testing
  const [mockStats, setMockStats] = useState<Record<string, number>>({
    might: 12,
    agility: 14,
    cunning: 10,
    arcana: 8,
  });

  const t = {
    heading: isPersian ? 'شبیه‌ساز هوش مصنوعی و آزمایشگر گاردریل' : 'AI Simulation & Guardrail Sandbox',
    subheading: isPersian
      ? 'آزمایش اکشن‌های آزاد و گزینه‌های تستی در برابر موتور محاسباتی و قوانین جهان'
      : 'Simulate player actions and verify deterministic dice rolls, state mutations, and AI prose.',
    sandboxTitle: isPersian ? 'آزمایشگر اکشن آزاد' : 'Action & Guardrail Simulator',
    sandboxDesc: isPersian
      ? 'یک اقدام بنویسید یا از دکمه‌های تستی زیر برای اعتبارسنجی قوانین و محاسبات تاس استفاده کنید.'
      : 'Type any free-text action or click the quick presets below to test guardrails and dice resolution.',
    placeholder: isPersian ? 'اکشن کاراکتر خود را بنویسید...' : 'Describe your character action...',
    testExtinction: isPersian ? '🐉 تست انقراض اژدها (تخلف قانون)' : '🐉 Test Dragon Extinction (Law Violation)',
    testHallucination: isPersian ? '🗝️ تست توهم کلید طلایی' : '🗝️ Test Item Hallucination',
    testLegit: isPersian ? '⚔️ تست حمله به نگهبان سیاه‌سنگ' : '⚔️ Test Guard Strike (Valid Action)',
    simulating: isPersian ? 'در حال شبیه‌سازی و فراخوانی مدل...' : 'Simulating Turn & Calling AI...',
    simulateBtn: isPersian ? 'شبیه‌سازی اکشن و اجرای نوبت' : 'Simulate Action & Generate Turn',
    simOutput: isPersian ? 'خروجی شبیه‌سازی و بررسی نتایج' : 'Simulation Output & Inspection',
    clickSimulate: isPersian
      ? 'برای تست موتور مشخص و خط لوله هوش مصنوعی روی «شبیه‌سازی اکشن» کلیک کنید.'
      : 'Click "Simulate Action" to test the deterministic engine & AI pipeline.',
    validating: isPersian
      ? 'در حال اعتبارسنجی قوانین، محاسبه تاس و تولید روایت...'
      : 'Validating lore guardrails, calculating dice resolution & calling AI director...',
    blocked: isPersian ? 'اکشن توسط قوانین جهان مسدود شد' : 'Guardrail Blocked Action (Violation)',
    guidance: isPersian ? 'راهنمایی غوطه‌وری:' : 'Immersion Guidance:',
    passed: isPersian ? 'قوانین تایید و اکشن با موفقیت حل شد' : 'Guardrail Passed & Resolved Deterministically',
    roll: isPersian ? 'پرتاب تاس:' : 'Roll:',
    generatedProse: isPersian ? 'روایت داستانی تولید شده' : 'Generated Literary Prose',
    nextChoices: isPersian ? 'انتخاب‌های متنی تولید شده' : 'Contextual Next Choices',
    risk: isPersian ? 'ریسک' : 'Risk',
    diceControl: isPersian ? 'کنترل پرتاب تاس:' : 'Dice Roll Override:',
    statsControl: isPersian ? 'ویژگی‌های تستی قهرمان:' : 'Hero Mock Attributes:',
  };

  useEffect(() => {
    if (isPersian) {
      setTestAction('من تلاش میکنم که در چوبی را با جادو باز کنم');
    } else {
      setTestAction('I try to pick the iron cell lock using a hidden lockpick');
    }
    setSandboxResult(null);
  }, [story.id, isPersian]);

  const handleTestSandbox = async () => {
    setLoading(true);
    try {
      const mockPlayerState = {
        stats: mockStats,
        resources: { hp: 100, stamina: 50, gold: 30 },
        inventory: story.rpgSystem.startingInventory,
        discoveredLocationIds: isPersian ? ['loc_siahsang_dungeon'] : ['loc_dungeon_cell'],
        relationships: isPersian
          ? { npc_reza_gard: { trust: 0, knownSecrets: [], notes: [] } }
          : { npc_captain_rolan: { trust: 0, knownSecrets: [], notes: [] } },
        activeQuestIds: ['quest_prologue'],
        completedQuestIds: [],
        currentLocationId: isPersian ? 'loc_siahsang_dungeon' : 'loc_dungeon_cell',
      };

      const res = await fetch('/api/play/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          playerActionText: testAction,
          actionStyle: actionStyle,
          riskLevel: 'high',
          playerState: mockPlayerState,
          turnNumber: 2,
          forcedDiceRoll: forcedRoll,
        }),
      });

      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
        </div>
        <p className="text-sm text-zinc-400">{t.subheading}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Sandbox & Parameters */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Play className="w-4 h-4 text-emerald-400" /> {t.sandboxTitle}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{t.sandboxDesc}</p>

            {/* Action Textarea */}
            <textarea
              value={testAction}
              onChange={(e) => setTestAction(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all resize-none shadow-inner"
              placeholder={t.placeholder}
            />

            {/* Quick Test Presets */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() =>
                  setTestAction(
                    isPersian
                      ? 'من با استفاده از جادوی باستانی یک اژدها را احضار میکنم تا درهای قلعه را ذوب کند'
                      : 'I summon a dragon to melt the citadel gates'
                  )
                }
                className="text-[11px] text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 transition-all font-medium"
              >
                {t.testExtinction}
              </button>
              <button
                onClick={() =>
                  setTestAction(
                    isPersian
                      ? 'من با کلید الماسی زرین در را باز میکنم'
                      : 'I unlock the iron door with a golden diamond key'
                  )
                }
                className="text-[11px] text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 transition-all font-medium"
              >
                {t.testHallucination}
              </button>
              <button
                onClick={() =>
                  setTestAction(
                    isPersian
                      ? 'با مشعل روی دیوار به نگهبان نزدیک می‌شوم و او را غافلگیر می‌کنم'
                      : 'I swing the burning torch at the guard to create an opening'
                  )
                }
                className="text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all font-medium"
              >
                {t.testLegit}
              </button>
            </div>

            {/* Calibration Controls */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-3">
              {/* Dice Roll Override */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  {t.diceControl}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setForcedRoll(undefined)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                      forcedRoll === undefined
                        ? 'bg-amber-500 text-zinc-950 shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    🎲 Auto Random
                  </button>
                  <button
                    onClick={() => setForcedRoll(20)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                      forcedRoll === 20
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    ⭐ Nat 20 (Crit)
                  </button>
                  <button
                    onClick={() => setForcedRoll(1)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                      forcedRoll === 1
                        ? 'bg-rose-500 text-zinc-100 shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    💀 Nat 1 (Crit Fail)
                  </button>
                </div>
              </div>

              {/* Mock Attributes Grid */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  {t.statsControl}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(mockStats).map(([k, val]) => (
                    <div key={k} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">{k}</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) =>
                          setMockStats((prev) => ({ ...prev, [k]: parseInt(e.target.value) || 10 }))
                        }
                        className="w-full bg-transparent text-center text-xs font-mono font-bold text-amber-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleTestSandbox}
              disabled={loading || !testAction.trim()}
              className="w-full mt-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                t.simulating
              ) : (
                <>
                  <Zap className="w-4 h-4" /> {t.simulateBtn}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Results & Context Inspector */}
        <div className="lg:col-span-7">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 shadow-xl min-h-[440px]">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" /> {t.simOutput}
            </h3>

            {!sandboxResult && !loading && (
              <div className="h-80 flex flex-col items-center justify-center text-zinc-500 text-center">
                <Dice5 className="w-14 h-14 mb-3 stroke-[1.5] text-zinc-600 animate-pulse" />
                <p className="text-xs max-w-sm">{t.clickSimulate}</p>
              </div>
            )}

            {loading && (
              <div className="h-80 flex flex-col items-center justify-center text-amber-400/90 animate-pulse">
                <Sparkles className="w-12 h-12 mb-3 animate-spin text-amber-400" />
                <p className="text-xs">{t.validating}</p>
              </div>
            )}

            {sandboxResult && !loading && (
              <div className="space-y-4">
                {/* Guardrail Violation */}
                {sandboxResult.isGuardrailViolation ? (
                  <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 shadow-xl">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
                      <AlertCircle className="w-5 h-5" /> {t.blocked}
                    </div>
                    <p className="text-xs mt-2.5 text-rose-300/90 leading-relaxed font-semibold">
                      {sandboxResult.rejectionReason}
                    </p>
                    {sandboxResult.suggestedAction && (
                      <p className="text-xs mt-3 p-3.5 rounded-xl bg-zinc-950/70 border border-rose-500/20 text-zinc-300">
                        <strong className="text-rose-300">{t.guidance}</strong>{' '}
                        {sandboxResult.suggestedAction}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                      <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                        <CheckCircle className="w-5 h-5" /> {t.passed}
                      </div>
                      {sandboxResult.data?.resolution && (
                        <span className="text-xs font-mono px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold uppercase border border-emerald-500/30">
                          {sandboxResult.data.resolution.outcome} ({t.roll}{' '}
                          {sandboxResult.data.resolution.diceRoll})
                        </span>
                      )}
                    </div>

                    {/* Generated Narrative Prose */}
                    {sandboxResult.data?.beat && (
                      <div className="p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 shadow-lg">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                          {t.generatedProse}
                        </h4>
                        <p className="text-sm text-zinc-200 leading-relaxed font-serif">
                          {sandboxResult.data.beat.narrativeProse}
                        </p>

                        {/* Generated Choices */}
                        <div className="mt-5 pt-5 border-t border-zinc-800/70">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                            {t.nextChoices}
                          </h5>
                          <div className="space-y-2.5">
                            {sandboxResult.data.beat.presentedChoices.map(
                              (choice: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between gap-3"
                                >
                                  <span>{choice.text}</span>
                                  <span
                                    className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg shrink-0 ${
                                      choice.riskLevel === 'high'
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : choice.riskLevel === 'medium'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}
                                  >
                                    {choice.riskLevel} {t.risk}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
