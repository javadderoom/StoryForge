import { getPrisma } from '@/lib/db/client';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import {
  computeSnapHit,
  deriveActualChoice,
  predictSnapChoice,
  SNAP_PREDICTION_QUESTION_KEY,
  SNAP_PREDICTION_TIMEOUT_MS,
  type SnapPrediction,
  type SnapPredictionHistoryTurn,
} from '@/lib/engines/narrative/snapPredictor';
import {
  isSnapAotEnabled,
  preGenerateSnapAotBranch,
  type SnapAotDeps,
} from '@/lib/play/snapAot';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import type { StoryManifest } from '@/lib/types/story';

/**
 * Plan 15 §2.3 (Phase 6): Snap choice-prediction persistence + cancellation.
 *
 * Lifecycle of one prediction:
 *   1. `scheduleSnapPrediction` runs inside `after()` — i.e. the instant the
 *      turn response (with its choices) is on the wire — predicts the reader's
 *      most likely tap and logs the row at render.
 *   2. `cancelSnapPrediction` is called the moment the reader acts: a
 *      prediction still in flight has lost its dwell window, so it is aborted
 *      instead of racing the tap and writing an unresolvable row.
 *   3. `resolveSnapDecision` runs when the next action arrives and stamps the
 *      row with what the reader actually did (`hit: true/false`); rows the
 *      reader never answered stay `null` (abandoned).
 *
 * `scheduleSnapDwell` extends the same single-task lifecycle with tier 4
 * (shadow): when `ENABLE_SNAP_AOT=true`, the predicted choice's branch is
 * pre-rolled and pre-written (`snapAot.ts` → `snap_aot_branches`) under the
 * SAME abort controller, so a tap cancels whichever phase is running. Serving
 * stays gated on the measured hit rate over `snap_decision_logs`.
 */

export interface SnapPredictionSchedule {
  sessionId: string;
  storyId: string;
  storyTitle?: string;
  storyLanguage?: string;
  /** Display names for relationship ids (see `buildNpcIdToName`). */
  npcIdToName?: Record<string, string>;
  /** Turn whose narrative + choices are on screen — the row's resolution key. */
  turnNumber: number;
  currentProse: string;
  choices: ChoiceOption[];
  playerState: PlayerState;
  /** Completed turns before the one being read, oldest → newest. */
  history: SnapPredictionHistoryTurn[];
  /** Injectable for tests; defaults to a fresh `SubQAdapter`. */
  adapter?: SubQAdapter;
}

export interface SnapDwellSchedule extends SnapPredictionSchedule {
  /**
   * Plan 15 §2.3 tier 4 (shadow): context for pre-generating the predicted
   * choice's branch. Only honored when `ENABLE_SNAP_AOT=true`.
   */
  aot?: {
    /** Migrated story manifest (same object the route resolved). */
    story: StoryManifest;
    /** For the post-turn session refetch (ownership-scoped). */
    caller: { id: string; role: string } | null;
  };
}

/** Injectable AOT seams for tests (engine adapters, session load, store). */
export interface SnapDwellDeps {
  aot?: SnapAotDeps;
}

export interface SnapDecisionLogRow {
  sessionId: string;
  storyId: string;
  turnNumber: number;
  questionKey: string;
  model: string;
  presentedChoiceIds: string[];
  predictedChoiceId: string;
  choiceProbabilities?: Record<string, number>;
  confidence?: number;
  latencyMs?: number;
}

export function buildSnapDecisionLogRow(
  ctx: Pick<SnapPredictionSchedule, 'sessionId' | 'storyId' | 'turnNumber' | 'choices'>,
  prediction: SnapPrediction
): SnapDecisionLogRow {
  return {
    sessionId: ctx.sessionId,
    storyId: ctx.storyId,
    turnNumber: ctx.turnNumber,
    questionKey: SNAP_PREDICTION_QUESTION_KEY,
    model: prediction.model,
    presentedChoiceIds: ctx.choices.map((choice) => choice.id),
    predictedChoiceId: prediction.predictedChoiceId,
    choiceProbabilities: prediction.probabilities,
    confidence: prediction.confidence,
    latencyMs: prediction.latencyMs != null ? Math.round(prediction.latencyMs) : undefined,
  };
}

const globalForSnap = globalThis as unknown as {
  __storyforgeSnapPredictionAborts?: Map<string, AbortController>;
};

function abortRegistry(): Map<string, AbortController> {
  if (!globalForSnap.__storyforgeSnapPredictionAborts) {
    globalForSnap.__storyforgeSnapPredictionAborts = new Map<string, AbortController>();
  }
  return globalForSnap.__storyforgeSnapPredictionAborts;
}

/**
 * Aborts the session's in-flight dwell prediction, if any. Called the moment
 * the reader acts: a prediction for choices they have already left cannot be
 * logged-and-resolved coherently, so it is cancelled rather than raced.
 * Best-effort — never throws.
 */
export function cancelSnapPrediction(sessionId: string): void {
  try {
    const registry = abortRegistry();
    const controller = registry.get(sessionId);
    if (controller) {
      controller.abort();
      registry.delete(sessionId);
    }
  } catch {
    /* cancellation is best-effort */
  }
}

/**
 * Shared dwell guard: one task per session (a newer render supersedes the
 * previous), a registered controller so the tap can cancel it, and a hard
 * stop when the DB is disabled — a row could never be written or resolved.
 * Returns null when the schedule is unusable.
 */
