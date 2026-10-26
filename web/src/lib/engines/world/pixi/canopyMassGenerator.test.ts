import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralCanopyMass } from './canopyMassGenerator';
import { isPointInPolygon } from '../landSculpt/geometry';
import type { MapPoint } from '@/lib/types';

describe('canopyMassGenerator — Continuous Forest Canopy Massing', () => {
  // Rectangular woodland polygon 240 x 180
  const forestBoundary: MapPoint[] = [
    { x: 100, y: 100 },
    { x: 340, y: 100 },
    { x: 340, y: 280 },
    { x: 100, y: 280 },
  ];

  it('returns null for empty or tiny boundary polygons', () => {
    assert.equal(generateProceduralCanopyMass([]), null);
    assert.equal(
      generateProceduralCanopyMass([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
      null
    );
  });

  it('generates a procedural canopy mass with scalloped boundary, groves, and sentinel trees', () => {
    const canopy = generateProceduralCanopyMass(forestBoundary, {
      seed: 42,
      density: 'medium',
      treeKind: 'deciduous',
    });

    assert.ok(canopy !== null);
    assert.ok(canopy.scallopedBoundary.length > forestBoundary.length);
    assert.ok(canopy.groves.length >= 4);
    assert.ok(canopy.sentinelTrees.length >= 3);
    assert.equal(canopy.totalArea, 240 * 180);

    for (const grove of canopy.groves) {
      assert.ok(grove.perimeterPoly.length >= 8);
      assert.ok(grove.sunlitPoly.length >= 4);
      assert.ok(grove.shadowPoly.length >= 4);
      assert.ok(grove.shadowHatches.length >= 2);
      assert.ok(grove.interiorScallops.length >= 1);
      assert.ok(grove.area > 50);

      // Grove center must be inside the forest boundary
      assert.ok(
        isPointInPolygon(grove.center, forestBoundary),
        `Grove center (${grove.center.x}, ${grove.center.y}) must be in boundary`
      );
    }
  });

  it('enforces back-to-front Y-depth sorting for proper painter algorithm rendering', () => {
    const canopy = generateProceduralCanopyMass(forestBoundary, {
      seed: 1234,
      density: 'dense',
    });

    assert.ok(canopy !== null);

    // Groves must be strictly ascending by Y
    for (let i = 1; i < canopy.groves.length; i++) {
      assert.ok(
        canopy.groves[i].center.y >= canopy.groves[i - 1].center.y,
        `Grove ${i} Y (${canopy.groves[i].center.y}) must be >= Grove ${i - 1} Y (${canopy.groves[i - 1].center.y})`
      );
    }

    // Sentinel trees must be strictly ascending by Y
    for (let i = 1; i < canopy.sentinelTrees.length; i++) {
      assert.ok(
        canopy.sentinelTrees[i].y >= canopy.sentinelTrees[i - 1].y,
        `Sentinel tree ${i} Y (${canopy.sentinelTrees[i].y}) must be >= Sentinel tree ${i - 1} Y (${canopy.sentinelTrees[i - 1].y})`
      );
    }
  });

  it('scales grove count across sparse, medium, and dense density presets', () => {
    const sparse = generateProceduralCanopyMass(forestBoundary, {
      seed: 55,
      density: 'sparse',
    });
    const medium = generateProceduralCanopyMass(forestBoundary, {
      seed: 55,
      density: 'medium',
    });
    const dense = generateProceduralCanopyMass(forestBoundary, {
      seed: 55,
      density: 'dense',
    });

    assert.ok(sparse !== null && medium !== null && dense !== null);
    assert.ok(
      sparse.groves.length < medium.groves.length,
      `sparse (${sparse.groves.length}) should have fewer groves than medium (${medium.groves.length})`
    );
    assert.ok(
      medium.groves.length < dense.groves.length,
      `medium (${medium.groves.length}) should have fewer groves than dense (${dense.groves.length})`
    );
  });

  it('produces 100% deterministic results with identical seeds', () => {
    const run1 = generateProceduralCanopyMass(forestBoundary, {
      seed: 9999,
      density: 'medium',
    });
    const run2 = generateProceduralCanopyMass(forestBoundary, {
      seed: 9999,
      density: 'medium',
    });

    assert.deepEqual(run1, run2);
  });
});
