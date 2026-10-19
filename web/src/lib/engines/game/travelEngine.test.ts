import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActiveTravel, PlayerState } from '@/lib/types/gameplay';
import { WorldBible, WorldLocation, WorldTradeRoute } from '@/lib/types/world';
import { RPGSystemSchema } from '@/lib/types/rpg';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import {
  detectTravelIntent,
  detectTravelAbortIntent,
  detectTravelMode,
  resolveDestinationName,
  isDirectlyReachable,
  routeBetween,
  planJourney,
  estimateTravelTurns,
  startTravel,
  advanceTravel,
  cancelTravel,
  travelProgress,
  travelTimeline,
  formatTravelLine,
  clampJourneyTurns,
  isTravelStateEnabled,
} from './travelEngine';

// ---------------------------------------------------------------------------
// Fixture world: a west→east caravan corridor A — B — C with one blocked
// southern route, a coordinate-less keep east of C, a parent/child pair, a
// one-day neighbor of B, and an unreachable island.
// ---------------------------------------------------------------------------

function loc(
  id: string,
  name: string,
  overrides: Partial<WorldLocation> = {}
): WorldLocation {
  return {
    id,
    name,
    description: '',
    region: 'Test Region',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
    ...overrides,
  };
}

const CITY_A = loc('city_a', 'Ashen Gate', { coordinates: { x: 0, y: 0 }, connectedLocationIds: ['city_b'] });
const CITY_B = loc('city_b', 'Brine Harbor', { coordinates: { x: 180, y: 0 } });
const CITY_C = loc('city_c', 'Salt Mine', { coordinates: { x: 360, y: 0 }, dangerLevel: 3 });
const WAY_W1 = loc('way_w1', 'Way Station', { coordinates: { x: 240, y: 0 } });
const KEEP_D = loc('keep_d', 'Dune Keep', { dangerLevel: 4, connectedLocationIds: ['city_c'] });
const CHILD_H = loc('child_h', 'Hidden Vale', { parentLocationId: 'city_a' });
const ISLE_E = loc('isle_e', 'Ghost Isle');
const NEAR_F = loc('near_f', 'Pebble Ford', { coordinates: { x: 200, y: 0 }, connectedLocationIds: ['city_b'] });

const ROUTE_AC: WorldTradeRoute = {
  id: 'route_ac',
  name: 'Salt Road',
  originLocationId: 'city_a',
  destinationLocationId: 'city_c',
  intermediateLocationIds: ['city_b'],
  dangerLevel: 2,
  status: 'active',
};

const ROUTE_E_BLOCKED: WorldTradeRoute = {
  id: 'route_isle',
  name: 'Sunken Causeway',
  originLocationId: 'city_b',
  destinationLocationId: 'isle_e',
  dangerLevel: 2,
  status: 'blockaded',
};

function makeWb(overrides: Partial<WorldBible> = {}): WorldBible {
  return {
    locations: [CITY_A, CITY_B, CITY_C, WAY_W1, KEEP_D, CHILD_H, ISLE_E, NEAR_F],
    npcs: [],
    factions: [],
    artifacts: [],
    bestiary: [],
    laws: [],
    tradeRoutes: [ROUTE_AC, ROUTE_E_BLOCKED],
    ...overrides,
  } as unknown as WorldBible;
}

function makePlayer(currentLocationId: string): PlayerState {
  return {
    stats: {},
    resources: {},
    inventory: [],
    equipment: {},
    discoveredLocationIds: [currentLocationId],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId,
  } as unknown as PlayerState;
}

const RPG = {
  hasCombat: false,
  diceType: 'd20',
  stats: [],
  resources: [],
  skills: [],
  startingInventory: [],
  inventoryCapacity: 10,
} as unknown as RPGSystemSchema;

// ---------------------------------------------------------------------------

