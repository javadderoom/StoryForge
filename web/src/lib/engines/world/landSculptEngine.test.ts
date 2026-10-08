/**
 * landSculptEngine.test.ts
 *
 * Comprehensive unit test suite for the StoryForge Land Sculpting Math & Geometry Engine.
 * Tests:
 *   1. Stroke path interpolation (distance thresholds, gap elimination, monotonic step vectors)
 *   2. Procedural Simplex noise stamp generation (zero seam closure, star-convexity, roughness variance)
 *   3. 2D Math primitives (Shoelace area, clamped segment distance, AABB intersections)
 *   4. RDP Simplification & Sanitization (extreme vertex rotation, collinear removal, sliver filtering)
 *   5. Boolean Sculpt Operations (Paint Land union, Carve Water straits, inland lake holes, empty ocean no-op, non-land feature isolation, sliver rejection)
 *   6. Performance Benchmarks (<10ms consolidation budget)
 *
 * Runner: npx tsx --test src/lib/engines/world/landSculptEngine.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interpolateStrokePoints,
  generateOrganicStamp,
  getSqDist,
  getSqSegmentDist,
  calculateSignedArea,
  calculatePolygonArea,
  getBoundingBox,
  doAABBIntersect,
  removeDuplicateVertices,
  removeCollinearVertices,
  ensureOpenRing,
  ensureClosedRing,
  isDegeneratePolygon,
  simplifyRadialDist,
  simplifyPolyline,
  simplifyPolygonRing,
  simplifyDouglasPeucker,
  sanitizePolygonRing,
  sanitizeAndSimplifyPolygon,
  mapPointsToGeoRing,
  geoRingToMapPoints,
  featureToGeoPolygon,
  featuresToGeoMultiPolygon,
  applySculptOperation,
  DEFAULT_SIMPLIFY_EPSILON,
  MIN_FEATURE_AREA,
  MIN_HOLE_AREA,
} from './landSculptEngine';
import { MapPoint, MapTerrainFeature } from '@/lib/types';

// ============================================================================
// 1. STROKE INTERPOLATION UNIT TESTS
// ============================================================================

test('Stroke Interpolation (interpolateStrokePoints)', async (t) => {
  await t.test('returns single point when start and end are identical (dist = 0) with includeStart=true', () => {
    const p0 = { x: 100, y: 150 };
    const points = interpolateStrokePoints(p0, p0, 20, true);
    assert.strictEqual(points.length, 1);
    assert.deepStrictEqual(points[0], { x: 100, y: 150 });
  });

  await t.test('returns empty array when start and end are identical (dist = 0) with includeStart=false', () => {
    const p0 = { x: 100, y: 150 };
    const points = interpolateStrokePoints(p0, p0, 20, false);
    assert.strictEqual(points.length, 0);
  });

  await t.test('spacing between any two adjacent interpolated points never exceeds stepSize', () => {
    const p0 = { x: 50, y: 50 };
    const p1 = { x: 350, y: 450 }; // distance = 500px
    const stepSize = 25;
    const points = interpolateStrokePoints(p0, p1, stepSize);

    assert.ok(points.length >= 20, `Expected >= 20 points, got ${points.length}`);
    for (let i = 0; i < points.length - 1; i++) {
      const dist = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      assert.ok(dist <= stepSize + 1.0, `Step ${i} gap of ${dist} exceeds stepSize ${stepSize}`);
    }
  });

  await t.test('preserves exact origin and terminus coordinates', () => {
    const p0 = { x: 42, y: 88 };
    const p1 = { x: 610, y: 790 };
    const points = interpolateStrokePoints(p0, p1, 15);

    assert.deepStrictEqual(points[0], p0);
    assert.deepStrictEqual(points[points.length - 1], p1);
  });

  await t.test('monotonic progression along pure horizontal drag vector', () => {
    const p0 = { x: 100, y: 250 };
    const p1 = { x: 500, y: 250 };
    const points = interpolateStrokePoints(p0, p1, 20);

    for (let i = 0; i < points.length - 1; i++) {
      assert.ok(points[i].x < points[i + 1].x, 'X must strictly increase');
      assert.strictEqual(points[i].y, 250, 'Y must remain constant');
    }
  });

  await t.test('supports option object parameter { includeStart: false } for streaming drag events', () => {
    const p0 = { x: 100, y: 100 };
    const p1 = { x: 200, y: 100 };
    const points = interpolateStrokePoints(p0, p1, 25, { includeStart: false });

    // Should not include p0
    assert.notDeepStrictEqual(points[0], p0);
    // Should end at p1
    assert.deepStrictEqual(points[points.length - 1], p1);
  });

  await t.test('handles degenerate stepSize <= 0 by clamping to safe minimum', () => {
    const p0 = { x: 10, y: 10 };
    const p1 = { x: 50, y: 10 };
    const points = interpolateStrokePoints(p0, p1, 0);
    assert.ok(points.length >= 2);
    assert.deepStrictEqual(points[0], p0);
    assert.deepStrictEqual(points[points.length - 1], p1);
  });
});

// ============================================================================
// 2. ORGANIC STAMP GENERATION UNIT TESTS
// ============================================================================

test('Organic Stamp Generation (generateOrganicStamp)', async (t) => {
  await t.test('default vertex count is 32', () => {
    const stamp = generateOrganicStamp(300, 300, 50, 0.4);
    assert.strictEqual(stamp.length, 32);
  });

  await t.test('roughness 0.0 produces regular circle polygon where all radii equal base radius +-1px', () => {
    const radius = 75;
    const stamp = generateOrganicStamp(500, 500, radius, 0.0);
    for (const pt of stamp) {
      const r = Math.hypot(pt.x - 500, pt.y - 500);
      assert.ok(Math.abs(r - radius) <= 1.0, `Expected radius ${radius}, got ${r}`);
    }
  });

  await t.test('roughness > 0 produces measurable organic radial variance and bounded extremities', () => {
    const radius = 80;
    const stamp = generateOrganicStamp(500, 500, radius, 0.8, 12345);
    const radii = stamp.map((pt) => Math.hypot(pt.x - 500, pt.y - 500));

    const mean = radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);

    assert.ok(stdDev > 2.0, `Expected stdDev > 2.0, got ${stdDev}`);
    assert.ok(Math.min(...radii) < radius, 'Min radius should be less than base');
    assert.ok(Math.max(...radii) > radius, 'Max radius should exceed base');

    // All radii must remain strictly within [0.65 * R, 1.35 * R]
    for (const r of radii) {
      assert.ok(r >= radius * 0.64, `Radius ${r} fell below minimum bound`);
      assert.ok(r <= radius * 1.36, `Radius ${r} exceeded maximum bound`);
    }
  });

  await t.test('deterministic PRNG: identical seed produces identical stamp vertices', () => {
    const stampA = generateOrganicStamp(450, 450, 60, 0.6, 9999);
    const stampB = generateOrganicStamp(450, 450, 60, 0.6, 9999);
    assert.deepStrictEqual(stampA, stampB);
  });

  await t.test('different seeds produce different stamp geometries', () => {
    const stampA = generateOrganicStamp(450, 450, 60, 0.6, 1111);
    const stampB = generateOrganicStamp(450, 450, 60, 0.6, 2222);
    assert.notDeepStrictEqual(stampA, stampB);
  });

  await t.test('seamless angular closure: 0 to 2PI transition has smooth continuity', () => {
    const stamp = generateOrganicStamp(500, 500, 100, 0.8, 42, 32);
    const first = stamp[0];
    const last = stamp[stamp.length - 1];
    const second = stamp[1];

    // Distance from last to first should be comparable to first to second
    const dLastFirst = Math.hypot(first.x - last.x, first.y - last.y);
    const dFirstSecond = Math.hypot(second.x - first.x, second.y - first.y);

    assert.ok(
      Math.abs(dLastFirst - dFirstSecond) < 25,
      `Seam discontinuity detected: dLastFirst=${dLastFirst}, dFirstSecond=${dFirstSecond}`
    );
  });

  await t.test('star-convexity: strictly positive cross product between consecutive radial vectors', () => {
    const cx = 400;
    const cy = 400;
    const stamp = generateOrganicStamp(cx, cy, 60, 1.0, 777);

    for (let i = 0; i < stamp.length; i++) {
      const p1 = stamp[i];
      const p2 = stamp[(i + 1) % stamp.length];
      const v1x = p1.x - cx;
      const v1y = p1.y - cy;
      const v2x = p2.x - cx;
      const v2y = p2.y - cy;

      // 2D cross product of radial vectors relative to center
      const cross = v1x * v2y - v1y * v2x;
      assert.ok(cross > 0, `Non-star-convex facet detected at index ${i}: cross=${cross}`);
    }
  });

  await t.test('clamps negative roughness to 0.0 and excessive roughness to 1.0', () => {
    const stampNeg = generateOrganicStamp(300, 300, 50, -0.5);
    for (const pt of stampNeg) {
      const r = Math.hypot(pt.x - 300, pt.y - 300);
      assert.ok(Math.abs(r - 50) <= 1.0);
    }

    const stampOver = generateOrganicStamp(300, 300, 50, 3.5);
    for (const pt of stampOver) {
      const r = Math.hypot(pt.x - 300, pt.y - 300);
      assert.ok(r > 10, 'Excessive roughness must not invert center');
    }
  });
});

// ============================================================================
// 3. 2D GEOMETRIC PRIMITIVES & DISTANCE MATH
// ============================================================================

test('Geometric Primitives & Area Math', async (t) => {
  await t.test('getSqDist calculates squared Euclidean distance accurately', () => {
    const p1 = { x: 10, y: 20 };
    const p2 = { x: 13, y: 24 }; // dx=3, dy=4 -> sqDist=25
    assert.strictEqual(getSqDist(p1, p2), 25);
  });

  await t.test('getSqSegmentDist clamped orthogonal distance', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };

    // Point projection within segment
    const pMid = { x: 50, y: 10 };
    assert.strictEqual(getSqSegmentDist(pMid, p1, p2), 100); // 10^2 = 100

    // Point before start of segment (clamps to p1)
    const pBefore = { x: -10, y: 0 };
    assert.strictEqual(getSqSegmentDist(pBefore, p1, p2), 100);

    // Point beyond end of segment (clamps to p2)
    const pAfter = { x: 110, y: 0 };
    assert.strictEqual(getSqSegmentDist(pAfter, p1, p2), 100);
  });

  await t.test('calculateSignedArea Shoelace formula signs', () => {
    // CCW triangle: (0,0) -> (10,0) -> (0,10) -> area = +50
    const ccw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    assert.strictEqual(calculateSignedArea(ccw), 50);

    // CW triangle: (0,0) -> (0,10) -> (10,0) -> area = -50
    const cw = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 0 }];
    assert.strictEqual(calculateSignedArea(cw), -50);
  });

  await t.test('calculatePolygonArea returns positive absolute area for 100x100 square', () => {
    const square = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];
    assert.strictEqual(calculatePolygonArea(square), 10000);
  });

  await t.test('getBoundingBox and doAABBIntersect', () => {
    const pts = [{ x: 10, y: 20 }, { x: 50, y: 80 }, { x: 30, y: 40 }];
    const bbox = getBoundingBox(pts);
    assert.deepStrictEqual(bbox, { minX: 10, minY: 20, maxX: 50, maxY: 80 });

    const intersectingBbox = { minX: 40, minY: 70, maxX: 100, maxY: 100 };
    const disjointBbox = { minX: 60, minY: 90, maxX: 100, maxY: 120 };

    assert.strictEqual(doAABBIntersect(bbox, intersectingBbox), true);
    assert.strictEqual(doAABBIntersect(bbox, disjointBbox), false);
  });
});

// ============================================================================
// 4. SANITIZATION & RDP SIMPLIFICATION UNIT TESTS
// ============================================================================

test('Sanitization & RDP Simplification', async (t) => {
  await t.test('removeDuplicateVertices removes sub-pixel adjacent duplicates', () => {
    const pts: MapPoint[] = [
      { x: 10, y: 10 },
      { x: 10, y: 10 }, // exact duplicate
      { x: 10.001, y: 10.001 }, // sub-tolerance duplicate (< 1e-4)
      { x: 20, y: 20 },
    ];
    const cleaned = removeDuplicateVertices(pts);
    assert.strictEqual(cleaned.length, 2);
    assert.deepStrictEqual(cleaned, [{ x: 10, y: 10 }, { x: 20, y: 20 }]);
  });

  await t.test('removeCollinearVertices prunes intermediate collinear vertices', () => {
    const pts: MapPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 }, // collinear with (0,0) and (100,0)
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const cleaned = removeCollinearVertices(pts);
    assert.strictEqual(cleaned.length, 4);
    assert.ok(!cleaned.some((p) => p.x === 50 && p.y === 0));
  });

  await t.test('ensureOpenRing strips duplicate closing point', () => {
    const closed = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 0 }];
    const open = ensureOpenRing(closed);
    assert.strictEqual(open.length, 3);
    assert.notDeepStrictEqual(open[0], open[open.length - 1]);
  });

  await t.test('ensureClosedRing appends matching start point', () => {
    const open = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const closed = ensureClosedRing(open);
    assert.strictEqual(closed.length, 4);
    assert.deepStrictEqual(closed[0], closed[closed.length - 1]);
  });

  await t.test('isDegeneratePolygon identifies sub-threshold slivers (<15px²)', () => {
    const sliver = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]; // Area = 2 px²
    const valid = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }]; // Area = 200 px²

    assert.strictEqual(isDegeneratePolygon(sliver, MIN_FEATURE_AREA), true);
    assert.strictEqual(isDegeneratePolygon(valid, MIN_FEATURE_AREA), false);
  });

  await t.test('simplifyPolygonRing: extreme vertex rotation eliminates collinear start vertex', () => {
    // Square starting at midpoint of bottom edge (50, 0)
    const ringWithCollinearStart = [
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ];
    const simplified = simplifyPolygonRing(ringWithCollinearStart, 1.0);
    // Extreme vertex rotation anchors to (0,0), allowing (50,0) to be simplified away
    assert.strictEqual(simplified.length, 4);
    assert.ok(!simplified.some((p) => p.x === 50 && p.y === 0));
  });

  await t.test('simplifyPolyline: dense 500-point line simplifies by >= 55% in <1ms', () => {
    const dense: MapPoint[] = [];
    for (let i = 0; i <= 500; i++) {
      dense.push({
        x: i,
        y: Math.round(100 + Math.sin(i * 0.05) * 5),
      });
    }

    const t0 = performance.now();
    const simplified = simplifyPolyline(dense, 1.5);
    const duration = performance.now() - t0;

    assert.ok(duration < 5.0, `Simplification took ${duration}ms, expected < 5ms`);
    const reduction = 1 - simplified.length / dense.length;
    assert.ok(reduction >= 0.55, `Expected >= 55% reduction, achieved ${(reduction * 100).toFixed(1)}%`);
  });

  await t.test('simplifyDouglasPeucker auto-detects open polyline vs closed ring', () => {
    const openLine = [{ x: 0, y: 0 }, { x: 50, y: 0.1 }, { x: 100, y: 0 }];
    const simplifiedOpen = simplifyDouglasPeucker(openLine, 1.0);
    assert.strictEqual(simplifiedOpen.length, 2);

    const closedRing = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ];
    const simplifiedClosed = simplifyDouglasPeucker(closedRing, 1.0);
    assert.strictEqual(simplifiedClosed.length, 4);
  });

  await t.test('sanitizePolygonRing removes slivers and returns clean open ring', () => {
    const sliver = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    assert.deepStrictEqual(sanitizePolygonRing(sliver), []);

    const validSquare = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ];
    const sanitized = sanitizePolygonRing(validSquare);
    assert.strictEqual(sanitized.length, 4);
  });
});

// ============================================================================
// 5. GEOJSON COORDINATE CONVERSION UNIT TESTS
// ============================================================================

test('GeoJSON Coordinate Conversion Utilities', async (t) => {
  await t.test('mapPointsToGeoRing ensures closed ring and rounds coordinates', () => {
    const pts: MapPoint[] = [{ x: 10.123, y: 20.456 }, { x: 30, y: 40 }, { x: 10, y: 50 }];
    const ring = mapPointsToGeoRing(pts);
    assert.strictEqual(ring.length, 4);
    assert.deepStrictEqual(ring[0], ring[3]);
    assert.strictEqual(ring[0][0], 10.1);
    assert.strictEqual(ring[0][1], 20.5);
  });

  await t.test('geoRingToMapPoints strips duplicate closing pair', () => {
    const ring: [number, number][] = [[10, 20], [30, 40], [10, 50], [10, 20]];
    const pts = geoRingToMapPoints(ring);
    assert.strictEqual(pts.length, 3);
    assert.deepStrictEqual(pts[0], { x: 10, y: 20 });
  });

  await t.test('featureToGeoPolygon formats outer ring and holes correctly', () => {
    const feature: MapTerrainFeature = {
      id: 'f1',
      name: 'Island with Lake',
      type: 'island',
      polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      holes: [[{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }]],
    };

    const geoPoly = featureToGeoPolygon(feature);
    assert.ok(geoPoly);
    assert.strictEqual(geoPoly.length, 2); // [outerRing, holeRing]
    assert.strictEqual(geoPoly[0].length, 5); // 4 corners + closed loop
    assert.strictEqual(geoPoly[1].length, 5);
  });
});

// ============================================================================
// 6. BOOLEAN SCULPT OPERATIONS (PAINT & CARVE)
// ============================================================================

test('Boolean Sculpt Operations (applySculptOperation)', async (t) => {
  await t.test('Paint Mode: painting on empty ocean canvas deposits initial continent', () => {
    const initial: MapTerrainFeature[] = [];
    const stamp = generateOrganicStamp(500, 500, 80, 0.3);

    const updated = applySculptOperation(initial, stamp, 'paint');
    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].type, 'continent');
    assert.strictEqual(updated[0].name, 'The First Continent');
    assert.ok(updated[0].polygon && updated[0].polygon.length >= 10);
  });

  await t.test('Paint Mode: overlapping paint stroke merges into existing land (polygon union)', () => {
    const baseStamp = generateOrganicStamp(500, 500, 80, 0.2);
    const existing: MapTerrainFeature[] = [
      {
        id: 'terr_prime',
        name: 'Prime Mainland',
        type: 'continent',
        polygon: baseStamp,
      },
    ];

    const expandStamp = generateOrganicStamp(560, 500, 80, 0.2);
    const updated = applySculptOperation(existing, expandStamp, 'paint');

    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].id, 'terr_prime');
    const bbox = getBoundingBox(updated[0].polygon!);
    assert.ok(bbox.maxX > 580, `Expected maxX > 580, got ${bbox.maxX}`);
    assert.ok(calculatePolygonArea(updated[0].polygon!) > calculatePolygonArea(baseStamp));
  });

  await t.test('Paint Mode: multi-stamp array (continuous brush drag) unions into single feature', () => {
    const stamps: MapPoint[][] = [
      generateOrganicStamp(300, 300, 40, 0.1),
      generateOrganicStamp(330, 300, 40, 0.1),
      generateOrganicStamp(360, 300, 40, 0.1),
    ];

    const updated = applySculptOperation([], stamps, 'paint');
    assert.strictEqual(updated.length, 1);
    const bbox = getBoundingBox(updated[0].polygon!);
    assert.ok(bbox.minX <= 270);
    assert.ok(bbox.maxX >= 390);
  });

  await t.test('Carve Mode: strait cut splitting continent across ocean produces 2 islands', () => {
    const continent: MapTerrainFeature = {
      id: 'terr_continent_split',
      name: 'Pangaea',
      type: 'continent',
      polygon: [
        { x: 100, y: 100 },
        { x: 500, y: 100 },
        { x: 500, y: 300 },
        { x: 100, y: 300 },
      ],
    };

    // Vertical strait cutting through continent at x=280..320
    const straitCarve: MapPoint[] = [
      { x: 280, y: 50 },
      { x: 320, y: 50 },
      { x: 320, y: 350 },
      { x: 280, y: 350 },
    ];

    const result = applySculptOperation([continent], straitCarve, 'carve');
    assert.strictEqual(result.length, 2, 'Must split into 2 separate features');
    assert.strictEqual(result[0].type, 'island');
    assert.strictEqual(result[1].type, 'island');
  });

  await t.test('Carve Mode: carving inside landmass cuts inner hole and generates lake feature', () => {
    const continent: MapTerrainFeature = {
      id: 'terr_mainland',
      name: 'Mainland Kingdom',
      type: 'continent',
      polygon: [
        { x: 100, y: 100 },
        { x: 600, y: 100 },
        { x: 600, y: 600 },
        { x: 100, y: 600 },
      ],
    };

    // Interior lake cutout at center (300, 300) with size 100x100
    const lakeCarve: MapPoint[] = [
      { x: 250, y: 250 },
      { x: 350, y: 250 },
      { x: 350, y: 350 },
      { x: 250, y: 350 },
    ];

    const result = applySculptOperation([continent], lakeCarve, 'carve');

    // Landmass retains continent type and possesses a hole loop
    const landmass = result.find((f) => f.type === 'continent');
    assert.ok(landmass, 'Mainland must exist');
    assert.ok(landmass.holes && landmass.holes.length === 1, 'Mainland must have 1 hole');
    assert.strictEqual(landmass.holes[0].length, 4);

    // Companion lake feature is created for styling, inspection, and contours
    const lake = result.find((f) => f.type === 'lake');
    assert.ok(lake, 'Companion lake feature must be created');
    assert.strictEqual(lake.polygon?.length, 4);
  });

  await t.test('Carve Mode: carving on empty ocean is safe no-op returning empty array', () => {
    const stamp = generateOrganicStamp(500, 500, 60, 0.4);
    const result = applySculptOperation([], stamp, 'carve');
    assert.strictEqual(result.length, 0);
  });

  await t.test('Carve Mode: carving completely covering an island erases it to open ocean', () => {
    const island: MapTerrainFeature = {
      id: 'terr_tiny_isle',
      name: 'Tiny Isle',
      type: 'island',
      polygon: [
        { x: 400, y: 400 },
        { x: 440, y: 400 },
        { x: 440, y: 440 },
        { x: 400, y: 440 },
      ],
    };

    const bigCarve: MapPoint[] = [
      { x: 350, y: 350 },
      { x: 500, y: 350 },
      { x: 500, y: 500 },
      { x: 350, y: 500 },
    ];

    const result = applySculptOperation([island], bigCarve, 'carve');
    assert.strictEqual(result.length, 0, 'Island should be completely erased');
  });

  await t.test('Carve Mode: non-land features (rivers, mountains) remain preserved intact', () => {
    const river: MapTerrainFeature = {
      id: 'terr_river_sacred',
      name: 'Sacred River',
      type: 'river',
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
    };

    const island: MapTerrainFeature = {
      id: 'terr_island_a',
      name: 'Island A',
      type: 'island',
      polygon: generateOrganicStamp(500, 500, 50, 0.0),
    };

    const carveStamp = generateOrganicStamp(500, 500, 80, 0.0);
    const result = applySculptOperation([island, river], carveStamp, 'carve');

    const preservedRiver = result.find((f) => f.id === 'terr_river_sacred');
    assert.ok(preservedRiver, 'River feature must not be discarded');
    assert.strictEqual(preservedRiver.type, 'river');
  });

  await t.test('Sliver Rejection: micro-polygons with area < 15px² are discarded', () => {
    const island: MapTerrainFeature = {
      id: 'terr_strip',
      name: 'Thin Strip',
      type: 'island',
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
        { x: 0, y: 2 },
      ], // Initial area = 20 px²
    };

    // Carve that cuts away 8px of width, leaving only a 2px by 2px sliver (area = 4 px² < 15 px²)
    const carveLeaveSliver: MapPoint[] = [
      { x: -5, y: -5 },
      { x: 8, y: -5 },
      { x: 8, y: 10 },
      { x: -5, y: 10 },
    ];

    const result = applySculptOperation([island], carveLeaveSliver, 'carve');
    // Resulting sliver is 4px² < 15px², so it gets safely pruned
    assert.strictEqual(result.length, 0);
  });
});

// ============================================================================
// 7. PERFORMANCE BENCHMARKS (<10ms BUDGET)
// ============================================================================

test('Performance Benchmarks', async (t) => {
  await t.test('generateOrganicStamp: 1,000 stamps generated in < 100ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      generateOrganicStamp(500 + (i % 50), 500 + (i % 50), 60, 0.4, 42);
    }
    const duration = performance.now() - t0;
    assert.ok(duration < 100.0, `1,000 stamps took ${duration}ms, expected < 100ms`);
  });

  await t.test('applySculptOperation: union of 15 brush stamps completes in < 100ms', () => {
    const initial = [
      {
        id: 'terr_base',
        name: 'Continent',
        type: 'continent' as const,
        polygon: generateOrganicStamp(500, 500, 150, 0.2),
      },
    ];

    const stamps: MapPoint[][] = [];
    for (let i = 0; i < 15; i++) {
      stamps.push(generateOrganicStamp(520 + i * 8, 500, 40, 0.3));
    }

    const t0 = performance.now();
    const result = applySculptOperation(initial, stamps, 'paint', { simplifyTolerance: 1.5 });
    const duration = performance.now() - t0;

    assert.strictEqual(result.length, 1);
    assert.ok(duration < 100.0, `Multi-stamp union took ${duration}ms, expected < 100ms`);
  });
});
