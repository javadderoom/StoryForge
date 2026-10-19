import { PromptAssembler } from './PromptAssembler';
import { validateProse, buildProseRepairInstruction, ProseFinding } from './ProseValidator';
import { buildWorldContextBlocks, resolveAccompanyingIds, formatNpcCombatSummary, formatEquippedItemsForContext, formatAbilitiesForContext, formatTraitsForContext, formatItemInteractionsCatalogForContext } from './worldContext';
import { getActiveNpcsForLocation } from '@/lib/engines/world/tradeRoutes';
import { travelProgress, travelTimeline, type TravelProgress } from '@/lib/engines/game/travelEngine';
import type { DeclaredNpcTrustChange } from '@/lib/engines/game/npcTrustEngine';
import type { DeclaredClockChange } from '@/lib/engines/game/threatClock';
import { MemoryEngine } from '@/lib/engines/memory/MemoryEngine';
import { WorkingContextEnvelope, MemoryCategory, MemoryEntry } from '@/lib/types/memory';
import { PlayerState, CheckResolution, PlayerConditionChanges } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { RawSceneResult } from './modelCall';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import { evaluateNarrativeMomentum, MomentumEvaluationInput } from './momentumGuardrail';

/**
 * Plan 14 — the shared narrative turn core.
 *
 * This module owns everything between "state is resolved" and "a validated scene
 * exists": context-envelope assembly, prompt building, the (injectable) model
 * call, post-generation prose validation with up to two auto-repair attempts, and the
 * final secret-leak sanitization pass. Both `POST /api/play/action` and the
 * evaluation harness call into it, guaranteeing the evals exercise the exact
 * production path rather than a copy.
 *
 * Auth, credits, session loading, `ActionValidator`, `GameEngine`, and
 * persistence deliberately remain in the route.
 */

export interface SceneSessionTurn {
  turnNumber?: number;
  sceneId?: string;
  narrativeProse?: string;
  playerActionText?: string;
  actionStyle?: string;
  presentedChoices?: any[];
}

export interface SceneSessionMemory {
  category: string;
  importance?: number;
  summary: string;
  detail?: string | null;
  turnNumber?: number;
  sceneId?: string | null;
  entityIds?: string[];
  tags?: string[];
}

export interface SceneTurnInput {
  /** Migrated story manifest (title, language, worldBible, rpgSystem, saga, beats…). */
  story: any;
  /** Player state AFTER this turn's deterministic mutations. */
  playerState: PlayerState;
  /** The resolved deterministic check for this turn. */
  resolution: CheckResolution;
  /** The player's raw action text for this turn. */
  playerActionText: string;
  /** Living World State Ledger AFTER this turn's merge. */
  ledger: WorldStateLedger;
  sessionTurns?: SceneSessionTurn[];
  sessionMemories?: SceneSessionMemory[];
  /** Authored beat to present verbatim when present (Plan 12 hybrid reader). */
  targetSceneId?: string;
  /** Active saga chapter, already resolved by the caller. */
  activeChapter?: any | null;
  /** Hazard displacement target for this turn, if any. */
  displacedLocationId?: string;
  /** Location the player occupied before this turn (for displacement prose). */
  previousLocationId?: string;
  /** Override minimum word count floor (defaults to DEFAULT_MIN_SCENE_WORDS). */
  minWordCount?: number;
  /** Explicit continuity correction directive for scene remakes. */
  remakeDirective?: string;
  /** Explicitly toggle choice-only regeneration (defaults to true in non-test env). */
  allowChoiceRepair?: boolean;
  /** Plan 17: absolute turn number — journey math derives from it (never stored). */
  turnNumber?: number;
  /** Plan 17: the journey reached its destination this turn (arrival scene). */
  travelArrival?: { locationId: string; name: string };
}

export interface SceneAiResponse {
  narrative: string;
  choices: any[];
  extractedMemories: any[];
  encounteredCreatureId?: string;
  /** Plan 17: writer-declared condition lifecycle, normalized (evidence-checked downstream). */
  playerConditionChanges?: PlayerConditionChanges;
  /** Plan 17: writer-declared NPC stance shifts, normalized (evidence-checked downstream). */
  npcTrustChanges?: DeclaredNpcTrustChange[];
  /** Plan 13 follow-up: writer-declared tension-clock movement, normalized. */
  clockChanges?: DeclaredClockChange[];
  isMock?: boolean;
}

