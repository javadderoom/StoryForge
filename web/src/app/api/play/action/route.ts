import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { validateProse, buildProseRepairInstruction } from '@/lib/engines/narrative/ProseValidator';
import { buildWorldContextBlocks, formatNpcCombatSummary } from '@/lib/engines/narrative/worldContext';
import { MemoryEngine } from '@/lib/engines/memory/MemoryEngine';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat, CheckResolution } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { WorkingContextEnvelope, MemoryCategory, MemoryEntry } from '@/lib/types/memory';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';
import { reconcilePlayerResources } from '@/lib/engines/game/resourcePools';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';

const geminiAdapter = new GeminiAdapter();

export async function OPTIONS() {
  return handleCorsPreflight();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      storyId,
      sessionId,
      playerActionText,
      actionStyle = 'free_text' as ActionStyle,
      riskLevel = 'medium' as RiskLevel,
      statId,
      targetDC,
      playerState: incomingPlayerState,
      turnNumber = 2,
      forcedDiceRoll,
      // Plan 07/08
      currentChapterId: requestedChapterId,
      sceneId: requestedSceneId,
    } = body;

    const targetSceneId =
      (typeof body.targetSceneId === 'string' && body.targetSceneId) ||
      (typeof body.destinationSceneId === 'string' && body.destinationSceneId) ||
      (typeof body.leadToSceneId === 'string' && body.leadToSceneId) ||
      undefined;

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const rawStory = await StoryRepository.getStoryById(storyId);

    if (!rawStory && !body?.draftManifest) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const baseStory = rawStory || (body.draftManifest as any);
    const storyToMigrate = body?.draftManifest
      ? {
          ...baseStory,
          ...body.draftManifest,
          initialStoryBeats: body.draftManifest.initialStoryBeats?.length
            ? body.draftManifest.initialStoryBeats
            : baseStory.initialStoryBeats,
        }
      : baseStory;

    const story = migrateStoryManifestToUnifiedGraph(storyToMigrate);

    if (!playerActionText || typeof playerActionText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'playerActionText is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Load the session FIRST — it is the source of truth for both the
    // authoritative PlayerState and the Living World Ledger (Plan 08).
    const session = sessionId ? await SessionRepository.getSession(sessionId) : null;

    // ------------------------------------------------------------------
    // Plan 08 Phase 2: SERVER-AUTHORITATIVE PlayerState.
    // A desynced/replayed client payload can claim knowledge or inventory
    // that bypasses guardrails; when a session exists its persisted state
    // always wins. The client payload is only a fallback for stateless calls.
    // ------------------------------------------------------------------
    let playerState: PlayerState = (session?.playerState as PlayerState | undefined) ?? incomingPlayerState;

    if (!playerState || !playerState.stats) {
      return NextResponse.json(
        { success: false, error: 'playerState is required when no sessionId is provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Reconcile vitals against current studio Resource Pools before resolving.
    try {
      playerState = reconcilePlayerResources(playerState, story.rpgSystem, story.worldBible).playerState;
    } catch {
      /* non-fatal */
    }

    // Check Authentication & Credits
    const auth = await getAuthenticatedUser(req);
    if (auth && auth.user.creditBalance <= 0) {
      return NextResponse.json(
        {
          success: false,
          creditDepleted: true,
          error: 'اعتبار صحنه‌های شما به پایان رسیده است. برای ادامه داستان لطفاً از فروشگاه اعتبار خود را شارژ کنید.',
          remainingCredits: 0,
        },
        { status: 402, headers: corsHeaders }
      );
    }

    // 1. Guardrail Validation
    const validation = ActionValidator.validateAction(
      playerActionText,
      playerState,
      story.worldBible,
      story.rpgSystem
    );

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          rejectionReason: validation.rejectionReason,
          suggestedAction: validation.suggestedAction,
          isGuardrailViolation: true,
        },
        { headers: corsHeaders }
      );
    }

    // 2. Deterministic Game Engine Check Resolution
    // Diceless choices branch without a roll (Plan 12)
    const isDiceless = targetDC === undefined && statId === undefined;
    const resolution: CheckResolution = isDiceless
      ? {
          actionDescription: playerActionText,
          statId: undefined,
          statModifier: 0,
          diceRoll: 20,
          diceType: 'd20',
          environmentalModifier: 0,
          totalScore: 20,
          difficultyClass: 0,
          outcome: 'success' as const,
          consequenceSummary: 'Progresses along the authored story path.',
          stateDiff: {},
        }
      : GameEngine.resolveActionCheck(
          playerActionText,
          playerState,
          story.rpgSystem,
          {
            statId,
            riskLevel,
            targetDC,
            forcedDiceRoll: typeof forcedDiceRoll === 'number' ? forcedDiceRoll : undefined,
            // Plan 13: world context for hazard displacement + threat clocks.
            worldBible: story.worldBible,
            currentLocationId: playerState.currentLocationId,
            activeClocks: playerState.activeTensionClocks,
          }
        );

    // 2b. Deterministic pressure revelation: coercion vs breaking point.
    // A cracked secret lands in knownSecrets (so the anti-leak validator
    // permits acting on it next turn) and always costs trust.
    const pressureTarget = GameEngine.detectPressureTarget(
      playerActionText,
      story.worldBible.npcs ?? []
    );
    if (pressureTarget) {
      const knownIds = playerState.relationships?.[pressureTarget.id]?.knownSecrets ?? [];
      const pressure = GameEngine.applyPressureOutcome(
        resolution.outcome,
        pressureTarget,
        knownIds,
        playerActionText
      );
      const changes = resolution.stateDiff.relationshipChanges ?? {};
      const existing = changes[pressureTarget.id] ?? { trustDelta: 0 };
      changes[pressureTarget.id] = {
        trustDelta: existing.trustDelta + pressure.trustDelta,
        ...(pressure.revealedSecretId
          ? { newSecret: pressure.revealedSecretId }
          : existing.newSecret
            ? { newSecret: existing.newSecret }
            : {}),
      };
      resolution.stateDiff.relationshipChanges = changes;
      resolution.consequenceSummary += ` ${pressure.note}`;
    }

    // 2b½. Positive social trust awards — mirror of the pressure system.
    // When the player greets, helps, gifts, or otherwise positively engages
    // a named NPC, they earn trust proportional to the dice outcome.
    let activeNpcTarget = pressureTarget;
    if (!pressureTarget) {
      const socialTarget = GameEngine.detectSocialTarget(
        playerActionText,
        story.worldBible.npcs ?? []
      );
      if (socialTarget) {
        activeNpcTarget = socialTarget;
        const social = GameEngine.applySocialOutcome(resolution.outcome, actionStyle);
        const changes = resolution.stateDiff.relationshipChanges ?? {};
        const existing = changes[socialTarget.id] ?? { trustDelta: 0 };
        changes[socialTarget.id] = {
          trustDelta: existing.trustDelta + social.trustDelta,
          ...(existing.newSecret ? { newSecret: existing.newSecret } : {}),
        };
        resolution.stateDiff.relationshipChanges = changes;
        resolution.consequenceSummary += ` ${social.note}`;
      }
    }

    // 2c. Passive secret unlocks the engine can observe: trust thresholds
    // and completed quests. One per NPC per turn (lowest threshold first);
    // pressure/item/ritual/location/custom need triggers or the narrator.
    const completedIds = [
      ...(playerState.completedQuestIds ?? []),
      ...((resolution.stateDiff.questUpdates ?? [])
        .filter((q: any) => q.status === 'completed')
        .map((q: any) => q.questId)),
    ];
    for (const npc of story.worldBible.npcs ?? []) {
      const existing = resolution.stateDiff.relationshipChanges?.[npc.id];
      if (existing?.newSecret) continue; // already granted this turn (e.g. pressure)
      const baseTrust =
        playerState.relationships?.[npc.id]?.trust ?? npc.initialTrust ?? 0;
      const pendingDelta = existing?.trustDelta ?? 0;
      const knownIds = playerState.relationships?.[npc.id]?.knownSecrets ?? [];
      const unlock = GameEngine.findTrustUnlockedSecret(
        npc,
        baseTrust + pendingDelta,
        knownIds,
        completedIds
      );
      if (unlock) {
        const changes = resolution.stateDiff.relationshipChanges ?? {};
        changes[npc.id] = {
          trustDelta: pendingDelta,
          newSecret: unlock.id,
        };
        resolution.stateDiff.relationshipChanges = changes;
        resolution.consequenceSummary +=
          ` Through earned trust, ${npc.name} opens up and reveals: "${unlock.description}"`;
      }
    }

    // 3. Apply State Mutation Diff
    let updatedPlayerState = GameEngine.applyStateMutation(
      playerState,
      resolution.stateDiff,
      story.rpgSystem
    );

    // 3a½. Plan 13: backfill full threat-clock metadata for newly spawned
    // clocks (applyStateMutation only records deltas; names/max live here).
    const preTurnLocationId = playerState.currentLocationId;
    if (resolution.clockUpdate) {
      if (!updatedPlayerState.activeTensionClocks) updatedPlayerState.activeTensionClocks = [];
      const cu = resolution.clockUpdate;
      const locForClock =
        story.worldBible.locations.find((l) => `clock_${l.id}` === cu.clockId) ||
        story.worldBible.locations.find((l) => l.id === preTurnLocationId);
      const existing = updatedPlayerState.activeTensionClocks.find((c) => c.id === cu.clockId);
      if (existing) {
        existing.currentSegments = cu.newSegments;
        existing.maxSegments = cu.maxSegments;
        if (cu.isCrisis) existing.isTriggered = true;
        if ((!existing.name || existing.name === existing.id) && locForClock?.threatClockDefault?.name) {
          existing.name = locForClock.threatClockDefault.name;
          existing.crisisDescription = locForClock.threatClockDefault.crisisDescription || existing.crisisDescription;
        }
      } else {
        updatedPlayerState.activeTensionClocks.push({
          id: cu.clockId,
          name: locForClock?.threatClockDefault?.name || cu.clockId,
          currentSegments: cu.newSegments,
          maxSegments: cu.maxSegments,
          crisisDescription: locForClock?.threatClockDefault?.crisisDescription || '',
          isTriggered: cu.isCrisis || undefined,
        });
      }
    }
    const displacedLocationId = resolution.displacedLocationId || resolution.stateDiff.displacedLocationId;
    const previousLocation = story.worldBible.locations.find((l) => l.id === preTurnLocationId);

    // 3a. Plan 11: Quest item triggers & active quest progress/completion
    const itemTriggerResult = GameEngine.evaluateQuestItemTriggers(
      updatedPlayerState,
      story.worldBible
    );
    if (itemTriggerResult) {
      updatedPlayerState = GameEngine.applyStateMutation(
        updatedPlayerState,
        itemTriggerResult.diff,
        story.rpgSystem
      );
      resolution.stateDiff.questUpdates = [
        ...(resolution.stateDiff.questUpdates ?? []),
        ...(itemTriggerResult.diff.questUpdates ?? []),
      ];
      const titles = itemTriggerResult.activatedQuests.map((q) => `"${q.title}"`).join(', ');
      resolution.consequenceSummary += ` [Quest Activated: ${titles}]`;
    }

    const questEval = GameEngine.evaluateActiveQuests(
      updatedPlayerState,
      story.worldBible,
      {
        targetNpcId: activeNpcTarget?.id,
        actionText: playerActionText,
        outcome: resolution.outcome,
      }
    );
    for (const completedQ of questEval.readyToComplete) {
      const completion = GameEngine.completeQuest(
        completedQ,
        updatedPlayerState,
        story.worldBible
      );
      updatedPlayerState = GameEngine.applyStateMutation(
        updatedPlayerState,
        completion.diff,
        story.rpgSystem
      );
      if (completion.diff.questUpdates) {
        resolution.stateDiff.questUpdates = [
          ...(resolution.stateDiff.questUpdates ?? []),
          ...completion.diff.questUpdates,
        ];
      }
      if (completion.diff.itemsRemovedIds) {
        resolution.stateDiff.itemsRemovedIds = [
          ...(resolution.stateDiff.itemsRemovedIds ?? []),
          ...completion.diff.itemsRemovedIds,
        ];
      }
      if (completion.diff.itemsAdded) {
        resolution.stateDiff.itemsAdded = [
          ...(resolution.stateDiff.itemsAdded ?? []),
          ...completion.diff.itemsAdded,
        ];
      }
      if (completion.diff.relationshipChanges) {
        resolution.stateDiff.relationshipChanges = {
          ...(resolution.stateDiff.relationshipChanges ?? {}),
          ...completion.diff.relationshipChanges,
        };
      }
      resolution.consequenceSummary += ` ${completion.narrativeSummary}`;
    }

    // 3b. Hybrid Defeat System (Option C) — when HP reaches 0 the player
    // is NOT killed; instead escalating penalties are applied and the
    // narrative resumes at the last safe location.
    let defeatNarrativeHint: string | undefined;
    const healthResource =
      (story.rpgSystem.resources ?? []).find((r: any) => /^(health|hp|سلامت|تندرستی)$/i.test(r.id)) ||
      (story.rpgSystem.resources ?? []).find((r: any) => /health|hp|vital/i.test(r.id)) ||
      story.rpgSystem.resources?.[0];
    const healthKey = healthResource?.id || 'health';
    const hpAfterMutation = updatedPlayerState.resources?.[healthKey] ?? (healthResource?.max ?? 100);
    if (hpAfterMutation <= 0) {
      const defeat = GameEngine.resolveDefeat(
        updatedPlayerState,
        story.rpgSystem,
        resolution.statId ?? undefined
      );
      updatedPlayerState = GameEngine.applyStateMutation(
        updatedPlayerState,
        defeat.diff,
        story.rpgSystem
      );
      updatedPlayerState.defeatCount = defeat.defeatCount;
      defeatNarrativeHint = defeat.narrativeHint;
      resolution.consequenceSummary += ` ${defeat.narrativeHint}`;
    }

    // ------------------------------------------------------------------
    // Plan 08 Phase 3: derive + merge the Living World State Ledger so
    // relationship drift and story-critical items persist across turns.
    // ------------------------------------------------------------------
    const ledgerPatch = GameEngine.deriveLedgerPatch(resolution.stateDiff, story.worldBible);
    const nextLedger = GameEngine.mergeLedgerPatch(
      (session?.sagaLedger as WorldStateLedger | null | undefined) ?? null,
      ledgerPatch
    );

    // ------------------------------------------------------------------
    // Plan 08 Phase 6: scope-aware lore injection for long-form sagas.
    // ------------------------------------------------------------------
    const activeChapter =
      story.saga?.chapters.find((c) => c.id === (requestedChapterId || session?.currentChapterId)) ||
      null;

    const currentLocationId = updatedPlayerState.currentLocationId;

    const currentLocation =
      story.worldBible.locations.find((l) => l.id === currentLocationId) ||
      story.worldBible.locations[0] || {
        id: 'loc_default',
        name: 'Citadel',
        description: 'Dark fortress',
      };

    const activeNPCs = story.worldBible.npcs.filter(
      (npc) => npc.currentLocationId === currentLocationId
    );
    const activeNpcIds = activeNPCs.map((n) => n.id);

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

    // Hierarchical memory retrieval from the persisted session log
    const turnSceneByNumber = new Map<number, string>();
    for (const t of (session?.turns ?? []) as Array<{ turnNumber: number; sceneId?: string }>) {
      turnSceneByNumber.set(t.turnNumber, t.sceneId ?? currentLocation.id);
    }
    const memoryLogs = (session?.memories ?? []) as Array<{
      category: string;
      importance?: number;
      summary: string;
      detail?: string | null;
      turnNumber?: number;
      sceneId?: string | null;
      entityIds?: string[];
      tags?: string[];
    }>;
    const memoryEntries = memoryLogs.map((m, i) => ({
      id: `mem_${m.turnNumber ?? 0}_${i}`,
      category: m.category,
      importance: typeof m.importance === 'number' ? m.importance : 5,
      summary: m.summary,
      detail: m.detail ?? undefined,
      tags: m.tags ?? [],
      entityIds: m.entityIds ?? [],
      // Prefer the dedicated scene column; fall back to the turn lookup.
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
        summary: `Player performed action "${playerActionText}" with outcome ${resolution.outcome}`,
      },
    ];

    // Sliding-window recent prose from prior turns (fallback to opening beat)
    const priorProse = ((session?.turns ?? []) as Array<{ narrativeProse?: string }>)
      .slice(-3)
      .map((t) => t.narrativeProse)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
    const recentSceneSnippets =
      priorProse.length > 0 ? priorProse : [story.initialStoryBeats[0]?.narrativeText || ''];

    // Tier 2 rollups + Tier 3 ledger lines from the merged Living World Ledger
    const threeTier = new MemoryEngine(memoryEntries).buildThreeTierEnvelope(nextLedger);

    // Plan 13: threat clocks + displacement + contextual choice material.
    const activeClockLines = (updatedPlayerState.activeTensionClocks ?? []).map(
      (c) => `${c.name}: ${c.currentSegments}/${c.maxSegments}${c.isTriggered ? ' — CRISIS TRIGGERED' : ''}${c.crisisDescription ? ` (crisis: ${c.crisisDescription})` : ''}`
    );
    const newLocation = story.worldBible.locations.find((l) => l.id === updatedPlayerState.currentLocationId);
    const displacementDirective = displacedLocationId && previousLocation && newLocation
      ? `[CRITICAL LOCATION DISPLACEMENT]: The action failed catastrophically. The player was knocked/fell from ${previousLocation.name} into ${newLocation.name}. Dramatize the bone-jarring impact, physical damage, and the sudden survival crisis in this new environment!`
      : undefined;
    const inventoryTerms = updatedPlayerState.inventory.map((i) => i.name).filter(Boolean).slice(0, 12);
    const environmentInteractables = [
      ...(currentLocation.pointsOfInterest ?? []).map((p) => p.name),
      ...(currentLocation.subZones ?? []).flatMap((z) => (z.pointsOfInterest ?? []).map((p) => p.name)),
    ].filter(Boolean).slice(0, 12);

    const contextEnvelope: WorkingContextEnvelope = {
      storyTitle: story.title,
      worldLaws: story.worldBible.laws.map((l) => `${l.rule}: ${l.description}`),
      currentLocationName: currentLocation.name,
      currentLocationDescription: currentLocation.description,
      activeNpcDossiers: activeNPCs.map((npc) => {
        const ov = story.storyNpcOverrides?.[npc.id];
        return {
          name: npc.name,
          trust: updatedPlayerState.relationships[npc.id]?.trust ?? ov?.customInitialTrust ?? npc.initialTrust ?? 0,
          knownSecrets: updatedPlayerState.relationships[npc.id]?.knownSecrets || [],
          speechStyle: ov?.storyRole ? `[Role in this story: ${ov.storyRole}] ${npc.speechStyle}` : npc.speechStyle,
          vitalsLine: formatNpcCombatSummary(npc) || undefined,
        };
      }),
      relevantMemories,
      playerStatus: {
        stats: updatedPlayerState.stats,
        resources: updatedPlayerState.resources,
        equippedItems: updatedPlayerState.inventory.map((i) => i.name),
      },
      resolvedGameOutcome: {
        actionText: playerActionText,
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

    // ------------------------------------------------------------------
    // Plan 12 Phase 5: HYBRID READER
    // Traversal: if choice targets a valid authored beat in the unified graph,
    // present its authored prose and choices verbatim.
    // Fallback: unlinked / dangling / free-text choices continue via Gemini LLM.
    // ------------------------------------------------------------------
    const resolvedAuthoredBeat = targetSceneId
      ? story.initialStoryBeats?.find((b) => b.sceneId === targetSceneId)
      : undefined;

    let aiResponse: {
      narrative: string;
      choices: any[];
      extractedMemories: any[];
      isMock?: boolean;
    };
    let proseRepaired = false;
    let proseFindings: ReturnType<typeof validateProse>['findings'] = [];

    if (resolvedAuthoredBeat && resolvedAuthoredBeat.narrativeText?.trim()) {
      aiResponse = {
        narrative: resolvedAuthoredBeat.narrativeText,
        choices: (resolvedAuthoredBeat.choices || []).map((c: any) => ({
          id: c.id,
          text: c.text,
          style: c.style || 'tactical',
          riskLevel: c.riskLevel || 'medium',
          targetDC: c.targetDC,
          requiredStatId: c.requiredStatId,
          targetSceneId: c.targetSceneId,
        })),
        extractedMemories: [],
        isMock: false,
      };
    } else {
      // 4. Build prompt and generate prose with Gemini
      const promptPayload = PromptAssembler.buildNarrativePrompt(contextEnvelope);
      const generated = await geminiAdapter.generateScene(promptPayload);
      aiResponse = generated;

      // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
      if (aiResponse.isMock) {
        return NextResponse.json(
          {
            success: false,
            error:
              'AI narration is unavailable right now (offline or API failure). The turn was NOT recorded to protect story consistency. Please retry.',
            isMock: true,
          },
          { status: 503, headers: corsHeaders }
        );
      }

      // Post-generation prose validation with one auto-repair attempt.
      const firstCheck = validateProse(aiResponse.narrative, {
        ledger: nextLedger,
        resolution,
        worldBible: story.worldBible,
      });
      proseFindings = firstCheck.findings;
      if (!firstCheck.ok) {
        const repairPayload = {
          ...promptPayload,
          userPrompt: `${promptPayload.userPrompt}\n\n${buildProseRepairInstruction(firstCheck.findings)}\n\nPREVIOUS PROSE:\n${aiResponse.narrative}`,
        };
        const repaired = await geminiAdapter.generateScene(repairPayload);
        if (!repaired.isMock) {
          const secondCheck = validateProse(repaired.narrative, {
            ledger: nextLedger,
            resolution,
            worldBible: story.worldBible,
          });
          if (secondCheck.ok) {
            aiResponse = repaired;
            proseFindings = secondCheck.findings;
            proseRepaired = true;
          } else {
            return NextResponse.json(
              {
                success: false,
                error: 'Generated prose violated world canon and could not be repaired. The turn was NOT recorded. Please retry.',
                proseInvalid: true,
                proseFindings: secondCheck.findings,
              },
              { status: 503, headers: corsHeaders }
            );
          }
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Prose repair unavailable (AI offline). The turn was NOT recorded. Please retry.',
              proseInvalid: true,
              proseFindings: firstCheck.findings,
            },
            { status: 503, headers: corsHeaders }
          );
        }
      }
    }

    // Carry the real authored scene id when known; fixes stuck-currentSceneId
    const beatSceneId =
      resolvedAuthoredBeat?.sceneId ||
      (typeof requestedSceneId === 'string' && requestedSceneId) ||
      (session?.currentSceneId as string | undefined) ||
      `scene_turn_${turnNumber}`;

    const matchedAuthoredBeat =
      resolvedAuthoredBeat ||
      story.initialStoryBeats?.find((b) => b.sceneId === beatSceneId) ||
      activeChapter?.scenes?.find((s) => s.sceneId === beatSceneId);

    const newBeat: TurnBeat = {
      turnNumber,
      sceneId: beatSceneId,
      playerActionText,
      actionStyle,
      resolution,
      narrativeProse: aiResponse.narrative,
      presentedChoices: aiResponse.choices,
      chapterNumber: activeChapter?.chapterNumber,
      imageUrl: matchedAuthoredBeat?.imageUrl,
      timestamp: Date.now(),
    };

    // 5. Persist Turn Record to Database if sessionId provided
    if (sessionId) {
      const turnMemories = [
        {
          category: 'player' as const,
          importance: 8,
          summary: `Player performed action "${playerActionText}" with outcome ${resolution.outcome}`,
        },
        ...aiResponse.extractedMemories.map((m) => ({
          category: m.category,
          importance: m.importance,
          summary: m.summary,
          sceneId: beatSceneId,
        })),
      ];
      await SessionRepository.recordTurn({
        sessionId,
        beat: newBeat,
        resolution,
        updatedPlayerState,
        memories: turnMemories,
        currentChapterId: matchedAuthoredBeat?.chapterId || activeChapter?.id,
        sagaLedger: nextLedger,
      });
    }

    // 6. Deduct 1 Scene Credit for Authenticated User
    let remainingCredits: number | null = null;
    if (auth) {
      const prisma = getPrisma();
      if (prisma) {
        try {
          const updated = await prisma.user.update({
            where: { id: auth.user.id },
            data: { creditBalance: { decrement: 1 } },
            select: { creditBalance: true },
          });
          remainingCredits = updated.creditBalance;

          await prisma.userCreditLedger.create({
            data: {
              userId: auth.user.id,
              amount: -1,
              balanceAfter: updated.creditBalance,
              reason: 'SCENE_PLAY',
              metadata: { storyId, turnNumber },
            },
          });
        } catch (creditErr) {
          console.error('Failed to deduct scene credit:', creditErr);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          beat: newBeat,
          resolution: {
            ...resolution,
            proseFindings: proseFindings.length ? proseFindings : undefined,
            proseRepaired: proseRepaired || undefined,
          },
          updatedPlayerState,
          sagaLedger: nextLedger,
          activeChapterId: activeChapter?.id ?? null,
          remainingCredits,
          proseRepaired,
          isDefeat: !!defeatNarrativeHint,
          defeatCount: updatedPlayerState.defeatCount ?? 0,
          // Plan 13: lets readers shift audio + banners without diffing states.
          locationChanged: !!displacedLocationId,
          displacedLocationId: displacedLocationId || undefined,
          activeTensionClocks: updatedPlayerState.activeTensionClocks ?? [],
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Turn action processing error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process turn';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
