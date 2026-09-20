import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AbilityDefinition, BackgroundOriginDefinition } from '@/lib/types/rpg';
import {
  inferRollModifierFromProse,
  backfillAbility,
  backfillBackground,
  backfillRpgSystem,
} from './backfillAbilities';

test('inferRollModifierFromProse detects shield defense bonus', () => {
  const ability: AbilityDefinition = {
    id: 'skill_shield_wall',
    name: 'دیوار بارانداز',
    description: 'دفاع در برابر حملات دوربرد سبک با سپر',
    type: 'passive_skill',
    effectSummary: '+3 به دفاع در برابر تیر و سنگ با سپر',
  };

  const spec = inferRollModifierFromProse(ability);
  assert.ok(spec);
  assert.equal(spec.modifier, 3);
  assert.equal(spec.requiresEquippedSlot, 'offHand');
  assert.equal(spec.requiresItemType, 'shield');
  assert.deepEqual(spec.actionStyles, ['defensive']);
});

test('inferRollModifierFromProse detects negative penalty and persuasion keywords', () => {
  const ability: AbilityDefinition = {
    id: 'skill_rough_tongue',
    name: 'زبان تلخ',
    description: 'گفتار ناهنجار بیابان‌نشین',
    type: 'passive_feat',
    effectSummary: '-3 در آزمون‌های متقاعدسازی یا درک نیت مأموران اداری و کاتبان',
  };

  const spec = inferRollModifierFromProse(ability);
  assert.ok(spec);
  assert.equal(spec.modifier, -3);
  assert.ok(spec.actionStyles?.includes('diplomatic'));
});

test('inferRollModifierFromProse detects wound/healing keywords', () => {
  const ability: AbilityDefinition = {
    id: 'skill_first_aid',
    name: 'First Aid',
    description: 'Field wound treatment',
    type: 'passive_skill',
    effectSummary: '+2 on healing actions.',
  };

  const spec = inferRollModifierFromProse(ability);
  assert.ok(spec);
  assert.equal(spec.modifier, 2);
  assert.ok(spec.triggerKeywords?.includes('wound'));
});

test('backfillAbility is idempotent: does not overwrite already structured ability', () => {
  const existingSpec = { modifier: 5, labelEn: 'Custom' };
  const structured: AbilityDefinition = {
    id: 'skill_mighty',
    name: 'Mighty',
    description: '+2 bonus',
    type: 'passive_skill',
    rollModifiers: [existingSpec],
  };

  const res = backfillAbility(structured);
  assert.equal(res.modified, false);
  assert.deepEqual(res.ability.rollModifiers, [existingSpec]);
});

test('backfillAbility sets activation effects for active techniques', () => {
  const tech: AbilityDefinition = {
    id: 'tech_shadow_strike',
    name: 'Shadow Strike',
    description: 'Strike from shadow',
    type: 'active_technique',
    effectSummary: '+4 on ambush strike',
    cost: { targetResourceId: 'stamina', amount: 15 },
    cooldownTurns: 2,
  };

  const res = backfillAbility(tech);
  assert.equal(res.modified, true);
  assert.ok(res.ability.activation);
  assert.equal(res.ability.activation?.effects.length, 1);
  assert.equal(res.ability.activation?.effects[0]?.modifier, 4);
  assert.equal(res.ability.activation?.cooldownTurns, 2);
});

test('backfillBackground converts legacy trait string to discrete BackgroundTraits', () => {
  const bg: BackgroundOriginDefinition = {
    id: 'bg_nomad',
    name: 'کوچ‌نشین',
    description: 'پرورش‌یافته در دشت‌ها',
    trait: 'شناخت گذرگاه‌های مخفی دژ\nزخم‌بندی در میدان نبرد',
  };

  const res = backfillBackground(bg);
  assert.equal(res.modified, true);
  assert.equal(res.background.traits?.length, 2);
  assert.equal(res.background.traits?.[0]?.name, 'شناخت گذرگاه‌های مخفی دژ');
  assert.equal(res.background.traits?.[1]?.name, 'زخم‌بندی در میدان نبرد');
  // Second trait has wound/healing keywords so should infer a roll modifier
  assert.ok(res.background.traits?.[1]?.rollModifiers);
});

test('backfillRpgSystem updates full system and returns summary', () => {
  const sys = {
    abilities: [
      {
        id: 'ab_1',
        name: 'Healer',
        description: 'Heals wounds',
        type: 'passive_skill' as const,
        effectSummary: '+2 on healing actions.',
      },
    ],
    backgrounds: [
      {
        id: 'bg_1',
        name: 'Scholar',
        description: 'Read many books',
        trait: 'شناخت خطوط کهن',
      },
    ],
  };

  const { rpgSystem, summary } = backfillRpgSystem(sys);
  assert.equal(summary.abilitiesChecked, 1);
  assert.equal(summary.abilitiesModified, 1);
  assert.equal(summary.backgroundsChecked, 1);
  assert.equal(summary.backgroundsModified, 1);
  assert.equal(rpgSystem.abilities?.[0]?.rollModifiers?.length, 1);
  assert.equal(rpgSystem.backgrounds?.[0]?.traits?.length, 1);
});