export interface SceneGenerationOutcome {
  status: 'ok' | 'mock_unavailable' | 'prose_invalid';
  aiResponse: SceneAiResponse;
  proseFindings: ProseFinding[];
  proseRepaired: boolean;
  /**
   * Findings from the FIRST draft evaluation, snapshotted BEFORE any repair
   * call — "what the writer got wrong on attempt zero". Shadow-AOT audit
   * telemetry (Plan 15 §7.6E); callers that ignore it behave identically.
   */
  firstPassFindings: ProseFinding[];
  /** Repair calls actually spent on this scene (0 = the first draft passed). */
  repairAttempts: number;
  /** True when choices were regenerated because initial choices were invalid/dropped. */
  choicesRepaired?: boolean;
  /** True when authored prose/choices were served instead of a model call. */
  usedAuthoredBeat: boolean;
  /** Raw model payload — the eval seam's capture point (null for authored beats). */
  raw: RawSceneResult | null;
  /** Distinguishes an unrepairable canon violation from an offline repair attempt. */
  proseInvalidReason?: 'repair_unavailable' | 'unrepairable';
}

/**
 * Renders the deterministic mechanical cost of this turn as a short,
 * narrator-facing line (e.g. "HP -5, stamina -10, trust -15").
 * The narrator MUST depict every listed cost in the prose — this is what
 * keeps mixed_success from reading as a clean victory.
 */
export function formatOutcomeCost(resolution: CheckResolution, language: string): string | undefined {
  const parts: string[] = [];
  const isFa = language === 'fa';
  const diff = resolution.stateDiff || ({} as CheckResolution['stateDiff']);

  for (const [id, delta] of Object.entries(diff.resourceChanges || {})) {
    if (typeof delta !== 'number' || delta === 0) continue;
    const sign = delta > 0 ? '+' : '';
    parts.push(isFa ? `${id} ${sign}${delta}` : `${id} ${sign}${delta}`);
  }
  for (const [id, delta] of Object.entries(diff.purseChanges || {})) {
    if (typeof delta !== 'number' || delta === 0) continue;
    const sign = delta > 0 ? '+' : '';
    parts.push(isFa ? `سکه ${id} ${sign}${delta}` : `${id} ${sign}${delta}`);
  }
  for (const [npcId, rel] of Object.entries(diff.relationshipChanges || {})) {
    if (!rel || typeof rel.trustDelta !== 'number' || rel.trustDelta === 0) continue;
    const sign = rel.trustDelta > 0 ? '+' : '';
    parts.push(isFa ? `اعتماد ${npcId} ${sign}${rel.trustDelta}` : `trust(${npcId}) ${sign}${rel.trustDelta}`);
  }
  if (diff.itemsRemovedIds?.length) {
    parts.push(isFa ? `از دست رفتن: ${diff.itemsRemovedIds.length} آیتم` : `lost items: ${diff.itemsRemovedIds.length}`);
  }
  if (diff.itemsAdded?.length) {
    parts.push(isFa ? `به دست آمدن: ${diff.itemsAdded.length} آیتم` : `gained items: ${diff.itemsAdded.length}`);
  }
  if (resolution.clockUpdate) {
    parts.push(
      isFa
        ? `ساعت تهدید +${resolution.clockUpdate.newSegments}/${resolution.clockUpdate.maxSegments}`
        : `threat clock ${resolution.clockUpdate.newSegments}/${resolution.clockUpdate.maxSegments}`
    );
  }
  if (resolution.displacedLocationId || diff.displacedLocationId) {
    parts.push(isFa ? 'جابجایی ناخواسته به منطقه پرخطر' : 'hurled into a hazard zone');
  }
  if (!parts.length) return undefined;
  return isFa ? `هزینه قطعی این نوبت: ${parts.join('، ')}.` : `Certain cost this turn: ${parts.join(', ')}.`;
}

export function formatNpcAppearance(npc: any): string | undefined {
  if (!npc.appearance) return undefined;
  if (typeof npc.appearance === 'string') return npc.appearance;
  const parts: string[] = [];
  if (npc.appearance.physicalBuild) parts.push(`قامت و اندام: ${npc.appearance.physicalBuild}`);
  if (npc.appearance.faceAndGaze) parts.push(`سیما و نگاه: ${npc.appearance.faceAndGaze}`);
  if (npc.appearance.attire) parts.push(`پوشش و ابزار: ${npc.appearance.attire}`);
  if (npc.appearance.mannerisms) parts.push(`زبان بدن و حرکات: ${npc.appearance.mannerisms}`);
  return parts.length ? parts.join(' • ') : undefined;
}

