import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralDuneField } from './duneFieldGenerator';
import { isPointInPolygon } from '../landSculpt/geometry';
import type { MapPoint } from '@/lib/types';

describe('duneFieldGenerator — Sinuous Barchan Sand Dunes', () => {
  // Rectangular desert polygon 240 x 180
  const desertBoundary: MapPoint[] = [
    { x: 100, y: 100 },
    { x: 340, y: 100 },
    { x: 340, y: 280 },
    { x: 100, y: 280 },
  ];

  it('returns null for empty or tiny boundary polygons', () => {
    assert.equal(generateProceduralDuneField([]), null);
    assert.equal(
      generateProceduralDuneField([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
      null
    );
  });

  it('generates a procedural dune field with barchan dunes', () => {
    const field = generateProceduralDuneField(desertBoundary, {
      seed: 42,
      density: 'medium',
      windAngleDegrees: 35,
    });

    assert.ok(field !== null);
    assert.ok(field.dunes.length >= 8);
    assert.equal(field.totalArea, 240 * 180);

    for (const dune of field.dunes) {
      assert.ok(dune.crestSpline.length >= 7);
      assert.ok(dune.slipFacePoly.length >= 10);
      assert.ok(dune.slipFaceHatches.length >= 3);
      assert.ok(dune.windwardRipples.length >= 1);
      assert.ok(dune.width > 15);
      assert.ok(dune.length > 5);

      // Horns and apex must be distinct
      assert.notDeepEqual(dune.leftHorn, dune.rightHorn);
      assert.notDeepEqual(dune.apex, dune.leftHorn);
    }
  });

  it('ensures all dune centers, apexes, and horns stay strictly within the desert boundary', () => {
    const field = generateProceduralDuneField(desertBoundary, {
      seed: 12345,
      density: 'dense',
      windAngleDegrees: 45,
    });

    assert.ok(field !== null);
    assert.ok(field.dunes.length > 10);

    for (const dune of field.dunes) {
      assert.ok(
        isPointInPolygon(dune.center, desertBoundary),
        `Dune center (${dune.center.x}, ${dune.center.y}) must be in boundary`
      );
      assert.ok(
        isPointInPolygon(dune.apex, desertBoundary),
        `Dune apex (${dune.apex.x}, ${dune.apex.y}) must be in boundary`
      );
      assert.ok(
        isPointInPolygon(dune.leftHorn, desertBoundary),
        `Dune left horn (${dune.leftHorn.x}, ${dune.leftHorn.y}) must be in boundary`
      );
      assert.ok(
        isPointInPolygon(dune.rightHorn, desertBoundary),
        `Dune right horn (${dune.rightHorn.x}, ${dune.rightHorn.y}) must be in boundary`
      );
    }
  });

  it('scales dune count across sparse, medium, and dense presets', () => {
    const sparse = generateProceduralDuneField(desertBoundary, {
      seed: 99,
      density: 'sparse',
    });
    const medium = generateProceduralDuneField(desertBoundary, {
      seed: 99,
      density: 'medium',
    });
    const dense = generateProceduralDuneField(desertBoundary, {
      seed: 99,
      density: 'dense',
    });

    assert.ok(sparse !== null && medium !== null && dense !== null);
    assert.ok(
      sparse.dunes.length < medium.dunes.length,
      `sparse (${sparse.dunes.length}) should have fewer dunes than medium (${medium.dunes.length})`
    );
    assert.ok(
      medium.dunes.length < dense.dunes.length,
      `medium (${medium.dunes.length}) should have fewer dunes than dense (${dense.dunes.length})`
    );
  });

  it('orientates dunes along prevailing wind vector', () => {
    // Wind blowing directly East (0°)
    const fieldEast = generateProceduralDuneField(desertBoundary, {
      seed: 55,
      windAngleDegrees: 0,
    });
    assert.ok(fieldEast !== null && fieldEast.dunes.length > 0);
    const duneE = fieldEast.dunes[0];
    // Apex is upwind (west: smaller X), horns are downwind (east: larger X)
    assert.ok(
      duneE.apex.x < duneE.center.x,
      'When wind is East (0°), apex must be to the west (smaller X) of center'
    );
    assert.ok(
      duneE.leftHorn.x > duneE.apex.x,
      'When wind is East (0°), horns must point downwind (larger X)'
    );

    // Wind blowing directly South (90°)
    const fieldSouth = generateProceduralDuneField(desertBoundary, {
      seed: 55,
      windAngleDegrees: 90,
    });
    assert.ok(fieldSouth !== null && fieldSouth.dunes.length > 0);
    const duneS = fieldSouth.dunes[0];
    // Apex is upwind (north: smaller Y), horns are downwind (south: larger Y)
    assert.ok(
      duneS.apex.y < duneS.center.y,
      'When wind is South (90°), apex must be to the north (smaller Y) of center'
    );
    assert.ok(
      duneS.leftHorn.y > duneS.apex.y,
      'When wind is South (90°), horns must point downwind (larger Y)'
    );
  });

  it('produces 100% deterministic results with identical seeds', () => {
    const run1 = generateProceduralDuneField(desertBoundary, {
      seed: 8888,
      density: 'medium',
      windAngleDegrees: 40,
    });
    const run2 = generateProceduralDuneField(desertBoundary, {
      seed: 8888,
      density: 'medium',
      windAngleDegrees: 40,
    });

    assert.deepEqual(run1, run2);
  });

  it('clears dunes from exclusion zones around settlements or pins', () => {
    const centerPin = { x: 220, y: 190 };
    const fieldWithoutExclusion = generateProceduralDuneField(desertBoundary, {
      seed: 42,
      density: 'dense',
    });
    const fieldWithExclusion = generateProceduralDuneField(desertBoundary, {
      seed: 42,
      density: 'dense',
      exclusionZones: [{ x: centerPin.x, y: centerPin.y, radius: 45 }],
    });

    assert.ok(fieldWithoutExclusion !== null && fieldWithExclusion !== null);
    assert.ok(
      fieldWithExclusion.dunes.length < fieldWithoutExclusion.dunes.length,
      'Exclusion zone should remove dunes from the area'
    );
    for (const dune of fieldWithExclusion.dunes) {
      const dist = Math.hypot(dune.center.x - centerPin.x, dune.center.y - centerPin.y);
      assert.ok(
        dist >= 45,
        `Dune at ${dune.center.x}, ${dune.center.y} should be outside 45px exclusion radius (dist=${dist})`
      );
    }
  });
});