describe('Plan 17 travel engine — intent & destination', () => {
  it('shares the travel-intent vocabulary with the action validator', () => {
    assert.equal(detectTravelIntent('go to the Brine Harbor'), true);
    assert.equal(detectTravelIntent('Travel toward Salt Mine'), true);
    assert.equal(detectTravelIntent('سفر به شهر نمک'), true);
    assert.equal(detectTravelIntent('sharpen the blade and wait'), false);
    assert.equal(detectTravelIntent(''), false);
  });

  it('detects abort intent only on explicit abandonment phrases', () => {
    assert.equal(detectTravelAbortIntent('turn back before the storm', false), true);
    assert.equal(detectTravelAbortIntent('abandon the journey', false), true);
    assert.equal(detectTravelAbortIntent('سفر را رها می‌کنم', true), true);
    assert.equal(detectTravelAbortIntent('به جاده ادامه می‌دهم', true), false);
    assert.equal(detectTravelAbortIntent('keep reading the map', false), false);
  });

  it('infers travel mode from verbs (flavor only)', () => {
    assert.equal(detectTravelMode('ride hard for the harbor'), 'mount');
    assert.equal(detectTravelMode('sail across the strait'), 'ship');
    assert.equal(detectTravelMode('join the caravan heading east'), 'caravan');
    assert.equal(detectTravelMode('walk to the gate'), 'foot');
  });

  it('resolves named destinations with normalized FA/EN matching', () => {
    const wb = makeWb();
    assert.equal(resolveDestinationName('Travel to brine harbor', wb, 'city_a')?.id, 'city_b');
    // ZWNJ-insensitive FA matching
    const faLoc = loc('fa_1', 'دروازه نمک', { coordinates: { x: 10, y: 10 } });
    const wbFa = makeWb({ locations: [...wb.locations, faLoc] });
    assert.equal(resolveDestinationName('به سمت دروازه‌نمک می‌روم', wbFa, 'city_a')?.id, 'fa_1');
  });

  it('never resolves the current location as a destination', () => {
    const wb = makeWb();
    assert.equal(resolveDestinationName('go to Ashen Gate', wb, 'city_a'), null);
    assert.equal(resolveDestinationName('go to Ashen Gate', wb, 'city_c')?.id, 'city_a');
  });
});

describe('Plan 17 travel engine — reachability parity with ActionValidator', () => {
  it('mirrors the validator graph rules (connected both ways, parent/child, live route stops)', () => {
    const wb = makeWb();
    assert.equal(isDirectlyReachable('city_a', 'city_b', wb), true); // connected forward
    assert.equal(isDirectlyReachable('city_b', 'city_a', wb), true); // connected reverse
    assert.equal(isDirectlyReachable('city_a', 'child_h', wb), true); // parent → child
    assert.equal(isDirectlyReachable('child_h', 'city_a', wb), true); // child → parent
    assert.equal(isDirectlyReachable('city_a', 'city_c', wb), true); // shared live route stops
    assert.equal(isDirectlyReachable('city_b', 'isle_e', wb), false); // blockaded route
    assert.equal(isDirectlyReachable('city_a', 'isle_e', wb), false);
    assert.equal(isDirectlyReachable('city_a', 'keep_d', wb), false); // two hops away
    assert.equal(isDirectlyReachable('city_a', 'city_a', wb), false);
  });

  it('accepts and rejects the exact same named destinations as the validator', () => {
    const wb = makeWb();
    const player = makePlayer('city_a');

    const viaEdge = ActionValidator.validateAction('travel to Brine Harbor', player, wb, RPG);
    assert.equal(viaEdge.isValid, true);

    // Salt Mine is only reachable through the shared caravan route — the
    // validator must accept what the engine accepts.
    const viaRoute = ActionValidator.validateAction('travel to Salt Mine', player, wb, RPG);
    assert.equal(viaRoute.isValid, true);

    const viaParent = ActionValidator.validateAction('travel to Hidden Vale', player, wb, RPG);
    assert.equal(viaParent.isValid, true);

    const blocked = ActionValidator.validateAction('travel to Ghost Isle', player, wb, RPG);
    assert.equal(blocked.isValid, false);
    assert.match(blocked.rejectionReason ?? '', /not directly reachable/);
  });
});

