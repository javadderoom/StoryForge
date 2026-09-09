import { WorldBible, ScopeTier, StoryChapter, WorldStateLedger, FACTION_RELATION_META, getLocationAncestry, NPCDossier } from '@/lib/types/world';
import { StoryNpcOverride, StoryScale } from '@/lib/types/story';
import { GameEngine } from '@/lib/engines/game/GameEngine';

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
  street: { factions: 3, factionRelations: 4, timeline: 4, artifacts: 4, bestiary: 4, religions: 3, dramaBonds: 4, locations: 4, npcs: 6, laws: 10 },
  regional: { factions: 6, factionRelations: 8, timeline: 8, artifacts: 8, bestiary: 8, religions: 6, dramaBonds: 6, locations: 8, npcs: 9, laws: 10 },
  continental: { factions: 10, factionRelations: 10, timeline: 10, artifacts: 10, bestiary: 10, religions: 9, dramaBonds: 7, locations: 10, npcs: 12, laws: 10 },
  mythic: { factions: 10, factionRelations: 12, timeline: 12, artifacts: 12, bestiary: 12, religions: 12, dramaBonds: 8, locations: 12, npcs: 12, laws: 10 },
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

/**
 * Relevance-ranked take: pinned ids first (active location/NPCs can never be
 * truncated out), then the rest in insertion order. Replaces blind slice.
 */
function takeRanked<T extends { id?: string }>(
  entities: T[],
  toLine: (e: T) => string,
  max: number,
  pinIds: Set<string> = new Set()
): string[] {
  if (entities.length <= max) return entities.map(toLine);
  const pinned = entities.filter((e) => e.id && pinIds.has(e.id));
  const rest = entities.filter((e) => !e.id || !pinIds.has(e.id));
  return [...pinned, ...rest].slice(0, max).map(toLine);
}

const TIER_RANK: Record<ScopeTier, number> = { street: 0, regional: 1, continental: 2, mythic: 3 };

/**
 * A faction with an explicit scope only surfaces once the active chapter's
 * tier has escalated to it. Unscoped factions are always relevant.
 */
