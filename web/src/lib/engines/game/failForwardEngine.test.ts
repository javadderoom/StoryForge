import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionSimilarity,
  actionsAreSimilar,
  classifyFailureAction,
  countConsecutiveFailedAttempts,
  isGateAction,
  normalizeActionForSimilarity,
  resolveFailureForward,
  type FailureForwardInput,
  type PriorFailedTurn,
} from './failForwardEngine';

const BASE: FailureForwardInput = {
  outcome: 'failure',
  actionText: 'Search the guardhouse for a hidden ledger',
  actionStyle: 'inquisitive',
  statId: 'cunning',
  isPersian: false,
  isTraveling: false,
  bodilyRisk: false,
  healthKey: 'health',
  staminaKey: 'stamina',
  resolveKey: 'resolve',
  availableResourceIds: ['health', 'stamina', 'resolve'],
};

function plan(overrides: Partial<FailureForwardInput>) {
  return resolveFailureForward({ ...BASE, ...overrides });
}

describe('Plan 18 — Fail Forward classification', () => {
  it('classifies investigative, social, physical, and travel actions', () => {
    assert.equal(
      classifyFailureAction({
        actionText: 'Search the guardhouse for a hidden ledger',
        actionStyle: 'inquisitive',
        statId: 'cunning',
      }),
      'investigative'
    );
    assert.equal(
      classifyFailureAction({
        actionText: 'Bribe the gate captain with silver',
        actionStyle: 'diplomatic',
        statId: 'charisma',
      }),
      'social'
    );
    assert.equal(
      classifyFailureAction({
        actionText: 'Kick the gate open',
        actionStyle: 'aggressive',
        statId: 'might',
        bodilyRisk: true,
      }),
      'physical'
    );
    assert.equal(
      classifyFailureAction({
        actionText: 'Travel to the next city before dawn',
        actionStyle: 'tactical',
        statId: 'endurance',
      }),
      'travel'
    );
  });

  it('classifies Persian social and investigative actions', () => {
    assert.equal(
      classifyFailureAction({
        actionText: 'با رشوه سردستهٔ دروازه را متقاعد می‌کنم',
        actionStyle: 'diplomatic',
        statId: 'charisma',
      }),
      'social'
    );
    assert.equal(
      classifyFailureAction({
        actionText: 'اتاق را برای یافتن دفترچه جستجو می‌کنم',
        actionStyle: 'inquisitive',
        statId: 'cunning',
      }),
      'investigative'
    );
  });

  it('does not mistake a social idiom for violence', () => {
    assert.equal(
      classifyFailureAction({
        actionText: 'Strike a deal with the caravan master',
        actionStyle: 'diplomatic',
        statId: 'charisma',
      }),
      'social'
    );
    assert.equal(
      classifyFailureAction({
        actionText: 'Strike a deal with the caravan master',
        actionStyle: 'aggressive',
        statId: 'charisma',
      }),
      'social'
    );
  });

  it('recognizes gate/entry actions for authored gates', () => {
    assert.equal(isGateAction('Force the sealed gate open'), true);
    assert.equal(isGateAction('Search the market for rumors'), false);
    assert.equal(isGateAction('Pass a message to the watchman'), false);
    assert.equal(isGateAction('Open the letter from the captain'), false);
    assert.equal(isGateAction('Unlock the chest'), false);
    assert.equal(isGateAction('Cross the courtyard'), false);
    assert.equal(isGateAction('Pick the lock'), true);
    assert.equal(isGateAction('Unlock the gate'), true);
    assert.equal(isGateAction('از دروازهٔ بسته عبور می‌کنم'), true);
    assert.equal(isGateAction('قفل را باز می‌کنم'), true);
    assert.equal(isGateAction('نامه را باز می‌کنم'), false);
    assert.equal(isGateAction('در بازار به دنبال خبر می‌گردم'), false);
  });
});