describe('Plan 17 travel engine — ETA & journey planning', () => {
  it('computes caravan days from map coordinates and clamps journeys to 2..6', () => {
    // 180 km at danger 2 → 4.6 days → 5
    assert.equal(estimateTravelTurns(CITY_A, CITY_B), 5);
    // 360 km at danger 3 → 8 × 1.3 = 10.4 → 10 (raw; journeys clamp)
    assert.equal(estimateTravelTurns(CITY_A, CITY_C), 10);
    assert.equal(clampJourneyTurns(10), 6);
    assert.equal(clampJourneyTurns(1), 2);
    assert.equal(clampJourneyTurns(4), 4);
  });

  it('adds a turn for raided routes (capped at 6)', () => {
    const raided: WorldTradeRoute = { ...ROUTE_AC, status: 'raided' };
    // 180 km at danger 2 → 5 days, +1 for the raid
    assert.equal(estimateTravelTurns(CITY_A, CITY_B, { route: raided }), 6);
    const raidedWb = makeWb({ tradeRoutes: [raided, ROUTE_E_BLOCKED] });
    const plan = planJourney('city_a', 'city_c', raidedWb, 'caravan');
    assert.equal(plan?.totalTurns, 6); // 9 + 1 would be 10 — the cap holds
  });

  it('plans a route journey with its intermediate stops as waypoints', () => {
    const plan = planJourney('city_a', 'city_c', makeWb(), 'caravan', { lang: 'fa' });
    assert.ok(plan);
    assert.equal(plan!.routeId, 'route_ac');
    assert.deepEqual(plan!.waypointIds, ['city_b']);
    assert.equal(plan!.totalTurns, 6);
    assert.equal(plan!.immediateHop, false);
    assert.match(plan!.note, /سفر آغاز شد/);
    assert.match(plan!.note, /Salt Mine/);
  });

  it('falls back to BFS multi-hop pathing when no route connects the ends', () => {
    const plan = planJourney('keep_d', 'city_b', makeWb(), 'foot');
    assert.ok(plan);
    assert.equal(plan!.routeId, undefined);
    assert.deepEqual(plan!.waypointIds, ['city_c']);
    assert.equal(plan!.totalTurns, 4); // no coords on keep_d → 2 × 2 hops
  });

  it('marks a one-day coordinate hop as an immediate landing', () => {
    const plan = planJourney('city_b', 'near_f', makeWb(), 'foot');
    assert.ok(plan);
    assert.equal(plan!.immediateHop, true);
    assert.deepEqual(plan!.waypointIds, []);
  });

  it('returns null for unreachable or blocked destinations', () => {
    const wb = makeWb();
    assert.equal(planJourney('city_a', 'isle_e', wb), null); // blockaded route only
    assert.equal(planJourney('city_a', 'city_a', wb), null);
    assert.equal(planJourney('city_a', 'nonexistent', wb), null);
  });

  it('excludes blockaded edges from pathing but honors active ones', () => {
    const openWb = makeWb({
      tradeRoutes: [{ ...ROUTE_E_BLOCKED, status: 'active' }, ROUTE_AC],
    });
    const crossed = planJourney('city_b', 'isle_e', openWb, 'ship');
    assert.ok(crossed);
    assert.equal(crossed!.totalTurns, 2); // no coords on isle_e → 2 × 1 hop
    assert.equal(planJourney('city_b', 'isle_e', makeWb()), null);
  });

  it('prefers the route with the fewest stops between the endpoints', () => {
    const direct: WorldTradeRoute = {
      ...ROUTE_AC,
      id: 'route_direct',
      name: 'Direct Cut',
      intermediateLocationIds: [],
    };
    const wb = makeWb({ tradeRoutes: [ROUTE_AC, direct] });
    assert.equal(routeBetween('city_a', 'city_c', wb)?.id, 'route_direct');
  });

  it('materializes ActiveTravel from a plan without sharing arrays', () => {
    const plan = planJourney('city_a', 'city_c', makeWb(), 'caravan')!;
    const travel = startTravel(plan, 'city_a', 7);
    assert.equal(travel.originLocationId, 'city_a');
    assert.equal(travel.departedTurn, 7);
    assert.equal(travel.totalTurns, 6);
    plan.waypointIds.push('tampered');
    assert.deepEqual(travel.waypointIds, ['city_b']);
  });
});

describe('Plan 17 travel engine — derived progress (rewind-safe)', () => {
  const trip: ActiveTravel = {
    originLocationId: 'city_a',
    destinationLocationId: 'city_c',
    waypointIds: ['way_w1', 'keep_d'],
    mode: 'caravan',
    departedTurn: 10,
    totalTurns: 4,
  };

  it('derives progress from the absolute turn number alone', () => {
    assert.deepEqual(
      travelProgress(trip, 10),
      { legsElapsed: 0, turnsRemaining: 4, nodeIndex: 0, arrived: false, arriving: false, dayOnRoad: 1 }
    );
    assert.deepEqual(
      travelProgress(trip, 12),
      { legsElapsed: 2, turnsRemaining: 2, nodeIndex: 2, arrived: false, arriving: false, dayOnRoad: 3 }
    );
    assert.equal(travelProgress(trip, 13).arriving, true);
    assert.equal(travelProgress(trip, 14).arrived, true);
  });

  it('clamps before departure and after the scheduled arrival', () => {
    assert.equal(travelProgress(trip, 0).nodeIndex, 0);
    assert.equal(travelProgress(trip, 99).arrived, true);
    assert.equal(travelProgress(trip, 99).turnsRemaining, 0);
  });

  it('recomputes identical results on a remake of the same turn', () => {
    const first = travelProgress(trip, 12);
    const remake = travelProgress(trip, 12);
    assert.deepEqual(first, remake);
    assert.deepEqual(travelTimeline(trip), ['city_a', 'way_w1', 'keep_d', 'city_c']);
  });

  it('keeps the schedule stable when a forced-march diff is discarded by a remake', () => {
    // First run at turn 12 derives purely from the persisted journey.
    const firstRun = travelProgress(trip, 12);
    // A forced march would have written a shorter journey into that turn's
    // resolution diff (totalTurns - 1) — a different schedule.
    const forcedMarch = travelProgress({ ...trip, totalTurns: trip.totalTurns - 1 }, 12);
    assert.notDeepEqual(forcedMarch, firstRun);
    // The remake discards that diff and re-derives from persisted state:
    // identical to the first run, and arrival stays on the original turn.
    const remake = travelProgress(trip, 12);
    assert.deepEqual(remake, firstRun);
    assert.equal(travelProgress(trip, trip.departedTurn + trip.totalTurns).arrived, true);
  });
});

