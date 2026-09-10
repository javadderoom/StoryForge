import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AbilityDefinition, AbilityType } from '@/lib/types/rpg';
import { GameEngine } from '@/lib/engines/game/GameEngine';

describe('Abilities & Spells System — Types, Validation & DC Resolution', () => {
  const fireball: AbilityDefinition = {
    id: 'spell_fireball',
    name: 'Fireball',
    description: 'A bright streak flashes from your pointing finger then blossoms into an explosion of flame.',
    type: 'active_spell',
    icon: '🔥',
    tier: 3,
    linkedStatId: 'arcana',
    cost: { targetResourceId: 'mana', amount: 15 },
    cooldownTurns: 2,
    effectSummary: 'Deals 28 Fire damage in a 20ft radius.',
    allowedArchetypeIds: ['arch_mage'],
    tags: ['fire', 'evocation', 'aoe'],
  };

  const shadowStep: AbilityDefinition = {
    id: 'tech_shadow_step',
    name: 'Shadow Step',
    description: 'Slip into the shadow world and reappear behind an enemy.',
    type: 'active_technique',
    icon: '🗡️',
    tier: 2,
    linkedStatId: 'agility',
    cost: { targetResourceId: 'stamina', amount: 10 },
    cooldownTurns: 1,
    effectSummary: 'Teleport behind target, granting advantage on next strike.',
    allowedArchetypeIds: ['arch_rogue'],
    tags: ['stealth', 'teleport'],
  };

  const universalFirstAid: AbilityDefinition = {
    id: 'skill_first_aid',
    name: 'First Aid',
    description: 'Basic battlefield wound dressing.',
    type: 'passive_skill',
    icon: '🩹',
    tier: 1,
    linkedStatId: 'cunning',
    effectSummary: '+2 on survival and healing actions.',
    tags: ['healing', 'survival'],
  };

  it('validates ability properties, costs, and archetype restrictions', () => {
    assert.equal(fireball.type, 'active_spell');
    assert.equal(fireball.cost?.targetResourceId, 'mana');
    assert.equal(fireball.cost?.amount, 15);
    assert.deepEqual(fireball.allowedArchetypeIds, ['arch_mage']);

    assert.equal(universalFirstAid.cost, undefined);
    assert.equal(universalFirstAid.allowedArchetypeIds, undefined);
  });

  it('correctly identifies universal vs class-gated abilities', () => {
    const isUniversal = (ab: AbilityDefinition) =>
      !ab.allowedArchetypeIds || ab.allowedArchetypeIds.length === 0;

    const canUse = (ab: AbilityDefinition, archId: string) =>
      isUniversal(ab) || (ab.allowedArchetypeIds?.includes(archId) ?? false);

    assert.equal(isUniversal(universalFirstAid), true);
    assert.equal(isUniversal(fireball), false);

    assert.equal(canUse(fireball, 'arch_mage'), true);
    assert.equal(canUse(fireball, 'arch_warrior'), false);
    assert.equal(canUse(universalFirstAid, 'arch_warrior'), true);
    assert.equal(canUse(shadowStep, 'arch_rogue'), true);
    assert.equal(canUse(shadowStep, 'arch_mage'), false);
  });

  it('GameEngine.inferStatId recognizes ability names and infers linked attribute', () => {
    const rpgSystem: any = {
      stats: [
        { id: 'arcana', name: 'دانش کهن', baseValue: 10 },
        { id: 'agility', name: 'چابکی', baseValue: 10 },
      ],
      skills: [],
      abilities: [fireball, shadowStep],
    };

    const inferredForFireball = GameEngine.inferStatId('I cast Fireball at the goblin pack', rpgSystem);
    assert.equal(inferredForFireball, 'arcana');

    const inferredForShadowStep = GameEngine.inferStatId('Using Shadow Step to slip past the sentinel', rpgSystem);
    assert.equal(inferredForShadowStep, 'agility');
  });

  it('GameEngine.resolveActionCheck awards ability tier bonus when skillId matches an ability', () => {
    const rpgSystem: any = {
      hasCombat: true,
      diceType: 'd20',
      stats: [{ id: 'arcana', name: 'Arcana', baseValue: 10 }],
      skills: [],
      abilities: [fireball],
    };

    const playerState: any = {
      stats: { arcana: 10 },
      resources: { mana: 30, hp: 20 },
      inventory: [],
      equipment: {},
    };

    const result = GameEngine.resolveActionCheck(
      'Cast Fireball',
      playerState,
      rpgSystem,
      { skillId: 'spell_fireball', targetDC: 15 }
    );

    // statModifier in CheckResolution contains statModifier + skillBonus + equipmentModifier
    assert.equal(result.statModifier, 6); // statModifier (0) + skillBonus (tier 3 * 2 = 6)
  });
});
