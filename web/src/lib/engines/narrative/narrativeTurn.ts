import { PromptAssembler } from './PromptAssembler';
import { validateProse, buildProseRepairInstruction, ProseFinding } from './ProseValidator';
import { buildWorldContextBlocks, formatNpcCombatSummary } from './worldContext';
import { MemoryEngine } from '@/lib/engines/memory/MemoryEngine';
import { WorkingContextEnvelope, MemoryCategory, MemoryEntry } from '@/lib/types/memory';
import { PlayerState, CheckResolution } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { RawSceneResult } from './modelCall';

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
}

export interface SceneAiResponse {
  narrative: string;
  choices: any[];
  extractedMemories: any[];
  isMock?: boolean;
}

export interface SceneGenerationOutcome {
  status: 'ok' | 'mock_unavailable' | 'prose_invalid';
  aiResponse: SceneAiResponse;
  proseFindings: ProseFinding[];
  proseRepaired: boolean;
  /** True when authored prose/choices were served instead of a model call. */
  usedAuthoredBeat: boolean;
  /** Raw model payload — the eval seam's capture point (null for authored beats). */
  raw: RawSceneResult | null;
  /** Distinguishes an unrepairable canon violation from an offline repair attempt. */
  proseInvalidReason?: 'repair_unavailable' | 'unrepairable';
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

  const activeNPCs = story.worldBible.npcs.filter(
    (npc: any) => npc.currentLocationId === currentLocationId
  );
  const activeNpcIds = activeNPCs.map((n: any) => n.id);

  const world = activeChapter
    ? buildWorldContextBlocks(story, {
        scopeTier: activeChapter.scopeTier,
        locationIds: [currentLocationId],
        npcIds: activeNpcIds,
      })
    : buildWorldContextBlocks(story, {
        scopeTier: 'regional',
        locationIds: [currentLocationId],
        npcIds: activeNpcIds,
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

  return {
    storyTitle: story.title,
    worldLaws: story.worldBible.laws.map((l: any) => `${l.rule}: ${l.description}`),
    currentLocationName: currentLocation.name,
    currentLocationDescription: currentLocation.description,
    activeNpcDossiers: activeNPCs.map((npc: any) => {
      const ov = story.storyNpcOverrides?.[npc.id];
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
      };
    }),
    relevantMemories,
    playerStatus: {
      stats: playerState.stats,
      resources: playerState.resources,
      equippedItems: playerState.inventory.map((i) => i.name),
      characterName: playerState.characterName,
      archetypeName: playerState.archetypeName,
      abilities: playerState.abilities,
    },
    statsConfig: story.rpgSystem?.stats,
    universalBaseValue: (story.rpgSystem as any)?.universalBaseValue,
    resolvedGameOutcome: {
      actionText: input.playerActionText,
      outcome: resolution.outcome,
      consequence: resolution.consequenceSummary,
    },
    recentSceneSnippets,
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
    // Plan 08 saga grounding
    activeChapterTitle: activeChapter
      ? `${activeChapter.chapterNumber}. ${activeChapter.title}`
      : story.activeMilestoneGoal
      ? story.language === 'fa'
        ? 'هدف روایی و برخورد پیش‌رو'
        : 'Active Milestone Encounter'
      : undefined,
    activeChapterGoal: activeChapter?.narrativeGoal || story.activeMilestoneGoal || undefined,
    episodicRollup: threeTier.episodicRollup,
    livingWorldLedger: threeTier.livingWorldLedger,
    // Plan 13: Director & Scribe runtime
    activeClocks: activeClockLines.length ? activeClockLines : undefined,
    displacementDirective,
    inventoryTerms: inventoryTerms.length ? inventoryTerms : undefined,
    environmentInteractables: environmentInteractables.length ? environmentInteractables : undefined,
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
  secretSanitizer?: (choices: any[]) => any[]
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
    }));
    return {
      status: 'ok',
      aiResponse: {
        narrative: resolvedAuthoredBeat.narrativeText,
        choices: secretSanitizer ? secretSanitizer(authoredChoices) : authoredChoices,
        extractedMemories: [],
        isMock: false,
      },
      proseFindings: [],
      proseRepaired: false,
      usedAuthoredBeat: true,
      raw: null,
    };
  }

  // Model generation (single call; raw retained for evaluation).
  const promptPayload = PromptAssembler.buildNarrativePrompt(contextEnvelope);
  const { response: aiResponse, raw } = await adapter.generateSceneWithRaw(promptPayload);

  // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
  if (aiResponse.isMock) {
    return {
      status: 'mock_unavailable',
      aiResponse,
      proseFindings: [],
      proseRepaired: false,
      usedAuthoredBeat: false,
      raw,
    };
  }

  // At most two repair calls; retain the initial raw output for evaluation.
  const validationOptions = { ledger, resolution, worldBible: story.worldBible, language: story.language };
  let candidate = aiResponse;
  let check = validateProse(candidate.narrative, validationOptions);
  let proseRepaired = false;
  for (let attempt = 1; !check.ok && attempt <= 2; attempt++) {
    const repairPayload = {
      ...promptPayload,
      userPrompt: `${promptPayload.userPrompt}\n\n${buildProseRepairInstruction(check.findings)}\n\nREPAIR ATTEMPT ${attempt}/2: Correct every listed violation without changing the resolved outcome.\nPREVIOUS PROSE:\n${candidate.narrative}`,
    };
    const { response: repaired } = await adapter.generateSceneWithRaw(repairPayload);
    if (repaired.isMock) {
      return {
        status: 'prose_invalid', aiResponse: candidate, proseFindings: check.findings,
        proseRepaired: false, usedAuthoredBeat: false, raw, proseInvalidReason: 'repair_unavailable',
      };
    }
    candidate = repaired;
    check = validateProse(candidate.narrative, validationOptions);
    proseRepaired = check.ok;
  }
  if (!check.ok) {
    return {
      status: 'prose_invalid', aiResponse: candidate, proseFindings: check.findings,
      proseRepaired: false, usedAuthoredBeat: false, raw, proseInvalidReason: 'unrepairable',
    };
  }
  // Keep prose, choices and extracted memories from the same validated draft.
  Object.assign(aiResponse, candidate);
  const proseFindings = check.findings;

  // Defense-in-depth: drop any AI choice that would leak an undiscovered secret.
  if (secretSanitizer) {
    aiResponse.choices = secretSanitizer(aiResponse.choices);
  }

  return {
    status: 'ok',
    aiResponse,
    proseFindings,
    proseRepaired,
    usedAuthoredBeat: false,
    raw,
  };
}