/**
 * Builds the `WorkingContextEnvelope` fed to `PromptAssembler`. Pure aside from
 * `MemoryEngine` retrieval, which is deterministic over its inputs.
 */
export function assembleSceneEnvelope(input: SceneTurnInput): WorkingContextEnvelope {
  const { story, playerState, resolution, ledger, activeChapter } = input;
  const sessionTurns = input.sessionTurns ?? [];
  const sessionMemories = input.sessionMemories ?? [];

  const currentLocationId = playerState.currentLocationId;

  const currentLocation =
    story.worldBible.locations.find((l: any) => l.id === currentLocationId) ||
    story.worldBible.locations[0] || {
      id: 'loc_default',
      name: 'Citadel',
      description: 'Dark fortress',
    };

  // Plan 15 (Bug 3): party companions travel with the player even when
  // their home location is elsewhere — pull them into the active set.
  const accompanyingIds = resolveAccompanyingIds(playerState, ledger);
  const { activeNpcs: locationNpcs, caravanAffiliationByNpcId } =
    getActiveNpcsForLocation(
      currentLocationId,
      story.worldBible,
      story.language === 'fa' ? 'fa' : 'en'
    );
  const activeNPCs = [...locationNpcs];
  for (const companionId of accompanyingIds) {
    if (activeNPCs.some((n) => n.id === companionId)) continue;
    const companion = (story.worldBible.npcs ?? []).find((n: any) => n.id === companionId);
    if (companion) activeNPCs.push(companion);
  }
  const activeNpcIds = activeNPCs.map((n) => n.id);

  const activeTravel = playerState.travel ?? null;
  const travelDerived: TravelProgress | null = activeTravel
    ? typeof input.turnNumber === 'number'
      ? travelProgress(activeTravel, input.turnNumber)
      : {
          legsElapsed: 0,
          turnsRemaining: activeTravel.totalTurns,
          nodeIndex: 0,
          arrived: false,
          arriving: false,
          dayOnRoad: 1,
        }
    : null;

  // Plan 17 (§4.5): while a journey is active, the scene corridor is the road —
  // the current stop plus up to two stops ahead, with the destination pulled
  // into scope only on the final leg. Memory retrieval stays anchored to the
  // current node, and destination NPCs never become scene-present before
  // arrival (presence still resolves from the current node below).
  const corridorLocationIds: string[] = (() => {
    if (!activeTravel || !travelDerived) return [currentLocationId];
    const timeline = travelTimeline(activeTravel);
    const nodeIndex = Math.min(travelDerived.nodeIndex, timeline.length - 1);
    const corridor = [currentLocationId];
    for (const id of timeline.slice(nodeIndex + 1, nodeIndex + 3)) {
      if (!corridor.includes(id)) corridor.push(id);
    }
    if (travelDerived.arriving && !corridor.includes(activeTravel.destinationLocationId)) {
      corridor.push(activeTravel.destinationLocationId);
    }
    return corridor;
  })();

  const world = activeChapter
    ? buildWorldContextBlocks(story, {
        scopeTier: activeChapter.scopeTier,
        locationIds: corridorLocationIds,
        npcIds: activeNpcIds,
        accompanyingNpcIds: accompanyingIds,
      })
    : buildWorldContextBlocks(story, {
        scopeTier: 'regional',
        locationIds: corridorLocationIds,
        npcIds: activeNpcIds,
        accompanyingNpcIds: accompanyingIds,
      });

  // Hierarchical memory retrieval from the persisted session log.
  const turnSceneByNumber = new Map<number, string>();
  for (const t of sessionTurns) {
    if (t.turnNumber !== undefined) {
      turnSceneByNumber.set(t.turnNumber, t.sceneId ?? currentLocation.id);
    }
  }
  const memoryEntries = sessionMemories.map((m, i) => ({
    id: `mem_${m.turnNumber ?? 0}_${i}`,
    category: m.category as MemoryCategory,
    importance: typeof m.importance === 'number' ? m.importance : 5,
    summary: m.summary,
    detail: m.detail ?? undefined,
    tags: m.tags ?? [],
    entityIds: m.entityIds ?? [],
    sceneId: m.sceneId ?? turnSceneByNumber.get(m.turnNumber ?? 0) ?? currentLocation.id,
    turnNumber: m.turnNumber ?? 0,
    createdAt: m.turnNumber ?? 0,
  })) as unknown as MemoryEntry[];

  const retrieved = memoryEntries.length
    ? new MemoryEngine(memoryEntries).getRelevantMemories(currentLocationId, activeNpcIds, 6)
    : [];
  const relevantMemories = [
    ...retrieved.map((m) => ({ category: m.category, importance: m.importance, summary: m.summary })),
    {
      category: 'player' as MemoryCategory,
      importance: 8,
      summary: `Player performed action "${input.playerActionText}" with outcome ${resolution.outcome}`,
    },
  ];

  // Sliding-window recent prose from prior turns (fallback to opening beat).
  const priorProse = sessionTurns
    .slice(-3)
    .map((t) => t.narrativeProse)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);
  const recentSceneSnippets =
    priorProse.length > 0 ? priorProse : [story.initialStoryBeats?.[0]?.narrativeText || ''];

  const recentCompletedActions = sessionTurns
    .slice(-4)
    .map((t) => t.playerActionText)
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0);

  // Tier 2 rollups + Tier 3 ledger lines from the merged Living World Ledger.
  const threeTier = new MemoryEngine(memoryEntries).buildThreeTierEnvelope(ledger);

  const activeClockLines = (playerState.activeTensionClocks ?? []).map(
    (c) =>
      `${c.name}: ${c.currentSegments}/${c.maxSegments}${c.isTriggered ? ' — CRISIS TRIGGERED' : ''}${c.crisisDescription ? ` (crisis: ${c.crisisDescription})` : ''}`
  );
  const newLocation = story.worldBible.locations.find(
    (l: any) => l.id === playerState.currentLocationId
  );
  const previousLocation = story.worldBible.locations.find(
    (l: any) => l.id === input.previousLocationId
  );
  const displacementDirective =
    input.displacedLocationId && previousLocation && newLocation
      ? `[CRITICAL LOCATION DISPLACEMENT]: The action failed catastrophically. The player was knocked/fell from ${previousLocation.name} into ${newLocation.name}. Dramatize the bone-jarring impact, physical damage, and the sudden survival crisis in this new environment!`
      : undefined;
  const inventoryTerms = playerState.inventory.map((i) => i.name).filter(Boolean).slice(0, 12);
  const environmentInteractables = [
    ...(currentLocation.pointsOfInterest ?? []).map((p: any) => p.name),
    ...(currentLocation.subZones ?? []).flatMap((z: any) =>
      (z.pointsOfInterest ?? []).map((p: any) => p.name)
    ),
  ]
    .filter(Boolean)
    .slice(0, 12);

  // Plan 17 (§4.5): journey block for prompts — derived leg state only, never
  // a stored countdown. The route line (envelope.tradeRoutes) already carries
  // the journey's route via formatTradeRouteLine; here we add the leg itself.
  const travelEnvelope: WorkingContextEnvelope['travel'] = (() => {
    if (!activeTravel || !travelDerived) return undefined;
    const timeline = travelTimeline(activeTravel);
    const nodeIndex = Math.min(travelDerived.nodeIndex, timeline.length - 1);
    const locName = (id?: string) =>
      id ? story.worldBible.locations.find((l: any) => l.id === id)?.name || id : '';
    const route = activeTravel.routeId
      ? (story.worldBible.tradeRoutes ?? []).find((r: any) => r.id === activeTravel.routeId)
      : undefined;
    // Corridor companions: explicit roster when present, else the route's
    // caravan roster (master + retinue) on caravan/ship passages.
    const companionIds: string[] = activeTravel.caravanNpcIds?.length
      ? activeTravel.caravanNpcIds
      : activeTravel.mode === 'caravan' || activeTravel.mode === 'ship'
        ? ([route?.caravanMasterNpcId, ...(route?.travelingNpcIds ?? [])].filter(Boolean) as string[])
        : [];
    const caravanNpcNames = companionIds
      .map((id) => (story.worldBible.npcs ?? []).find((n: any) => n.id === id)?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
      .slice(0, 5);
    const factionName = (fid?: string) =>
      fid ? story.worldBible.factions?.find((f: any) => f.id === fid)?.name || fid : '';
    const roadParts: string[] = [];
    if (route) {
      roadParts.push(`Danger ${route.dangerLevel ?? 2}`);
      roadParts.push(`status ${String(route.status ?? 'active').toUpperCase()}`);
      if (route.rivalRaidingFactionId) roadParts.push(`raided by ${factionName(route.rivalRaidingFactionId)}`);
      if (route.patrollingFactionId) roadParts.push(`patrolled by ${factionName(route.patrollingFactionId)}`);
    }
    const nextIndex = Math.min(nodeIndex + 1, timeline.length - 1);
    return {
      originName: locName(activeTravel.originLocationId),
      destinationName: locName(activeTravel.destinationLocationId),
      routeName: route?.name,
      currentStopName: currentLocation.name || locName(timeline[nodeIndex]),
      nextStopName: travelDerived.arrived ? undefined : locName(timeline[nextIndex]),
      turnsRemaining: travelDerived.turnsRemaining,
      totalTurns: activeTravel.totalTurns,
      dayOnRoad: travelDerived.dayOnRoad,
      mode: activeTravel.mode,
      caravanNpcNames: caravanNpcNames.length ? caravanNpcNames : undefined,
      roadNote: roadParts.length ? roadParts.join(' • ') : undefined,
      arriving: travelDerived.arriving || undefined,
    };
  })();

  return {
    storyTitle: story.title,
    worldLaws: story.worldBible.laws.map((l: any) => `${l.rule}: ${l.description}`),
    currentLocationName: currentLocation.name,
    currentLocationDescription: currentLocation.description,
    activeNpcDossiers: activeNPCs.map((npc: any) => {
      const ov = story.storyNpcOverrides?.[npc.id];
      let powerAffiliationLine: string | undefined;
      if (npc.powerAffiliations?.length && story.worldBible?.powerSchools?.length) {
        const parts = npc.powerAffiliations.map((aff: any) => {
          const school = story.worldBible.powerSchools.find((s: any) => s.id === aff.schoolId);
          const rankObj = school?.ranks?.find((r: any) => r.rank === aff.rank);
          const schoolName = school?.name || aff.schoolId;
          const rankName = rankObj?.name || `Rank ${aff.rank}`;
          const title = aff.title || rankObj?.title;
          return `${schoolName}: ${rankName}${title ? ` (${title})` : ''}`;
        });
        powerAffiliationLine = parts.join(' • ');
      }
      const isTargetOfAction =
        input.playerActionText.includes(npc.name) ||
        (npc.title && input.playerActionText.includes(npc.title));
      // Plan 15 (Bug 3): When an authoritative party roster exists, companions left behind
      // at camp/base (not in accompanyingIds) do not follow the player into secluded or scouting
      // scenes. Even if they spoke at camp in recent turns, they remain stationed in the background
      // unless directly sought out or targeted by the player's action.
      const hasAuthoritativeParty =
        playerState.accompanyingNpcIds !== undefined && playerState.accompanyingNpcIds !== null;
      const isLeftBehindPartyMember =
        hasAuthoritativeParty && !accompanyingIds.includes(npc.id);

      const isInImmediateScene =
        isTargetOfAction ||
        (!isLeftBehindPartyMember &&
          recentSceneSnippets.some(
            (snippet) =>
              snippet.includes(npc.name) ||
              (npc.title && snippet.includes(npc.title)) ||
              (npc.nameFa && snippet.includes(npc.nameFa)) ||
              (npc.nameEn && snippet.includes(npc.nameEn))
          ));
      return {
        name: npc.name,
        trust:
          playerState.relationships[npc.id]?.trust ??
          ov?.customInitialTrust ??
          npc.initialTrust ??
          0,
        knownSecrets: playerState.relationships[npc.id]?.knownSecrets || [],
        speechStyle: ov?.storyRole
          ? `[Role in this story: ${ov.storyRole}] ${npc.speechStyle}`
          : npc.speechStyle,
        vitalsLine: formatNpcCombatSummary(npc) || undefined,
        powerAffiliationLine,
        presenceStatus: isInImmediateScene ? ('present' as const) : ('nearby_resident' as const),
        caravanAffiliation: caravanAffiliationByNpcId.get(npc.id),
        appearance: formatNpcAppearance(npc),
      };
    }),
    relevantMemories,
    playerStatus: {
      stats: playerState.stats,
      resources: playerState.resources,
      equippedItems: formatEquippedItemsForContext(playerState, story),
      characterName: playerState.characterName,
      archetypeName: playerState.archetypeName,
      abilities: formatAbilitiesForContext(playerState, story),
      traits: formatTraitsForContext(playerState, story),
      itemInteractionsCatalog: formatItemInteractionsCatalogForContext(playerState, story),
      conditions: playerState.conditions,
    },
    statsConfig: story.rpgSystem?.stats,
    universalBaseValue: (story.rpgSystem as any)?.universalBaseValue,
    resolvedGameOutcome: {
      actionText: input.playerActionText,
      outcome: resolution.outcome,
      consequence: resolution.consequenceSummary,
      costLine:
        formatOutcomeCost(resolution, story.language === 'fa' ? 'fa' : 'en') ??
        (resolution.outcome === 'mixed_success'
          ? story.language === 'fa'
            ? 'هزینه قطعی این نوبت: خستگی، از دست رفتن تعادل یا جلب توجه — برخاسته از خودِ اقدام.'
            : 'Certain cost this turn: strain, fatigue, lost footing, or raised attention — caused by the action itself.'
          : undefined),
      ...(resolution.failureMode
        ? {
            failureMode: resolution.failureMode,
            ...(resolution.failureSecondaryMode
              ? { failureSecondaryMode: resolution.failureSecondaryMode }
              : {}),
            ...(resolution.failureDirective
              ? {
                  failureDirective:
                    story.language === 'fa'
                      ? resolution.failureDirective.fa
                      : resolution.failureDirective.en,
                }
              : {}),
            stuckAllowed: Boolean(resolution.stuckAllowed),
            ...(resolution.stuckReason ? { stuckReason: resolution.stuckReason } : {}),
            ...(resolution.failureRequirementHint
              ? { failureRequirementHint: resolution.failureRequirementHint }
              : {}),
          }
        : {}),
      locationChanged: Boolean(
        resolution.stateDiff?.locationChange ||
          resolution.displacedLocationId ||
          input.travelArrival
      ),
    },
    recentSceneSnippets,
    recentCompletedActions: recentCompletedActions.length > 0 ? recentCompletedActions : undefined,
    languageDirective: story.language,
    authoredSystemPrompt: world.authoredSystemPrompt,
    worldSummary: world.worldSummary,
    themeNotes: world.themeNotes,
    factions: world.factions,
    factionRelations: world.factionRelations,
    timeline: world.timeline,
    artifacts: world.artifacts,
    bestiary: world.bestiary,
    religions: world.religions,
    dramaBonds: world.dramaBonds,
    ontologySummary: world.ontologySummary,
    locations: world.locations,
    npcs: world.npcs,
    tradeRoutes: world.tradeRoutes,
    // Plan 08 saga grounding
    activeChapterTitle: activeChapter
      ? `${activeChapter.chapterNumber}. ${activeChapter.title}`
      : story.activeMilestoneGoal
      ? story.language === 'fa'
        ? 'هدف روایی و برخورد پیش‌رو'
        : 'Active Milestone Encounter'
      : undefined,
    activeChapterGoal: activeChapter?.narrativeGoal || story.activeMilestoneGoal || undefined,
    activeChapterStages: (activeChapter as any)?.stages?.length
      ? (activeChapter as any).stages.map((st: any) => ({
          order: st.order,
          title: st.title,
          description: st.description,
          stageType: st.stageType,
        }))
      : undefined,
    episodicRollup: threeTier.episodicRollup,
    livingWorldLedger: threeTier.livingWorldLedger,
    // Plan 13: Director & Scribe runtime
    activeClocks: activeClockLines.length ? activeClockLines : undefined,
    displacementDirective,
    // Plan 17 (§4.5): the road is real — journey leg block + arrival input.
    travel: travelEnvelope,
    travelArrival: input.travelArrival
      ? { destinationName: input.travelArrival.name || input.travelArrival.locationId }
      : undefined,
    inventoryTerms: inventoryTerms.length ? inventoryTerms : undefined,
    environmentInteractables: environmentInteractables.length ? environmentInteractables : undefined,
    activePowerRanks: (() => {
      const userRanks = playerState.powerRanks || {};
      const schools = story.worldBible?.powerSchools || [];
      const out: NonNullable<WorkingContextEnvelope['activePowerRanks']> = [];
      for (const [schoolId, rankNum] of Object.entries(userRanks)) {
        if (!rankNum || rankNum <= 0) continue;
        const school = schools.find((s: any) => s.id === schoolId);
        if (!school) continue;
        const rankObj = school.ranks?.find((r: any) => r.rank === rankNum);
        out.push({
          schoolId,
          schoolName: school.name,
          rank: rankNum,
          rankName: rankObj?.name || `Rank ${rankNum}`,
          rankTitle: rankObj?.title,
          capabilities: rankObj?.description || '',
          scope: rankObj?.narrativeScope || 'seasoned',
        });
      }
      return out.length ? out : undefined;
    })(),
  };
}

