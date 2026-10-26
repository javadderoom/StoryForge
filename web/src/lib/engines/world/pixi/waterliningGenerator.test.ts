import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCoastlineWaterlines,
  generateLakeWaterlines,
  offsetPolygonContour,
  createStippledDashSegments,
} from './waterliningGenerator';
import { calculatePolygonArea } from '../landSculpt/geometry';
import type { MapPoint } from '@/lib/types';

describe('waterliningGenerator — Concentric Shoreline Wave Echo Contours', () => {
  // Rectangular landmass polygon 200 x 140
  const landBoundary: MapPoint[] = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 240 },
    { x: 100, y: 240 },
  ];

  // Lake polygon 120 x 80
  const lakeBoundary: MapPoint[] = [
    { x: 120, y: 120 },
    { x: 240, y: 120 },
    { x: 240, y: 200 },
    { x: 120, y: 200 },
  ];

  it('returns null for empty or tiny boundary polygons', () => {
    assert.equal(generateCoastlineWaterlines([]), null);
    assert.equal(
      generateCoastlineWaterlines([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
      null
    );
    assert.equal(generateLakeWaterlines([]), null);
  });

  it('generates outward wave echo rings with expanding area for coastlines', () => {
    const coastWater = generateCoastlineWaterlines(landBoundary, {
      seed: 42,
      ringCount: 4,
      baseDistance: 4,
      distanceStep: 5,
    });

    assert.ok(coastWater !== null);
    assert.equal(coastWater.sourceType, 'land');
    assert.equal(coastWater.rings.length, 4);

    const baseArea = calculatePolygonArea(landBoundary);
    let prevArea = baseArea;

    for (const ring of coastWater.rings) {
      assert.ok(ring.polygon.length >= 4);
      const ringArea = calculatePolygonArea(ring.polygon);
      assert.ok(
        ringArea > prevArea,
        `Outward ring area (${ringArea}) must be larger than previous (${prevArea})`
      );
      prevArea = ringArea;
    }
  });

  it('generates inward wave echo rings with contracting area for lakes', () => {
    const lakeWater = generateLakeWaterlines(lakeBoundary, {
      seed: 99,
      ringCount: 3,
      baseDistance: 3,
      distanceStep: 4,
    });

    assert.ok(lakeWater !== null);
    assert.equal(lakeWater.sourceType, 'lake');
    assert.ok(lakeWater.rings.length >= 2);

    const baseArea = calculatePolygonArea(lakeBoundary);
    let prevArea = baseArea;

    for (const ring of lakeWater.rings) {
      assert.ok(ring.polygon.length >= 4);
      const ringArea = calculatePolygonArea(ring.polygon);
      assert.ok(
        ringArea < prevArea,
        `Inward ring area (${ringArea}) must be smaller than previous (${prevArea})`
      );
      prevArea = ringArea;
    }
  });

  it('enforces atmospheric stroke width and alpha falloff across successive rings', () => {
    const coastWater = generateCoastlineWaterlines(landBoundary, {
      seed: 123,
      ringCount: 4,
    });

    assert.ok(coastWater !== null);
    const rings = coastWater.rings;
    assert.equal(rings.length, 4);

    // Stroke width and alpha must decrease monotonically away from shore
    for (let i = 1; i < rings.length; i++) {
      assert.ok(
        rings[i].strokeWidth <= rings[i - 1].strokeWidth,
        `Ring ${i} strokeWidth (${rings[i].strokeWidth}) must be <= Ring ${i - 1} (${rings[i - 1].strokeWidth})`
      );
      assert.ok(
        rings[i].alpha < rings[i - 1].alpha,
        `Ring ${i} alpha (${rings[i].alpha}) must be < Ring ${i - 1} (${rings[i - 1].alpha})`
      );
    }
  });

  it('generates broken wave crest dash segments for outermost stippled ring', () => {
    const coastWater = generateCoastlineWaterlines(landBoundary, {
      seed: 777,
      ringCount: 4,
      stippledOuter: true,
    });

    assert.ok(coastWater !== null);
    const outerRing = coastWater.rings[3];
    assert.ok(outerRing.isStippled);
    assert.ok(outerRing.dashSegments !== undefined);
    assert.ok(outerRing.dashSegments.length > 5);

    // Each segment must have start and end points
    for (const [start, end] of outerRing.dashSegments) {
      assert.ok(start.x !== undefined && start.y !== undefined);
      assert.ok(end.x !== undefined && end.y !== undefined);
    }
  });

  it('produces 100% deterministic results with identical seeds', () => {
    const run1 = generateCoastlineWaterlines(landBoundary, { seed: 5555 });
    const run2 = generateCoastlineWaterlines(landBoundary, { seed: 5555 });
    assert.deepEqual(run1, run2);
  });
});
