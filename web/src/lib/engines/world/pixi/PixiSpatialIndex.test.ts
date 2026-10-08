import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PixiSpatialIndex, SpatialItem } from './PixiSpatialIndex';

test('PixiSpatialIndex - Spatial Queries & Hit Testing', async (t) => {
  const index = new PixiSpatialIndex();

  const sampleItems: SpatialItem[] = [
    {
      id: 'loc_capital',
      type: 'location',
      minX: 90,
      minY: 90,
      maxX: 110,
      maxY: 110,
      data: { name: 'Eldoria Capital' },
    },
    {
      id: 'loc_port',
      type: 'location',
      minX: 490,
      minY: 490,
      maxX: 510,
      maxY: 510,
      data: { name: 'Sunken Port' },
    },
    {
      id: 'terr_mountain',
      type: 'terrain',
      minX: 180,
      minY: 180,
      maxX: 220,
      maxY: 220,
      data: { name: 'Iron Ridge' },
    },
  ];

  await t.test('bulk loads and searches items by bounding box', () => {
    index.load(sampleItems);
    const results = index.searchBBox(80, 80, 120, 120);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'loc_capital');
  });

  await t.test('searchRadius finds items within range', () => {
    const results = index.searchRadius(102, 102, 25);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'loc_capital');

    const empty = index.searchRadius(300, 300, 20);
    assert.equal(empty.length, 0);
  });

  await t.test('findNearest returns closest item within max radius', () => {
    const nearest = index.findNearest(105, 105, 30);
    assert.ok(nearest);
    assert.equal(nearest.id, 'loc_capital');

    const none = index.findNearest(300, 300, 20);
    assert.equal(none, null);
  });

  await t.test('clear removes all indexed items', () => {
    index.clear();
    const results = index.searchBBox(0, 0, 1000, 1000);
    assert.equal(results.length, 0);
  });
});
