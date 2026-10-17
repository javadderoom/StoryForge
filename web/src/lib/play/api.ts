'use client';

import { PlayerState } from '@/lib/types/gameplay';

export interface CharacterSetup {
  archetypeId?: string;
  backgroundId?: string;
  allocatedStats?: Record<string, number>;
  characterName?: string;
}

export interface CatalogStory {
  id: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  language: string;
  author: string;
  published?: boolean;
  engineTier?: 'normal' | 'advance';
  statsPreview?: string[];
  coverImageUrl?: string;
  rpgSystem?: any;
  archetypes?: any[];
  backgrounds?: any[];
  stats?: any[];
}

export interface StartSessionResult {
  sessionId: string;
  story: { id: string; title: string; language: string; rpgSystem: any; engineTier?: 'normal' | 'advance' };
  lore: { laws: any[]; locations: { id: string; name: string }[]; npcs: { id: string; name: string }[] };
  playerState: PlayerState;
  currentBeat: { narrative: string; choices: any[]; discoveredCreature?: any; discoveredNpc?: any; discoveredNpcs?: any[] };
  turnNumber: number;
}

async function asJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  return json;
}

export async function fetchCatalog(): Promise<CatalogStory[]> {
  try {
    const res = await fetch('/api/play/stories', { cache: 'no-store' });
    const json = await asJson(res);
    if (json.success && Array.isArray(json.data)) return json.data as CatalogStory[];
  } catch {
    /* offline */
  }
  return [];
}

export async function startSession(
  storyId: string,
  characterSetup?: CharacterSetup,
  draftManifest?: any
): Promise<StartSessionResult> {
  const res = await fetch('/api/play/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId, characterSetup, draftManifest }),
  });
  const json = await asJson(res);
  if (!json.success) throw new Error(json.error || 'Failed to start session');
  return json.data as StartSessionResult;
}

export async function resumeSession(sessionId: string): Promise<StartSessionResult | null> {
  const res = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
  const json = await asJson(res);
  if (!json.success) return null;
  return json.data as StartSessionResult;
}

export async function patchSession(sessionId: string, playerState: PlayerState): Promise<void> {
  try {
    await fetch('/api/play/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, playerState }),
    });
  } catch {
    /* best-effort persistence */
  }
}

export async function resetSession(
  storyId: string,
  sessionId?: string
): Promise<{ refundedCredits: number; newCreditBalance: number | null }> {
  const res = await fetch('/api/play/session/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId, sessionId }),
  });
  const json = await asJson(res);
  if (!json.success) throw new Error(json.error || 'Failed to reset session');
  return json.data;
}

export interface StorySessionSummary {
  sessionId: string;
  storyId: string;
  currentSceneId: string;
  turnCount: number;
  characterName: string;
  archetypeId?: string;
  archetypeName: string;
  backgroundId?: string;
  backgroundName: string;
  level: number;
  currentLocationId?: string;
  stats: Record<string, number>;
  resources: Record<string, number>;
  maxResources: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchStorySessions(storyId: string): Promise<StorySessionSummary[]> {
  try {
    const res = await fetch(`/api/play/sessions?storyId=${encodeURIComponent(storyId)}`, { cache: 'no-store' });
    const json = await asJson(res);
    if (json.success && Array.isArray(json.sessions)) {
      return json.sessions as StorySessionSummary[];
    }
  } catch {
    /* offline */
  }
  return [];
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    const json = await asJson(res);
    return json.success === true;
  } catch {
    return false;
  }
}


export async function sendAction(payload: {
  storyId: string;
  sessionId?: string;
  playerActionText: string;
  actionStyle?: string;
  riskLevel?: string;
  statId?: string;
  targetDC?: number;
  forcedDiceRoll?: number;
  playerState: PlayerState;
  turnNumber: number;
  targetSceneId?: string;
  draftManifest?: any;
  /** id of the presented choice being acted on, when not free text. */
  choiceId?: string;
}): Promise<any> {
  const res = await fetch('/api/play/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return asJson(res);
}

export interface RemakeScenePayload {
  sessionId: string;
  storyId: string;
  turnNumber: number;
  issueType: string;
  reason: string;
}

export interface RemakeSceneResult {
  beat: {
    sceneId: string;
    narrativeProse: string;
    presentedChoices: any[];
  };
  turnNumber: number;
  remakeCount: number;
  message?: string;
}

export async function remakeScene(payload: RemakeScenePayload): Promise<RemakeSceneResult> {
  const res = await fetch('/api/play/remake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await asJson(res);
  if (!json.success) {
    throw new Error(json.rejectionReason || json.error || 'Failed to remake scene');
  }
  return json.data as RemakeSceneResult;
}

/** Cover image resolution: explicit remoteUrl/authored coverImageUrl first, else null. */
export function getCoverUrl(storyId?: string | null, remoteUrl?: string | null): string | null {
  if (remoteUrl && remoteUrl.trim()) {
    return remoteUrl.trim();
  }
  // Known bundled static covers in /public/covers
  const KNOWN_BUNDLED_COVERS = new Set(['ghale_siahsang', 'obsidian_citadel']);
  if (storyId && KNOWN_BUNDLED_COVERS.has(storyId)) {
    return `/covers/${storyId}.webp`;
  }
  return null;
}
