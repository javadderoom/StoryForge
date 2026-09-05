import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { validateProse, buildProseRepairInstruction } from '@/lib/engines/narrative/ProseValidator';
import { buildWorldContextBlocks } from '@/lib/engines/narrative/worldContext';
import { MemoryEngine } from '@/lib/engines/memory/MemoryEngine';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { WorkingContextEnvelope, MemoryCategory, MemoryEntry } from '@/lib/types/memory';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';

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

    if (!storyId) {
      return NextResponse.json(
        { success: false, error: 'storyId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const story = await StoryRepository.getStoryById(storyId);

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: corsHeaders }
      );
    }

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
    const playerState: PlayerState = (session?.playerState as PlayerState | undefined) ?? incomingPlayerState;

    if (!playerState || !playerState.stats) {
      return NextResponse.json(
        { success: false, error: 'playerState is required when no sessionId is provided' },
        { status: 400, headers: corsHeaders }
      );
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
    const resolution = GameEngine.resolveActionCheck(
      playerActionText,
      playerState,
      story.rpgSystem,
      {
        statId,
        riskLevel,
        targetDC,
        forcedDiceRoll: typeof forcedDiceRoll === 'number' ? forcedDiceRoll : undefined,
      }
    );

    // 3. Apply State Mutation Diff
    const updatedPlayerState = GameEngine.applyStateMutation(
      playerState,
      resolution.stateDiff,
      story.rpgSystem
    );

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

    const contextEnvelope: WorkingContextEnvelope = {
      storyTitle: story.title,
      worldLaws: story.worldBible.laws.map((l) => `${l.rule}: ${l.description}`),
      currentLocationName: currentLocation.name,
      currentLocationDescription: currentLocation.description,
      activeNpcDossiers: activeNPCs.map((npc) => ({
        name: npc.name,
        trust: updatedPlayerState.relationships[npc.id]?.trust || 0,
        knownSecrets: updatedPlayerState.relationships[npc.id]?.knownSecrets || [],
        speechStyle: npc.speechStyle,
      })),
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
    };

    // 4. Build prompt and generate prose with Gemini
    const promptPayload = PromptAssembler.buildNarrativePrompt(contextEnvelope);
    let aiResponse = await geminiAdapter.generateScene(promptPayload);
    let proseRepaired = false;
    let proseFindings: ReturnType<typeof validateProse>['findings'] = [];

    // ------------------------------------------------------------------
    // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
    // A degraded generation returns 503 so the client can retry instead of
    // silently writing an off-world dungeon scene into permanent history.
    // ------------------------------------------------------------------
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

    // Carry the real authored scene id when the client/session knows it;
    // synthetic ids sever memory→scene linkage in hierarchical retrieval.
    const beatSceneId =
      (typeof requestedSceneId === 'string' && requestedSceneId) ||
      (session?.currentSceneId as string | undefined) ||
      `scene_turn_${turnNumber}`;

    const matchedAuthoredBeat =
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
        currentChapterId: activeChapter?.id,
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