const passesFactionTierGate = (scope: ScopeTier | undefined, current: ScopeTier): boolean =>
  !scope || TIER_RANK[scope] <= TIER_RANK[current];

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
  const { scopeTier = 'mythic', locationIds = [], npcIds = [], currentChapterNumber } = options;

  // 1-hop neighborhood of the active locations (travel-adjacent context) + full ancestry hierarchy.
  const activeLocSet = new Set(locationIds);
  for (const locId of locationIds) {
    const loc = (wb.locations ?? []).find((l) => l.id === locId);
    loc?.connectedLocationIds?.forEach((id) => activeLocSet.add(id));
    const ancestors = getLocationAncestry(wb.locations ?? [], locId);
    ancestors.forEach((a) => activeLocSet.add(a.id));
  }
  const activeNpcSet = new Set(npcIds);

  const keepNpcs = (wb.npcs ?? []).filter((n) => {
    if (activeNpcSet.has(n.id)) return true;
    if (currentChapterNumber !== undefined) {
      const ov = storyNpcOverrides?.[n.id];
      if (ov?.firstAppearanceChapter !== undefined && ov.firstAppearanceChapter > currentChapterNumber) {
        return false;
      }
    }
    if (activeLocSet.has(n.currentLocationId)) return true;
    if (n.applicableLocationIds && n.applicableLocationIds.some((locId) => activeLocSet.has(locId))) {
      return true;
    }
    return false;
  });
  const keptNpcIds = new Set(keepNpcs.map((n) => n.id));

  const keepFactions = (wb.factions ?? []).filter(
    (f) =>
      passesFactionTierGate(f.scope, scopeTier) &&
      (f.territoryIds.some((t) => activeLocSet.has(t)) ||
        keepNpcs.some((n) => n.factionId && n.factionId === f.id))
  );
  const keptFactionIds = new Set(keepFactions.map((f) => f.id));

  // Continental/mythic scopes widen the aperture to kingdom-level politics,
  // religions, and artifacts even if not directly anchored to the scene —
  // but still respect faction scope gating (a mythic dominion stays hidden
  // until the chapter reaches mythic tier).
  const isHighScope = scopeTier === 'continental' || scopeTier === 'mythic';
  if (isHighScope) {
    const gatedAll = (wb.factions ?? []).filter((f) => passesFactionTierGate(f.scope, scopeTier));
    keptFactionIds.clear();
    gatedAll.forEach((f) => keptFactionIds.add(f.id));
    keepFactions.length = 0;
    keepFactions.push(...gatedAll);
  }

  const keepLocations =
    scopeTier === 'mythic'
      ? wb.locations ?? []
      : (wb.locations ?? []).filter(
          (l) => activeLocSet.has(l.id) || l.connectedLocationIds?.some((id) => activeLocSet.has(id))
        );
  const keptLocationIds = new Set(keepLocations.map((l) => l.id));

  const keepBestiary = (wb.bestiary ?? []).filter(
    (c) =>
      c.habitatLocationIds.length === 0 ||
      c.habitatLocationIds.some((h) => keptLocationIds.has(h))
  );

  const keepArtifacts = (wb.artifacts ?? []).filter((a) => {
    switch (a.currentHolderType) {
      case 'npc':
        return (
          keptNpcIds.has(a.currentHolderId) ||
          (isHighScope && (wb.npcs ?? []).some((n) => n.id === a.currentHolderId))
        );
      case 'location':
        return keptLocationIds.has(a.currentHolderId);
      case 'faction':
        return keptFactionIds.has(a.currentHolderId);
      default:
        return isHighScope;
    }
  });

  const keepReligions = (wb.religions ?? []).filter(
    (d) =>
      d.holyLocationIds.some((h) => keptLocationIds.has(h)) ||
      d.affiliatedFactionIds.some((f) => keptFactionIds.has(f))
  );

  const keepDramaBonds = (wb.dramaBonds ?? []).filter(
    (b) => keptNpcIds.has(b.sourceNpcId) || keptNpcIds.has(b.targetNpcId)
  );

  const keepFactionRelations = (wb.factionRelations ?? []).filter(
    (r) => keptFactionIds.has(r.sourceFactionId) || keptFactionIds.has(r.targetFactionId)
  );

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
  const scopeTier: ScopeTier = options?.scopeTier ?? 'mythic';
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
  const caps = isStudioMode ? STUDIO_CAPS : SCOPE_CAPS[scopeTier];
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
    pinFactions
  );

  const facName = new Map<string, string>();
  for (const f of wb.factions ?? []) facName.set(f.id, f.name);
  const factionRelations = cap(
    (wb.factionRelations ?? []).map((r) => {
      const meta = FACTION_RELATION_META[r.value];
      const a = facName.get(r.sourceFactionId) ?? r.sourceFactionId;
      const b = facName.get(r.targetFactionId) ?? r.targetFactionId;
      return `${a} ↔ ${b}: ${r.value} (${meta?.labelFa || r.value})${r.note ? ` — ${r.note}` : ''}`;
    }),
    caps.factionRelations
  );

  const timeline = cap(
    (wb.timeline ?? [])
      .slice()
      .sort((a, b) => {
        const ar = a.eraCategory === 'recent' || a.eraCategory === 'present' ? 0 : 1;
        const br = b.eraCategory === 'recent' || b.eraCategory === 'present' ? 0 : 1;
        return ar - br;
      })
      .map((t) => `${t.yearOrEra}: ${t.title} — ${t.summary}${t.significance ? ` (${t.significance})` : ''}`),
    caps.timeline
  );

  const artifacts = cap(
    (wb.artifacts ?? []).map(
      (a) =>
        `${a.name} (${a.rarity}) — powers: ${a.powers.join(', ') || 'unknown'}; held by ${a.currentHolderType} ${a.currentHolderId}`
    ),
    caps.artifacts
  );

  const bestiary = cap(
    (wb.bestiary ?? []).map(
      (c) =>
        `${c.name} (danger ${c.dangerLevel}, ${c.speciesCategory}${c.isDomesticated ? ', domesticated' : ''}) — habitat: ${
          c.habitatLocationIds.join('/') || 'unknown'
        } | weakness: ${c.weaknesses.join(', ') || 'unknown'}`
    ),
    caps.bestiary
  );

  const religions = cap(
    (wb.religions ?? []).map(
      (d) =>
        `${d.name}, ${d.title} — domain: ${d.domain}. Dogma: ${d.coreDogma}${
          d.taboos?.length ? ` | Taboos: ${d.taboos.join(', ')}` : ''
        }`
    ),
    caps.religions
  );

  const dramaBonds = cap(
    (wb.dramaBonds ?? [])
      .filter((b) => b.isPublic)
      .map((b) => {
        const src = npcName.get(b.sourceNpcId) ?? b.sourceNpcId;
        const tgt = npcName.get(b.targetNpcId) ?? b.targetNpcId;
        return `${src} ↔ ${tgt} (affinity ${b.affinity})`;
      }),
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
    pinLocs
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
    pinNpcs
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
