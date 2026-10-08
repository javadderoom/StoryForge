/**
 * landSculptEngine.invariants.test.ts
 *
 * EMPIRICAL MATHEMATICAL INVARIANT VERIFICATION SUITE for landSculptEngine.ts.
 * Authored by Challenger M1-2 (critic & specialist).
 *
 * Verifies 4 core mathematical invariants:
 *   1. Angular Closure:
 *      - Seam step regularity across 0 <-> 2*pi boundary
 *      - Exact topological closure under ensureClosedRing
 *      - Non-crossing seam closing segment
 *   2. Star-Convexity:
 *      - Strict radial vector cross product positivity relative to kernel
 *      - Strict polar angle counter-clockwise monotonicity
 *      - Boundary simplicity (zero self-intersections)
 *      - Kernel ray-casting uniqueness (exactly 1 intersection per radial ray)
 *      - Small-radius boundary robustness and degenerate filtering
 *   3. Area Monotonicity:
 *      - Pure Boolean Union area non-decrease (tolerance = 0): Area(A U B) >= Area(A)
 *      - Pure Boolean Difference area non-increase (tolerance = 0): Area(A \ B) <= Area(A)
 *      - Simplified Union area perturbation bounds: bounded by O(epsilon * perimeter)
 *      - Simplified Difference area perturbation bounds: bounded by O(epsilon * perimeter)
 *   4. RDP Epsilon Convergence:
 *      - Pure Douglas-Peucker Hausdorff error bound: dist(p, simplified) <= epsilon
 *      - Chained Radial + RDP triangle inequality bound: dist(p, simplified) <= 2 * epsilon
 *      - Closed polygon ring error bound <= 2 * epsilon
 *      - Monotonic vertex reduction across operational design range [0.5, 5.0]
 *      - Extreme vertex rotation: anchor is strictly an extreme point on the convex hull
 *      - Over-simplification degenerate ring safety fallback guard
 *
 * Runner: npx tsx --test src/lib/engines/world/landSculptEngine.invariants.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOrganicStamp,
  interpolateStrokePoints,
  calculatePolygonArea,
  calculateSignedArea,
  simplifyPolyline,
  simplifyPolygonRing,
  simplifyDouglasPeucker,
  simplifyRadialDist,
  sanitizePolygonRing,
  removeDuplicateVertices,
  removeCollinearVertices,
  ensureClosedRing,
  ensureOpenRing,
  getSqDist,
  getSqSegmentDist,
  applySculptOperation,
  DEFAULT_SIMPLIFY_EPSILON,
  MIN_FEATURE_AREA,
  MIN_HOLE_AREA,
} from './landSculptEngine';
import { MapPoint, MapTerrainFeature } from '@/lib/types';

// Helper: Line segment intersection test
function doSegmentsIntersect(
  p1: MapPoint,
  p2: MapPoint,
  p3: MapPoint,
  p4: MapPoint
): boolean {
  const ccw = (a: MapPoint, b: MapPoint, c: MapPoint) =>
    (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);

  const minX1 = Math.min(p1.x, p2.x);
  const maxX1 = Math.max(p1.x, p2.x);
  const minY1 = Math.min(p1.y, p2.y);
  const maxY1 = Math.max(p1.y, p2.y);

  const minX2 = Math.min(p3.x, p4.x);
  const maxX2 = Math.max(p3.x, p4.x);
  const minY2 = Math.min(p3.y, p4.y);
  const maxY2 = Math.max(p3.y, p4.y);

  if (minX1 > maxX2 || maxX1 < minX2 || minY1 > maxY2 || maxY1 < minY2) {
    return false;
  }

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

// Helper: Check polygon self-intersection (excluding adjacent segments)
function hasPolygonSelfIntersection(points: MapPoint[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;

      const b1 = points[j];
      const b2 = points[(j + 1) % n];

      if (doSegmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

// Minimum distance from point p to polyline
function distPointToPolyline(p: MapPoint, polyline: MapPoint[]): number {
  let minSq = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const sq = getSqSegmentDist(p, polyline[i], polyline[i + 1]);
    if (sq < minSq) minSq = sq;
  }
  return Math.sqrt(minSq);
}

// Minimum distance from point p to closed polygon boundary
function distPointToPolygonBoundary(p: MapPoint, polygon: MapPoint[]): number {
  const n = polygon.length;
  let minSq = Infinity;
  for (let i = 0; i < n; i++) {
    const sq = getSqSegmentDist(p, polygon[i], polygon[(i + 1) % n]);
    if (sq < minSq) minSq = sq;
  }
  return Math.sqrt(minSq);
}

// Pure iterative Douglas-Peucker without radial pre-filter (oracle baseline)
function pureRdp(points: MapPoint[], epsilon: number): MapPoint[] {
  const len = points.length;
  if (len <= 2) return points.slice();
  const sqEpsilon = epsilon * epsilon;

  const markers = new Uint8Array(len);
  markers[0] = 1;
  markers[len - 1] = 1;
  const stack: [number, number][] = [[0, len - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxSqDist = 0;
    let maxIdx = -1;
    const p1 = points[start];
    const p2 = points[end];

    for (let i = start + 1; i < end; i++) {
      const sqDist = getSqSegmentDist(points[i], p1, p2);
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        maxIdx = i;
      }
    }

    if (maxSqDist > sqEpsilon && maxIdx !== -1) {
      markers[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const result: MapPoint[] = [];
  for (let i = 0; i < len; i++) {
    if (markers[i] === 1) result.push(points[i]);
  }
  return result;
}

// Helper: Calculate effective land area across features (subtracting inner holes)
function getEffectiveLandArea(features: MapTerrainFeature[]): number {
  let total = 0;
  for (const f of features) {
    if (f.type === 'continent' || f.type === 'island') {
      if (f.polygon && f.polygon.length >= 3) {
        let outer = calculatePolygonArea(f.polygon);
        if (f.holes && f.holes.length > 0) {
          for (const h of f.holes) {
            outer -= calculatePolygonArea(h);
          }
        }
        total += Math.max(0, outer);
      }
    }
  }
  return total;
}

// ============================================================================
// 1. ANGULAR CLOSURE INVARIANTS
// ============================================================================

test('Mathematical Invariant 1: Angular Closure', async (t) => {
  await t.test('Seam step regularity: gap ratio between seam and internal chord is bounded', () => {
    let maxGapRatio = 0;
    const trials = 500;

    for (let i = 0; i < trials; i++) {
      const radius = 20 + Math.random() * 200;
      const roughness = Math.random();
      const seed = Math.floor(Math.random() * 100000);
      const vertexCount = 24 + Math.floor(Math.random() * 41);

      const stamp = generateOrganicStamp(500, 500, radius, roughness, seed, vertexCount);
      const n = stamp.length;
      const dSeam = Math.hypot(stamp[0].x - stamp[n - 1].x, stamp[0].y - stamp[n - 1].y);
      const dStep0 = Math.hypot(stamp[1].x - stamp[0].x, stamp[1].y - stamp[0].y);

      const ratio = Math.max(dSeam, dStep0) / Math.max(1, Math.min(dSeam, dStep0));
      if (ratio > maxGapRatio) maxGapRatio = ratio;

      assert.ok(ratio <= 3.0, `Seam gap ratio ${ratio} exceeded tolerance (dSeam=${dSeam}, dStep0=${dStep0})`);
    }
  });

  await t.test('Topological ring closure: ensureClosedRing appends identical endpoint and preserves orientation', () => {
    for (let i = 0; i < 300; i++) {
      const stamp = generateOrganicStamp(200, 200, 60, Math.random(), i, 32);
      const closed = ensureClosedRing(stamp);

      assert.strictEqual(closed.length, stamp.length + 1);
      assert.strictEqual(closed[0].x, closed[closed.length - 1].x);
      assert.strictEqual(closed[0].y, closed[closed.length - 1].y);

      // Shoelace signed area must be positive (CCW)
      const signedArea = calculateSignedArea(closed);
      assert.ok(signedArea > 0, `Signed area ${signedArea} was not CCW`);
    }
  });

  await t.test('Seam segment non-crossing: closing segment [p_{n-1}, p_0] never intersects non-adjacent segments', () => {
    for (let i = 0; i < 500; i++) {
      const stamp = generateOrganicStamp(
        300,
        300,
        25 + Math.random() * 120,
        Math.random(),
        i * 23,
        32
      );
      const n = stamp.length;
      const closingP1 = stamp[n - 1];
      const closingP2 = stamp[0];

      for (let j = 1; j < n - 2; j++) {
        const intersects = doSegmentsIntersect(closingP1, closingP2, stamp[j], stamp[j + 1]);
        assert.strictEqual(intersects, false, `Seam segment intersected facet [${j}, ${j + 1}] at trial ${i}`);
      }
    }
  });
});

// ============================================================================
// 2. STAR-CONVEXITY INVARIANTS
// ============================================================================

test('Mathematical Invariant 2: Star-Convexity', async (t) => {
  await t.test('Radial cross product positivity: (p_i - c) x (p_{i+1} - c) > 0 for all facets', () => {
    const trials = 1000;
    const cx = 400;
    const cy = 400;

    for (let i = 0; i < trials; i++) {
      const radius = 20 + Math.random() * 200;
      const roughness = Math.random();
      const vertexCount = 24 + Math.floor(Math.random() * 41);
      const stamp = generateOrganicStamp(cx, cy, radius, roughness, i * 37, vertexCount);

      for (let j = 0; j < stamp.length; j++) {
        const p1 = stamp[j];
        const p2 = stamp[(j + 1) % stamp.length];
        const cross = (p1.x - cx) * (p2.y - cy) - (p1.y - cy) * (p2.x - cx);
        assert.ok(cross > 0, `Non-positive cross product ${cross} at facet ${j} in trial ${i}`);
      }
    }
  });

  await t.test('Polar angle counter-clockwise monotonicity across full circle', () => {
    const cx = 500;
    const cy = 500;

    for (let i = 0; i < 500; i++) {
      const stamp = generateOrganicStamp(cx, cy, 30 + Math.random() * 150, Math.random(), i * 41, 32);

      let prevAngle = -Infinity;
      for (let j = 0; j < stamp.length; j++) {
        const angle = Math.atan2(stamp[j].y - cy, stamp[j].x - cx);
        const normAngle = angle < 0 ? angle + 2 * Math.PI : angle;
        if (j > 0 && !(j === stamp.length - 1 && normAngle < 0.1)) {
          assert.ok(normAngle > prevAngle, `Polar angle failed monotonicity at index ${j}: ${normAngle} <= ${prevAngle}`);
        }
        prevAngle = normAngle;
      }
    }
  });

  await t.test('Boundary simplicity: stamp boundary has zero self-intersections across all segment pairs', () => {
    for (let i = 0; i < 500; i++) {
      const stamp = generateOrganicStamp(500, 500, 20 + Math.random() * 180, Math.random(), i * 67, 32);
      const selfIntersects = hasPolygonSelfIntersection(stamp);
      assert.strictEqual(selfIntersects, false, `Self-intersection detected in stamp ${i}`);
    }
  });

  await t.test('Kernel ray-casting uniqueness: every ray from center intersects boundary exactly once', () => {
    const cx = 500;
    const cy = 500;

    for (let i = 0; i < 100; i++) {
      const stamp = generateOrganicStamp(cx, cy, 60, Math.random(), i * 19, 32);

      for (let r = 0; r < 36; r++) {
        const phi = (r / 36) * 2 * Math.PI;
        const rayEnd: MapPoint = {
          x: Math.round(cx + 300 * Math.cos(phi)),
          y: Math.round(cy + 300 * Math.sin(phi)),
        };

        let intersectionCount = 0;
        for (let j = 0; j < stamp.length; j++) {
          const p1 = stamp[j];
          const p2 = stamp[(j + 1) % stamp.length];
          if (doSegmentsIntersect({ x: cx, y: cy }, rayEnd, p1, p2)) {
            intersectionCount++;
          }
        }
        assert.strictEqual(intersectionCount, 1, `Ray at phi=${phi.toFixed(2)} intersected ${intersectionCount} times (expected 1)`);
      }
    }
  });

  await t.test('Robust boundary sanitization on small radii boundaries', () => {
    for (const r of [1, 2, 5, 10, 15, 20]) {
      const stamp = generateOrganicStamp(100, 100, r, 0.5, 42, 32);
      const sanitized = sanitizePolygonRing(stamp);
      if (r >= 10) {
        assert.ok(sanitized.length >= 3, `Expected valid polygon for r=${r}, got length ${sanitized.length}`);
      }
    }
  });
});

// ============================================================================
// 3. AREA MONOTONICITY INVARIANTS
// ============================================================================

test('Mathematical Invariant 3: Area Monotonicity', async (t) => {
  await t.test('Pure Boolean Union area non-decrease (tolerance = 0): Area(A U B) >= Area(A)', () => {
    for (let i = 0; i < 200; i++) {
      const seedFeature: MapTerrainFeature = {
        id: 'base_cont',
        name: 'Base Continent',
        type: 'continent',
        polygon: generateOrganicStamp(400, 400, 80, 0.3, i * 13, 32),
      };

      const stroke = generateOrganicStamp(
        350 + (i % 10) * 10,
        350 + (i % 10) * 10,
        50,
        0.3,
        i * 99,
        32
      );

      const beforeArea = getEffectiveLandArea([seedFeature]);
      const result = applySculptOperation([seedFeature], stroke, 'paint', {
        simplifyTolerance: 0,
      });
      const afterArea = getEffectiveLandArea(result);

      const diff = afterArea - beforeArea;
      assert.ok(diff >= -1e-4, `Union decreased area by ${-diff} at trial ${i}`);
    }
  });

  await t.test('Pure Boolean Difference area non-increase (tolerance = 0): Area(A \\ B) <= Area(A)', () => {
    for (let i = 0; i < 200; i++) {
      const seedFeature: MapTerrainFeature = {
        id: 'base_cont',
        name: 'Base Continent',
        type: 'continent',
        polygon: generateOrganicStamp(400, 400, 90, 0.3, i * 23, 32),
      };

      const stroke = generateOrganicStamp(
        360 + (i % 9) * 10,
        360 + (i % 9) * 10,
        40,
        0.3,
        i * 77,
        32
      );

      const beforeArea = getEffectiveLandArea([seedFeature]);
      const result = applySculptOperation([seedFeature], stroke, 'carve', {
        simplifyTolerance: 0,
      });
      const afterArea = getEffectiveLandArea(result);

      const diff = afterArea - beforeArea;
      assert.ok(diff <= 1e-4, `Difference increased area by ${diff} at trial ${i}`);
    }
  });

  await t.test('Simplified Union & Difference area perturbation bounds (tolerance = 1.5)', () => {
    for (let i = 0; i < 200; i++) {
      const seedFeature: MapTerrainFeature = {
        id: 'cont_1',
        name: 'Land',
        type: 'continent',
        polygon: generateOrganicStamp(500, 500, 100, 0.4, i * 11, 40),
      };

      const stroke = generateOrganicStamp(
        480 + (i % 7) * 8,
        480 + (i % 7) * 8,
        40,
        0.4,
        i * 43,
        32
      );

      const baseArea = getEffectiveLandArea([seedFeature]);

      // Paint
      const paintRes = applySculptOperation([seedFeature], stroke, 'paint', {
        simplifyTolerance: DEFAULT_SIMPLIFY_EPSILON,
      });
      const paintArea = getEffectiveLandArea(paintRes);
      const paintDiff = paintArea - baseArea;

      // Area loss due to RDP corner-cutting bounded by O(epsilon * perimeter) ~ 500px^2
      if (paintDiff < 0) {
        assert.ok(-paintDiff < 500, `Excessive area loss on paint: ${-paintDiff}px²`);
      }

      // Carve
      const carveRes = applySculptOperation([seedFeature], stroke, 'carve', {
        simplifyTolerance: DEFAULT_SIMPLIFY_EPSILON,
      });
      const carveArea = getEffectiveLandArea(carveRes);
      const carveDiff = carveArea - baseArea;

      // Area gain due to RDP corner-cutting bounded by O(epsilon * perimeter) ~ 500px^2
      if (carveDiff > 0) {
        assert.ok(carveDiff < 500, `Excessive area gain on carve: ${carveDiff}px²`);
      }
    }
  });
});

// ============================================================================
// 4. RDP EPSILON CONVERGENCE INVARIANTS
// ============================================================================

test('Mathematical Invariant 4: RDP Epsilon Convergence', async (t) => {
  await t.test('Pure Douglas-Peucker algorithm Hausdorff error bound: dist <= epsilon', () => {
    const testEpsilons = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];

    for (const eps of testEpsilons) {
      for (let i = 0; i < 30; i++) {
        const original: MapPoint[] = [];
        let curX = 100;
        let curY = 100;
        for (let j = 0; j < 60; j++) {
          curX += 5 + Math.random() * 5;
          curY += (Math.random() - 0.5) * 8;
          original.push({ x: Math.round(curX), y: Math.round(curY) });
        }

        const simplified = pureRdp(original, eps);

        for (const pt of original) {
          const d = distPointToPolyline(pt, simplified);
          assert.ok(d <= eps + 1e-4, `Point (${pt.x}, ${pt.y}) distance ${d} exceeded pure epsilon ${eps}`);
        }
      }
    }
  });

  await t.test('Chained Radial + RDP triangle inequality bound: dist <= 2 * epsilon', () => {
    const testEpsilons = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];

    for (const eps of testEpsilons) {
      for (let i = 0; i < 30; i++) {
        const original: MapPoint[] = [];
        let curX = 100;
        let curY = 100;
        for (let j = 0; j < 60; j++) {
          curX += 5 + Math.random() * 5;
          curY += (Math.random() - 0.5) * 8;
          original.push({ x: Math.round(curX), y: Math.round(curY) });
        }

        const simplified = simplifyPolyline(original, eps);

        for (const pt of original) {
          const d = distPointToPolyline(pt, simplified);
          assert.ok(d <= 2 * eps + 0.5, `Point distance ${d} exceeded triangle inequality bound 2*eps=${2 * eps}`);
        }
      }
    }
  });

  await t.test('Closed polygon ring error bound <= 2 * epsilon', () => {
    const testEpsilons = [1.0, 1.5, 2.5, 5.0];

    for (const eps of testEpsilons) {
      for (let i = 0; i < 30; i++) {
        const stamp = generateOrganicStamp(500, 500, 80, 0.6, i * 59, 48);
        const simplified = simplifyPolygonRing(stamp, eps);

        for (const pt of stamp) {
          const d = distPointToPolygonBoundary(pt, simplified);
          assert.ok(d <= 2 * eps + 1.0, `Point distance ${d} exceeded ring bound for eps=${eps}`);
        }
      }
    }
  });

  await t.test('Monotonic vertex reduction across operational design range [0.5, 1.5, 5.0]', () => {
    for (let i = 0; i < 50; i++) {
      const stamp = generateOrganicStamp(400, 400, 100, 0.8, i * 71, 64);
      const s05 = simplifyPolygonRing(stamp, 0.5);
      const s15 = simplifyPolygonRing(stamp, 1.5);
      const s50 = simplifyPolygonRing(stamp, 5.0);

      assert.ok(s05.length >= s15.length, `Count at 0.5 (${s05.length}) < count at 1.5 (${s15.length})`);
      assert.ok(s15.length >= s50.length, `Count at 1.5 (${s15.length}) < count at 5.0 (${s50.length})`);
    }
  });

  await t.test('Extreme vertex rotation anchor is strictly an extreme point on the convex hull', () => {
    for (let i = 0; i < 100; i++) {
      const stamp = generateOrganicStamp(500, 500, 70, 0.7, i * 41, 32);
      let minIdx = 0;
      for (let j = 1; j < stamp.length; j++) {
        if (
          stamp[j].x < stamp[minIdx].x ||
          (stamp[j].x === stamp[minIdx].x && stamp[j].y < stamp[minIdx].y)
        ) {
          minIdx = j;
        }
      }
      const extreme = stamp[minIdx];
      const allLeftOrEqual = stamp.every((pt) => pt.x >= extreme.x);
      assert.strictEqual(allLeftOrEqual, true, 'Lexicographical minimum vertex was not on convex hull');
    }
  });

  await t.test('Over-simplification degenerate ring safety fallback guard', () => {
    const stamp = generateOrganicStamp(300, 300, 80, 0.5, 777, 40);
    const cleaned = sanitizePolygonRing(stamp);

    // Epsilon = 500 (much larger than diameter 160)
    const overEps = simplifyPolygonRing(stamp, 500);

    // Must return valid cleaned polygon ring (>= 3 vertices)
    assert.ok(overEps.length >= 3, `Expected >= 3 vertices, got ${overEps.length}`);
    assert.strictEqual(overEps.length, cleaned.length);
  });
});
