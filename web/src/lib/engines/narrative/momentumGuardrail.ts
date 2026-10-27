import { SubQAdapter, SubQDecisionRequest } from '@/lib/providers/SubQAdapter';
import type { CheckResolution } from '@/lib/types/gameplay';
import { actionsAreSimilar } from '@/lib/engines/game/failForwardEngine';

export type StallingType =
  | 'none'
  | 'repetitive_standoff'
  | 'ignored_success'
  | 'choice_recycling'
  /** Plan 18: a failed check left the same obstacle unchanged (no cost/reveal/etc.). */
  | 'failure_stall';

export interface MomentumEvaluationInput {
  storyTitle: string;
  language?: string;
  priorScenes: string[];
  priorActions: string[];
  playerActionText: string;
  resolution: CheckResolution;
  candidateNarrative: string;
  candidateChoices: Array<{ id?: string; text: string; style?: string }>;
}

export interface MomentumEvaluationResult {
  ok: boolean;
  stallingType: StallingType;
  storyProgressed: boolean;
  confidence?: number;
  reason?: string;
  repairInstruction?: string;
  notes?: string;
  latencyMs?: number;
  skipped?: boolean;
}

export function extractSubQNoul(rawAnswer: any, fallback = true): boolean {
  if (rawAnswer === undefined || rawAnswer === null) return fallback;
  if (typeof rawAnswer === 'boolean') return rawAnswer;
  if (typeof rawAnswer?.noul === 'boolean') return rawAnswer.noul;
  if (typeof rawAnswer?.answer === 'boolean') return rawAnswer.answer;
  if (typeof rawAnswer?.value === 'boolean') return rawAnswer.value;
  if (typeof rawAnswer?.noul?.answer === 'boolean') return rawAnswer.noul.answer;
  if (typeof rawAnswer?.answer === 'string') {
    const s = rawAnswer.answer.trim().toLowerCase();
    if (s === 'true' || s === 'yes') return true;
    if (s === 'false' || s === 'no') return false;
  }
  return fallback;
}

export function extractSubQChoice(rawAnswer: any, fallback: StallingType = 'none'): StallingType {
  if (rawAnswer === undefined || rawAnswer === null) return fallback;
  let str: string | undefined;

  if (typeof rawAnswer === 'string') {
    str = rawAnswer;
  } else if (typeof rawAnswer?.choice === 'string') {
    str = rawAnswer.choice;
  } else if (typeof rawAnswer?.value === 'string') {
    str = rawAnswer.value;
  } else if (typeof rawAnswer?.index === 'number') {
    const categories: StallingType[] = [
      'none',
      'repetitive_standoff',
      'ignored_success',
      'choice_recycling',
      'failure_stall',
    ];
    return categories[rawAnswer.index] ?? fallback;
  }

  if (!str) return fallback;
  const normalized = str.trim().toLowerCase();
  if (normalized.includes('ignored_success') || normalized.includes('ignored')) {
    return 'ignored_success';
  }
  // Plan 18: check the failure-specific label before generic "repetitive" /
  // "standoff" matches so "failure_stall" never collapses into a generic stall.
  if (
    normalized.includes('failure_stall') ||
    normalized.includes('failure') ||
    normalized.includes('failed')
  ) {
    return 'failure_stall';
  }
  if (normalized.includes('choice_recycling') || normalized.includes('recycling')) {
    return 'choice_recycling';
  }
  if (normalized.includes('repetitive_standoff') || normalized.includes('standoff') || normalized.includes('repetitive')) {
    return 'repetitive_standoff';
  }
  if (normalized.includes('none')) {
    return 'none';
  }
  return fallback;
}

