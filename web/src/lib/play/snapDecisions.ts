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
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';

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
 * The table is the measured gate for future Snap-gated AOT work — nothing in
 * this module pre-generates narrative or touches held dice.
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
 * Fire-and-forget prediction + render-time logging. Call from `after()` so it
 * runs once the turn response (with its choices) has been sent. Never throws:
 * a failed, unmapped, or superseded prediction writes no row at all.
 */
export async function scheduleSnapPrediction(ctx: SnapPredictionSchedule): Promise<void> {
  let controller: AbortController | undefined;
  try {
    if (!ctx.sessionId || !Number.isFinite(ctx.turnNumber) || ctx.turnNumber < 1) return;
    if (!Array.isArray(ctx.choices) || ctx.choices.length === 0) return;

    // Without a database the row could never be written or resolved — don't
    // spend a Snap call measuring into the void.
    const prisma = getPrisma();
    if (!prisma) return;

    // At most one prediction in flight per session (a newer render supersedes).
    cancelSnapPrediction(ctx.sessionId);
    controller = new AbortController();
    abortRegistry().set(ctx.sessionId, controller);

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
      { timeoutMs: SNAP_PREDICTION_TIMEOUT_MS, signal: controller.signal }
    );

    // Aborted (reader already acted) or failed (timeout / offline / unmapped).
    if (controller.signal.aborted || !result.ok || !result.prediction) return;

    await prisma.snapDecisionLog.create({
      data: buildSnapDecisionLogRow(ctx, result.prediction),
    });
  } catch (error) {
    console.warn('[snapDecisions] Snap prediction logging failed:', error);
  } finally {
    if (controller) {
      const registry = abortRegistry();
      if (registry.get(ctx.sessionId) === controller) registry.delete(ctx.sessionId);
    }
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
