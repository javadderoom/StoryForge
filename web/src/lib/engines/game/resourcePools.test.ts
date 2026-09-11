import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePlayerResources, resolveResourceMax } from './resourcePools';

const baseRpg: any = {
  stats: [],
  resources: [
    { id: 'hp', name: 'Health', current: 20, max: 20, min: 0 },
    { id: 'stamina', name: 'Stamina', current: 10, max: 10, min: 0 },
  ],
  archetypes: [],
  backgrounds: [],
};

const basePlayer: any = {
  stats: {},
  resources: { hp: 20, stamina: 10 },
  maxResources: { hp: 20, stamina: 10 },
  inventory: [],
  equipment: {},
};

describe('resourcePools', () => {
  it('adds newly created pools from studio edits', () => {
    const rpg = { ...baseRpg, resources: [...baseRpg.resources, { id: 'mana', name: 'Mana', current: 15, max: 15, min: 0 }] };
    const { playerState, changed } = reconcilePlayerResources(basePlayer, rpg);
    assert.equal(changed, true);
    assert.equal(playerState.resources.mana, 15);
    assert.equal(playerState.maxResources?.mana, 15);
  });

  it('recomputes max when a studio max edit lands', () => {
    const rpg = {
      ...baseRpg,
      resources: [
        { id: 'hp', name: 'Health', current: 20, max: 40, min: 0 },
        baseRpg.resources[1],
      ],
    };
    const { playerState, changed } = reconcilePlayerResources(basePlayer, rpg);
    assert.equal(changed, true);
    assert.equal(playerState.maxResources?.hp, 40);
    assert.equal(playerState.resources.hp, 20);
  });

  it('clamps over-max currents and drops deleted pools', () => {
    const player = { ...basePlayer, resources: { hp: 99, stamina: 10, ghost: 5 }, maxResources: { hp: 20, stamina: 10, ghost: 5 } };
    const { playerState } = reconcilePlayerResources(player, baseRpg);
    assert.equal(playerState.resources.hp, 20);
    assert.equal('ghost' in playerState.resources, false);
  });

  it('resolveResourceMax prefers scaled maxResources', () => {
    assert.equal(resolveResourceMax('hp', baseRpg, { maxResources: { hp: 35 } }), 35);
    assert.equal(resolveResourceMax('hp', baseRpg, {}), 20);
  });
});
