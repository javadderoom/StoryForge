import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNpcIdToName,
  buildSnapPredictionRequest,
  computeSnapHit,
  deriveActualChoice,
  parseSnapPredictionAnswer,
  predictSnapChoice,
  SNAP_PREDICTION_MODEL,
  SNAP_PREDICTION_QUESTION_KEY,
  type SnapPredictionInput,
} from './snapPredictor';
import { SubQAdapter, SubQDecisionRequest, SubQDecisionResponse } from '@/lib/providers/SubQAdapter';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';

const CHOICES: ChoiceOption[] = [
  { id: 'choice_a', text: 'Charge the gate', style: 'aggressive', riskLevel: 'high' },
  { id: 'choice_b', text: 'Sneak through the alley', style: 'stealthy', riskLevel: 'medium' },
  { id: 'choice_c', text: 'Haggle with the merchant', style: 'diplomatic', riskLevel: 'low' },
];

function makePlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    stats: { might: 12, wits: 14 },
    resources: { hp: 12, stamina: 9 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: ['loc_gate'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_gate',
    ...overrides,
  };
}

function makeInput(overrides: Partial<SnapPredictionInput> = {}): SnapPredictionInput {
  return {
    storyTitle: 'The Salt Road',
    storyLanguage: 'fa',
    currentProse: 'The gate looms in the dusk.',
    choices: CHOICES,
    playerState: makePlayerState(),
    history: [],
    ...overrides,
  };
}

/** Narrow view of the SubQ request `state` payload asserted by these tests. */
interface SnapRequestStateShape {
  player: { level?: number; relationships: Array<{ npc: string; trust: number }> };
  storySoFar: Array<{ turn: number; scene: string }>;
  currentScene: string;
}

class MockSubQAdapter extends SubQAdapter {
  public calls: Array<{ request: SubQDecisionRequest; options?: { timeoutMs?: number; signal?: AbortSignal } }> = [];
  private responder: (request: SubQDecisionRequest) => SubQDecisionResponse;

  constructor(responder: (request: SubQDecisionRequest) => SubQDecisionResponse) {
    super('test-subq-key');
    this.responder = responder;
  }

  public isConfigured(): boolean {
    return true;
  }

