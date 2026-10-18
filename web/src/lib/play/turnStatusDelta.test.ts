import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTurnStatusDelta } from './turnStatusDelta';
import { PlayerState } from '@/lib/types/gameplay';

describe('computeTurnStatusDelta — Plan 17 Phase 6 Travel & Vitals Deltas', () => {
  const basePlayer: PlayerState = {
    characterName: 'آرش',
    resources: { hp: 100, stamina: 50 },
    maxResources: { hp: 100, stamina: 50 },
    stats: {},
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    conditions: ['تندرست'],
    currentLocationId: 'loc_start',
  };

  it('detects travel start when oldState had no travel and newState has active travel', () => {
    const nextPlayer: PlayerState = {
      ...basePlayer,
      travel: {
        originLocationId: 'loc_start',
        destinationLocationId: 'loc_citadel',
        departedTurn: 1,
        totalTurns: 3,
        mode: 'caravan',
        waypointIds: [],
        caravanNpcIds: [],
      },
    };

    const deltas = computeTurnStatusDelta(basePlayer, nextPlayer, {
      isPersian: true,
      loreLocations: [
        { id: 'loc_start', name: 'دروازه سرخ' },
        { id: 'loc_citadel', name: 'ارگ سنگخورشید' },
      ],
    });

    const travelDelta = deltas.find((d) => d.type === 'travelStart');
    assert.ok(travelDelta, 'Should produce a travelStart delta');
    assert.equal(travelDelta.label, 'سفر آغاز شد');
    assert.match(travelDelta.subtitle || '', /ارگ سنگخورشید/);
  });

  it('detects travel arrival when travelArrived option is provided', () => {
    const nextPlayer: PlayerState = {
      ...basePlayer,
      currentLocationId: 'loc_citadel',
      travel: undefined,
    };

    const deltas = computeTurnStatusDelta(basePlayer, nextPlayer, {
      isPersian: false,
      travelArrived: {
        locationId: 'loc_citadel',
        name: 'Sunstone Citadel',
      },
    });

    const arrivalDelta = deltas.find((d) => d.type === 'travelArrived');
    assert.ok(arrivalDelta, 'Should produce a travelArrived delta');
    assert.equal(arrivalDelta.label, 'Arrived at Destination');
    assert.equal(arrivalDelta.subtitle, 'Sunstone Citadel');
    assert.equal(arrivalDelta.isNegative, false);
  });

  it('computes health changes alongside travel start', () => {
    const nextPlayer: PlayerState = {
      ...basePlayer,
      resources: { hp: 85, stamina: 40 },
      travel: {
        originLocationId: 'loc_start',
        destinationLocationId: 'loc_citadel',
        departedTurn: 2,
        totalTurns: 4,
        mode: 'foot',
        waypointIds: [],
        caravanNpcIds: [],
      },
    };

    const deltas = computeTurnStatusDelta(basePlayer, nextPlayer, { isPersian: false });
    assert.equal(deltas.length, 3, 'Should have HP loss, stamina loss, and travel start');
    assert.ok(deltas.some((d) => d.type === 'healthLoss' && d.delta === -15));
    assert.ok(deltas.some((d) => d.type === 'resourceLoss' && d.delta === -10));
    assert.ok(deltas.some((d) => d.type === 'travelStart'));
  });
});
