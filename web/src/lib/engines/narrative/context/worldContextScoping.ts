import {
  WorldBible,
  ScopeTier,
  getLocationAncestry,
} from '@/lib/types/world';
import { StoryNpcOverride } from '@/lib/types/story';

export type { ScopeTier };

export interface ScopedContextOptions {
  /** Active chapter scope tier — drives how much lore is injected. */
  scopeTier?: ScopeTier;
  /** Active chapter sequence number (1-based), used to filter NPCs whose entrance is reserved for future chapters. */
  currentChapterNumber?: number;
  /** Location ids relevant to the active scene(s). */
  locationIds?: string[];
  /** NPC ids present in the active scene(s). */
  npcIds?: string[];
  /**
   * Plan 15 (Bug 3): party roster travelling with the protagonist. Members
   * are pulled into the scoped context even when their home location is
   * elsewhere. Callers resolve it via resolveAccompanyingIds().
   */
  accompanyingNpcIds?: string[];
  /**
   * Plan 15 Phase 4: optional telemetry collector. When provided, every scope
   * decision (include/exclude/truncate) is recorded with an explicit reason;
   * when omitted, behavior is identical and no records are produced.
   */
  telemetry?: ContextTelemetry;
  /** When true, bypasses scope-pruning and tight caps (for full Studio generation / chat / audits). */
  unconstrained?: boolean;
}

/**
 * Token budgets per scope tier for gameplay scene generation. Early "street" chapters stay strictly grounded
 * by injecting only a sliver of the World Bible; mythic scopes may cite most
 * of it.
 */
export const SCOPE_CAPS: Record<ScopeTier, {
  factions: number;
  factionRelations: number;
  timeline: number;
  artifacts: number;
  bestiary: number;
  religions: number;
  dramaBonds: number;
  locations: number;
  npcs: number;
  laws: number;
}> = {
  street: { factions: 2, factionRelations: 3, timeline: 2, artifacts: 3, bestiary: 3, religions: 2, dramaBonds: 3, locations: 3, npcs: 4, laws: 6 },
  regional: { factions: 4, factionRelations: 5, timeline: 3, artifacts: 4, bestiary: 4, religions: 3, dramaBonds: 4, locations: 5, npcs: 6, laws: 8 },
  continental: { factions: 8, factionRelations: 8, timeline: 6, artifacts: 8, bestiary: 8, religions: 6, dramaBonds: 6, locations: 8, npcs: 9, laws: 10 },
  mythic: { factions: 10, factionRelations: 10, timeline: 8, artifacts: 10, bestiary: 10, religions: 8, dramaBonds: 7, locations: 10, npcs: 12, laws: 10 },
};

/**
 * Generous budgets for Studio authoring, Oracle copilot, audits, and entity workshops
 * where the entire World Bible must be visible to the AI.
 */
export const STUDIO_CAPS = {
  factions: 100,
  factionRelations: 150,
  timeline: 100,
  artifacts: 100,
  bestiary: 100,
  religions: 100,
  dramaBonds: 100,
  locations: 150,
  npcs: 150,
  laws: 100,
};

export const cap = (arr: string[], max: number): string[] => (arr.length > max ? arr.slice(0, max) : arr);

// ---------------------------------------------------------------------------
// Plan 15 Phase 4 — Context Envelope Telemetry.
// Pruning has always been silent: entities dropped by scope filters or token
// caps simply vanished, leaving authors unable to see why a creature never
// appears in a scene (Plan 15 Bug 1 was diagnosed by hand because of this).
// A `ContextTelemetry` collector records included/excluded/truncated items
// with a human-readable reason. It is strictly optional — callers that do not
// pass one keep byte-identical behavior and zero overhead.
// ---------------------------------------------------------------------------

export type ContextEntityKind =
  | 'npc'
  | 'faction'
  | 'location'
  | 'bestiary'
  | 'artifact'
  | 'religion'
  | 'dramaBond'
  | 'factionRelation'
  | 'timeline'
  | 'law';

export interface ContextEntityRecord {
  kind: ContextEntityKind;
  id?: string;
  name?: string;
  /** Rationale — always present on exclusions, absent on inclusions. */
  reason?: string;
}

export interface ContextTelemetry {
  included: ContextEntityRecord[];
  excluded: ContextEntityRecord[];
  /** Count-only truncation entries (token caps) keyed by entity kind. */
  truncated: Array<{ kind: ContextEntityKind; withheld: number; cap: number }>;
  recordIncluded(kind: ContextEntityKind, id?: string, name?: string): void;
  recordExcluded(kind: ContextEntityKind, id: string | undefined, name: string | undefined, reason: string): void;
  recordTruncation(kind: ContextEntityKind, withheld: number, caps: number): void;
}

