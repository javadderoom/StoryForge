import { z } from 'zod';
import { GenerationPromptPayload } from '@/lib/engines/narrative/PromptAssembler';
import { SceneModelCall } from '@/lib/engines/narrative/modelCall';
import { ChoiceOption } from '@/lib/types/gameplay';
import { EvalScenario, HeuristicReport, JudgeScore } from './types';

/**
 * Plan 14 — Tier 3 Layer B: LLM-as-a-Judge.
 *
 * A lightweight frontier model scores the scene on four literary/mechanical
 * axes (1-5). This complements the deterministic Layer-A rules: Layer A proves
 * rules were obeyed, Layer B judges whether the prose and choices are actually
 * good. Enabled explicitly (CLI `--judge` / `EVAL_JUDGE=1`) so CI stays free.
 */

export const JUDGE_SCHEMA = z.object({
  causeEffect: z.number().min(1).max(5),
  feasibility: z.number().min(1).max(5),
  divergence: z.number().min(1).max(5),
  polish: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export const JUDGE_RUBRIC = [
  'causeEffect — Did the opening paragraph immediately depict the player\'s prior action and the direct reaction of the target NPC/environment?',
  'feasibility — Are the proposed choices feasible given the protagonist\'s actual attributes, health, and carried gear?',
  'divergence — Do the choices offer meaningfully different approaches (combat vs. stealth vs. diplomacy vs. investigation)?',
  'polish — Is the prose immersive, evocative, and free of generic AI tropes such as "The choice is yours"?',
].join('\n');

export interface JudgeOptions {
  modelCall: SceneModelCall;
  modelId?: string;
}

export function buildJudgePrompt(
  scenario: EvalScenario,
  narrative: string,
  choices: ChoiceOption[],
  heuristic: HeuristicReport
): GenerationPromptPayload {
  const systemPrompt =
    'You are an impartial literary and game-design judge for an interactive RPG novel. ' +
    'Score the scene strictly on the rubric. Respond ONLY with JSON matching: ' +
    '{"causeEffect":1-5,"feasibility":1-5,"divergence":1-5,"polish":1-5,"notes":"short reason"}';

  const userPrompt = [
    `[SCENARIO] ${scenario.id} — ${scenario.title}`,
    `[INVARIANT UNDER TEST] ${scenario.invariant}`,
    `[LANGUAGE] ${scenario.language}`,
    `[PLAYER ACTION] ${scenario.envelope.resolvedGameOutcome?.actionText ?? '(none)'}`,
    `[RESOLVED OUTCOME] ${scenario.envelope.resolvedGameOutcome?.outcome ?? '(none)'}`,
    `[RESOLVED CONSEQUENCE] ${scenario.envelope.resolvedGameOutcome?.consequence ?? '(none)'}`,
    '',
    `[PROSE]\n${narrative}`,
    '',
    `[CHOICES]\n${choices.map((c, i) => `${i + 1}. ${c.text}${c.requiredStatId ? ` [${c.requiredStatId} DC ${c.targetDC}]` : ' [diceless]'}`).join('\n')}`,
    '',
    `[LAYER-A FINDINGS] ${heuristic.findings.length ? heuristic.findings.map((f) => `${f.rule}: ${f.detail}`).join(' | ') : 'none'}`,
    '',
    `[RUBRIC]\n${JUDGE_RUBRIC}`,
    '',
    'Return the JSON object only.',
  ].join('\n');

  return {
    systemPrompt,
    userPrompt,
    isEnglish: true,
  };
}

/** Parse and clamp a judge response into a `JudgeScore` (null when invalid). */
export function parseJudge(data: unknown, modelId: string): JudgeScore | null {
  const parsed = JUDGE_SCHEMA.safeParse(data);
  if (!parsed.success) return null;
  const v = parsed.data;
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
  return {
    model: modelId,
    scores: {
      causeEffect: clamp(v.causeEffect),
      feasibility: clamp(v.feasibility),
      divergence: clamp(v.divergence),
      polish: clamp(v.polish),
    },
    notes: v.notes,
  };
}

export async function runJudge(
  scenario: EvalScenario,
  narrative: string,
  choices: ChoiceOption[],
  heuristic: HeuristicReport,
  options: JudgeOptions
): Promise<JudgeScore | null> {
  const modelId = options.modelId ?? 'judge';
  const prompt = buildJudgePrompt(scenario, narrative, choices, heuristic);
  const raw = await options.modelCall(prompt);
  if (!raw || !raw.data) return null;
  return parseJudge(raw.data, modelId);
}
