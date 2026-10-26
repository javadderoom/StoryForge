import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCartoucheGeometry } from './cartoucheRenderer';

test('cartoucheRenderer — Baroque Title Cartouche & Strapwork Frame', async (t) => {
  await t.test('computes bounding box and centered plaque polygon', () => {
    const geom = generateCartoucheGeometry({
      x: 350,
      y: 200,
      width: 400,
      height: 180,
    });

    assert.equal(geom.center.x, 350);
    assert.equal(geom.center.y, 200);
    assert.equal(geom.bounds.width, 400);
    assert.equal(geom.bounds.height, 180);

    // Plaque polygon must be a closed loop with at least 10 vertices
    assert.ok(geom.plaquePolygon.length >= 10);
    assert.ok(geom.innerFrame.length >= 8);
  });

  await t.test('generates exactly 4 corner strapwork volutes', () => {
    const geom = generateCartoucheGeometry({ x: 300, y: 300 });

    assert.equal(geom.cornerVolutes.length, 4);
    for (const volute of geom.cornerVolutes) {
      assert.ok(volute.outerCurve.length >= 4);
      assert.ok(volute.innerCurve.length >= 3);
      assert.ok(typeof volute.eyePoint.x === 'number');
      assert.ok(typeof volute.eyePoint.y === 'number');
    }
  });

  await t.test('generates subtitle ribbon banner with swallowtail cuts', () => {
    const geom = generateCartoucheGeometry({
      x: 400,
      y: 200,
      width: 360,
    });

    const { frontPoints, leftFold, rightFold, leftSwallowtail, rightSwallowtail } = geom.ribbon;

    assert.equal(frontPoints.length, 4, 'Front ribbon plaque must have 4 corners');
    assert.equal(leftFold.length, 3, 'Left fold must be triangular');
    assert.equal(rightFold.length, 3, 'Right fold must be triangular');
    assert.ok(leftSwallowtail.length >= 6, 'Left swallowtail must have notched tail');
    assert.ok(rightSwallowtail.length >= 6, 'Right swallowtail must have notched tail');
  });

  await t.test('generates architectural crest and drop finials', () => {
    const geom = generateCartoucheGeometry({ x: 300, y: 200 });

    assert.ok(geom.topCrest.length >= 4, 'Top crest must have multiple points');
    assert.ok(geom.bottomDrop.length >= 4, 'Bottom drop must have multiple points');

    // Top crest apex should be above plaque top
    const topY = geom.bounds.y;
    const crestApexY = Math.min(...geom.topCrest.map((p) => p.y));
    assert.ok(crestApexY < topY, 'Top crest apex must be above top bounding coordinate');
  });
});
