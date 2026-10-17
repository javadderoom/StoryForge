import { WorldBible, ScopeTier, StoryChapter, WorldStateLedger, FACTION_RELATION_META, getLocationAncestry, NPCDossier } from '@/lib/types/world';
import { formatTradeRouteLine } from '@/lib/engines/world/tradeRoutes';
import { StoryNpcOverride, StoryScale } from '@/lib/types/story';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { buildEquippedItemProfiles, formatItemInteractionsForPrompt } from '../game/itemInteractions';
import { describeRollModifier, getActivationCost, getActivationCooldown } from '../game/abilityEffects';

/**
 * Compact combat summary for an NPC (`elite CR9 — HP 64/80, Rage 3/5`).
 * Empty string when the NPC has no stat calibration. The trailing directive
 * tells the narrator to treat vitals and pools as binding state.
 */
export function formatNpcCombatSummary(n: NPCDossier): string {
  const sc = n.statCalibration;
  if (!sc) return '';
  const basis = sc.crBasis?.trim() ? ` [threat: ${sc.crBasis.trim()}]` : '';
  const parts = [`HP ${sc.vitals?.health?.current ?? '?'}/${sc.vitals?.health?.max ?? '?'}`];
  if (sc.vitals?.stamina) parts.push(`Stamina ${sc.vitals.stamina.current}/${sc.vitals.stamina.max}`);
  if (sc.vitals?.mana) parts.push(`Mana ${sc.vitals.mana.current}/${sc.vitals.mana.max}`);
  for (const p of sc.resourcePools ?? []) parts.push(`${p.name} ${p.current}/${p.max}`);
  return `${sc.combatTier} CR${sc.challengeRating}${basis} — ${parts.join(', ')} (honor these vitals and pools when narrating harm, fatigue, and ability costs)`;
}

/**
 * Formats the protagonist's equipped gear and carrying inventory into rich,
 * contextual lines that convey the item's slot, specific authored powers/purpose,
 * and whether it is a permanent relic vs consumable, so the LLM doesn't misuse them.
 */
export function formatEquippedItemsForContext(
  playerState: { inventory?: any[]; equipment?: Record<string, any> | any },
  story?: any
): string[] {
  const isEnglish = story?.language === 'en';
  const artifacts: any[] = story?.worldBible?.artifacts || [];
  const inventory: any[] = playerState.inventory || [];
  const equipment = playerState.equipment || {};

  const slotLabelsFa: Record<string, string> = {
    mainHand: 'سلاح دست اصلی',
    offHand: 'دست دوم/سپر',
    armor: 'زره و پوشش',
    relic: 'یادگار/طلسم متصل',
  };
  const slotLabelsEn: Record<string, string> = {
    mainHand: 'Main Hand Weapon',
    offHand: 'Off Hand / Shield',
    armor: 'Armor',
    relic: 'Equipped Relic / Talisman',
  };

  const results: string[] = [];

  // 1. Process equipped slots first with full detail
  for (const [slotKey, itemRef] of Object.entries(equipment)) {
    if (!itemRef) continue;
    const invItem = inventory.find((i) =>
      typeof i === 'string' ? i === itemRef : (i.id === itemRef || i.name === itemRef)
    );
    const art = artifacts.find((a) => a.id === itemRef || a.name === itemRef);
    const name = (typeof invItem === 'object' && invItem?.name) || art?.name || (typeof invItem === 'string' ? invItem : itemRef);
    const slotLabel = isEnglish ? (slotLabelsEn[slotKey] || slotKey) : (slotLabelsFa[slotKey] || slotKey);

    const desc = art?.description || (typeof invItem === 'object' ? invItem?.description : '') || '';
    const powers: string[] = art?.powers || [];
    const isNonConsumable = typeof invItem === 'object' ? !invItem?.isConsumable : true;

    const details: string[] = [slotLabel];
    if (powers.length > 0) {
      details.push(isEnglish ? `Powers: ${powers.join(', ')}` : `کارکرد/قدرت: ${powers.join('، ')}`);
    } else if (desc) {
      details.push(desc.slice(0, 75));
    }
    if (slotKey === 'relic' && isNonConsumable) {
      details.push(isEnglish ? 'Permanent gear, non-consumable' : 'دائمی، غیرمصرفی');
    }

    results.push(`${name} [${details.join(' — ')}]`);
  }

  // 2. Process other unequipped carrying items in inventory
  const equippedRefs = new Set(Object.values(equipment).filter(Boolean));
  for (const item of inventory) {
    const itemId = typeof item === 'string' ? item : item?.id;
    const itemName = typeof item === 'string' ? item : (item?.name || item?.id || '');
    if (!itemName) continue;
    if (equippedRefs.has(itemId) || equippedRefs.has(itemName)) continue;

    const art = artifacts.find((a) => a.id === itemId || a.name === itemName);
    const typeLabel = (typeof item === 'object' && item?.type) || 'item';
    const desc = art?.description || (typeof item === 'object' ? item?.description : '') || '';
    const powers: string[] = art?.powers || [];
    const details: string[] = [typeLabel];
    if (powers.length > 0) {
      details.push(isEnglish ? `Powers: ${powers.join(', ')}` : `کارکرد: ${powers.join('، ')}`);
    } else if (desc) {
      details.push(desc.slice(0, 50));
    }
    results.push(`${itemName} [${details.join(' — ')}]`);
  }

  return results.length > 0 ? results : inventory.map((i) => (typeof i === 'string' ? i : i.name));
}

