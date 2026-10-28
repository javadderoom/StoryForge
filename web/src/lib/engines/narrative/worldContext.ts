import {
  WorldBible,
  ScopeTier,
  StoryChapter,
  WorldStateLedger,
  FACTION_RELATION_META,
  getLocationAncestry,
  NPCDossier,
} from '@/lib/types/world';
import { formatTradeRouteLine } from '@/lib/engines/world/tradeRoutes';
import { StoryNpcOverride, StoryScale } from '@/lib/types/story';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import {
  formatNpcCombatSummary,
  formatEquippedItemsForContext,
  formatAbilitiesForContext,
  formatTraitsForContext,
  formatItemInteractionsCatalogForContext,
} from './context/characterContextFormatters';
import {
  ScopedContextOptions,
  ContextEntityKind,
  ContextEntityRecord,
  ContextTelemetry,
  createContextTelemetry,
  takeRanked,
  normalizeScopeTier,
  passesFactionTierGate,
  resolveAccompanyingIds,
  pruneWorldBibleToScope,
  SCOPE_CAPS,
  STUDIO_CAPS,
  cap,
} from './context/worldContextScoping';

// Re-export all character context formatters and scoping helpers for 100% backward compatibility
export {
  formatNpcCombatSummary,
  formatEquippedItemsForContext,
  formatAbilitiesForContext,
  formatTraitsForContext,
  formatItemInteractionsCatalogForContext,
};

export type {
  ScopedContextOptions,
  ContextEntityKind,
  ContextEntityRecord,
  ContextTelemetry,
};

export {
  createContextTelemetry,
  normalizeScopeTier,
  resolveAccompanyingIds,
  pruneWorldBibleToScope,
};

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
      const habitats = (c.habitatLocationIds ?? [])
        .map((h) => (wb.locations ?? []).find((l) => l.id === h)?.name || h)
        .join('/');
      return `${c.name}${idTag} (danger ${c.dangerLevel}, ${c.speciesCategory}${c.isDomesticated ? ', domesticated' : ''})${descSnippet} | habitat: ${
        habitats || 'unknown'
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
      const linkedTerrains = (wb.mapData?.terrainFeatures ?? []).filter((f) => f.locationId === l.id);
      const terrainSnippet = linkedTerrains.length > 0
        ? ` [Cartographic Terrain: ${linkedTerrains.map((t) => t.type.replace(/_/g, ' ')).join(', ')}]`
        : '';
      return `${l.name} (${hierarchyPath}, danger ${l.dangerLevel}${
        l.category ? `, ${l.category}` : ''
      }${terrainSnippet}) — ${l.description}`;
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
