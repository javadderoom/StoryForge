import { EvalScenario, HeuristicReport, JudgeScore } from './types';
import { ChoiceOption } from '@/lib/types/gameplay';
import { SubQAdapter, SubQDecisionRequest } from '@/lib/providers/SubQAdapter';

export interface SubQJudgeOptions {
  adapter?: SubQAdapter;
  modelId?: string;
  timeoutMs?: number;
}

const RUBRIC_TIERS = {
  causeEffect: [
    '1 - Completely ignores the player action and prior outcome',
    '2 - Weak or delayed mention of the action with detached focus',
    '3 - Adequately acknowledges the action but lacks direct punch',
    '4 - Solid kinetic depiction of the action and immediate reaction',
    '5 - Flawless, visceral cause-and-effect depicting exact action and direct consequence',
  ],
  feasibility: [
    '1 - Unfeasible, absurd or violates physical constraints',
    '2 - Questionable feasibility with significant plot holes',
    '3 - Acceptable feasibility with minor stretches',
    '4 - Good realistic choices fitting the context',
    '5 - Perfectly grounded in protagonist attributes, gear, and world constraints',
  ],
  divergence: [
    '1 - All choices are minor cosmetic rewordings of the exact same action',
    '2 - Poor variety; choices overlap heavily in tactical intent',
    '3 - Moderate variety with at least two distinct approaches',
    '4 - Strong tactical divergence across multiple distinct philosophies',
    '5 - Exceptional variety offering mutually exclusive strategic paths',
  ],
  polish: [
    '1 - Cliché-ridden, flat, wooden dialogue, stock AI prose',
    '2 - Repetitive phrasing, bland voice, frequent clichés',
    '3 - Competent prose with decent atmosphere',
    '4 - Evocative, atmospheric, distinctive NPC dialogue',
    '5 - Masterful literary prose, rich sensory anchors, memorable dialogue',
  ],
};

export function buildSubQJudgeRequest(
  scenario: EvalScenario,
  narrative: string,
  choices: ChoiceOption[],
  heuristic: HeuristicReport,
  modelId = 'subq-snap-preview'
): SubQDecisionRequest {
  const state = [
    `[SCENARIO] ${scenario.id} — ${scenario.title}`,
    `[INVARIANT UNDER TEST] ${scenario.invariant}`,
    `[LANGUAGE] ${scenario.language}`,
    `[PLAYER ACTION] ${scenario.envelope.resolvedGameOutcome?.actionText ?? '(none)'}`,
    `[RESOLVED OUTCOME] ${scenario.envelope.resolvedGameOutcome?.outcome ?? '(none)'}`,
    `[RESOLVED CONSEQUENCE] ${scenario.envelope.resolvedGameOutcome?.consequence ?? '(none)'}`,
    '',
    `[PROSE]\n${narrative}`,
    '',
    `[CHOICES]\n${choices
      .map(
        (c, i) =>
          `${i + 1}. ${c.text}${c.requiredStatId ? ` [${c.requiredStatId} DC ${c.targetDC}]` : ' [diceless]'}`
      )
      .join('\n')}`,
    '',
    `[LAYER-A FINDINGS] ${
      heuristic.findings.length
        ? heuristic.findings.map((f) => `${f.rule}: ${f.detail}`).join(' | ')
        : 'none'
    }`,
  ].join('\n');

  return {
    model: modelId,
    state,
    questions: {
      causeEffect: {
        type: 'score',
        instructions:
          "Did the opening paragraph immediately depict the player's prior action and the direct reaction of the target NPC/environment?",
        criteria: RUBRIC_TIERS.causeEffect,
      },
      feasibility: {
        type: 'score',
        instructions:
          "Are the proposed choices feasible given the protagonist's actual attributes, health, and carried gear?",
        criteria: RUBRIC_TIERS.feasibility,
      },
      divergence: {
        type: 'score',
        instructions:
          'Do the choices offer genuinely distinct strategic philosophies (combat vs. stealth vs. diplomacy vs. environmental leverage) rather than superficial cosmetic variations of the same intent?',
        criteria: RUBRIC_TIERS.divergence,
      },
      polish: {
        type: 'score',
        instructions:
          'Is the prose sensory-rich and evocative, free of stock AI clichés, and do NPCs speak with authentic, characterful voices?',
        criteria: RUBRIC_TIERS.polish,
      },
    },
  };
}

/**
 * Extracts and clamps a 1-5 integer score from a SubQ question answer.
 * Handles ordinal 0-indexed scores (0..4 -> 1..5) or 1-indexed scores (1..5).
 */
export function extractSubQScore(rawAnswer: any, fallback = 3): number {
  if (rawAnswer === undefined || rawAnswer === null) return fallback;

  let val: number | undefined;

  if (typeof rawAnswer === 'number') {
    val = rawAnswer;
  } else if (typeof rawAnswer?.score === 'number') {
    val = rawAnswer.score;
  } else if (typeof rawAnswer?.value === 'number') {
    val = rawAnswer.value;
  } else if (typeof rawAnswer?.index === 'number') {
    // 0-indexed tier index in criteria array
    val = rawAnswer.index + 1;
  } else if (typeof rawAnswer?.score === 'string') {
    const num = parseFloat(rawAnswer.score);
    if (!Number.isNaN(num)) val = num;
  }

  if (val === undefined || Number.isNaN(val)) return fallback;

  return Math.min(5, Math.max(1, Math.round(val)));
}

/**
 * Runs evaluation via SubQ Snap decision model.
 */
export async function runSubQJudge(
  scenario: EvalScenario,
  narrative: string,
  choices: ChoiceOption[],
  heuristic: HeuristicReport,
  options?: SubQJudgeOptions
): Promise<JudgeScore | null> {
  const adapter = options?.adapter ?? new SubQAdapter();
  if (!adapter.isConfigured()) {
    return null;
  }

  const modelId = options?.modelId ?? 'subq-snap-preview';
  const request = buildSubQJudgeRequest(scenario, narrative, choices, heuristic, modelId);
  const response = await adapter.evaluate(request, { timeoutMs: options?.timeoutMs ?? 8000 });

  if (!response.success) {
    console.warn(`SubQ Judge evaluation failed: ${response.error}`);
    return null;
  }

  const ans = response.answers;

  const causeEffect = extractSubQScore(ans.causeEffect);
  const feasibility = extractSubQScore(ans.feasibility);
  const divergence = extractSubQScore(ans.divergence);
  const polish = extractSubQScore(ans.polish);

  return {
    model: response.model || modelId,
    scores: {
      causeEffect,
      feasibility,
      divergence,
      polish,
    },
    notes: `Evaluated via SubQ Snap (${response.latencyMs ?? 0}ms)`,
  };
}
