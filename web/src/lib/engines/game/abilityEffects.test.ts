import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AbilityDefinition, BackgroundOriginDefinition, RPGSystemSchema } from '@/lib/types/rpg';
import { PlayerState } from '@/lib/types/gameplay';
import {
  evaluateAbilityEffects,
  validateAbilityInvocation,
  detectInvokedAbility,
  getCooldownRemaining,
  matchesRollSpec,
  resolveTraitIds,
  describeRollModifier,
} from '@/lib/engines/game/abilityEffects';
import { evaluatePassiveAbilities } from '@/lib/engines/game/passiveAbilities';
import { GameEngine } from '@/lib/engines/game/GameEngine';

const stats = [
  { id: 'might', name: 'Might', description: '', baseValue: 10 },
  { id: 'cunning', name: 'Cunning', description: '', baseValue: 10 },
];

function rpgSystem(partial: Record<string, unknown> = {}): RPGSystemSchema {
  return {
    hasCombat: true,
    diceType: 'd20',
    universalBaseValue: 10,
    stats,
    resources: [{ id: 'health', name: 'Health', current: 20, max: 20, min: 0 }],
    abilities: [],
    skills: [],
    startingInventory: [],
    inventoryCapacity: 12,
    ...partial,
  } as unknown as RPGSystemSchema;
}

function playerState(partial: Partial<PlayerState> = {}): PlayerState {
  return {
    stats: { might: 10, cunning: 10 },
    resources: { health: 20, mana: 30 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_a',
    ...partial,
  };
}

test('passive structured bonus applies on matching check', () => {
  const firstAid: AbilityDefinition = {
    id: 'skill_first_aid',
    name: 'First Aid',
    description: 'Battlefield wound dressing.',
    type: 'passive_skill',
    rollModifiers: [
      {
        modifier: 2,
        statIds: ['might'],
        triggerKeywords: ['heal', 'bandage', 'wound'],
        matchMode: 'any',
        labelEn: 'First Aid care',
        labelFa: 'help',
      },
    ],
  };
  const sys = rpgSystem({ abilities: [firstAid] });
  const ps = playerState({ abilities: ['skill_first_aid'] });
  const applied = evaluateAbilityEffects({
    actionText: 'I bandage the wound quickly',
    playerState: ps,
    rpgSystem: sys,
    effectiveStatId: 'might',
  });
  assert.equal(applied.totalModifier, 2);
  assert.equal(applied.contributions.length, 1);
  assert.equal(applied.contributions[0]?.source, 'passive');
  const ignored = evaluateAbilityEffects({
    actionText: 'I swing my sword at the guard',
    playerState: ps,
    rpgSystem: sys,
    effectiveStatId: 'might',
  });
  assert.equal(ignored.totalModifier, 0);
});

test('unlearned passive grants nothing', () => {
  const sharp: AbilityDefinition = {
    id: 'skill_tracking',
    name: 'Tracking',
    description: '',
    type: 'passive_skill',
    rollModifiers: [{ modifier: 3, labelEn: 'Tracking' }],
  };
  const sys = rpgSystem({ abilities: [sharp] });
  const result = evaluateAbilityEffects({
    actionText: 'I follow the footprints',
    playerState: playerState({ abilities: [] }),
    rpgSystem: sys,
    effectiveStatId: 'cunning',
  });
  assert.equal(result.totalModifier, 0);
});

test('legacy prose-only passive stays handled by legacy path', () => {
  const legacy: AbilityDefinition = {
    id: 'skill_legacy',
    name: 'Old Ways',
    description: '',
    type: 'passive_skill',
    effectSummary: '+2 on healing actions.',
  };
  const sys = rpgSystem({ abilities: [legacy] });
  const structured = evaluateAbilityEffects({
    actionText: 'I heal my ally',
    playerState: playerState({ abilities: ['skill_legacy'] }),
    rpgSystem: sys,
    effectiveStatId: 'might',
  });
  assert.equal(structured.totalModifier, 0);
  const viaLegacy = evaluatePassiveAbilities(
    'I heal my ally',
    playerState({ abilities: ['skill_legacy'] }),
    sys
  );
  assert.equal(viaLegacy.totalModifier, 2);
});

test('active invocation validates, pays cost, cools down', () => {
  const fireball: AbilityDefinition = {
    id: 'spell_fireball',
    name: 'Fireball',
    description: 'Explosion of flame.',
    type: 'active_spell',
    cost: { targetResourceId: 'mana', amount: 15 },
    cooldownTurns: 2,
    activation: {
      effects: [{ modifier: 4, labelEn: 'Fireball blast', labelFa: 'blast' }],
    },
  };
  const sys = rpgSystem({
    resources: [
      { id: 'health', name: 'Health', current: 20, max: 20, min: 0 },
      { id: 'mana', name: 'Mana', current: 30, max: 30, min: 0 },
    ],
    abilities: [fireball],
  });
  const ps = playerState({ abilities: ['spell_fireball'] });
  assert.equal(validateAbilityInvocation(ps, sys, 'spell_fireball', 5).ok, true);
  const applied = evaluateAbilityEffects({
    actionText: 'I hurl Fireball at the pack',
    playerState: ps,
    rpgSystem: sys,
    invokedAbilityId: 'spell_fireball',
    turnNumber: 5,
  });
  assert.equal(applied.totalModifier, 4);
  assert.equal(applied.invocation?.abilityId, 'spell_fireball');
  assert.deepEqual(applied.invocation?.cost, { targetResourceId: 'mana', amount: 15 });
  const cooling = playerState({ abilities: ['spell_fireball'], abilityCooldowns: { spell_fireball: 5 } });
  const fireballDef = (sys.abilities ?? []).find((a) => a.id === 'spell_fireball') as AbilityDefinition;
  assert.equal(getCooldownRemaining(cooling, fireballDef, 6), 1);
  const blocked = validateAbilityInvocation(cooling, sys, 'spell_fireball', 6);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'cooldown');
  const poor = validateAbilityInvocation(
    playerState({ abilities: ['spell_fireball'], resources: { mana: 5 } }),
    sys,
    'spell_fireball',
    10
  );
  assert.equal(poor.ok, false);
  assert.equal(poor.code, 'insufficient');
  assert.match(poor.reasonFa ?? '', /mana/i);
});

