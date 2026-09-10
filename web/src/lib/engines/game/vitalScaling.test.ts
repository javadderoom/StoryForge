import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMaxResources } from './vitalScaling';
import { RPGSystemSchema } from '@/lib/types/rpg';

describe('Vital Scaling Engine — Dynamic Stat-to-Vital & Loadout Matrix', () => {
  const mockRpgSystem: RPGSystemSchema = {
    hasCombat: true,
    diceType: 'd20',
    inventoryCapacity: 10,
    stats: [
      {
        id: 'might',
        name: 'Might',
        description: 'Physical power',
        baseValue: 10,
      },
      {
        id: 'constitution',
        name: 'Constitution',
        description: 'Stamina and health resilience',
        baseValue: 10,
        vitalEffect: {
          targetResourceId: 'hp',
          bonusPerPointAboveBase: 2, // +2 HP per point above 10
        },
      },
      {
        id: 'willpower',
        name: 'Willpower',
        description: 'Mental fortitude',
        baseValue: 10,
        vitalEffect: {
          targetResourceId: 'resolve',
          bonusPerPointAboveBase: 1, // +1 Resolve per point above 10
        },
      },
    ],
    resources: [
      { id: 'hp', name: 'Health Points', current: 20, max: 20, min: 0 },
      { id: 'stamina', name: 'Stamina', current: 15, max: 15, min: 0 },
      { id: 'resolve', name: 'Resolve', current: 10, max: 10, min: 0 },
    ],
    skills: [],
    startingInventory: [],
  };

  it('calculates baseline maximums when stats match base values', () => {
    const stats = { might: 10, constitution: 10, willpower: 10 };
    const maxRes = computeMaxResources(stats, mockRpgSystem);

    assert.equal(maxRes.hp, 20);
    assert.equal(maxRes.stamina, 15);
    assert.equal(maxRes.resolve, 10);
  });

  it('scales HP when Constitution increases above base (e.g. 14 -> +8 HP)', () => {
    // 14 CON is +4 above 10 -> 4 * 2 = +8 HP
    const stats = { might: 10, constitution: 14, willpower: 10 };
    const maxRes = computeMaxResources(stats, mockRpgSystem);

    assert.equal(maxRes.hp, 28);
    assert.equal(maxRes.stamina, 15);
    assert.equal(maxRes.resolve, 10);
  });

  it('reduces HP when Constitution is below base (e.g. 8 -> -4 HP)', () => {
    // 8 CON is -2 below 10 -> -2 * 2 = -4 HP
    const stats = { might: 10, constitution: 8, willpower: 10 };
    const maxRes = computeMaxResources(stats, mockRpgSystem);

    assert.equal(maxRes.hp, 16);
  });

  it('incorporates Archetype and Background vital pool bonuses', () => {
    const stats = { might: 10, constitution: 12, willpower: 10 }; // +4 HP from CON
    const archetype = {
      id: 'warrior',
      name: 'Warrior',
      tagline: '',
      description: '',
      statBonuses: {},
      resourceBonuses: { hp: 5, stamina: 3 }, // +5 HP, +3 Stamina
    };
    const background = {
      id: 'veteran',
      name: 'Veteran',
      description: '',
      trait: '',
      resourceBonuses: { stamina: 4, resolve: 2 }, // +4 Stamina, +2 Resolve
    };

    const maxRes = computeMaxResources(stats, mockRpgSystem, { archetype, background });

    // HP = 20 (base) + 4 (from 12 CON) + 5 (archetype) = 29
    assert.equal(maxRes.hp, 29);
    // Stamina = 15 (base) + 3 (archetype) + 4 (background) = 22
    assert.equal(maxRes.stamina, 22);
    // Resolve = 10 (base) + 2 (background) = 12
    assert.equal(maxRes.resolve, 12);
  });

  it('incorporates equipped gear resource modifiers', () => {
    const stats = { might: 10, constitution: 10, willpower: 10 };
    const equippedArtifacts: Array<{ resourceModifiers?: Record<string, number> }> = [
      { resourceModifiers: { hp: 10 } }, // Shield of Health
      { resourceModifiers: { stamina: 5, resolve: 3 } }, // Amulet
    ];

    const maxRes = computeMaxResources(stats, mockRpgSystem, { equippedArtifacts });

    assert.equal(maxRes.hp, 30);
    assert.equal(maxRes.stamina, 20);
    assert.equal(maxRes.resolve, 13);
  });
});
