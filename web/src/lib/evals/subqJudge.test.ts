import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubQJudgeRequest,
  extractSubQScore,
  runSubQJudge,
} from './subqJudge';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import { EVAL_SCENARIOS } from './evalScenarios';

describe('subqJudge — SubQ Snap LLM-as-a-Judge Evaluation', () => {
  const mockScenario = EVAL_SCENARIOS[0];
  const mockHeuristic = {
    passed: true,
    findings: [],
    stats: {
      choiceCount: 3,
      dicelessCount: 0,
      wordCount: 350,
      checkedDcs: [12, 14],
      rescuedChoices: 0,
      sensoryAnchorCount: 3,
    },
  };
  const mockChoices = [
    { id: 'c1', text: 'Inspect the door', style: 'inquisitive' as const, riskLevel: 'low' as const },
    { id: 'c2', text: 'Strike the sentry', style: 'aggressive' as const, riskLevel: 'high' as const, targetDC: 14, requiredStatId: 'might' },
  ];

  it('buildSubQJudgeRequest constructs standard rubric questions and state', () => {
    const req = buildSubQJudgeRequest(
      mockScenario,
      'The blade shivered against the iron hinge.',
      mockChoices,
      mockHeuristic
    );

    assert.equal(req.model, 'subq-snap-preview');
    assert.match(req.state as string, /\[SCENARIO\]/);
    assert.match(req.state as string, /\[PROSE\]/);
    assert.match(req.state as string, /The blade shivered/);

    assert.ok(req.questions.causeEffect);
    assert.ok(req.questions.feasibility);
    assert.ok(req.questions.divergence);
    assert.ok(req.questions.polish);

    assert.equal(req.questions.causeEffect.type, 'score');
    assert.equal(req.questions.feasibility.type, 'score');
    assert.equal(req.questions.divergence.type, 'score');
    assert.equal(req.questions.polish.type, 'score');

    assert.equal((req.questions.causeEffect.criteria as string[]).length, 5);
  });

  it('extractSubQScore parses scalar scores, raw numbers, and ordinal indices cleanly', () => {
    // Direct integer 1..5
    assert.equal(extractSubQScore(5), 5);
    assert.equal(extractSubQScore(1), 1);

    // Object with score property
    assert.equal(extractSubQScore({ score: 4 }), 4);

    // Zero-indexed ordinal (0 -> 1, 4 -> 5)
    assert.equal(extractSubQScore(0), 1);
    assert.equal(extractSubQScore({ index: 3 }), 4);

    // Clamping out-of-bounds numbers
    assert.equal(extractSubQScore(99), 5);
    assert.equal(extractSubQScore(-5), 1);

    // Missing value falls back to default
    assert.equal(extractSubQScore(undefined, 3), 3);
    assert.equal(extractSubQScore(null, 4), 4);
  });

  it('runSubQJudge returns null when adapter is not configured', async () => {
    const unconfigured = new SubQAdapter('');
    const score = await runSubQJudge(
      mockScenario,
      'Prose text',
      mockChoices,
      mockHeuristic,
      { adapter: unconfigured }
    );

    assert.equal(score, null);
  });

  it('runSubQJudge formats JudgeScore when adapter succeeds', async () => {
    class MockSuccessAdapter extends SubQAdapter {
      constructor() {
        super('dummy-key');
      }
      override async evaluate() {
        return {
          success: true,
          model: 'subq-snap-preview',
          answers: {
            causeEffect: { score: 5 },
            feasibility: { score: 4 },
            divergence: { score: 3 },
            polish: { score: 4 },
          },
          latencyMs: 820,
        };
      }
    }

    const score = await runSubQJudge(
      mockScenario,
      'Prose text',
      mockChoices,
      mockHeuristic,
      { adapter: new MockSuccessAdapter() }
    );

    assert.ok(score);
    assert.equal(score.model, 'subq-snap-preview');
    assert.equal(score.scores.causeEffect, 5);
    assert.equal(score.scores.feasibility, 4);
    assert.equal(score.scores.divergence, 3);
    assert.equal(score.scores.polish, 4);
    assert.match(score.notes || '', /820ms/);
  });
});
