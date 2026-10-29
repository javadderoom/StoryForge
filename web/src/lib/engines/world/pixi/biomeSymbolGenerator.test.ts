import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBiomeSymbols, generateBiomeStrokeSymbols } from './biomeSymbolGenerator';

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

test('biomeSymbolGenerator: generates single standalone tree or tight copse on single click stamp', () => {
  // Narrow corridor: 1 tree
  const singleTree = generateBiomeStrokeSymbols([{ x: 150, y: 200 }], 'forest', {
    width: 15,
    seed: 42,
  });
  assert.equal(singleTree.trees.length, 1);
  assert.ok(Math.abs(singleTree.trees[0].x - 150) <= 5);
  assert.ok(Math.abs(singleTree.trees[0].y - 200) <= 5);

  // Standard corridor: tight copse of 3 trees
  const copse = generateBiomeStrokeSymbols([{ x: 150, y: 200 }], 'forest', {
    width: 30,
    seed: 42,
  });
  assert.equal(copse.trees.length, 3);
  for (const tree of copse.trees) {
    assert.ok(tree.crownPoly.length >= 3);
    assert.ok(tree.shadowPoly.length >= 3);
    assert.equal(tree.trunk.length, 2);
  }
  // Strictly Y-sorted
  assert.ok(copse.trees[0].y <= copse.trees[1].y);
  assert.ok(copse.trees[1].y <= copse.trees[2].y);
});

test('biomeSymbolGenerator: generates linear woodland belt along stroke path with corridor width', () => {
  const shorelineStroke = [
    { x: 100, y: 100 },
    { x: 180, y: 130 },
    { x: 260, y: 150 },
    { x: 340, y: 140 },
  ];

  const symbols = generateBiomeStrokeSymbols(shorelineStroke, 'forest', {
    width: 30,
    density: 'medium',
    seed: 123,
  });

  assert.ok(symbols.trees.length >= 6, `Expected at least 6 trees along path, got ${symbols.trees.length}`);

  // Check strict Y-depth sorting
  for (let i = 0; i < symbols.trees.length - 1; i++) {
    assert.ok(
      symbols.trees[i].y <= symbols.trees[i + 1].y,
      `Trees must be sorted by Y: tree[${i}].y (${symbols.trees[i].y}) <= tree[${i + 1}].y (${symbols.trees[i + 1].y})`
    );
  }
});

test('biomeSymbolGenerator: generates dunes and reeds along stroke paths', () => {
  const desertStroke = [
    { x: 100, y: 100 },
    { x: 250, y: 120 },
    { x: 400, y: 100 },
  ];
  const desertSymbols = generateBiomeStrokeSymbols(desertStroke, 'desert', { seed: 55 });
  assert.ok(desertSymbols.sandDunes.length >= 2, 'Should generate dunes along stroke');

  const swampStroke = [
    { x: 100, y: 100 },
    { x: 250, y: 100 },
  ];
  const swampSymbols = generateBiomeStrokeSymbols(swampStroke, 'swamp', { seed: 88 });
  assert.ok(swampSymbols.marshReeds.length >= 3, 'Should generate reeds along stroke');
});
