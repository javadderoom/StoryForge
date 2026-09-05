import type { Faction, FactionRelation, FactionRelationValue } from '@/lib/types/world';
import { deriveLegacyFactionLinks } from '@/lib/types/world';
import { nameMatch } from './ActionProtocol';

export function normalizeRelationValue(raw: unknown): FactionRelationValue {
  if (typeof raw !== 'string') return 'neutral';
  const s = raw.trim().toLowerCase();
  if (s === 'allied' || s === 'ally' || s === 'allies' || s === 'alliance') return 'allied';
  if (s === 'favorable' || s === 'friendly' || s === 'favored' || s === 'positive') return 'favorable';
  if (s === 'rival' || s === 'rivals' || s === 'competitor' || s === 'opposed') return 'rival';
  if (s === 'hostile' || s === 'enemy' || s === 'enemies' || s === 'nemesis' || s === 'war') return 'hostile';
  return 'neutral';
}

export function resolveTargetFactionId(
  rawTarget: unknown,
  sourceId: string,
  allFactions: Faction[]
): string | null {
  if (typeof rawTarget !== 'string') return null;
  const ref = rawTarget.trim();
  if (!ref || ref === sourceId) return null;

  // 1. Exact ID match
  const byId = allFactions.find((f) => f.id === ref && f.id !== sourceId);
  if (byId) return byId.id;

  // 2. Exact name match (case-insensitive)
  const byName = allFactions.find(
    (f) => f.id !== sourceId && f.name.toLowerCase() === ref.toLowerCase()
  );
  if (byName) return byName.id;

  // 3. Loose name match via ActionProtocol nameMatch (handles Persian ZWNJ, etc.)
  const byLoose = allFactions.find(
    (f) => f.id !== sourceId && nameMatch(f.name, ref)
  );
  if (byLoose) return byLoose.id;

  // 4. Substring / contains match
  const bySub = allFactions.find(
    (f) =>
      f.id !== sourceId &&
      (f.name.toLowerCase().includes(ref.toLowerCase()) ||
        ref.toLowerCase().includes(f.name.toLowerCase()))
  );
  if (bySub) return bySub.id;

  return null;
}

export interface IncomingFactionUpdate {
  relations?: unknown;
  factionRelations?: unknown;
  alliedFactionIds?: unknown;
  rivalFactionIds?: unknown;
}

/**
 * Robustly merges relation updates from AI generation, Studio Oracle actions,
 * or UI forms into the WorldBible factionRelations array.
 *
 * Handles:
 * - Array-based relations: [{ targetFactionId, value, note, isPublic }]
 * - Record-based relations: { [targetId]: { value, note, isPublic } }
 * - Target resolution by ID or natural name (e.g. "Silver Dawn")
 * - Fallbacks from alliedFactionIds / rivalFactionIds arrays
 * - Preserves existing relations with other factions
 */
