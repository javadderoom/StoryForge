import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCaravelGeometry,
  generateSeaSerpentGeometry,
} from './manuscriptFurnitureRenderer';

test('manuscriptFurnitureRenderer — Vignettes & Embellishments', async (t) => {
  await t.test('generates caravel ship geometry with hull, masts, and billowing sails', () => {
    const ship = generateCaravelGeometry({
      id: 'ship_1',
      type: 'caravel',
      x: 500,
      y: 600,
      scale: 1.0,
      mirror: false,
    });

    assert.ok(ship.hull.length >= 8, 'Hull must have detailed outline vertices');
    assert.ok(ship.mainSail.length >= 4, 'Main sail must have closed quad outline');
    assert.ok(ship.foreSail.length >= 4, 'Fore sail must have closed quad outline');
    assert.ok(ship.wakeRipples.length >= 2, 'Must have wake ripples');

    // Mainmast top is higher than base (yTop < yBase)
    assert.ok(ship.mainMast.top.y < ship.mainMast.base.y);
  });

  await t.test('correctly mirrors caravel ship when mirror: true', () => {
    const normal = generateCaravelGeometry({
      id: 'ship_normal',
      type: 'caravel',
      x: 500,
      y: 500,
      scale: 1.0,
      mirror: false,
    });

    const mirrored = generateCaravelGeometry({
      id: 'ship_mirrored',
      type: 'caravel',
      x: 500,
      y: 500,
      scale: 1.0,
      mirror: true,
    });

    // Bowsprit x should be on the opposite side of x=500
    const normalBowspritX = normal.hull[1].x;
    const mirroredBowspritX = mirrored.hull[1].x;

    assert.ok((normalBowspritX - 500) * (mirroredBowspritX - 500) < 0, 'Bowsprit must mirror across X');
  });

  await t.test('generates sea serpent geometry with head jaws, loops, and tail fluke', () => {
    const serpent = generateSeaSerpentGeometry({
      id: 'serpent_1',
      type: 'sea_serpent',
      x: 800,
      y: 700,
      scale: 1.2,
      mirror: false,
    });

    assert.ok(serpent.headJaws.length >= 6, 'Head and jaws must have polygon vertices');
    assert.ok(serpent.loop1.length >= 6, 'Body loop 1 must have arched body coordinates');
    assert.ok(serpent.loop2.length >= 5, 'Body loop 2 must have arched body coordinates');
    assert.ok(serpent.tailFluke.length >= 4, 'Tail fluke must have fin vertices');
    assert.ok(serpent.crestHorns.length >= 2, 'Must have dorsal crest horns');
  });
});
