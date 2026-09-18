import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { SceneModelCall } from '@/lib/engines/narrative/modelCall';
import { evaluateRawScene } from './evaluator';
import { runJudge, JudgeOptions } from './judge';
import { EvalScenario, EvalResult, EvalRunSummary } from './types';

/**
 * Plan 14 — Tier 2/3 runner. Executes golden scenarios through the SAME prompt
 * assembly the production route uses (`PromptAssembler`), feeds the model via an
 * injectable seam, and hands the RAW payload to the Layer-A heuristic evaluator.
 */

export interface RunOptions {
  /** Model id, used for the adapter and as the cassette key. */
  modelId?: string;
  /**
   * Model the API should try FIRST (sent as preferredModel). Omit to use the
   * cascade default. Display/cassette naming still flows through `modelId`.
   */
  evaluatorModel?: string;
  /** Model seam (replay/live). Omit to use the live default cascade. */
  modelCall?: SceneModelCall;
  /** Provenance label for the source of the payload. */
  source?: EvalResult['source'];
  /**
   * Tier 3 Layer B — opt-in LLM-as-a-Judge. Only meaningful when real model
   * output is available (live or cassette); CI runs leave it undefined.
   */
  judge?: JudgeOptions;
}

function isLowBaseFor(envelope: EvalScenario['envelope']): boolean {
  if (envelope.universalBaseValue !== undefined) return envelope.universalBaseValue < 8;
  const stats = envelope.statsConfig;
  if (stats && stats.length) return stats.every((s) => (s.baseValue ?? 10) < 8);
  return false;
}

export async function runScenario(scenario: EvalScenario, options: RunOptions = {}): Promise<EvalResult> {
  const modelId = options.modelId ?? 'default';
  const source: EvalResult['source'] = options.source ?? (options.modelCall ? 'cassette' : 'live');

  const prompt = PromptAssembler.buildNarrativePrompt(scenario.envelope);
  const validStatIds = Object.keys(scenario.envelope.playerStatus.stats || {});
  const isEnglish = scenario.envelope.languageDirective === 'en';
  const isLowBase = isLowBaseFor(scenario.envelope);

  const adapter = new GeminiAdapter(
    undefined,
    modelId,
    options.modelCall ? { modelCall: options.modelCall } : {}
  );
  const { response, raw } = await adapter.generateSceneWithRaw(prompt, {
    preferredModel: options.evaluatorModel ?? modelId,
  });

  if (!raw) {
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      invariant: scenario.invariant,
      modelUsed: null,
      source: 'missing',
      heuristic: {
        passed: false,
        findings: [
          {
            severity: 'error',
            rule: 'cassette.missing',
            detail: `No model output available for model "${modelId}". Record cassettes with \`npm run eval:record\`.`,
          },
        ],
        stats: { choiceCount: 0, dicelessCount: 0, wordCount: 0, checkedDcs: [], rescuedChoices: 0 },
      },
      choices: [],
      narrative: '',
      raw: null,
      passed: false,
    };
  }

  const heuristic = evaluateRawScene(raw.data, {
    expectations: scenario.expectations,
    validStatIds,
    isEnglish,
    isLowBase,
  });

  const judge = options.judge
    ? (await runJudge(scenario, response.narrative, response.choices, heuristic, options.judge)) ?? undefined
    : undefined;

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    invariant: scenario.invariant,
    modelUsed: raw.modelUsed,
    source,
    heuristic,
    choices: response.choices,
    narrative: response.narrative,
    raw: raw.data,
    judge,
    passed: heuristic.passed,
  };
}

export async function runAll(
  scenarios: EvalScenario[],
  options: RunOptions = {}
): Promise<EvalRunSummary> {
  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario, options));
  }
  const skipped = results.filter((r) => r.source === 'missing').length;
  const failed = results.filter((r) => !r.passed && r.source !== 'missing').length;
  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, failed, skipped, results };
}
