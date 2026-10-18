import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AotBranchAudit } from '@/lib/engines/narrative/aotBranchAudit';
import { summarizeSnapReport } from './snapReport';

function audit(overrides: Partial<AotBranchAudit> = {}): AotBranchAudit {
  return {
    verdict: 'clean',
    findings: [],
    stats: {
      narrativeChars: 900,
      choiceCount: 3,
      choicesDroppedBySanitizer: 0,
      firstPassErrors: 0,
      firstPassWarnings: 0,
      repairAttempts: 0,
      proseRepaired: false,
      leftoverFindings: 0,
    },
    ...overrides,
  };
}

describe('snapReport.summarizeSnapReport', () => {
  it('counts hits, misses, and pending rows separately', () => {
    const summary = summarizeSnapReport(
      [
        { sessionId: 's1', turnNumber: 2, hit: true },
        { sessionId: 's2', turnNumber: 2, hit: false },
        { sessionId: 's3', turnNumber: 2, hit: null },
      ],
      []
    );

    assert.deepEqual(summary.predictions, {
      total: 3,
      resolved: 2,
      hits: 1,
      misses: 1,
      pending: 1,
      hitRate: 50,
    });
    assert.equal(summary.gate.wouldServe, 0);
  });

  it('reports a null hit rate when nothing has resolved', () => {
    const summary = summarizeSnapReport(
      [{ sessionId: 's1', turnNumber: 1, hit: null }],
      []
    );
    assert.equal(summary.predictions.hitRate, null);
    assert.equal(summary.predictions.pending, 1);
  });

  it('builds the promotion matrix from prediction keys and branch status', () => {
    const summary = summarizeSnapReport(
      [
        { sessionId: 'hit-branch', turnNumber: 2, hit: true },
        { sessionId: 'hit-none', turnNumber: 2, hit: true },
        { sessionId: 'miss-branch', turnNumber: 3, hit: false },
        { sessionId: 'miss-none', turnNumber: 3, hit: false },
        { sessionId: 'pending-branch', turnNumber: 4, hit: null },
        { sessionId: 'pending-none', turnNumber: 4, hit: null },
      ],
      [
        { sessionId: 'hit-branch', turnNumber: 2, status: 'generated', latencyMs: 1200 },
        { sessionId: 'miss-branch', turnNumber: 3, status: 'generated', latencyMs: 1800 },
        { sessionId: 'pending-branch', turnNumber: 4, status: 'failed' },
      ]
    );

    assert.deepEqual(summary.gate, {
      wouldServe: 1,
      hitWithoutBranch: 1,
      wastedSpend: 1,
      savedSpend: 1,
      pendingBranch: 1,
    });
    assert.equal(summary.branches.generated, 2);
    assert.equal(summary.branches.avgGenerationLatencyMs, 1500);
    assert.deepEqual(summary.branches.byStatus, { generated: 2, failed: 1 });
  });

  it('aggregates verdicts, surviving findings, and judge coverage', () => {
    const summary = summarizeSnapReport(
      [],
      [
        {
          sessionId: 's1',
          turnNumber: 2,
          status: 'generated',
          verdict: 'warned',
          audit: audit({
            verdict: 'warned',
            findings: [
              { severity: 'warning', category: 'judge_voice', source: 'judge', detail: 'voice break' },
              { severity: 'info', category: 'prose_final', source: 'validator', detail: 'note' },
            ],
            stats: {
              ...audit().stats,
              firstPassErrors: 1,
              proseRepaired: true,
              judgeSkipped: false,
              judgeFindings: 1,
            },
          }),
        },
        {
          sessionId: 's2',
          turnNumber: 2,
          status: 'generated',
          verdict: 'rejected',
          audit: audit({
            verdict: 'rejected',
            findings: [
              { severity: 'error', category: 'judge_state', source: 'judge', detail: 'dead NPC acted' },
            ],
            stats: {
              ...audit().stats,
              judgeSkipped: true,
              judgeError: 'timeout',
            },
          }),
        },
      ]
    );

    assert.deepEqual(summary.audit.byVerdict, { warned: 1, rejected: 1 });
    assert.deepEqual(summary.audit.findingsByCategory, {
      judge_voice: 1,
      judge_state: 1,
    });
    assert.equal(summary.audit.firstDraftFailed, 1);
    assert.equal(summary.audit.repaired, 1);
    // One evaluated judge pass; the timed-out pass is skipped, not clean.
    assert.deepEqual(summary.audit.judge, { evaluated: 1, skipped: 1, findings: 1 });
  });

  it('ignores rows whose audit JSON is missing or malformed', () => {
    const summary = summarizeSnapReport(
      [],
      [
        { sessionId: 's1', turnNumber: 1, status: 'generated', audit: null },
        { sessionId: 's2', turnNumber: 1, status: 'generated', audit: { verdict: 'clean' } },
      ]
    );
    assert.equal(summary.audit.branchesAudited, 0);
    assert.deepEqual(summary.audit.byVerdict, {});
  });
});
