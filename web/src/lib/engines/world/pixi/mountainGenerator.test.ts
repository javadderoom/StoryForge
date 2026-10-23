import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateProceduralMountainRange,
  generateStandalonePeak,
  hashStringToSeed,
} from './mountainGenerator';

test('mountainGenerator: hashStringToSeed produces deterministic 32-bit positive integers', () => {
  const seed1 = hashStringToSeed('terr_mountains_north');
  const seed2 = hashStringToSeed('terr_mountains_north');
  const seed3 = hashStringToSeed('terr_mountains_south');

  assert.equal(seed1, seed2, 'Identical strings must generate identical seeds');
  assert.notEqual(seed1, seed3, 'Different strings should generate different seeds');
  assert.ok(seed1 > 0, 'Seed should be positive');
});

test('mountainGenerator: returns empty array for empty points', () => {
  const peaks = generateProceduralMountainRange([]);
  assert.deepEqual(peaks, []);
});

test('mountainGenerator: single point generates a single standalone peak', () => {
  const peaks = generateProceduralMountainRange([{ x: 200, y: 300 }], { scale: 50 });
  assert.equal(peaks.length, 1);
  assert.ok(peaks[0].apex.y < peaks[0].baseY, 'Apex should be above base');
  assert.ok(peaks[0].sunlitPoly.length >= 3, 'Sunlit poly should have at least 3 vertices');
  assert.ok(peaks[0].shadowPoly.length >= 3, 'Shadow poly should have at least 3 vertices');
});

test('mountainGenerator: multi-point polyline generates varied peaks strictly sorted by baseY', () => {
  const points = [
    { x: 100, y: 150 },
    { x: 250, y: 220 },
    { x: 400, y: 300 },
    { x: 550, y: 260 },
  ];

  const peaks = generateProceduralMountainRange(points, {
    seed: 12345,
    scale: 60,
    rangeWidth: 35,
  });

  assert.ok(peaks.length >= 4, `Should generate multiple peaks along spine, got ${peaks.length}`);

  // Check strict depth sorting (baseY ascending)
  for (let i = 0; i < peaks.length - 1; i++) {
    assert.ok(
      peaks[i].baseY <= peaks[i + 1].baseY,
      `Peaks must be sorted by baseY for 2.5D depth: peak[${i}].baseY (${peaks[i].baseY}) <= peak[${i + 1}].baseY (${peaks[i + 1].baseY})`
    );
  }

  // Check variation: peaks must NOT be identical!
  const heights = peaks.map((p) => p.scale);
  const uniqueHeights = new Set(heights.map((h) => Math.round(h)));
  assert.ok(
    uniqueHeights.size > 2,
    `Peaks must have diverse heights along the range, unique count: ${uniqueHeights.size}`
  );

  // Check facet geometry
  for (const p of peaks) {
    assert.ok(Number.isFinite(p.apex.x) && Number.isFinite(p.apex.y), 'Coordinates must be finite');
    assert.ok(p.apex.y < p.baseY, 'Apex must be higher than base');
    assert.ok(p.leftFoot.x < p.rightFoot.x, 'Left foot must be to left of right foot');
    assert.ok(p.cragSpine.length >= 2, 'Crag spine must connect apex to base');
  }
});

test('mountainGenerator: deterministic replay with same seed produces 100% identical peaks', () => {
  const points = [
    { x: 100, y: 200 },
    { x: 300, y: 250 },
    { x: 500, y: 200 },
  ];

  const run1 = generateProceduralMountainRange(points, { seed: 9999, scale: 50 });
  const run2 = generateProceduralMountainRange(points, { seed: 9999, scale: 50 });

  assert.equal(run1.length, run2.length);
  for (let i = 0; i < run1.length; i++) {
    assert.deepEqual(run1[i].apex, run2[i].apex);
    assert.deepEqual(run1[i].leftFoot, run2[i].leftFoot);
    assert.deepEqual(run1[i].rightFoot, run2[i].rightFoot);
    assert.deepEqual(run1[i].ridgeBase, run2[i].ridgeBase);
  }
});

test('mountainGenerator: generateStandalonePeak supports volcanoes with distinct attributes', () => {
  const volcano = generateStandalonePeak({ x: 450, y: 550 }, 40, 'volcano', 888);
  assert.equal(volcano.isVolcano, true);
  assert.equal(volcano.snowcapSunlitPoly, undefined, 'Volcanoes should not have standard snowcaps');
});

test('mountainGenerator: respects hasSnowcaps toggle and generates snowlinePath', () => {
  const points = [
    { x: 100, y: 300 },
    { x: 300, y: 300 },
    { x: 500, y: 300 },
  ];

  // With snowcaps enabled
  const withSnow = generateProceduralMountainRange(points, {
    seed: 42,
    scale: 60,
    hasSnowcaps: true,
  });
  const peaksWithSnow = withSnow.filter((p) => p.snowcapSunlitPoly && p.snowlinePath);
  assert.ok(peaksWithSnow.length > 0, 'High peaks should have snowcaps and snowlinePath');
  assert.ok(peaksWithSnow[0].snowlinePath!.length >= 4, 'snowlinePath should have jagged crag points');

  // With snowcaps disabled
  const withoutSnow = generateProceduralMountainRange(points, {
    seed: 42,
    scale: 60,
    hasSnowcaps: false,
  });
  const peaksWithoutSnow = withoutSnow.filter((p) => p.snowcapSunlitPoly || p.snowlinePath);
  assert.equal(peaksWithoutSnow.length, 0, 'No peaks should have snowcaps when disabled');
});

test('mountainGenerator: scale option directly scales the peak dimensions', () => {
  const points = [
    { x: 100, y: 200 },
    { x: 400, y: 200 },
  ];
  const smallPeaks = generateProceduralMountainRange(points, { seed: 101, scale: 35 });
  const largePeaks = generateProceduralMountainRange(points, { seed: 101, scale: 80 });

  const maxSmallHeight = Math.max(...smallPeaks.map((p) => p.scale));
  const maxLargeHeight = Math.max(...largePeaks.map((p) => p.scale));

  assert.ok(maxLargeHeight > maxSmallHeight * 1.8, 'Large scale should produce significantly taller peaks');
});
