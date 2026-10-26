import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCompassRoseGeometry } from './compassRoseRenderer';

test('compassRoseRenderer — 16-Point Nautical Compass Rose', async (t) => {
  await t.test('generates exactly 32 chiseled facets for a 16-point star', () => {
    const geom = generateCompassRoseGeometry({
      x: 1000,
      y: 500,
      radius: 120,
      pointsCount: 16,
    });

    assert.equal(geom.facets.length, 32);

    // Each star point has exactly 1 shaded facet and 1 light facet
    const shadedCount = geom.facets.filter((f) => f.isShaded).length;
    const lightCount = geom.facets.filter((f) => !f.isShaded).length;
    assert.equal(shadedCount, 16);
    assert.equal(lightCount, 16);
  });

  await t.test('correctly assigns ranks to cardinal, ordinal, and secondary points', () => {
    const geom = generateCompassRoseGeometry({ pointsCount: 16 });

    // 4 cardinal points (N, E, S, W) -> 8 facets
    const cardinalFacets = geom.facets.filter((f) => f.rank === 'cardinal');
    assert.equal(cardinalFacets.length, 8);

    // 4 ordinal points (NE, SE, SW, NW) -> 8 facets
    const ordinalFacets = geom.facets.filter((f) => f.rank === 'ordinal');
    assert.equal(ordinalFacets.length, 8);

    // 8 secondary points -> 16 facets
    const secondaryFacets = geom.facets.filter((f) => f.rank === 'secondary');
    assert.equal(secondaryFacets.length, 16);
  });

  await t.test('generates 4 cardinal callout labels (N, E, S, W) positioned radially', () => {
    const geom = generateCompassRoseGeometry({
      x: 500,
      y: 500,
      radius: 100,
      rotation: 0,
    });

    assert.equal(geom.labels.length, 4);
    const textLetters = geom.labels.map((l) => l.text);
    assert.deepEqual(textLetters, ['N', 'E', 'S', 'W']);

    // North label should be above center (y < 500)
    const northLabel = geom.labels.find((l) => l.text === 'N')!;
    assert.ok(northLabel.position.y < 500, 'North label must be positioned above center');
    assert.ok(Math.abs(northLabel.position.x - 500) < 0.01, 'North label must be centered on X');

    // South label should be below center (y > 500)
    const southLabel = geom.labels.find((l) => l.text === 'S')!;
    assert.ok(southLabel.position.y > 500, 'South label must be positioned below center');
  });

  await t.test('generates North fleur-de-lis finial with valid polygon points', () => {
    const geom = generateCompassRoseGeometry({
      x: 500,
      y: 500,
      radius: 100,
    });

    const { spear, leftPetal, rightPetal, clasp } = geom.fleurDeLis;
    assert.ok(spear.length >= 3, 'Spear must have at least 3 vertices');
    assert.ok(leftPetal.length >= 3, 'Left petal must have at least 3 vertices');
    assert.ok(rightPetal.length >= 3, 'Right petal must have at least 3 vertices');
    assert.ok(clasp.length >= 4, 'Clasp must have at least 4 vertices');

    // Spear tip should extend furthest North (lowest Y)
    const spearTip = spear[1];
    assert.ok(spearTip.y < 400, 'Fleur-de-lis spear tip must protrude beyond compass radius');
  });

  await t.test('generates 32 degree graduation ticks and concentric rings', () => {
    const geom = generateCompassRoseGeometry({
      x: 500,
      y: 500,
      radius: 100,
      showDegreeRing: true,
    });

    assert.equal(geom.ticks.length, 32);
    assert.ok(geom.rings.length >= 4, 'Must generate multiple concentric rings');
  });
});
