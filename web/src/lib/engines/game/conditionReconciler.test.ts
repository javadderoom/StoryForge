import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerState } from '@/lib/types/gameplay';
import { RPGSystemSchema } from '@/lib/types/rpg';
import { reconcileConditions } from './conditionReconciler';

const mockRpg: RPGSystemSchema = {
  hasCombat: true,
  diceType: 'd20',
  stats: [{ id: 'might', name: 'Might', description: 'Strength', baseValue: 12 }],
  resources: [
    { id: 'hp', name: 'Health', current: 100, max: 100, min: 0 },
    { id: 'stamina', name: 'Stamina', current: 50, max: 50, min: 0 },
  ],
  skills: [],
  startingInventory: [],
  inventoryCapacity: 10,
};

const healthPoolRpg: RPGSystemSchema = {
  ...mockRpg,
  resources: [
    { id: 'health', name: 'Health', current: 100, max: 100, min: 0 },
    { id: 'energy', name: 'Energy', current: 50, max: 50, min: 0 },
  ],
};

function makeState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    stats: { might: 12 },
    resources: { hp: 100, stamina: 50 },
    maxResources: { hp: 100, stamina: 50 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: ['loc_test'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_test',
    conditions: [],
    ...overrides,
  };
}

function findFinding(
  findings: Array<{ type: string; kind: string; detail: string }>,
  type: string,
  kind?: string
) {
  return findings.find((f) => f.type === type && (kind === undefined || f.kind === kind));
}

