import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './GameEngine';
import { PlayerState } from '@/lib/types/gameplay';
import { RPGSystemSchema } from '@/lib/types/rpg';

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

function createBaseState(): PlayerState {
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
    conditions: ['ناآشنا'],
  };
}

describe('Character Conditions & Status System', () => {
  it('adds and removes conditions via StateMutationDiff', () => {
    let state = createBaseState();
    assert.deepEqual(state.conditions, ['ناآشنا']);

    // Add 'گیج'
    state = GameEngine.applyStateMutation(state, { conditionsAdded: ['گیج'] }, mockRpg);
    assert.ok(state.conditions?.includes('گیج'));
    assert.ok(state.conditions?.includes('ناآشنا'));

    // Remove 'گیج'
    state = GameEngine.applyStateMutation(state, { conditionsRemoved: ['گیج'] }, mockRpg);
    assert.ok(!state.conditions?.includes('گیج'));
    assert.ok(state.conditions?.includes('ناآشنا'));
  });

  it('auto-derives "زخمی" when HP drops to or below 35%', () => {
    let state = createBaseState();
    assert.ok(!state.conditions?.includes('زخمی'));

    // Take 70 damage -> HP 30/100 (30% <= 35%)
    state = GameEngine.applyStateMutation(state, { resourceChanges: { hp: -70 } }, mockRpg);
    assert.ok(state.conditions?.includes('زخمی'));

    // Heal back to 80/100 -> 'زخمی' removed
    state = GameEngine.applyStateMutation(state, { resourceChanges: { hp: 50 } }, mockRpg);
    assert.ok(!state.conditions?.includes('زخمی'));
  });

  it('auto-derives "خسته" when Stamina drops to or below 20%', () => {
    let state = createBaseState();
    assert.ok(!state.conditions?.includes('خسته'));

    // Spend 45 stamina -> Stamina 5/50 (10% <= 20%)
    state = GameEngine.applyStateMutation(state, { resourceChanges: { stamina: -45 } }, mockRpg);
    assert.ok(state.conditions?.includes('خسته'));

    // Rest up to 45/50 -> 'خسته' removed
    state = GameEngine.applyStateMutation(state, { resourceChanges: { stamina: 40 } }, mockRpg);
    assert.ok(!state.conditions?.includes('خسته'));
  });

  it('auto-derives "تشنه" when desert water clock reaches 2 or more segments', () => {
    let state = createBaseState();
    assert.ok(!state.conditions?.includes('تشنه'));

    // Desert water clock hits 2 segments (metadata identifies it as water —
    // Plan 17 dropped the old hardcoded session-id check).
    state = GameEngine.applyStateMutation(
      state,
      {
        clockUpdates: [{ id: 'clock_water_demo', delta: 2, isCrisis: false }],
      },
      mockRpg
    );
    assert.ok(state.conditions?.includes('تشنه'));

    // Reset clock back to 0 segments
    state = GameEngine.applyStateMutation(
      state,
      {
        clockUpdates: [{ id: 'clock_water_demo', delta: -2, isCrisis: false }],
      },
      mockRpg
    );
    assert.ok(!state.conditions?.includes('تشنه'));
  });

  describe('Deterministic mechanical effects (Plan 17 §3.9)', () => {
    it('untreated wound scales stamina cost by +25% on bodily-risk mixed failure', () => {
      const state: PlayerState = {
        ...createBaseState(),
        conditions: ['زخمی'],
      };
      // Force roll 9 (DC 12 target -> 9 is DC - 3, mixed_success)
      const resolution = GameEngine.resolveActionCheck(
        'حمله با شمشیر به نگهبان', // bodily risk
        state,
        mockRpg,
        { statId: 'might', forcedDiceRoll: 9, targetDC: 12 }
      );
      assert.equal(resolution.outcome, 'mixed_success');
      // Base stamina 10 * 1.25 = 12.5 -> Math.round is 13
      assert.equal(resolution.stateDiff.resourceChanges?.['stamina'], -13);
      // HP cost unchanged at -5
      assert.equal(resolution.stateDiff.resourceChanges?.['hp'], -5);
    });

    it('treated wound scales stamina cost by +10% on bodily-risk mixed failure', () => {
      const state: PlayerState = {
        ...createBaseState(),
        conditions: ['زخمی (پانسمان‌شده)'],
      };
      const resolution = GameEngine.resolveActionCheck(
        'حمله با شمشیر به نگهبان',
        state,
        mockRpg,
        { statId: 'might', forcedDiceRoll: 9, targetDC: 12 }
      );
      assert.equal(resolution.outcome, 'mixed_success');
      // Base stamina 10 * 1.10 = 11
      assert.equal(resolution.stateDiff.resourceChanges?.['stamina'], -11);
      assert.equal(resolution.stateDiff.resourceChanges?.['hp'], -5);
    });

    it('exhausted applies -1 to physical stat modifier (clamped >= 0)', () => {
      // mockRpg.stats has might baseValue = 12. might 16 -> base modifier +2
      const state: PlayerState = {
        ...createBaseState(),
        stats: { might: 16, cunning: 14 },
        conditions: ['خسته'],
      };
      // Physical check: modifier +2 - 1 = +1
      const physRes = GameEngine.resolveActionCheck(
        'شکستن در چوبی',
        state,
        mockRpg,
        { statId: 'might', forcedDiceRoll: 10, targetDC: 15 }
      );
      assert.equal(physRes.statModifier, 1);

      // Non-physical check (cunning): unaffected (+2)
      const mentalRes = GameEngine.resolveActionCheck(
        'خواندن کتیبه باستانی',
        state,
        mockRpg,
        { statId: 'cunning', forcedDiceRoll: 10, targetDC: 15 }
      );
      assert.equal(mentalRes.statModifier, 2);
    });

    it('thirsty incurs +1 extra threat clock tick on desert travel', () => {
      const state: PlayerState = {
        ...createBaseState(),
        travel: {
          originLocationId: 'loc_oasis',
          destinationLocationId: 'loc_citadel',
          mode: 'caravan',
          departedTurn: 1,
          totalTurns: 3,
        },
        currentLocationId: 'loc_desert_trail',
        conditions: ['تشنه'],
      };
      const clock = {
        id: 'clock_loc_desert_trail',
        name: 'عطش کویر',
        currentSegments: 1,
        maxSegments: 4,
        crisisDescription: 'بحران تشنگی در کویر',
      };
      // Forced roll 5 -> failure (base tick +1) + thirsty (+1) = 2 ticks -> 3 segments
      const resolution = GameEngine.resolveActionCheck(
        'پیشروی در کویر داغ',
        state,
        mockRpg,
        {
          statId: 'might',
          forcedDiceRoll: 5,
          targetDC: 15,
          currentLocationId: 'loc_desert_trail',
          activeClocks: [clock],
        }
      );
      assert.equal(resolution.outcome, 'failure');
      assert.equal(resolution.clockUpdate?.newSegments, 3);
    });

    it('respects ENABLE_CONDITION_EFFECTS=false environment flag', () => {
      const prev = process.env.ENABLE_CONDITION_EFFECTS;
      try {
        process.env.ENABLE_CONDITION_EFFECTS = 'false';
        const state: PlayerState = {
          ...createBaseState(),
          conditions: ['زخمی'],
        };
        const resolution = GameEngine.resolveActionCheck(
          'حمله با شمشیر',
          state,
          mockRpg,
          { statId: 'might', forcedDiceRoll: 9, targetDC: 12 }
        );
        // Base stamina cost 10 when effects are disabled
        assert.equal(resolution.stateDiff.resourceChanges?.['stamina'], -10);
      } finally {
        if (prev === undefined) delete process.env.ENABLE_CONDITION_EFFECTS;
        else process.env.ENABLE_CONDITION_EFFECTS = prev;
      }
    });
  });
});

