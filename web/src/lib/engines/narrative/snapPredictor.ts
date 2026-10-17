import { SubQAdapter, SubQDecisionRequest, SubQDecisionResponse } from '@/lib/providers/SubQAdapter';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';

/**
 * Plan 15 §2.3 (Phase 6): reader dwell-time Snap choice prediction.
 *
 * While the reader reads a freshly rendered scene, the engine asks the in-repo
 * `SubQAdapter` (`subq-snap-preview`) which presented choice they are most
 * likely to tap next — using session history + traits/relationships + the
 * choices currently on screen. The prediction is logged at render
 * (`snapDecisions.ts` → `snap_decision_logs`) and resolved on tap. The measured
 * hit rate over that table is the *only* gate for promoting the (future,
 * expensive) Snap-gated AOT pre-generation from logging-only to live — this
 * module deliberately does no pre-generation itself.
 *
 * Pure apart from the injected adapter: no DB, no Next.js imports.
 */

export const SNAP_PREDICTION_MODEL = 'subq-snap-preview';
/** Kept in sync with the `SnapDecisionLog.questionKey` schema default. */
export const SNAP_PREDICTION_QUESTION_KEY = 'predicted_choice';
/** Dwell-time budget: the reader is reading for seconds, the call must not linger. */
export const SNAP_PREDICTION_TIMEOUT_MS = 2500;

/**
 * Bounds for the dwell-time state. SubQ fits 384K tokens, but choice
 * preference is driven by the recent arc, not the full campaign — a bounded
 * payload keeps cost and latency predictable on every turn.
 */
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_PROSE_CHARS = 500;
const MAX_CURRENT_PROSE_CHARS = 1600;
const MAX_CHOICE_TEXT_CHARS = 400;
const MAX_TRAITS = 10;
const MAX_CONDITIONS = 8;
const MAX_RELATIONSHIPS = 12;

export interface SnapPredictionHistoryTurn {
  turnNumber: number;
  playerActionText: string;
  narrativeProse: string;
}

export interface SnapPredictionInput {
  storyTitle?: string;
  storyLanguage?: string;
  /** Display names for relationship ids so Snap sees "trust: Kael", not a uuid. */
  npcIdToName?: Record<string, string>;
  /** Prose of the scene the reader is currently reading. */
  currentProse: string;
  /** The choices currently on screen. */
  choices: ChoiceOption[];
  /** Authoritative player state at render time. */
  playerState: PlayerState;
  /** Completed turns before the one being read, oldest → newest. */
  history: SnapPredictionHistoryTurn[];
}

export interface SnapPrediction {
  predictedChoiceId: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  model: string;
  latencyMs?: number;
}

export interface SnapChoicePredictionResult {
  ok: boolean;
  /** True when no prediction was attempted (SubQ unconfigured, no choices). */
  skipped?: boolean;
  prediction?: SnapPrediction;
  error?: string;
}

