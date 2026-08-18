'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Shield, Sword, Sparkles, RefreshCw, Send, Sliders, Globe } from 'lucide-react';

export default function Home() {
  const [selectedStoryId, setSelectedStoryId] = useState<string>('obsidian_citadel');
  const [session, setSession] = useState<any>(null);
  const [currentBeat, setCurrentBeat] = useState<any>(null);
  const [playerState, setPlayerState] = useState<any>(null);
  const [storyMeta, setStoryMeta] = useState<any>(null);
  const [freeTextAction, setFreeTextAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isRtl = storyMeta?.language === 'fa';

  useEffect(() => {
    startNewGame(selectedStoryId);
  }, [selectedStoryId]);

  const startNewGame = async (storyId = selectedStoryId) => {
    setLoading(true);
    setErrorMessage(null);
    setLastOutcome(null);
    try {
      const res = await fetch('/api/play/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });
      const json = await res.json();
      if (json.success) {
        setSession(json.data.session);
        setPlayerState(json.data.session.playerState);
        setCurrentBeat(json.data.currentBeat);
        setStoryMeta(json.data.story);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChoice = async (choice: any) => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/play/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: selectedStoryId,
          playerActionText: choice.text,
          actionStyle: choice.style || 'tactical',
          riskLevel: choice.riskLevel || 'medium',
          statId: choice.requiredStatId,
          targetDC: choice.targetDC,
          playerState,
          turnNumber: (session?.turnCount || 1) + 1,
        }),
      });

      const json = await res.json();
      if (json.isGuardrailViolation) {
        setErrorMessage(json.rejectionReason);
      } else if (json.success) {
        setCurrentBeat({
          narrative: json.data.beat.narrativeProse,
          choices: json.data.beat.presentedChoices,
        });
        setPlayerState(json.data.updatedPlayerState);
        setLastOutcome(json.data.resolution);
        setFreeTextAction('');
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeTextAction.trim()) return;
    handleChoice({ text: freeTextAction, style: 'free_text', riskLevel: 'medium' });
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0d0e14] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200"
    >
      {/* Top Bar */}
      <header className="border-b border-zinc-800/80 bg-[#12131c]/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-md shadow-amber-500/20">
            ⚡
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-zinc-100">
              {storyMeta?.title || 'StoryForge'}
            </h1>
            <p className="text-[11px] text-zinc-400">
              {isRtl ? 'رمان تعاملی نقش‌آفرینی' : 'Interactive Dark RPG Novel'}
            </p>
          </div>
        </div>

        {/* Story Selector & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setSelectedStoryId('obsidian_citadel')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedStoryId === 'obsidian_citadel'
                  ? 'bg-zinc-800 text-amber-400 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setSelectedStoryId('ghale_siahsang')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedStoryId === 'ghale_siahsang'
                  ? 'bg-zinc-800 text-amber-400 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              فارسی
            </button>
          </div>

          <button
            onClick={() => startNewGame(selectedStoryId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRtl ? 'شروع مجدد' : 'Restart'}</span>
          </button>
          <a
            href="/studio"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-semibold shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-rose-500 transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isRtl ? 'استودیو سازنده' : 'Open Studio'}</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Reader Viewport (Main Column) */}
        <div className="md:col-span-8 space-y-6">
          {/* E-Reader Book Card */}
          <div className="bg-[#141522] border border-zinc-800/90 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Last Dice Resolution Pill */}
            {lastOutcome && (
              <div className="mb-6 p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
                <span className="text-zinc-400">
                  {isRtl ? 'تاس و مهارت: ' : 'Check: '}
                  <strong className="text-zinc-200">
                    {isRtl ? `تاس ${lastOutcome.diceRoll} (مجموع ${lastOutcome.totalScore} در برابر دشواری ${lastOutcome.difficultyClass})` : `Roll ${lastOutcome.diceRoll} (Total ${lastOutcome.totalScore} vs DC ${lastOutcome.difficultyClass})`}
                  </strong>
                </span>
                <span
                  className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                    lastOutcome.outcome.includes('success')
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {lastOutcome.outcome.replace('_', ' ')}
                </span>
              </div>
            )}

            {/* Guardrail Violation Alert */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed animate-shake">
                ⚠️ <strong>{isRtl ? 'خطای قانون جهان:' : 'Guardrail Block:'}</strong> {errorMessage}
              </div>
            )}

            {/* Novel Prose */}
            <div className="prose prose-invert max-w-none">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-amber-400/80 animate-pulse space-y-2">
                  <Sparkles className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">{isRtl ? 'داستان در حال شکل‌گیری است...' : 'The narrative unfolds...'}</p>
                </div>
              ) : (
                <p className="text-base md:text-lg leading-relaxed text-zinc-200 font-serif whitespace-pre-line tracking-wide">
                  {currentBeat?.narrative}
                </p>
              )}
            </div>

            {/* Choices & Actions */}
            {!loading && currentBeat?.choices && (
              <div className="mt-8 pt-8 border-t border-zinc-800/80 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isRtl ? 'چه تصمیمی می‌گیری؟' : 'What will you do?'}</span>
                </h3>

                <div className="space-y-2.5">
                  {currentBeat.choices.map((choice: any, idx: number) => {
                    const isHigh = choice.riskLevel === 'high';
                    const isMedium = choice.riskLevel === 'medium';
                    return (
                      <button
                        key={idx}
                        onClick={() => handleChoice(choice)}
                        className="w-full text-left p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-amber-500/40 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <span className="text-sm text-zinc-200 group-hover:text-amber-200 transition-colors pr-4">
                          {choice.text}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                            isHigh
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              : isMedium
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {choice.riskLevel} {isRtl ? 'ریسک' : 'Risk'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Free Text Input */}
                <form onSubmit={handleFreeTextSubmit} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={freeTextAction}
                    onChange={(e) => setFreeTextAction(e.target.value)}
                    placeholder={
                      isRtl
                        ? 'یا هر عمل دلخواهی را بنویسید (مثلاً: نگاه کردن به زیر تخت)...'
                        : 'Or type any custom action (e.g. examine the iron lock)...'
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!freeTextAction.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'انجام بده' : 'Act'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Discreet RPG Drawer / HUD (Right Column) */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-[#141522] border border-zinc-800/90 rounded-3xl p-6 shadow-xl space-y-6">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>{isRtl ? 'مشخصات شخصیت' : 'Character Status'}</span>
            </h2>

            {/* Vitals */}
            <div className="space-y-3">
              {storyMeta?.rpgSystem?.resources?.map((res: any) => {
                const curVal = playerState?.resources?.[res.id] ?? res.current;
                return (
                  <div key={res.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-300">{res.name}</span>
                      <span style={{ color: res.color }}>
                        {curVal} / {res.max}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(curVal / res.max) * 100}%`,
                          backgroundColor: res.color || '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="pt-4 border-t border-zinc-800/80">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {isRtl ? 'ویژگی‌ها' : 'Attributes'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {storyMeta?.rpgSystem?.stats?.map((stat: any) => (
                  <div
                    key={stat.id}
                    className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex justify-between items-center"
                  >
                    <span className="text-xs text-zinc-300">{stat.name}</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {playerState?.stats?.[stat.id] ?? stat.baseValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory */}
            <div className="pt-4 border-t border-zinc-800/80">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {isRtl ? 'کوله پشتی' : 'Inventory'}
              </h3>
              <div className="space-y-2">
                {playerState?.inventory?.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex justify-between items-center text-xs"
                  >
                    <span className="text-zinc-200">{item.name}</span>
                    <span className="text-zinc-500 font-mono">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