export function mergeFactionRelations(
  factionId: string,
  updated: IncomingFactionUpdate | null | undefined,
  allFactions: Faction[],
  currentRelations: FactionRelation[] = []
): FactionRelation[] {
  if (!updated || typeof updated !== 'object') return currentRelations;

  const rawRelations = updated.relations ?? updated.factionRelations;
  const rawAllies = Array.isArray(updated.alliedFactionIds) ? updated.alliedFactionIds : null;
  const rawRivals = Array.isArray(updated.rivalFactionIds) ? updated.rivalFactionIds : null;

  // If no relation data was provided in the update, keep existing relations intact.
  if (rawRelations === undefined && rawAllies === null && rawRivals === null) {
    return currentRelations;
  }

  const incomingEntries: Array<{
    targetId: string;
    value: FactionRelationValue;
    note?: string;
    isPublic?: boolean;
  }> = [];

  const seenTargets = new Set<string>();

  // 1. Process explicit relations
  if (Array.isArray(rawRelations)) {
    for (const item of rawRelations) {
      if (!item || typeof item !== 'object') continue;
      const anyItem = item as Record<string, unknown>;
      const targetRef =
        anyItem.targetFactionId ??
        anyItem.otherFactionId ??
        anyItem.factionId ??
        anyItem.targetId ??
        anyItem.targetFactionName ??
        anyItem.targetName ??
        anyItem.name ??
        anyItem.target;

      const targetId = resolveTargetFactionId(targetRef, factionId, allFactions);
      if (!targetId || targetId === factionId) continue;

      const value = normalizeRelationValue(
        anyItem.value ?? anyItem.stance ?? anyItem.relation ?? anyItem.type
      );
      const note =
        typeof anyItem.note === 'string'
          ? anyItem.note
          : typeof anyItem.description === 'string'
          ? anyItem.description
          : undefined;
      const isPublic = anyItem.isPublic !== undefined ? Boolean(anyItem.isPublic) : true;

      incomingEntries.push({ targetId, value, note, isPublic });
      seenTargets.add(targetId);
    }
  } else if (rawRelations && typeof rawRelations === 'object') {
    for (const [key, item] of Object.entries(rawRelations as Record<string, unknown>)) {
      const targetId = resolveTargetFactionId(key, factionId, allFactions);
      if (!targetId || targetId === factionId) continue;

      let value: FactionRelationValue = 'neutral';
      let note: string | undefined;
      let isPublic = true;

      if (typeof item === 'string') {
        value = normalizeRelationValue(item);
      } else if (item && typeof item === 'object') {
        const anyItem = item as Record<string, unknown>;
        value = normalizeRelationValue(anyItem.value ?? anyItem.stance ?? anyItem.relation);
        note = typeof anyItem.note === 'string' ? anyItem.note : undefined;
        if (anyItem.isPublic !== undefined) isPublic = Boolean(anyItem.isPublic);
      }

      incomingEntries.push({ targetId, value, note, isPublic });
      seenTargets.add(targetId);
    }
  }

  // 2. Fallbacks from alliedFactionIds
  if (rawAllies) {
    for (const ref of rawAllies) {
      const targetId = resolveTargetFactionId(ref, factionId, allFactions);
      if (targetId && !seenTargets.has(targetId)) {
        incomingEntries.push({ targetId, value: 'allied', note: '', isPublic: true });
        seenTargets.add(targetId);
      }
    }
  }

  // 3. Fallbacks from rivalFactionIds
  if (rawRivals) {
    for (const ref of rawRivals) {
      const targetId = resolveTargetFactionId(ref, factionId, allFactions);
      if (targetId && !seenTargets.has(targetId)) {
        incomingEntries.push({ targetId, value: 'rival', note: '', isPublic: true });
        seenTargets.add(targetId);
      }
    }
  }

  // Merge into result relations
  const result = [...currentRelations];

  for (const entry of incomingEntries) {
    const matchIdx = result.findIndex(
      (r) =>
        (r.sourceFactionId === factionId && r.targetFactionId === entry.targetId) ||
        (r.sourceFactionId === entry.targetId && r.targetFactionId === factionId)
    );

    if (matchIdx >= 0) {
      result[matchIdx] = {
        ...result[matchIdx],
        sourceFactionId: factionId,
        targetFactionId: entry.targetId,
        value: entry.value,
        note: entry.note !== undefined ? entry.note : result[matchIdx].note,
        isPublic: entry.isPublic !== undefined ? entry.isPublic : (result[matchIdx].isPublic ?? true),
      };
    } else {
      result.push({
        id: `frel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sourceFactionId: factionId,
        targetFactionId: entry.targetId,
        value: entry.value,
        note: entry.note || '',
        isPublic: entry.isPublic ?? true,
      });
    }
  }

  return result;
}

/**
 * Synchronizes legacy alliedFactionIds and rivalFactionIds across all factions
 * based on the updated factionRelations spectrum.
 */
export function syncLegacyFactionLinks(
  factions: Faction[],
  relations: FactionRelation[]
): Faction[] {
  const links = deriveLegacyFactionLinks(relations);
  return factions.map((f) => {
    const link = links.get(f.id);
    return {
      ...f,
      alliedFactionIds: link ? Array.from(new Set(link.allies)) : f.alliedFactionIds || [],
      rivalFactionIds: link ? Array.from(new Set(link.rivals)) : f.rivalFactionIds || [],
    };
  });
}
