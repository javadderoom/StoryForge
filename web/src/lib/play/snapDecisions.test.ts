import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapDecisionLogRow,
  cancelSnapPrediction,
  resolveSnapDecision,
  scheduleSnapPrediction,
  type SnapPredictionSchedule,
} from './snapDecisions';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import { SNAP_PREDICTION_MODEL } from '@/lib/engines/narrative/snapPredictor';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';

const CHOICES: ChoiceOption[] = [
  { id: 'choice_a', text: 'Charge the gate', style: 'aggressive', riskLevel: 'high' },
  { id: 'choice_b', text: 'Sneak through the alley', style: 'stealthy', riskLevel: 'medium' },
];

function makePlayerState(): PlayerState {
  return {
    stats: { might: 12 },
    resources: { hp: 12 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_gate',
  };
}

function makeSchedule(overrides: Partial<SnapPredictionSchedule> = {}): SnapPredictionSchedule {
  return {
    sessionId: 'sess_snap_1',
    storyId: 'story_snap_1',
    storyTitle: 'The Salt Road',
    storyLanguage: 'fa',
    turnNumber: 3,
    currentProse: 'The gate looms.',
    choices: CHOICES,
    playerState: makePlayerState(),
    history: [],
    ...overrides,
  };
}

async function withDbDisabled(run: () => Promise<void>): Promise<void> {
  const previous = process.env.ENABLE_DB;
  process.env.ENABLE_DB = 'false';
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ENABLE_DB;
    else process.env.ENABLE_DB = previous;
  }
}

describe('Plan 15 §2.3 — Snap decision persistence & cancellation', () => {
  it('builds the render-time log row exactly as the schema expects', () => {
    const row = buildSnapDecisionLogRow(
      { sessionId: 'sess_1', storyId: 'story_1', turnNumber: 4, choices: CHOICES },
      {
        predictedChoiceId: 'choice_b',
        model: SNAP_PREDICTION_MODEL,
        confidence: 0.71,
        probabilities: { choice_b: 0.71 },
        latencyMs: 123.6,
      }
    );

    assert.deepEqual(row, {
      sessionId: 'sess_1',
      storyId: 'story_1',
      turnNumber: 4,
      questionKey: 'predicted_choice',
      model: 'subq-snap-preview',
      presentedChoiceIds: ['choice_a', 'choice_b'],
      predictedChoiceId: 'choice_b',
      choiceProbabilities: { choice_b: 0.71 },
      confidence: 0.71,
      latencyMs: 124,
    });
  });

  it('omits optional fields when the model reports no confidence or latency', () => {
    const row = buildSnapDecisionLogRow(
      { sessionId: 's', storyId: 'story', turnNumber: 1, choices: CHOICES },
      { predictedChoiceId: 'choice_a', model: SNAP_PREDICTION_MODEL }
    );
    assert.equal(row.confidence, undefined);
    assert.equal(row.choiceProbabilities, undefined);
    assert.equal(row.latencyMs, undefined);
  });

  it('never spends a Snap call when the database is disabled (nothing could be resolved)', async () => {
    await withDbDisabled(async () => {
      let evaluateCalls = 0;
      const adapterStub = {
        isConfigured: () => true,
        evaluate: async () => {
          evaluateCalls += 1;
          return { success: true, answers: {}, model: SNAP_PREDICTION_MODEL };
        },
      } as unknown as SubQAdapter;

      await scheduleSnapPrediction(makeSchedule({ adapter: adapterStub }));
      assert.equal(evaluateCalls, 0);
    });
  });

  it('no-ops safely for empty choices, missing sessions, and unregistered cancellations', async () => {
    let evaluateCalls = 0;
    const adapterStub = {
      isConfigured: () => true,
      evaluate: async () => {
        evaluateCalls += 1;
        return { success: true, answers: {}, model: SNAP_PREDICTION_MODEL };
      },
    } as unknown as SubQAdapter;

    await scheduleSnapPrediction(makeSchedule({ choices: [], adapter: adapterStub }));
    await scheduleSnapPrediction(makeSchedule({ sessionId: '', adapter: adapterStub }));
    await scheduleSnapPrediction(makeSchedule({ turnNumber: 0, adapter: adapterStub }));
    assert.equal(evaluateCalls, 0);

    cancelSnapPrediction('sess_never_registered'); // must not throw

    await resolveSnapDecision({ sessionId: '', turnNumber: undefined, actionText: 'x' });
    await resolveSnapDecision({ sessionId: 'sess_1', turnNumber: undefined, actionText: 'x' });
  });

  it('resolves without throwing when the database is disabled', async () => {
    await withDbDisabled(async () => {
      await resolveSnapDecision({
        sessionId: 'sess_snap_1',
        turnNumber: 3,
        presentedChoices: [{ id: 'choice_a', text: 'Charge the gate' }],
        explicitChoiceId: 'choice_a',
        actionText: 'Charge the gate',
      });
    });
  });
});
