'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Sparkles,
  RefreshCw,
  Send,
  Sliders,
  Palette,
  BookOpen,
  Dices,
  Layers,
} from 'lucide-react';
import { DiceRollModal } from '@/components/DiceRollModal';
import {
  ReaderSettingsModal,
  ReaderTheme,
  FontSize,
  LineHeight,
} from '@/components/ReaderSettingsModal';
import { StoryCatalogModal } from '@/components/StoryCatalogModal';

const PLAY_SELECTED_STORY_KEY = 'storyforge_play_selected_story_v1';

export default function Home() {
  const [selectedStoryId, setSelectedStoryId] = useState<string>(() => {
    try {
      return localStorage.getItem(PLAY_SELECTED_STORY_KEY) || '';
    } catch {
      return '';
    }
  });
  const [session, setSession] = useState<any>(null);
  const [currentBeat, setCurrentBeat] = useState<any>(null);
  const [playerState, setPlayerState] = useState<any>(null);
  const [storyMeta, setStoryMeta] = useState<any>(null);
  const [freeTextAction, setFreeTextAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Reader Customization State
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [lastActionText, setLastActionText] = useState('');
  const [theme, setTheme] = useState<ReaderTheme>('charcoal');
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [lineHeight, setLineHeight] = useState<LineHeight>('relaxed');

  const isRtl = (storyMeta?.language ?? 'en') !== 'en';

  // Persist the active play-story selection across refreshes
  useEffect(() => {
    try {
      localStorage.setItem(PLAY_SELECTED_STORY_KEY, selectedStoryId);
    } catch {
      // Ignore
    }
  }, [selectedStoryId]);

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
    setLastActionText(choice.text);

    try {
      const res = await fetch('/api/play/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: selectedStoryId,
          sessionId: session?.sessionId,
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

        // Trigger interactive dice modal if check occurred
        if (json.data.resolution) {
          setIsDiceModalOpen(true);
        }
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

  // Theme styling helpers
  const themeStyles: Record<
    ReaderTheme,
    { bg: string; cardBg: string; border: string; text: string; headerBg: string }
  > = {
    charcoal: {
      bg: '#0d0e14',
      cardBg: '#141522',
      border: 'border-zinc-800/90',
      text: 'text-zinc-200',
      headerBg: 'bg-[#12131c]/90',
    },
    oled: {
      bg: '#050608',
      cardBg: '#090a0f',
      border: 'border-zinc-900',
      text: 'text-zinc-300',
      headerBg: 'bg-[#050608]/95',
    },
    sepia: {
      bg: '#18130e',
      cardBg: '#211a14',
      border: 'border-[#382a1d]',
      text: 'text-[#d6c4b2]',
      headerBg: 'bg-[#1e1712]/95',
    },
    midnight: {
      bg: '#080c16',
      cardBg: '#0f1628',
      border: 'border-indigo-950/80',
      text: 'text-indigo-100',
      headerBg: 'bg-[#0a0f1e]/90',
    },
  };

  const currentThemeStyle = themeStyles[theme];

  const fontSizeClass: Record<FontSize, string> = {
    sm: 'text-sm md:text-base',
    base: 'text-base md:text-lg',
    lg: 'text-lg md:text-xl',
    xl: 'text-xl md:text-2xl',
  };

  const lineHeightClass: Record<LineHeight, string> = {
    normal: 'leading-normal',
    relaxed: 'leading-relaxed',
    loose: 'leading-loose',
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ backgroundColor: currentThemeStyle.bg }}
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 selection:bg-amber-500/30 selection:text-amber-200 ${currentThemeStyle.text}`}
    >
      {/* Top Bar Navigation */}
      <header
        className={`border-b ${currentThemeStyle.border} ${currentThemeStyle.headerBg} backdrop-blur-md px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-40 transition-colors duration-300`}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-md shadow-amber-500/20">
            ⚡
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-zinc-100 flex items-center gap-2">
              <span>{storyMeta?.title || (isRtl ? 'بدون داستان' : 'No Story Selected')}</span>
              <button
                onClick={() => setIsCatalogOpen(true)}
                className="text-[10px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-2.5 h-2.5" />
                <span>{isRtl ? 'تغییر داستان' : 'Library'}</span>
              </button>
            </h1>
            <p className="text-[11px] text-zinc-400">
              {isRtl ? 'رمان تعاملی نقش‌آفرینی' : 'Interactive Dark RPG Novel'}
            </p>
          </div>
        </div>

        {/* Action Controls & Story Switcher */}
        <div className="flex items-center gap-2">
          {/* Reader Atmosphere Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700/60 transition-all cursor-pointer"
            title={isRtl ? 'تنظیمات ظاهر' : 'Reader Atmosphere'}
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isRtl ? 'پوسته و قلم' : 'Theme'}</span>
          </button>

          {/* Quick Dice Roll Re-inspect */}
          {lastOutcome && (
            <button
              onClick={() => setIsDiceModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
              title={isRtl ? 'مشاهده پرتاب تاس' : 'View Dice Roll'}
            >
              <Dices className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{lastOutcome.diceRoll}</span>
            </button>
          )}

          {/* Restart Button */}
          <button
            onClick={() => startNewGame(selectedStoryId)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700/60 transition-all cursor-pointer"
            title={isRtl ? 'شروع مجدد' : 'Restart Adventure'}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRtl ? 'شروع مجدد' : 'Restart'}</span>
          </button>

          {/* Studio Link */}
          <a
            href="/studio"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-semibold shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-rose-500 transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRtl ? 'استودیو' : 'Studio'}</span>
          </a>
        </div>
      </header>

      {(!selectedStoryId || !storyMeta) && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
          <BookOpen className="w-16 h-16 text-zinc-700 mb-5" />
          <h2 className="text-xl font-bold text-zinc-200">
            {isRtl ? 'هیچ داستانی انتخاب نشده' : 'No story selected'}
          </h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm">
            {isRtl
              ? 'از کتابخانه داستانی انتخاب کنید یا داستان جدیدی در استودیو بسازید.'
              : 'Pick a story from the library, or build a new one in the Studio.'}
          </p>
          <button
            onClick={() => setIsCatalogOpen(true)}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-all cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            {isRtl ? 'باز کردن کتابخانه' : 'Open Library'}
          </button>
        </div>
      ) : (
        <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Reader Viewport (Main Column) */}
        <div className="md:col-span-8 space-y-6">
          {/* E-Reader Book Card */}
          <div
            style={{ backgroundColor: currentThemeStyle.cardBg }}
            className={`border ${currentThemeStyle.border} rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-colors duration-300`}
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Last Dice Resolution Quick Banner */}
            {lastOutcome && (
              <div
                onClick={() => setIsDiceModalOpen(true)}
                className="mb-6 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs cursor-pointer hover:border-amber-500/40 transition-all animate-in fade-in slide-in-from-top-2"
              >
                <span className="text-zinc-400 flex items-center gap-2">
                  <Dices className="w-4 h-4 text-amber-400" />
                  <span>
                    {isRtl ? 'بررسی تاس:' : 'Check:'}{' '}
                    <strong className="text-zinc-200">
                      {isRtl
                        ? `تاس ${lastOutcome.diceRoll} (مجموع ${lastOutcome.totalScore} vs DC ${lastOutcome.difficultyClass})`
                        : `Roll ${lastOutcome.diceRoll} (Total ${lastOutcome.totalScore} vs DC ${lastOutcome.difficultyClass})`}
                    </strong>
                  </span>
                </span>
                <span
                  className={`font-bold uppercase text-[10px] px-2.5 py-0.5 rounded-full ${
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
                <div className="py-16 flex flex-col items-center justify-center text-amber-400/80 animate-pulse space-y-3">
                  <Sparkles className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-medium">
                    {isRtl ? 'داستان در حال شکل‌گیری است...' : 'The narrative unfolds...'}
                  </p>
                </div>
              ) : (
                <p
                  className={`${fontSizeClass[fontSize]} ${lineHeightClass[lineHeight]} whitespace-pre-line tracking-wide transition-all`}
                >
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

                {/* Literary Choices without risk tags */}
                <div className="space-y-2.5">
                  {currentBeat.choices.map((choice: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleChoice(choice)}
                      className="w-full text-start p-4 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-amber-500/40 transition-all group cursor-pointer"
                    >
                      <span className="text-sm text-zinc-200 group-hover:text-amber-200 transition-colors leading-relaxed block">
                        {choice.text}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Free Text Input */}
                <form onSubmit={handleFreeTextSubmit} className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={freeTextAction}
                    onChange={(e) => setFreeTextAction(e.target.value)}
                    placeholder={
                      isRtl
                        ? 'یا هر عمل دلخواهی را بنویسید (مثلاً: جستجوی زیر نیمکت)...'
                        : 'Or type any custom action (e.g. search under the wooden bench)...'
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!freeTextAction.trim()}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
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
          <div
            style={{ backgroundColor: currentThemeStyle.cardBg }}
            className={`border ${currentThemeStyle.border} rounded-3xl p-6 shadow-xl space-y-6 transition-colors duration-300`}
          >
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
      )}

      {/* Interactive Dice Roll Resolution Modal */}
      <DiceRollModal
        isOpen={isDiceModalOpen}
        resolution={lastOutcome}
        actionText={lastActionText}
        isPersian={isRtl}
        onClose={() => setIsDiceModalOpen(false)}
      />

      {/* Reader Atmosphere & Typography Modal */}
      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        theme={theme}
        fontSize={fontSize}
        lineHeight={lineHeight}
        isPersian={isRtl}
        onThemeChange={setTheme}
        onFontSizeChange={setFontSize}
        onLineHeightChange={setLineHeight}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Story Catalog & Library Modal */}
      <StoryCatalogModal
        isOpen={isCatalogOpen}
        activeStoryId={selectedStoryId}
        isPersian={isRtl}
        onSelectStory={(storyId) => {
          setSelectedStoryId(storyId);
          startNewGame(storyId);
        }}
        onClose={() => setIsCatalogOpen(false)}
      />
    </div>
  );
}