function truncate(text: string | undefined, max: number): string {
  const trimmed = (text ?? '').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Maps World Bible NPCs to an id → display-name lookup for the relationship
 * block. Returns undefined when there is nothing to map.
 */
export function buildNpcIdToName(
  npcs: ReadonlyArray<{ id?: unknown; name?: unknown }> | null | undefined
): Record<string, string> | undefined {
  if (!Array.isArray(npcs) || npcs.length === 0) return undefined;
  const map: Record<string, string> = {};
  for (const npc of npcs) {
    if (typeof npc?.id === 'string' && npc.id) {
      map[npc.id] = typeof npc.name === 'string' && npc.name ? npc.name : npc.id;
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

function buildPlayerBlock(playerState: PlayerState, npcIdToName?: Record<string, string>) {
  const relationships = Object.entries(playerState.relationships ?? {})
    .map(([npcId, relationship]) => ({
      npc: npcIdToName?.[npcId] ?? npcId,
      trust: typeof relationship?.trust === 'number' ? relationship.trust : 0,
    }))
    .sort((a, b) => Math.abs(b.trust) - Math.abs(a.trust))
    .slice(0, MAX_RELATIONSHIPS);

  return {
    name: playerState.characterName || 'Protagonist',
    level: playerState.level ?? 1,
    archetype: playerState.archetypeName,
    background: playerState.backgroundName,
    traits: playerState.traits?.slice(0, MAX_TRAITS),
    conditions: playerState.conditions?.slice(0, MAX_CONDITIONS),
    resources: playerState.resources,
    relationships,
  };
}

export function buildSnapPredictionRequest(input: SnapPredictionInput): SubQDecisionRequest {
  const criteria: Record<string, string> = {};
  for (const choice of input.choices) {
    const meta = [
      choice.style,
      choice.riskLevel ? `${choice.riskLevel} risk` : undefined,
      choice.requiredStatId ? `requires ${choice.requiredStatId}` : undefined,
    ]
      .filter(Boolean)
      .join(' · ');
    criteria[choice.id] = `${meta} — ${truncate(choice.text, MAX_CHOICE_TEXT_CHARS)}`;
  }

  const history = input.history
    .filter((turn) => turn && Number.isFinite(turn.turnNumber))
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      turn: turn.turnNumber,
      playerAction: truncate(turn.playerActionText, MAX_CHOICE_TEXT_CHARS),
      scene: truncate(turn.narrativeProse, MAX_HISTORY_PROSE_CHARS),
    }));

  return {
    model: SNAP_PREDICTION_MODEL,
    state: {
      task: 'predict_reader_choice',
      story: { title: input.storyTitle, language: input.storyLanguage },
      player: buildPlayerBlock(input.playerState, input.npcIdToName),
      storySoFar: history,
      currentScene: truncate(input.currentProse, MAX_CURRENT_PROSE_CHARS),
      presentedChoices: input.choices.map((choice) => ({
        id: choice.id,
        text: truncate(choice.text, MAX_CHOICE_TEXT_CHARS),
        style: choice.style,
        riskLevel: choice.riskLevel,
      })),
    },
    questions: {
      [SNAP_PREDICTION_QUESTION_KEY]: {
        type: 'choice',
        instructions:
          'Predict which choice the reader is most likely to tap next. Weigh their demonstrated play style in storySoFar, their character build (traits/resources), relationship trust, and the current scene. Answer with exactly one of the criteria keys. Even if the reader might type free text instead, still pick the most likely tapped option.',
        criteria,
      },
    },
  };
}

/**
 * Maps the Snap answer back onto one of the presented choices. Accepts the
 * criteria key (choice id) case-insensitively, or the raw choice text as a
 * fallback. Unmappable answers return null — no row is logged for a prediction
 * that cannot be resolved.
 */
export function parseSnapPredictionAnswer(
  response: SubQDecisionResponse,
  choices: ChoiceOption[]
): SnapPrediction | null {
  if (!response?.success || !Array.isArray(choices) || choices.length === 0) return null;

  const answer = response.answers?.[SNAP_PREDICTION_QUESTION_KEY] as
    | (Record<string, unknown> & {
        choice?: unknown;
        value?: unknown;
        probability?: unknown;
        confidence?: unknown;
        probabilities?: unknown;
      })
    | undefined;
  if (!answer) return null;

  // The adapter wraps non-object answers as `{ value }`; a `choice` question
  // normally answers with `{ choice }`. Accept both.
  const raw =
    typeof answer.choice === 'string' && answer.choice.trim()
      ? answer.choice.trim()
      : typeof answer.value === 'string' && answer.value.trim()
        ? answer.value.trim()
        : undefined;
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  const match =
    choices.find((choice) => choice.id === raw) ??
    choices.find((choice) => choice.id.toLowerCase() === lowered) ??
    choices.find((choice) => typeof choice.text === 'string' && choice.text.trim() === raw);
  if (!match) return null;

  const confidence =
    typeof answer.probability === 'number'
      ? answer.probability
      : typeof answer.confidence === 'number'
        ? answer.confidence
        : undefined;
  const probabilities =
    answer.probabilities && typeof answer.probabilities === 'object' && !Array.isArray(answer.probabilities)
      ? (answer.probabilities as Record<string, number>)
      : undefined;

  return {
    predictedChoiceId: match.id,
    confidence,
    probabilities,
    model: response.model || SNAP_PREDICTION_MODEL,
    latencyMs: typeof response.latencyMs === 'number' ? response.latencyMs : undefined,
  };
}

export async function predictSnapChoice(
  input: SnapPredictionInput,
  adapter?: SubQAdapter,
  options?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<SnapChoicePredictionResult> {
  const client = adapter ?? new SubQAdapter();
  if (!client.isConfigured()) {
    return { ok: false, skipped: true, error: 'subq_not_configured' };
  }
  if (!Array.isArray(input.choices) || input.choices.length === 0) {
    return { ok: false, skipped: true, error: 'no_presented_choices' };
  }

  const request = buildSnapPredictionRequest(input);
  const response = await client.evaluate(request, {
    timeoutMs: options?.timeoutMs ?? SNAP_PREDICTION_TIMEOUT_MS,
    signal: options?.signal,
  });

  if (!response.success) {
    return { ok: false, error: response.error ?? 'subq_request_failed' };
  }

  const prediction = parseSnapPredictionAnswer(response, input.choices);
  if (!prediction) {
    return { ok: false, error: 'unmapped_prediction' };
  }

  return { ok: true, prediction };
}

export interface PresentedChoiceLike {
  id?: string;
  text?: string;
}

/**
 * Determines what the reader actually did, for resolving the pending row:
 * an explicit `choiceId` tap wins; legacy clients that send only the exact
 * choice text still count as a tap; everything else is free text (a miss).
 */
export function deriveActualChoice(
  presentedChoices: PresentedChoiceLike[] | null | undefined,
  explicitChoiceId: string | undefined,
  actionText: string
): { actualChoiceId?: string; actualActionText?: string } {
  const list = Array.isArray(presentedChoices) ? presentedChoices : [];
  const text = (actionText ?? '').trim();
  const explicit = typeof explicitChoiceId === 'string' && explicitChoiceId.length > 0 ? explicitChoiceId : undefined;

  const matched = list.find(
    (choice) =>
      (explicit && choice?.id === explicit) ||
      (!explicit && typeof choice?.text === 'string' && choice.text.trim() === text)
  );

  if (typeof matched?.id === 'string' && matched.id) {
    return { actualChoiceId: matched.id };
  }
  if (explicit) {
    return { actualChoiceId: explicit };
  }
  return { actualActionText: actionText };
}

/**
 * Plan 15 §2.3: `hit: true` only when the reader tapped the predicted choice —
 * a different choice *or* free text are both misses for the AOT gate.
 */
export function computeSnapHit(
  predictedChoiceId: string | null | undefined,
  actualChoiceId: string | null | undefined
): boolean {
  return Boolean(predictedChoiceId && actualChoiceId && predictedChoiceId === actualChoiceId);
}
