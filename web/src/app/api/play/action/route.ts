import { after, NextRequest, NextResponse } from 'next/server';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { GameEngine } from '@/lib/engines/game/GameEngine';
import {
  generateValidatedScene,
  type SceneGenerationOutcome,
  type SceneAiResponse,
} from '@/lib/engines/narrative/narrativeTurn';
import type { ProseFinding } from '@/lib/engines/narrative/ProseValidator';
import { PlayerState, ActionStyle, RiskLevel, TurnBeat, CheckResolution, StateMutationDiff, ChoiceOption } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import { buildCorsHeaders, handleCorsPreflight } from '@/lib/cors';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';
import { reconcilePlayerResources, resolveHealthKey } from '@/lib/engines/game/resourcePools';
import { migrateStoryManifestToUnifiedGraph } from '@/lib/engines/world/graphMigration';
import { calculateActionXp, applyXpGain } from '@/lib/engines/game/progressionEngine';
import { DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import { ensureClockForLocation, pruneInactiveZoneClocks } from '@/lib/engines/game/threatClock';
import { resolveAccompanyingIds } from '@/lib/engines/narrative/worldContext';
import { buildNpcIdToName, deriveActualChoice } from '@/lib/engines/narrative/snapPredictor';
import { cancelSnapPrediction, resolveSnapDecision, scheduleSnapDwell } from '@/lib/play/snapDecisions';
import { findServableAotBranch, markAotBranchServed } from '@/lib/play/snapAot';
import { getNarrativeAdapter, ENGINE_TIER_COSTS, type EngineTier } from '@/lib/providers/narrativeAdapterFactory';
import { reconcileConditions } from '@/lib/engines/game/conditionReconciler';
import { isBodilyRiskAction } from '@/lib/engines/game/actionCheckEngine';


export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function POST(req: NextRequest) {
  const turnStartTime = Date.now();
  try {
    const body = await req.json();
    let {
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
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    const rawStory = await StoryRepository.getStoryById(storyId);

    if (!rawStory && !body?.draftManifest) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404, headers: buildCorsHeaders(req) }
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
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // Resolve the caller BEFORE loading the session so ownership can be checked.
    const auth = await getAuthenticatedUser(req);
    const caller = auth ? { id: auth.user.id, role: auth.user.role } : null;

    // Load the session FIRST — it is the source of truth for both the
    // authoritative PlayerState and the Living World Ledger (Plan 08).
    //
    // Ownership-scoped: a supplied sessionId must belong to the caller. Without
    // this, anyone holding a sessionId could read the victim's playerState via
    // the response, inject turns into their narrative history and memory log,
    // and overwrite their Living World Ledger. An unknown-or-unowned session is
    // rejected outright rather than silently downgraded to a stateless call,
    // which would still attempt to record a turn under that sessionId.
    const session = sessionId
      ? await SessionRepository.getSessionForUser(sessionId, caller)
      : null;

    if (sessionId && !session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404, headers: buildCorsHeaders(req) }
      );
    }

    // Plan 15 §2.3 (Phase 6): the reader just acted — abort any Snap dwell
    // prediction still in flight for this session so it cannot log a row that
    // raced the tap. Rows that already logged are resolved below.
    if (session) cancelSnapPrediction(session.sessionId);

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
        { status: 400, headers: buildCorsHeaders(req) }
      );
    }

    // Reconcile vitals against current studio Resource Pools before resolving.
    try {
      playerState = reconcilePlayerResources(playerState, story.rpgSystem, story.worldBible).playerState;
    } catch {
      /* non-fatal */
    }

    const isRemake = body?.isRemake === true;

    // Engine tier resolution and credit metering.
    // normal = 1 credit, plus = 2 credits, advance = 5 credits.
    // A signed-in reader may choose a tier for their playthrough (Flutter's
    // reader dropdown sends it with each action); otherwise the author's story
    // tier is the default. The requested tier pays its own price, so switching
    // can never underpay for a higher model. Anonymous stateless calls keep the
    // story default and cannot request an upgrade for free.
    const requestedEngineTier = auth ? body?.engineTier : undefined;
    const engineTier: EngineTier =
      requestedEngineTier === 'advance' || requestedEngineTier === 'plus' || requestedEngineTier === 'normal'
        ? requestedEngineTier
        : story.engineTier === 'advance'
        ? 'advance'
        : story.engineTier === 'plus'
        ? 'plus'
        : 'normal';
    const sceneCreditCost = isRemake ? 0 : (ENGINE_TIER_COSTS[engineTier] ?? 1);
    const activeNarrativeAdapter = getNarrativeAdapter(engineTier);

    // Credit metering. Remakes are free (0 credits).
    if (auth && sceneCreditCost > 0 && auth.user.creditBalance < sceneCreditCost) {
      return NextResponse.json(
        {
          success: false,
          creditDepleted: true,
          error:
            story.language === 'fa'
              ? `اعتبار صحنه‌های شما کافی نیست (نیاز به ${sceneCreditCost} اعتبار). برای ادامه داستان لطفاً از فروشگاه اعتبار خود را شارژ کنید.`
              : `Insufficient scene credits (requires ${sceneCreditCost} credits). Please recharge your credits in the store.`,
          remainingCredits: auth.user.creditBalance,
          requiredCredits: sceneCreditCost,
        },
        { status: 402, headers: buildCorsHeaders(req) }
      );
    }

    // 1. Guardrail Validation
    // Presented (AI- or authored-generated) choices are trusted: they were built
    // from the player's own state at generation time, so re-validating them as
    // free text causes false secret-leak rejections. We match either on exact
    // text or — preferred — on the explicit `choiceId` the reader now sends.
    const sessionTurns =
      (session?.turns ?? (session as any)?.history ?? []) as Array<{
        turnNumber?: number;
        playerActionText?: string;
        narrativeProse?: string;
        presentedChoices?: any[];
        remakeCount?: number;
      }>;
    const lastTurn = sessionTurns.length > 0 ? sessionTurns[sessionTurns.length - 1] : null;

    if (isRemake) {
      if (!session || sessionTurns.length === 0 || !lastTurn) {
        return NextResponse.json(
          {
            success: false,
            error:
              story.language === 'fa'
                ? 'صحنه‌ای برای بازسازی وجود ندارد.'
                : 'No scene available to remake.',
          },
          { status: 400, headers: buildCorsHeaders(req) }
        );
      }
      if (((lastTurn as any)?.remakeCount ?? 0) >= 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              story.language === 'fa'
                ? 'این صحنه قبلاً یک‌بار بازسازی شده است. هر صحنه حداکثر ۱ بار امکان بازسازی رایگان دارد.'
                : 'This scene has already been remade. Only 1 free remake is allowed per scene.',
          },
          { status: 400, headers: buildCorsHeaders(req) }
        );
      }
      // Inherit the action text and turn number from the turn being remade
      if (lastTurn.playerActionText) {
        playerActionText = lastTurn.playerActionText;
      }
      if (typeof lastTurn.turnNumber === 'number') {
        turnNumber = lastTurn.turnNumber;
      }
    }

    const remakeReason =
      typeof body.remakeReason === 'string' && body.remakeReason.trim().length > 0
        ? body.remakeReason.trim()
        : story.language === 'fa'
          ? 'اصلاح پیوستگی و عدم انطباق روایی'
          : 'Continuity and immersion fix';
    const remakeDirective = isRemake
      ? `[CONTINUITY CORRECTION REMAKE]: The player reported an immersion/continuity break in the previous generation: "${remakeReason}". You MUST strictly address and fix this issue in the new narrative. Do not repeat the same error. Keep established past canon solid.`
      : undefined;

    // Plan 15 §2.3 (Phase 6): the previous turn's Snap choice-prediction was
    // logged when its choices rendered; this submission is its answer. A tap
    // of a different choice and any free-text action both resolve as a miss;
    // predictions on abandoned turns stay `null`. Never blocks or fails the turn.
    const explicitChoiceId =
      typeof body.choiceId === 'string' && body.choiceId.trim().length > 0
        ? body.choiceId.trim()
        : undefined;
    const actualChoice = deriveActualChoice(
      lastTurn?.presentedChoices,
      explicitChoiceId,
      playerActionText
    );

    if (session && typeof lastTurn?.turnNumber === 'number') {
      await resolveSnapDecision({
        sessionId: session.sessionId,
        turnNumber: lastTurn.turnNumber,
        presentedChoices: lastTurn.presentedChoices,
        explicitChoiceId,
        actionText: playerActionText,
      });
    }

    // Plan 15 §2.3 tier 4 / Live AOT Serving:
    // If the reader tapped the choice Snap predicted during dwell on lastTurn's
    // choices, look up the pre-rolled and pre-written candidate branch from the DB.
    const aotBranch =
      session &&
      actualChoice.actualChoiceId &&
      typeof lastTurn?.turnNumber === 'number' &&
      !isRemake &&
      !targetSceneId
        ? await findServableAotBranch({
            sessionId: session.sessionId,
            storyId,
            turnNumber: lastTurn.turnNumber,
            predictedChoiceId: actualChoice.actualChoiceId,
          })
        : null;


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
        { headers: buildCorsHeaders(req) }
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
          { headers: buildCorsHeaders(req) }
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
          xpGained: xpAward.amount,
          reasonEn: xpAward.reasonEn,
          reasonFa: xpAward.reasonFa,
          levelUpOccurred: advance.levelUpOccurred,
          previousLevel: advance.previousLevel,
          newLevel: advance.newLevel,
          unspentStatPoints: advance.updatedPlayerState.unspentStatPoints || 0,
          unspentAbilityPicks: advance.updatedPlayerState.unspentAbilityPicks || 0,
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
      const currentLocation = story.worldBible.locations?.find(
        (l) => l.id === playerState.currentLocationId
      );
      const feasibility = await GameEngine.assessActionFeasibility(
        playerActionText,
        {
          characterName: playerState.characterName,
          isPersian: isPersianStory,
          currentLocationName: currentLocation?.name,
          level: playerState.level || 1,
        }
      );

      resolution = GameEngine.resolveActionCheck(
        playerActionText,
        playerState,
        story.rpgSystem,
        {
          statId,
          riskLevel,
          targetDC,
          forcedDiceRoll:
            typeof forcedDiceRoll === 'number'
              ? forcedDiceRoll
              : typeof aotBranch?.diceRoll === 'number'
                ? aotBranch.diceRoll
                : undefined,
          isPersian: isPersianStory,
          // Plan 13: world context for hazard displacement + threat clocks.
          worldBible: story.worldBible,
          currentLocationId: playerState.currentLocationId,
          activeClocks: playerState.activeTensionClocks,
          // Structured ability/trait mechanics.
          actionStyle,
          turnNumber,
          invokedAbilityId,
          feasibility,
        }
      );
    }

    // 2b. Deterministic pressure revelation: coercion vs breaking point.
    // A cracked secret lands in knownSecrets (so the anti-leak validator
    // permits acting on it next turn) and always costs trust.
    const pressureTarget =
      GameEngine.detectPressureTarget(playerActionText, story.worldBible.npcs ?? []) ??
      // Plan 17 (NPC stance authority): a coercion choice often names no NPC
      // ("I squeeze him for answers"). With exactly one NPC in the scene the
      // deterministic outcome still lands instead of silently doing nothing.
      (GameEngine.isPressureAction(playerActionText)
        ? GameEngine.resolveUniquePresentNpc(playerState, story.worldBible.npcs ?? [])
        : null);
    if (pressureTarget) {
      const knownIds = playerState.relationships?.[pressureTarget.id]?.knownSecrets ?? [];
      const pressure = GameEngine.applyPressureOutcome(
        resolution.outcome,
        pressureTarget,
        knownIds,
        playerActionText,
        isPersianStory,
        turnNumber
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
      const socialTarget =
        GameEngine.detectSocialTarget(playerActionText, story.worldBible.npcs ?? []) ??
        // Plan 17: name-less deal/accept choices ("پیشنهادش را می‌پذیرم") still
        // earn trust when only one NPC is physically present.
        (GameEngine.isSocialAction(playerActionText)
          ? GameEngine.resolveUniquePresentNpc(playerState, story.worldBible.npcs ?? [])
          : null);
      if (socialTarget) {
        activeNpcTarget = socialTarget;
        const social = GameEngine.applySocialOutcome(resolution.outcome, actionStyle, isPersianStory);
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

    // 2b¾. Plan 15 (Bug 3): deterministic party roster writer. Explicit
    // follow / leave-behind / go-alone / regroup commands rewrite the accompanying
    // roster with zero model calls (same mention-matching as pressure/social).
    const partyChange = GameEngine.detectPartyChange(playerActionText, story.worldBible.npcs ?? []);
    if (partyChange) {
      const effectiveRoster = resolveAccompanyingIds(
        playerState,
        (session?.sagaLedger as WorldStateLedger | null | undefined) ?? null
      );
      const deadOrMissingIds = new Set(
        ((session?.sagaLedger as WorldStateLedger | null | undefined)?.npcStatuses ?? [])
          .filter((s) => s.status === 'dead' || s.status === 'missing' || s.status === 'imprisoned')
          .map((s) => s.npcId)
      );
      const baseCompanionIds = Array.from(
        new Set([
          ...((session?.sagaLedger as WorldStateLedger | null | undefined)?.npcStatuses ?? [])
            .filter((s) => s.status === 'companion')
            .map((s) => s.npcId),
          ...(story.worldBible?.npcs ?? [])
            .filter((n: any) => n.status === 'companion' || n.role === 'companion')
            .map((n) => n.id),
        ])
      ).filter((id) => !deadOrMissingIds.has(id));

      const finalRoster = GameEngine.applyPartyChange(effectiveRoster, partyChange, baseCompanionIds);
      resolution.stateDiff.accompanyingNpcIds = finalRoster;
      const partyNote =
        partyChange.kind === 'clear'
          ? isPersianStory
            ? 'قهرمان به‌تنهایی پیش می‌رود؛ همراهان در پس‌زمینه می‌مانند.'
            : 'The protagonist moves on alone; companions stay in the background.'
          : partyChange.kind === 'regroup'
            ? isPersianStory
              ? 'قهرمان به کاروان و همراهان بازگشت.'
              : 'The protagonist regroups with the caravan companions.'
          : partyChange.kind === 'join'
            ? isPersianStory
              ? `${partyChange.npc.name} به گروه همراه پیوست.`
              : `${partyChange.npc.name} joins the travelling party.`
            : isPersianStory
              ? `${partyChange.npc.name} از گروه جدا شد و ماند.`
              : `${partyChange.npc.name} stays behind.`;
      resolution.consequenceSummary += ` ${partyNote}`;
    }

    // 2b¾½. Plan 15 (Pillar 4 / §7.3): deterministic micro-location writer.
    // "Step into the Salt Gallery / به سمت دهلیز نمک می‌روم" style actions flip
    // the `currentSubZoneId` pointer with zero model calls — the writer LLM
    // only narrates. Skipped on turns whose authored target beat moves the
    // protagonist to a different macro location: cross-location movement is
    // the beat's story decision (synced at §3½ below), not a zone transition.
    const authoredMoveBeat =
      typeof targetSceneId === 'string' && targetSceneId
        ? story.initialStoryBeats?.find((b: any) => b.sceneId === targetSceneId)
        : undefined;
    const authoredMovesMacroLocation = Boolean(
      typeof authoredMoveBeat?.locationId === 'string' &&
        authoredMoveBeat.locationId &&
        authoredMoveBeat.locationId !== playerState.currentLocationId
    );

    // 2b¾¾. Plan 17 (§4.4): deterministic inter-city travel writer —
    // departures, retargeting, and aborts, zero model calls. Runs in the same
    // slot as the sub-zone writer but one level up: while a journey is active
    // the scene corridor is the road (the micro-location pointer stays put),
    // and a fresh departure is the turn's story move (the sub-zone writer is
    // skipped). Precedence: hazard displacement + authored beats (§3½) +
    // defeat relocation (§3b) override travel when they fire later this turn.
    const travelLang: 'fa' | 'en' = isPersianStory ? 'fa' : 'en';
    const travelStateActive = GameEngine.isTravelStateEnabled();
    const travelIntentActive = travelStateActive && GameEngine.detectTravelIntent(playerActionText, isPersianStory);
    const travelDestination =
      travelIntentActive && !authoredMovesMacroLocation
        ? GameEngine.resolveTravelDestination(
            playerActionText,
            story.worldBible,
            playerState.currentLocationId
          )
        : null;
    const activeTravel = travelStateActive ? (playerState.travel ?? null) : null;
    let travelSkipSubZoneWriter = false;

    if (activeTravel && !authoredMovesMacroLocation) {
      if (GameEngine.detectTravelAbortIntent(playerActionText, isPersianStory)) {
        const cancelled = GameEngine.cancelTravel(playerState, story.worldBible, {
          lang: travelLang,
        });
        resolution.stateDiff.travel = null;
        resolution.consequenceSummary += ` ${cancelled.note}`;
        travelSkipSubZoneWriter = true;
      } else if (travelDestination && travelDestination.id !== activeTravel.destinationLocationId) {
        const plan = GameEngine.planJourney(
          playerState.currentLocationId,
          travelDestination.id,
          story.worldBible,
          GameEngine.detectTravelMode(playerActionText),
          { lang: travelLang }
        );
        if (plan) {
          resolution.stateDiff.travel = GameEngine.startTravel(
            plan,
            playerState.currentLocationId,
            turnNumber
          );
          resolution.consequenceSummary += ` ${plan.note}`;
          travelSkipSubZoneWriter = true;
        }
      } else {
        // A road turn: the journey corridor is the scene scope.
        travelSkipSubZoneWriter = true;
      }
    } else if (!activeTravel && travelDestination && !authoredMovesMacroLocation) {
      const plan = GameEngine.planJourney(
        playerState.currentLocationId,
        travelDestination.id,
        story.worldBible,
        GameEngine.detectTravelMode(playerActionText),
        { lang: travelLang }
      );
      if (plan) {
        if (plan.immediateHop) {
          // One-day hops resolve as immediate moves — existing behavior plus
          // an explicit note (no travel state is created).
          resolution.stateDiff.locationChange = plan.destinationLocationId;
          resolution.stateDiff.travel = null;
          const hopName = travelDestination.name || plan.destinationLocationId;
          resolution.consequenceSummary += isPersianStory
            ? ` سفر یک‌روزه بود؛ مستقیم به «${hopName}» رسیدی.`
            : ` A one-day hop — you arrive directly at "${hopName}".`;
        } else {
          resolution.stateDiff.travel = GameEngine.startTravel(
            plan,
            playerState.currentLocationId,
            turnNumber
          );
          resolution.consequenceSummary += ` ${plan.note}`;
        }
        travelSkipSubZoneWriter = true;
      }
    }

    if (!authoredMovesMacroLocation && !travelSkipSubZoneWriter) {
      const currentLocationForZones =
        story.worldBible.locations?.find((l: any) => l.id === playerState.currentLocationId) ?? null;
      const subZoneChange = GameEngine.detectSubZoneChange(
        playerActionText,
        currentLocationForZones,
        {
          isPersian: isPersianStory,
          currentSubZoneId: playerState.currentSubZoneId,
        }
      );
      if (subZoneChange) {
        // '' clears the pointer (stateMutationEngine treats '' as "unset").
        resolution.stateDiff.currentSubZoneId =
          subZoneChange.kind === 'enter' ? subZoneChange.subZoneId! : '';
        resolution.consequenceSummary += ` ${subZoneChange.note}`;
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
      resolution.consequenceSummary += isPersianStory
        ? ` ${npc?.name || npcId} رازی را آشکار کرد: «${grant.newSecretDescription}»`
        : ` ${npc?.name || npcId} reveals a truth through ${grant.revealMethod}: "${grant.newSecretDescription}"`;
    }
    resolution.stateDiff.relationshipChanges = relationshipChanges;

    // 3. Apply State Mutation Diff
    let updatedPlayerState = GameEngine.applyStateMutation(
      playerState,
      resolution.stateDiff,
      story.rpgSystem
    );

    // 3½. Plan 15 (§7.3 movement sync): authored-beat transitions are the
    // canonical cross-location movement path — beats carry a `locationId`, but
    // `currentLocationId` used to stay stale on the old location after moving,
    // so the next turn's world envelope scoped to the wrong place and the
    // vitality bar showed the wrong zone. Sync the pointer + discovery list
    // here, BEFORE clock pruning / quest / defeat evaluation. Precedence:
    // hazard displacement (already in this diff) and defeat relocation (§3b)
    // override the authored beat; death turns also defer to defeat.
    const displacementTarget =
      resolution.displacedLocationId || resolution.stateDiff.displacedLocationId;
    const authoredMoveTargetId =
      !displacementTarget &&
      authoredMovesMacroLocation &&
      typeof authoredMoveBeat?.locationId === 'string'
        ? authoredMoveBeat.locationId
        : undefined;
    if (authoredMoveTargetId) {
      const healthKey = resolveHealthKey(story.rpgSystem);
      const hpAfterMutation = updatedPlayerState.resources?.[healthKey] ?? 1;
      const deathImminent = typeof hpAfterMutation === 'number' && hpAfterMutation <= 0;
      if (!deathImminent && authoredMoveTargetId !== updatedPlayerState.currentLocationId) {
        updatedPlayerState.currentLocationId = authoredMoveTargetId;
        if (!updatedPlayerState.discoveredLocationIds.includes(authoredMoveTargetId)) {
          updatedPlayerState.discoveredLocationIds.push(authoredMoveTargetId);
        }
        const moveNote = isPersianStory
          ? `قهرمان به ${story.worldBible.locations.find((l) => l.id === authoredMoveTargetId)?.name || 'مقصد جدید'} رسید.`
          : `The protagonist arrives at ${story.worldBible.locations.find((l) => l.id === authoredMoveTargetId)?.name || 'a new destination'}.`;
        resolution.consequenceSummary += ` ${moveNote}`;
        // Apply-mutation already cleared a stale sub-zone (location change);
        // a fresh location starts micro-location-less.
        resolution.stateDiff.locationChange = authoredMoveTargetId;
      }
    }

    // 3¾. Plan 17 (§4.4): journey lifecycle after the deterministic mutation.
    // Priority guard first: a higher-precedence macro move this turn
    // (displacement or authored beat) grounds the traveller. Then the
    // rewind-safe advance: arrival runs BEFORE generation — same slot as
    // §3½ — so this turn's scene is scoped to the destination and carries the
    // `travelArrived` flag; intermediate stops move the pointer to the current
    // node; plain road turns leave everything to the derived timeline.
    let travelArrived: { locationId: string; name: string } | undefined;
    if (displacementTarget || authoredMoveTargetId) {
      if (updatedPlayerState.travel) updatedPlayerState.travel = null;
    }
    if (travelStateActive && updatedPlayerState.travel) {
      const advance = GameEngine.advanceTravel(updatedPlayerState, turnNumber, story.worldBible, {
        lang: travelLang,
      });
      if (advance.arrivedAt) {
        travelArrived = {
          locationId: advance.arrivedAt,
          name: advance.arrivedAtName || advance.arrivedAt,
        };
        updatedPlayerState.travel = null;
        if (updatedPlayerState.currentLocationId !== advance.arrivedAt) {
          updatedPlayerState.currentLocationId = advance.arrivedAt;
          if (!updatedPlayerState.discoveredLocationIds.includes(advance.arrivedAt)) {
            updatedPlayerState.discoveredLocationIds.push(advance.arrivedAt);
          }
        }
        updatedPlayerState.currentSubZoneId = undefined;
        resolution.stateDiff.locationChange = advance.arrivedAt;
        // Seed the destination's ambient threat clock, same as any entry.
        const destForClock = story.worldBible.locations.find((l) => l.id === advance.arrivedAt);
        const seededClock = ensureClockForLocation(
          updatedPlayerState.activeTensionClocks,
          destForClock,
          story.worldBible
        );
        if (
          seededClock &&
          !(updatedPlayerState.activeTensionClocks ?? []).some((c) => c.id === seededClock.id)
        ) {
          if (!updatedPlayerState.activeTensionClocks) updatedPlayerState.activeTensionClocks = [];
          updatedPlayerState.activeTensionClocks.push(seededClock);
        }
        if (advance.note) resolution.consequenceSummary += ` ${advance.note}`;
      } else if (advance.movedTo) {
        // Reached an intermediate stop: move the pointer, keep travelling.
        updatedPlayerState.currentLocationId = advance.movedTo;
        if (!updatedPlayerState.discoveredLocationIds.includes(advance.movedTo)) {
          updatedPlayerState.discoveredLocationIds.push(advance.movedTo);
        }
        updatedPlayerState.currentSubZoneId = undefined;
        resolution.stateDiff.locationChange = advance.movedTo;
        if (advance.note) resolution.consequenceSummary += ` ${advance.note}`;
      }
    }

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

    // Prune location/regional clocks if the player moved outside their region or entered a safe city
    if (updatedPlayerState.activeTensionClocks && story.worldBible) {
      updatedPlayerState.activeTensionClocks = pruneInactiveZoneClocks(
        updatedPlayerState.activeTensionClocks,
        updatedPlayerState.currentLocationId,
        story.worldBible
      );
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
      // Plan 17 §4.4: defeat relocation beats any journey — the protagonist
      // wakes at the last safe location, not mid-road.
      updatedPlayerState.travel = null;
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

    let sceneOutcome: SceneGenerationOutcome;
    const canServeAot =
      aotBranch?.narrative &&
      Array.isArray(aotBranch.choices) &&
      aotBranch.choices.length > 0 &&
      (!aotBranch.outcome || aotBranch.outcome === resolution.outcome);

    if (canServeAot) {
      console.info(
        `[action] AOT Cache HIT! Serving pre-generated branch ${aotBranch.id} for session ${sessionId} turn ${turnNumber} choice ${actualChoice.actualChoiceId}`
      );
      const aiResponse: SceneAiResponse = {
        narrative: aotBranch.narrative!,
        choices: aotBranch.choices as unknown as ChoiceOption[],
        extractedMemories: [],
        encounteredCreatureId: undefined,
        playerConditionChanges: undefined,
        isMock: false,
      };
      sceneOutcome = {
        status: 'ok',
        aiResponse,
        proseFindings: [] as ProseFinding[],
        proseRepaired: (aotBranch.audit as any)?.stats?.proseRepaired ?? false,
        firstPassFindings: [],
        repairAttempts: 0,
        usedAuthoredBeat: false,
        raw: null,
      };
      await markAotBranchServed(aotBranch.id);
    } else {
      sceneOutcome = await generateValidatedScene(
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
            playerActionText?: string;
            actionStyle?: string;
            presentedChoices?: any[];
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
          // Plan 17 (§4.5): journey math derives from the absolute turn number;
          // `travelArrival` marks the scene that entered the destination.
          turnNumber,
          travelArrival: travelArrived,
          remakeDirective,
        },
        activeNarrativeAdapter,
        (choices, currentProse) => {
          const priorTurns = ((session?.turns ?? []) as Array<{
            turnNumber?: number;
            narrativeProse?: string;
          }>).filter((t) => typeof t.turnNumber !== 'number' || t.turnNumber < turnNumber);
          const priorSnippets = priorTurns
            .slice(-3)
            .map((t) => t.narrativeProse)
            .filter((p): p is string => typeof p === 'string' && p.length > 0);
          const recentSceneSnippets =
            priorSnippets.length > 0
              ? priorSnippets
              : [story.initialStoryBeats?.[0]?.narrativeText || ''];

          return ActionValidator.sanitizeChoices(
            choices,
            updatedPlayerState,
            story.worldBible,
            story.storyNpcOverrides,
            recentSceneSnippets,
            currentProse
          );
        }
      );
    }


    // Plan 08 Phase 1: NEVER persist mock/offline output as story canon.
    if (sceneOutcome.status === 'mock_unavailable') {
      return NextResponse.json(
        {
          success: false,
          error:
            'AI narration is unavailable right now (offline or API failure). The turn was NOT recorded to protect story consistency. Please retry.',
          isMock: true,
        },
        { status: 503, headers: buildCorsHeaders(req) }
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
        { status: 503, headers: buildCorsHeaders(req) }
      );
    }

    const aiResponse = sceneOutcome.aiResponse;
    const proseFindings = sceneOutcome.proseFindings;
    const proseRepaired = sceneOutcome.proseRepaired;

    // Plan 17 (§3.7): reconcile the authoritative condition list with the prose
    // the writer just produced. The writer's `playerConditionChanges` channel is
    // evidence-gated; undeclared but clearly narrated injuries are inferred from
    // mechanical cost or explicit prose. A second applyStateMutation carries the
    // minimal diff (with a full overwrite whenever tags were removed, so the
    // auto-derivation cannot silently re-add them). Gated by ENABLE_CONDITION_RECONCILER.
    if (GameEngine.isConditionReconcilerEnabled()) {
      const conditionReconciliation = reconcileConditions({
        prose: aiResponse.narrative,
        declared: aiResponse.playerConditionChanges ?? null,
        previousConditions: (playerState.conditions ?? []).slice(),
        playerState: updatedPlayerState,
        resolution: {
          outcome: resolution.outcome,
          resourceChanges: resolution.stateDiff.resourceChanges ?? null,
          bodilyRisk: isBodilyRiskAction(playerActionText, actionStyle, resolution.statId),
        },
        rpgSystem: story.rpgSystem,
        language: story.language,
      });
      if (conditionReconciliation.findings.length > 0) {
        resolution.conditionChanges = conditionReconciliation.findings;
        // Plan 17: conflicts are telemetry only — the reconciler already resolved
        // them prose-first, so no repair round-trip is triggered.
        const conflict = conditionReconciliation.findings.find((f) => f.type === 'conflict');
        if (conflict) {
          proseFindings.push({
            severity: 'warning',
            category: 'condition_conflict',
            detail: conflict.detail,
          });
        }
        console.log(
          `[Plan17] condition reconciliation (session ${sessionId}, turn ${turnNumber}):`,
          conditionReconciliation.findings
        );
      }
      if (Object.keys(conditionReconciliation.diff).length > 0) {
        updatedPlayerState = GameEngine.applyStateMutation(
          updatedPlayerState,
          conditionReconciliation.diff,
          story.rpgSystem,
          { previousState: playerState }
        );
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

    // NPC Encounter / Relationship Discovery Tracking:
    // If an NPC is engaged in the player action or mentioned in the narrative prose,
    // ensure they are registered in the player's relationships so they appear in the Compendium.
    const relMap = { ...(updatedPlayerState.relationships || {}) };
    let relChanged = false;
    const newlyMetNpcs: any[] = [];
    const normalizeNpcText = (text: string): string =>
      (text || '')
        .replace(/[‌‍‎‏­]/g, '')
        .replace(/ي/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[ً-ٰٟ]/g, '')
        .replace(/[.,،؟!؛:()«»"'`\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const proseWordSet = (normalizedProse: string): Set<string> =>
      new Set(
        (normalizedProse.includes('‌')
          ? [normalizedProse, normalizedProse.replace(/‌/g, ' ')]
          : [normalizedProse]
        ).flatMap((f) => f.split(' '))
      );
    const normalizedActionNarrative = normalizeNpcText(aiResponse.narrative || '');
    const normalizedActionText = normalizeNpcText(playerActionText || '');
    const actionWords = new Set([
      ...proseWordSet(normalizedActionNarrative),
      ...proseWordSet(normalizedActionText),
    ]);
    for (const npc of story.worldBible?.npcs || []) {
      if (relMap[npc.id]) continue;
      const normalizedName = normalizeNpcText(npc.name || '');
      const normalizedTitle = normalizeNpcText(npc.title || '');
      // Full name (either ZWNJ spelling), the whitespace-separated given name
      // as an exact word (ZWNJ compounds stay atomic), or the title.
      const nameForms =
        normalizedName && normalizedName.includes('‌')
          ? [normalizedName, normalizedName.replace(/‌/g, ' ')]
          : [normalizedName];
      const firstToken = normalizedName.split(' ').filter((t) => t.length >= 3)[0] || '';
      const mentions = (nm: string) =>
        nm &&
        (normalizedActionNarrative.includes(nm) ||
          normalizedActionText.includes(nm) ||
          actionWords.has(nm));
      const isMentioned = Boolean(
        (normalizedName && nameForms.some((f) => mentions(f))) ||
          (firstToken && actionWords.has(firstToken)) ||
          mentions(normalizedTitle)
      );
      if (isMentioned) {
        relMap[npc.id] = {
          trust: npc.initialTrust ?? 0,
          knownSecrets: [],
          notes: [],
        };
        relChanged = true;
        newlyMetNpcs.push(npc);
      }
    }
    if (relChanged) {
      updatedPlayerState.relationships = relMap;
    }
    if (newlyMetNpcs.length > 0) {
      console.info('[action] newly met NPCs:', newlyMetNpcs.map((n) => n.id));
    }

    // Plan 17 (NPC stance authority): the writer may declare trust movement for
    // the NPCs it actually wrote into this scene — the prose is the evidence.
    // This closes the gap where a deal sealed through dialogue moved nothing:
    // the deterministic pressure/social lane (§2b) needs a social keyword AND
    // the NPC's name in the action text, which generated choices rarely carry.
    // Applied AFTER newly-met seeding so a first meeting starts from
    // initialTrust and moves by the narrated delta.
    const declaredTrustChanges = aiResponse.npcTrustChanges ?? [];
    if (declaredTrustChanges.length > 0) {
      const travelRosterIds: string[] = [];
      if (activeTravel?.routeId) {
        const activeRoute = story.worldBible.tradeRoutes?.find(
          (r: any) => r.id === activeTravel.routeId
        );
        if (activeRoute) {
          travelRosterIds.push(
            ...[activeRoute.caravanMasterNpcId, ...(activeRoute.travelingNpcIds ?? [])].filter(
              (id: unknown): id is string => typeof id === 'string' && id.length > 0
            )
          );
        }
      }
      const appliedTrust = GameEngine.resolveDeclaredNpcTrustChanges({
        declared: declaredTrustChanges,
        npcs: story.worldBible.npcs ?? [],
        currentLocationId: updatedPlayerState.currentLocationId,
        accompanyingNpcIds: updatedPlayerState.accompanyingNpcIds,
        extraPresentNpcIds: travelRosterIds,
      });
      if (appliedTrust.length > 0) {
        // Present-but-unmet NPCs may not have a relationship entry yet. Seed the
        // authored baseline first so the writer's delta lands on initialTrust,
        // not on an accidental zero.
        updatedPlayerState.relationships = GameEngine.seedTrustRelationships(
          updatedPlayerState.relationships,
          appliedTrust,
          story.worldBible.npcs ?? []
        );
        const trustDiff: StateMutationDiff = {
          relationshipChanges: Object.fromEntries(
            appliedTrust.map((change) => [change.npcId, { trustDelta: change.trustDelta }])
          ),
        };
        updatedPlayerState = GameEngine.applyStateMutation(
          updatedPlayerState,
          trustDiff,
          story.rpgSystem,
          { previousState: playerState }
        );
        resolution.npcTrustChanges = appliedTrust.map(({ npcId, npcName, trustDelta }) => ({
          npcId,
          npcName,
          trustDelta,
        }));
        for (const change of appliedTrust) {
          resolution.consequenceSummary += ` ${GameEngine.describeTrustChange(
            change,
            isPersianStory
          )}`;
        }
        console.log(
          `[Plan17] npc trust changes (session ${sessionId}, turn ${turnNumber}):`,
          appliedTrust.map((c) => `${c.npcName} ${c.trustDelta > 0 ? '+' : ''}${c.trustDelta}`)
        );
      }
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
      discoveredNpc: newlyMetNpcs[0],
      discoveredNpcs: newlyMetNpcs.length > 0 ? newlyMetNpcs : undefined,
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
        isRemake,
      });
    }

    // 6. Deduct Scene Credit for Authenticated User (1 for normal, 2 for plus, 5 for advance, 0 for remake)
    let remainingCredits: number | null = null;
    if (auth && sceneCreditCost > 0) {
      const prisma = getPrisma();
      if (prisma) {
        try {
          const updated = await prisma.user.update({
            where: { id: auth.user.id },
            data: { creditBalance: { decrement: sceneCreditCost } },
            select: { creditBalance: true },
          });
          remainingCredits = updated.creditBalance;

          await prisma.userCreditLedger.create({
            data: {
              userId: auth.user.id,
              amount: -sceneCreditCost,
              balanceAfter: updated.creditBalance,
              reason:
                engineTier === 'advance'
                  ? 'SCENE_PLAY_ADVANCE'
                  : engineTier === 'plus'
                    ? 'SCENE_PLAY_PLUS'
                    : 'SCENE_PLAY',
              metadata: { storyId, turnNumber, engineTier, cost: sceneCreditCost },
            },
          });
        } catch (creditErr) {
          console.error('Failed to deduct scene credit:', creditErr);
        }
      }
    } else if (auth) {
      remainingCredits = auth.user.creditBalance;
    }

    // Plan 15 §2.3 (Phase 6): Snap dwell compute, logged at render.
    // `after()` runs once this response is on the wire — the moment the reader
    // sees the new scene and its choices. Fire-and-forget: the adapter timeout
    // and the cancellation registry bound it; failures write no row. Stateless
    // calls (no session) have nothing to resolve against.
    // Tier 4 (shadow): with `ENABLE_SNAP_AOT=true` the predicted choice's
    // branch is pre-rolled and pre-written under the same controller; serving
    // stays gated on the measured hit rate over `snap_decision_logs`.
    if (sessionId && session) {
      after(async () => {
        await scheduleSnapDwell({
          sessionId,
          storyId,
          storyTitle: story.title,
          storyLanguage: story.language,
          npcIdToName: buildNpcIdToName(story.worldBible?.npcs),
          turnNumber,
          currentProse: newBeat.narrativeProse,
          choices: newBeat.presentedChoices,
          playerState: updatedPlayerState,
          history: sessionTurns.map((turn) => ({
            turnNumber: turn.turnNumber ?? 0,
            playerActionText: turn.playerActionText ?? '',
            narrativeProse: turn.narrativeProse ?? '',
          })),
          aot: { story, caller },
        });
      });
    }

    // Plan 15: Minimum response latency floor (2000ms) to smooth perceived pacing.
    // Prevents an abrupt contrast between instant Snap AOT hits (<50ms) and normal
    // LLM generation misses (2-4s), preserving narrative immersion.
    // Bypassed in test environments to keep automated suites fast.
    if (process.env.NODE_ENV !== 'test') {
      const elapsedMs = Date.now() - turnStartTime;
      const MIN_DELAY_MS = 2000;
      if (elapsedMs < MIN_DELAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsedMs));
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
          // Plan 17: the journey resolved into the destination this turn —
          // clients flip the status art + arrival audio on it.
          travelArrived: travelArrived || undefined,
          activeTensionClocks: updatedPlayerState.activeTensionClocks ?? [],
          remakeUsed: isRemake,
          remakeCount: isRemake ? 1 : ((lastTurn as any)?.remakeCount ?? 0),
        },
      },
      { headers: buildCorsHeaders(req) }
    );
  } catch (error) {
    console.error('Turn action processing error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process turn';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
}
