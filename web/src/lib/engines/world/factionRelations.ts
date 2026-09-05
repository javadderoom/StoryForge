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

/**
 * Extracts multiple candidate names from compound or parenthetical entity names.
 * Examples:
 * - "ستون زرین (آرتاوان)" -> ["ستون زرین", "آرتاوان"]
 * - "پایوران آهن / پیروان گروان (ماده)" -> ["پایوران آهن", "پیروان گروان", "گروان"]
 * - "پیروان نیلا (مرگ و رویا)" -> ["پیروان نیلا", "نیلا"]
 */
export function extractTargetCandidateNames(raw: string): string[] {
  if (!raw) return [];
  const text = raw.trim();
  const set = new Set<string>();
  set.add(text);

  // 1. Extract text outside and inside parentheses: e.g. "ستون زرین (آرتاوان)"
  const parenMatch = text.match(/^([^(]+)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const outside = parenMatch[1].trim();
    const inside = parenMatch[2].trim();
    if (outside) set.add(outside);
    if (inside) set.add(inside);
  } else {
    // Strip internal parentheticals: "پایوران آهن (ماده)" -> "پایوران آهن"
    const stripped = text.replace(/\([^)]*\)/g, '').trim();
    if (stripped && stripped !== text) set.add(stripped);
  }

  // 2. Split by slash / dash / comma / "یا" / "|"
  const parts = text.split(/[/،|\-]|(\s+یا\s+)/);
  for (const part of parts) {
    if (!part) continue;
    const clean = part.replace(/\([^)]*\)/g, '').trim();
    if (clean && clean.length > 1) {
      set.add(clean);
    }
  }

  // 3. Strip prefix phrases: "پیروان ", "فرقه ", "مکتب ", "پایوران ", "نگهبانان ", "شبکه‌ی ", "شبکه "
  const prefixRegex = /^(پیروان|فرقه|مکتب|فرقهٔ|پایوران|نگهبانان|شبکه‌ی|شبکه|یاران|سربازان|انجمن)\s+/;
  const currentItems = Array.from(set);
  for (const item of currentItems) {
    if (prefixRegex.test(item)) {
      const strippedPrefix = item.replace(prefixRegex, '').trim();
      if (strippedPrefix && strippedPrefix.length > 1) {
        set.add(strippedPrefix);
      }
    }
  }

  return Array.from(set).filter((c) => c.length > 0);
}

/**
 * Gets the cleanest, primary display name from a compound reference.
 */
export function getPrimaryCleanName(raw: string): string {
  if (!raw) return 'جناح ناشناس';
  const candidates = extractTargetCandidateNames(raw);
  // Pick the first clean candidate without trailing parentheticals
  const primary = candidates[1] || candidates[0] || raw;
  return primary.replace(/\([^)]*\)/g, '').trim() || raw.trim();
}

export function resolveTargetFactionId(
  rawTarget: unknown,
  sourceId: string,
  allFactions: Faction[],
  deities?: Array<{ id: string; name: string; affiliatedFactionIds?: string[] }>
): string | null {
  if (typeof rawTarget !== 'string') return null;
  const ref = rawTarget.trim();
  if (!ref || ref === sourceId) return null;

  // 1. Direct exact ID match
  const byId = allFactions.find((f) => f.id === ref && f.id !== sourceId);
  if (byId) return byId.id;

  const candidates = extractTargetCandidateNames(ref);

  for (const cand of candidates) {
    // 2. Exact name match (case-insensitive)
    const byName = allFactions.find(
      (f) => f.id !== sourceId && f.name.toLowerCase() === cand.toLowerCase()
    );
    if (byName) return byName.id;

    // 3. Loose name match via ActionProtocol nameMatch (handles Persian ZWNJ, etc.)
    const byLoose = allFactions.find(
      (f) => f.id !== sourceId && nameMatch(f.name, cand)
    );
    if (byLoose) return byLoose.id;

    // 4. Substring / contains match
    const bySub = allFactions.find(
      (f) =>
        f.id !== sourceId &&
        (f.name.toLowerCase().includes(cand.toLowerCase()) ||
          cand.toLowerCase().includes(f.name.toLowerCase()))
    );
    if (bySub) return bySub.id;

    // 5. Check description / public goals for mentions of this candidate
    const byContext = allFactions.find(
      (f) =>
        f.id !== sourceId &&
        ((f.description && nameMatch(f.description, cand)) ||
          (f.publicGoals && nameMatch(f.publicGoals, cand)))
    );
    if (byContext) return byContext.id;

    // 6. Check deities / religions if provided
    if (deities && deities.length > 0) {
      const matchingDeity = deities.find((d) => nameMatch(d.name, cand));
      if (matchingDeity && Array.isArray(matchingDeity.affiliatedFactionIds)) {
        const affId = matchingDeity.affiliatedFactionIds.find(
          (id) => id !== sourceId && allFactions.some((f) => f.id === id)
        );
        if (affId) return affId;
      }
    }
  }

  return null;
}

export interface IncomingFactionUpdate {
  relations?: unknown;
  factionRelations?: unknown;
  alliedFactionIds?: unknown;
  rivalFactionIds?: unknown;
}

