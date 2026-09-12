'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Shield,
  Sparkles,
  RefreshCw,
  Send,
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
import { GameLoadingScreen } from '@/components/play/GameLoadingScreen';
import { Compendium } from '@/components/play/Compendium';
import { AtmosphereCanvas } from '@/components/play/AtmosphereCanvas';
import { NarrativeProse } from '@/components/play/NarrativeProse';
import { ThreeDChoiceCard } from '@/components/play/ThreeDChoiceCard';
import { TensionClockWidget } from '@/components/play/TensionClockWidget';
import { preloadD20 } from '@/lib/play/diceAssetCache';
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
import { resolveActionCheck, serverToCheckResolution, DiceResolution, getEffectiveStatValue, formatStatName } from '@/lib/play/rpgEngine';
import { audioService, ambientFromLocation } from '@/lib/play/audioService';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { notify } from '@/lib/notify';

const PLAY_SELECTED_STORY_KEY = 'storyforge_play_selected_story_v1';
const PLAY_SESSION_KEY = 'storyforge_play_session_v1';
const PLAY_SETTINGS_KEY = 'storyforge_play_settings_v1';

/** Per-story session so a created character survives reloads and story switches. */
function sessionKeyFor(storyId: string): string {
  return `storyforge_play_session_v1_${storyId}`;
}
function readStoredSession(storyId: string): string {
  try {
    const perStory = localStorage.getItem(sessionKeyFor(storyId));
    if (perStory) return perStory;
    // Legacy fallback: single global key from before per-story sessions.
    const selected = localStorage.getItem(PLAY_SELECTED_STORY_KEY);
    if (selected === storyId) return localStorage.getItem(PLAY_SESSION_KEY) || '';
  } catch {
    /* ignore */
  }
  return '';
}
function writeStoredSession(storyId: string, sessId: string) {
  try {
    localStorage.setItem(sessionKeyFor(storyId), sessId);
    localStorage.setItem(PLAY_SELECTED_STORY_KEY, storyId);
    localStorage.setItem(PLAY_SESSION_KEY, sessId);
  } catch {
    /* ignore */
  }
}
function clearStoredSession(storyId: string) {
  try {
    localStorage.removeItem(sessionKeyFor(storyId));
    if (localStorage.getItem(PLAY_SELECTED_STORY_KEY) === storyId) {
      localStorage.removeItem(PLAY_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

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
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
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
  const [isGeneratingBeat, setIsGeneratingBeat] = useState(false);
  // Plan 13: hazard displacement banner (location name resolved from lore list).
  const [displacementBanner, setDisplacementBanner] = useState<string | null>(null);
  const isDiceModalOpenRef = useRef(false);
  useEffect(() => {
    isDiceModalOpenRef.current = isDiceModalOpen;
  }, [isDiceModalOpen]);

  // Auth & Billing
  const { user, isAuthenticated, isLoading, updateCreditBalance } = useAuth();
  // Guards double-tap double-spend: one turn (and one credit) per tap.
  const [actionInFlight, setActionInFlight] = useState(false);
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

  // Proactively pre-cache 3D D20 dice model in the background on app mount
  useEffect(() => {
    preloadD20().catch(() => {});
  }, []);

  // Plan 13: surface hazard displacement as an animated banner (auto-dismiss).
  const showDisplacementBanner = useCallback((data: any, loreList: { id: string; name: string }[]) => {
    if (!data?.locationChanged) return;
    const locId = data?.displacedLocationId || data?.updatedPlayerState?.currentLocationId;
    const name = loreList?.find((l) => l.id === locId)?.name || locId || '';
    setDisplacementBanner(name);
    window.setTimeout(() => setDisplacementBanner(null), 8000);
  }, []);

  const startGame = useCallback(
    async (storyId: string, resumeId?: string, setup?: CharacterSetup, genres?: string[]) => {
      setIsGameLoading(true);
      setLoadingProgress(3);
      setLoading(true);
      setErrorMessage(null);
      setLastOutcome(null);

      // Natural progress: the ~7MB D20 download dominates load time, so it owns
      // ~85% of the bar; session setup owns ~10%. The displayed value eases toward
      // the real target (never jumps, never stalls) and only hits 100 when both
      // are truly done. Capped at 97 until completion.
      let diceRatio = 0;
      let sessionDone = false;
      const target = () => 3 + diceRatio * 85 + (sessionDone ? 9 : 0);
      const progressTimer = window.setInterval(() => {
        setLoadingProgress((prev) => {
          const t = Math.min(97, target());
          if (prev >= t) return prev;
          const next = prev + Math.max(0.4, (t - prev) * 0.08);
          return Math.round(Math.min(t, next) * 10) / 10;
        });
      }, 120);

      // Start preloading the 3D D20 dice model in parallel with the session setup
      const dicePreloadPromise = preloadD20((ratio) => {
        diceRatio = Math.min(1, Math.max(0, ratio));
      }).catch((err) => {
        console.warn('Background D20 preload non-fatal warning:', err);
      });

      try {
        // Read any local draft created or modified in Studio
        let localDraft: any = undefined;
        try {
          const draftRaw = localStorage.getItem(`storyforge_studio_draft_v1_${storyId}`);
          if (draftRaw) localDraft = JSON.parse(draftRaw);
        } catch {
          /* ignore */
        }

        let data: StartSessionResult | null;
        if (resumeId) {
          data = await resumeSession(resumeId);
          if (!data) {
            // Stale session (server restart / DB off): the saved character is
            // gone, so send the reader back to character creation instead of
            // silently starting with a default character.
            clearStoredSession(storyId);
            setSessionId('');
            setPlayerState(null);
            setIsCharCreationOpen(true);
            return;
          }
          // If the resumed session has no narrative content (e.g. started before scenes were written),
          // clear the blank session and start a fresh session with the newly authored beats/draft.
          if (!data.currentBeat?.narrative || data.currentBeat.narrative.trim().length === 0) {
            clearStoredSession(storyId);
            data = await startSession(storyId, setup, localDraft);
          }
        } else {
          data = await startSession(storyId, setup, localDraft);
        }
        if (!data) throw new Error('No session data');
        const resolvedSessionId = data.sessionId || (data as any).session?.sessionId;
        const resolvedPlayerState = data.playerState || (data as any).session?.playerState;
        const resolvedTurnNumber = data.turnNumber ?? (data as any).session?.turnCount ?? 1;
        setSessionId(resolvedSessionId);
        setPlayerState(resolvedPlayerState);
        setCurrentBeat(data.currentBeat);
        setTurnNumber(resolvedTurnNumber);
        setStoryMeta(data.story);
        setLore(data.lore);
        // Auto-pick realm theme from the story (only if user hasn't customized yet)
        const auto = realmFromStory({ storyId: data.story.id, genres });
        setSettings((s) => (s.theme === 'darkFantasy' && auto !== 'darkFantasy' ? { ...s, theme: auto } : s));
        if (resolvedSessionId) writeStoredSession(storyId, resolvedSessionId);
        if (resolvedPlayerState?.currentLocationId) {
          audioService.playAmbient(ambientFromLocation(resolvedPlayerState.currentLocationId));
        }

        sessionDone = true;
        // Await 3D D20 model pre-caching so it is 100% in memory
        await dicePreloadPromise;
        diceRatio = 1;
        window.clearInterval(progressTimer);
        setLoadingProgress(100);
      } catch (e: any) {
        window.clearInterval(progressTimer);
        setErrorMessage(e?.message || 'Failed to start session');
      } finally {
        window.clearInterval(progressTimer);
        setLoading(false);
        setTimeout(() => {
          setIsGameLoading(false);
        }, 400);
      }
    },
    []
  );

  const resolveStoryWithLocalDraft = useCallback((story: CatalogStory | null, fallbackStoryId?: string): CatalogStory | null => {
    const targetId = story?.id || fallbackStoryId;
    if (!targetId && !story) return null;
    try {
      if (targetId) {
        const draftKey = `storyforge_studio_draft_v1_${targetId}`;
        const local = localStorage.getItem(draftKey);
        if (local) {
          const parsed = JSON.parse(local);
          const rpg = parsed.rpgSystem;
          return {
            id: parsed.id || targetId,
            title: parsed.title || story?.title || 'ماجراجویی بدون عنوان',
            tagline: parsed.tagline || story?.tagline || '',
            synopsis: parsed.synopsis || story?.synopsis || '',
            genres: parsed.genres || story?.genres || [],
            language: parsed.language || story?.language || 'fa',
            author: parsed.author || story?.author || 'نویسنده',
            coverImageUrl: parsed.coverImageUrl || story?.coverImageUrl,
            statsPreview: ((rpg?.stats as any[]) || []).map((s: any) => s.name || s.id),
            rpgSystem: rpg || story?.rpgSystem,
            stats: rpg?.stats || story?.stats || [],
            archetypes: rpg?.archetypes || story?.archetypes || [],
            backgrounds: rpg?.backgrounds || story?.backgrounds || [],
          };
        }
      }
    } catch {
      /* ignore */
    }
    return story;
  }, []);

  // ---- Boot: load catalog + resume ----
  useEffect(() => {
    let active = true;
    (async () => {
      const catalog = await fetchCatalog();
      if (!active) return;
      const mergedCatalog = [...catalog];
      let savedStoryId = '';
      let savedSession = '';
      try {
        savedStoryId =
          localStorage.getItem(PLAY_SELECTED_STORY_KEY) ||
          localStorage.getItem('storyforge_studio_selected_story_v1') ||
          '';
        savedSession = '';
        const activeStudioId = localStorage.getItem('storyforge_studio_selected_story_v1');
        if (activeStudioId && !mergedCatalog.some((s) => s.id === activeStudioId)) {
          const draftStory = resolveStoryWithLocalDraft(null, activeStudioId);
          if (draftStory) mergedCatalog.push(draftStory);
        }
      } catch {
        /* ignore */
      }
      setStories(mergedCatalog);
      if (savedStoryId) savedSession = readStoredSession(savedStoryId);
      if (savedSession && savedStoryId) {
        const baseStory = mergedCatalog.find((s) => s.id === savedStoryId) || null;
        const story = resolveStoryWithLocalDraft(baseStory, savedStoryId);
        setSelectedStory(story);
        if (story) await startGame(savedStoryId, savedSession, undefined, story.genres);
        else setIsCatalogOpen(true);
      } else if (savedStoryId) {
        const baseStory = mergedCatalog.find((s) => s.id === savedStoryId) || null;
        const story = resolveStoryWithLocalDraft(baseStory, savedStoryId);
        setSelectedStory(story);
        setIsCharCreationOpen(true);
      } else {
        setIsCatalogOpen(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [startGame, resolveStoryWithLocalDraft]);

  const onSelectStory = async (story: CatalogStory) => {
    const resolved = resolveStoryWithLocalDraft(story, story.id) || story;
    setSelectedStory(resolved);
    // Character creation is one-time per story: resume the saved character
    // when a session already exists instead of asking again.
    const existing = readStoredSession(resolved.id);
    if (existing) {
      await startGame(resolved.id, existing, undefined, resolved.genres);
    } else {
      setIsCharCreationOpen(true);
    }
  };

  const onEmbark = async (setup: CharacterSetup) => {
    if (!selectedStory) return;
    setIsCharCreationOpen(false);
    await startGame(selectedStory.id, undefined, setup, selectedStory.genres);
  };

  const onChoice = async (choice: any) => {
    if (loading || actionInFlight || !playerState || !selectedStory) return;
    setActionInFlight(true);
    audioService.playSfx('buttonClick');
    setErrorMessage(null);
    const syncBalance = (json: any) => {
      if (typeof json?.data?.remainingCredits === 'number') {
        updateCreditBalance(json.data.remainingCredits);
        if (json.data.remainingCredits <= 0) setIsShopModalOpen(true);
      } else if (json?.creditDepleted) {
        updateCreditBalance(0);
        setIsShopModalOpen(true);
      }
    };
    // Guests never spend credits; authenticated users at 0 go straight to the shop.
    if (isAuthenticated && (user?.creditBalance ?? 0) <= 0) {
      setIsShopModalOpen(true);
      setActionInFlight(false);
      return;
    }

    const targetSceneId = choice.targetSceneId || choice.destinationSceneId || choice.leadToSceneId;
    const isDiceless = choice.targetDC === undefined && choice.requiredStatId === undefined;
    const nextTurn = turnNumber + 1;

    // Read any local draft created or modified in Studio
    let localDraft: any = undefined;
    try {
      const draftRaw = localStorage.getItem(`storyforge_studio_draft_v1_${selectedStory.id}`);
      if (draftRaw) localDraft = JSON.parse(draftRaw);
    } catch {
      /* ignore */
    }

    // Plan 12: Diceless choices branch without a roll
    if (isDiceless) {
      setLoading(true);
      try {
        const json = await sendAction({
          storyId: selectedStory.id,
          sessionId,
          playerActionText: choice.text,
          actionStyle: choice.style || 'tactical',
          riskLevel: choice.riskLevel || 'low',
          playerState,
          turnNumber: nextTurn,
          targetSceneId,
          draftManifest: localDraft,
        });
        if (json.isGuardrailViolation) {
          setErrorMessage(json.rejectionReason);
          notify.error(isRtl ? 'اقدام شما توسط قوانین جهان رد شد.' : 'Action blocked by world laws.');
          setActionInFlight(false);
          return;
        }
        if (!json.success) {
          syncBalance(json);
          setErrorMessage(json.error || 'The scribe is silent.');
          setActionInFlight(false);
          return;
        }
        setCurrentBeat({
          narrative: json.data.beat.narrativeProse,
          choices: json.data.beat.presentedChoices,
        });
        setPlayerState(json.data.updatedPlayerState);
        setTurnNumber(nextTurn);
        showDisplacementBanner(json.data, lore.locations);
        syncBalance(json);
      } catch (e: any) {
        setErrorMessage(e?.message || 'Network error');
      } finally {
        setLoading(false);
        setActionInFlight(false);
      }
      return;
    }

    setDiceActionText(choice.text);

    const roll = rollD20();
    const resolution = resolveActionCheck({
      actionText: choice.text,
      requiredStatId: choice.requiredStatId,
      playerState,
      targetDC: choice.targetDC,
      riskLevel: choice.riskLevel || 'medium',
      forcedDiceRoll: roll,
      isPersian: isRtl,
      statsConfig: storyMeta?.rpgSystem?.stats,
      rpgSystem: storyMeta?.rpgSystem,
    });
    setDiceResolution(resolution);
    setLastOutcome(resolution);
    setIsDiceModalOpen(true);
    setDiceRolling(true);
    setIsGeneratingBeat(true);
    setPendingTurn(null);

    // Auto-settle the 3D dice physics after 1300ms so the user sees the roll outcome immediately
    const rollTimer = setTimeout(() => {
      setDiceRolling(false);
    }, 1300);

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
        targetSceneId,
        draftManifest: localDraft,
      });
      if (json.isGuardrailViolation) {
        clearTimeout(rollTimer);
        setErrorMessage(json.rejectionReason);
        notify.error(isRtl ? 'اقدام شما توسط قوانین جهان رد شد.' : 'Action blocked by world laws.');
        setIsDiceModalOpen(false);
        setDiceRolling(false);
        setIsGeneratingBeat(false);
        setActionInFlight(false);
        return;
      }
      if (!json.success) {
        clearTimeout(rollTimer);
        syncBalance(json);
        setErrorMessage(json.error || 'The scribe is silent.');
        setIsDiceModalOpen(false);
        setDiceRolling(false);
        setIsGeneratingBeat(false);
        setActionInFlight(false);
        return;
      }
      syncBalance(json);

      // If the reader already dismissed the dice modal or if it's closed, immediately apply the new scene
      if (!isDiceModalOpenRef.current) {
        setCurrentBeat({
          narrative: json.data.beat.narrativeProse,
          choices: json.data.beat.presentedChoices,
        });
        setPlayerState(json.data.updatedPlayerState);
        setTurnNumber(nextTurn);
        showDisplacementBanner(json.data, lore.locations);
        if (json.data.updatedPlayerState?.currentLocationId) {
          audioService.playAmbient(ambientFromLocation(json.data.updatedPlayerState.currentLocationId));
        }
        audioService.playSfx('pageTurn');
        setFreeTextAction('');
        setPendingTurn(null);
        setDiceResolution(null);
        setDiceRolling(false);
        setIsGeneratingBeat(false);
      } else {
        // Settle the dice and reveal the authoritative outcome & continue button
        setPendingTurn(json.data);
        if (json.data?.resolution) {
          const authOutcome = serverToCheckResolution(json.data.resolution);
          setDiceResolution(authOutcome);
          setLastOutcome(authOutcome);
        }
        setIsGeneratingBeat(false);
        setDiceRolling(false);
      }
      setActionInFlight(false);
    } catch (e: any) {
      clearTimeout(rollTimer);
      setErrorMessage(e?.message || 'Network error');
      setIsDiceModalOpen(false);
      setDiceRolling(false);
      setIsGeneratingBeat(false);
      setActionInFlight(false);
    }
  };

  const applyPendingTurn = () => {
    if (!pendingTurn) {
      setIsDiceModalOpen(false);
      setDiceRolling(false);
      setIsGeneratingBeat(false);
      return;
    }
    setCurrentBeat({ narrative: pendingTurn.beat.narrativeProse, choices: pendingTurn.beat.presentedChoices });
    setPlayerState(pendingTurn.updatedPlayerState);
    showDisplacementBanner(pendingTurn, lore.locations);
    setTurnNumber((t) => t + 1);
    if (pendingTurn.updatedPlayerState?.currentLocationId) {
      audioService.playAmbient(ambientFromLocation(pendingTurn.updatedPlayerState.currentLocationId));
    }
    if (pendingTurn.resolution) {
      setLastOutcome(serverToCheckResolution(pendingTurn.resolution));
    }
    audioService.playSfx('pageTurn');
    setFreeTextAction('');
    setIsDiceModalOpen(false);
    setPendingTurn(null);
    setDiceResolution(null);
    setDiceRolling(false);
  };

  const handleFreeTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeTextAction.trim()) return;
    onChoice({ text: freeTextAction, style: 'free_text', riskLevel: 'medium' });
  };

  const onInventoryChange = async (newState: any, toast?: { kind: 'success' | 'warning' | 'info'; text: string }) => {
    // Recompute scaled maximums client-side so equip/unequip instantly moves
    // the pools (server re-authoritates on the next turn via GameEngine).
    let syncedState = newState;
    try {
      const { computeMaxResources } = await import('@/lib/engines/game/vitalScaling');
      const rpg = storyMeta?.rpgSystem;
      if (rpg?.resources && newState) {
        const archetype = (rpg.archetypes ?? []).find((a: any) => a.id === newState.archetypeId);
        const background = (rpg.backgrounds ?? []).find((b: any) => b.id === newState.backgroundId);
        const equippedIds = new Set(
          [newState.equipment?.mainHand, newState.equipment?.offHand, newState.equipment?.armor, newState.equipment?.relic].filter(Boolean)
        );
        const equippedArtifacts = (newState.inventory ?? []).filter((i: any) => equippedIds.has(i.id));
        const maxResources = computeMaxResources(newState.stats ?? {}, rpg, { archetype, background, equippedArtifacts });
        const resources: Record<string, number> = { ...(newState.resources ?? {}) };
        for (const res of rpg.resources) {
          const max = maxResources[res.id] ?? res.max ?? 1;
          if (resources[res.id] === undefined) resources[res.id] = max;
          else resources[res.id] = Math.min(max, Math.max(res.min ?? 0, resources[res.id]));
        }
        syncedState = { ...newState, resources, maxResources };
      }
    } catch {
      /* non-fatal: persist as-is */
    }
    setPlayerState(syncedState);
    if (sessionId) await patchSession(sessionId, syncedState);
    if (toast) {
      if (toast.kind === 'success') notify.success(toast.text);
      else notify.info(toast.text);
    }
  };

  const restartAdventure = async () => {
    if (!selectedStory) return;
    const ok = await notify.confirm(
      isRtl
        ? 'آیا از شروع مجدد ماجراجویی اطمینان دارید؟ تمام پیشرفت فعلی این جلسه بازنشانی خواهد شد.'
        : 'Are you sure you want to restart your adventure? Current session progress will be reset.'
    );
    if (!ok) return;
    clearStoredSession(selectedStory.id);
    setSessionId('');
    setCurrentBeat(null);
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
      {/* Cinematic Game Loading & 3D Dice Pre-caching Screen */}
      <GameLoadingScreen
        isLoading={isGameLoading}
        progress={loadingProgress}
        storyTitle={storyMeta?.title || selectedStory?.title}
        storyTagline={selectedStory?.tagline}
        isPersian={isRtl}
        theme={themeObj}
      />

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

        </div>
      </header>

      {!storyMeta && !loading ? (
        <EmptyState isRtl={isRtl} onOpenLibrary={() => setIsCatalogOpen(true)} coverUrl={selectedStory ? getCoverUrl(selectedStory.id, selectedStory.coverImageUrl) : null} title={selectedStory?.title} onBegin={() => setIsCharCreationOpen(true)} />
      ) : (
        <div className="grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-6 p-4 md:mx-auto md:grid-cols-12 md:p-6">
          {/* Reader */}
          <div className="space-y-6 md:col-span-8">
            {/* Plan 13: threat clocks + displacement banner */}
            <TensionClockWidget clocks={playerState?.activeTensionClocks || []} isRtl={isRtl} />
            {displacementBanner && (
              <div className="animate-pulse rounded-2xl border border-red-500/50 bg-red-950/60 p-3 text-xs font-bold text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.4)]">
                {isRtl ? `سقوط مرگبار! به «${displacementBanner}» پرتاب شدید.` : `Catastrophic fall! Displaced into “${displacementBanner}”.`}
              </div>
            )}
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
                      backgroundColor:
                        lastOutcome.outcome === 'critical_success' || lastOutcome.outcome === 'success'
                          ? 'rgba(16,185,129,0.18)'
                          : lastOutcome.outcome === 'mixed_success'
                          ? 'rgba(245,158,11,0.18)'
                          : 'rgba(244,63,94,0.18)',
                      color:
                        lastOutcome.outcome === 'critical_success' || lastOutcome.outcome === 'success'
                          ? '#34d399'
                          : lastOutcome.outcome === 'mixed_success'
                          ? '#f59e0b'
                          : '#fb7185',
                    }}
                  >
                    {lastOutcome.outcome === 'critical_success'
                      ? (isRtl ? 'پیروزی قاطع' : 'Critical Success')
                      : lastOutcome.outcome === 'success'
                      ? (isRtl ? 'موفقیت' : 'Success')
                      : lastOutcome.outcome === 'mixed_success'
                      ? (isRtl ? 'موفقیت نسبی (با هزینه)' : 'Mixed Success')
                      : (isRtl ? 'شکست' : 'Failure')}
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
                  <div className="transition-all">
                    <NarrativeProse
                      text={currentBeat?.narrative || ''}
                      isPersian={isRtl}
                      bodyColor={themeObj.bodyText}
                      accentColor={themeObj.primaryAccent}
                      fontSizeClass={fontSizeClass[settings.fontSize]}
                      lineHeightClass={lineHeightClass[settings.lineHeight]}
                    />
                  </div>
                )}
              </div>

              {!loading && currentBeat?.choices && (
                <div className="mt-8 space-y-4 border-t pt-8" style={{ borderColor: themeObj.cardBorder }}>
                  {isAuthenticated && (user?.creditBalance ?? 0) <= 0 ? (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-center">
                      <Zap className="mx-auto h-8 w-8 text-amber-400" />
                      <p className="mt-2 text-sm font-bold text-amber-200">
                        {isRtl ? 'اعتبار صحنه‌های شما تمام شده است' : 'You are out of scene credits'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {isRtl ? 'برای ادامه ماجراجویی، بسته اعتباری تهیه کنید.' : 'Top up credits to continue your adventure.'}
                      </p>
                      <button
                        onClick={() => setIsShopModalOpen(true)}
                        className="mt-4 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-black transition-all hover:bg-amber-400"
                      >
                        {isRtl ? 'خرید اعتبار' : 'Buy credits'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: themeObj.mutedText }}>
                        <Sparkles className="h-3.5 w-3.5" style={{ color: themeObj.primaryAccent }} />
                        <span>{isRtl ? 'چه تصمیمی می‌گیری؟' : 'What will you do?'}</span>
                      </h3>

                      <div className="space-y-3">
                        {currentBeat.choices.map((choice: any, idx: number) => (
                          <div key={idx} className={actionInFlight ? 'pointer-events-none opacity-60' : ''}>
                            <ThreeDChoiceCard
                              choice={choice}
                              theme={themeObj}
                              isPersian={isRtl}
                              statsConfig={storyMeta?.rpgSystem?.stats}
                              onTap={() => onChoice(choice)}
                            />
                          </div>
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
                          disabled={!freeTextAction.trim() || actionInFlight}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-amber-400 disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{isRtl ? 'انجام بده' : 'Act'}</span>
                        </button>
                      </form>
                    </>
                  )}
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
                  const maxVal = playerState?.maxResources?.[res.id] ?? res.max ?? 1;
                  const curVal = Math.min(playerState?.resources?.[res.id] ?? res.current ?? 0, maxVal);
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
                  {(storyMeta?.rpgSystem?.stats ?? []).map((stat: any) => {
                    const baseDef = stat.baseValue ?? 10;
                    const base = playerState?.stats?.[stat.id] ?? baseDef;
                    const eff = playerState ? getEffectiveStatValue(playerState, stat.id, baseDef) : base;
                    const bonus = eff - base;
                    const statTitle = stat.name?.trim() || formatStatName(stat.id, isRtl, storyMeta?.rpgSystem?.stats);
                    return (
                      <div
                        key={stat.id}
                        className="flex items-center justify-between rounded-xl border p-2.5 transition-all"
                        style={{
                          backgroundColor: themeObj.cardBg,
                          borderColor: bonus > 0 ? '#10B98160' : themeObj.cardBorder,
                        }}
                      >
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="text-xs truncate font-medium" style={{ color: themeObj.bodyText }}>
                            {statTitle}
                          </span>
                          {bonus > 0 && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {isRtl ? `+${toPersianDigits(bonus)} از تجهیزات` : `+${bonus} from gear`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                          {bonus > 0 && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30">
                              +{bonus}
                            </span>
                          )}
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: bonus > 0 ? '#34D399' : themeObj.primaryAccent }}
                          >
                            {toPersianDigits(eff)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
        isGenerating={isGeneratingBeat}
        statsConfig={storyMeta?.rpgSystem?.stats}
        resolution={diceResolution}
        actionText={diceActionText}
        isPersian={isRtl}
        inspectMode={!pendingTurn && !isGeneratingBeat}
        onRollComplete={() => setDiceRolling(false)}
        onContinue={applyPendingTurn}
        onClose={() => {
          if (pendingTurn) {
            applyPendingTurn();
          } else {
            setIsDiceModalOpen(false);
            setDiceRolling(false);
            setIsGeneratingBeat(false);
          }
        }}
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
  const max = playerState?.maxResources?.[res.id] ?? res.max ?? 1;
  const cur = Math.min(playerState.resources[res.id] ?? res.current ?? 0, max);
  return cur / (max || 1);
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
