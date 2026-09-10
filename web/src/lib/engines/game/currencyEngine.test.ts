import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toBaseValue,
  toPurseBreakdown,
  deductFromPurse,
  addToPurse,
  formatPurse,
  normalizeCurrencySystem,
} from './currencyEngine';
import { DEFAULT_CURRENCY_PRESETS } from '@/lib/types/rpg';

describe('Currency Engine — Multi-denomination Coinage & Making Change', () => {
  const fantasy = DEFAULT_CURRENCY_PRESETS.fantasy; // gold=100, silver=10, copper=1

  it('calculates total base value from purse coins', () => {
    // 2 gold (200) + 5 silver (50) + 12 copper (12) = 262
    const purse = { gold: 2, silver: 5, copper: 12 };
    assert.equal(toBaseValue(purse, fantasy), 262);
  });

  it('converts base units into optimal denomination breakdown', () => {
    // 262 -> 2 gold (200), 6 silver (60), 2 copper (2)
    const breakdown = toPurseBreakdown(262, fantasy);
    assert.deepEqual(breakdown, { gold: 2, silver: 6, copper: 2 });
  });

  it('deducts cost and makes change seamlessly by breaking larger coins', () => {
    // Player has 1 gold coin (100 base) and 0 copper/silver
    // Buys item for 15 copper (1 silver + 5 copper)
    // Should remain with 85 base: 8 silver + 5 copper!
    const purse = { gold: 1, silver: 0, copper: 0 };
    const result = deductFromPurse(purse, 15, fantasy);

    assert.equal(result.success, true);
    assert.equal(result.totalBaseRemaining, 85);
    assert.deepEqual(result.newPurse, { gold: 0, silver: 8, copper: 5 });
  });

  it('rejects transaction when funds are insufficient', () => {
    const purse = { gold: 0, silver: 2, copper: 5 }; // 25 base
    const result = deductFromPurse(purse, 50, fantasy);

    assert.equal(result.success, false);
    assert.match(result.error || '', /Insufficient funds/);
    assert.deepEqual(result.newPurse, purse); // unchanged
  });

  it('adds coins directly into the purse', () => {
    const purse = { gold: 1, silver: 2, copper: 5 };
    const updated = addToPurse(purse, { silver: 3, copper: 10 });
    assert.deepEqual(updated, { gold: 1, silver: 5, copper: 15 });
  });

  it('formats purse nicely into Persian and English labels', () => {
    const purse = { gold: 2, silver: 4, copper: 0 };
    const fa = formatPurse(purse, fantasy, true);
    assert.ok(fa.includes('۲') || fa.includes('2'));
    assert.ok(fa.includes('دینار'));
    assert.ok(fa.includes('درهم'));

    const en = formatPurse(purse, fantasy, false);
    assert.ok(en.includes('Gold Dinar'));
  });
});