describe('Plan 17 travel engine — per-turn lifecycle', () => {
  const trip: ActiveTravel = {
    originLocationId: 'city_a',
    destinationLocationId: 'city_c',
    waypointIds: ['way_w1', 'keep_d'],
    mode: 'caravan',
    departedTurn: 10,
    totalTurns: 4,
  };

  it('holds the journey on the departure turn', () => {
    const out = advanceTravel({ travel: trip, currentLocationId: 'city_a' }, 10, makeWb());
    assert.deepEqual(out.travel, trip);
    assert.equal(out.movedTo, undefined);
    assert.equal(out.arrivedAt, undefined);
  });

  it('advances node by node and stops once it reaches the destination', () => {
    const wb = makeWb();
    const move1 = advanceTravel({ travel: trip, currentLocationId: 'city_a' }, 11, wb, { lang: 'en' });
    assert.equal(move1.movedTo, 'way_w1');
    assert.match(move1.note ?? '', /Way Station/);

    const move2 = advanceTravel({ travel: trip, currentLocationId: 'way_w1' }, 12, wb);
    assert.equal(move2.movedTo, 'keep_d');

    // Final leg: nothing to advance — the destination appears next.
    const hold = advanceTravel({ travel: trip, currentLocationId: 'keep_d' }, 13, wb);
    assert.equal(hold.movedTo, undefined);
    assert.equal(hold.arrivedAt, undefined);
    assert.deepEqual(hold.travel, trip);

    const arrival = advanceTravel({ travel: trip, currentLocationId: 'keep_d' }, 14, wb, { lang: 'en' });
    assert.equal(arrival.arrivedAt, 'city_c');
    assert.equal(arrival.travel, null);
    assert.match(arrival.note ?? '', /Salt Mine/);
  });

  it('never moves the player onto an unknown node', () => {
    const broken: ActiveTravel = { ...trip, waypointIds: ['missing_node'] };
    const out = advanceTravel({ travel: broken, currentLocationId: 'city_a' }, 11, makeWb());
    assert.equal(out.movedTo, undefined);
    assert.deepEqual(out.travel, broken);
  });

  it('moves player into parent region when departing a child settlement on the road', () => {
    const childTrip: ActiveTravel = {
      originLocationId: 'child_h', // child of city_a
      destinationLocationId: 'city_c',
      waypointIds: [],
      mode: 'foot',
      departedTurn: 5,
      totalTurns: 3,
    };
    const out = advanceTravel({ travel: childTrip, currentLocationId: 'child_h' }, 6, makeWb(), { lang: 'en' });
    assert.equal(out.movedTo, 'city_a');
    assert.match(out.note ?? '', /departed "Hidden Vale" into "Ashen Gate"/);
  });

  it('cancels a journey at the current stop (abort precedence)', () => {
    const out = cancelTravel({ travel: trip, currentLocationId: 'way_w1' }, makeWb(), { lang: 'fa' });
    assert.equal(out.travel, null);
    assert.match(out.note, /رها شد/);
    assert.match(out.note, /Way Station/);
    assert.match(out.note, /Salt Mine/);
  });

  it('formats the journey status line with day and next stop', () => {
    const line = formatTravelLine(trip, makeWb(), 'fa', 11);
    assert.match(line, /در راه/);
    assert.match(line, /روز 2 از 4/);
    assert.match(line, /ایستگاه بعدی/);
    assert.ok(line.includes('Dune Keep'));
  });

  it('respects ENABLE_TRAVEL_STATE feature flag', () => {
    assert.equal(isTravelStateEnabled({ ENABLE_TRAVEL_STATE: 'false' }), false);
    assert.equal(isTravelStateEnabled({ ENABLE_TRAVEL_STATE: 'true' }), true);
    assert.equal(isTravelStateEnabled({}), true);
  });
});