/**
 * Resolves playerState.abilities (which often store raw IDs like `ab_mtw16s8f`)
 * into detailed, human-readable descriptors with ability name, description, and combat/tactical effects.
 */
export function formatAbilitiesForContext(
  playerState: { abilities?: string[] },
  story?: any
): string[] {
  if (!playerState.abilities || playerState.abilities.length === 0) return [];
  const definedAbilities: any[] = story?.rpgSystem?.abilities || [];
  const isEnglish = story?.language === 'en';

  return playerState.abilities.map((abilityIdOrName) => {
    const defined = definedAbilities.find(
      (a: any) => a.id === abilityIdOrName || a.name === abilityIdOrName
    );
    if (!defined) {
      return abilityIdOrName;
    }

    const name = defined.name || abilityIdOrName;
    const typeLabel = defined.type
      ? isEnglish
        ? defined.type === 'active_spell'
          ? '[Active Spell]'
          : defined.type === 'active_technique'
          ? '[Active Technique]'
          : defined.type === 'passive_skill'
          ? '[Passive Skill]'
          : defined.type === 'passive_feat'
          ? '[Passive Feat]'
          : `[${defined.type}]`
        : defined.type === 'active_spell'
        ? '[ورد / جادوی فعال]'
        : defined.type === 'active_technique'
        ? '[تکنیک رزمی / اقدام فعال]'
        : defined.type === 'passive_skill'
        ? '[مهارت غیرفعال]'
        : defined.type === 'passive_feat'
        ? '[خصلت و ویژگی ذاتی]'
        : '[توانایی]'
      : '';
    const desc = defined.description || defined.effectSummary || '';
    const effect =
      defined.effectSummary && defined.description && defined.effectSummary !== defined.description
        ? isEnglish
          ? `Effect: ${defined.effectSummary}`
          : `اثر: ${defined.effectSummary}`
        : '';

    // The REAL, engine-resolved numbers. Without these the narrator guesses at
    // what an ability does; with them it dramatises the exact modifier the d20
    // already received.
    const mechanicalLines: string[] = [];
    const isActive =
      defined.type === 'active_spell' || defined.type === 'active_technique';
    const specs = isActive
      ? (defined.activation?.effects ?? [])
      : (defined.rollModifiers ?? []);
    for (const spec of specs) {
      mechanicalLines.push(describeRollModifier(spec, !isEnglish));
    }
    if (mechanicalLines.length > 0) {
      const joined = mechanicalLines.join(' | ');
      mechanicalLines.length = 0;
      mechanicalLines.push(
        isEnglish ? `Roll effect: ${joined}` : `اثر بر تاس: ${joined}`
      );
    }
    if (isActive) {
      const cost = getActivationCost(defined);
      const cooldown = getActivationCooldown(defined);
      if (cost) {
        mechanicalLines.push(
          isEnglish
            ? `Cost: ${cost.amount} ${cost.targetResourceId}`
            : `هزینه: ${cost.amount} ${cost.targetResourceId}`
        );
      }
      if (cooldown > 0) {
        mechanicalLines.push(
          isEnglish ? `Cooldown: ${cooldown} turn(s)` : `بازیابی: ${cooldown} نوبت`
        );
      }
      mechanicalLines.push(
        isEnglish
          ? 'Must be actively invoked by the player to take effect.'
          : 'برای اثرگذاری باید آگاهانه توسط بازیکن اجرا شود.'
      );
    }

    const parts = [
      isEnglish ? `"${name}"` : `«${name}»`,
      typeLabel,
      desc,
      effect,
      ...mechanicalLines,
    ].filter(Boolean);

    return parts.join(' — ');
  });
}

