import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScaleBarGeometry } from './scaleBarRenderer';

test('scaleBarRenderer — Dual-Unit Linear Scale Bar', async (t) => {
  await t.test('generates alternating blocks for primary and secondary tracks', () => {
    const geom = generateScaleBarGeometry({
      x: 100,
      y: 1000,
      width: 300,
      height: 20,
      divisions: 4,
    });

    assert.ok(geom.blocks.length >= 7, 'Must generate multiple division blocks');

    const primaryBlocks = geom.blocks.filter((b) => b.track === 'primary');
    const secondaryBlocks = geom.blocks.filter((b) => b.track === 'secondary');

    // Primary track has 4 sub-blocks in lead division + 3 major divisions = 7 blocks
    assert.equal(primaryBlocks.length, 7);
    // Secondary track has 4 divisions
    assert.equal(secondaryBlocks.length, 4);

    // Both tracks contain both filled and unfilled blocks for contrast
    assert.ok(primaryBlocks.some((b) => b.isFilled));
    assert.ok(primaryBlocks.some((b) => !b.isFilled));
    assert.ok(secondaryBlocks.some((b) => b.isFilled));
    assert.ok(secondaryBlocks.some((b) => !b.isFilled));
  });

  await t.test('generates division ticks for both top and bottom tracks', () => {
    const geom = generateScaleBarGeometry({
      divisions: 4,
      primaryRatio: 60,
      secondaryRatio: 200,
    });

    const topTicks = geom.ticks.filter((t) => t.position === 'top');
    const bottomTicks = geom.ticks.filter((t) => t.position === 'bottom');

    assert.equal(topTicks.length, 5, '4 divisions have 5 boundary ticks (0 to 4)');
    assert.equal(bottomTicks.length, 5, '4 divisions have 5 boundary ticks (0 to 4)');

    // End values match ratios
    assert.equal(topTicks[topTicks.length - 1].label, '60');
    assert.equal(bottomTicks[bottomTicks.length - 1].label, '200');
  });

  await t.test('includes unit titling for Parasangs and Miles', () => {
    const geom = generateScaleBarGeometry({
      primaryUnit: 'PARASANGS',
      secondaryUnit: 'MILES',
    });

    const primaryUnitLabel = geom.labels.find((l) => l.text === 'PARASANGS');
    const secondaryUnitLabel = geom.labels.find((l) => l.text === 'MILES');

    assert.ok(primaryUnitLabel, 'Must include PARASANGS unit label');
    assert.ok(secondaryUnitLabel, 'Must include MILES unit label');
  });

  await t.test('generates architectural end finials', () => {
    const geom = generateScaleBarGeometry({ x: 200, width: 300 });

    assert.ok(geom.finials.left.length >= 4);
    assert.ok(geom.finials.right.length >= 4);

    // Left finial extends to the left of x
    const minLeftX = Math.min(...geom.finials.left.map((p) => p.x));
    assert.ok(minLeftX < 200, 'Left finial must protrude left of the bar origin');

    // Right finial extends to the right of x + width
    const maxRightX = Math.max(...geom.finials.right.map((p) => p.x));
    assert.ok(maxRightX > 500, 'Right finial must protrude right of the bar terminus');
  });
});
