/**
 * Plan 14 — Tier 2 CLI runner.
 *
 * Usage:
 *   npm run eval:narrative                       # replay cassettes (free)
 *   npm run eval:narrative -- --live             # call the real model (costs credits)
 *   npm run eval:narrative -- --live --record    # live + write cassettes
 *   npm run eval:narrative -- --model=gemini-3.5-flash-lite
 *   npm run eval:narrative -- --scenario=eval_standoff_sentry
 *   npm run eval:narrative -- --json             # machine-readable output
 */

import { EVAL_SCENARIOS } from '@/lib/evals/evalScenarios';

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional (CI passes env directly) */
}
import { runScenario } from '@/lib/evals/evalRunner';
import { replaySceneModelCall, missingSceneModelCall, recordSceneModelCall } from '@/lib/evals/modelReplay';
import { loadCassette, saveCassette } from '@/lib/evals/cassetteStore';
import { defaultSceneModelCall, SceneModelCall } from '@/lib/engines/narrative/modelCall';
import { EvalResult } from '@/lib/evals/types';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function render(result: EvalResult): string {
  const badge = result.source === 'missing' ? `${YELLOW}SKIP${RESET}` : result.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const stat = result.heuristic.stats;
  const lines = [
    `  ${badge}  ${result.scenarioId} ${DIM}(${result.modelUsed ?? 'no model'}, ${result.source})${RESET}`,
    `        ${DIM}choices=${stat.choiceCount} diceless=${stat.dicelessCount} words=${stat.wordCount} rescued=${stat.rescuedChoices}${RESET}`,
  ];
  for (const f of result.heuristic.findings) {
    const color = f.severity === 'error' ? RED : YELLOW;
    lines.push(`        ${color}${f.severity === 'error' ? 'x' : '!'} [${f.rule}]${RESET} ${f.detail}`);
  }
  if (result.judge) {
    const s = result.judge.scores;
    lines.push(
      `        ${DIM}judge(${result.judge.model}): cause=${s.causeEffect} feas=${s.feasibility} div=${s.divergence} polish=${s.polish}${RESET}`
    );
    if (result.judge.notes) lines.push(`        ${DIM}${result.judge.notes}${RESET}`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const live = flag('live');
  const record = flag('record');
  const judgeEnabled = flag('judge') || process.env.EVAL_JUDGE === '1';
  // Never send the CLI's display-only fallback id to the API: preferredModel is
  // matched literally against the cascade, so fall back to the queue default.
  const modelArg = arg('model');
  const modelId = modelArg ?? 'gemini-3.5-flash-lite';
  const evaluatorModel = modelArg; // undefined => cascade default
  const only = arg('scenario');
  const asJson = flag('json');

  const scenarios = only ? EVAL_SCENARIOS.filter((s) => s.id === only) : EVAL_SCENARIOS;
  if (!scenarios.length) {
    console.error(`No scenario matched "${only}".`);
    process.exitCode = 1;
    return;
  }

  if (!asJson) {
    console.log(`\n${DIM}StoryForge narrative evals — model=${modelId} mode=${live ? 'LIVE' : 'REPLAY'}${judgeEnabled ? ' judge=on' : ''}${RESET}\n`);
  }

  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    let modelCall: SceneModelCall;
    if (live) {
      modelCall = record
        ? recordSceneModelCall(defaultSceneModelCall, (r) => saveCassette(modelId, scenario.id, r.data))
        : defaultSceneModelCall;
    } else {
      const cassette = loadCassette(modelId, scenario.id);
      modelCall = cassette ? replaySceneModelCall(cassette, modelId) : missingSceneModelCall();
    }
    const result = await runScenario(scenario, {
      modelId,
      evaluatorModel,
      modelCall,
      source: live ? 'live' : 'cassette',
      judge: judgeEnabled ? { modelCall: defaultSceneModelCall, modelId: 'judge' } : undefined,
    });
    results.push(result);
    if (!asJson) console.log(`\n${result.invariant}\n${render(result)}`);
  }

  const passed = results.filter((r) => r.passed).length;
  const skipped = results.filter((r) => r.source === 'missing').length;
  const failed = results.length - passed - skipped;

  if (asJson) {
    console.log(JSON.stringify({ modelId, passed, failed, skipped, results }, null, 2));
  } else {
    console.log(
      `\n${DIM}────────────────────────────────────────${RESET}\n` +
        `  ${GREEN}passed ${passed}${RESET}  ${failed ? RED : DIM}failed ${failed}${RESET}  ${skipped ? YELLOW : DIM}skipped ${skipped}${RESET}  of ${results.length}\n`
    );
    if (skipped && !live) {
      console.log(`${YELLOW}No cassettes found for model "${modelId}".${RESET} Record them with: npm run eval:record\n`);
    }
  }

  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error('Eval runner failed:', err);
  process.exitCode = 1;
});
