import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenToWorld,
  worldToScreen,
  calculateZoomPan,
  clampZoom,
  calculateHexVertices,
  generateOrganicParchmentContours,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
} from './pixiMath';

test('Pixi Cartographer Math - Coordinate Projections', async (t) => {
  await t.test('screenToWorld projects accurately with pan and zoom', () => {
    const pan = { x: 100, y: 50 };
    const zoom = 1.5;

    // (400 - 100) / 1.5 = 200
    // (350 - 50) / 1.5 = 200
    const world = screenToWorld(400, 350, pan, zoom);
    assert.equal(world.x, 200);
    assert.equal(world.y, 200);
  });

  await t.test('worldToScreen inverts screenToWorld accurately', () => {
    const pan = { x: 150, y: -75 };
    const zoom = 2.0;
    const initialWorld = { x: 500, y: 300 };

    const screen = worldToScreen(initialWorld.x, initialWorld.y, pan, zoom);
    const projectedBack = screenToWorld(screen.x, screen.y, pan, zoom);

    assert.equal(projectedBack.x, initialWorld.x);
    assert.equal(projectedBack.y, initialWorld.y);
  });

  await t.test('handles zero zoom gracefully without crashing', () => {
    const world = screenToWorld(100, 100, { x: 0, y: 0 }, 0);
    assert.equal(world.x, 100);
    assert.equal(world.y, 100);
  });
});

test('Pixi Cartographer Math - Zoom & Anchor Preservation', async (t) => {
  await t.test('calculateZoomPan keeps cursor position anchored during zoom', () => {
    const cursor = { x: 400, y: 300 };
    const oldPan = { x: 0, y: 0 };
    const oldZoom = 1.0;
    const newZoom = 2.0;

    // World point at cursor before zoom: (400, 300)
    const worldBefore = screenToWorld(cursor.x, cursor.y, oldPan, oldZoom);
    assert.equal(worldBefore.x, 400);
    assert.equal(worldBefore.y, 300);

    const newPan = calculateZoomPan(cursor.x, cursor.y, oldPan, oldZoom, newZoom);

    // World point at cursor after zoom with new pan must be identical
    const worldAfter = screenToWorld(cursor.x, cursor.y, newPan, newZoom);
    assert.equal(worldAfter.x, 400);
    assert.equal(worldAfter.y, 300);
  });

  await t.test('clampZoom respects minimum and maximum limits', () => {
    assert.equal(clampZoom(0.01), MIN_ZOOM);
    assert.equal(clampZoom(10.0), MAX_ZOOM);
    assert.equal(clampZoom(1.25), 1.25);
  });
});

test('Pixi Cartographer Math - Vintage Hex & Noise Contours', async (t) => {
  await t.test('calculateHexVertices produces 6 symmetric vertices', () => {
    const vertices = calculateHexVertices(500, 500, 50);
    assert.equal(vertices.length, 6);

    // Check that distance to center is ~50 for all vertices
    for (const v of vertices) {
      const dist = Math.hypot(v.x - 500, v.y - 500);
      assert.ok(Math.abs(dist - 50) <= 2, `Expected distance ~50, got ${dist}`);
    }
  });

  await t.test('generateOrganicParchmentContours perturbs points deterministically with noise', () => {
    const original = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 100, y: 200 },
    ];

    const perturbed = generateOrganicParchmentContours(original, 8);
    assert.equal(perturbed.length, original.length);

    // Ensure perturbations are within the amplitude bound
    for (let i = 0; i < original.length; i++) {
      const dx = Math.abs(perturbed[i].x - original[i].x);
      const dy = Math.abs(perturbed[i].y - original[i].y);
      assert.ok(dx <= 12, `Perturbation dx exceeded expected range: ${dx}`);
      assert.ok(dy <= 12, `Perturbation dy exceeded expected range: ${dy}`);
    }
  });
});