/**
 * Resolves a scene for the turn: authored-beat passthrough, otherwise model
 * generation + prose validation (with up to two repair attempts) + sanitization.
 *
 * `secretSanitizer` is injected so this module stays free of `ActionValidator`
 * coupling; the route passes `ActionValidator.sanitizeChoices` bound to state.
 */
export async function generateValidatedScene(
  input: SceneTurnInput,
  adapter: GeminiAdapter,
  secretSanitizer?: (choices: any[], currentProse?: string) => any[],
  subqAdapter?: SubQAdapter
): Promise<SceneGenerationOutcome> {
  const { story, resolution, ledger } = input;
  const contextEnvelope = assembleSceneEnvelope(input);

  const resolvedAuthoredBeat = input.targetSceneId
    ? story.initialStoryBeats?.find((b: any) => b.sceneId === input.targetSceneId)
    : undefined;

  // Plan 12 Phase 5 — authored prose/choices are served verbatim.
  if (resolvedAuthoredBeat && resolvedAuthoredBeat.narrativeText?.trim()) {
    const authoredChoices = (resolvedAuthoredBeat.choices || []).map((c: any) => ({
      id: c.id,
      text: c.text,
      style: c.style || 'tactical',
      riskLevel: c.riskLevel || 'medium',
      targetDC: c.targetDC,
      requiredStatId: c.requiredStatId,
      targetSceneId: c.targetSceneId,
      failureMode: c.failureMode,
      failureHint: c.failureHint,
    }));
    return {
      status: 'ok',
      aiResponse: {
        narrative: resolvedAuthoredBeat.narrativeText,
        choices: secretSanitizer ? secretSanitizer(authoredChoices, resolvedAuthoredBeat.narrativeText) : authoredChoices,
        extractedMemories: [],
        isMock: false,
      },
      proseFindings: [],
      proseRepaired: false,
      firstPassFindings: [],
      repairAttempts: 0,
      usedAuthoredBeat: true,
      raw: null,
    };
  }

  // Model generation (single call; raw retained for evaluation).
  const promptPayload = PromptAssembler.buildNarrativePrompt(contextEnvelope);
  if (input.remakeDirective) {
    promptPayload.userPrompt = `${promptPayload.userPrompt}\n\n${input.remakeDirective}`;
  }
  const { response: aiResponse, raw } = await adapter.generateSceneWithRaw(promptPayload);

  // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
  if (aiResponse.isMock) {
    return {
      status: 'mock_unavailable',
      aiResponse,
      proseFindings: [],
      proseRepaired: false,
      firstPassFindings: [],
      repairAttempts: 0,
      usedAuthoredBeat: false,
      raw,
    };
  }

  // At most two repair calls; retain the initial raw output for evaluation.
  const validationOptions = {
    ledger,
    resolution,
    worldBible: story.worldBible,
    language: story.language,
    minWordCount: input.minWordCount ?? (process.env.NODE_ENV === 'test' ? 0 : 220),
  };
  const subqClient = subqAdapter ?? new SubQAdapter();
  let candidate = aiResponse;
  let check = validateProse(candidate.narrative, validationOptions);

  // SubQ Snap Anti-Stalling & Story Momentum Guardrail
  const momentumInput: MomentumEvaluationInput = {
    storyTitle: story.title,
    language: story.language,
    priorScenes: contextEnvelope.recentSceneSnippets,
    priorActions: contextEnvelope.recentCompletedActions || [],
    playerActionText: input.playerActionText,
    resolution,
    candidateNarrative: candidate.narrative,
    candidateChoices: candidate.choices,
  };
  const momentumCheck = await evaluateNarrativeMomentum(momentumInput, subqClient);
  if (!momentumCheck.ok && momentumCheck.repairInstruction) {
    check.ok = false;
    check.findings.push({
      severity: 'error',
      category: 'stalling',
      detail: momentumCheck.repairInstruction,
    });
  }

  // Shadow-AOT telemetry (§7.6E): snapshot the first-draft findings BEFORE any
  // repair call, so analysis can see exactly what the writer got wrong on
  // attempt zero and whether the repair loop caught it.
  const firstPassFindings = check.findings.map((f) => ({ ...f }));

  let proseRepaired = false;
  let repairAttempts = 0;
  for (let attempt = 1; !check.ok && attempt <= 2; attempt++) {
    repairAttempts = attempt;
    const repairPayload = {
      ...promptPayload,
      userPrompt: `${promptPayload.userPrompt}\n\n${buildProseRepairInstruction(check.findings)}\n\nREPAIR ATTEMPT ${attempt}/2: Correct every listed violation without changing the resolved outcome.\nPREVIOUS PROSE:\n${candidate.narrative}`,
    };
    const { response: repaired } = await adapter.generateSceneWithRaw(repairPayload);
    if (repaired.isMock) {
      return {
        status: 'prose_invalid', aiResponse: candidate, proseFindings: check.findings,
        proseRepaired: false, firstPassFindings, repairAttempts,
        usedAuthoredBeat: false, raw, proseInvalidReason: 'repair_unavailable',
      };
    }
    candidate = repaired;
    check = validateProse(candidate.narrative, validationOptions);
    if (check.ok) {
      const recheckedMomentum = await evaluateNarrativeMomentum(
        {
          ...momentumInput,
          candidateNarrative: candidate.narrative,
          candidateChoices: candidate.choices,
        },
        subqClient
      );
      if (!recheckedMomentum.ok && recheckedMomentum.repairInstruction) {
        check.ok = false;
        check.findings.push({
          severity: 'error',
          category: 'stalling',
          detail: recheckedMomentum.repairInstruction,
        });
      }
    }
    proseRepaired = check.ok;
  }
  if (!check.ok) {
    return {
      status: 'prose_invalid', aiResponse: candidate, proseFindings: check.findings,
      proseRepaired: false, firstPassFindings, repairAttempts,
      usedAuthoredBeat: false, raw, proseInvalidReason: 'unrepairable',
    };
  }
  // Keep prose, choices and extracted memories from the same validated draft.
  Object.assign(aiResponse, candidate);
  const proseFindings = check.findings;

  // Defense-in-depth: drop any AI choice that would leak an undiscovered secret or unintroduced NPC.
  let choicesDropped = 0;
  if (secretSanitizer) {
    const originalCount = aiResponse.choices?.length ?? 0;
    aiResponse.choices = secretSanitizer(aiResponse.choices, candidate.narrative);
    choicesDropped = Math.max(0, originalCount - (aiResponse.choices?.length ?? 0));
  }

  // Targeted Choice-Only Regeneration:
  // If the scene prose is completely valid, but the generated choices were defective
  // (dropped by sanitizer leaving fewer than 2 choices, or only fallback choices injected),
  // we ONLY ask for new choices for this established, validated scene rather than
  // discarding or rewriting the 700-word prose.
  const hasInjectedFallbacks = (aiResponse.choices || []).some(
    (c: any) => typeof c.id === 'string' && c.id.startsWith('choice_fallback')
  );
  const shouldAttemptChoiceRepair =
    input.allowChoiceRepair ?? (process.env.NODE_ENV !== 'test');
  const needsChoiceRegeneration =
    !aiResponse.choices || aiResponse.choices.length < 2 || hasInjectedFallbacks;

  let choicesRepaired = false;
  if (shouldAttemptChoiceRepair && needsChoiceRegeneration && !candidate.isMock) {
    const defectReasons: string[] = [];
    if (choicesDropped > 0) {
      defectReasons.push(
        `${choicesDropped} choice(s) leaked undiscovered secrets or named characters not present in the scene.`
      );
    }
    if (hasInjectedFallbacks) {
      defectReasons.push(
        'Previous choices could not be used and were replaced with emergency fallbacks. Fresh narrative choices are required.'
      );
    }
    if ((aiResponse.choices?.length ?? 0) < 2) {
      defectReasons.push('Too few usable choices were produced. Exactly 3 to 4 varied choices are needed.');
    }

    try {
      const choicesOnlyPayload = PromptAssembler.buildChoicesOnlyPrompt(
        contextEnvelope,
        candidate.narrative,
        defectReasons
      );
      const { response: regeneratedChoices } = await adapter.generateSceneWithRaw(choicesOnlyPayload);
      if (
        !regeneratedChoices.isMock &&
        Array.isArray(regeneratedChoices.choices) &&
        regeneratedChoices.choices.length >= 2
      ) {
        const newlySanitized = secretSanitizer
          ? secretSanitizer(regeneratedChoices.choices, candidate.narrative)
          : regeneratedChoices.choices;
        const newHasFallbacks = (newlySanitized || []).some(
          (c: any) => typeof c.id === 'string' && c.id.startsWith('choice_fallback')
        );
        if (newlySanitized.length >= 2 && !newHasFallbacks) {
          aiResponse.choices = newlySanitized;
          choicesRepaired = true;
        }
      }
    } catch (err) {
      console.warn('[narrativeTurn] Choice-only regeneration non-fatal error:', err);
    }
  }

  return {
    status: 'ok',
    aiResponse,
    proseFindings,
    proseRepaired,
    choicesRepaired,
    firstPassFindings,
    repairAttempts,
    usedAuthoredBeat: false,
    raw,
  };
}

