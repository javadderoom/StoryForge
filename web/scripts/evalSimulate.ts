/**
 * Plan 14 — Tier 4 CLI: autonomous multi-turn playtest simulation.
 *
 * Usage:
 *   npm run eval:simulate
 *   npm run eval:simulate -- --persona=brute --turns=8
 *   npm run eval:simulate -- --persona=boundary --turns=10 --seed=42
 *   npm run eval:simulate -- --live            # use the real model
 *   npm run eval:simulate -- --json
 */

import { runSimulation, PERSONAS, PersonaId } from '@/lib/evals/simulator';

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional (CI passes env directly) */
}
import { defaultSceneModelCall } from '@/lib/engines/narrative/modelCall';

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

async function main(): Promise<void> {
  const persona = (arg('persona') ?? 'brute') as PersonaId;
  if (!PERSONAS[persona]) {
    console.error(`Unknown persona "${persona}". Choose: ${Object.keys(PERSONAS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const turns = Number(arg('turns') ?? '6');
  const seed = Number(arg('seed') ?? '1337');
  const live = flag('live');
  const asJson = flag('json');

  const report = await runSimulation({
    persona,
    turns,
    seed,
    modelCall: live ? defaultSceneModelCall : undefined,
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
    return;
  }

  console.log(
    `\n${DIM}StoryForge playtest simulation — persona=${report.persona} turns=${turns} seed=${seed} mode=${live ? 'LIVE' : 'SYNTHETIC'}${RESET}\n`
  );
  for (const t of report.turns) {
    console.log(
      `  ${DIM}turn ${t.turn}${RESET}  roll ${String(t.diceRoll).padStart(2)}  ${t.outcome.padEnd(16)} hp ${String(t.hp).padStart(2)}  clock ${t.clockSegments}/4  ${DIM}${t.actionText}${RESET}`
    );
  }

  const errors = report.findings.filter((f) => f.severity === 'error');
  const warnings = report.findings.filter((f) => f.severity === 'warning');
  if (errors.length) {
    console.log(`\n${RED}Violations${RESET}`);
    for (const f of errors) console.log(`  ${RED}x${RESET} [${f.rule}] ${f.detail}`);
  }
  if (warnings.length) {
    console.log(`\n${YELLOW}Notes${RESET}`);
    for (const f of warnings) console.log(`  ${YELLOW}!${RESET} [${f.rule}] ${f.detail}`);
  }
  if (!report.findings.length) console.log(`\n${DIM}No trajectory violations.${RESET}`);

  console.log(
    `\n${report.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}  ${report.turns.length} turn(s) audited\n`
  );
  process.exitCode = report.passed ? 0 : 1;
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exitCode = 1;
});
