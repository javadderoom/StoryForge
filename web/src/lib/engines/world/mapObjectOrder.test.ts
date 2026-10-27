import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_OBJECT_BAND_BASE,
  MAP_OBJECT_GROUP_ORDER,
  effectivePlacementZIndex,
  effectiveTerrainZIndex,
  isObjectLocked,
  isObjectVisible,
  isPlacementVisibleInLayers,
  orderPlacementsForRender,
  orderTerrainForRender,
  reorderPlacementByZ,
  reorderTerrainByZ,
  sortTerrainForList,
  terrainBand,
  terrainBandBase,
  terrainGroup,
} from './mapObjectOrder';
import type { MapTerrainFeature, MapTerrainType, WorldMapSettings } from '@/lib/types/world';

function feature(type: MapTerrainType, over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return { id: `f_${type}`, name: type, type, ...over } as MapTerrainFeature;
}

describe('mapObjectOrder — draw bands', () => {
  it('bands every terrain type', () => {
    assert.equal(terrainBand('continent'), 'land');
    assert.equal(terrainBand('island'), 'land');
    assert.equal(terrainBand('lake'), 'water');
    assert.equal(terrainBand('ocean'), 'ocean');
    assert.equal(terrainBand('river'), 'line');
    assert.equal(terrainBand('valley'), 'line');
    assert.equal(terrainBand('canyon'), 'line');
    assert.equal(terrainBand('mountain_range'), 'range');
    assert.equal(terrainBand('peak'), 'range');
    assert.equal(terrainBand('forest'), 'biome');
  });

  it('orders the bands the way a hand-drawn map stacks', () => {
    assert.ok(MAP_OBJECT_BAND_BASE.ocean < MAP_OBJECT_BAND_BASE.land);
    assert.ok(MAP_OBJECT_BAND_BASE.land < MAP_OBJECT_BAND_BASE.biome);
    assert.ok(MAP_OBJECT_BAND_BASE.biome < MAP_OBJECT_BAND_BASE.water);
    assert.ok(MAP_OBJECT_BAND_BASE.water < MAP_OBJECT_BAND_BASE.line);
    assert.ok(MAP_OBJECT_BAND_BASE.line < MAP_OBJECT_BAND_BASE.range);
  });
});

describe('mapObjectOrder — effective z', () => {
  it('uses the band base plus the array index by default', () => {
    assert.equal(effectiveTerrainZIndex({ type: 'continent' }, 3), MAP_OBJECT_BAND_BASE.land + 3);
    assert.equal(effectiveTerrainZIndex({ type: 'river' }, 2), MAP_OBJECT_BAND_BASE.line + 2);
  });

  it('lets an explicit zIndex win', () => {
    assert.equal(effectiveTerrainZIndex({ type: 'continent', zIndex: 9999 }, 3), 9999);
  });

  it('ignores a non-finite zIndex', () => {
    assert.equal(
      effectiveTerrainZIndex({ type: 'continent', zIndex: Number.NaN }, 1),
      MAP_OBJECT_BAND_BASE.land + 1
    );
  });
});

describe('mapObjectOrder — render order', () => {
  it('keeps the historical stacking when no zIndex is set', () => {
    const features = [
      feature('river'),
      feature('forest'),
      feature('continent'),
      feature('lake'),
      feature('mountain_range'),
    ];
    const ordered = orderTerrainForRender(features).map((f) => f.type);
    assert.deepEqual(ordered, ['continent', 'forest', 'lake', 'river', 'mountain_range']);
  });

  it('honours an explicit zIndex across bands', () => {
    const features = [
      feature('continent', { zIndex: 5000 }),
      feature('forest'),
    ];
    const ordered = orderTerrainForRender(features).map((f) => f.type);
    assert.deepEqual(ordered, ['forest', 'continent']);
  });

  it('is stable for objects that share a z', () => {
    const a = feature('continent', { id: 'a' });
    const b = feature('continent', { id: 'b' });
    const ordered = orderTerrainForRender([a, b]).map((f) => f.id);
    assert.deepEqual(ordered, ['a', 'b']);
  });
});

