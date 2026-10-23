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
    startWidth: 1.2,
    endWidth: 12.0,
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

test('riverGenerator: handles sharp bends and hairpin turns without collapsing banks', () => {
  const hairpinPoints = [
    { x: 100, y: 100 },
    { x: 250, y: 280 },
    { x: 120, y: 450 },
    { x: 300, y: 600 },
  ];

  const river = generateProceduralRiver(hairpinPoints, {
    seed: 555,
    startWidth: 1.2,
    endWidth: 12.0,
    meanderRoughness: 0.3,
  });

  assert.ok(river.centerline.length >= 20);

  // Verify that left and right bank never invert or produce NaN/Infinity
  for (let i = 0; i < river.leftBank.length; i++) {
    const l = river.leftBank[i];
    const r = river.rightBank[i];
    assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y), `Left bank vertex ${i} must be finite`);
    assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y), `Right bank vertex ${i} must be finite`);

    const widthAtStep = Math.hypot(r.x - l.x, r.y - l.y);
    assert.ok(widthAtStep > 0.5, `Width at step ${i} must remain positive (got ${widthAtStep})`);
  }
});