/**
 * Renders the character's background traits together with their authored
 * mechanical effects, resolved from the story's background definitions.
 */
export function formatTraitsForContext(
  playerState: { traitIds?: string[]; backgroundId?: string; traits?: string[] },
  story?: any
): Array<{ name: string; effects: string[] }> {
  const rpgSystem = story?.rpgSystem;
  const backgroundId = playerState?.backgroundId;
  const background = (rpgSystem?.backgrounds ?? []).find(
    (b: any) => b?.id === backgroundId || b?.name === backgroundId
  );

  const explicitIds = (playerState?.traitIds ?? []).filter(Boolean);
  const traits: any[] = background?.traits ?? [];
  const resolved = explicitIds.length > 0
    ? explicitIds
        .map((id) => traits.find((t: any) => t?.id === id || t?.name === id))
        .filter(Boolean)
    : traits;

  const isEnglish = story?.language === 'en';

  return resolved.map((trait: any) => ({
    name: trait?.name || trait?.id || '',
    effects: ((trait?.rollModifiers ?? []) as any[]).map((spec) =>
      describeRollModifier(spec, !isEnglish)
    ),
  }));
}

/**
 * Generates the structured item capabilities & interaction catalogue for the protagonist's
 * equipped gear, clarifying exact primary purposes, permitted interactions, forbidden misuses,
 * and passive bonuses so the AI narrator understands item fidelity.
 */
export function formatItemInteractionsCatalogForContext(
  playerState: any,
  story?: any
): string {
  const isEnglish = story?.language === 'en';
  const profiles = buildEquippedItemProfiles(playerState, story, isEnglish);
  return formatItemInteractionsForPrompt(profiles, isEnglish);
}



