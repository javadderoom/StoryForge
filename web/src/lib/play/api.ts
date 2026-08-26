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
  statsPreview?: string[];
  coverImageUrl?: string;
  rpgSystem?: any;
  archetypes?: any[];
  backgrounds?: any[];
  stats?: any[];
}

export interface StartSessionResult {
  sessionId: string;
  story: { id: string; title: string; language: string; rpgSystem: any };
  lore: { laws: any[]; locations: { id: string; name: string }[]; npcs: { id: string; name: string }[] };
  playerState: PlayerState;
  currentBeat: { narrative: string; choices: any[] };
  turnNumber: number;
}

async function asJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  return json;
}

export async function fetchCatalog(): Promise<CatalogStory[]> {
  try {
    const res = await fetch('/api/play/stories');
    const json = await asJson(res);
    if (json.success && Array.isArray(json.data)) return json.data as CatalogStory[];
  } catch {
    /* offline */
  }
  return [];
}

export async function startSession(
  storyId: string,
  characterSetup?: CharacterSetup
): Promise<StartSessionResult> {
  const res = await fetch('/api/play/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storyId, characterSetup }),
  });
  const json = await asJson(res);
  if (!json.success) throw new Error(json.error || 'Failed to start session');
  return json.data as StartSessionResult;
}

export async function resumeSession(sessionId: string): Promise<StartSessionResult | null> {
  const res = await fetch(`/api/play/session?sessionId=${encodeURIComponent(sessionId)}`);
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
}): Promise<any> {
  const res = await fetch('/api/play/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return asJson(res);
}

/** Cover image resolution: bundled webp/jpg by story id, else remote, else null. */
export function getCoverUrl(storyId?: string | null, remoteUrl?: string | null): string | null {
  if (storyId) {
    return `/covers/${storyId}.webp`;
  }
  return remoteUrl || null;
}
