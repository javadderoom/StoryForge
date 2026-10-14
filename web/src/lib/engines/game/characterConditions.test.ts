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

    // Desert water clock hits 2 segments
    state = GameEngine.applyStateMutation(
      state,
      {
        clockUpdates: [{ id: 'clock_loc_mtpqnxvl_jdgi', delta: 2, isCrisis: false }],
      },
      mockRpg
    );
    assert.ok(state.conditions?.includes('تشنه'));

    // Reset clock back to 0 segments
    state = GameEngine.applyStateMutation(
      state,
      {
        clockUpdates: [{ id: 'clock_loc_mtpqnxvl_jdgi', delta: -2, isCrisis: false }],
      },
      mockRpg
    );
    assert.ok(!state.conditions?.includes('تشنه'));
  });
});
