import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEO_SYMBOL_FAMILIES,
  getAllSymbolFamilies,
  getFamiliesByCategory,
  getFamilyById,
  getSymbolById,
  resolveDefaultFamilyForTerrain,
} from './symbolPalette';

describe('symbolPalette Registry', () => {
  it('loads all defined symbol families correctly', () => {
    const families = getAllSymbolFamilies();
    assert.ok(families.length >= 7, 'Expected at least 7 families');
    for (const fam of families) {
      assert.ok(fam.id.length > 0);
      assert.ok(fam.variants.length > 0, `Family ${fam.id} has no variants`);
      assert.ok(fam.thumbnail.length > 0);
      assert.ok(fam.defaultSpacing > 0);
      assert.ok(fam.defaultScale > 0);
    }
  });

  it('filters symbol families by category correctly', () => {
    const trees = getFamiliesByCategory('tree');
    assert.ok(trees.some((f) => f.id === 'oak'));
    assert.ok(trees.some((f) => f.id === 'conifer'));
    assert.ok(trees.some((f) => f.id === 'palm'));

    const mountains = getFamiliesByCategory('mountain');
    assert.ok(mountains.some((f) => f.id === 'alpine_massif'));
    assert.ok(mountains.some((f) => f.id === 'snow_massif'));

    const landmarks = getFamiliesByCategory('landmark');
    assert.ok(landmarks.some((f) => f.id === 'landmarks'));

    const stones = getFamiliesByCategory('stone_rock');
    assert.ok(stones.some((f) => f.id === 'stones'));
  });

  it('finds symbols by ID across families', () => {
    const deciduous1 = getSymbolById('deciduous_1');
    assert.ok(deciduous1);
    assert.equal(deciduous1.family, 'oak');
    assert.equal(deciduous1.category, 'tree');

    const mount1 = getSymbolById('mount_1');
    assert.ok(mount1);
    assert.equal(mount1.family, 'alpine_massif');

    const castle = getSymbolById('castle');
    assert.ok(castle);
    assert.equal(castle.family, 'landmarks');
  });

  it('resolves default families for biomes and terrains', () => {
    assert.equal(resolveDefaultFamilyForTerrain('forest'), 'oak');
    assert.equal(resolveDefaultFamilyForTerrain('jungle'), 'palm');
    assert.equal(resolveDefaultFamilyForTerrain('tundra'), 'snow_pine');
    assert.equal(resolveDefaultFamilyForTerrain('swamp'), 'dead_wood');
    assert.equal(resolveDefaultFamilyForTerrain('desert'), 'sand_dunes');
    assert.equal(resolveDefaultFamilyForTerrain('mountain_range', true), 'snow_massif');
    assert.equal(resolveDefaultFamilyForTerrain('mountain_range', false), 'alpine_massif');
    assert.equal(resolveDefaultFamilyForTerrain('plateau'), 'rolling_hills');
  });
});