export function buildSubQMomentumRequest(
  input: MomentumEvaluationInput,
  modelId = 'subq-snap-preview'
): SubQDecisionRequest {
  const state = {
    task: 'evaluate_narrative_momentum',
    story: {
      title: input.storyTitle,
      language: input.language ?? 'en',
    },
    resolved_outcome: input.resolution.outcome,
    failure_mode: input.resolution.failureMode,
    failure_directive:
      input.language === 'fa'
        ? input.resolution.failureDirective?.fa
        : input.resolution.failureDirective?.en,
    player_action: input.playerActionText,
    mechanical_consequence: input.resolution.consequenceSummary || undefined,
    prior_actions: input.priorActions && input.priorActions.length > 0 ? input.priorActions : undefined,
    prior_scenes: input.priorScenes && input.priorScenes.length > 0 ? input.priorScenes.slice(-2) : undefined,
    candidate_narrative: input.candidateNarrative,
    candidate_choices: (input.candidateChoices || []).map((c) => ({
      text: c.text,
      style: c.style,
    })),
  };

  return {
    model: modelId,
    state,
    questions: {
      story_progressed: {
        type: 'noul',
        instructions:
          'Did the new candidate scene prose advance the physical plot or resolve the bottleneck forward? Answer FALSE if the narrative keeps the characters frozen in the exact same standoff, obstacle, or conversational loop from previous turns without progressing. A deliberate withdrawal that changes the protagonist\'s position, spends time, or lets the threat advance COUNTS as progression — leaving an obstacle intact on purpose is not a stall.',
      },
      has_repetitive_standoff: {
        type: 'noul',
        instructions:
          'Does the scene repeat the exact same guard confrontation, dialogue deadlock, or physical gate obstacle from prior turns without moving forward?',
      },
      has_ignored_success: {
        type: 'noul',
        instructions:
          'Did the player score a success or dramatic victory, yet the prose acts as if the action had no physical effect and the barrier or obstacle remains unpassed?',
      },
      has_choice_recycling: {
        type: 'noul',
        instructions:
          'Do the newly offered choices re-attempt or re-offer actions already completed in prior turns?',
      },
      has_failure_stall: {
        type: 'noul',
        instructions:
          'Only when resolved_outcome is failure or critical_failure: did the prose leave the same failed obstacle exactly in place with no new cost, complication, reveal, reposition, or escalation — and no new information, pressure, price, or opportunity? Answer TRUE for that static failure. Answer FALSE if the failure changed the situation, or if it was an authorized hard stop that revealed why the method is blocked and offered real alternatives.',
      },
    },
  };
}

export function buildMomentumRepairInstruction(
  stallingType: StallingType,
  outcome: string,
  language = 'en'
): string {
  const isFa = language === 'fa' || language === 'persian';

  if (isFa) {
    switch (stallingType) {
      case 'ignored_success':
        return `پیروزی یا موفقیت قاطع بازیکن (${outcome}) در عبور از مانع در متن صحنه متوقف مانده است! فوراً داستان را به جلو ببر: گذر کامل قهرمان و کاروان از معبر/دهانه و ورود به فضای جدید (مانند بازارچه، گذرگاه یا پیامد بعدی) را تصویر کن و در بن‌بست نگهبانان توقف نکن.`;
      case 'choice_recycling':
        return `گزینه‌های ارائه‌شده تکرار تصمیماتی هستند که در نوبت‌های قبل حل و فصل شده‌اند. گزینه‌های پیش‌رو باید کاملاً تازه، روبه‌جلو و متناسب با چالش جدید پس از عبور از مانع باشند.`;
      case 'failure_stall':
        return `شکست، داستان را جلو نبرد: همان مانع شکست‌خورده بدون هیچ هزینه، پیچیدگی، افشا، جابه‌جایی یا تشدید تازه‌ای سر جایش مانده است. صحنه را بازنویسی کن تا شکست قصد بازیکن را رد کند اما وضعیت را عینی تغییر دهد. هدف را محقق نکن، نجات‌دهنده یا خطر اختراع نکن، و همان تلاش را تنها مسیر قرار نده؛ دست‌کم دو گزینه باید رویکردی واقعاً متفاوت را دنبال کنند. اگر موتور توقف کامل را مجاز اعلام کرده، نشان بده چرا این روش کار نمی‌کند و چه چیزی لازم است.`;
      case 'repetitive_standoff':
      default:
        return `صحنه در همان بن‌بست یا گفتگوی تکراری نوبت قبل درجا می‌زند. پیشروی فیزیکی و تغییر موقعیت شخصیت‌ها را با توجه به نتیجه عمل (${outcome}) محقق کن.`;
    }
  }

  switch (stallingType) {
    case 'ignored_success':
      return `The player's decisive outcome (${outcome}) was ignored in the narrative! Immediately advance the plot: describe the protagonist successfully passing through the barrier/gate into the new environment. Do not linger in the resolved standoff.`;
    case 'choice_recycling':
      return `The offered choices repeat actions already completed in prior turns. Provide 3 completely fresh tactical choices relevant to the newly emerged situation.`;
    case 'failure_stall':
      return `The failed action did not move the story: the same obstacle is still in place with no new cost, complication, reveal, reposition, or escalation. Rewrite the scene so the failure denies the intent but changes the situation. Do not grant the goal, do not invent a rescuer or hazard, and do not offer the same attempt as the only path; at least two choices must pursue a genuinely new approach. If the engine authorized a hard stop, show why the method cannot work and what is required.`;
    case 'repetitive_standoff':
    default:
      return `The scene is frozen in a repetitive stalemate from prior turns. Advance the physical coordinates and transition the characters into the next dramatic beat or emerging consequence (${outcome}).`;
  }
}

