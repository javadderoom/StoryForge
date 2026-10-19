import type { NPCDossier } from '@/lib/types/world';
import type { PlayerState } from '@/lib/types/gameplay';
import { NAME_STOPWORDS } from './socialEngine';

/**
 * Plan 17 follow-up — NPC stance authority.
 *
 * Trust used to move only through the deterministic pressure/social regexes,
 * which require both a social keyword AND a named NPC in the player's action
 * text. A deal sealed through a generated choice ("I accept his offer") or a
 * negotiation the writer dramatized carried no name and therefore never
 * touched `playerState.relationships` — the prose said one thing and the
 * compendium another.
 *
 * This module is the evidence-gated writer channel's server side:
 *  - normalize the model's declared `npcTrustChanges` (bounded, trimmed),
 *  - resolve the NPC by id / full name / unique name word (ZWNJ-safe),
 *  - reject off-scene NPCs and unjustified shifts,
 *  - clamp every turn to ±MAX_TRUST_DELTA_PER_TURN per NPC.
 * Applying the result is still `applyStateMutation`'s job.
 */

/** Per-turn bound for writer-declared trust movement (±). */
export const MAX_TRUST_DELTA_PER_TURN = 20;
/** A single scene never rewrites more than a handful of stances. */
export const MAX_TRUST_CHANGES_PER_TURN = 4;

export interface DeclaredNpcTrustChange {
  npcId?: string;
  npcName?: string;
  trustDelta: number;
  reason?: string;
}

export interface AppliedNpcTrustChange {
  npcId: string;
  npcName: string;
  trustDelta: number;
  reason: string;
}

export interface TrustResolutionInput {
  declared: DeclaredNpcTrustChange[];
  npcs: NPCDossier[];
  currentLocationId?: string;
  accompanyingNpcIds?: string[];
  /** Route/party roster ids permitted even when stationed elsewhere (caravans). */
  extraPresentNpcIds?: string[];
}

function clampDelta(delta: number): number {
  const rounded = Math.round(delta);
  return Math.sign(rounded) * Math.min(MAX_TRUST_DELTA_PER_TURN, Math.abs(rounded));
}

