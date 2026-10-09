/**
 * landSculptEngine.adversarial.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for landSculptEngine.ts.
 * Authored by Challenger M1-1 (critic & specialist).
 *
 * Stress Test Dimensions:
 *   1. Zero, negative, NaN, Infinity, and degenerate parameters
 *   2. Rapid pointer jumps and extreme spatial discontinuities
 *   3. Massive radii and extreme scale boundaries
 *   4. Chaotic carving, fractal slicing, and severe polygon fragmentation
 *   5. Multiple nested holes, Russian doll islands/lakes, and topological edge cases
 *   6. Memory leak detection, noise cache growth, and latency under vertex pressure
 *   7. EMPIRICAL BUG REPRODUCTION & ADVERSARIAL REGRESSIONS (Infinite loop, lake deletion, identity theft)
 *
 * Runner: npx tsx --test src/lib/engines/world/landSculptEngine.adversarial.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  interpolateStrokePoints,
  generateOrganicStamp,
  getNoiseFunction,
  getNoiseCacheSize,
  MAX_NOISE_CACHE_SIZE,
  MAX_INTERPOLATION_STEPS,
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

// Helper to create a regular polygon ring
function createSquarePolygon(x: number, y: number, size: number): MapPoint[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

// Helper to create a landmass feature
function createLandFeature(
  id: string,
  polygon: MapPoint[],
  holes?: MapPoint[][],
  type: 'continent' | 'island' = 'continent'
): MapTerrainFeature {
  return {
    id,
    name: `Landmass ${id}`,
    type,
    color: '#d4c5a9',
    polygon,
    holes,
    climateZone: 'temperate',
  };
}

// Helper to verify that no points contain NaN or Infinity
function assertValidPoints(points: MapPoint[], context: string) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    assert.ok(
      Number.isFinite(p.x) && !Number.isNaN(p.x),
      `[${context}] Point index ${i} has invalid x: ${p.x}`
    );
    assert.ok(
      Number.isFinite(p.y) && !Number.isNaN(p.y),
      `[${context}] Point index ${i} has invalid y: ${p.y}`
    );
  }
}

// Helper to verify feature polygon invariants
function assertValidFeatureGeometry(features: MapTerrainFeature[], context: string) {
  for (const f of features) {
    if (f.polygon) {
      assert.ok(f.polygon.length >= 3, `[${context}] Feature ${f.id} has polygon length < 3: ${f.polygon.length}`);
      assertValidPoints(f.polygon, `${context} - ${f.id} outer`);
      const area = calculatePolygonArea(f.polygon);
      assert.ok(area > 0, `[${context}] Feature ${f.id} outer polygon area must be > 0, got ${area}`);
    }
    if (f.holes) {
      for (let h = 0; h < f.holes.length; h++) {
        const hole = f.holes[h];
        assert.ok(hole.length >= 3, `[${context}] Feature ${f.id} hole ${h} has length < 3: ${hole.length}`);
        assertValidPoints(hole, `${context} - ${f.id} hole ${h}`);
        const holeArea = calculatePolygonArea(hole);
        assert.ok(holeArea > 0, `[${context}] Feature ${f.id} hole ${h} area must be > 0, got ${holeArea}`);
      }
    }
  }
}

// ============================================================================
// 1. ADVERSARIAL STRESS: ZERO, NEGATIVE, NAN & EXTREME PARAMETERS
// ============================================================================

test('Adversarial Dimension 1: Degenerate, Zero, Negative, and NaN Parameters', async (t) => {
  await t.test('interpolateStrokePoints with stepSize = 0, negative, and NaN', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 100 };

    // stepSize = 0 (should fallback to safe default or 1, not divide by zero or infinite loop)
    const ptsZero = interpolateStrokePoints(p0, p1, 0);
    assert.ok(ptsZero.length > 0, 'stepSize=0 should yield valid points');
    assertValidPoints(ptsZero, 'stepSize=0');

    // stepSize = -10 (should be clamped to >= 1)
    const ptsNeg = interpolateStrokePoints(p0, p1, -10);
    assert.ok(ptsNeg.length > 0, 'stepSize=-10 should yield valid points');
    assertValidPoints(ptsNeg, 'stepSize=-10');

    // stepSize = NaN
    const ptsNaN = interpolateStrokePoints(p0, p1, NaN);
    assert.ok(ptsNaN.length > 0, 'stepSize=NaN should fallback safely');
    assertValidPoints(ptsNaN, 'stepSize=NaN');

    // p0 with NaN coordinates
    const ptsP0NaN = interpolateStrokePoints({ x: NaN, y: 0 }, p1, 10);
    assert.ok(Array.isArray(ptsP0NaN), 'NaN input returns array without crashing');
  });

  await t.test('generateOrganicStamp with zero, negative, NaN, and extreme parameters', () => {
    // Zero radius
    const stampZeroR = generateOrganicStamp(100, 100, 0, 0.5);
    assert.ok(stampZeroR.length >= 24, 'Zero radius produces minimum valid vertices');
    assertValidPoints(stampZeroR, 'zero radius');

    // Negative radius (-500)
    const stampNegR = generateOrganicStamp(100, 100, -500, 0.5);
    assert.ok(stampNegR.length >= 24, 'Negative radius produces minimum valid vertices');
    assertValidPoints(stampNegR, 'negative radius');

    // Negative roughness (-2.0)
    const stampNegRough = generateOrganicStamp(100, 100, 50, -2.0);
    assert.ok(stampNegRough.length >= 24, 'Negative roughness clamps cleanly');
    assertValidPoints(stampNegRough, 'negative roughness');

    // Extreme roughness (500.0)
    const stampHugeRough = generateOrganicStamp(100, 100, 50, 500.0);
    assert.ok(stampHugeRough.length >= 24, 'Extreme roughness clamps to 1.0');
    assertValidPoints(stampHugeRough, 'huge roughness');

    // Degenerate vertexCount (-10, 0, 1000, NaN)
    const stampNegCount = generateOrganicStamp(100, 100, 50, 0.5, 42, -10);
    assert.strictEqual(stampNegCount.length, 24, 'Negative vertexCount clamps to min 24');

    const stampHugeCount = generateOrganicStamp(100, 100, 50, 0.5, 42, 5000);
    assert.strictEqual(stampHugeCount.length, 64, 'Excessive vertexCount clamps to max 64');

    const stampNaNCount = generateOrganicStamp(100, 100, 50, 0.5, 42, NaN);
    assert.strictEqual(stampNaNCount.length, 32, 'NaN vertexCount falls back to default 32');
  });

  await t.test('simplifyPolyline and simplifyPolygonRing with negative and extreme tolerance', () => {
    const ring = createSquarePolygon(0, 0, 100);

    // Epsilon = 0
    const simpZero = simplifyPolygonRing(ring, 0);
    assert.ok(simpZero.length >= 3, 'Zero epsilon preserves polygon');
    assertValidPoints(simpZero, 'epsilon=0');

    // Epsilon = -10
    const simpNeg = simplifyPolygonRing(ring, -10);
    assert.ok(simpNeg.length >= 3, 'Negative epsilon does not crash');
    assertValidPoints(simpNeg, 'epsilon=-10');

    // Epsilon = 100,000 (massive simplification)
    const simpHuge = simplifyPolygonRing(ring, 100000);
    assert.ok(simpHuge.length >= 3, 'Massive epsilon does not drop below 3 vertices');
    assertValidPoints(simpHuge, 'epsilon=100000');

    // Epsilon = NaN
    const simpNaN = simplifyPolygonRing(ring, NaN);
    assert.ok(simpNaN.length >= 3, 'NaN epsilon does not crash');
    assertValidPoints(simpNaN, 'epsilon=NaN');
  });

  await t.test('applySculptOperation with extreme options: negative/zero minArea and minHoleArea', () => {
    const baseLand = [createLandFeature('base', createSquarePolygon(0, 0, 300))];
    const cut = createSquarePolygon(50, 50, 50);

    // Extreme zero / negative thresholds
    const res = applySculptOperation(baseLand, cut, 'carve', {
      simplifyTolerance: -1,
      minArea: -100,
      minHoleArea: -100,
    });
    assertValidFeatureGeometry(res, 'negative thresholds carve');
    assert.ok(res.length >= 1, 'Carve with negative thresholds succeeds');
  });
});

// ============================================================================
// 2. ADVERSARIAL STRESS: RAPID POINTER JUMPS & SPATIAL DISCONTINUITIES
// ============================================================================

test('Adversarial Dimension 2: Rapid Pointer Jumps and Teleportation', async (t) => {
  await t.test('pointer teleportation across 10,000 pixels does not hang or overflow', () => {
    const start = performance.now();
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 10000, y: 10000 }; // ~14,142 px distance
    const stepSize = 15;

    const points = interpolateStrokePoints(p0, p1, stepSize);
    const duration = performance.now() - start;

    assert.ok(points.length > 900, `Expected > 900 points, got ${points.length}`);
    assert.ok(duration < 50, `Interpolation took too long: ${duration.toFixed(2)}ms`);
    assertValidPoints(points, 'rapid teleportation');
    assert.deepStrictEqual(points[0], p0);
    assert.deepStrictEqual(points[points.length - 1], p1);
  });

  await t.test('rapid zigzag jump strokes through sculpt engine execute without memory or geometry corruption', () => {
    // Simulate mouse erratic jumping back and forth across canvas 20 times
    const jumps: MapPoint[] = [];
    for (let i = 0; i < 20; i++) {
      jumps.push({ x: i % 2 === 0 ? 50 : 800, y: i * 40 });
    }

    // Accumulate all interpolated points
    const strokePolygons: MapPoint[][] = [];
    for (let i = 0; i < jumps.length - 1; i++) {
      const subPoints = interpolateStrokePoints(jumps[i], jumps[i + 1], 60);
      for (const pt of subPoints) {
        strokePolygons.push(generateOrganicStamp(pt.x, pt.y, 40, 0.4, i));
      }
    }

    assert.ok(strokePolygons.length > 50, `Accumulated ${strokePolygons.length} stamps`);

    const t0 = performance.now();
    const painted = applySculptOperation([], strokePolygons, 'paint');
    const tPaint = performance.now() - t0;

    assertValidFeatureGeometry(painted, 'rapid jump painting');
    assert.ok(tPaint < 400, `Paint operation took ${tPaint.toFixed(2)}ms (expected < 400ms)`);
  });

  await t.test('identical consecutive pointer coordinates (zero distance steps)', () => {
    const p = { x: 300, y: 300 };
    const pointsInclude = interpolateStrokePoints(p, p, 10, true);
    assert.strictEqual(pointsInclude.length, 1);
    assert.deepStrictEqual(pointsInclude[0], p);

    const pointsExclude = interpolateStrokePoints(p, p, 10, false);
    assert.strictEqual(pointsExclude.length, 0);
  });
});

// ============================================================================
// 3. ADVERSARIAL STRESS: MASSIVE RADII & EXTREME COORDINATE BOUNDARIES
// ============================================================================

test('Adversarial Dimension 3: Massive Radii and Scale Boundaries', async (t) => {
  await t.test('massive stamp radius (50,000 px) does not produce invalid geometry or overflow', () => {
    const hugeStamp = generateOrganicStamp(0, 0, 50000, 0.5, 999);
    assertValidPoints(hugeStamp, 'huge stamp 50000px');
    const area = calculatePolygonArea(hugeStamp);
    assert.ok(area > 1e9, `Expected massive area, got ${area}`);

    // Paint massive continent
    const painted = applySculptOperation([], hugeStamp, 'paint');
    assert.strictEqual(painted.length, 1);
    assertValidFeatureGeometry(painted, 'massive continent');
    assert.strictEqual(painted[0].type, 'continent');
  });

  await t.test('microscopic stamp radius (0.001 px) filtered out cleanly as sliver', () => {
    const tinyStamp = generateOrganicStamp(100, 100, 0.001, 0.0);
    // Even though stamp clamps radius to 1, area of circle with r=1 is ~pi (3.14 px²)
    // Which is < MIN_FEATURE_AREA (15 px²)
    const painted = applySculptOperation([], tinyStamp, 'paint');
    assert.strictEqual(painted.length, 0, 'Microscopic stamp below 15px² area must be discarded');
  });

  await t.test('extreme negative coordinates (-100,000, -100,000)', () => {
    const farStamp = generateOrganicStamp(-100000, -100000, 100, 0.3, 123);
    assertValidPoints(farStamp, 'negative coordinates stamp');

    const painted = applySculptOperation([], farStamp, 'paint');
    assert.strictEqual(painted.length, 1);
    assertValidFeatureGeometry(painted, 'negative coordinates painted');
  });
});

// ============================================================================
// 4. ADVERSARIAL STRESS: CHAOTIC CARVING & SEVERE FRAGMENTATION
// ============================================================================

test('Adversarial Dimension 4: Chaotic Carving and Severe Fragmentation', async (t) => {
  await t.test('criss-cross grid cuts fragmenting continent into multiple archipelago islands', () => {
    // Create large 800x800 continent
    const continent = createLandFeature('cont_archipelago', createSquarePolygon(0, 0, 800));

    // Carve 3 vertical channels and 3 horizontal channels (creating 4x4 = 16 islands)
    const cuts: MapPoint[][] = [];
    // Vertical channels at x=180..220, 380..420, 580..620
    for (const cx of [200, 400, 600]) {
      cuts.push([
        { x: cx - 20, y: -50 },
        { x: cx + 20, y: -50 },
        { x: cx + 20, y: 850 },
        { x: cx - 20, y: 850 },
      ]);
    }
    // Horizontal channels at y=180..220, 380..420, 580..620
    for (const cy of [200, 400, 600]) {
      cuts.push([
        { x: -50, y: cy - 20 },
        { x: 850, y: cy - 20 },
        { x: 850, y: cy + 20 },
        { x: -50, y: cy + 20 },
      ]);
    }

    const t0 = performance.now();
    const result = applySculptOperation([continent], cuts, 'carve');
    const duration = performance.now() - t0;

    // Should produce 16 disjoint island pieces
    const islands = result.filter((f) => f.type === 'continent' || f.type === 'island');
    assert.strictEqual(islands.length, 16, `Expected exactly 16 islands, got ${islands.length}`);
    assertValidFeatureGeometry(result, 'criss-cross carving');
    assert.ok(duration < 50, `Archipelago fragmentation took ${duration.toFixed(2)}ms (expected < 50ms)`);

    // Verify all island IDs are unique
    const idSet = new Set(result.map((f) => f.id));
    assert.strictEqual(idSet.size, result.length, 'All resulting feature IDs must be unique');
  });

  await t.test('eroding island from outside until completely vanished to zero area', () => {
    const smallIsland = createLandFeature('isle_erode', createSquarePolygon(100, 100, 60), undefined, 'island');

    // Carve completely engulfing the island
    const engulfingCut = createSquarePolygon(80, 80, 100);
    const result = applySculptOperation([smallIsland], engulfingCut, 'carve');

    // Should leave zero land features
    const landRemaining = result.filter((f) => f.type === 'continent' || f.type === 'island');
    assert.strictEqual(landRemaining.length, 0, 'Completely eroded island must yield 0 land features');
  });

  await t.test('tangential razor cuts touching continent perimeter without full split', () => {
    const continent = createLandFeature('cont_tangent', createSquarePolygon(0, 0, 400));
    // Cut shaving right on the edge x=390..410
    const edgeCut = [
      { x: 390, y: 100 },
      { x: 420, y: 100 },
      { x: 420, y: 300 },
      { x: 390, y: 300 },
    ];

    const result = applySculptOperation([continent], edgeCut, 'carve');
    assertValidFeatureGeometry(result, 'tangential perimeter carve');
    assert.ok(result.length >= 1);
  });
});

// ============================================================================
// 5. ADVERSARIAL STRESS: MULTIPLE NESTED HOLES & TOPOLOGICAL INTEGRITY
// ============================================================================

test('Adversarial Dimension 5: Multiple Nested Holes and Topological Stress', async (t) => {
  await t.test('carving 5 distinct interior lakes inside a single continent', () => {
    const continent = createLandFeature('cont_multi_lakes', createSquarePolygon(0, 0, 1000));

    // Carve 5 non-overlapping circular lakes
    const lakeStamps: MapPoint[][] = [
      generateOrganicStamp(200, 200, 60, 0.2, 1),
      generateOrganicStamp(200, 800, 60, 0.2, 2),
      generateOrganicStamp(800, 200, 60, 0.2, 3),
      generateOrganicStamp(800, 800, 60, 0.2, 4),
      generateOrganicStamp(500, 500, 80, 0.2, 5),
    ];

    const result = applySculptOperation([continent], lakeStamps, 'carve');
    assertValidFeatureGeometry(result, '5 inland lakes');

    const land = result.find((f) => f.id === 'cont_multi_lakes');
    assert.ok(land, 'Primary continent retained');
    assert.ok(land.holes, 'Continent must have holes array');
    assert.strictEqual(land.holes.length, 5, `Expected 5 holes in continent, got ${land.holes.length}`);

    // Companion lake features
    const lakes = result.filter((f) => f.type === 'lake');
    assert.strictEqual(lakes.length, 5, `Expected 5 companion lake features, got ${lakes.length}`);
  });

  await t.test('Russian doll nesting: Island inside a lake inside a continent', () => {
    // Step 1: Base continent (0..1000)
    const continent = createLandFeature('cont_nest', createSquarePolygon(0, 0, 1000));

    // Step 2: Carve lake in center (300..700)
    const lakeCut = createSquarePolygon(300, 300, 400);
    const step2 = applySculptOperation([continent], lakeCut, 'carve');
    assertValidFeatureGeometry(step2, 'nesting step 2');

    // Step 3: Paint island inside the lake (450..550)
    const islandPaint = createSquarePolygon(450, 450, 100);
    const step3 = applySculptOperation(step2, islandPaint, 'paint');
    assertValidFeatureGeometry(step3, 'nesting step 3');

    // Check features in step 3
    const landPieces = step3.filter((f) => f.type === 'continent' || f.type === 'island');
    assert.ok(landPieces.length >= 2, `Expected continent + island in lake, got ${landPieces.length}`);

    // Step 4: Carve a tiny caldera lake inside the new center island!
    const tinyCalderaCut = createSquarePolygon(480, 480, 40);
    const step4 = applySculptOperation(step3, tinyCalderaCut, 'carve');
    assertValidFeatureGeometry(step4, 'nesting step 4 caldera');

    // Must not crash and maintain valid geometries
    const step4Land = step4.filter((f) => f.type === 'continent' || f.type === 'island');
    assert.ok(step4Land.length >= 2, `Expected >= 2 land pieces after caldera carve, got ${step4Land.length}`);
  });

  await t.test('painting over a pre-existing lake fills the hole cleanly', () => {
    // Create continent with an existing hole
    const continentWithHole = createLandFeature(
      'cont_fill_hole',
      createSquarePolygon(0, 0, 600),
      [createSquarePolygon(200, 200, 200)]
    );

    // Paint land directly over the hole (180..420)
    const fillStroke = createSquarePolygon(180, 180, 240);
    const result = applySculptOperation([continentWithHole], fillStroke, 'paint');

    assertValidFeatureGeometry(result, 'fill hole paint');
    const cont = result.find((f) => f.id === 'cont_fill_hole');
    assert.ok(cont);
    // Hole should now be completely filled
    assert.ok(!cont.holes || cont.holes.length === 0, 'Hole must be filled/erased');
  });
});

// ============================================================================
// 6. ADVERSARIAL STRESS: PERFORMANCE, MEMORY & SCALING STABILITY
// ============================================================================

test('Adversarial Dimension 6: Memory, Cache, and Scaling Stability', async (t) => {
  await t.test('noiseCache memory stability with 10,000 distinct seeds', () => {
    const initialHeap = process.memoryUsage().heapUsed;

    // Stress getNoiseFunction with 10,000 distinct seeds
    for (let i = 0; i < 10000; i++) {
      getNoiseFunction(i);
    }

    const finalHeap = process.memoryUsage().heapUsed;
    const heapDiffMB = (finalHeap - initialHeap) / 1024 / 1024;

    // 10,000 noise instances should stay within reasonable bounds (< 50MB) and noiseCache strictly capped to 64
    assert.ok(
      heapDiffMB < 50,
      `Heap growth of ${heapDiffMB.toFixed(2)}MB exceeds acceptable threshold of 50MB`
    );
    assert.ok(
      getNoiseCacheSize() <= MAX_NOISE_CACHE_SIZE,
      `noiseCache size ${getNoiseCacheSize()} must not exceed ${MAX_NOISE_CACHE_SIZE}`
    );
  });

  await t.test('100 sequential brush strokes on complex geometry maintain performance', () => {
    let currentFeatures: MapTerrainFeature[] = [
      createLandFeature('cont_stress', createSquarePolygon(100, 100, 500)),
    ];

    const durations: number[] = [];

    // Apply 50 sequential paint & carve operations
    for (let step = 0; step < 50; step++) {
      const isPaint = step % 3 !== 0;
      const x = 150 + (step * 7) % 400;
      const y = 150 + (step * 11) % 400;
      const stamp = generateOrganicStamp(x, y, 40, 0.3, step);

      const t0 = performance.now();
      currentFeatures = applySculptOperation(
        currentFeatures,
        stamp,
        isPaint ? 'paint' : 'carve',
        { simplifyTolerance: 1.5 }
      );
      durations.push(performance.now() - t0);
    }

    assertValidFeatureGeometry(currentFeatures, '50 sequential strokes');

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    // Average duration across complex multi-step operations should stay well below 25ms
    assert.ok(
      avgDuration < 20,
      `Average sculpt operation too slow: ${avgDuration.toFixed(2)}ms (budget < 20ms)`
    );
    assert.ok(
      maxDuration < 60,
      `Max sculpt operation spike too high: ${maxDuration.toFixed(2)}ms (budget < 60ms)`
    );
  });
});

// ============================================================================
// 7. EMPIRICAL BUG REPRODUCTION & ADVERSARIAL REGRESSIONS
// ============================================================================

test('Adversarial Dimension 7: Empirical Bug Reproduction & Adversarial Regressions', async (t) => {
  await t.test('interpolateStrokePoints guards against non-finite coordinates and caps steps at 2000', () => {
    // 1. Calling interpolateStrokePoints with Infinity terminates immediately and returns safe finite points
    const p0 = { x: 0, y: 0 };
    const p1 = { x: Infinity, y: 0 };
    const pointsInf = interpolateStrokePoints(p0, p1, 10);
    assert.ok(Array.isArray(pointsInf));
    assertValidPoints(pointsInf, 'interpolateStrokePoints with Infinity');

    // 2. NaN coordinates return safe finite points without hanging
    const pointsNaN = interpolateStrokePoints({ x: NaN, y: NaN }, { x: 100, y: 100 }, 10);
    assert.ok(Array.isArray(pointsNaN));
    assertValidPoints(pointsNaN, 'interpolateStrokePoints with NaN');

    // 3. Extreme jump distance caps steps to MAX_INTERPOLATION_STEPS (2000)
    const hugePoints = interpolateStrokePoints({ x: 0, y: 0 }, { x: 5000000, y: 0 }, 1);
    assert.ok(hugePoints.length <= 2001, `Expected <= 2001 points, got ${hugePoints.length}`);
    assertValidPoints(hugePoints, 'interpolateStrokePoints capped steps');
  });

  await t.test('applySculptOperation preserves standalone lake features from existingFeatures', () => {
    const existingFeatures: MapTerrainFeature[] = [
      createLandFeature('cont_1', createSquarePolygon(0, 0, 500)),
      {
        id: 'lake_ancient',
        name: 'Ancient Sacred Lake',
        type: 'lake',
        description: 'A holy lake created by the gods',
        color: '#0055aa',
        polygon: createSquarePolygon(100, 100, 100),
      },
      {
        id: 'mountains_1',
        name: 'Iron Peaks',
        type: 'mountain_range',
        polygon: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 50 },
        ],
      },
    ];

    // Paint island far away at (800, 800)
    const newPaint = createSquarePolygon(800, 800, 100);
    const result = applySculptOperation(existingFeatures, newPaint, 'paint');

    // Standalone lake is preserved
    const foundLake = result.find((f) => f.id === 'lake_ancient');
    assert.ok(foundLake, 'Standalone lake feature must be preserved in map data');
    assert.strictEqual(foundLake.name, 'Ancient Sacred Lake');
    assert.strictEqual(foundLake.description, 'A holy lake created by the gods');
    assert.strictEqual(foundLake.color, '#0055aa');

    // Mountains survived
    const foundMountains = result.find((f) => f.id === 'mountains_1');
    assert.ok(foundMountains, 'Mountains survived because f.type !== "lake"');
  });

  await t.test('applySculptOperation preserves existing lake ID, name, description, and styling for interior holes', () => {
    const lakeHole = createSquarePolygon(100, 100, 100);
    const existingFeatures: MapTerrainFeature[] = [
      {
        id: 'cont_1',
        name: 'Aethelgard',
        type: 'continent',
        polygon: createSquarePolygon(0, 0, 500),
        holes: [lakeHole],
      },
      {
        id: 'lake_ancient',
        name: 'Ancient Sacred Lake',
        type: 'lake',
        description: 'A holy lake created by the gods',
        color: '#0055aa',
        polygon: lakeHole,
      },
    ];

    // Paint stroke elsewhere on continent (450..550)
    const paintAddition = createSquarePolygon(450, 200, 100);
    const result = applySculptOperation(existingFeatures, paintAddition, 'paint');

    const preservedLake = result.find((f) => f.id === 'lake_ancient');
    assert.ok(preservedLake, 'Original lake ID must be preserved');
    assert.strictEqual(preservedLake.name, 'Ancient Sacred Lake', 'Custom lake name must be preserved');
    assert.strictEqual(preservedLake.color, '#0055aa', 'Custom color must be preserved');
    assert.strictEqual(preservedLake.description, 'A holy lake created by the gods', 'Custom description must be preserved');
  });

  await t.test('Russian Doll island in lake retains identity and outer continent preserves continent type', () => {
    const continent: MapTerrainFeature = {
      id: 'cont_outer',
      name: 'Outer Continent',
      type: 'continent',
      polygon: createSquarePolygon(0, 0, 1000),
      holes: [createSquarePolygon(200, 200, 600)],
    };

    const innerIsland: MapTerrainFeature = {
      id: 'isle_inner',
      name: 'Island of Avalon',
      type: 'island',
      polygon: createSquarePolygon(400, 400, 200),
    };

    // Carve channel splitting Avalon in half
    const cut = [
      { x: 480, y: 350 },
      { x: 520, y: 350 },
      { x: 520, y: 650 },
      { x: 480, y: 650 },
    ];

    const res = applySculptOperation([continent, innerIsland], cut, 'carve');

    // Inner island Avalon was preserved and not stolen
    const foundAvalon = res.find((f) => f.id === 'isle_inner' || f.name.includes('Avalon'));
    assert.ok(foundAvalon, 'Island of Avalon entity must be preserved');
    assert.ok(foundAvalon.name.includes('Avalon'), 'Avalon name must be retained');

    // Outer continent remained a continent
    const outerCont = res.find((f) => f.id === 'cont_outer');
    assert.ok(outerCont, 'Outer continent must exist');
    assert.strictEqual(outerCont.type, 'continent', '1,000,000 px² continent must remain a continent');
  });
});