/**
 * Lightweight heuristic check when SubQ Snap is offline or unconfigured.
 * Detects obvious choice recycling and deadlock loops.
 */
export function evaluateMomentumHeuristics(
  input: MomentumEvaluationInput
): MomentumEvaluationResult {
  const candidateTexts = (input.candidateChoices || []).map((c) => (c.text || '').toLowerCase().trim());
  const priorActions = (input.priorActions || []).map((a) => a.toLowerCase().trim());

  const tokenize = (s: string) => new Set(s.split(/[\s،,.:;!؟?]+/).filter((w) => w.length > 1));

  // Plan 18: on a failed check, the most damaging loop is offering the same
  // failed attempt again. Check this BEFORE generic prior-action recycling so
  // the repair instruction targets the actual problem.
  const isFailureOutcome =
    input.resolution.outcome === 'failure' ||
    input.resolution.outcome === 'critical_failure';
  if (isFailureOutcome) {
    const failedText = (input.playerActionText || '').trim();
    if (failedText.length > 0) {
      // Count genuinely new approaches, not retries: the contract requires at
      // least two new paths (or every offered choice when fewer than two exist).
      const newApproachChoices = candidateTexts.filter(
        (choice) => choice.length < 6 || !actionsAreSimilar(failedText, choice)
      ).length;
      const requiredNewApproaches = Math.min(2, candidateTexts.length);
      if (
        candidateTexts.length > 0 &&
        newApproachChoices < requiredNewApproaches
      ) {
        return {
          ok: false,
          stallingType: 'failure_stall',
          storyProgressed: false,
          confidence: 0.85,
          repairInstruction: buildMomentumRepairInstruction(
            'failure_stall',
            input.resolution.outcome,
            input.language
          ),
          notes: `Heuristic: only ${newApproachChoices}/${candidateTexts.length} choices pursue a new approach (need ${requiredNewApproaches}); the failure did not open enough new paths.`,
          skipped: false,
        };
      }
    }
  }

  // Check choice recycling: if any candidate choice overlaps >= 60% with any completed action
  for (const choice of candidateTexts) {
    if (choice.length < 6) continue;
    const choiceWords = tokenize(choice);
    if (choiceWords.size === 0) continue;

    for (const prior of priorActions) {
      if (prior.length < 6) continue;
      const priorWords = tokenize(prior);
      if (priorWords.size === 0) continue;

      const intersection = [...choiceWords].filter((w) => priorWords.has(w));
      const union = new Set([...choiceWords, ...priorWords]);
      const jaccard = intersection.length / union.size;
      const overlapCoefficient = intersection.length / Math.min(choiceWords.size, priorWords.size);

      if (jaccard >= 0.55 || overlapCoefficient >= 0.7) {
        return {
          ok: false,
          stallingType: 'choice_recycling',
          storyProgressed: false,
          confidence: 0.85,
          repairInstruction: buildMomentumRepairInstruction('choice_recycling', input.resolution.outcome, input.language),
          notes: `Heuristic: choice "${choice.slice(0, 30)}..." overlaps heavily with completed action "${prior.slice(0, 30)}..."`,
          skipped: false,
        };
      }
    }
  }

  return {
    ok: true,
    stallingType: 'none',
    storyProgressed: true,
    skipped: true,
  };
}