/** ZWNJ-, diacritic-, Arabic-letter-, and punctuation-insensitive matching text. */
function normalizeMatchText(text: string): string {
  return (text || '')
    .replace(/[\u200c\u200b\u200d\u00ad]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[«»"'`.,،؟!؛:()\[\]{}_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function significantNameWords(name: string): string[] {
  return normalizeMatchText(name)
    .split(' ')
    .filter((w) => w.length >= 4 && !NAME_STOPWORDS.has(w));
}

/**
 * Resolves one declared entry to a dossier. Id first, then exact full name,
 * then a unique containment match, then a unique significant name word.
 * Ambiguity resolves to null — never guess between two NPCs.
 */
function resolveDossier(
  entry: DeclaredNpcTrustChange,
  npcs: NPCDossier[]
): NPCDossier | null {
  const id = entry.npcId?.trim();
  if (id) {
    const byId = npcs.find((npc) => npc.id === id);
    if (byId) return byId;
  }

  const wanted = normalizeMatchText(entry.npcName || '');
  if (!wanted) return null;

  const exact = npcs.filter((npc) => normalizeMatchText(npc.name) === wanted);
  if (exact.length === 1) return exact[0];

  const contained = npcs.filter((npc) => {
    const name = normalizeMatchText(npc.name);
    return Boolean(name) && (name.includes(wanted) || wanted.includes(name));
  });
  if (contained.length === 1) return contained[0];

  const words = wanted.split(' ').filter((w) => w.length >= 4 && !NAME_STOPWORDS.has(w));
  if (words.length === 0) return null;
  const byWord = npcs.filter((npc) =>
    significantNameWords(npc.name).some((w) => words.includes(w))
  );
  return byWord.length === 1 ? byWord[0] : null;
}

/** Scene presence gate: stationed here, in the party, or on the active caravan. */
export function isNpcPresentForTrust(
  npc: NPCDossier,
  input: Omit<TrustResolutionInput, 'declared' | 'npcs'>
): boolean {
  const party = input.accompanyingNpcIds ?? [];
  const extra = input.extraPresentNpcIds ?? [];
  if (party.includes(npc.id) || extra.includes(npc.id)) return true;
  const locationId = input.currentLocationId;
  if (!locationId) return false;
  // Runtime-authored NPCs occasionally lack a stationed location; trust the
  // writer's scene scope rather than silently dropping every change.
  if (!npc.currentLocationId) return true;
  return npc.currentLocationId === locationId;
}

/**
 * Adapter-side normalization of the writer's raw payload. Bounded and trimmed
 * but NOT evidence-checked — resolution below is the authority.
 */
export function normalizeNpcTrustChanges(raw: unknown): DeclaredNpcTrustChange[] {
  if (!Array.isArray(raw)) return [];
  const out: DeclaredNpcTrustChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const npcId =
      typeof entry.npcId === 'string'
        ? entry.npcId.trim().slice(0, 80)
        : typeof entry.id === 'string'
          ? entry.id.trim().slice(0, 80)
          : '';
    const npcName =
      typeof entry.npcName === 'string'
        ? entry.npcName.trim().slice(0, 120)
        : typeof entry.name === 'string'
          ? entry.name.trim().slice(0, 120)
          : '';
    const rawDelta =
      typeof entry.trustDelta === 'number'
        ? entry.trustDelta
        : typeof entry.delta === 'number'
          ? entry.delta
          : Number(entry.trustDelta ?? entry.delta);
    if (!Number.isFinite(rawDelta) || rawDelta === 0) continue;
    if (!npcId && !npcName) continue;
    const reasonSource =
      typeof entry.reason === 'string'
        ? entry.reason
        : typeof entry.evidence === 'string'
          ? entry.evidence
          : '';
    const reason = reasonSource.trim().slice(0, 240);
    out.push({
      ...(npcId ? { npcId } : {}),
      ...(npcName ? { npcName } : {}),
      trustDelta: clampDelta(rawDelta),
      ...(reason ? { reason } : {}),
    });
    if (out.length >= MAX_TRUST_CHANGES_PER_TURN) break;
  }
  return out;
}

/**
 * Evidence-gated resolution: every accepted change must name a scene-present
 * NPC and carry a prose-justified reason. Duplicate NPC entries merge, and the
 * final per-NPC delta is clamped to ±MAX_TRUST_DELTA_PER_TURN.
 */
export function resolveDeclaredNpcTrustChanges(
  input: TrustResolutionInput
): AppliedNpcTrustChange[] {
  const applied = new Map<string, AppliedNpcTrustChange>();

  for (const entry of input.declared ?? []) {
    if (!entry || typeof entry.trustDelta !== 'number' || !Number.isFinite(entry.trustDelta)) {
      continue;
    }
    if (entry.trustDelta === 0) continue;
    // Evidence gate: a stance shift must be justified by what the prose showed.
    const reason = (entry.reason ?? '').trim();
    if (!reason) continue;

    const npc = resolveDossier(entry, input.npcs ?? []);
    if (!npc) continue;
    if (!isNpcPresentForTrust(npc, input)) continue;

    const delta = clampDelta(entry.trustDelta);
    if (delta === 0) continue;

    const prior = applied.get(npc.id);
    if (prior) {
      prior.trustDelta = clampDelta(prior.trustDelta + delta);
      if (prior.trustDelta === 0) applied.delete(npc.id);
    } else {
      applied.set(npc.id, {
        npcId: npc.id,
        npcName: npc.name,
        trustDelta: delta,
        reason: reason.slice(0, 240),
      });
    }
    if (applied.size >= MAX_TRUST_CHANGES_PER_TURN) break;
  }

  return Array.from(applied.values());
}

/**
 * Ensures every applied trust target has a relationship envelope before the
 * delta is applied. Unmet NPCs start from their authored `initialTrust` rather
 * than an accidental zero. Returns the original object when nothing is missing.
 */
export function seedTrustRelationships(
  relationships: PlayerState['relationships'],
  applied: AppliedNpcTrustChange[],
  npcs: NPCDossier[]
): PlayerState['relationships'] {
  let next = relationships ?? {};
  let changed = false;
  for (const change of applied) {
    if (next[change.npcId]) continue;
    if (!changed) {
      next = { ...next };
      changed = true;
    }
    const npc = npcs.find((candidate) => candidate.id === change.npcId);
    next[change.npcId] = {
      trust: npc?.initialTrust ?? 0,
      knownSecrets: [],
      notes: [],
    };
  }
  return next;
}

/** One-line consequence feedback for the dice/result surface. */
export function describeTrustChange(
  change: AppliedNpcTrustChange,
  isPersian: boolean
): string {
  const sign = change.trustDelta > 0 ? '+' : '';
  return isPersian
    ? `اعتماد «${change.npcName}» نسبت به تو ${
        change.trustDelta > 0 ? 'افزایش' : 'کاهش'
      } یافت (${sign}${change.trustDelta}).`
    : `"${change.npcName}" trusts you ${
        change.trustDelta > 0 ? 'more' : 'less'
      } now (${sign}${change.trustDelta}).`;
}
