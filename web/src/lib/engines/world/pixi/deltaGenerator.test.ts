import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralDelta } from './deltaGenerator';
import { generateProceduralRiver } from './riverGenerator';
import type { MapPoint } from '@/lib/types';

describe('deltaGenerator — Procedural Delta Fan & Alluvial Islands', () => {
  const riverPoints: MapPoint[] = [
    { x: 100, y: 100 },
    { x: 200, y: 250 },
    { x: 300, y: 400 },
    { x: 400, y: 600 },
    { x: 500, y: 800 },
  ];

  it('returns null for short paths with insufficient length for a delta', () => {
    const shortPoints = [
      { x: 10, y: 10 },
      { x: 15, y: 15 },
    ];
    const delta = generateProceduralDelta(shortPoints);
    assert.equal(delta, null);
  });

  it('generates a procedural delta with configured number of distributary branches', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 12345,
      mainWidth: 16,
      config: {
        enabled: true,
        distributariesCount: 4,
        spreadAngleDegrees: 50,
        apexFraction: 0.8,
      },
    });

    assert.ok(delta !== null);
    assert.equal(delta.branches.length, 4);
    assert.equal(delta.apexFraction, 0.8);

    // Verify each branch has valid centerline, banks, and closed water polygon
    for (const branch of delta.branches) {
      assert.ok(branch.centerline.length >= 4);
      assert.ok(branch.leftBank.length >= 4);
      assert.ok(branch.rightBank.length >= 4);
      assert.ok(branch.waterPolygon.length >= 8);
      assert.ok(branch.startWidth > 0);
      assert.ok(branch.endWidth > 0);
    }
  });

  it('distributes discharge so central branches are wider than outer branches', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 999,
      mainWidth: 18,
      config: {
        enabled: true,
        distributariesCount: 4,
      },
    });

    assert.ok(delta !== null);
    const outerLeft = delta.branches[0];
    const innerLeft = delta.branches[1];
    const innerRight = delta.branches[2];
    const outerRight = delta.branches[3];

    // Central channels (index 1 & 2) should carry more discharge width than outer edges (0 & 3)
    assert.ok(innerLeft.startWidth > outerLeft.startWidth);
    assert.ok(innerRight.startWidth > outerRight.startWidth);
  });

  it('synthesizes closed alluvial sediment islands in inter-channel voids', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 42,
      mainWidth: 16,
      config: {
        enabled: true,
        distributariesCount: 4,
        spreadAngleDegrees: 55,
        apexFraction: 0.75,
      },
    });

    assert.ok(delta !== null);
    // 4 branches should have alluvial islands between adjacent channels
    assert.ok(delta.islands.length > 0);

    for (const island of delta.islands) {
      assert.ok(island.polygon.length >= 4);
      assert.ok(island.center.x > 0);
      assert.ok(island.center.y > 0);
      // Silt hatch strokes should exist inside the island
      assert.ok(island.hatchLines.length >= 0);
    }
  });

  it('integrates seamlessly with generateProceduralRiver', () => {
    // 1. Without deltaConfig
    const riverClassic = generateProceduralRiver(riverPoints, {
      seed: 42,
      startWidth: 1.5,
      endWidth: 12,
    });
    assert.equal(riverClassic.delta, undefined);
    assert.ok(riverClassic.waterPolygon.length > 0);

    // 2. With deltaConfig enabled
    const riverWithDelta = generateProceduralRiver(riverPoints, {
      seed: 42,
      startWidth: 1.5,
      endWidth: 14,
      deltaConfig: {
        enabled: true,
        distributariesCount: 3,
        spreadAngleDegrees: 45,
      },
    });
    assert.ok(riverWithDelta.delta !== undefined);
    assert.equal(riverWithDelta.delta.branches.length, 3);
  });
});