function beginDwellTask(ctx: SnapPredictionSchedule): AbortController | null {
  if (!ctx.sessionId || !Number.isFinite(ctx.turnNumber) || ctx.turnNumber < 1) return null;
  if (!Array.isArray(ctx.choices) || ctx.choices.length === 0) return null;
  if (!getPrisma()) return null;

  cancelSnapPrediction(ctx.sessionId);
  const controller = new AbortController();
  abortRegistry().set(ctx.sessionId, controller);
  return controller;
}

function endDwellTask(sessionId: string, controller: AbortController | null): void {
  if (!controller) return;
  const registry = abortRegistry();
  if (registry.get(sessionId) === controller) registry.delete(sessionId);
}

async function runSnapPrediction(
  ctx: SnapPredictionSchedule,
  signal: AbortSignal
): Promise<SnapPrediction | undefined> {
  const result = await predictSnapChoice(
    {
      storyTitle: ctx.storyTitle,
      storyLanguage: ctx.storyLanguage,
      npcIdToName: ctx.npcIdToName,
      currentProse: ctx.currentProse,
      choices: ctx.choices,
      playerState: ctx.playerState,
      history: ctx.history,
    },
    ctx.adapter,
    { timeoutMs: SNAP_PREDICTION_TIMEOUT_MS, signal }
  );

  // Aborted (reader already acted) or failed (timeout / offline / unmapped).
  if (signal.aborted || !result.ok || !result.prediction) return undefined;
  return result.prediction;
}

/**
 * Fire-and-forget prediction + render-time logging. Call from `after()` so it
 * runs once the turn response (with its choices) has been sent. Never throws:
 * a failed, unmapped, or superseded prediction writes no row at all.
 */
export async function scheduleSnapPrediction(ctx: SnapPredictionSchedule): Promise<void> {
  let controller: AbortController | null = null;
  try {
    controller = beginDwellTask(ctx);
    if (!controller) return;

    const prisma = getPrisma();
    if (!prisma) return;

    const prediction = await runSnapPrediction(ctx, controller.signal);
    if (!prediction) return;

    await prisma.snapDecisionLog.create({ data: buildSnapDecisionLogRow(ctx, prediction) });
  } catch (error) {
    console.warn('[snapDecisions] Snap prediction logging failed:', error);
  } finally {
    endDwellTask(ctx.sessionId, controller);
  }
}

/**
 * Full dwell compute: render-time prediction logging, then — when
 * `ENABLE_SNAP_AOT=true` — pre-rolling and pre-writing the predicted choice's
 * branch (`snapAot.ts`) under the SAME abort controller, so a tap cancels
 * whichever phase is still running. This is the action route's entry point;
 * `scheduleSnapPrediction` remains for prediction-only callers (session opener)
 * and tests.
 */
export async function scheduleSnapDwell(
  ctx: SnapDwellSchedule,
  deps: SnapDwellDeps = {}
): Promise<void> {
  let controller: AbortController | null = null;
  try {
    controller = beginDwellTask(ctx);
    if (!controller) return;

    const prisma = getPrisma();
    if (!prisma) return;

    const prediction = await runSnapPrediction(ctx, controller.signal);
    if (!prediction) return;

    await prisma.snapDecisionLog.create({ data: buildSnapDecisionLogRow(ctx, prediction) });

    // Tier 4 (shadow): only when opted in. `preGenerateSnapAotBranch` re-checks
    // the signal and the post-turn turn history before spending a writer call
    // or storing, so a raced tap never leaves a stale branch.
    if (!ctx.aot || !isSnapAotEnabled()) return;
    if (controller.signal.aborted) return;

    const choice = ctx.choices.find((c) => c.id === prediction.predictedChoiceId);
    if (!choice) return;

    await preGenerateSnapAotBranch(
      {
        sessionId: ctx.sessionId,
        storyId: ctx.storyId,
        turnNumber: ctx.turnNumber,
        story: ctx.aot.story,
        choice,
        caller: ctx.aot.caller,
        signal: controller.signal,
      },
      deps.aot
    );
  } catch (error) {
    console.warn('[snapDecisions] Snap dwell compute failed:', error);
  } finally {
    endDwellTask(ctx.sessionId, controller);
  }
}

/**
 * Resolves the pending row logged for the turn whose choices the reader was
 * shown, using what they actually did. Free text and a tap of a different
 * choice both resolve as `hit: false`; rows the reader never answered stay
 * `null` (abandoned). Never blocks or fails the turn.
 */
export async function resolveSnapDecision(input: {
  sessionId: string;
  turnNumber: number | undefined;
  presentedChoices?: Array<{ id?: string; text?: string }>;
  explicitChoiceId?: string;
  actionText: string;
}): Promise<void> {
  try {
    const turnNumber = input.turnNumber;
    if (!input.sessionId || typeof turnNumber !== 'number' || !Number.isFinite(turnNumber)) return;

    const prisma = getPrisma();
    if (!prisma) return;

    const pending = await prisma.snapDecisionLog.findFirst({
      where: { sessionId: input.sessionId, turnNumber, hit: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, predictedChoiceId: true },
    });
    if (!pending) return;

    const actual = deriveActualChoice(input.presentedChoices, input.explicitChoiceId, input.actionText);
    await prisma.snapDecisionLog.update({
      where: { id: pending.id },
      data: {
        actualChoiceId: actual.actualChoiceId ?? null,
        actualActionText: actual.actualActionText ?? null,
        hit: computeSnapHit(pending.predictedChoiceId, actual.actualChoiceId),
        resolvedAt: new Date(),
      },
    });
  } catch (error) {
    console.warn('[snapDecisions] Snap decision resolution failed:', error);
  }
}
