import test from 'node:test';
import assert from 'node:assert/strict';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import {
  findBestLakeMatch,
  normalizeLandWaterFeatures,
} from './waterFeatures';

function square(x: number, y: number, size: number): MapPoint[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

function land(over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return {
    id: 'cont_1',
    name: 'Mainland',
    type: 'continent',
    polygon: square(0, 0, 500),
    ...over,
  } as MapTerrainFeature;
}

function lake(over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return {
    id: 'lake_1',
    name: 'Sacred Lake',
    type: 'lake',
    polygon: square(100, 100, 100),
    ...over,
  } as MapTerrainFeature;
}

test('normalizeLandWaterFeatures — legacy land-hole migration', async (t) => {
  await t.test('collapses a duplicate land hole and companion lake into one lake', () => {
    const customLake = lake({
      name: 'Ancient Sacred Lake',
      color: '#0055aa',
      description: 'A holy lake created by the gods',
    });
    const features = [land({ holes: [customLake.polygon!] }), customLake];

    const normalized = normalizeLandWaterFeatures(features);
    const normalizedLand = normalized.find((f) => f.id === 'cont_1');
    const normalizedLakes = normalized.filter((f) => f.type === 'lake');

    assert.ok(normalizedLand);
    assert.ok(!normalizedLand.holes || normalizedLand.holes.length === 0);
    assert.equal(normalizedLakes.length, 1, 'Water must be owned by exactly one lake');
    assert.equal(normalizedLakes[0].id, customLake.id, 'Lake identity must survive');
    assert.equal(normalizedLakes[0].name, customLake.name, 'Lake name must survive');
    assert.equal(normalizedLakes[0].color, customLake.color, 'Lake styling must survive');
    assert.equal(
      normalizedLakes[0].description,
      customLake.description,
      'Lake description must survive'
    );
  });

  await t.test('creates a lake when a legacy land hole has no companion feature', () => {
    const hole = square(100, 100, 100);
    const normalized = normalizeLandWaterFeatures([land({ holes: [hole] })]);

    const normalizedLand = normalized.find((f) => f.id === 'cont_1');
    const normalizedLakes = normalized.filter((f) => f.type === 'lake');

    assert.ok(normalizedLand);
    assert.ok(!normalizedLand.holes || normalizedLand.holes.length === 0);
    assert.equal(normalizedLakes.length, 1);
    assert.deepEqual(normalizedLakes[0].polygon, hole);
    assert.equal(normalizedLakes[0].type, 'lake');
  });

  await t.test('turns an island inside a migrated lake into a lake hole', () => {
    const hole = square(100, 100, 200);
    const island = land({
      id: 'isle_1',
      name: 'Lake Isle',
      type: 'island',
      polygon: square(160, 160, 60),
    });

    const normalized = normalizeLandWaterFeatures([
      land({ holes: [hole] }),
      lake({ polygon: hole }),
      island,
    ]);

    const normalizedLake = normalized.find((f) => f.id === 'lake_1');
    assert.ok(normalizedLake?.holes);
    assert.equal(normalizedLake.holes.length, 1);
    assert.deepEqual(normalizedLake.holes[0], island.polygon);
  });

  await t.test('is idempotent after the first migration', () => {
    const first = normalizeLandWaterFeatures([land({ holes: [square(100, 100, 100)] })]);
    const second = normalizeLandWaterFeatures(first);

    assert.strictEqual(second, first, 'A normalized map must be returned unchanged');
  });

  await t.test('matches the lake with the greatest hole overlap', () => {
    const hole = square(100, 100, 100);
    const far = lake({ id: 'lake_far', polygon: square(400, 400, 80) });
    const near = lake({ id: 'lake_near', polygon: square(105, 105, 95) });

    const match = findBestLakeMatch(hole, [far, near]);
    assert.equal(match?.id, 'lake_near');
  });
});
