import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePlayerResources, resolveHealthKey, resolveResourceMax } from './resourcePools';

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

  it('a full pool moves with a studio max edit', () => {
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
    assert.equal(playerState.resources.hp, 40);
  });

  it('a damaged pool keeps its damage when max grows', () => {
    const rpg = {
      ...baseRpg,
      resources: [
        { id: 'hp', name: 'Health', current: 20, max: 40, min: 0 },
        baseRpg.resources[1],
      ],
    };
    const hurt = { ...basePlayer, resources: { ...basePlayer.resources, hp: 12 } };
    const { playerState } = reconcilePlayerResources(hurt, rpg);
    assert.equal(playerState.maxResources?.hp, 40);
    assert.equal(playerState.resources.hp, 12);
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

  it('resolveHealthKey selects the shared named and fallback pools', () => {
    assert.equal(resolveHealthKey({ resources: [{ id: 'health' }, { id: 'mana' }] }), 'health');
    assert.equal(resolveHealthKey({ resources: [{ id: 'سلامت' }, { id: 'mana' }] }), 'سلامت');
    assert.equal(resolveHealthKey({ resources: [{ id: 'vitality' }, { id: 'mana' }] }), 'vitality');
    assert.equal(resolveHealthKey({ resources: [{ id: 'mana' }, { id: 'resolve' }] }), 'mana');
    assert.equal(resolveHealthKey(undefined), 'health');
  });
});