/**
 * Evaluates scene momentum using SubQ Snap decision model,
 * with automatic fallback to heuristics if SubQ is unconfigured.
 */
export async function evaluateNarrativeMomentum(
  input: MomentumEvaluationInput,
  adapter?: SubQAdapter,
  options?: { timeoutMs?: number; modelId?: string }
): Promise<MomentumEvaluationResult> {
  const client = adapter ?? new SubQAdapter();

  // If SubQ is not configured (e.g. local dev without API key), run heuristic fallback
  if (!client.isConfigured()) {
    return evaluateMomentumHeuristics(input);
  }

  const modelId = options?.modelId ?? 'subq-snap-preview';
  const request = buildSubQMomentumRequest(input, modelId);
  const response = await client.evaluate(request, { timeoutMs: options?.timeoutMs ?? 5000 });

  if (!response.success) {
    console.warn(`[MomentumGuardrail] SubQ Snap evaluation warning: ${response.error}`);
    return evaluateMomentumHeuristics(input);
  }

  const ans = response.answers;
  const storyProgressed = extractSubQNoul(ans.story_progressed, true);
  const hasIgnoredSuccess = extractSubQNoul(ans.has_ignored_success, false);
  const hasChoiceRecycling = extractSubQNoul(ans.has_choice_recycling, false);
  const hasRepetitiveStandoff = extractSubQNoul(ans.has_repetitive_standoff, false);
  const hasFailureStall = extractSubQNoul(ans.has_failure_stall, false);
  const isFailureOutcome =
    input.resolution.outcome === 'failure' ||
    input.resolution.outcome === 'critical_failure';

  let stallingType: StallingType = 'none';
  if (hasIgnoredSuccess) {
    stallingType = 'ignored_success';
  } else if (isFailureOutcome && hasFailureStall) {
    stallingType = 'failure_stall';
  } else if (hasChoiceRecycling) {
    stallingType = 'choice_recycling';
  } else if (hasRepetitiveStandoff) {
    stallingType = 'repetitive_standoff';
  } else if (ans.stalling_type) {
    stallingType = extractSubQChoice(ans.stalling_type, 'none');
  }

  const isStalled = !storyProgressed || stallingType !== 'none';

  if (!isStalled) {
    return {
      ok: true,
      stallingType: 'none',
      storyProgressed: true,
      latencyMs: response.latencyMs,
      notes: `Evaluated via SubQ Snap (${response.latencyMs ?? 0}ms)`,
    };
  }

  const resolvedStallingType =
    stallingType !== 'none'
      ? stallingType
      : isFailureOutcome
        ? 'failure_stall'
        : 'repetitive_standoff';
  const repairInstruction = buildMomentumRepairInstruction(
    resolvedStallingType,
    input.resolution.outcome,
    input.language
  );

  return {
    ok: false,
    stallingType: resolvedStallingType,
    storyProgressed: false,
    repairInstruction,
    latencyMs: response.latencyMs,
    notes: `Stalling detected via SubQ Snap (${resolvedStallingType}, ${response.latencyMs ?? 0}ms)`,
  };
}