describe('Plan 18 — Fail Forward mode selection', () => {
  it('investigative failure reveals a new fact and adds a complication', () => {
    const p = plan({});
    assert.equal(p.mode, 'reveal');
    assert.equal(p.secondaryMode, 'complication');
    assert.equal(p.stuckAllowed, false);
    assert.equal(p.actionKind, 'investigative');
    assert.match(p.directive.en, /exposes a new fact/i);
    assert.match(p.directive.en, /two of the offered choices/i);
  });

  it('social failure complicates the situation and reveals a shift', () => {
    const p = plan({
      actionText: 'Bribe the gate captain with silver',
      actionStyle: 'diplomatic',
      statId: 'charisma',
    });
    assert.equal(p.mode, 'complication');
    assert.equal(p.secondaryMode, 'reveal');
    assert.equal(p.stuckAllowed, false);
  });

  it('bodily physical failure costs health', () => {
    const p = plan({
      actionText: 'Kick the gate open',
      actionStyle: 'aggressive',
      statId: 'might',
      bodilyRisk: true,
    });
    assert.equal(p.mode, 'cost');
    assert.equal(p.costKind, 'health');
    assert.equal(p.resourceChanges.health, -10);
    assert.equal(p.resourceChanges.stamina, undefined);
  });

  it('non-bodily physical failure repositions instead of wounding', () => {
    const p = plan({
      actionText: 'Squeeze through the narrow service hatch',
      actionStyle: 'agile',
      statId: 'agility',
      bodilyRisk: false,
    });
    assert.equal(p.mode, 'reposition');
    assert.equal(p.costKind, 'stamina');
    assert.equal(p.resourceChanges.stamina, -10);
    assert.equal(p.resourceChanges.health, undefined);
  });

  it('social failure with no stamina uses resolve, never health', () => {
    const p = plan({
      actionText: 'Bribe the gate captain with silver',
      actionStyle: 'diplomatic',
      statId: 'charisma',
      staminaKey: undefined,
    });
    assert.equal(p.costKind, 'resolve');
    assert.equal(p.resourceChanges.resolve, -5);
    assert.equal(p.resourceChanges.health, undefined);
  });

  it('failure with no stamina or resolve exacts no resource cost', () => {
    const p = plan({
      actionText: 'Bribe the gate captain with silver',
      actionStyle: 'diplomatic',
      statId: 'charisma',
      staminaKey: undefined,
      resolveKey: undefined,
    });
    assert.equal(p.costKind, 'none');
    assert.deepEqual(p.resourceChanges, {});
    assert.match(p.consequenceSummary.en, /time, attention/i);
  });

  it('travel failure escalates the journey', () => {
    const p = plan({
      outcome: 'failure',
      actionText: 'Travel to the next city before dawn',
      actionStyle: 'tactical',
      statId: 'endurance',
      isTraveling: true,
    });
    assert.equal(p.actionKind, 'travel');
    assert.equal(p.mode, 'escalation');
    assert.equal(p.stuckAllowed, false);
  });

  it('escalates an unclassified failure while the protagonist is on the road', () => {
    const p = plan({
      actionText: 'Repair the cracked axle',
      actionStyle: 'tactical',
      statId: 'craft',
      isTraveling: true,
    });
    assert.equal(p.actionKind, 'other');
    assert.equal(p.mode, 'escalation');
    assert.match(p.consequenceSummary.en, /danger advances/i);
  });

  it('critical failure always combines escalation with a cost', () => {
    const p = plan({
      outcome: 'critical_failure',
      actionText: 'Bribe the gate captain with silver',
      actionStyle: 'diplomatic',
      statId: 'charisma',
    });
    assert.equal(p.mode, 'escalation');
    assert.equal(p.secondaryMode, 'cost');
    assert.equal(p.costKind, 'stamina');
    assert.equal(p.resourceChanges.stamina, -15);
    assert.equal(p.resourceChanges.health, undefined);
    assert.match(p.directive.en, /CRITICAL FAILURE/i);
  });

  it('does not add a second cost when feasibility already applied one', () => {
    const p = plan({
      actionText: 'Kick the gate open',
      actionStyle: 'aggressive',
      statId: 'might',
      bodilyRisk: true,
      hasExistingHealthPenalty: true,
    });
    assert.deepEqual(p.resourceChanges, {});
    assert.match(p.consequenceSummary.en, /already listed/i);
  });
});