test('explicit invocation rejects unknown, unlearned, passive ids', () => {
  const passive: AbilityDefinition = {
    id: 'skill_first_aid',
    name: 'First Aid',
    description: '',
    type: 'passive_skill',
    rollModifiers: [{ modifier: 2 }],
  };
  const sys = rpgSystem({ abilities: [passive] });
  assert.equal(validateAbilityInvocation(playerState(), sys, 'nope', 1).code, 'unknown');
  assert.equal(validateAbilityInvocation(playerState(), sys, 'skill_first_aid', 1).code, 'not_learned');
  const owned = playerState({ abilities: ['skill_first_aid'] });
  assert.equal(validateAbilityInvocation(owned, sys, 'skill_first_aid', 1).code, 'not_active');
});

test('free-text mention auto-invokes learned affordable active', () => {
  const step: AbilityDefinition = {
    id: 'tech_shadow_step',
    name: 'Shadow Step',
    description: '',
    type: 'active_technique',
    cost: { targetResourceId: 'stamina', amount: 10 },
    activation: { effects: [{ modifier: 3, actionStyles: ['stealthy'] }] },
  };
  const sys = rpgSystem({
    resources: [
      { id: 'health', name: 'Health', current: 20, max: 20, min: 0 },
      { id: 'stamina', name: 'Stamina', current: 20, max: 20, min: 0 },
    ],
    abilities: [step],
  });
  const ps = playerState({
    abilities: ['tech_shadow_step'],
    resources: { health: 20, stamina: 20 },
  });
  const found = detectInvokedAbility('I use Shadow Step to slip past', ps, sys, 3);
  assert.equal(found?.id, 'tech_shadow_step');
  const applied = evaluateAbilityEffects({
    actionText: 'I use Shadow Step to slip past the sentinel',
    playerState: ps,
    rpgSystem: sys,
    actionStyle: 'stealthy',
    turnNumber: 3,
    invokedAbilityId: 'tech_shadow_step',
  });
  assert.equal(applied.invocation?.abilityId, 'tech_shadow_step');
  assert.equal(applied.totalModifier, 3);
  assert.equal(
    detectInvokedAbility('I use Shadow Step to slip past', playerState({ abilities: [] }), sys, 3),
    null
  );
});

