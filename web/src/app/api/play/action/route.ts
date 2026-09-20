import { NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import { generateValidatedScene } from '@/lib/engines/narrative/narrativeTurn';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat, CheckResolution, StateMutationDiff } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { corsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';
import { reconcilePlayerResources, resolveHealthKey } from '@/lib/engines/game/resourcePools';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';
import { calculateActionXp, applyXpGain } from '@/lib/engines/game/progressionEngine';
import { DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';

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
      // Structured ability invocation (active spells / techniques).
      abilityId: requestedAbilityId,
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
    // Presented (AI- or authored-generated) choices are trusted: they were built
    // from the player's own state at generation time, so re-validating them as
    // free text causes false secret-leak rejections. We match either on exact
    // text or — preferred — on the explicit `choiceId` the reader now sends.
    const sessionTurns =
      (session?.turns ?? (session as any)?.history ?? []) as Array<{
        presentedChoices?: any[];
      }>;
    const lastTurn = sessionTurns.length > 0 ? sessionTurns[sessionTurns.length - 1] : null;
    const isPresetChoice = Boolean(
      lastTurn?.presentedChoices?.some(
        (c: any) =>
          (body.choiceId && c.id === body.choiceId) ||
          (body.choiceId == null && c.text?.trim() === playerActionText.trim())
      ) ||
      (body.choiceId != null &&
        story.initialStoryBeats?.some((b: any) =>
          b.choices?.some((c: any) => c.id === body.choiceId)
        )) ||
      (body.choiceId == null &&
        story.initialStoryBeats?.some((b: any) =>
          b.choices?.some((c: any) => c.text?.trim() === playerActionText.trim())
        ))
    );

    const validation = ActionValidator.validateAction(
      playerActionText,
      playerState,
      story.worldBible,
      story.rpgSystem,
      {
        isPresetChoice,
        storyNpcOverrides: story.storyNpcOverrides,
      }
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

    const isPersianStory =
      /[\u0600-\u06FF]/.test(playerActionText) ||
      /[\u0600-\u06FF]/.test(story.title || '') ||
      /[\u0600-\u06FF]/.test(playerState.characterName || '') ||
      /[\u0600-\u06FF]/.test(playerState.backgroundName || '');

    // 2a. Active-ability invocation is validated BEFORE any dice are thrown or
    // model tokens spent: an unaffordable or recharging ability must fail loudly
    // rather than silently becoming a no-op.
    const invokedAbilityId =
      typeof requestedAbilityId === 'string' && requestedAbilityId.trim()
        ? requestedAbilityId.trim()
        : undefined;

    if (invokedAbilityId) {
      const abilityCheck = GameEngine.validateAbilityInvocation(
        playerState,
        story.rpgSystem,
        invokedAbilityId,
        turnNumber
      );
      if (!abilityCheck.ok) {
        return NextResponse.json(
          {
            success: false,
            rejectionReason: isPersianStory ? abilityCheck.reasonFa : abilityCheck.reasonEn,
            isAbilityRejection: true,
            abilityBlockCode: abilityCheck.code,
          },
          { headers: corsHeaders }
        );
      }
    }

    let resolution: CheckResolution;

    if (isDiceless) {
      const progConfig = story.rpgSystem?.progression ?? DEFAULT_PROGRESSION_CONFIG;
      let progressionResult: CheckResolution['progression'] | undefined;
      const stateDiff: StateMutationDiff = {};

      if (progConfig.enabled !== false) {
        const xpAward = calculateActionXp({ riskLevel: 'low', outcome: 'success' }, progConfig);
        stateDiff.xpGained = xpAward.amount;
        const advance = applyXpGain(playerState, xpAward.amount, progConfig, story.rpgSystem);
        progressionResult = {
          xpAwarded: xpAward.amount,
          reasonEn: xpAward.reasonEn,
          reasonFa: xpAward.reasonFa,
          levelUpOccurred: advance.levelUpOccurred,
          previousLevel: advance.previousLevel,
          newLevel: advance.newLevel,
          unspentStatPoints: advance.updatedPlayerState.unspentStatPoints || 0,
        };
      }

      resolution = {
        actionDescription: playerActionText,
        statId: undefined,
        statModifier: 0,
        diceRoll: 20,
        diceType: 'd20',
        environmentalModifier: 0,
        totalScore: 20,
        difficultyClass: 0,
        outcome: 'success' as const,
        consequenceSummary: isPersianStory
          ? 'پیشروی در مسیر داستان مطابق روایت نویسنده.'
          : 'Progresses along the authored story path.',
        stateDiff,
        ...(progressionResult ? { progression: progressionResult } : {}),
      };
    } else {
      resolution = GameEngine.resolveActionCheck(
        playerActionText,
        playerState,
        story.rpgSystem,
        {
          statId,
          riskLevel,
          targetDC,
          forcedDiceRoll: typeof forcedDiceRoll === 'number' ? forcedDiceRoll : undefined,
          isPersian: isPersianStory,
          // Plan 13: world context for hazard displacement + threat clocks.
          worldBible: story.worldBible,
          currentLocationId: playerState.currentLocationId,
          activeClocks: playerState.activeTensionClocks,
          // Structured ability/trait mechanics.
          actionStyle,
          turnNumber,
          invokedAbilityId,
        }
      );
    }

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

        // 2c. Strict, method-sourced secret discovery (Plan 08 Phase 3): a secret
    //      is added to knownSecrets ONLY through a method the NPC's own
    //      revealMethods declare (trust threshold, possessed item, present
    //      location, or a completed quest). pressure/social already granted
    //      one this turn is skipped; ritual/custom are never auto-satisfied.
    const completedIds = [
      ...(playerState.completedQuestIds ?? []),
      ...((resolution.stateDiff.questUpdates ?? [])
        .filter((q: any) => q.status === 'completed')
        .map((q: any) => q.questId)),
    ];
    const existingChanges = resolution.stateDiff.relationshipChanges ?? {};
    const discoveredSecrets = GameEngine.discoverSecretsForTurn(
      story.worldBible.npcs ?? [],
      playerState,
      {
        completedQuestIds: completedIds,
        existingRelationshipChanges: existingChanges,
      }
    );
    const relationshipChanges = { ...existingChanges };
    for (const [npcId, grant] of Object.entries(discoveredSecrets)) {
      const npc = story.worldBible.npcs.find((n) => n.id === npcId);
      const priorTrustDelta = relationshipChanges[npcId]?.trustDelta ?? 0;
      relationshipChanges[npcId] = {
        trustDelta: priorTrustDelta,
        newSecret: grant.newSecretId,
      };
      resolution.consequenceSummary += ` ${npc?.name || npcId} reveals a truth through ${grant.revealMethod}: "${grant.newSecretDescription}"`;
    }
    resolution.stateDiff.relationshipChanges = relationshipChanges;

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
      resolution.consequenceSummary += isPersianStory
        ? ` [مأموریت فعال شد: ${titles}]`
        : ` [Quest Activated: ${titles}]`;
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
    const healthKey = resolveHealthKey(story.rpgSystem);
    const healthResource = story.rpgSystem.resources?.find((r) => r.id === healthKey);
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

    // ------------------------------------------------------------------
    // Plan 14: shared narrative-turn core (envelope → prompt → model →
    // prose validation → secret sanitization). Extracted into
    // `generateValidatedScene` so the evaluation harness exercises the exact
    // production path as live play.
    // ------------------------------------------------------------------
    const resolvedAuthoredBeat = targetSceneId
      ? story.initialStoryBeats?.find((b: any) => b.sceneId === targetSceneId)
      : undefined;

    const sceneOutcome = await generateValidatedScene(
      {
        story,
        playerState: updatedPlayerState,
        resolution,
        playerActionText,
        ledger: nextLedger,
        sessionTurns: ((session?.turns ?? []) as Array<{
          turnNumber?: number;
          sceneId?: string;
          narrativeProse?: string;
        }>).filter((t) => typeof t.turnNumber !== 'number' || t.turnNumber < turnNumber),
        sessionMemories: ((session?.memories ?? []) as Array<{
          category: string;
          importance?: number;
          summary: string;
          detail?: string | null;
          turnNumber?: number;
          sceneId?: string | null;
          entityIds?: string[];
          tags?: string[];
        }>).filter((m) => typeof m.turnNumber !== 'number' || m.turnNumber < turnNumber),
        targetSceneId,
        activeChapter,
        displacedLocationId,
        previousLocationId: preTurnLocationId,
      },
      geminiAdapter,
      (choices) =>
        ActionValidator.sanitizeChoices(
          choices,
          updatedPlayerState,
          story.worldBible,
          story.storyNpcOverrides
        )
    );

    // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
    if (sceneOutcome.status === 'mock_unavailable') {
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

    // Prose failed validation and could not be repaired.
    if (sceneOutcome.status === 'prose_invalid') {
      const repairUnavailable = sceneOutcome.proseInvalidReason === 'repair_unavailable';
      return NextResponse.json(
        {
          success: false,
          error: repairUnavailable
            ? 'Prose repair unavailable (AI offline). The turn was NOT recorded. Please retry.'
            : 'Generated prose violated world canon and could not be repaired. The turn was NOT recorded. Please retry.',
          proseInvalid: true,
          proseFindings: sceneOutcome.proseFindings,
        },
        { status: 503, headers: corsHeaders }
      );
    }

    const aiResponse = sceneOutcome.aiResponse;
    const proseFindings = sceneOutcome.proseFindings;
    const proseRepaired = sceneOutcome.proseRepaired;

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

    // Bestiary Creature Discovery Tracking
    const bestiary: any[] = story.worldBible?.bestiary || [];
    const discoveredIds = new Set(updatedPlayerState.discoveredCreatureIds || []);
    let firstDiscoveredCreature: any = undefined;

    const normalizeTextForMatching = (text: string): string =>
      (text || '')
        .replace(/[\u200c\u200b\u200d]/g, ' ')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[«»"'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    // 1. Check direct model-provided encounteredCreatureId
    if (
      aiResponse.encounteredCreatureId &&
      aiResponse.encounteredCreatureId !== 'none' &&
      aiResponse.encounteredCreatureId !== 'null'
    ) {
      const target = normalizeTextForMatching(aiResponse.encounteredCreatureId);
      const match = bestiary.find(
        (c) =>
          c.id === aiResponse.encounteredCreatureId ||
          c.name === aiResponse.encounteredCreatureId ||
          normalizeTextForMatching(c.name) === target ||
          normalizeTextForMatching(c.id) === target
      );
      if (match && !discoveredIds.has(match.id)) {
        discoveredIds.add(match.id);
        firstDiscoveredCreature = match;
      }
    }

    // 2. Strict Fallback: ONLY match if the exact, full creature name appears verbatim
    // as a whole phrase in the narrative or choices. Never match isolated single words.
    if (!firstDiscoveredCreature && !aiResponse.encounteredCreatureId) {
      const normalizedNarrative = normalizeTextForMatching(aiResponse.narrative);
      const normalizedChoices = (aiResponse.choices || []).map((c: any) => normalizeTextForMatching(c.text)).join(' ');

      for (const creature of bestiary) {
        if (!creature.name) continue;
        const normalizedName = normalizeTextForMatching(creature.name);
        if (normalizedName.length < 5) continue;

        const fullNameMatched =
          normalizedNarrative.includes(normalizedName) || normalizedChoices.includes(normalizedName);

        if (fullNameMatched) {
          if (!discoveredIds.has(creature.id)) {
            discoveredIds.add(creature.id);
            firstDiscoveredCreature = creature;
          }
          break;
        }
      }
    }

    if (firstDiscoveredCreature) {
      updatedPlayerState.discoveredCreatureIds = Array.from(discoveredIds);
    }

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
      discoveredCreature: firstDiscoveredCreature,
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
          progression: resolution.progression || undefined,
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
