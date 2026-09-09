import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCreatureEcology } from './validateCreatureEcology';
import type { WorldCreature, EnhancedCreaturePayload } from '@/lib/types/world';

const mkCreature = (over: Partial<WorldCreature> & { name: string }): WorldCreature => ({
  id: `c_${over.name}`,
  speciesCategory: 'beast',
  dangerLevel: 3,
  habitatLocationIds: [],
  behavioralTactics: 'tactics',
  weaknesses: [],
  resistances: [],
  harvestableLoot: [],
  loreDescription: '',
  ...over,
});

const mkPayload = (over: Partial<EnhancedCreaturePayload> = {}): EnhancedCreaturePayload => ({
  name: 'Ashen Wolf',
  speciesCategory: 'beast',
  habitatLocationName: 'Highlands',
  predatorPreyNiche: 'Apex predator of the highlands.',
  nonCombatPacificationMethod: 'Offer fresh meat and avoid eye contact.',
  alchemicalYields: [{ reagentName: 'Wolf bile', rarity: 'common', craftingUse: 'Tonics' }],
  ...over,
});

describe('validateCreatureEcology — danger coherence & category bleed', () => {
  it('flags a danger-4 beast as prey of a danger-2 hunter', () => {
    const target = mkCreature({ name: 'Ashen Wolf', dangerLevel: 2 });
    const bestiary = [target, mkCreature({ name: 'Cave Bear', dangerLevel: 4 })];
    const res = validateCreatureEcology(mkPayload({ preySpecies: ['Cave Bear'] }), target, bestiary);
    assert.equal(res.hasError, true);
    assert.equal(res.errors.length, 1);
    assert.equal(res.errors[0].code, 'danger_inversion');
  });

  it('flags a danger-2 predator of a danger-4 creature', () => {
    const target = mkCreature({ name: 'Cave Bear', dangerLevel: 4 });
    const bestiary = [target, mkCreature({ name: 'Ashen Wolf', dangerLevel: 2 })];
    const res = validateCreatureEcology(
      mkPayload({ predatorSpecies: ['Ashen Wolf'] }),
      target,
      bestiary
    );
    assert.equal(res.hasError, true);
    assert.equal(res.errors[0].code, 'danger_inversion');
  });

  it('downgrades pack-justified inversions to warnings', () => {
    const target = mkCreature({ name: 'Ashen Wolf', dangerLevel: 2 });
    const bestiary = [target, mkCreature({ name: 'Cave Bear', dangerLevel: 4 })];
    const res = validateCreatureEcology(
      mkPayload({
        preySpecies: ['Cave Bear'],
        predatorPreyNiche: 'Hunts in a coordinated pack of twelve, hamstringing larger prey.',
      }),
      target,
      bestiary
    );
    assert.equal(res.hasError, false);
    assert.ok(res.warnings.some((w) => w.code === 'danger_inversion'));
  });

  it('flags mining prose on a beast as category bleed', () => {
    const target = mkCreature({ name: 'Ashen Wolf', dangerLevel: 3 });
    const res = validateCreatureEcology(
      mkPayload({
        nonCombatPacificationMethod: 'استخراج رگه‌های آرامش از معدن با کلنگ',
      }),
      target,
      [target]
    );
    assert.equal(res.hasError, true);
    assert.ok(res.errors.some((e) => e.code === 'category_bleed'));
  });

  it('collects invented names as ghosts without erroring', () => {
    const target = mkCreature({ name: 'Ashen Wolf', dangerLevel: 3 });
    const res = validateCreatureEcology(
      mkPayload({ preySpecies: ['Moon Hare'], predatorSpecies: ['Gloom Manticore'] }),
      target,
      [target]
    );
    assert.equal(res.hasError, false);
    assert.deepEqual(res.ghosts, ['Moon Hare', 'Gloom Manticore']);
  });

  it('warns on self reference and passes clean payloads', () => {
    const target = mkCreature({ name: 'Ashen Wolf', dangerLevel: 3 });
    const bestiary = [target, mkCreature({ name: 'Moon Hare', dangerLevel: 1 })];
    const selfRef = validateCreatureEcology(
      mkPayload({ preySpecies: ['Ashen Wolf'] }),
      target,
      bestiary
    );
    assert.ok(selfRef.warnings.some((w) => w.code === 'self_reference'));

    const clean = validateCreatureEcology(
      mkPayload({ preySpecies: ['Moon Hare'], predatorSpecies: undefined }),
      target,
      bestiary
    );
    assert.equal(clean.hasError, false);
    assert.equal(clean.errors.length, 0);
    assert.equal(clean.warnings.length, 0);
  });
});
