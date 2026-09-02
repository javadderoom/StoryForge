'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  Volume2,
  VolumeX,
  Library,
  Zap,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { WebShopModal } from '@/components/billing/WebShopModal';
import { DiceRollModal } from '@/components/DiceRollModal';
import { ReaderSettingsModal } from '@/components/ReaderSettingsModal';
import { StoryCatalogModal } from '@/components/StoryCatalogModal';
import { CharacterCreationModal } from '@/components/play/CharacterCreationModal';
import { Compendium } from '@/components/play/Compendium';
import { AtmosphereCanvas } from '@/components/play/AtmosphereCanvas';
import { ThreeDChoiceCard } from '@/components/play/ThreeDChoiceCard';
import {
  fetchCatalog,
  startSession,
  resumeSession,
  patchSession,
  sendAction,
  getCoverUrl,
  CharacterSetup,
  CatalogStory,
  StartSessionResult,
} from '@/lib/play/api';
import {
  REALM_THEMES,
  RealmPreset,
  FontSize,
  LineHeight,
  realmFromStory,
} from '@/lib/play/realmTheme';
import { resolveActionCheck, DiceResolution } from '@/lib/play/rpgEngine';
import { audioService, ambientFromLocation } from '@/lib/play/audioService';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { notify } from '@/lib/notify';

const PLAY_SELECTED_STORY_KEY = 'storyforge_play_selected_story_v1';
const PLAY_SESSION_KEY = 'storyforge_play_session_v1';
const PLAY_SETTINGS_KEY = 'storyforge_play_settings_v1';

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

interface PersistedSettings {
  theme: RealmPreset;
  fontSize: FontSize;
  lineHeight: LineHeight;
  enableParticles: boolean;
}