export function createContextTelemetry(): ContextTelemetry {
  const included: ContextEntityRecord[] = [];
  const excluded: ContextEntityRecord[] = [];
  const truncated: Array<{ kind: ContextEntityKind; withheld: number; cap: number }> = [];
  return {
    included,
    excluded,
    truncated,
    recordIncluded(kind, id, name) {
      included.push({ kind, id, name });
    },
    recordExcluded(kind, id, name, reason) {
      excluded.push({ kind, id, name, reason });
    },
    recordTruncation(kind, withheld, capCount) {
      truncated.push({ kind, withheld, cap: capCount });
    },
  };
}

/**
 * Relevance-ranked take: pinned ids first (active location/NPCs can never be
 * truncated out), then the rest in insertion order. Replaces blind slice.
 * `onTruncate` (Plan 15 Phase 4) receives every dropped entity.
 */
export function takeRanked<T extends { id?: string }>(
  entities: T[],
  toLine: (e: T) => string,
  max: number,
  pinIds: Set<string> = new Set(),
  onTruncate?: (dropped: T[]) => void
): string[] {
  if (entities.length <= max) return entities.map(toLine);
  const pinned = entities.filter((e) => e.id && pinIds.has(e.id));
  const rest = entities.filter((e) => !e.id || !pinIds.has(e.id));
  const kept = [...pinned, ...rest].slice(0, max);
  if (onTruncate) {
    const keptIds = new Set(kept.map((e) => e.id));
    onTruncate(entities.filter((e) => !keptIds.has(e.id)));
  }
  return kept.map(toLine);
}

export function normalizeScopeTier(tier?: string | null): ScopeTier {
  if (!tier) return 'regional';
  const lower = String(tier).toLowerCase().trim();
  if (lower === 'street' || lower === 'local') return 'street';
  if (lower === 'regional' || lower === 'wilderness' || lower === 'province') return 'regional';
  if (lower === 'continental' || lower === 'kingdom' || lower === 'empire') return 'continental';
  if (lower === 'mythic' || lower === 'cosmic' || lower === 'planar') return 'mythic';
  return 'regional';
}

const TIER_RANK: Record<string, number> = {
  street: 0,
  local: 0,
  regional: 1,
  wilderness: 1,
  province: 1,
  continental: 2,
  kingdom: 2,
  empire: 2,
  mythic: 3,
  cosmic: 3,
  planar: 3,
};

/**
 * A faction with an explicit scope only surfaces once the active chapter's
 * tier has escalated to it. Unscoped factions are always relevant.
 */
export const passesFactionTierGate = (scope: ScopeTier | undefined, current: ScopeTier): boolean => {
  if (!scope) return true;
  const sRank = TIER_RANK[scope] ?? 1;
  const cRank = TIER_RANK[current] ?? 1;
  return sRank <= cRank;
};

/**
 * Plan 15 (Bug 3): effective party roster for a turn.
 * - Explicit `playerState.accompanyingNpcIds` is authoritative when present:
 *   non-empty pulls those NPCs into the scene; `[]` means explicitly alone.
 * - `undefined`/`null` (legacy sessions, no writer yet) falls back to ledger
 *   companions (`npcStatuses` entries with status `'companion'`).
 * Structural params keep this free of gameplay-type import cycles.
 */
export function resolveAccompanyingIds(
  playerState: { accompanyingNpcIds?: string[] | null },
  ledger?: { npcStatuses?: Array<{ npcId: string; status: string }> | null } | null
): string[] {
  if (playerState.accompanyingNpcIds !== undefined && playerState.accompanyingNpcIds !== null) {
    return [...playerState.accompanyingNpcIds];
  }
  return (ledger?.npcStatuses ?? [])
    .filter((s) => s.status === 'companion')
    .map((s) => s.npcId);
}

/**
 * Plan 07 — Dynamic Context-Aware Lore Retrieval.
 * Prunes the World Bible down to only the entities relevant to the active
 * chapter scope and scene location/NPCs (~5-10% of total lore), so long-form
 * sagas avoid stuffing the entire universe into every turn.
 */
