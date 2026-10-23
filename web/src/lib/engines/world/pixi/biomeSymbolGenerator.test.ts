import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBiomeSymbols } from './biomeSymbolGenerator';

test('biomeSymbolGenerator: handles empty or tiny polygon gracefully', () => {
  const empty = generateBiomeSymbols([], 'forest');
  assert.equal(empty.trees.length, 0);

  const tiny = generateBiomeSymbols(
    [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }],
    'forest'
  );
  assert.equal(empty.trees.length, 0);
});

test('biomeSymbolGenerator: generates trees inside forest polygon with Y-depth sorting', () => {
  const forestPoly = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
  ];

  const symbols = generateBiomeSymbols(forestPoly, 'forest', {
    seed: 42,
    density: 'medium',
  });

  assert.ok(symbols.trees.length >= 8, `Should generate tree clusters, got ${symbols.trees.length}`);

  // Check strict Y-depth sorting
  for (let i = 0; i < symbols.trees.length - 1; i++) {
    assert.ok(
      symbols.trees[i].y <= symbols.trees[i + 1].y,
      `Trees must be sorted by Y: tree[${i}].y (${symbols.trees[i].y}) <= tree[${i + 1}].y (${symbols.trees[i + 1].y})`
    );
  }

  // Check crown geometry
  for (const tree of symbols.trees) {
    assert.ok(tree.crownPoly.length >= 3);
    assert.ok(tree.shadowPoly.length >= 3);
    assert.ok(tree.trunk.length === 2);
  }
});

test('biomeSymbolGenerator: generates sand dunes in desert polygon', () => {
  const desertPoly = [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 400 },
    { x: 100, y: 400 },
  ];

  const symbols = generateBiomeSymbols(desertPoly, 'desert', { seed: 99 });
  assert.ok(symbols.sandDunes.length >= 3, 'Should generate sand dune ridges');
  for (const dune of symbols.sandDunes) {
    assert.ok(dune.crestPath.length >= 3);
    assert.ok(dune.shadowPoly.length >= 3);
  }
});

test('biomeSymbolGenerator: generates marsh reeds in swamp polygon', () => {
  const swampPoly = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
  ];

  const symbols = generateBiomeSymbols(swampPoly, 'swamp', { seed: 77 });
  assert.ok(symbols.marshReeds.length >= 4, 'Should generate marsh reed tufts');
  for (const reed of symbols.marshReeds) {
    assert.equal(reed.blades.length, 3);
  }
});