describe('Plan 18 — Retry budget & authored gates', () => {
  it('escalates the first identical repeat', () => {
    const p = plan({ previousFailedAttempts: 1 });
    assert.equal(p.mode, 'escalation');
    assert.equal(p.stuckAllowed, false);
    assert.match(p.directive.en, /REPEATED ATTEMPT/i);
  });

  it('hard-stops the second unchanged repeat', () => {
    const p = plan({ previousFailedAttempts: 2 });
    assert.equal(p.mode, 'hard_stop');
    assert.equal(p.stuckAllowed, true);
    assert.match(p.directive.en, /AUTHORIZED HARD STOP/i);
    assert.deepEqual(p.resourceChanges, {});
    assert.match(p.stuckReason || '', /exhausted/i);
  });

  it('holds a retrying player even if the authored mode is softer', () => {
    const p = plan({ previousFailedAttempts: 2, authoredMode: 'reveal' });
    assert.equal(p.mode, 'hard_stop');
  });

  it('honors an authored hard stop on the first attempt with a hint', () => {
    const p = plan({
      actionText: 'Open the sealed gate',
      authoredMode: 'hard_stop',
      authoredHint: 'The gate needs the bronze seal from the castellan.',
    });
    assert.equal(p.mode, 'hard_stop');
    assert.equal(p.stuckAllowed, true);
    assert.match(p.stuckReason || '', /bronze seal/i);
    assert.match(p.directive.en, /bronze seal/i);
  });

  it('treats an authored location gate as a hard stop only for gate actions', () => {
    const gatePlan = plan({
      actionText: 'Force the gate open',
      authoredGate: true,
      authoredGateHint: 'Only the night watch may open it.',
    });
    assert.equal(gatePlan.mode, 'hard_stop');
    assert.equal(gatePlan.stuckAllowed, true);

    const searchPlan = plan({
      actionText: 'Search the courtyard for tracks',
      authoredGate: true,
    });
    assert.notEqual(searchPlan.mode, 'hard_stop');
  });

  it('honors an authored failure mode when there is no retry or gate', () => {
    const p = plan({
      actionText: 'Kick the gate open',
      actionStyle: 'aggressive',
      statId: 'might',
      bodilyRisk: true,
      authoredMode: 'reveal',
    });
    assert.equal(p.mode, 'reveal');
    assert.notEqual(p.mode, 'hard_stop');
  });
});

describe('Plan 18 — Retry similarity', () => {
  it('normalizes Persian/Arabic letter variants and punctuation', () => {
    assert.equal(
      normalizeActionForSimilarity('جستجوي اتاق، دوباره!'),
      normalizeActionForSimilarity('جستجوی اتاق دوباره')
    );
  });

  it('detects repurposed actions without matching unrelated ones', () => {
    assert.equal(
      actionsAreSimilar(
        'Search the guardhouse for a hidden ledger',
        'I search the guardhouse again for the ledger'
      ),
      true
    );
    assert.equal(
      actionsAreSimilar('Search the guardhouse for a hidden ledger', 'Bribe the gate captain'),
      false
    );
    assert.ok(
      actionSimilarity('Search the guardhouse for a hidden ledger', 'Search the guardhouse') > 0.6
    );
  });

  it('counts consecutive failed attempts in the same place', () => {
    const turns: PriorFailedTurn[] = [
      {
        playerActionText: 'Search the guardhouse for a hidden ledger',
        sceneId: 'loc_guardhouse',
        resolution: { outcome: 'failure' },
      },
      {
        playerActionText: 'I search the guardhouse again for the ledger',
        sceneId: 'loc_guardhouse',
        resolution: { outcome: 'failure' },
      },
      {
        playerActionText: 'Search the guardhouse once more for the ledger',
        sceneId: 'loc_guardhouse',
        resolution: { outcome: 'critical_failure' },
      },
    ];
    assert.equal(
      countConsecutiveFailedAttempts(
        turns,
        'Searching the guardhouse for the ledger again',
        'loc_guardhouse'
      ),
      3
    );
  });

  it('resets the budget after a success, a new approach, or a location change', () => {
    const failure: PriorFailedTurn = {
      playerActionText: 'Search the guardhouse for a hidden ledger',
      sceneId: 'loc_guardhouse',
      resolution: { outcome: 'failure' },
    };
    assert.equal(
      countConsecutiveFailedAttempts(
        [{ ...failure, resolution: { outcome: 'success' } }],
        'Search the guardhouse for a hidden ledger again',
        'loc_guardhouse'
      ),
      0
    );
    assert.equal(
      countConsecutiveFailedAttempts(
        [failure],
        'Bribe the gate captain with silver',
        'loc_guardhouse'
      ),
      0
    );
    assert.equal(
      countConsecutiveFailedAttempts(
        [failure],
        'Search the guardhouse for a hidden ledger again',
        'loc_market'
      ),
      0
    );
    assert.equal(
      countConsecutiveFailedAttempts(
        [
          {
            ...failure,
            resolution: { outcome: 'failure', stateDiff: { locationChange: 'loc_cellar' } },
          },
        ],
        'Search the guardhouse for a hidden ledger again',
        'loc_guardhouse'
      ),
      0
    );
  });
});