export function pruneWorldBibleToScope(
  wb: WorldBible,
  options: ScopedContextOptions,
  storyNpcOverrides?: Record<string, StoryNpcOverride>
): WorldBible {
  const scopeTier = normalizeScopeTier(options.scopeTier);
  const locationIds = options.locationIds ?? [];
  const npcIds = options.npcIds ?? [];
  const currentChapterNumber = options.currentChapterNumber;
  /** Plan 15 Phase 4: optional decision recorder (byte-identical when absent). */
  const telemetry = options.telemetry;
  const emit = (
    keep: boolean,
    kind: ContextEntityKind,
    reason: string,
    id?: string,
    name?: string
  ): boolean => {
    if (keep) telemetry?.recordIncluded(kind, id, name);
    else telemetry?.recordExcluded(kind, id, name, reason);
    return keep;
  };

  // 1-hop neighborhood of the active locations (travel-adjacent context) + full ancestry hierarchy.
  const activeLocSet = new Set(locationIds);
  for (const locId of locationIds) {
    const loc = (wb.locations ?? []).find((l) => l.id === locId);
    loc?.connectedLocationIds?.forEach((id) => activeLocSet.add(id));
    const ancestors = getLocationAncestry(wb.locations ?? [], locId);
    ancestors.forEach((a) => activeLocSet.add(a.id));
  }
  const activeNpcSet = new Set(npcIds);
  // Plan 15 (Bug 3): the travelling party is present wherever the player is,
  // even when a companion's home location is elsewhere.
  const accompanyingSet = new Set(options.accompanyingNpcIds ?? []);

  const keepNpcs = (wb.npcs ?? []).filter((n) => {
    if (activeNpcSet.has(n.id)) {
      return emit(true, 'npc', 'explicitly pinned for this scene', n.id, n.name);
    }
    if (accompanyingSet.has(n.id)) {
      return emit(true, 'npc', 'travelling with the protagonist (accompanying roster)', n.id, n.name);
    }
    if (currentChapterNumber !== undefined) {
      const ov = storyNpcOverrides?.[n.id];
      if (ov?.firstAppearanceChapter !== undefined && ov.firstAppearanceChapter > currentChapterNumber) {
        return emit(
          false,
          'npc',
          `first appears in Chapter ${ov.firstAppearanceChapter} (current chapter ${currentChapterNumber})`,
          n.id,
          n.name
        );
      }
    }
    if (activeLocSet.has(n.currentLocationId)) {
      return emit(true, 'npc', `resident of scene location ${n.currentLocationId}`, n.id, n.name);
    }
    if (n.applicableLocationIds && n.applicableLocationIds.some((locId) => activeLocSet.has(locId))) {
      return emit(true, 'npc', 'roams / applies to the active locations', n.id, n.name);
    }
    // Plan 15: caravan travelers count as present only when physically at a
    // scene location (their own currentLocationId). A route merely touching
    // the scene is NOT presence — members resting at camp stay in the
    // background and must not speak in secluded scenes.
    const isCaravanTraveler = (wb.tradeRoutes ?? []).some((r) => {
      if (r.caravanMasterNpcId !== n.id && !(r.travelingNpcIds ?? []).includes(n.id)) return false;
      return locationIds.includes(n.currentLocationId);
    });
    if (isCaravanTraveler) {
      return emit(true, 'npc', 'caravan member physically present at the scene', n.id, n.name);
    }
    return emit(
      false,
      'npc',
      `based elsewhere (${n.currentLocationId || 'unlisted'}) and not part of the scene party`,
      n.id,
      n.name
    );
  });
  const keptNpcIds = new Set(keepNpcs.map((n) => n.id));

  const isHighScope = scopeTier === 'continental' || scopeTier === 'mythic';
  const keepFactions = (wb.factions ?? []).filter((f) => {
    if (
      !emit(
        passesFactionTierGate(f.scope, scopeTier),
        'faction',
        `faction scope ${f.scope || 'unlisted'} escalates above the current chapter tier ${scopeTier}`,
        f.id,
        f.name
      )
    ) {
      return false;
    }
    if (emit(isHighScope, 'faction', `${scopeTier}-tier scope widens the political aperture beyond the scene`, f.id, f.name)) {
      return true;
    }
    const territoryHit = f.territoryIds.some((t) => activeLocSet.has(t));
    const memberHit = keepNpcs.some((n) => n.factionId && n.factionId === f.id);
    return emit(
      territoryHit || memberHit,
      'faction',
      territoryHit
        ? 'holds territory in the scene region'
        : memberHit
          ? 'has members present in the scene'
          : 'no territory or members connected to the scene',
      f.id,
      f.name
    );
  });
  const keptFactionIds = new Set(keepFactions.map((f) => f.id));

  const keepLocations = (wb.locations ?? []).filter((l) => {
    if (scopeTier === 'mythic') {
      return emit(true, 'location', 'mythic scope surfaces every location', l.id, l.name);
    }
    const directHit = activeLocSet.has(l.id);
    const hopHit = l.connectedLocationIds?.some((id) => activeLocSet.has(id)) ?? false;
    return emit(
      directHit || hopHit,
      'location',
      directHit
        ? 'scene location or ancestor'
        : hopHit
          ? 'one hop from the scene locations'
          : 'outside the scene neighborhood',
      l.id,
      l.name
    );
  });
  const keptLocationIds = new Set(keepLocations.map((l) => l.id));

  // Plan 15 (Bug 1): Scene-location hierarchy (scene location + ancestors).
  // Connected locations (1-hop travel destinations) are NOT habitats for the immediate scene.
  const sceneLocationIds = new Set(locationIds);
  for (const locId of locationIds) {
    const ancestors = getLocationAncestry(wb.locations ?? [], locId);
    ancestors.forEach((a) => sceneLocationIds.add(a.id));
  }

  const keepBestiary = (wb.bestiary ?? []).filter((c) => {
    // Empty habitat stays eligible in Phase 1 (zero-migration; strict exclusion deferred)
    if (!c.habitatLocationIds || c.habitatLocationIds.length === 0) {
      return emit(
        true,
        'bestiary',
        'no habitats authored — eligible roaming fauna (Phase 1 zero-migration)',
        c.id,
        c.name
      );
    }
    // Specified habitats must match the active scene location hierarchy (or kept locations if no specific scene location is set)
    const matchTargets = sceneLocationIds.size > 0 ? sceneLocationIds : keptLocationIds;
    const hit = c.habitatLocationIds.some((h) => matchTargets.has(h));
    const habitatNames = c.habitatLocationIds
      .map((h) => (wb.locations ?? []).find((l) => l.id === h)?.name || h)
      .join(' / ');
    // Plan 15 Bug 1: no ancestors/1-hop locations count as habitat for the scene.
    return emit(
      hit,
      'bestiary',
      hit
        ? 'habitat matches the scene location hierarchy'
        : `habitat outside the scene (authored habitats: ${habitatNames})`,
      c.id,
      c.name
    );
  });

  const keepArtifacts = (wb.artifacts ?? []).filter((a) => {
    switch (a.currentHolderType) {
      case 'npc': {
        const hit =
          keptNpcIds.has(a.currentHolderId) || (isHighScope && (wb.npcs ?? []).some((n) => n.id === a.currentHolderId));
        return emit(
          hit,
          'artifact',
          hit
            ? `held by a scene-relevant NPC (${a.currentHolderId})`
            : `held by an out-of-scene NPC (${a.currentHolderId})`,
          a.id,
          a.name
        );
      }
      case 'location':
        return emit(
          keptLocationIds.has(a.currentHolderId),
          'artifact',
          keptLocationIds.has(a.currentHolderId)
            ? `kept inside a scene-relevant location (${a.currentHolderId})`
            : `kept inside a location outside the scene (${a.currentHolderId})`,
          a.id,
          a.name
        );
      case 'faction':
        return emit(
          keptFactionIds.has(a.currentHolderId),
          'artifact',
          keptFactionIds.has(a.currentHolderId)
            ? `held by a scene-relevant faction (${a.currentHolderId})`
            : `held by a faction outside the scene (${a.currentHolderId})`,
          a.id,
          a.name
        );
      default:
        return emit(
          isHighScope,
          'artifact',
          isHighScope
            ? 'no holder on record; high scope surfaces it anyway'
            : 'no holder on record; withheld below high scope',
          a.id,
          a.name
        );
    }
  });

  const keepReligions = (wb.religions ?? []).filter((d) => {
    const holyHit = d.holyLocationIds.some((h) => keptLocationIds.has(h));
    const faithHit = d.affiliatedFactionIds.some((f) => keptFactionIds.has(f));
    return emit(
      holyHit || faithHit,
      'religion',
      holyHit
        ? 'worshipped at a scene-relevant holy place'
        : faithHit
          ? 'affiliated with a scene-relevant faction'
          : 'no holy place or faction connected to the scene',
      d.id,
      d.name
    );
  });

  const keepDramaBonds = (wb.dramaBonds ?? []).filter((b) => {
    const hit = keptNpcIds.has(b.sourceNpcId) || keptNpcIds.has(b.targetNpcId);
    return emit(
      hit,
      'dramaBond',
      hit
        ? 'anchors at least one scene-relevant NPC'
        : `links two NPCs outside the scene (${b.sourceNpcId} ↔ ${b.targetNpcId})`,
      b.id,
      b.id
    );
  });

  const keepFactionRelations = (wb.factionRelations ?? []).filter((r) => {
    const hit = keptFactionIds.has(r.sourceFactionId) || keptFactionIds.has(r.targetFactionId);
    return emit(
      hit,
      'factionRelation',
      hit
        ? 'involves at least one scene-relevant faction'
        : `both factions outside the scene (${r.sourceFactionId} ↔ ${r.targetFactionId})`,
      r.sourceFactionId + '↔' + r.targetFactionId,
      undefined
    );
  });

  return {
    ...wb,
    npcs: keepNpcs,
    factions: keepFactions,
    locations: keepLocations,
    bestiary: keepBestiary,
    artifacts: keepArtifacts,
    religions: keepReligions,
    dramaBonds: keepDramaBonds,
    factionRelations: keepFactionRelations,
  };
}