export interface WorldContextBlocks {
  storyScale?: string;
  worldSummary?: string;
  themeNotes?: string;
  authoredSystemPrompt?: string;
  factions: string[];
  /** 5-state inter-faction spectrum lines: `A ↔ B: hostile (دشمن خونی) — note`. */
  factionRelations: string[];
  timeline: string[];
  artifacts: string[];
  bestiary: string[];
  religions: string[];
  dramaBonds: string[];
  locations: string[];
  npcs: string[];
  laws: string[];
  ontologySummary?: string;
  quests?: string[];
  tradeRoutes?: string[];
}

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
const SCOPE_CAPS: Record<ScopeTier, {
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
const STUDIO_CAPS = {
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

const cap = (arr: string[], max: number): string[] => (arr.length > max ? arr.slice(0, max) : arr);

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
function takeRanked<T extends { id?: string }>(
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
const passesFactionTierGate = (scope: ScopeTier | undefined, current: ScopeTier): boolean => {
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
    // (Scene residents already pass via currentLocationId above, so this
    // branch is intentionally narrow; it stays explicit so the rule is
    // visible next to the blanket-exposure logic it replaced.)
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

/**
 * Compresses the full World Bible into dense, token-bounded one-liner blocks
 * suitable for injecting into the play-time narrator context envelope.
 *
 * Pass `options` (Plan 07) to activate scope-aware pruning for long-form saga
 * chapters; omit it to compress the whole bible at mythic-tier budgets.
 */
export function buildWorldContextBlocks(
  story: {
    worldBible?: WorldBible | null;
    storyNpcOverrides?: Record<string, StoryNpcOverride>;
    storyScale?: StoryScale;
  },
  options?: ScopedContextOptions
): WorldContextBlocks {
  let wb = story.worldBible;
  if (!wb) {
    return {
      factions: [],
      factionRelations: [],
      timeline: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
      locations: [],
      npcs: [],
      laws: [],
    };
  }

  const isStudioMode = !options || options.unconstrained === true;
  const scopeTier: ScopeTier = normalizeScopeTier(options?.scopeTier);
  const overrides = story.storyNpcOverrides || {};
  const centralNpcIds: string[] = [];
  for (const [npcId, ov] of Object.entries(overrides)) {
    if (ov.narrativeImportance === 'central') {
      centralNpcIds.push(npcId);
    }
  }

  let effectiveOptions = options;
  if (options && centralNpcIds.length > 0) {
    effectiveOptions = {
      ...options,
      npcIds: Array.from(new Set([...(options.npcIds || []), ...centralNpcIds])),
    };
  }

  if (effectiveOptions && !effectiveOptions.unconstrained) {
    wb = pruneWorldBibleToScope(wb, effectiveOptions, overrides);
  }
  const caps = isStudioMode ? STUDIO_CAPS : (SCOPE_CAPS[scopeTier] ?? SCOPE_CAPS.regional);
  // Plan 15 Phase 4: token-cap truncation is an exclusion vector too — record
  // withheld counts/ids so the Studio inspector can explain why an entity that
  // passed scope-pruning still never reached the prompt.
  const telemetry = options?.telemetry;
  const capWith = <T,>(kind: ContextEntityKind, entities: T[], toLine: (e: T) => string, max: number): string[] => {
    if (!telemetry) return cap(entities.map(toLine), max);
    const withheld = Math.max(0, entities.length - max);
    if (withheld > 0) telemetry.recordTruncation(kind, withheld, max);
    return cap(entities.map(toLine), max);
  };
  const pinLocs = new Set(options?.locationIds || []);
  const pinNpcs = new Set([...(options?.npcIds || []), ...centralNpcIds]);
  // Factions pinned when they hold a pinned territory or member NPC.
  const pinFactions = new Set<string>();
  for (const f of wb.factions ?? []) {
    if ((f.territoryIds || []).some((t) => pinLocs.has(t))) pinFactions.add(f.id);
  }
  for (const n of wb.npcs ?? []) {
    if (pinNpcs.has(n.id) && n.factionId) pinFactions.add(n.factionId);
  }

  const npcName = new Map<string, string>();
  for (const n of wb.npcs ?? []) npcName.set(n.id, n.name);

  const factions = takeRanked(
    wb.factions ?? [],
    (f) =>
      `${f.name} — ${f.alignment}. Goals: ${f.publicGoals}${
        f.secretAgendas ? ` | Hidden agenda: ${f.secretAgendas}` : ''
      }`,
    caps.factions,
    pinFactions,
    telemetry
      ? (dropped) => {
          telemetry.recordTruncation('faction', dropped.length, caps.factions);
          dropped.forEach((f) =>
            telemetry.recordExcluded(
              'faction',
              f.id,
              f.name,
              `token cap: ${caps.factions} of ${(wb.factions ?? []).length} factions injected at ${scopeTier} tier`
            )
          );
        }
      : undefined
  );

  const facName = new Map<string, string>();
  for (const f of wb.factions ?? []) facName.set(f.id, f.name);
  const factionRelations = capWith(
    'factionRelation',
    wb.factionRelations ?? [],
    (r) => {
      const meta = FACTION_RELATION_META[r.value];
      const a = facName.get(r.sourceFactionId) ?? r.sourceFactionId;
      const b = facName.get(r.targetFactionId) ?? r.targetFactionId;
      return `${a} ↔ ${b}: ${r.value} (${meta?.labelFa || r.value})${r.note ? ` — ${r.note}` : ''}`;
    },
    caps.factionRelations
  );

  const timeline = capWith(
    'timeline',
    (wb.timeline ?? []).slice().sort((a, b) => {
      const ar = a.eraCategory === 'recent' || a.eraCategory === 'present' ? 0 : 1;
      const br = b.eraCategory === 'recent' || b.eraCategory === 'present' ? 0 : 1;
      return ar - br;
    }),
    (t) => `${t.yearOrEra}: ${t.title} — ${t.summary}${t.significance ? ` (${t.significance})` : ''}`,
    caps.timeline
  );

  const artifacts = capWith(
    'artifact',
    wb.artifacts ?? [],
    (a) =>
      `${a.name} (${a.rarity}) — powers: ${a.powers.join(', ') || 'unknown'}; held by ${a.currentHolderType} ${a.currentHolderId}`,
    caps.artifacts
  );

  const bestiary = capWith(
    'bestiary',
    wb.bestiary ?? [],
    (c) => {
      const descSnippet = c.loreDescription
        ? ` — Description: ${c.loreDescription.replace(/\s+/g, ' ').slice(0, 160)}...`
        : '';
      const idTag = c.id ? ` [ID: ${c.id}]` : '';
      return `${c.name}${idTag} (danger ${c.dangerLevel}, ${c.speciesCategory}${c.isDomesticated ? ', domesticated' : ''})${descSnippet} | habitat: ${
        c.habitatLocationIds?.join('/') || 'unknown'
      } | weakness: ${c.weaknesses?.join(', ') || 'unknown'}`;
    },
    caps.bestiary
  );

  const religions = capWith(
    'religion',
    wb.religions ?? [],
    (d) =>
      `${d.name}, ${d.title} — domain: ${d.domain}. Dogma: ${d.coreDogma}${
        d.taboos?.length ? ` | Taboos: ${d.taboos.join(', ')}` : ''
      }`,
    caps.religions
  );

  const dramaBonds = capWith(
    'dramaBond',
    (wb.dramaBonds ?? []).filter((b) => b.isPublic),
    (b) => {
      const src = npcName.get(b.sourceNpcId) ?? b.sourceNpcId;
      const tgt = npcName.get(b.targetNpcId) ?? b.targetNpcId;
      return `${src} ↔ ${tgt} (affinity ${b.affinity})`;
    },
    caps.dramaBonds
  );

  const locations = takeRanked(
    wb.locations ?? [],
    (l) => {
      const ancestry = getLocationAncestry(wb.locations ?? [], l.id);
      const hierarchyPath = ancestry.length > 0
        ? `inside: ${ancestry.map((a) => a.name).join(' ⊂ ')}`
        : l.region || 'unknown region';
      return `${l.name} (${hierarchyPath}, danger ${l.dangerLevel}${
        l.category ? `, ${l.category}` : ''
      }) — ${l.description}`;
    },
    caps.locations,
    pinLocs,
    telemetry
      ? (dropped) => {
          telemetry.recordTruncation('location', dropped.length, caps.locations);
          dropped.forEach((l) =>
            telemetry.recordExcluded(
              'location',
              l.id,
              l.name,
              `token cap: ${caps.locations} of ${(wb.locations ?? []).length} locations injected at ${scopeTier} tier`
            )
          );
        }
      : undefined
  );

  const npcs = takeRanked(
    wb.npcs ?? [],
    (n) => {
      const kindPrefix = n.kind === 'template' ? '[GROUP ARCHETYPE] ' : '';
      const combatStr = formatNpcCombatSummary(n);
      const combatSuffix = combatStr ? ` | combat: ${combatStr}` : '';
      const hiddenSecrets = GameEngine.describeHiddenSecrets(n);
      const secretsSuffix = hiddenSecrets ? ` | secrets: ${hiddenSecrets}` : '';
      const ov = overrides[n.id];
      if (!ov) {
        return `${kindPrefix}${n.name} (${n.role || 'unknown role'}) — ${n.title || ''}; goals: ${
          n.goals.join(', ') || 'unknown'
        }${combatSuffix}${secretsSuffix}`;
      }
      const roleStr = ov.storyRole ? `Story Role: ${ov.storyRole}` : (n.role || 'unknown role');
      const relStr = ov.relationshipToProtagonist ? ` | Relation to Protagonist: ${ov.relationshipToProtagonist}` : '';
      const goalStr = ov.storyGoal ? ` | Story Goal: ${ov.storyGoal}` : (n.goals?.length ? ` | goals: ${n.goals.join(', ')}` : '');
      const secretStr = ov.storySecret ? ` | Secret: ${ov.storySecret}` : '';
      const chEntrance = ov.firstAppearanceChapter !== undefined ? ` | First Appears: Chapter ${ov.firstAppearanceChapter}` : '';
      return `${kindPrefix}${n.name} [${roleStr}] — ${n.title || ''}${relStr}${goalStr}${secretStr}${chEntrance}${combatSuffix}${secretsSuffix}`;
    },
    caps.npcs,
    pinNpcs,
    telemetry
      ? (dropped) => {
          telemetry.recordTruncation('npc', dropped.length, caps.npcs);
          dropped.forEach((n) =>
            telemetry.recordExcluded(
              'npc',
              n.id,
              n.name,
              `token cap: ${caps.npcs} of ${(wb.npcs ?? []).length} NPCs injected at ${scopeTier} tier`
            )
          );
        }
      : undefined
  );

  const laws = cap(
    (wb.laws ?? []).map((law) => `${law.rule} (${law.category}) — ${law.description}`),
    caps.laws
  );

  const ontologyLines: string[] = [];
  if (wb.ontology?.placeCategories?.length) {
    ontologyLines.push(`Place categories: ${wb.ontology.placeCategories.map((p) => p.name).join(', ')}.`);
  }
  if (wb.ontology?.lawCategories?.length) {
    ontologyLines.push(`Law categories: ${wb.ontology.lawCategories.map((l) => l.name).join(', ')}.`);
  }
  if (wb.ontology?.npcRoles?.length) {
    ontologyLines.push(`Character roles: ${wb.ontology.npcRoles.map((r) => r.name).join(', ')}.`);
  }
  if (wb.ontology?.domains?.length) {
    ontologyLines.push(`Domains of gods: ${wb.ontology.domains.map((d) => d.name).join(', ')}.`);
  }
  if (wb.ontology?.relationTypes?.length) {
    ontologyLines.push(`Relation types: ${wb.ontology.relationTypes.map((r) => r.name).join(', ')}.`);
  }
  const ontologySummary = ontologyLines.length ? ontologyLines.join(' ') : undefined;

  const quests = (wb.quests ?? []).map((q) => {
    const giver = npcName.get(q.giverNpcId ?? '') ?? q.giverNpcId;
    const objs = q.objectives.map((o) => o.description).join('; ');
    const trust = q.rewards?.trustRewards?.map((tr) => `+${tr.trustDelta} trust with ${npcName.get(tr.npcId) ?? tr.npcId}`).join(', ');
    return `"${q.title}" (${q.category}${giver ? `, giver: ${giver}` : ''}): objectives [${objs}]${trust ? ` -> ${trust}` : ''}`;
  });

  // Plan 15 (Bug 2): in scoped (play-time) mode, name caravan individuals only when
  // physically present at the scene location, in the accompanying party, or explicitly
  // listed in scene NPCs. NPCs stationed at connected 1-hop locations must not leak into
  // the caravan retinue string. Studio/unconstrained mode keeps the full legacy listing.
  const sceneLocs = new Set(effectiveOptions?.locationIds ?? []);
  const accompanying = new Set(effectiveOptions?.accompanyingNpcIds ?? []);
  const explicitNpcs = new Set(effectiveOptions?.npcIds ?? []);
  const scopedPresent =
    effectiveOptions && !effectiveOptions.unconstrained
      ? new Set(
          (wb.npcs ?? [])
            .filter(
              (n) =>
                sceneLocs.has(n.currentLocationId) ||
                accompanying.has(n.id) ||
                explicitNpcs.has(n.id)
            )
            .map((n) => n.id)
        )
      : undefined;
  // Plan 15 Phase 4 (Bug 2 visibility): retinue names withheld from route lines
  // are exclusions with a reason too. Names resolve against the ORIGINAL
  // World Bible — the pruned copy has already dropped these NPCs, which is
  // exactly why they vanish from the line.
  if (telemetry && scopedPresent) {
    const seenRetinue = new Set<string>();
    for (const r of wb.tradeRoutes ?? []) {
      for (const id of [r.caravanMasterNpcId, ...(r.travelingNpcIds ?? [])]) {
        if (!id || scopedPresent.has(id) || seenRetinue.has(id)) continue;
        seenRetinue.add(id);
        const canonicalName = (story.worldBible?.npcs ?? []).find((n) => n.id === id)?.name;
        telemetry.recordExcluded(
          'npc',
          id,
          canonicalName,
          `retinue of caravan "${r.name}" withheld — not physically at the scene location`
        );
      }
    }
  }
  const tradeRoutes = (wb.tradeRoutes ?? []).map((r) => formatTradeRouteLine(r, wb, scopedPresent));

  return {
    storyScale: story.storyScale,
    worldSummary: wb.summary || undefined,
    themeNotes: wb.themeNotes || undefined,
    authoredSystemPrompt: wb.aiSystemPrompt || undefined,
    factions,
    factionRelations,
    timeline,
    artifacts,
    bestiary,
    religions,
    dramaBonds,
    locations,
    npcs,
    laws,
    ontologySummary,
    quests,
    tradeRoutes,
  };
}

/**
 * Renders the compressed world-context blocks into a compact, labeled string
 * suitable for injecting into AI generation prompts. Skips empty sections.
 */
export function formatWorldContext(blocks: WorldContextBlocks): string {
  const sections: string[] = [];
  if (blocks.storyScale) sections.push(`Story Canvas Scope: ${blocks.storyScale.toUpperCase()}`);
  if (blocks.worldSummary) sections.push(`World Summary: ${blocks.worldSummary}`);
  if (blocks.themeNotes) sections.push(`Theme Notes: ${blocks.themeNotes}`);
  if (blocks.authoredSystemPrompt) sections.push(`Author's Directive: ${blocks.authoredSystemPrompt}`);
  if (blocks.factions.length) sections.push(`Factions:\n- ${blocks.factions.join('\n- ')}`);
  if (blocks.factionRelations.length) sections.push(`Faction Relations (allied/favorable/neutral/rival/hostile):\n- ${blocks.factionRelations.join('\n- ')}`);
  if (blocks.timeline.length) sections.push(`Timeline:\n- ${blocks.timeline.join('\n- ')}`);
  if (blocks.artifacts.length) sections.push(`Artifacts:\n- ${blocks.artifacts.join('\n- ')}`);
  if (blocks.bestiary.length) sections.push(`Bestiary:\n- ${blocks.bestiary.join('\n- ')}`);
  if (blocks.religions.length) sections.push(`Religions/Deities:\n- ${blocks.religions.join('\n- ')}`);
  if (blocks.dramaBonds.length) sections.push(`Drama Bonds:\n- ${blocks.dramaBonds.join('\n- ')}`);
  if (blocks.locations.length) sections.push(`Places/Locations:\n- ${blocks.locations.join('\n- ')}`);
  if (blocks.npcs.length) sections.push(`NPCs:\n- ${blocks.npcs.join('\n- ')}`);
  if (blocks.laws.length) sections.push(`World Laws:\n- ${blocks.laws.join('\n- ')}`);
  if (blocks.quests?.length) sections.push(`World Quests & Deeds of Trust:\n- ${blocks.quests.join('\n- ')}`);
  if (blocks.tradeRoutes?.length) sections.push(`Commercial Arteries & Trade Routes:\n- ${blocks.tradeRoutes.join('\n- ')}`);
  if (blocks.ontologySummary) sections.push(blocks.ontologySummary);
  return sections.join('\n\n');
}

/** Convenience: build the context blocks and format them in one call. */
export function buildWorldContextString(story: {
  worldBible?: WorldBible | null;
  storyNpcOverrides?: Record<string, StoryNpcOverride>;
  storyScale?: StoryScale;
}): string {
  return formatWorldContext(buildWorldContextBlocks(story));
}

/**
 * Plan 07 — Living World State Ledger renderer (Tier 3).
 * Produces dense one-liner strings, e.g.:
 *   `Faction Syndicate: +25 (allied)`, `NPC Vael: dead — slain at the breach`
 */
export function formatLivingWorldLedger(ledger?: WorldStateLedger | null): string[] {
  if (!ledger) return [];
  const lines: string[] = [];

  for (const f of ledger.factionReputations ?? []) {
    const name = f.factionName || f.factionId;
    lines.push(
      `Faction ${name}: ${f.score >= 0 ? '+' : ''}${f.score} (${f.stance})${f.note ? ` — ${f.note}` : ''}`
    );
  }
  for (const n of ledger.npcStatuses ?? []) {
    const name = n.npcName || n.npcId;
    lines.push(`NPC ${name}: ${n.status}${n.note ? ` — ${n.note}` : ''}`);
  }
  for (const i of ledger.keyItems ?? []) {
    lines.push(
      `Item ${i.name}${i.isStoryCritical ? ' [STORY-CRITICAL]' : ''}${
        i.acquiredChapterNumber ? ` (acquired Ch${i.acquiredChapterNumber})` : ''
      }${i.description ? ` — ${i.description}` : ''}`
    );
  }
  if (ledger.openPlotThreads?.length) {
    lines.push(`Open plot threads: ${ledger.openPlotThreads.join(' | ')}`);
  }
  return lines;
}

/**
 * Plan 07 — Chapter-scoped context envelope for long-form saga play.
 * Injects ONLY the relevant slice of world lore for the active chapter scope
 * and scene locations, followed by the episodic chapter rollups and the
 * living-world ledger.
 */
export function buildChapterContextString(
  story: {
    worldBible?: WorldBible | null;
    storyNpcOverrides?: Record<string, StoryNpcOverride>;
    storyScale?: StoryScale;
  },
  chapter: Pick<StoryChapter, 'scopeTier' | 'scenes'> & { chapterNumber?: number },
  ledger?: WorldStateLedger | null
): string {
  const locationIds = Array.from(
    new Set((chapter.scenes ?? []).map((s) => s.locationId).filter(Boolean))
  );

  const blocks = buildWorldContextBlocks(story, {
    scopeTier: chapter.scopeTier,
    locationIds,
    currentChapterNumber: chapter.chapterNumber,
  });
  const sections: string[] = [formatWorldContext(blocks)];

  if (ledger?.chapterSummaries?.length) {
    const rollups = [...ledger.chapterSummaries]
      .sort((a, b) => a.chapterNumber - b.chapterNumber)
      .map(
        (c) =>
          `- Ch${c.chapterNumber} «${c.title}»: ${c.summary}${
            c.irreversibleChoices.length ? ` | Irreversible: ${c.irreversibleChoices.join('; ')}` : ''
          }`
      );
    sections.push(`Episodic Milestone Rollup:\n${rollups.join('\n')}`);
  }

  const ledgerLines = formatLivingWorldLedger(ledger);
  if (ledgerLines.length) {
    sections.push(`Living World Ledger:\n- ${ledgerLines.join('\n- ')}`);
  }

  return sections.filter(Boolean).join('\n\n');
}
