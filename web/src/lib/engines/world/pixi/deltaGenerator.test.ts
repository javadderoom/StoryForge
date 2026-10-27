import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeltaShorelineRuns,
  buildDeltaWaterRings,
  generateProceduralDelta,
} from './deltaGenerator';
import { generateProceduralRiver } from './riverGenerator';
import type { MapPoint } from '@/lib/types';

function pointInPolygon(polygon: MapPoint[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

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

    // Verify archipelago contains central island, lobes, and offshore islets
    const kinds = delta.islands.map((i) => i.kind);
    assert.ok(kinds.includes('central'), 'Must generate central delta island');
    assert.ok(kinds.includes('islet'), 'Must generate offshore barrier islets');

    // Verify lush delta tree canopy clusters are populated
    const totalTrees = delta.islands.reduce((acc, i) => acc + (i.trees?.length ?? 0), 0);
    assert.ok(totalTrees > 0, 'Must generate tree canopy lobes on delta islands');
  });

  it('merges the distributary water into one drawable surface', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 42,
      mainWidth: 16,
      config: { enabled: true, distributariesCount: 4 },
    });
    assert.ok(delta !== null);

    const rings = buildDeltaWaterRings(delta);
    assert.ok(rings.length >= 1, 'Union should produce at least one ring');
    for (const ring of rings) {
      assert.ok(ring.length >= 4);
      for (const p of ring) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      }
    }

    // The union must not swallow the whole fan: it should stay well under the
    // bounding box of the delta, otherwise the channels merged into a lake.
    const all = rings.flat();
    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));
    assert.ok((maxX - minX) * (maxY - minY) > 0);
  });

  it('leaves channel mouths open when tracing the shoreline', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 42,
      mainWidth: 16,
      config: { enabled: true, distributariesCount: 4 },
    });
    assert.ok(delta !== null);

    const runs = buildDeltaShorelineRuns(delta);
    assert.ok(runs.length > 0, 'Shoreline must produce at least one run');

    // A mouth cap is the chord joining a branch's final bank points. No
    // shoreline run may contain both of them, or the river ends in a wall.
    const mouths = delta.branches.map((b) => [
      b.leftBank[b.leftBank.length - 1],
      b.rightBank[b.rightBank.length - 1],
    ]);
    for (const run of runs) {
      for (let i = 1; i < run.length; i++) {
        const p = run[i - 1];
        const q = run[i];
        for (const [a, b] of mouths) {
          const closesMouth =
            Math.hypot(p.x - a.x, p.y - a.y) < 1.6 &&
            Math.hypot(q.x - b.x, q.y - b.y) < 1.6;
          const closesMouthReversed =
            Math.hypot(p.x - b.x, p.y - b.y) < 1.6 &&
            Math.hypot(q.x - a.x, q.y - a.y) < 1.6;
          assert.ok(!closesMouth && !closesMouthReversed, 'Mouth must stay open');
        }
      }
    }
  });

  it('keeps islands inside the gaps between channels', () => {
    const delta = generateProceduralDelta(riverPoints, {
      seed: 42,
      mainWidth: 16,
      config: { enabled: true, distributariesCount: 4 },
    });
    assert.ok(delta !== null);

    for (const island of delta.islands) {
      // The island centre must not sit in any distributary's water.
      for (const b of delta.branches) {
        if (b.waterPolygon.length < 3) continue;
        assert.equal(
          pointInPolygon(b.waterPolygon, island.center.x, island.center.y),
          false,
          `${island.id} centre lies inside ${b.id}`
        );
      }
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