export interface MergeFactionRelationsOptions {
  deities?: Array<{ id: string; name: string; affiliatedFactionIds?: string[] }>;
  autoProvision?: boolean;
}

export interface DetailedMergeResult {
  relations: FactionRelation[];
  allFactions: Faction[];
  autoCreatedFactions: Faction[];
}

/**
 * Detailed faction relations merge with full candidate matching and auto-provisioning
 * of missing factions so inter-faction relational networks are never dropped.
 */
export function mergeFactionRelationsDetailed(
  factionId: string,
  updated: IncomingFactionUpdate | null | undefined,
  allFactions: Faction[],
  currentRelations: FactionRelation[] = [],
  options: MergeFactionRelationsOptions = {}
): DetailedMergeResult {
  const workingFactions = [...allFactions];
  const autoCreatedFactions: Faction[] = [];
  const autoProvision = options.autoProvision ?? true;

  if (!updated || typeof updated !== 'object') {
    return { relations: currentRelations, allFactions: workingFactions, autoCreatedFactions };
  }

  const rawRelations = updated.relations ?? updated.factionRelations;
  const rawAllies = Array.isArray(updated.alliedFactionIds) ? updated.alliedFactionIds : null;
  const rawRivals = Array.isArray(updated.rivalFactionIds) ? updated.rivalFactionIds : null;

  // If no relation data was provided in the update, keep existing relations intact.
  if (rawRelations === undefined && rawAllies === null && rawRivals === null) {
    return { relations: currentRelations, allFactions: workingFactions, autoCreatedFactions };
  }

  const incomingEntries: Array<{
    targetId: string;
    value: FactionRelationValue;
    note?: string;
    isPublic?: boolean;
  }> = [];

  const seenTargets = new Set<string>();

  const resolveOrProvision = (
    targetRef: unknown,
    val: FactionRelationValue,
    note?: string,
    isPublic: boolean = true
  ) => {
    if (typeof targetRef !== 'string') return;
    const cleanRef = targetRef.trim();
    if (!cleanRef) return;

    let targetId = resolveTargetFactionId(cleanRef, factionId, workingFactions, options.deities);

    // Auto-provision missing faction if it doesn't exist yet
    if (!targetId && autoProvision && cleanRef !== factionId) {
      const cleanName = getPrimaryCleanName(cleanRef);
      const newFac: Faction = {
        id: `fac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        description: note ? `جناح در مناسبات قدرت جهان: ${note}` : `جناح در مناسبات قدرت جهان`,
        alignment:
          val === 'hostile'
            ? 'Hostile Order'
            : val === 'rival'
            ? 'Rival Order'
            : val === 'allied'
            ? 'Allied Order'
            : val === 'favorable'
            ? 'Favorable Order'
            : 'Neutral',
        publicGoals: note || '',
        territoryIds: [],
        alliedFactionIds: [],
        rivalFactionIds: [],
      };
      workingFactions.push(newFac);
      autoCreatedFactions.push(newFac);
      targetId = newFac.id;
    }

    if (targetId && targetId !== factionId && !seenTargets.has(targetId)) {
      incomingEntries.push({ targetId, value: val, note, isPublic });
      seenTargets.add(targetId);
    }
  };

  // 1. Process explicit relations array or map
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

      resolveOrProvision(targetRef, value, note, isPublic);
    }
  } else if (rawRelations && typeof rawRelations === 'object') {
    for (const [key, item] of Object.entries(rawRelations as Record<string, unknown>)) {
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

      resolveOrProvision(key, value, note, isPublic);
    }
  }

  // 2. Fallbacks from alliedFactionIds
  if (rawAllies) {
    for (const ref of rawAllies) {
      resolveOrProvision(ref, 'allied', '', true);
    }
  }

  // 3. Fallbacks from rivalFactionIds
  if (rawRivals) {
    for (const ref of rawRivals) {
      resolveOrProvision(ref, 'rival', '', true);
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

  return {
    relations: result,
    allFactions: workingFactions,
    autoCreatedFactions,
  };
}

/**
 * Robustly merges relation updates from AI generation, Studio Oracle actions,
 * or UI forms into the WorldBible factionRelations array.
 *
 * Handles:
 * - Array-based relations: [{ targetFactionId, value, note, isPublic }]
 * - Record-based relations: { [targetId]: { value, note, isPublic } }
 * - Target resolution by ID, compound name, or deity patron (e.g. "ستون زرین (آرتاوان)")
 * - Auto-provisions missing factions so rich webs are preserved
 * - Preserves existing relations with other factions
 */
export function mergeFactionRelations(
  factionId: string,
  updated: IncomingFactionUpdate | null | undefined,
  allFactions: Faction[],
  currentRelations: FactionRelation[] = [],
  options?: MergeFactionRelationsOptions
): FactionRelation[] {
  const res = mergeFactionRelationsDetailed(
    factionId,
    updated,
    allFactions,
    currentRelations,
    options
  );
  // Attach auto-created factions to the returned array for caller access
  const relations = res.relations as FactionRelation[] & {
    autoCreatedFactions?: Faction[];
    allFactions?: Faction[];
  };
  relations.autoCreatedFactions = res.autoCreatedFactions;
  relations.allFactions = res.allFactions;
  return relations;
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
