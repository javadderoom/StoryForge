import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorldLocation } from '@/lib/types/world';
import {
  getConnectionDirection,
  getReachableNeighborIds,
  getEffectiveConnectionsForLocation,
  hasAnyLocationLink,
  syncLocationConnections,
  backfillTwoWayConnections,
} from './locationConnections';

function makeLoc(id: string, name: string, overrides: Partial<WorldLocation> = {}): WorldLocation {
  return {
    id,
    name,
    description: '',
    region: 'Test',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
    ...overrides,
  };
}

describe('locationConnections — one-way & two-way links', () => {
  it('defaults omitted connectionDirections to two_way', () => {
    const a = makeLoc('a', 'A', { connectedLocationIds: ['b'] });
    assert.equal(getConnectionDirection(a, 'b'), 'two_way');
  });

  it('shows every link (two-way and one-way) on both endpoints in UI helpers', () => {
    const a = makeLoc('a', 'A', {
      connectedLocationIds: ['b'],
      connectionDirections: { b: 'one_way' },
    });
    const b = makeLoc('b', 'B');
    const c = makeLoc('c', 'C', { connectedLocationIds: ['b'] }); // legacy two-way without explicit map

    const onA = getEffectiveConnectionsForLocation('a', [a, b, c]);
    assert.deepEqual(
      onA.map((x) => ({ id: x.location.id, kind: x.kind })),
      [{ id: 'b', kind: 'one_way_out' }]
    );

    const onB = getEffectiveConnectionsForLocation('b', [a, b, c]);
    assert.deepEqual(
      onB.map((x) => ({ id: x.location.id, kind: x.kind })),
      [
        { id: 'a', kind: 'one_way_in' },
        { id: 'c', kind: 'two_way' },
      ]
    );
  });

  it('respects one_way reachability while keeping two_way symmetric', () => {
    const a = makeLoc('a', 'A', {
      connectedLocationIds: ['b'],
      connectionDirections: { b: 'one_way' },
    });
    const b = makeLoc('b', 'B');
    const c = makeLoc('c', 'C', { connectedLocationIds: ['b'] });

    assert.deepEqual(getReachableNeighborIds('a', [a, b, c]), ['b']);
    assert.deepEqual(getReachableNeighborIds('b', [a, b, c]), ['c']);
    assert.equal(hasAnyLocationLink('b', [a, b, c]), true);
  });

  it('syncLocationConnections mirrors two_way links and strips reverse edge on one_way', () => {
    const initial = [makeLoc('a', 'A'), makeLoc('b', 'B')];

    // Add two_way from A -> B: B gets A automatically
    const afterTwoWay = syncLocationConnections(
      initial,
      makeLoc('a', 'A', { connectedLocationIds: ['b'], connectionDirections: { b: 'two_way' } })
    );
    const b1 = afterTwoWay.find((l) => l.id === 'b')!;
    assert.deepEqual(b1.connectedLocationIds, ['a']);
    assert.equal(b1.connectionDirections?.a, 'two_way');

    // Switch A -> B to one_way: reverse link on B is removed
    const afterOneWay = syncLocationConnections(
      afterTwoWay,
      makeLoc('a', 'A', { connectedLocationIds: ['b'], connectionDirections: { b: 'one_way' } })
    );
    const b2 = afterOneWay.find((l) => l.id === 'b')!;
    assert.deepEqual(b2.connectedLocationIds, []);
    assert.equal(b2.connectionDirections?.a, undefined);

    // Promote back from B by adding A as two_way: A becomes two_way too
    const afterPromote = syncLocationConnections(
      afterOneWay,
      makeLoc('b', 'B', { connectedLocationIds: ['a'], connectionDirections: { a: 'two_way' } })
    );
    const a3 = afterPromote.find((l) => l.id === 'a')!;
    assert.equal(a3.connectionDirections?.b, 'two_way');
  });

  it('backfillTwoWayConnections sets two_way defaults and mirrors asymmetric legacy links', () => {
    const legacy = [
      makeLoc('a', 'A', { connectedLocationIds: ['b'] }),
      makeLoc('b', 'B'),
      makeLoc('c', 'C', { connectedLocationIds: ['b'], connectionDirections: { b: 'one_way' } }),
    ];
    const migrated = backfillTwoWayConnections(legacy);
    const a = migrated.find((l) => l.id === 'a')!;
    const b = migrated.find((l) => l.id === 'b')!;
    const c = migrated.find((l) => l.id === 'c')!;

    assert.equal(a.connectionDirections?.b, 'two_way');
    assert.deepEqual(b.connectedLocationIds, ['a']);
    assert.equal(b.connectionDirections?.a, 'two_way');
    assert.equal(c.connectionDirections?.b, 'one_way');
    assert.equal(b.connectedLocationIds.includes('c'), false);
  });
});