export default function Home() {
  const [stories, setStories] = useState<CatalogStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<CatalogStory | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [playerState, setPlayerState] = useState<any>(null);
  const [storyMeta, setStoryMeta] = useState<{ id: string; title: string; language: string; rpgSystem: any } | null>(null);
  const [lore, setLore] = useState<{ laws: any[]; locations: { id: string; name: string }[]; npcs: { id: string; name: string }[] }>({ laws: [], locations: [], npcs: [] });
  const [currentBeat, setCurrentBeat] = useState<{ narrative: string; choices: any[] } | null>(null);
  const [turnNumber, setTurnNumber] = useState<number>(1);
  const [freeTextAction, setFreeTextAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<DiceResolution | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCharCreationOpen, setIsCharCreationOpen] = useState(false);
  const [isCompendiumOpen, setIsCompendiumOpen] = useState(false);
  const [isDiceModalOpen, setIsDiceModalOpen] = useState(false);
  const [diceRolling, setDiceRolling] = useState(true);
  const [diceResolution, setDiceResolution] = useState<DiceResolution | null>(null);
  const [diceActionText, setDiceActionText] = useState('');
  const [pendingTurn, setPendingTurn] = useState<any | null>(null);

  // Auth & Billing
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);

  // Reader customization
  const [settings, setSettings] = useState<PersistedSettings>(() => {
    try {
      const raw = localStorage.getItem(PLAY_SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return { theme: 'darkFantasy', fontSize: 'base', lineHeight: 'relaxed', enableParticles: true } as PersistedSettings;
  });

  // Audio mutes
  const [sfxMuted, setSfxMuted] = useState(false);
  const [ambientMuted, setAmbientMuted] = useState(false);

  const isRtl = (storyMeta?.language ?? selectedStory?.language ?? 'en') !== 'en';

  // ---- Persist settings ----
  useEffect(() => {
    try {
      localStorage.setItem(PLAY_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // ---- Audio subscription ----
  useEffect(() => {
    const apply = (s: { sfxMuted: boolean; ambientMuted: boolean }) => {
      setSfxMuted(s.sfxMuted);
      setAmbientMuted(s.ambientMuted);
    };
    return audioService.subscribe(apply);
  }, []);

  const startGame = useCallback(
    async (storyId: string, resumeId?: string, setup?: CharacterSetup, genres?: string[]) => {
      setLoading(true);
      setErrorMessage(null);
      setLastOutcome(null);
      try {
        let data: StartSessionResult | null;
        if (resumeId) {
          data = await resumeSession(resumeId);
          if (!data) {
            // stale session — fall through to fresh start
            data = await startSession(storyId);
          }
        } else {
          data = await startSession(storyId, setup);
        }
        if (!data) throw new Error('No session data');
        setSessionId(data.sessionId);
        setPlayerState(data.playerState);
        setCurrentBeat(data.currentBeat);
        setTurnNumber(data.turnNumber ?? 1);
        setStoryMeta(data.story);
        setLore(data.lore);
        // Auto-pick realm theme from the story (only if user hasn't customized yet)
        const auto = realmFromStory({ storyId: data.story.id, genres });
        setSettings((s) => (s.theme === 'darkFantasy' && auto !== 'darkFantasy' ? { ...s, theme: auto } : s));
        try {
          localStorage.setItem(PLAY_SELECTED_STORY_KEY, storyId);
          localStorage.setItem(PLAY_SESSION_KEY, data.sessionId);
        } catch {
          /* ignore */
        }
        audioService.playAmbient(ambientFromLocation(data.playerState.currentLocationId));
      } catch (e: any) {
        setErrorMessage(e?.message || 'Failed to start session');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ---- Boot: load catalog + resume ----
  useEffect(() => {
    let active = true;
    (async () => {
      const catalog = await fetchCatalog();
      if (!active) return;
      setStories(catalog);
      let savedStoryId = '';
      let savedSession = '';
      try {
        savedStoryId = localStorage.getItem(PLAY_SELECTED_STORY_KEY) || '';
        savedSession = localStorage.getItem(PLAY_SESSION_KEY) || '';
      } catch {
        /* ignore */
      }
      if (savedSession && savedStoryId) {
        const story = catalog.find((s) => s.id === savedStoryId) || null;
        setSelectedStory(story);
        if (story) await startGame(savedStoryId, savedSession, undefined, story.genres);
        else setIsCatalogOpen(true);
      } else if (savedStoryId) {
        const story = catalog.find((s) => s.id === savedStoryId) || null;
        setSelectedStory(story);
        setIsCharCreationOpen(true);
      } else {
        setIsCatalogOpen(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [startGame]);

  const onSelectStory = (story: CatalogStory) => {
    setSelectedStory(story);
    setIsCharCreationOpen(true);
  };

  const onEmbark = async (setup: CharacterSetup) => {
    if (!selectedStory) return;
    setIsCharCreationOpen(false);
    await startGame(selectedStory.id, undefined, setup, selectedStory.genres);
  };

  const onChoice = async (choice: any) => {
    if (loading || !playerState || !selectedStory) return;
    audioService.playSfx('buttonClick');
    setErrorMessage(null);
    setDiceActionText(choice.text);

    const roll = rollD20();
    const resolution = resolveActionCheck({
      actionText: choice.text,
      playerState,
      targetDC: choice.targetDC,
      riskLevel: choice.riskLevel || 'medium',
      forcedDiceRoll: roll,
      isPersian: isRtl,
    });
    setDiceResolution(resolution);
    setLastOutcome(resolution);
    setIsDiceModalOpen(true);
    setDiceRolling(true);

    const nextTurn = turnNumber + 1;
    try {
      const json = await sendAction({
        storyId: selectedStory.id,
        sessionId,
        playerActionText: choice.text,
        actionStyle: choice.style || 'tactical',
        riskLevel: choice.riskLevel || 'medium',
        statId: resolution.requiredStat,
        targetDC: resolution.difficultyClass,
        forcedDiceRoll: roll,
        playerState,
        turnNumber: nextTurn,
      });
      if (json.isGuardrailViolation) {
        setErrorMessage(json.rejectionReason);
        notify.error(isRtl ? 'اقدام شما توسط قوانین جهان رد شد.' : 'Action blocked by world laws.');
        setIsDiceModalOpen(false);
        return;
      }
      if (!json.success) {
        setErrorMessage(json.error || 'The scribe is silent.');
        setIsDiceModalOpen(false);
        return;
      }
      // Park the beat until the reader taps "Continue Narrative"
      setPendingTurn(json.data);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Network error');
      setIsDiceModalOpen(false);
    }
  };

  const applyPendingTurn = () => {
    if (!pendingTurn) return;
    setCurrentBeat({ narrative: pendingTurn.beat.narrativeProse, choices: pendingTurn.beat.presentedChoices });
    setPlayerState(pendingTurn.updatedPlayerState);
    setTurnNumber((t) => t + 1);
    audioService.playAmbient(ambientFromLocation(pendingTurn.updatedPlayerState.currentLocationId));
    audioService.playSfx('pageTurn');
    setFreeTextAction('');
    setIsDiceModalOpen(false);
    setPendingTurn(null);
    setDiceResolution(null);
  };

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeTextAction.trim()) return;
    onChoice({ text: freeTextAction, style: 'free_text', riskLevel: 'medium' });
  };

  const onInventoryChange = async (newState: any, toast?: { kind: 'success' | 'warning' | 'info'; text: string }) => {
    setPlayerState(newState);
    if (sessionId) await patchSession(sessionId, newState);
    if (toast) {
      if (toast.kind === 'success') notify.success(toast.text);
      else notify.info(toast.text);
    }
  };

  const restartAdventure = async () => {
    if (!selectedStory) return;
    try {
      localStorage.removeItem(PLAY_SESSION_KEY);
    } catch {
      /* ignore */
    }
    setSessionId('');
    audioService.stopAmbient();
    setIsCharCreationOpen(true);
  };

  const themeObj = REALM_THEMES[settings.theme];
  const isDanger = useHpPct(playerState, storyMeta) < 0.3;

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090E] flex items-center justify-center text-amber-500">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#08090E] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-amber-500/30 selection:text-amber-200"
      >
        <AtmosphereCanvas theme={themeObj} enableParticles={true} isDanger={false} />

        <div className="relative z-10 w-full max-w-md bg-[#0F111D]/95 border border-[#272A3C] backdrop-blur-xl rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-black text-white text-3xl shadow-xl shadow-amber-500/20 mx-auto mb-5">
            ⚡
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-2 font-sans">
            افسانه‌ساز
          </h1>
          <p className="text-xs text-amber-400 font-semibold mb-3">
            رمان تعاملی نقش‌آفرینی و شبیه‌ساز روایت با هوش مصنوعی
          </p>

          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            برای ورود به دنیای روایت‌های تعاملی، لطفا ابتدا وارد حساب کاربری خود شوید یا ثبت‌نام کنید.
          </p>

          <div className="flex items-center gap-2 p-3.5 mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-xs font-bold text-right">
            <Sparkles className="w-5 h-5 shrink-0 text-amber-400" />
            <span>با ایجاد حساب، ۱۵ صحنه داستانی رایگان به عنوان هدیه دریافت کنید!</span>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ورود یا ایجاد حساب در افسانه‌ساز</span>
          </button>
        </div>

        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        background: `linear-gradient(160deg, ${themeObj.bgGradientStart}, ${themeObj.bgGradientEnd})`,
        color: themeObj.bodyText,
      }}
      className="min-h-screen flex flex-col font-sans transition-colors duration-500"
    >
      {/* Ambient particles */}
      {settings.enableParticles && (
        <AtmosphereCanvas theme={themeObj} enableParticles={settings.enableParticles} isDanger={isDanger} />
      )}

      {/* Header */}
      <header
        style={{ backgroundColor: themeObj.headerOverlay }}
        className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md md:px-6"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 font-bold text-white shadow-md shadow-amber-500/20">
            ⚡
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-100">
              <span>{storyMeta?.title || selectedStory?.title || (isRtl ? 'بدون داستان' : 'No Story Selected')}</span>
              <button
                onClick={() => setIsCatalogOpen(true)}
                className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400 transition-all hover:bg-amber-500/20"
              >
                <BookOpen className="h-2.5 w-2.5" />
                <span>{isRtl ? 'کتابخانه' : 'Library'}</span>
              </button>
            </h1>
            <p className="text-[11px]" style={{ color: themeObj.mutedText }}>
              {isRtl ? 'رمان تعاملی نقش‌آفرینی' : 'Interactive Dark RPG Novel'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastOutcome && (
            <button
              onClick={() => {
                setDiceResolution(lastOutcome);
                setDiceRolling(false);
                setIsDiceModalOpen(true);
              }}
              className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400 transition-all hover:bg-amber-500/20"
              title={isRtl ? 'مشاهده پرتاب تاس' : 'View Dice Roll'}
            >
              <Dices className="h-3.5 w-3.5" />
              <span className="font-mono font-bold">{toPersianDigits(lastOutcome.d20)}</span>
            </button>
          )}

          <button
            onClick={() => setIsCompendiumOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-300 transition-all hover:bg-zinc-700"
            title={isRtl ? 'کدکس' : 'Codex'}
          >
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isRtl ? 'کدکس' : 'Codex'}</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-300 transition-all hover:bg-zinc-700"
            title={isRtl ? 'تنظیمات' : 'Atmosphere'}
          >
            <Palette className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isRtl ? 'پوسته' : 'Theme'}</span>
          </button>

          {/* Credit Balance Pill */}
          <button
            onClick={() => setIsShopModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-500/25 cursor-pointer"
            title={isRtl ? 'شارژ و مشاهده بسته‌های اعتباری' : 'Credit Balance & Shop'}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>{toPersianDigits(user?.creditBalance ?? 0)}</span>
          </button>

          {/* Studio Link - ONLY for Admin & Author */}
          {(user?.role === 'ADMIN' || user?.role === 'AUTHOR') && (
            <Link
              href="/studio"
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-300 transition-all hover:bg-purple-500/25"
              title={isRtl ? 'ورود به استودیو نویسندگی و مدیریت' : 'Studio & Admin'}
            >
              <Shield className="h-3.5 w-3.5 text-purple-400" />
              <span className="hidden md:inline">{isRtl ? 'استودیو' : 'Studio'}</span>
            </Link>
          )}

          {/* User Profile / Login */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-300 transition-all hover:bg-zinc-700"
          >
            <UserIcon className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">
              {isAuthenticated ? (user?.name || user?.phoneNumber) : (isRtl ? 'ورود' : 'Login')}
            </span>
          </button>

          <button
            onClick={() => audioService.toggleSfxMute()}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/80 p-1.5 text-zinc-300 transition-all hover:bg-zinc-700"
            title={isRtl ? 'صدای افکت' : 'SFX'}
          >
            {sfxMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => audioService.toggleAmbientMute()}
            className="rounded-lg border border-zinc-700/60 bg-zinc-800/80 p-1.5 text-zinc-300 transition-all hover:bg-zinc-700"
            title={isRtl ? 'موسیقی محیط' : 'Ambient'}
          >
            {ambientMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={restartAdventure}
            className="flex items-center gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-300 transition-all hover:bg-zinc-700"
            title={isRtl ? 'شروع مجدد' : 'Restart'}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isRtl ? 'شروع مجدد' : 'Restart'}</span>
          </button>

          <a
            href="/studio"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-amber-500/20 transition-all hover:from-amber-400 hover:to-rose-500"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isRtl ? 'استودیو' : 'Studio'}</span>
          </a>
        </div>
      </header>

      {!storyMeta && !loading ? (
        <EmptyState isRtl={isRtl} onOpenLibrary={() => setIsCatalogOpen(true)} coverUrl={selectedStory ? getCoverUrl(selectedStory.id, selectedStory.coverImageUrl) : null} title={selectedStory?.title} onBegin={() => setIsCharCreationOpen(true)} />
      ) : (
        <div className="grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-6 p-4 md:mx-auto md:grid-cols-12 md:p-6">
          {/* Reader */}
          <div className="space-y-6 md:col-span-8">
            <div
              style={{ backgroundColor: themeObj.cardBg, borderColor: themeObj.cardBorder }}
              className="relative overflow-hidden rounded-3xl border p-6 shadow-2xl md:p-8"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-96 w-96 rounded-full blur-3xl" style={{ background: `${themeObj.primaryAccent}0d` }} />

              {lastOutcome && !isDiceModalOpen && (
                <button
                  onClick={() => {
                    setDiceResolution(lastOutcome);
                    setDiceRolling(false);
                    setIsDiceModalOpen(true);
                  }}
                  className="mb-6 flex w-full items-center justify-between rounded-2xl border p-3 text-xs"
                  style={{ backgroundColor: themeObj.cardBg, borderColor: themeObj.cardBorder }}
                >
                  <span className="flex items-center gap-2" style={{ color: themeObj.mutedText }}>
                    <Dices className="h-4 w-4" style={{ color: themeObj.primaryAccent }} />
                    <span>
                      {isRtl ? 'بررسی تاس: ' : 'Check: '}
                      <strong style={{ color: themeObj.bodyText }}>
                        {isRtl
                          ? `تاس ${toPersianDigits(lastOutcome.d20)} (مجموع ${toPersianDigits(lastOutcome.total)} در برابر DC ${toPersianDigits(lastOutcome.difficultyClass)})`
                          : `Roll ${lastOutcome.d20} (Total ${lastOutcome.total} vs DC ${lastOutcome.difficultyClass})`}
                      </strong>
                    </span>
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: lastOutcome.success ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)',
                      color: lastOutcome.success ? '#34d399' : '#fb7185',
                    }}
                  >
                    {lastOutcome.outcome.replace('_', ' ')}
                  </span>
                </button>
              )}

              {errorMessage && (
                <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs leading-relaxed text-rose-300">
                  ⚠️ <strong>{isRtl ? 'خطای قانون جهان:' : 'Guardrail Block:'}</strong> {errorMessage}
                </div>
              )}

              <div className="prose prose-invert max-w-none">
                {loading ? (
                  <div className="flex animate-pulse flex-col items-center justify-center space-y-3 py-16 text-amber-400/80">
                    <Sparkles className="h-8 w-8 animate-spin" />
                    <p className="text-sm font-medium">{isRtl ? 'داستان در حال شکل‌گیری است...' : 'The narrative unfolds...'}</p>
                  </div>
                ) : (
                  <p className={`whitespace-pre-line tracking-wide transition-all ${fontSizeClass[settings.fontSize]} ${lineHeightClass[settings.lineHeight]}`}>
                    {currentBeat?.narrative}
                  </p>
                )}
              </div>

              {!loading && currentBeat?.choices && (
                <div className="mt-8 space-y-4 border-t pt-8" style={{ borderColor: themeObj.cardBorder }}>
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: themeObj.mutedText }}>
                    <Sparkles className="h-3.5 w-3.5" style={{ color: themeObj.primaryAccent }} />
                    <span>{isRtl ? 'چه تصمیمی می‌گیری؟' : 'What will you do?'}</span>
                  </h3>

                  <div className="space-y-3">
                    {currentBeat.choices.map((choice: any, idx: number) => (
                      <ThreeDChoiceCard
                        key={idx}
                        choice={choice}
                        theme={themeObj}
                        isPersian={isRtl}
                        onTap={() => onChoice(choice)}
                      />
                    ))}
                  </div>

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
                      className="flex-1 rounded-xl border bg-zinc-900 px-4 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1"
                      style={{ borderColor: themeObj.cardBorder, ['--tw-ring-color' as any]: themeObj.primaryAccent }}
                    />
                    <button
                      type="submit"
                      disabled={!freeTextAction.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-amber-400 disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{isRtl ? 'انجام بده' : 'Act'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* HUD */}
          <div className="space-y-6 md:col-span-4">
            <div style={{ backgroundColor: themeObj.cardBg, borderColor: themeObj.cardBorder }} className="rounded-3xl border p-6 shadow-xl">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: themeObj.mutedText }}>
                <Shield className="h-4 w-4" style={{ color: themeObj.primaryAccent }} />
                <span>{isRtl ? 'مشخصات شخصیت' : 'Character'}</span>
              </h2>

              <div className="mt-4 space-y-3">
                {(storyMeta?.rpgSystem?.resources ?? []).map((res: any) => {
                  const curVal = playerState?.resources?.[res.id] ?? res.current ?? 0;
                  const maxVal = res.max ?? 1;
                  const pct = Math.max(0, Math.min(100, (curVal / maxVal) * 100));
                  const danger = res.id === 'hp' && pct < 30;
                  return (
                    <div key={res.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span style={{ color: themeObj.bodyText }}>{res.name}</span>
                        <span style={{ color: danger ? '#fb7185' : res.color || themeObj.primaryAccent }}>
                          {toPersianDigits(curVal)} / {toPersianDigits(maxVal)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: danger ? '#fb7185' : res.color || themeObj.primaryAccent }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t pt-4" style={{ borderColor: themeObj.cardBorder }}>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: themeObj.mutedText }}>
                  {isRtl ? 'ویژگی‌ها' : 'Attributes'}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(storyMeta?.rpgSystem?.stats ?? []).map((stat: any) => (
                    <div key={stat.id} className="flex items-center justify-between rounded-xl border p-2.5" style={{ backgroundColor: themeObj.cardBg, borderColor: themeObj.cardBorder }}>
                      <span className="text-xs" style={{ color: themeObj.bodyText }}>{stat.name}</span>
                      <span className="font-mono text-xs font-bold" style={{ color: themeObj.primaryAccent }}>{toPersianDigits(playerState?.stats?.[stat.id] ?? stat.baseValue ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setIsCompendiumOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition-all"
                style={{ borderColor: themeObj.primaryAccent, color: themeObj.primaryAccent }}
              >
                <Library className="h-3.5 w-3.5" />
                {isRtl ? 'باز کردن کدکس و کوله' : 'Open Codex & Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DiceRollModal
        isOpen={isDiceModalOpen}
        isRolling={diceRolling}
        resolution={diceResolution}
        actionText={diceActionText}
        isPersian={isRtl}
        onContinue={applyPendingTurn}
        onClose={() => setIsDiceModalOpen(false)}
      />

      <ReaderSettingsModal
        isOpen={isSettingsOpen}
        theme={settings.theme}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        enableParticles={settings.enableParticles}
        isPersian={isRtl}
        onThemeChange={(t) => setSettings((s) => ({ ...s, theme: t }))}
        onFontSizeChange={(f) => setSettings((s) => ({ ...s, fontSize: f }))}
        onLineHeightChange={(l) => setSettings((s) => ({ ...s, lineHeight: l }))}
        onParticlesToggled={(v) => setSettings((s) => ({ ...s, enableParticles: v }))}
        onClose={() => setIsSettingsOpen(false)}
      />

      <StoryCatalogModal
        isOpen={isCatalogOpen}
        activeStoryId={selectedStory?.id || ''}
        isPersian={isRtl}
        stories={stories}
        onSelectStory={onSelectStory}
        onClose={() => setIsCatalogOpen(false)}
      />

      {selectedStory && isCharCreationOpen && (
        <CharacterCreationModal
          isOpen
          story={selectedStory}
          theme={themeObj}
          isPersian={isRtl}
          onEmbark={onEmbark}
          onClose={() => setIsCharCreationOpen(false)}
        />
      )}

      {playerState && storyMeta && (
        <Compendium
          isOpen={isCompendiumOpen}
          playerState={playerState}
          storyMeta={storyMeta as any}
          lore={lore as any}
          theme={themeObj}
          isPersian={isRtl}
          onInventoryChange={onInventoryChange}
          onClose={() => setIsCompendiumOpen(false)}
        />
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <WebShopModal
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        onRequireAuth={() => {
          setIsShopModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />
    </div>
  );
}

function useHpPct(playerState: any, storyMeta: any): number {
  const res = storyMeta?.rpgSystem?.resources?.find((r: any) => r.id === 'hp' || r.id === 'health');
  if (!res || !playerState?.resources) return 1;
  const cur = playerState.resources[res.id] ?? res.current ?? 0;
  return cur / (res.max || 1);
}

function EmptyState({
  isRtl,
  onOpenLibrary,
  coverUrl,
  title,
  onBegin,
}: {
  isRtl: boolean;
  onOpenLibrary: () => void;
  coverUrl: string | null;
  title?: string;
  onBegin: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showCover = coverUrl && !imgFailed;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      {showCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl!} alt={title} onError={() => setImgFailed(true)} className="mb-6 h-44 w-32 rounded-xl object-cover shadow-2xl" />
      ) : (
        <BookOpen className="mb-5 h-16 w-16 text-zinc-700" />
      )}
      <h2 className="text-xl font-bold text-zinc-200">{isRtl ? 'هیچ داستانی انتخاب نشده' : 'No story selected'}</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        {isRtl ? 'از کتابخانه داستانی انتخاب کنید یا داستان جدیدی در استودیو بسازید.' : 'Pick a story from the library, or build a new one in the Studio.'}
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={onOpenLibrary} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-all hover:bg-amber-400">
          <BookOpen className="h-4 w-4" />
          {isRtl ? 'باز کردن کتابخانه' : 'Open Library'}
        </button>
        {title && (
          <button onClick={onBegin} className="flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition-all hover:bg-zinc-800">
            <Sparkles className="h-4 w-4 text-amber-400" />
            {isRtl ? 'آغاز ماجراجویی' : 'Begin Tale'}
          </button>
        )}
      </div>
    </div>
  );
}
