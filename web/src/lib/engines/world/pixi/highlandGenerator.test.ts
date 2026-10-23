import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProceduralHighland } from './highlandGenerator';
import { isPointInPolygon } from '../landSculpt/geometry';

test('highlandGenerator: handles empty points gracefully', () => {
  const empty = generateProceduralHighland([]);
  assert.equal(empty.tablePolygon.length, 0);
  assert.equal(empty.strataHatches.length, 0);
});

test('highlandGenerator: generates closed plateau with table polygon and shaded cliff drops', () => {
  const plateauPoints = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 300, y: 300 },
    { x: 100, y: 300 },
    { x: 100, y: 100 },
  ];

  const highland = generateProceduralHighland(plateauPoints, {
    seed: 123,
    cliffHeight: 25,
    terraceTiers: 2,
    isPolygon: true,
  });

  assert.ok(highland.tablePolygon.length >= 4, 'Table polygon must have vertices');
  assert.ok(highland.cliffDropPolygon.length >= 6, 'Cliff drop polygon must surround rim');
  assert.ok(highland.strataHatches.length >= 5, 'Must generate strata hatch lines on cliff drops');
  assert.ok(highland.terraceContours && highland.terraceContours.length >= 1, 'Should generate secondary tier');
  assert.ok(highland.apronRings && highland.apronRings.length >= 4, 'Must generate a broad cliff apron');
  assert.ok(
    highland.apronRings.every((ring) => ring.length >= 4),
    'Every apron ring must be a valid closed polygon'
  );
  assert.ok(highland.interiorRidges && highland.interiorRidges.length > 0, 'Must generate eroded interior folds');
  assert.ok(highland.rimSpurs && highland.rimSpurs.length > 0, 'Must break the rim with rock spurs');
  assert.ok(highland.cliffPeaks && highland.cliffPeaks.length > 0, 'Must ring the table with cliff peaks');

  const rimXs = highland.rimPath.map((point) => point.x);
  const rimYs = highland.rimPath.map((point) => point.y);
  const apron = highland.apronRings![0];
  assert.ok(Math.min(...apron.map((point) => point.x)) < Math.min(...rimXs), 'Apron must grow westward');
  assert.ok(Math.max(...apron.map((point) => point.x)) > Math.max(...rimXs), 'Apron must grow eastward');
  assert.ok(Math.min(...apron.map((point) => point.y)) < Math.min(...rimYs), 'Apron must grow northward');
  assert.ok(Math.max(...apron.map((point) => point.y)) > Math.max(...rimYs), 'Apron must grow southward');

  for (const ridge of highland.interiorRidges!) {
    for (const point of ridge) {
      assert.ok(
        isPointInPolygon(point, highland.tablePolygon),
        'Interior ridges must stay inside the table surface'
      );
    }
  }
});

test('highlandGenerator: generates open escarpment ridge line', () => {
  const ridgePoints = [
    { x: 100, y: 150 },
    { x: 250, y: 200 },
    { x: 400, y: 180 },
  ];

  const escarpment = generateProceduralHighland(ridgePoints, {
    seed: 456,
    cliffHeight: 20,
    isPolygon: false,
  });

  assert.ok(escarpment.rimPath.length >= 3);
  assert.ok(escarpment.buttresses.length > 0, 'Should generate rock buttresses along the scarp');
  assert.ok(escarpment.rimSpurs && escarpment.rimSpurs.length > 0, 'Should generate rim spurs');
  assert.ok(escarpment.strataHatches.length >= 2);
  for (const [start, end] of escarpment.strataHatches) {
    assert.ok(Number.isFinite(start.x) && Number.isFinite(start.y));
    assert.ok(Number.isFinite(end.x) && Number.isFinite(end.y));
  }
});
