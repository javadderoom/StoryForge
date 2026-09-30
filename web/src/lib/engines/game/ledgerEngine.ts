import { StateMutationDiff } from '@/lib/types/gameplay';
import { GameItem } from '@/lib/types/rpg';
import { WorldBible, WorldStateLedger } from '@/lib/types/world';

export function isStoryCriticalItem(item: GameItem): boolean {
  return (
    item.type === 'quest_item' ||
    /quest|relic|artifact|seal|heirloom|ledger/i.test(item.id) ||
    /quest|relic|artifact|seal|heirloom|ledger/i.test(item.name)
  );
}

/**
 * Derives a Living World Ledger patch from a deterministic state mutation
 * diff, so NPC relationship shifts and story-critical item gains survive
 * beyond the current turn instead of evaporating.
 *
 * Heuristics (deterministic by design):
 * - `relationshipChanges` on NPCs with a known faction drift that faction's
 *   reputation score by the trust delta.
 * - Every touched NPC gets/updates a status entry (default: alive).
 * - Added items flagged as quest items or high rarity become key items.
 */
export function deriveLedgerPatch(
  diff: StateMutationDiff,
  worldBible: WorldBible
): Partial<WorldStateLedger> {
  const npcById = new Map(worldBible.npcs.map((n) => [n.id, n]));

  const factionDeltas = new Map<string, { name: string; delta: number }>();
  const npcStatuses: WorldStateLedger['npcStatuses'] = [];

  for (const [npcId, change] of Object.entries(diff.relationshipChanges || {})) {
    const npc = npcById.get(npcId);
    const explicit = (diff.npcStatusChanges || []).find((s) => s.npcId === npcId);
    npcStatuses.push({
      npcId,
      npcName: npc?.name || npcId,
      status: explicit?.status || 'alive',
      note: explicit?.note || (change.newSecret ? `Learned secret: ${change.newSecret}` : undefined),
    });
    const factionId = npc?.factionId;
    if (factionId && change.trustDelta !== 0) {
      const entry = factionDeltas.get(factionId) || { name: '', delta: 0 };
      entry.delta += change.trustDelta;
      if (npc?.factionId) {
        entry.name = worldBible.factions.find((f) => f.id === factionId)?.name || factionId;
      }
      factionDeltas.set(factionId, entry);
    }
  }

  const factionReputations: WorldStateLedger['factionReputations'] = [];
  for (const [factionId, { name, delta }] of factionDeltas) {
    const stance =
      delta >= 25 ? 'friendly' : delta <= -25 ? 'hostile' : 'neutral';
    factionReputations.push({ factionId, factionName: name || factionId, score: delta, stance });
  }

  // Status-only changes (death/transform without trust delta) still ledger.
  for (const s of diff.npcStatusChanges || []) {
    if (npcStatuses.some((n) => n.npcId === s.npcId)) continue;
    const npc = npcById.get(s.npcId);
    npcStatuses.push({
      npcId: s.npcId,
      npcName: npc?.name || s.npcId,
      status: s.status,
      note: s.note,
    });
  }

  const keyItems: WorldStateLedger['keyItems'] = (diff.itemsAdded || [])
    .filter((item) => isStoryCriticalItem(item))
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      description: item.description || '',
      isStoryCritical: true,
    }));

  const patch: Partial<WorldStateLedger> = {};
  if (factionReputations.length) patch.factionReputations = factionReputations;
  if (npcStatuses.length) patch.npcStatuses = npcStatuses;
  if (keyItems.length) patch.keyItems = keyItems;
  return patch;
}

/**
 * Merges a derived ledger patch into the session's persisted Living World
 * Ledger. Entries are keyed by id so repeated turns accumulate deltas rather
 * than overwrite history; reputation scores are clamped to [-100, +100].
 */
export function mergeLedgerPatch(
  base: WorldStateLedger | null | undefined,
  patch: Partial<WorldStateLedger>
): WorldStateLedger {
  const merged: WorldStateLedger = base
    ? JSON.parse(JSON.stringify(base))
    : { factionReputations: [], npcStatuses: [], keyItems: [], chapterSummaries: [], openPlotThreads: [] };

  for (const rep of patch.factionReputations || []) {
    const existing = merged.factionReputations.find((r) => r.factionId === rep.factionId);
    if (existing) {
      existing.score = Math.min(100, Math.max(-100, existing.score + rep.score));
      existing.stance = rep.stance;
      if (rep.note) existing.note = rep.note;
    } else {
      merged.factionReputations.push({ ...rep, note: rep.note });
    }
  }

  for (const npc of patch.npcStatuses || []) {
    const existing = merged.npcStatuses.find((n) => n.npcId === npc.npcId);
    if (existing) {
      existing.status = npc.status;
      if (npc.note) existing.note = npc.note;
    } else {
      merged.npcStatuses.push({ ...npc });
    }
  }

  for (const item of patch.keyItems || []) {
    if (!merged.keyItems.some((k) => k.itemId === item.itemId)) {
      merged.keyItems.push({ ...item });
    }
  }

  return merged;
}