  public async evaluate(
    request: SubQDecisionRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<SubQDecisionResponse> {
    this.calls.push({ request, options });
    return this.responder(request);
  }
}

function answerResponse(choice: string, extra: Record<string, unknown> = {}): SubQDecisionResponse {
  return {
    success: true,
    model: SNAP_PREDICTION_MODEL,
    latencyMs: 90,
    answers: {
      [SNAP_PREDICTION_QUESTION_KEY]: { choice, ...extra },
    },
  };
}

describe('Plan 15 §2.3 — Snap choice predictor (dwell-time prediction core)', () => {
  describe('buildSnapPredictionRequest', () => {
    it('encodes every presented choice as a criteria key of a choice question', () => {
      const request = buildSnapPredictionRequest(makeInput());
      assert.equal(request.model, SNAP_PREDICTION_MODEL);

      const question = request.questions[SNAP_PREDICTION_QUESTION_KEY];
      assert.equal(question.type, 'choice');
      const criteria = question.criteria as Record<string, string>;
      assert.deepEqual(Object.keys(criteria), ['choice_a', 'choice_b', 'choice_c']);
      assert.match(criteria.choice_b, /stealthy/);
      assert.match(criteria.choice_b, /medium risk/);
      assert.match(criteria.choice_b, /Sneak through the alley/);
    });

    it('names relationships, sorts by absolute trust, and caps the block at twelve', () => {
      const relationships: PlayerState['relationships'] = {};
      for (let i = 0; i < 14; i++) {
        relationships[`npc_${i}`] = { trust: i, knownSecrets: [], notes: [] };
      }
      relationships.npc_13.trust = -50; // negative trust outranks small positives
      const npcIdToName = buildNpcIdToName(
        Array.from({ length: 14 }, (_, i) => ({ id: `npc_${i}`, name: `NPC ${i}` }))
      );

      const request = buildSnapPredictionRequest(
        makeInput({ playerState: makePlayerState({ relationships, level: 4 }), npcIdToName })
      );
      const state = request.state as unknown as SnapRequestStateShape;

      assert.equal(state.player.level, 4);
      assert.equal(state.player.relationships.length, 12);
      assert.deepEqual(state.player.relationships[0], { npc: 'NPC 13', trust: -50 });
      assert.ok(!state.player.relationships.some((r) => r.npc === 'NPC 0'));
    });

    it('bounds history to the last eight turns with truncated prose', () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        turnNumber: i + 1,
        playerActionText: `action ${i + 1}`,
        narrativeProse: 'x'.repeat(600),
      }));
      const request = buildSnapPredictionRequest(
        makeInput({ history, currentProse: 'y'.repeat(2000) })
      );
      const state = request.state as unknown as SnapRequestStateShape;

      assert.equal(state.storySoFar.length, 8);
      assert.equal(state.storySoFar[0].turn, 3);
      assert.equal(state.storySoFar[0].scene.length, 501); // 500 + ellipsis
      assert.equal(state.currentScene.length, 1601); // 1600 + ellipsis
    });
  });

  describe('parseSnapPredictionAnswer', () => {
    it('maps an exact choice id and reads the probability as confidence', () => {
      const prediction = parseSnapPredictionAnswer(answerResponse('choice_b', { probability: 0.62 }), CHOICES);
      assert.equal(prediction?.predictedChoiceId, 'choice_b');
      assert.equal(prediction?.confidence, 0.62);
      assert.equal(prediction?.model, SNAP_PREDICTION_MODEL);
      assert.equal(prediction?.latencyMs, 90);
    });

    it('accepts case-insensitive ids, wrapped string answers, and exact choice text', () => {
      assert.equal(
        parseSnapPredictionAnswer(answerResponse('CHOICE_B'), CHOICES)?.predictedChoiceId,
        'choice_b'
      );

      const wrapped: SubQDecisionResponse = {
        success: true,
        model: SNAP_PREDICTION_MODEL,
        answers: { [SNAP_PREDICTION_QUESTION_KEY]: { value: 'Haggle with the merchant' } },
      };
      assert.equal(parseSnapPredictionAnswer(wrapped, CHOICES)?.predictedChoiceId, 'choice_c');
    });

    it('reads a nested probabilities map when the model provides one', () => {
      const response = answerResponse('choice_a', { probabilities: { choice_a: 0.4, choice_b: 0.35 } });
      const prediction = parseSnapPredictionAnswer(response, CHOICES);
      assert.deepEqual(prediction?.probabilities, { choice_a: 0.4, choice_b: 0.35 });
      assert.equal(prediction?.confidence, undefined);
    });

    it('returns null for unmappable, missing, or failed answers', () => {
      assert.equal(parseSnapPredictionAnswer(answerResponse('choice_z'), CHOICES), null);
      assert.equal(
        parseSnapPredictionAnswer({ success: true, model: SNAP_PREDICTION_MODEL, answers: {} }, CHOICES),
        null
      );
      assert.equal(
        parseSnapPredictionAnswer(
          { success: false, model: SNAP_PREDICTION_MODEL, answers: { [SNAP_PREDICTION_QUESTION_KEY]: { choice: 'choice_a' } } },
          CHOICES
        ),
        null
      );
    });
  });

  describe('predictSnapChoice', () => {
    it('skips without calling the API when SubQ is unconfigured', async () => {
      const result = await predictSnapChoice(makeInput(), new SubQAdapter(''));
      assert.equal(result.ok, false);
      assert.equal(result.skipped, true);
      assert.equal(result.error, 'subq_not_configured');
    });

    it('skips when no choices are on screen', async () => {
      const adapter = new MockSubQAdapter(() => answerResponse('choice_a'));
      const result = await predictSnapChoice(makeInput({ choices: [] }), adapter);
      assert.equal(result.skipped, true);
      assert.equal(adapter.calls.length, 0);
    });

    it('returns the mapped prediction and passes a dwell-time budget', async () => {
      const adapter = new MockSubQAdapter(() => answerResponse('choice_c'));
      const result = await predictSnapChoice(makeInput(), adapter);

      assert.equal(result.ok, true);
      assert.equal(result.prediction?.predictedChoiceId, 'choice_c');
      assert.equal(adapter.calls.length, 1);
      assert.ok((adapter.calls[0].options?.timeoutMs ?? 0) >= 1000);
    });

    it('reports unmapped and failed API responses without a prediction', async () => {
      const unmapped = new MockSubQAdapter(() => answerResponse('not_a_choice'));
      const unmappedResult = await predictSnapChoice(makeInput(), unmapped);
      assert.equal(unmappedResult.ok, false);
      assert.equal(unmappedResult.error, 'unmapped_prediction');

      const failed = new MockSubQAdapter(() => ({ success: false, answers: {}, model: SNAP_PREDICTION_MODEL, error: 'timeout' }));
      const failedResult = await predictSnapChoice(makeInput(), failed);
      assert.equal(failedResult.ok, false);
      assert.equal(failedResult.error, 'timeout');
    });
  });

  describe('deriveActualChoice + computeSnapHit (tap resolution)', () => {
    const presented = CHOICES.map((c) => ({ id: c.id, text: c.text }));

    it('prefers an explicit choice id; falls back to exact text for legacy clients; else free text', () => {
      assert.deepEqual(deriveActualChoice(presented, 'choice_b', 'whatever'), { actualChoiceId: 'choice_b' });
      assert.deepEqual(deriveActualChoice(presented, undefined, 'Sneak through the alley'), {
        actualChoiceId: 'choice_b',
      });
      assert.deepEqual(deriveActualChoice(presented, undefined, 'I climb the wall.'), {
        actualActionText: 'I climb the wall.',
      });
      // Unknown explicit id (not among the presented choices) is still recorded as the actual.
      assert.deepEqual(deriveActualChoice(presented, 'choice_z', 'charge'), { actualChoiceId: 'choice_z' });
    });

    it('counts only the predicted tap as a hit — a different choice or free text is a miss', () => {
      assert.equal(computeSnapHit('choice_b', 'choice_b'), true);
      assert.equal(computeSnapHit('choice_b', 'choice_a'), false);
      assert.equal(computeSnapHit('choice_b', undefined), false);
      assert.equal(computeSnapHit(undefined, 'choice_b'), false);
    });
  });

  describe('buildNpcIdToName', () => {
    it('maps well-formed npcs and skips malformed or empty input', () => {
      assert.deepEqual(buildNpcIdToName([{ id: 'npc_1', name: 'Kael' }]), { npc_1: 'Kael' });
      assert.deepEqual(buildNpcIdToName([{ id: 'npc_1', name: '' }]), { npc_1: 'npc_1' });
      assert.equal(buildNpcIdToName([]), undefined);
      assert.equal(buildNpcIdToName(undefined), undefined);
      assert.equal(buildNpcIdToName([{ name: 'No id' }]), undefined);
    });
  });
});