describe('Plan 17 condition reconciler', () => {
  it('applies a declared add when the prose evidences it', () => {
    const result = reconcileConditions({
      prose: 'The shard opens a gash on your forearm. Blood drips between your fingers.',
      declared: { add: [{ kind: 'wounded', severity: 'moderate', source: 'the shard cut you' }] },
      playerState: makeState({ conditions: [] }),
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
    assert.ok(result.diff.conditionsAdded?.includes('زخمی'));
    // The declared add is honored; the undeclared bleeding next to it is
    // inferred independently — but nothing was declared-unsupported.
    assert.ok(!findFinding(result.findings, 'declared_unsupported'));
  });

  it('drops an unsupported declared add and records telemetry (EN)', () => {
    const result = reconcileConditions({
      prose: 'You walk the quiet market lane and count your coins.',
      declared: { add: [{ kind: 'bleeding' }] },
      playerState: makeState({ conditions: ['تندرست'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(!result.conditions.includes('خونریزی'));
    assert.equal(result.diff.conditionsAdded, undefined);
    assert.ok(findFinding(result.findings, 'declared_unsupported', 'bleeding'));
  });

  it('infers an undeclared wound when the turn cost health (FA prose)', () => {
    const result = reconcileConditions({
      prose: 'تیغ راهزن شکافی بر ساعدت می‌گشاید. خون از میان انگشتانت می‌چکد.',
      playerState: makeState({
        resources: { hp: 82, stamina: 50 },
        conditions: [],
      }),
      resolution: { outcome: 'failure', resourceChanges: { hp: -18 }, bodilyRisk: true },
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
    assert.ok(result.conditions.includes('خونریزی'));
    assert.ok(findFinding(result.findings, 'undeclared_wound', 'wounded'));
  });

  it('keeps a weak wound marker narrative-only when nothing mechanical hurt the player', () => {
    const result = reconcileConditions({
      prose: 'You limp slightly on the old bruise as you cross the courtyard.',
      playerState: makeState({ conditions: [] }),
      resolution: { outcome: 'success', resourceChanges: { hp: 0 }, bodilyRisk: false },
      rpgSystem: mockRpg,
    });

    assert.ok(!result.conditions.some((c) => c.startsWith('زخمی')));
    const finding = findFinding(result.findings, 'undeclared_wound', 'wounded');
    assert.ok(finding);
    assert.match(finding!.detail, /narrative only/i);
  });

  it('adds an explicit named injury even without a mechanical cost', () => {
    const result = reconcileConditions({
      prose: 'A loose roof tile slashes your shoulder open on the way out.',
      playerState: makeState({ conditions: [] }),
      resolution: { outcome: 'success', resourceChanges: { hp: 0 }, bodilyRisk: false },
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
  });

  it('applies a declared treat: untreated wound becomes treated, bleeding stops', () => {
    const result = reconcileConditions({
      prose: 'You tear a strip of cloth and bind the wound tight.',
      declared: { treat: [{ kind: 'wounded', method: 'strip of cloth' }] },
      playerState: makeState({ conditions: ['زخمی', 'خونریزی'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی (پانسمان‌شده)'));
    assert.ok(!result.conditions.includes('زخمی'));
    assert.ok(!result.conditions.includes('خونریزی'));
    assert.ok(findFinding(result.findings, 'treated', 'wounded'));
  });

  it('does not treat without treatment prose', () => {
    const result = reconcileConditions({
      prose: 'You keep running down the corridor, ignoring the sting.',
      declared: { treat: [{ kind: 'wounded' }] },
      playerState: makeState({ conditions: ['زخمی'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
    assert.ok(findFinding(result.findings, 'declared_unsupported', 'wounded'));
  });

  it('applies a declared remove only with healing prose and hardens the diff', () => {
    const result = reconcileConditions({
      prose: 'By dawn the gash has healed over, leaving only a thin scar.',
      declared: { remove: [{ kind: 'wounded', reason: 'night of rest' }] },
      previousConditions: ['زخمی'],
      playerState: makeState({ conditions: ['زخمی'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(!result.conditions.some((c) => c.startsWith('زخمی')));
    assert.ok(result.diff.conditionsRemoved?.includes('زخمی'));
    // Removals ship a full overwrite so mechanical derivation cannot revive it.
    assert.deepEqual(result.diff.conditions, result.conditions);
    assert.ok(findFinding(result.findings, 'healed', 'wounded'));
  });

  it('keeps a wound whose declared removal lacks healing prose', () => {
    const result = reconcileConditions({
      prose: 'You press on, jaw set, saying nothing of the pain.',
      declared: { remove: [{ kind: 'wounded' }] },
      playerState: makeState({ conditions: ['زخمی'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
    assert.ok(findFinding(result.findings, 'removal_unsupported', 'wounded'));
  });

  it('prose-first conflict: undeclared healing removes an old wound', () => {
    const result = reconcileConditions({
      prose: 'The زخم التیام یافته است; the skin is whole again.',
      previousConditions: ['زخمی'],
      playerState: makeState({ conditions: ['زخمی (پانسمان‌شده)'] }),
      rpgSystem: mockRpg,
    });

    assert.ok(!result.conditions.some((c) => c.startsWith('زخمی')));
    assert.ok(findFinding(result.findings, 'conflict', 'wounded'));
  });

  it('negation guard: "unharmed" prose never adds or keeps a wound', () => {
    const result = reconcileConditions({
      prose: 'You step out of the burning hall unharmed, without a scratch.',
      declared: { add: [{ kind: 'wounded' }] },
      playerState: makeState({ conditions: [] }),
      rpgSystem: mockRpg,
    });

    assert.ok(!result.conditions.some((c) => c.startsWith('زخمی')));
    assert.ok(findFinding(result.findings, 'declared_unsupported', 'wounded'));
  });

  it('stores custom kinds verbatim', () => {
    const result = reconcileConditions({
      prose: 'The old rune brands your palm with a faint silver mark.',
      declared: { add: [{ kind: 'rune-branded' }] },
      playerState: makeState({ conditions: [] }),
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('rune-branded'));
  });

  it('seeds the prompt-silent baseline when the body zone is clear', () => {
    const result = reconcileConditions({
      prose: 'You wake rested in the inn and stretch by the window.',
      playerState: makeState({ conditions: [] }),
      rpgSystem: mockRpg,
    });

    assert.deepEqual(result.conditions, ['تندرست']);
    assert.ok(findFinding(result.findings, 'seeded_baseline', 'baseline'));
  });

  it('never lets the baseline coexist with an active body condition', () => {
    const result = reconcileConditions({
      prose: 'The blade opens a gash along your ribs.',
      playerState: makeState({ conditions: ['تندرست'] }),
      resolution: { outcome: 'failure', resourceChanges: { hp: -20 }, bodilyRisk: true },
      rpgSystem: mockRpg,
    });

    assert.ok(result.conditions.includes('زخمی'));
    assert.ok(!result.conditions.includes('تندرست'));
  });

  it('resolves the story pool for mechanical harm and baseline ratios', () => {
    const harmed = reconcileConditions({
      prose: 'The club cracks against your shoulder; a dark bruise blooms beneath the skin.',
      playerState: makeState({
        resources: { health: 70, energy: 50 },
        maxResources: { health: 100, energy: 50 },
        conditions: [],
      }),
      resolution: { outcome: 'failure', resourceChanges: { health: -30 }, bodilyRisk: true },
      rpgSystem: healthPoolRpg,
    });
    assert.ok(harmed.conditions.includes('زخمی'));

    const seeded = reconcileConditions({
      prose: 'You rest by the well.',
      playerState: makeState({
        resources: { health: 100, energy: 50 },
        maxResources: { health: 100, energy: 50 },
        conditions: [],
      }),
      rpgSystem: healthPoolRpg,
    });
    assert.deepEqual(seeded.conditions, ['تندرست']);
  });

  it('returns an empty diff on perfectly quiet turns that change nothing', () => {
    const result = reconcileConditions({
      prose: 'You sip tea in comfortable silence; the road can wait until morning.',
      declared: { add: [], treat: [], remove: [] },
      playerState: makeState({ conditions: ['تندرست', 'ناآشنا'] }),
      rpgSystem: mockRpg,
    });

    assert.deepEqual(result.diff, {});
    assert.deepEqual(result.conditions, ['تندرست', 'ناآشنا']);
    assert.equal(result.findings.length, 0);
  });
});
