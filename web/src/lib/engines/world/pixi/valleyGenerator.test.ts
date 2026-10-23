import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralValley } from './valleyGenerator';

describe('valleyGenerator', () => {
  test('generates sunken gorge, rims, and strata hatching for a valid path', () => {
    const points = [
      { x: 100, y: 100 },
      { x: 200, y: 150 },
      { x: 300, y: 140 },
      { x: 400, y: 220 },
    ];

    const valley = generateProceduralValley(points, {
      seed: 12345,
      width: 32,
    });

    assert.ok(valley.gorgePolygon.length >= 6, 'Gorge polygon should enclose the valley');
    assert.equal(valley.leftRim.length, points.length, 'Left rim should match point count');
    assert.equal(valley.rightRim.length, points.length, 'Right rim should match point count');
    assert.equal(valley.centerCrevasse.length, points.length, 'Center crevasse should match point count');
    assert.ok(valley.strataHatches.length > 0, 'Should generate rock strata hatch lines');
    for (const [start, end] of valley.strataHatches) {
      assert.ok(typeof start.x === 'number' && typeof start.y === 'number');
      assert.ok(typeof end.x === 'number' && typeof end.y === 'number');
    }
  });

  test('handles edge cases gracefully', () => {
    const empty = generateProceduralValley([]);
    assert.equal(empty.strataHatches.length, 0);

    const single = generateProceduralValley([{ x: 50, y: 50 }]);
    assert.equal(single.strataHatches.length, 0);
  });
});
