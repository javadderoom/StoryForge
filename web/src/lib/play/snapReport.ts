import type { AotBranchAudit } from '@/lib/engines/narrative/aotBranchAudit';

/**
 * Pure aggregation behind the Studio → Snap Analytics page. Kept separate
 * from Prisma so the hit/miss + gate matrix maths can be tested offline.
 *
 * Hit semantics (Plan 15 §2.3): a prediction is a hit only when the reader
 * tapped the predicted choice. A different choice or free text is a miss; a
 * row the reader never answered is pending, not a miss.
 */

export interface SnapDecisionLike {
  sessionId: string;
  turnNumber: number;
  hit: boolean | null;
}

export interface SnapBranchLike {
  sessionId: string;
  turnNumber: number;
  status: string;
  verdict?: string | null;
  latencyMs?: number | null;
  model?: string | null;
  audit?: unknown;
}

export interface SnapReportSummary {
  predictions: {
    total: number;
    resolved: number;
    hits: number;
    misses: number;
    pending: number;
    /** Percentage with one decimal, or null when nothing has resolved yet. */
    hitRate: number | null;
  };
  branches: {
    total: number;
    byStatus: Record<string, number>;
    generated: number;
    avgGenerationLatencyMs: number | null;
    models: Record<string, number>;
  };
  gate: {
    wouldServe: number;
    hitWithoutBranch: number;
    wastedSpend: number;
    savedSpend: number;
    pendingBranch: number;
  };
  audit: {
    branchesAudited: number;
    byVerdict: Record<string, number>;
    firstDraftFailed: number;
    repaired: number;
    findingsByCategory: Record<string, number>;
    judge: {
      evaluated: number;
      skipped: number;
      findings: number;
    };
  };
}

function asAudit(value: unknown): AotBranchAudit | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AotBranchAudit>;
  if (!Array.isArray(candidate.findings)) return null;
  return candidate as AotBranchAudit;
}

export function summarizeSnapReport(
  decisions: readonly SnapDecisionLike[],
  branches: readonly SnapBranchLike[]
): SnapReportSummary {
  const resolved = decisions.filter((d) => d.hit !== null);
  const hits = resolved.filter((d) => d.hit === true).length;
  const misses = resolved.filter((d) => d.hit === false).length;
  const pending = decisions.length - resolved.length;
  const hitRate = resolved.length
    ? Math.round((hits / resolved.length) * 1000) / 10
    : null;

  const byStatus: Record<string, number> = {};
  for (const branch of branches) {
    byStatus[branch.status] = (byStatus[branch.status] ?? 0) + 1;
  }

  const generated = branches.filter((branch) => branch.status === 'generated');
  const avgGenerationLatencyMs = generated.length
    ? Math.round(
        generated.reduce((sum, branch) => sum + (branch.latencyMs ?? 0), 0) /
          generated.length
      )
    : null;
  const models: Record<string, number> = {};
  for (const branch of generated) {
    const model = branch.model ?? 'unknown';
    models[model] = (models[model] ?? 0) + 1;
  }

  const byVerdict: Record<string, number> = {};
  const findingsByCategory: Record<string, number> = {};
  let branchesAudited = 0;
  let firstDraftFailed = 0;
  let repaired = 0;
  let judgeEvaluated = 0;
  let judgeSkipped = 0;
  let judgeFindings = 0;

  for (const branch of branches) {
    const audit = asAudit(branch.audit);
    if (!audit) continue;
    branchesAudited += 1;
    byVerdict[audit.verdict] = (byVerdict[audit.verdict] ?? 0) + 1;
    if ((audit.stats?.firstPassErrors ?? 0) > 0) firstDraftFailed += 1;
    if (audit.stats?.proseRepaired) repaired += 1;
    // A skipped judge is not a clean bill — count it separately.
    if (audit.stats?.judgeSkipped) {
      judgeSkipped += 1;
    } else if (typeof audit.stats?.judgeFindings === 'number') {
      judgeEvaluated += 1;
      judgeFindings += audit.stats.judgeFindings;
    }
    for (const finding of audit.findings) {
      if (finding.severity === 'info') continue;
      findingsByCategory[finding.category] =
        (findingsByCategory[finding.category] ?? 0) + 1;
    }
  }

  const generatedKeys = new Set(
    generated.map((branch) => `${branch.sessionId}:${branch.turnNumber}`)
  );
  const anyBranchKeys = new Set(
    branches.map((branch) => `${branch.sessionId}:${branch.turnNumber}`)
  );
  let wouldServe = 0;
  let hitWithoutBranch = 0;
  let wastedSpend = 0;
  let savedSpend = 0;
  let pendingBranch = 0;

  for (const decision of decisions) {
    const key = `${decision.sessionId}:${decision.turnNumber}`;
    const hasGenerated = generatedKeys.has(key);
    if (decision.hit === true) {
      if (hasGenerated) wouldServe += 1;
      else hitWithoutBranch += 1;
    } else if (decision.hit === false) {
      if (hasGenerated) wastedSpend += 1;
      else savedSpend += 1;
    } else if (anyBranchKeys.has(key)) {
      pendingBranch += 1;
    }
  }

  return {
    predictions: {
      total: decisions.length,
      resolved: resolved.length,
      hits,
      misses,
      pending,
      hitRate,
    },
    branches: {
      total: branches.length,
      byStatus,
      generated: generated.length,
      avgGenerationLatencyMs,
      models,
    },
    gate: {
      wouldServe,
      hitWithoutBranch,
      wastedSpend,
      savedSpend,
      pendingBranch,
    },
    audit: {
      branchesAudited,
      byVerdict,
      firstDraftFailed,
      repaired,
      findingsByCategory,
      judge: {
        evaluated: judgeEvaluated,
        skipped: judgeSkipped,
        findings: judgeFindings,
      },
    },
  };
}