test('background traits grant always-on bonuses', () => {
  const bg: BackgroundOriginDefinition = {
    id: 'bg_street_urchin',
    name: 'Urchin',
    description: '',
    trait: 'Raised on the streets.',
    traits: [
      {
        id: 'trait_urchin_agility',
        name: 'Street Agility',
        rollModifiers: [{ modifier: 1, statIds: ['might'] }],
      },
    ],
  };
  const sys = rpgSystem({ backgrounds: [bg] });
  const viaBackground = evaluateAbilityEffects({
    actionText: 'I climb the wall',
    playerState: playerState({ backgroundId: 'bg_street_urchin' }),
    rpgSystem: sys,
    effectiveStatId: 'might',
  });
  assert.equal(viaBackground.totalModifier, 1);
  assert.equal(viaBackground.contributions[0]?.source, 'trait');
  const viaSnapshot = evaluateAbilityEffects({
    actionText: 'I climb the wall',
    playerState: playerState({ traitIds: ['trait_urchin_agility'] }),
    rpgSystem: sys,
    effectiveStatId: 'might',
  });
  assert.equal(viaSnapshot.totalModifier, 1);
  const offStat = evaluateAbilityEffects({
    actionText: 'I recall the old treaty',
    playerState: playerState({ backgroundId: 'bg_street_urchin' }),
    rpgSystem: sys,
    effectiveStatId: 'cunning',
  });
  assert.equal(offStat.totalModifier, 0);
});

test('resolveTraitIds prefers snapshot then background fallback', () => {
  const bg: BackgroundOriginDefinition = {
    id: 'bg_a',
    name: 'A',
    description: '',
    trait: 'A.',
    traits: [{ id: 't1', name: 'T1', rollModifiers: [{ modifier: 1 }] }],
  };
  const sys = rpgSystem({ backgrounds: [bg] });
  assert.deepEqual(resolveTraitIds(playerState({ traitIds: ['t9'] }), sys), ['t9']);
  assert.deepEqual(resolveTraitIds(playerState({ backgroundId: 'bg_a' }), sys), ['t1']);
  assert.deepEqual(resolveTraitIds(playerState({}), sys), []);
});

test('spec gating honors stat style risk equipment keywords', () => {
  const ps = playerState({
    inventory: [{ id: 'dagger', name: 'Dagger', type: 'weapon' } as never],
    equipment: { mainHand: 'dagger' },
  });
  const base = { playerState: ps, lowerAction: 'i move quietly' };
  assert.equal(matchesRollSpec({ modifier: 2, statIds: ['might'] }, { ...base, effectiveStatId: 'cunning' }), false);
  assert.equal(matchesRollSpec({ modifier: 2, actionStyles: ['stealthy'] }, { ...base, actionStyle: 'aggressive' }), false);
  assert.equal(matchesRollSpec({ modifier: 2, riskLevels: ['high'] }, { ...base, riskLevel: 'low' }), false);
  assert.equal(matchesRollSpec({ modifier: 2, requiresEquippedSlot: 'armor' }, base), false);
  assert.equal(matchesRollSpec({ modifier: 2, requiresItemType: 'armor' }, base), false);
  assert.equal(matchesRollSpec({ modifier: 2, requiresItemType: 'weapon' }, base), true);
  assert.equal(
    matchesRollSpec({ modifier: 2, triggerKeywords: ['shadow', 'flame'], matchMode: 'all' }, { ...base, lowerAction: 'shadow step' }),
    false
  );
  assert.equal(
    matchesRollSpec({ modifier: 2, triggerKeywords: ['shadow', 'flame'], matchMode: 'any' }, { ...base, lowerAction: 'shadow step' }),
    true
  );
});

test('describeRollModifier renders one machine-readable line', () => {
  const line = describeRollModifier({ modifier: 2, statIds: ['might'], labelEn: 'Heavy Lifting' });
  assert.match(line, /\+2/);
  assert.match(line, /Heavy Lifting/);
  assert.match(line, /might/);
  assert.match(describeRollModifier({ modifier: -1 }), /-1/);
});

test('GameEngine folds ability and trait bonuses into d20 total', () => {
  const edge: AbilityDefinition = {
    id: 'skill_edge',
    name: 'Edge',
    description: '',
    type: 'passive_skill',
    rollModifiers: [{ modifier: 3, labelEn: 'Edge' }],
  };
  const bg: BackgroundOriginDefinition = {
    id: 'bg_b',
    name: 'B',
    description: '',
    trait: 'B.',
    traits: [{ id: 't_edge', name: 'Edge trait', rollModifiers: [{ modifier: 2 }] }],
  };
  const sys = rpgSystem({ abilities: [edge], backgrounds: [bg] });
  const ps = playerState({ abilities: ['skill_edge'], backgroundId: 'bg_b' });
  const res = GameEngine.resolveActionCheck('I push through', ps, sys, {
    statId: 'might',
    targetDC: 12,
    forcedDiceRoll: 10,
  });
  // d20 10 + statMod 0 + ability 3 + trait 2 = 15 >= DC 12.
  assert.equal(res.totalScore, 15);
  assert.equal(res.outcome, 'success');
  assert.equal(res.abilityContributions?.length, 2);
  assert.equal(res.statModifier, 5);
});





