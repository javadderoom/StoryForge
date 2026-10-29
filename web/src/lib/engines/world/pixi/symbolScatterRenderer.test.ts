import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateScatterInstances,
  renderSymbolsToContainer,
  hashStringToSeed,
} from './symbolScatterRenderer';
import { pointInPolygon } from '../mapHitTest';
import { getFamilyById } from './symbolPalette';
import type { MapTerrainFeature } from '@/lib/types';
import type { Container, Sprite } from 'pixi.js';

test('symbolScatterRenderer: determinism across calls with same seed', () => {
  const feature: MapTerrainFeature = {
    id: 'forest_primeval',
    name: 'Primeval Woodland',
    type: 'forest',
    symbolFamily: 'oak',
    polygon: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 },
    ],
  };

  const run1 = generateScatterInstances(feature);
  const run2 = generateScatterInstances(feature);

  assert.ok(run1.length > 5, 'Should generate multiple tree instances');
  assert.equal(run1.length, run2.length, 'Instance counts must match identically');

  for (let i = 0; i < run1.length; i++) {
    assert.equal(run1[i].id, run2[i].id);
    assert.equal(run1[i].symbolId, run2[i].symbolId);
    assert.equal(run1[i].x, run2[i].x);
    assert.equal(run1[i].y, run2[i].y);
    assert.equal(run1[i].scale, run2[i].scale);
    assert.equal(run1[i].rotation, run2[i].rotation);
  }
});

test('symbolScatterRenderer: all polygon instances strictly inside polygon and outside holes', () => {
  const outerPoly = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
  ];
  const hole = [
    { x: 60, y: 60 },
    { x: 140, y: 60 },
    { x: 140, y: 140 },
    { x: 60, y: 140 },
  ];

  const feature: MapTerrainFeature = {
    id: 'taiga_lake',
    name: 'Taiga Ring',
    type: 'tundra',
    symbolFamily: 'snow_pine',
    polygon: outerPoly,
    holes: [hole],
  };

  const instances = generateScatterInstances(feature);
  assert.ok(instances.length > 0, 'Should generate taiga trees in valid area');

  const snowPineFamily = getFamilyById('snow_pine')!;
  const validVariantIds = new Set(snowPineFamily.variants.map((v) => v.id));

  for (const inst of instances) {
    const pt = { x: inst.x, y: inst.y };
    assert.ok(
      pointInPolygon(pt, outerPoly),
      `Point (${inst.x}, ${inst.y}) must be inside outer boundary`
    );
    assert.ok(
      !pointInPolygon(pt, hole),
      `Point (${inst.x}, ${inst.y}) must NOT be inside inland hole`
    );
    assert.ok(
      validVariantIds.has(inst.symbolId),
      `Variant "${inst.symbolId}" must belong to snow_pine family`
    );
  }
});

test('symbolScatterRenderer: polyline mountain range generation along segments', () => {
  const feature: MapTerrainFeature = {
    id: 'spine_range',
    name: 'Dragon Spine Range',
    type: 'mountain_range',
    symbolFamily: 'alpine_massif',
    points: [
      { x: 100, y: 200 },
      { x: 250, y: 220 },
      { x: 400, y: 190 },
    ],
    width: 40,
  };

  const instances = generateScatterInstances(feature);
  assert.ok(instances.length >= 4, 'Should scatter mountain massifs along range polyline');

  const massifFamily = getFamilyById('alpine_massif')!;
  const validMassifIds = new Set(massifFamily.variants.map((v) => v.id));

  for (const inst of instances) {
    assert.ok(
      validMassifIds.has(inst.symbolId),
      `Variant "${inst.symbolId}" must belong to alpine_massif`
    );
    // Should be near the path bounding box
    assert.ok(inst.x >= 70 && inst.x <= 430);
    assert.ok(inst.y >= 140 && inst.y <= 270);
  }
});

test('symbolScatterRenderer: respects exclusion zones (settlements & POIs)', () => {
  const feature: MapTerrainFeature = {
    id: 'dense_woodland',
    name: 'Dense Woodland',
    type: 'forest',
    symbolFamily: 'oak',
    polygon: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ],
  };

  const settlementExclusion = { x: 100, y: 100, radius: 50 };
  const instances = generateScatterInstances(feature, {
    exclusionZones: [settlementExclusion],
  });

  for (const inst of instances) {
    const dist = Math.hypot(inst.x - settlementExclusion.x, inst.y - settlementExclusion.y);
    assert.ok(
      dist >= settlementExclusion.radius,
      `Instance at (${inst.x}, ${inst.y}) with dist ${dist} must not be inside exclusion radius 50`
    );
  }
});

test('symbolScatterRenderer: single-point landmark generation with 0 rotation', () => {
  const feature: MapTerrainFeature = {
    id: 'citadel_fortress',
    name: 'Sun Citadel',
    type: 'plains',
    symbolFamily: 'landmarks',
    x: 350,
    y: 420,
  };

  const instances = generateScatterInstances(feature);
  assert.equal(instances.length, 1, 'Single point feature generates exactly 1 instance');
  assert.equal(instances[0].x, 350);
  assert.equal(instances[0].y, 420);
  assert.equal(instances[0].rotation, 0, 'Landmark buildings must not have random rotation');
});

test('symbolScatterRenderer: caps instances for giant polygons without runaway allocations', () => {
  const hugeFeature: MapTerrainFeature = {
    id: 'giant_continent_forest',
    name: 'Endless Taiga',
    type: 'forest',
    symbolFamily: 'oak',
    polygon: [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 5000 },
      { x: 0, y: 5000 },
    ],
  };

  const instances = generateScatterInstances(hugeFeature);
  assert.ok(
    instances.length <= 300,
    `Huge polygon instances (${instances.length}) must be safely capped at 300 max`
  );
  assert.ok(
    instances.length >= 100,
    `Huge polygon should still generate a visually representative sample (got ${instances.length})`
  );
});

test('symbolScatterRenderer: returns cached instances on repeated calls with identical geometry', () => {
  const feature: MapTerrainFeature = {
    id: 'lru_cache_test_biome',
    name: 'Cached Grove',
    type: 'forest',
    symbolFamily: 'oak',
    polygon: [
      { x: 10, y: 10 },
      { x: 80, y: 10 },
      { x: 80, y: 80 },
      { x: 10, y: 80 },
    ],
  };

  const firstCall = generateScatterInstances(feature);
  const secondCall = generateScatterInstances(feature);

  // Exact same array reference from persistent LRU cache
  assert.equal(
    firstCall,
    secondCall,
    'Repeated call must return same cached array reference without re-allocation'
  );
});
