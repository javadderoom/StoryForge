import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatStatName } from './rpgEngine';

describe('formatStatName', () => {
  it('uses custom authored stat name when provided, prioritizing Studio term over legacy nameFa', () => {
    const customStats = [
      { id: 'custom_stat_1', name: 'اراده پولادین', baseValue: 3 },
      { id: 'might', name: 'زور بازو', nameFa: 'قدرت بدنی', baseValue: 4 },
    ];

    assert.equal(formatStatName('custom_stat_1', true, customStats), 'اراده پولادین');
    assert.equal(formatStatName('might', true, customStats), 'زور بازو');
  });

  it('falls back to nameFa / nameEn when primary authored name is empty or not provided', () => {
    const customStats = [
      { id: 'stat_magic', nameFa: 'قدرت جادویی', nameEn: 'Magic' },
    ];

    assert.equal(formatStatName('stat_magic', true, customStats), 'قدرت جادویی');
    assert.equal(formatStatName('stat_magic', false, customStats), 'Magic');
  });

  it('falls back to default Persian translations when no config is passed', () => {
    assert.equal(formatStatName('might', true), 'قدرت');
    assert.equal(formatStatName('agility', true), 'چابکی');
  });

  it('formats unknown English stat ids cleanly', () => {
    assert.equal(formatStatName('dark_vision', false), 'Dark Vision');
  });
});

describe('getEffectiveStatValue and calculateEquipmentModifier', () => {
  it('calculates effective stat with equipment bonuses and respects fallback', async () => {
    const { getEffectiveStatValue } = await import('./rpgEngine');
    const playerState: any = {
      stats: { might: 12 },
      equipment: { mainHand: 'blade_1', armor: null, offHand: null, relic: null },
      inventory: [
        { id: 'blade_1', name: 'Steel Blade', type: 'weapon', quantity: 1, statModifiers: { might: 3 } },
      ],
    };

    assert.equal(getEffectiveStatValue(playerState, 'might', 10), 15);
    // Missing from stats, falls back to custom base
    assert.equal(getEffectiveStatValue(playerState, 'agility', 5), 5);
  });
});

describe('serverToCheckResolution', () => {
  it('maps server CheckResolution fields to client DiceResolution', async () => {
    const { serverToCheckResolution } = await import('./rpgEngine');
    const serverRes = {
      diceRoll: 14,
      statModifier: 2,
      totalScore: 16,
      difficultyClass: 12,
      outcome: 'success',
      consequenceSummary: 'Objective achieved.',
      statId: 'agility',
    };

    const clientRes = serverToCheckResolution(serverRes);
    assert.equal(clientRes.d20, 14);
    assert.equal(clientRes.total, 16);
    assert.equal(clientRes.difficultyClass, 12);
    assert.equal(clientRes.outcome, 'success');
    assert.equal(clientRes.requiredStat, 'agility');
    assert.equal(clientRes.success, true);
  });
});
