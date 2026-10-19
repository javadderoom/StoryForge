import { GameEngine } from '@/lib/engines/game/GameEngine';
import { rollDice, isBodilyRiskAction } from '@/lib/engines/game/actionCheckEngine';
import { calculateActionXp, applyXpGain } from '@/lib/engines/game/progressionEngine';
import { pruneInactiveZoneClocks, resolveDeclaredClockChanges, seedAmbientClock } from '@/lib/engines/game/threatClock';
import { reconcilePlayerResources, resolveHealthKey } from '@/lib/engines/game/resourcePools';
import { reconcileConditions } from '@/lib/engines/game/conditionReconciler';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import {
  generateValidatedScene,
  assembleSceneEnvelope,
  type SceneSessionMemory,
  type SceneSessionTurn,
} from '@/lib/engines/narrative/narrativeTurn';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import {
  auditAotBranch,
  buildRejectedAudit,
  type AotBranchAudit,
} from '@/lib/engines/narrative/aotBranchAudit';
import {
  isSnapAotJudgeEnabled,
  mergeAotJudgeIntoAudit,
  runAotBranchJudge,
} from '@/lib/engines/narrative/aotBranchJudge';
import { resolveAccompanyingIds } from '@/lib/engines/narrative/worldContext';
import { DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import type { StoryManifest } from '@/lib/types/story';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import {
  CheckResolution,
  ChoiceOption,
  PlayerState,
  StateMutationDiff,
} from '@/lib/types/gameplay';
import { WorldStateLedger, type NPCDossier } from '@/lib/types/world';

/**
 * Plan 15 §2.3 tier 4: Snap-gated AOT branch pre-generation (shadow phase).
 *
 * While the reader dwells on turn N's choices, `preGenerateAotBranch` takes the
 * choice Snap predicted they will tap and pre-writes the branch exactly as the
 * live `/api/play/action` would compute it: the check is PRE-ROLLED (the dice
 * value is generated here and stored — "free RNG, stored, revealed on tap"),
 * then the deterministic enrichment chain runs — pressure/social/party roster,
 * sub-zone writer, secret discovery, state mutation, authored-movement-sync
 * is skipped (no authored target), threat clocks, quest triggers/completions,
 * hybrid defeat, Living World Ledger merge — and finally the shared narrative
 * core (`generateValidatedScene`) writes the scene.
 *
 * Fidelity contract: every deterministic step below mirrors the route's
 * corresponding block 1:1 (line references in comments). The route's
 * auth/credit/guardrail glue and the authored-beat path are intentionally not
 * mirrored — preset-choice taps are trusted, and authored branches are served
 * verbatim with zero model calls (the orchestrator skips them upstream). Until
 * the route's deterministic block is extracted into a shared module, any change
 * to the route's block MUST be mirrored here; serving a stored branch is gated
 * on the measured hit rate over `snap_decision_logs` and should not ship before
 * that unification.
 *
 * Nothing here mutates session state; the result is a candidate branch only.
 */

export type AotBranchStatus = 'generated' | 'mock_unavailable' | 'prose_invalid' | 'failed';

export interface AotBranchContext {
  /** Migrated story manifest (same object the route resolves). */
  story: StoryManifest;
  /** Authoritative player state at dwell time (post turn N mutations). */
  playerState: PlayerState;
  /** The predicted choice from the rendered scene. */
  choice: ChoiceOption;
  /** Turn whose choices are on screen (N). The branch pre-writes turn N+1. */
  turnNumber: number;
  sagaLedger?: WorldStateLedger | null;
  currentChapterId?: string | null;
  /** Completed turns up to and including N, oldest → newest (refetched). */
  sessionTurns: SceneSessionTurn[];
  /** Memories up to and including N (refetched). */
  sessionMemories: SceneSessionMemory[];
  geminiAdapter: GeminiAdapter;
  subqAdapter?: SubQAdapter;
  /** Fired the moment the reader acts; the §7.6G judge call aborts with it. */
  signal?: AbortSignal;
  /** Test-only: pin the pre-rolled check instead of drawing from the RNG. */
  forcedDiceRoll?: number;
}

export interface AotBranchResult {
  status: AotBranchStatus;
  /** Pre-written prose — only present when `status === 'generated'`. */
  narrative?: string;
  /** Pre-written next choices — only present when `status === 'generated'`. */
  choices?: ChoiceOption[];
  /** The pre-rolled check value (revealed on tap when serving ships). */
  diceRoll?: number;
  isDiceless: boolean;
  outcome?: CheckResolution['outcome'];
  /** Full pre-rolled resolution (dice, outcome, state diff) for storage. */
  resolution?: CheckResolution;
  /** Model that wrote the branch, when the raw payload reports one. */
  model?: string;
  /**
   * Shadow audit (§7.6E): mistake telemetry + serving verdict for this branch.
   * Absent only when the engine itself threw before producing a candidate.
   */
  audit?: AotBranchAudit;
  latencyMs: number;
  error?: string;
}

export async function preGenerateAotBranch(ctx: AotBranchContext): Promise<AotBranchResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const story = ctx.story;
  const choice = ctx.choice;
  // Route line 137: vitals are reconciled against studio resource pools first.
  let playerState = ctx.playerState;
  try {
    playerState = reconcilePlayerResources(playerState, story.rpgSystem, story.worldBible).playerState;
  } catch {
    /* non-fatal, mirrors the route */
  }

  const playerActionText = choice.text;
  const actionStyle = choice.style;
  // Route lines 226-232: the branch turn is N+1; that number drives ability
  // cooldown bookkeeping exactly as it would on tap.
  const branchTurnNumber = ctx.turnNumber + 1;
  const isDiceless = choice.targetDC === undefined && choice.requiredStatId === undefined;
  const isPersianStory =
    /[\u0600-\u06FF]/.test(playerActionText) ||
    /[\u0600-\u06FF]/.test(story.title || '') ||
    /[\u0600-\u06FF]/.test(playerState.characterName || '') ||
    /[\u0600-\u06FF]/.test(playerState.backgroundName || '');

  // ------------------------------------------------------------------
  // Pre-roll (Plan 15 §2.3): the check is rolled NOW, during the dwell,
  // and stored with the branch — "free RNG, revealed on tap". Diceless
  // choices branch without a roll (Plan 12), exactly like the route.
  // ------------------------------------------------------------------
  const diceType: 'd20' | '2d6' | 'd100' = story.rpgSystem?.diceType || 'd20';
  const preRoll = isDiceless
    ? undefined
    : typeof ctx.forcedDiceRoll === 'number'
      ? ctx.forcedDiceRoll
      : rollDice(diceType).roll;

  let resolution: CheckResolution;

  if (isDiceless) {
    // Route lines 264-301: diceless choices resolve as an authored success.
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
    // Route lines 302-336: live check path. Preset taps deliberately invoke no
    // ability (the client never sends `abilityId` for a choice tap).
    const currentLocation = story.worldBible.locations?.find(
      (l) => l.id === playerState.currentLocationId
    );
    const feasibility = await GameEngine.assessActionFeasibility(playerActionText, {
      characterName: playerState.characterName,
      isPersian: isPersianStory,
      currentLocationName: currentLocation?.name,
      level: playerState.level || 1,
    });

    resolution = GameEngine.resolveActionCheck(playerActionText, playerState, story.rpgSystem, {
      statId: choice.requiredStatId,
      riskLevel: choice.riskLevel,
      targetDC: choice.targetDC,
      forcedDiceRoll: preRoll,
      isPersian: isPersianStory,
      worldBible: story.worldBible,
      currentLocationId: playerState.currentLocationId,
      activeClocks: playerState.activeTensionClocks,
      actionStyle,
      turnNumber: branchTurnNumber,
      invokedAbilityId: undefined,
      feasibility,
    });
  }

  // ------------------------------------------------------------------
  // 2b. Pressure revelation (route lines 342-368).
  // ------------------------------------------------------------------
  const pressureTarget = GameEngine.detectPressureTarget(
    playerActionText,
    story.worldBible?.npcs ?? []
  );
  if (pressureTarget) {
    const knownIds = playerState.relationships?.[pressureTarget.id]?.knownSecrets ?? [];
    const pressure = GameEngine.applyPressureOutcome(
      resolution.outcome,
      pressureTarget,
      knownIds,
      playerActionText,
      isPersianStory,
      branchTurnNumber
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

  // ------------------------------------------------------------------
  // 2b½. Positive social trust awards (route lines 370-391).
  // ------------------------------------------------------------------
  let activeNpcTarget = pressureTarget;
  if (!pressureTarget) {
    const socialTarget = GameEngine.detectSocialTarget(
      playerActionText,
      story.worldBible?.npcs ?? []
    );
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

  // ------------------------------------------------------------------
  // 2b¾. Deterministic party roster writer (route lines 393-437).
  // ------------------------------------------------------------------
  const partyChange = GameEngine.detectPartyChange(
    playerActionText,
    story.worldBible?.npcs ?? []
  );
  if (partyChange) {
    const effectiveRoster = resolveAccompanyingIds(playerState, ctx.sagaLedger ?? null);
    const deadOrMissingIds = new Set(
      (ctx.sagaLedger?.npcStatuses ?? [])
        .filter((s) => s.status === 'dead' || s.status === 'missing' || s.status === 'imprisoned')
        .map((s) => s.npcId)
    );
    const baseCompanionIds = Array.from(
      new Set([
        ...(ctx.sagaLedger?.npcStatuses ?? [])
          .filter((s) => s.status === 'companion')
          .map((s) => s.npcId),
        ...((story.worldBible?.npcs ?? []) as Array<NPCDossier & { status?: string }>)
          .filter((n) => n.status === 'companion' || n.role === 'companion')
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

  // ------------------------------------------------------------------
  // 2b¾½. Deterministic micro-location writer (route lines 439-471). The
  // route skips this when an authored target beat moves the protagonist to
  // another macro location; AOT branches have no authored target, so the
  // sub-zone writer always evaluates.
  // ------------------------------------------------------------------
  {
    const currentLocationForZones =
      story.worldBible?.locations?.find((l) => l.id === playerState.currentLocationId) ?? null;
    const subZoneChange = GameEngine.detectSubZoneChange(
      playerActionText,
      currentLocationForZones,
      {
        isPersian: isPersianStory,
        currentSubZoneId: playerState.currentSubZoneId,
      }
    );
    if (subZoneChange) {
      resolution.stateDiff.currentSubZoneId =
        subZoneChange.kind === 'enter' ? subZoneChange.subZoneId! : '';
      resolution.consequenceSummary += ` ${subZoneChange.note}`;
    }
  }

  // ------------------------------------------------------------------
  // 2c. Method-sourced secret discovery (route lines 473-505).
  // ------------------------------------------------------------------
  const completedIds = [
    ...(playerState.completedQuestIds ?? []),
    ...((resolution.stateDiff.questUpdates ?? [])
      .filter((q) => q.status === 'completed')
      .map((q) => q.questId)),
  ];
  const existingChanges = resolution.stateDiff.relationshipChanges ?? {};
  const discoveredSecrets = GameEngine.discoverSecretsForTurn(
    story.worldBible?.npcs ?? [],
    playerState,
    {
      completedQuestIds: completedIds,
      existingRelationshipChanges: existingChanges,
    }
  );
  const relationshipChanges = { ...existingChanges };
  for (const [npcId, grant] of Object.entries(discoveredSecrets)) {
    const npc = (story.worldBible?.npcs ?? []).find((n) => n.id === npcId);
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

  // ------------------------------------------------------------------
  // 3. Apply state mutation diff (route lines 507-512). Authored movement
  // sync (§3½, route lines 514-547) is skipped: AOT branches never carry an
  // authored `targetSceneId`; hazard displacement is already inside the diff.
  // ------------------------------------------------------------------
  let updatedPlayerState = GameEngine.applyStateMutation(
    playerState,
    resolution.stateDiff,
    story.rpgSystem
  );

  // ------------------------------------------------------------------
  // 3a½. Threat-clock metadata backfill + region pruning (route 549-586).
  // ------------------------------------------------------------------
  const preTurnLocationId = playerState.currentLocationId;
  if (resolution.clockUpdate) {
    if (!updatedPlayerState.activeTensionClocks) updatedPlayerState.activeTensionClocks = [];
    const cu = resolution.clockUpdate;
    const locForClock =
      story.worldBible?.locations?.find((l) => `clock_${l.id}` === cu.clockId) ||
      story.worldBible?.locations?.find((l) => l.id === preTurnLocationId);
    const existing = updatedPlayerState.activeTensionClocks.find((c) => c.id === cu.clockId);
    if (existing) {
      existing.currentSegments = cu.newSegments;
      existing.maxSegments = cu.maxSegments;
      if (cu.isCrisis) existing.isTriggered = true;
      if ((!existing.name || existing.name === existing.id) && locForClock?.threatClockDefault?.name) {
        existing.name = locForClock.threatClockDefault.name;
        existing.crisisDescription =
          locForClock.threatClockDefault.crisisDescription || existing.crisisDescription;
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

  if (updatedPlayerState.activeTensionClocks && story.worldBible) {
    updatedPlayerState.activeTensionClocks = pruneInactiveZoneClocks(
      updatedPlayerState.activeTensionClocks,
      updatedPlayerState.currentLocationId,
      story.worldBible
    );
  }

  // Plan 13 follow-up: the branch prompt must see the destination/local zone's
  // ambient clock, same as the live route.
  updatedPlayerState.activeTensionClocks = seedAmbientClock(
    updatedPlayerState.activeTensionClocks,
    updatedPlayerState.currentLocationId,
    story.worldBible
  );

  const displacedLocationId =
    resolution.displacedLocationId || resolution.stateDiff.displacedLocationId;

  // ------------------------------------------------------------------
  // 3a. Quest item triggers & active quest progress/completion (route 591-657).
  // ------------------------------------------------------------------
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

  const questEval = GameEngine.evaluateActiveQuests(updatedPlayerState, story.worldBible, {
    targetNpcId: activeNpcTarget?.id,
    actionText: playerActionText,
    outcome: resolution.outcome,
  });
  for (const completedQ of questEval.readyToComplete) {
    const completion = GameEngine.completeQuest(completedQ, updatedPlayerState, story.worldBible);
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

  // ------------------------------------------------------------------
  // 3b. Hybrid defeat system (route 659-680).
  // ------------------------------------------------------------------
  const healthKey = resolveHealthKey(story.rpgSystem);
  const healthResource = story.rpgSystem?.resources?.find((r) => r.id === healthKey);
  const hpAfterMutation = updatedPlayerState.resources?.[healthKey] ?? healthResource?.max ?? 100;
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
    resolution.consequenceSummary += ` ${defeat.narrativeHint}`;
  }

  // ------------------------------------------------------------------
  // Living World State Ledger merge (route 686-690).
  // ------------------------------------------------------------------
  const ledgerPatch = GameEngine.deriveLedgerPatch(resolution.stateDiff, story.worldBible);
  const nextLedger = GameEngine.mergeLedgerPatch(ctx.sagaLedger ?? null, ledgerPatch);

  const activeChapter =
    story.saga?.chapters?.find((c) => c.id === ctx.currentChapterId) || null;

  // ------------------------------------------------------------------
  // Model generation through the shared narrative core (route 699-763):
  // envelope → prompt → model → prose validation → secret sanitization.
  // ------------------------------------------------------------------
  // Audit telemetry (§7.6E): how many model choices the sanitizer dropped.
  let choicesDroppedBySanitizer = 0;
  const sceneOutcome = await generateValidatedScene(
    {
      story,
      playerState: updatedPlayerState,
      resolution,
      playerActionText,
      ledger: nextLedger,
      sessionTurns: ctx.sessionTurns,
      sessionMemories: ctx.sessionMemories,
      targetSceneId: undefined,
      activeChapter,
      displacedLocationId,
      previousLocationId: preTurnLocationId,
      // Plan 17 (§4.5): journey math is derived from the absolute turn number.
      turnNumber: branchTurnNumber,
    },
    ctx.geminiAdapter,
    (choices, currentProse) => {
      const priorSnippets = ctx.sessionTurns
        .slice(-3)
        .map((t) => t.narrativeProse)
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      const recentSceneSnippets =
        priorSnippets.length > 0
          ? priorSnippets
          : [story.initialStoryBeats?.[0]?.narrativeText || ''];

      const sanitized = ActionValidator.sanitizeChoices(
        choices,
        updatedPlayerState,
        story.worldBible,
        story.storyNpcOverrides,
        recentSceneSnippets,
        currentProse
      );
      choicesDroppedBySanitizer = Math.max(0, (choices?.length ?? 0) - (sanitized?.length ?? 0));
      return sanitized;
    },
    ctx.subqAdapter
  );

  if (sceneOutcome.status === 'ok') {
    // Plan 17 (§3.4 wire-in): AOT branches reconcile exactly like live turns —
    // the pre-written branch's prose + its declared conditions are audited
    // against the branch's final state, so a Snap-hit turn can never serve
    // prose and a status bar that disagree.
    const conditionReconciliation = reconcileConditions({
      prose: sceneOutcome.aiResponse.narrative,
      declared: sceneOutcome.aiResponse.playerConditionChanges ?? null,
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
      const conflict = conditionReconciliation.findings.find((f) => f.type === 'conflict');
      if (conflict) {
        sceneOutcome.proseFindings.push({
          severity: 'warning',
          category: 'condition_conflict',
          detail: conflict.detail,
        });
      }
    }
    if (Object.keys(conditionReconciliation.diff).length > 0) {
      updatedPlayerState = GameEngine.applyStateMutation(
        updatedPlayerState,
        conditionReconciliation.diff,
        story.rpgSystem,
        { previousState: playerState }
      );
    }

    // Plan 17 (NPC stance authority): same evidence-gated trust channel as the
    // live route — a Snap branch must never hold a state the live turn wouldn't.
    const declaredTrustChanges = sceneOutcome.aiResponse.npcTrustChanges ?? [];
    if (declaredTrustChanges.length > 0) {
      const travelRosterIds: string[] = [];
      if (updatedPlayerState.travel?.routeId) {
        const activeRoute = story.worldBible.tradeRoutes?.find(
          (r: any) => r.id === updatedPlayerState.travel!.routeId
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
        updatedPlayerState.relationships = GameEngine.seedTrustRelationships(
          updatedPlayerState.relationships,
          appliedTrust,
          story.worldBible.npcs ?? []
        );
        updatedPlayerState = GameEngine.applyStateMutation(
          updatedPlayerState,
          {
            relationshipChanges: Object.fromEntries(
              appliedTrust.map((change) => [change.npcId, { trustDelta: change.trustDelta }])
            ),
          },
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
      }
    }

    // Plan 13 follow-up: writer-declared threat-clock movement, identical to
    // the live route so a Snap branch can never hold a different danger meter.
    const declaredClockChanges = sceneOutcome.aiResponse.clockChanges ?? [];
    if (declaredClockChanges.length > 0) {
      const clockResolution = resolveDeclaredClockChanges({
        declared: declaredClockChanges,
        activeClocks: updatedPlayerState.activeTensionClocks,
        locationId: updatedPlayerState.currentLocationId,
        worldBible: story.worldBible,
        skipClockIds: (resolution.stateDiff.clockUpdates ?? [])
          .filter((update) => update.delta !== 0)
          .map((update) => update.id),
      });
      updatedPlayerState.activeTensionClocks = clockResolution.clocks;
      if (clockResolution.applied.length > 0) {
        resolution.clockChanges = clockResolution.applied.map((change) => ({
          clockId: change.clockId,
          clockName: change.clockName,
          delta: change.delta,
          newSegments: change.newSegments,
          maxSegments: change.maxSegments,
          isCrisis: change.isCrisis,
        }));
        for (const change of clockResolution.applied) {
          if (!change.isCrisis) continue;
          resolution.consequenceSummary += isPersianStory
            ? ` ساعت «${change.clockName}» به اوج رسید — ${
                change.crisisDescription || 'بحران آغاز شد!'
              }`
            : ` ${change.clockName} reaches its crisis — ${
                change.crisisDescription || 'crisis erupts!'
              }`;
        }
      }
    }

    // §7.6E: audit the pre-written branch — first-draft mistakes, repairs,
    // surviving findings, secret echoes, choice hygiene, language, recycling —
    // so the shadow phase produces analyzable verdicts, not just prose.
    let audit = auditAotBranch({
      storyTitle: story.title || '',
      language: story.language,
      narrative: sceneOutcome.aiResponse.narrative,
      choices: sceneOutcome.aiResponse.choices,
      resolution,
      isDiceless,
      playerActionText,
      playerState: updatedPlayerState,
      worldBible: story.worldBible,
      storyNpcOverrides: story.storyNpcOverrides,
      priorTurns: ctx.sessionTurns,
      firstPassFindings: sceneOutcome.firstPassFindings,
      finalFindings: sceneOutcome.proseFindings,
      proseRepaired: sceneOutcome.proseRepaired,
      repairAttempts: sceneOutcome.repairAttempts,
      choicesDroppedBySanitizer,
    });

    // §7.6G (opt-in): the SubQ judge critiques the FINAL (post-repair) branch —
    // semantic contradictions the deterministic checks cannot see. It never
    // throws and can only escalate the verdict; a skipped pass records
    // `stats.judgeSkipped` so absence of judge findings is not a clean bill.
    if (isSnapAotJudgeEnabled()) {
      const sceneOnScreen = ctx.sessionTurns?.[ctx.sessionTurns.length - 1]?.narrativeProse;
      const judge = await runAotBranchJudge(
        {
          storyTitle: story.title || '',
          language: story.language,
          currentScene: sceneOnScreen,
          playerActionText,
          resolution,
          isDiceless,
          playerState: updatedPlayerState,
          worldBible: story.worldBible,
          storyNpcOverrides: story.storyNpcOverrides,
          ledger: nextLedger,
          narrative: sceneOutcome.aiResponse.narrative,
          choices: sceneOutcome.aiResponse.choices,
        },
        { adapter: ctx.subqAdapter, signal: ctx.signal }
      );
      audit = mergeAotJudgeIntoAudit(audit, judge);
    }

    // Targeted Choice-Only Regeneration in AOT:
    // If the branch prose is valid and the only standing defects are choice-related
    // (choice hygiene or SubQ judge choice fit), do not discard the branch or mark it rejected.
    // Instead, ask for new choices for the established scene prose.
    const severeFindings = audit.findings.filter((f) => f.severity === 'error' || f.severity === 'warning');
    const isChoiceOnlyDefect =
      severeFindings.length > 0 &&
      severeFindings.every((f) => f.category === 'choice_hygiene' || f.category === 'judge_choice_fit');

    if (isChoiceOnlyDefect && !sceneOutcome.aiResponse.isMock) {
      const defectReasons = severeFindings.map((f) => f.detail);
      try {
        const choiceContext = assembleSceneEnvelope({
          story,
          playerState: updatedPlayerState,
          resolution,
          playerActionText,
          ledger: nextLedger,
          sessionTurns: ctx.sessionTurns,
          sessionMemories: ctx.sessionMemories,
          targetSceneId: undefined,
          activeChapter,
          displacedLocationId,
          previousLocationId: preTurnLocationId,
        });

        const choicePromptPayload = PromptAssembler.buildChoicesOnlyPrompt(
          choiceContext,
          sceneOutcome.aiResponse.narrative,
          defectReasons
        );

        const { response: regeneratedChoices } =
          await ctx.geminiAdapter.generateSceneWithRaw(choicePromptPayload);

        if (
          !regeneratedChoices.isMock &&
          Array.isArray(regeneratedChoices.choices) &&
          regeneratedChoices.choices.length >= 2
        ) {
          const priorSnippets = ctx.sessionTurns
            .slice(-3)
            .map((t) => t.narrativeProse)
            .filter((p): p is string => typeof p === 'string' && p.length > 0);
          const recentSceneSnippets =
            priorSnippets.length > 0
              ? priorSnippets
              : [story.initialStoryBeats?.[0]?.narrativeText || ''];

          const freshlySanitized = ActionValidator.sanitizeChoices(
            regeneratedChoices.choices,
            updatedPlayerState,
            story.worldBible,
            story.storyNpcOverrides,
            recentSceneSnippets,
            sceneOutcome.aiResponse.narrative
          );

          const hasFallbacks = (freshlySanitized || []).some(
            (c: any) => typeof c.id === 'string' && c.id.startsWith('choice_fallback')
          );

          if (freshlySanitized.length >= 2 && !hasFallbacks) {
            sceneOutcome.aiResponse.choices = freshlySanitized;
            choicesDroppedBySanitizer = Math.max(
              0,
              (regeneratedChoices.choices.length ?? 0) - freshlySanitized.length
            );

            // Re-audit branch with the newly generated choices
            audit = auditAotBranch({
              storyTitle: story.title || '',
              language: story.language,
              narrative: sceneOutcome.aiResponse.narrative,
              choices: freshlySanitized,
              resolution,
              isDiceless,
              playerActionText,
              playerState: updatedPlayerState,
              worldBible: story.worldBible,
              storyNpcOverrides: story.storyNpcOverrides,
              priorTurns: ctx.sessionTurns,
              firstPassFindings: sceneOutcome.firstPassFindings,
              finalFindings: sceneOutcome.proseFindings,
              proseRepaired: sceneOutcome.proseRepaired,
              repairAttempts: sceneOutcome.repairAttempts,
              choicesDroppedBySanitizer,
            });
          }
        }
      } catch (err) {
        console.warn('[aotBranchEngine] Choice-only regeneration non-fatal error:', err);
      }
    }

    return {
      status: 'generated',
      narrative: sceneOutcome.aiResponse.narrative,
      choices: sceneOutcome.aiResponse.choices,
      diceRoll: preRoll,
      isDiceless,
      outcome: resolution.outcome,
      resolution,
      model: sceneOutcome.raw?.modelUsed,
      audit,
      latencyMs: elapsed(),
    };
  }

  const rejectionReason =
    sceneOutcome.status === 'prose_invalid'
      ? sceneOutcome.proseInvalidReason === 'repair_unavailable'
        ? 'repair required but the writer was offline (mock output)'
        : 'prose violated canon and was not repairable'
      : 'the writer produced mock/offline output';

  return {
    status: sceneOutcome.status,
    diceRoll: preRoll,
    isDiceless,
    outcome: resolution.outcome,
    resolution,
    model: sceneOutcome.raw?.modelUsed,
    audit: buildRejectedAudit(rejectionReason, sceneOutcome.proseFindings, {
      narrativeChars: sceneOutcome.aiResponse.narrative?.length ?? 0,
      repairAttempts: sceneOutcome.repairAttempts,
    }),
    latencyMs: elapsed(),
    error:
      sceneOutcome.status === 'prose_invalid'
        ? (sceneOutcome.proseInvalidReason ?? 'prose_invalid')
        : 'model_unavailable',
  };
}
