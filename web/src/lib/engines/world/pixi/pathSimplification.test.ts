import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  perpendicularDistance,
  simplifyPoints,
  simplifyPolygon,
} from './pathSimplification';
import type { MapPoint } from '@/lib/types';

describe('pathSimplification', () => {
  it('calculates perpendicular distance correctly', () => {
    const a: MapPoint = { x: 0, y: 0 };
    const b: MapPoint = { x: 10, y: 0 };
    const p: MapPoint = { x: 5, y: 5 };

    const dist = perpendicularDistance(p, a, b);
    assert.equal(Math.round(dist), 5);
  });

  it('preserves straight line endpoints and removes collinear intermediate points', () => {
    // 5 collinear points
    const points: MapPoint[] = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 4 },
      { x: 8, y: 8 },
      { x: 10, y: 10 },
    ];

    const simplified = simplifyPoints(points, 1);
    assert.equal(simplified.length, 2);
    assert.deepEqual(simplified[0], { x: 0, y: 0 });
    assert.deepEqual(simplified[1], { x: 10, y: 10 });
  });

  it('keeps prominent corner vertices during simplification', () => {
    // Sharp triangle peak
    const points: MapPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0.1 },
      { x: 2, y: 0.2 },
      { x: 5, y: 10 }, // prominent peak
      { x: 8, y: 0.2 },
      { x: 9, y: 0.1 },
      { x: 10, y: 0 },
    ];

    const simplified = simplifyPoints(points, 2);
    assert.equal(simplified.length, 3);
    assert.deepEqual(simplified[0], { x: 0, y: 0 });
    assert.deepEqual(simplified[1], { x: 5, y: 10 });
    assert.deepEqual(simplified[2], { x: 10, y: 0 });
  });

  it('simplifies a dense circle-like polygon to a clean polygon with at least 3 vertices', () => {
    // Generate 60 points around a circle
    const denseCircle: MapPoint[] = [];
    const radius = 100;
    const center = { x: 200, y: 200 };
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      denseCircle.push({
        x: Math.round(center.x + Math.cos(angle) * radius),
        y: Math.round(center.y + Math.sin(angle) * radius),
      });
    }

    const simplified = simplifyPolygon(denseCircle, 8);
    // Should dramatically reduce 60 points down to between 6 and 16 points
    assert.ok(simplified.length >= 6, `Expected >= 6, got ${simplified.length}`);
    assert.ok(simplified.length <= 16, `Expected <= 16, got ${simplified.length}`);
  });

  it('handles small polygons without collapsing', () => {
    const triangle: MapPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 100 },
      { x: 100, y: 0 },
    ];
    const simplified = simplifyPolygon(triangle, 5);
    assert.equal(simplified.length, 3);
  });
});
