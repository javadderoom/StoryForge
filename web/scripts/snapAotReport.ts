/**
 * Plan 15 §2.3 tier 4 — Snap-gated AOT shadow analysis (CLI).
 *
 * Reads `snap_decision_logs` (render-time prediction vs. actual tap) and
 * `snap_aot_branches` (pre-written branches + §7.6E audits) and reports the
 * AOT picture: the measured hit rate over resolved predictions, branch
 * reliability/latency, the promotion matrix (would-serve vs wasted spend), and
 * the shadow AUDIT — what the writer got wrong on the pre-generated turn
 * (first-draft mistakes, repairs, surviving findings, verdicts).
 * Promotion of live serving stays gated on the measured hit rate over
 * `snap_decision_logs` — this report is the evidence, not the switch.
 *
 * Usage:
 *   npm run aot:report
 *   npm run aot:report -- --limit=100
 *   npm run aot:report -- --session=<sessionId>
 *   npm run aot:report -- --flagged            (warned/rejected branches + top findings)
 *   npm run aot:report -- --branch=<branchId>  (full dump: prose, choices, audit, resolution)
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
import type { AotBranchAudit } from '@/lib/engines/narrative/aotBranchAudit';

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
  const branchId = arg('branch');
  const flagged = flag('flagged');

  const prisma = getPrisma();
  if (!prisma) {
    console.error(`${RED}ENABLE_DB is not "true" — nothing to analyze.${RESET}`);
    process.exit(1);
  }

  // Single-branch inspector: full dump (prose, choices, audit, resolution).
  if (branchId) {
    const branch = await prisma.snapAotBranch.findUnique({ where: { id: branchId } });
    if (!branch) {
      console.error(`${RED}No snap_aot_branches row with id "${branchId}".${RESET}`);
      await prisma.$disconnect();
      process.exit(1);
    }
    const audit = branch.audit as unknown as AotBranchAudit | null;
    const resolution = branch.resolution as Record<string, unknown> | null;

    console.log(`\n${DIM}Snap AOT branch dump — ${branch.id}${RESET}`);
    console.log(
      `session ${branch.sessionId} | turn ${branch.turnNumber} | status ${branch.status} | ` +
        `verdict ${branch.verdict ?? '—'} | model ${branch.model ?? '—'} | ${branch.latencyMs ?? '—'} ms`
    );
    console.log(
      `predicted choice "${branch.choiceText ?? '—'}" (${branch.predictedChoiceId}) | ` +
        `dice ${branch.isDiceless ? 'diceless' : (branch.diceRoll ?? '—')} | outcome ${branch.outcome ?? '—'}`
    );
    if (branch.error) console.log(`${RED}error: ${branch.error}${RESET}`);

    if (audit) {
      console.log(`\n${DIM}Audit (${audit.verdict}):${RESET}`);
      for (const finding of audit.findings) {
        const color = finding.severity === 'error' ? RED : finding.severity === 'warning' ? YELLOW : DIM;
        console.log(
          `  ${color}${finding.severity.padEnd(7)}${RESET} [${finding.category}] (${finding.source}) ${finding.detail}`
        );
      }
      console.log(`${DIM}  stats: ${JSON.stringify(audit.stats)}${RESET}`);
    } else {
      console.log(`${DIM}No audit report on this row.${RESET}`);
    }

    if (branch.narrative) {
      console.log(`\n${DIM}Prose (${branch.narrative.length} chars):${RESET}\n${branch.narrative}`);
    }
    const choices = branch.choices as Array<{ id?: string; text?: string; style?: string; riskLevel?: string }>;
    if (Array.isArray(choices) && choices.length) {
      console.log(`\n${DIM}Choices:${RESET}`);
      for (const c of choices) {
        console.log(`  • [${c.style ?? '—'}/${c.riskLevel ?? '—'}] ${c.text ?? '—'} (${c.id ?? '?'})`);
      }
    }
    if (resolution) {
      console.log(
        `\n${DIM}Resolution:${RESET} outcome ${resolution.outcome ?? '—'} | ` +
          `dice ${resolution.diceRoll ?? '—'} ${resolution.diceType ?? ''} | ` +
          `DC ${resolution.difficultyClass ?? '—'} | total ${resolution.totalScore ?? '—'}`
      );
      if (resolution.consequenceSummary) {
        console.log(`${DIM}  consequence:${RESET} ${resolution.consequenceSummary}`);
      }
      if (resolution.stateDiff) {
        console.log(`${DIM}  stateDiff:${RESET} ${JSON.stringify(resolution.stateDiff)}`);
      }
    }

    console.log('');
    await prisma.$disconnect();
    return;
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
  const servedCount = branches.filter((b) => b.servedAt !== null).length;
  const avgGenLatency = generated.length
    ? Math.round(generated.reduce((sum, b) => sum + (b.latencyMs ?? 0), 0) / generated.length)
    : null;
  const models: Record<string, number> = {};
  for (const b of generated) {
    const m = b.model ?? 'unknown';
    models[m] = (models[m] ?? 0) + 1;
  }

  // §7.6E audit aggregation: verdicts + mistake telemetry across stored branches.
  const verdictCounts: Record<string, number> = {};
  const findingsByCategory: Record<string, number> = {};
  let auditedBranches = 0;
  let firstPassErrorBranches = 0;
  let repairedBranches = 0;
  let judgeEvaluated = 0;
  let judgeSkippedCount = 0;
  let judgeFindings = 0;
  for (const b of branches) {
    const audit = b.audit as unknown as AotBranchAudit | null;
    if (!audit || typeof audit !== 'object' || !Array.isArray(audit.findings)) continue;
    auditedBranches += 1;
    verdictCounts[audit.verdict] = (verdictCounts[audit.verdict] ?? 0) + 1;
    if ((audit.stats?.firstPassErrors ?? 0) > 0) firstPassErrorBranches += 1;
    if (audit.stats?.proseRepaired) repairedBranches += 1;
    // §7.6G judge coverage: a skipped pass is not a clean bill, so it is
    // counted separately from an evaluated one.
    if (audit.stats?.judgeSkipped) {
      judgeSkippedCount += 1;
    } else if (typeof audit.stats?.judgeFindings === 'number') {
      judgeEvaluated += 1;
      judgeFindings += audit.stats.judgeFindings;
    }
    for (const finding of audit.findings) {
      if (finding.severity === 'info') continue;
      findingsByCategory[finding.category] = (findingsByCategory[finding.category] ?? 0) + 1;
    }
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
    audit: {
      branchesAudited: auditedBranches,
      byVerdict: verdictCounts,
      firstDraftFailed: firstPassErrorBranches,
      repaired: repairedBranches,
      findingsByCategory,
      judge: { evaluated: judgeEvaluated, skipped: judgeSkippedCount, findings: judgeFindings },
    },
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
      (avgGenLatency !== null ? ` | avg generation ${avgGenLatency} ms` : '') +
      ` | ${GREEN}served ${servedCount}${RESET}`
  );
  if (generated.length) {
    const modelLine = Object.entries(models)
      .map(([k, v]) => `${k} x${v}`)
      .join(', ');
    console.log(`${DIM}  models: ${modelLine}${RESET}`);
  }

  if (auditedBranches > 0) {
    const verdictLine = (['clean', 'repaired', 'warned', 'rejected'] as const)
      .map((v) => `${v} ${verdictCounts[v] ?? 0}`)
      .join(' | ');
    console.log(
      `Branch audit   (last ${limit}): ${verdictLine}` +
        (auditedBranches < branches.length ? ` | no audit ${branches.length - auditedBranches}` : '')
    );
    const categoryLine = Object.entries(findingsByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    console.log(
      `${DIM}  first-draft mistakes on ${firstPassErrorBranches} branch(es) (repaired by the pipeline); ` +
        `surviving flags: ${categoryLine || 'none'}${RESET}`
    );
    if (judgeEvaluated > 0 || judgeSkippedCount > 0) {
      console.log(
        `${DIM}  §7.6G judge (SNAP_AOT_JUDGE): evaluated ${judgeEvaluated} (findings ${judgeFindings}) | ` +
          `skipped ${judgeSkippedCount} — skipped is not a clean bill${RESET}`
      );
    }
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

  if (flagged) {
    const flaggedRows = branches
      .filter((b) => b.verdict === 'warned' || b.verdict === 'rejected')
      .slice(0, 15);
    console.log(`\n${DIM}Flagged branches (warned/rejected, newest first):${RESET}`);
    if (!flaggedRows.length) {
      console.log(`  ${GREEN}none${RESET}`);
    }
    for (const b of flaggedRows) {
      const audit = b.audit as unknown as AotBranchAudit | null;
      const highlights = (audit?.findings ?? [])
        .filter((finding) => finding.severity !== 'info')
        .slice(0, 2)
        .map((finding) => `[${finding.category}] (${finding.source}) ${finding.detail}`)
        .join('  ||  ');
      const color = b.verdict === 'rejected' ? RED : YELLOW;
      console.log(
        `  ${color}${String(b.verdict).padEnd(9)}${RESET} ${b.id} turn ${b.turnNumber} ` +
          `${DIM}${String(b.predictedChoiceId).slice(0, 20)}${RESET}`
      );
      console.log(`    ${DIM}${highlights || b.error || '—'}${RESET}`);
    }
  }

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
