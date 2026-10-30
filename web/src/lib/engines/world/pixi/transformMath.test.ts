import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTerrainBounds,
  getTransformHandles,
  applyTransform,
  type BoundingBox2D,
} from './transformMath';
import type { MapTerrainFeature } from '@/lib/types';

describe('transformMath', () => {
  const lake: MapTerrainFeature = {
    id: 'lake_1',
    name: 'Lake 1',
    type: 'lake',
    polygon: [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ],
  };

  it('computes correct 2D bounding box and center', () => {
    const box = computeTerrainBounds(lake);
    assert.ok(box);
    assert.equal(box.minX, 100);
    assert.equal(box.minY, 100);
    assert.equal(box.maxX, 200);
    assert.equal(box.maxY, 200);
    assert.equal(box.width, 100);
    assert.equal(box.height, 100);
    assert.equal(box.cx, 150);
    assert.equal(box.cy, 150);
  });

  it('generates 8 scale handles plus 1 rotation handle', () => {
    const box = computeTerrainBounds(lake)!;
    const handles = getTransformHandles(box);
    assert.equal(handles.length, 9);

    const nw = handles.find((h) => h.type === 'nw');
    assert.deepEqual(nw, { type: 'nw', x: 100, y: 100 });

    const se = handles.find((h) => h.type === 'se');
    assert.deepEqual(se, { type: 'se', x: 200, y: 200 });

    const rot = handles.find((h) => h.type === 'rotate');
    assert.ok(rot);
    assert.equal(rot.x, 150);
    assert.equal(rot.y, 100 - 24); // 76
  });

  it('scales from southeast corner with fixed northwest anchor', () => {
    const box = computeTerrainBounds(lake)!;
    // Drag 'se' from (200, 200) to (300, 200) -> double width
    const transformed = applyTransform(
      lake.polygon!,
      'se',
      box,
      { x: 200, y: 200 },
      { x: 300, y: 200 }
    );
    // Northwest corner stays (100, 100)
    assert.equal(transformed[0].x, 100);
    assert.equal(transformed[0].y, 100);
    // Northeast corner moves to (300, 100)
    assert.equal(transformed[1].x, 300);
    assert.equal(transformed[1].y, 100);
  });

  it('rotates points 90 degrees around centroid', () => {
    const box = computeTerrainBounds(lake)!;
    // Centroid is (150, 150)
    // Start at (150, 50) [due North], drag to (250, 150) [due East] -> +90 deg
    const transformed = applyTransform(
      lake.polygon!,
      'rotate',
      box,
      { x: 150, y: 50 },
      { x: 250, y: 150 }
    );
    // Original (100, 100): dx = -50, dy = -50.
    // +90 deg rotation: x' = cx - dy = 150 - (-50) = 200, y' = cy + dx = 150 + (-50) = 100
    assert.ok(Math.abs(transformed[0].x - 200) < 0.001);
    assert.ok(Math.abs(transformed[0].y - 100) < 0.001);
  });

  it('computes 2D bounding box and handles for single-point stamps', () => {
    const singleStamp: MapTerrainFeature = {
      id: 'stamp_1',
      name: 'Single Mountain Peak',
      type: 'peak',
      points: [{ x: 300, y: 400 }],
      scale: 60,
    };

    const box = computeTerrainBounds(singleStamp);
    assert.ok(box);
    assert.equal(box.cx, 300);
    // Y spans upward from anchor (400 - 60 * 0.95 = 343 to 400 + 60 * 0.15 = 409)
    assert.equal(box.minY, 343);
    assert.equal(box.maxY, 409);
    assert.equal(box.width, 60 * 1.3);
    const handles = getTransformHandles(box);
    assert.equal(handles.length, 9);
  });
});
