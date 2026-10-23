import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralRiver } from './riverGenerator';

test('riverGenerator: handles empty or single point gracefully', () => {
  const empty = generateProceduralRiver([]);
  assert.equal(empty.totalLength, 0);
  assert.deepEqual(empty.waterPolygon, []);

  const single = generateProceduralRiver([{ x: 10, y: 20 }]);
  assert.equal(single.totalLength, 0);
});

test('riverGenerator: monotonically tapers width from headwaters to estuary', () => {
  const points = [
    { x: 50, y: 100 },
    { x: 150, y: 180 },
    { x: 280, y: 240 },
    { x: 400, y: 350 },
  ];

  const river = generateProceduralRiver(points, {
    seed: 42,
    startWidth: 2.5,
    endWidth: 14.0,
  });

  assert.ok(river.centerline.length >= 20, 'Should have dense resampled centerline');
  assert.equal(river.leftBank.length, river.rightBank.length);
  assert.equal(river.leftBank.length, river.centerline.length);

  // Measure initial width vs terminal width
  const startDist = Math.hypot(
    river.leftBank[0].x - river.rightBank[0].x,
    river.leftBank[0].y - river.rightBank[0].y
  );
  const lastIdx = river.leftBank.length - 1;
  const endDist = Math.hypot(
    river.leftBank[lastIdx].x - river.rightBank[lastIdx].x,
    river.leftBank[lastIdx].y - river.rightBank[lastIdx].y
  );

  assert.ok(
    endDist > startDist * 3,
    `Mouth width (${endDist}) must be significantly wider than headwaters (${startDist})`
  );

  // Check water polygon completeness
  assert.equal(river.waterPolygon.length, river.leftBank.length * 2);
});

test('riverGenerator: produces deterministic output with identical seed', () => {
  const points = [
    { x: 100, y: 100 },
    { x: 200, y: 250 },
    { x: 350, y: 400 },
  ];

  const river1 = generateProceduralRiver(points, { seed: 7777 });
  const river2 = generateProceduralRiver(points, { seed: 7777 });

  assert.equal(river1.centerline.length, river2.centerline.length);
  for (let i = 0; i < river1.centerline.length; i++) {
    assert.deepEqual(river1.centerline[i], river2.centerline[i]);
    assert.deepEqual(river1.leftBank[i], river2.leftBank[i]);
    assert.deepEqual(river1.rightBank[i], river2.rightBank[i]);
  }
});

test('riverGenerator: creates delta branches and sandbar islands for long rivers', () => {
  const longPoints = [
    { x: 50, y: 50 },
    { x: 150, y: 120 },
    { x: 300, y: 250 },
    { x: 450, y: 350 },
  ];

  const river = generateProceduralRiver(longPoints, {
    seed: 555,
    enableDelta: true,
  });

  assert.ok(river.deltaBranches && river.deltaBranches.length >= 2, 'Should create delta branches');
  assert.ok(river.sandbarIslands && river.sandbarIslands.length >= 1, 'Should create sandbar islands');
});