describe('mapObjectOrder — object groups', () => {
  it('groups by what a thing is, not by how it is drawn', () => {
    assert.equal(terrainGroup('continent'), 'landmass');
    assert.equal(terrainGroup('island'), 'landmass');
    assert.equal(terrainGroup('river'), 'water');
    assert.equal(terrainGroup('lake'), 'water');
    assert.equal(terrainGroup('peak'), 'range');
    assert.equal(terrainGroup('valley'), 'valley');
    assert.equal(terrainGroup('canyon'), 'valley');
    assert.equal(terrainGroup('forest'), 'biome');
  });

  it('lists groups in a fixed order', () => {
    assert.deepEqual(MAP_OBJECT_GROUP_ORDER, ['landmass', 'water', 'range', 'valley', 'biome']);
  });

  it('sorts the object list by group, then draw order', () => {
    const features = [
      feature('forest'),
      feature('river'),
      feature('continent'),
      feature('peak'),
      feature('lake'),
    ];
    const sorted = sortTerrainForList(features).map((f) => f.type);
    assert.deepEqual(sorted, ['continent', 'lake', 'river', 'peak', 'forest']);
  });
});

describe('mapObjectOrder — per-object state', () => {
  it('treats an undefined visible flag as visible', () => {
    assert.equal(isObjectVisible({}), true);
    assert.equal(isObjectVisible({ visible: true }), true);
    assert.equal(isObjectVisible({ visible: false }), false);
  });

  it('gates every lore pin kind on its own layer switch', () => {
    const all: WorldMapSettings['visibleLayers'] = {
      terrain: true,
      water: true,
      mountains: true,
      valleys: true,
      biomes: true,
      settlements: true,
      routes: true,
      caravanRoutes: true,
      npcs: true,
      bestiary: true,
      relics: true,
      deities: true,
      timeline: true,
      factionBorders: true,
      labels: true,
      grid: true,
    };

    // Every kind answers to the switch the layer panel shows for it.
    const cases: Array<[Parameters<typeof isPlacementVisibleInLayers>[0], keyof typeof all]> = [
      ['npc', 'npcs'],
      ['bestiary', 'bestiary'],
      ['artifact', 'relics'],
      ['deity', 'deities'],
      ['timeline', 'timeline'],
    ];

    for (const [kind, layer] of cases) {
      assert.equal(isPlacementVisibleInLayers(kind, all), true, `${kind} visible`);
      assert.equal(
        isPlacementVisibleInLayers(kind, { ...all, [layer]: false }),
        false,
        `${kind} hidden by ${layer}`
      );
    }
  });

  it('treats an undefined locked flag as unlocked', () => {
    assert.equal(isObjectLocked({}), false);
    assert.equal(isObjectLocked({ locked: true }), true);
  });
});

describe('mapObjectOrder — reordering', () => {
  it('swaps a feature with the one above it', () => {
    const features = [
      feature('continent', { id: 'a' }),
      feature('continent', { id: 'b' }),
      feature('continent', { id: 'c' }),
    ];
    const reordered = reorderTerrainByZ(features, 'a', 'forward');
    const order = orderTerrainForRender(reordered).map((f) => f.id);
    assert.deepEqual(order, ['b', 'a', 'c']);
  });

  it('swaps a feature with the one below it', () => {
    const features = [
      feature('continent', { id: 'a' }),
      feature('continent', { id: 'b' }),
      feature('continent', { id: 'c' }),
    ];
    const reordered = reorderTerrainByZ(features, 'c', 'backward');
    const order = orderTerrainForRender(reordered).map((f) => f.id);
    assert.deepEqual(order, ['a', 'c', 'b']);
  });

  it('gives the two swapped features an explicit z', () => {
    const features = [feature('continent', { id: 'a' }), feature('continent', { id: 'b' })];
    const reordered = reorderTerrainByZ(features, 'a', 'forward');
    assert.equal(typeof reordered[0].zIndex, 'number');
    assert.equal(typeof reordered[1].zIndex, 'number');
  });

  it('leaves the list alone when there is nothing in that direction', () => {
    const features = [feature('continent', { id: 'a' }), feature('continent', { id: 'b' })];
    assert.deepEqual(reorderTerrainByZ(features, 'a', 'backward'), features);
    assert.deepEqual(reorderTerrainByZ(features, 'b', 'forward'), features);
  });

  it('ignores an unknown id', () => {
    const features = [feature('continent', { id: 'a' })];
    assert.deepEqual(reorderTerrainByZ(features, 'nope', 'forward'), features);
  });

  it('reorders lore pins', () => {
    const pins = [
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
    ];
    const reordered = reorderPlacementByZ(pins, 'p1', 'forward');
    assert.deepEqual(orderPlacementsForRender(reordered).map((p) => p.id), ['p2', 'p1', 'p3']);
  });
});
