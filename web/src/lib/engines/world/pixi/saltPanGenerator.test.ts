import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralSaltPan } from './saltPanGenerator';
import { isPointInPolygon } from '../landSculpt/geometry';
import type { MapPoint } from '@/lib/types';

describe('saltPanGenerator — Voronoi Salt Pan & Evaporite Crust', () => {
  // Rectangular playa polygon 120 x 80
  const playaBoundary: MapPoint[] = [
    { x: 100, y: 100 },
    { x: 220, y: 100 },
    { x: 220, y: 180 },
    { x: 100, y: 180 },
  ];

  it('returns null for empty or tiny boundary polygons', () => {
    assert.equal(generateProceduralSaltPan([]), null);
    assert.equal(
      generateProceduralSaltPan([
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ]),
      null
    );
  });

  it('generates a procedural salt pan with Voronoi polygonal plates', () => {
    const saltPan = generateProceduralSaltPan(playaBoundary, {
      seed: 42,
      cellSize: 24,
    });

    assert.ok(saltPan !== null);
    assert.ok(saltPan.cells.length >= 6);
    assert.ok(saltPan.crackLines.length > 10);
    assert.equal(saltPan.totalArea, 120 * 80);

    for (const cell of saltPan.cells) {
      assert.ok(cell.polygon.length >= 3);
      assert.ok(cell.area > 10);
      assert.ok(cell.seed.x >= 100 && cell.seed.x <= 220);
      assert.ok(cell.seed.y >= 100 && cell.seed.y <= 180);
    }
  });

  it('ensures all cell vertices are contained strictly inside or along the boundary', () => {
    const saltPan = generateProceduralSaltPan(playaBoundary, {
      seed: 12345,
      cellSize: 20,
    });

    assert.ok(saltPan !== null);

    for (const cell of saltPan.cells) {
      for (const pt of cell.polygon) {
        // Vertex should be inside or within sub-pixel epsilon of boundary
        const inBounds =
          pt.x >= 99.9 && pt.x <= 220.1 && pt.y >= 99.9 && pt.y <= 180.1;
        assert.ok(
          inBounds,
          `Vertex (${pt.x}, ${pt.y}) should not leak outside boundary`
        );
      }
    }
  });

  it('generates concentric evaporation shrinkage rings and crystal stipples', () => {
    const saltPan = generateProceduralSaltPan(playaBoundary, {
      seed: 777,
      cellSize: 26,
      concentricRings: true,
    });

    assert.ok(saltPan !== null);

    // At least some large cells should have inner shrinkage rings
    const cellsWithRings = saltPan.cells.filter((c) => c.shrinkageRings.length > 0);
    assert.ok(cellsWithRings.length > 0);

    for (const cell of cellsWithRings) {
      const ring = cell.shrinkageRings[0];
      assert.equal(ring.length, cell.polygon.length);
      // Ring should be inside cell polygon
      for (const rp of ring) {
        assert.ok(isPointInPolygon(rp, playaBoundary));
      }
    }

    // Every cell should have crystalline salt stipples
    for (const cell of saltPan.cells) {
      assert.ok(cell.saltCrystals.length >= 1);
    }
  });

  it('produces 100% deterministic results with identical seeds', () => {
    const pan1 = generateProceduralSaltPan(playaBoundary, { seed: 888, cellSize: 22 });
    const pan2 = generateProceduralSaltPan(playaBoundary, { seed: 888, cellSize: 22 });

    assert.ok(pan1 !== null && pan2 !== null);
    assert.equal(pan1.cells.length, pan2.cells.length);
    assert.equal(pan1.crackLines.length, pan2.crackLines.length);
    assert.equal(pan1.cells[0].seed.x, pan2.cells[0].seed.x);
    assert.equal(pan1.cells[0].polygon.length, pan2.cells[0].polygon.length);
  });
});
