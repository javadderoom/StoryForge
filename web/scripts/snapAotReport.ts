/**
 * Plan 15 §2.3 tier 4 — Snap-gated AOT shadow analysis (CLI).
 *
 * Reads `snap_decision_logs` (render-time prediction vs. actual tap) and
 * `snap_aot_branches` (pre-written branches) and reports the AOT gate picture:
 * the measured hit rate over resolved predictions, branch reliability/latency,
 * and what promoting serving WOULD have done (would-serve / wasted spend).
 * Promotion of live serving stays gated on the measured hit rate over
 * `snap_decision_logs` — this report is the evidence, not the switch.
 *
 * Usage:
 *   npm run aot:report
 *   npm run aot:report -- --limit=100
 *   npm run aot:report -- --session=<sessionId>
 *   npm run aot:report -- --json
 */

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional (CI passes env directly) */
}
import { getPrisma } from '@/lib/db/client';

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

async function main() {
  const limit = Math.max(1, Number(arg('limit') ?? '50') || 50);
  const sessionFilter = arg('session');
  const asJson = flag('json');

  const prisma = getPrisma();
  if (!prisma) {
    console.error(`${RED}ENABLE_DB is not "true" — nothing to analyze.${RESET}`);
    process.exit(1);
  }

  const where = sessionFilter ? { sessionId: sessionFilter } : {};
  const [decisions, branches] = await Promise.all([
    prisma.snapDecisionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.snapAotBranch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  const resolved = decisions.filter((d) => d.hit !== null);
  const hits = resolved.filter((d) => d.hit === true).length;
  const misses = resolved.filter((d) => d.hit === false).length;
  const pending = decisions.length - resolved.length;
  const hitRate = resolved.length ? Math.round((hits / resolved.length) * 1000) / 10 : null;

  const statusCounts: Record<string, number> = {};
  for (const b of branches) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
  const generated = branches.filter((b) => b.status === 'generated');
  const avgGenLatency = generated.length
    ? Math.round(generated.reduce((sum, b) => sum + (b.latencyMs ?? 0), 0) / generated.length)
    : null;
  const models: Record<string, number> = {};
  for (const b of generated) {
    const m = b.model ?? 'unknown';
    models[m] = (models[m] ?? 0) + 1;
  }

  // Gate matrix: join each prediction with the branch that exists for it.
  const generatedKeys = new Set(generated.map((b) => `${b.sessionId}:${b.turnNumber}`));
  const anyBranchKeys = new Set(branches.map((b) => `${b.sessionId}:${b.turnNumber}`));
  let wouldServe = 0;
  let hitWithoutBranch = 0;
  let wastedSpend = 0;
  let savedSpend = 0;
  let pendingBranch = 0;
  for (const d of decisions) {
    const key = `${d.sessionId}:${d.turnNumber}`;
    const hasGenerated = generatedKeys.has(key);
    if (d.hit === true) {
      if (hasGenerated) wouldServe += 1;
      else hitWithoutBranch += 1;
    } else if (d.hit === false) {
      if (hasGenerated) wastedSpend += 1;
      else savedSpend += 1;
    } else if (anyBranchKeys.has(key)) {
      pendingBranch += 1;
    }
  }

  const summary = {
    window: { limit, session: sessionFilter ?? null },
    predictions: { total: decisions.length, resolved: resolved.length, hits, misses, pending, hitRate },
    branches: {
      total: branches.length,
      byStatus: statusCounts,
      generated: generated.length,
      avgGenerationLatencyMs: avgGenLatency,
      models,
    },
    gate: { wouldServe, hitWithoutBranch, wastedSpend, savedSpend, pendingBranch },
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log(`\n${DIM}Plan 15 §2.3 — Snap dwell report (AOT shadow mode)${RESET}`);
  if (sessionFilter) console.log(`${DIM}session filter: ${sessionFilter}${RESET}`);

  console.log(
    `\nPredictions (last ${limit}): ${decisions.length} rows | resolved ${resolved.length} | ` +
      `${GREEN}hit ${hits}${RESET} / ${RED}miss ${misses}${RESET} | pending ${pending} | ` +
      `hit rate ${hitRate === null ? 'n/a' : `${hitRate}%`}`
  );

  const statusLine = Object.entries(statusCounts)
    .map(([k, v]) => `${k} ${v}`)
    .join(' | ');
  console.log(
    `AOT branches   (last ${limit}): ${branches.length} rows${statusLine ? ` | ${statusLine}` : ''}` +
      (avgGenLatency !== null ? ` | avg generation ${avgGenLatency} ms` : '')
  );
  if (generated.length) {
    const modelLine = Object.entries(models)
      .map(([k, v]) => `${k} x${v}`)
      .join(', ');
    console.log(`${DIM}  models: ${modelLine}${RESET}`);
  }

  if (branches.length === 0) {
    console.log(
      `\n${YELLOW}No pre-written branches found.${RESET} AOT generation is opt-in and off by ` +
        `default — add ${GREEN}ENABLE_SNAP_AOT=true${RESET} to web/.env to start collecting.`
    );
  }

  console.log(`\nGate matrix (resolved predictions, would-serve = hit AND branch ready):`);
  console.log(`  ${DIM}hit  + branch${RESET}   would-serve        ${wouldServe}`);
  console.log(`  ${DIM}hit  + none${RESET}     no branch ready    ${hitWithoutBranch}`);
  console.log(`  ${DIM}miss + branch${RESET}   wasted generation  ${wastedSpend}`);
  console.log(`  ${DIM}miss + none${RESET}     saved spend        ${savedSpend}`);
  if (pendingBranch > 0) console.log(`  ${DIM}pending + branch${RESET} dwell in progress  ${pendingBranch}`);

  const branchByKey = new Map(branches.map((b) => [`${b.sessionId}:${b.turnNumber}`, b]));
  const rows = decisions.slice(0, 20);
  if (rows.length) {
    console.log(`\n${DIM}Recent predictions:${RESET}`);
    console.log(
      `${DIM}  turn sessions  predicted        actual           hit   dice  outcome          branch                 ms${RESET}`
    );
    for (const d of rows) {
      const b = branchByKey.get(`${d.sessionId}:${d.turnNumber}`);
      const hitMark =
        d.hit === true
          ? `${GREEN}hit ${RESET}`
          : d.hit === false
            ? `${RED}miss${RESET}`
            : `${DIM}--  ${RESET}`;
      console.log(
        `  ${String(d.turnNumber).padStart(4)} ${String(d.sessionId).slice(0, 6).padEnd(8)} ` +
          `${String(d.predictedChoiceId ?? '—').slice(0, 14).padEnd(16)} ` +
          `${String(d.actualChoiceId ?? (d.actualActionText ? '(free text)' : '—')).slice(0, 14).padEnd(16)} ` +
          `${hitMark}  ${String(b?.diceRoll ?? '—').padStart(4)}  ` +
          `${String(b?.outcome ?? '—').slice(0, 15).padEnd(15)} ` +
          `${String(b?.status ?? '—').slice(0, 20).padEnd(20)} ` +
          `${String(b?.latencyMs ?? '—')}`
      );
    }
  }

  console.log('');
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
