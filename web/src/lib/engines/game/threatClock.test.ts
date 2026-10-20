import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tickTensionClock,
  ensureClockForLocation,
  resolveDisplacement,
  clockIdForLocation,
  pruneInactiveZoneClocks,
  seedAmbientClock,
  normalizeClockChanges,
  resolveDeclaredClockChanges,
  resolveClockZoneLocationId,
  refreshZoneThreatClocks,
  MAX_CLOCK_DELTA_PER_TURN,
} from './threatClock';
import { GameEngine } from './GameEngine';
import { PlayerState } from '../../types/gameplay';
import { WorldBible } from '../../types/world';
import { RPGSystemSchema } from '../../types/rpg';

const rpg: RPGSystemSchema = {
  hasCombat: true,
  diceType: 'd20',
  stats: [{ id: 'might', name: 'Might', description: 'Strength', baseValue: 14 }],
  resources: [
    { id: 'hp', name: 'Health', current: 100, max: 100, min: 0 },
    { id: 'stamina', name: 'Stamina', current: 50, max: 50, min: 0 },
  ],
  skills: [],
  startingInventory: [],
  inventoryCapacity: 10,
};

const bible: WorldBible = {
  worldId: 'w1',
  worldName: 'Test Realm',
  summary: '',
  themeNotes: '',
  laws: [],
  factions: [],
  locations: [
    {
      id: 'loc_battlements',
      name: 'Castle Battlements',
      description: 'High walls',
      region: 'Citadel',
      dangerLevel: 4,
      connectedLocationIds: [],
      atmosphere: 'Windy',
      hazardFallbackLocationId: 'loc_moat',
      threatClockDefault: { name: 'City Watch Alert', maxSegments: 4, crisisDescription: 'Guards breach the doors' },
    },
    {
      id: 'loc_moat',
      name: 'Outer Moat',
      description: 'Mud and water',
      region: 'Citadel',
      dangerLevel: 3,
      connectedLocationIds: [],
      atmosphere: 'Damp',
    },
  ],
  timeline: [],
  npcs: [],
};

const baseState: PlayerState = {
  stats: { might: 14 },
  resources: { hp: 100, stamina: 50 },
  inventory: [],
  equipment: {},
  discoveredLocationIds: ['loc_battlements'],
  relationships: {},
  activeQuestIds: [],
  completedQuestIds: [],
  currentLocationId: 'loc_battlements',
};

describe('Plan 13: threat clocks', () => {
  it('ticks +1 on mixed_success and failure, +2 on critical_failure', () => {
    const clock = { id: 'c1', name: 'Alert', currentSegments: 1, maxSegments: 4, crisisDescription: '' };
    assert.equal(tickTensionClock(clock, 'mixed_success').newSegments, 2);
    assert.equal(tickTensionClock(clock, 'failure').newSegments, 2);
    assert.equal(tickTensionClock(clock, 'critical_failure').newSegments, 3);
  });

  it('ticks 0 on success and relieves 1 on critical_success (floored at 0)', () => {
    const clock = { id: 'c1', name: 'Alert', currentSegments: 1, maxSegments: 4, crisisDescription: '' };
    assert.equal(tickTensionClock(clock, 'success').newSegments, 1);
    assert.equal(tickTensionClock(clock, 'critical_success').newSegments, 0);
    assert.equal(tickTensionClock({ ...clock, currentSegments: 0 }, 'critical_success').newSegments, 0);
  });

  it('raises crisis flag when currentSegments >= maxSegments', () => {
    const clock = { id: 'c1', name: 'Alert', currentSegments: 3, maxSegments: 4, crisisDescription: 'Breach' };
    const res = tickTensionClock(clock, 'failure');
    assert.equal(res.newSegments, 4);
    assert.equal(res.isCrisis, true);
  });

  it('spawns a default clock for a zone with threatClockDefault', () => {
    const clock = ensureClockForLocation([], bible.locations[0]);
    assert.ok(clock);
    assert.equal(clock!.id, clockIdForLocation('loc_battlements'));
    assert.equal(clock!.maxSegments, 4);
  });

  it('inherits threat clock from regional ancestor when child location has none', () => {
    const regionalBible: WorldBible = {
      ...bible,
      locations: [
        {
          id: 'loc_region_desert',
          name: 'The Great Desert',
          description: 'Vast expanse',
          region: 'Wilderness',
          dangerLevel: 4,
          connectedLocationIds: [],
          atmosphere: 'Scorching',
          threatClockDefault: { name: 'Water Reserves', maxSegments: 6, crisisDescription: 'Caravan dehydrates' },
        },
        {
          id: 'loc_desert_dune',
          name: 'Shifting Dunes',
          description: 'Dry sand',
          region: 'Wilderness',
          parentLocationId: 'loc_region_desert',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'Windy',
        },
      ],
    };

    const targetClockId = clockIdForLocation('loc_desert_dune', regionalBible);
    assert.equal(targetClockId, 'clock_loc_region_desert');

    const clock = ensureClockForLocation([], regionalBible.locations[1], regionalBible);
    assert.ok(clock);
    assert.equal(clock!.id, 'clock_loc_region_desert');
    assert.equal(clock!.name, 'Water Reserves');
    assert.equal(clock!.maxSegments, 6);
  });

  it('prunes regional threat clocks when moving to a destination city outside the region', () => {
    const regionalBible: WorldBible = {
      ...bible,
      locations: [
        {
          id: 'loc_region_desert',
          name: 'The Great Desert',
          description: 'Vast expanse',
          region: 'Wilderness',
          dangerLevel: 4,
          connectedLocationIds: [],
          atmosphere: 'Scorching',
          threatClockDefault: { name: 'Water Reserves', maxSegments: 6, crisisDescription: 'Caravan dehydrates' },
        },
        {
          id: 'loc_desert_dune',
          name: 'Shifting Dunes',
          description: 'Dry sand',
          region: 'Wilderness',
          parentLocationId: 'loc_region_desert',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'Windy',
        },
        {
          id: 'loc_river_city',
          name: 'River City',
          description: 'Lush river haven',
          region: 'River Valley',
          dangerLevel: 1,
          connectedLocationIds: [],
          atmosphere: 'Peaceful',
        },
      ],
    };

    const activeClocks = [
      { id: 'clock_loc_region_desert', name: 'Water Reserves', currentSegments: 3, maxSegments: 6, crisisDescription: '' },
      { id: 'quest_clock_timer', name: 'Story Countdown', currentSegments: 1, maxSegments: 4, crisisDescription: '' },
    ];

    // Inside the desert: desert clock stays
    const inDesert = pruneInactiveZoneClocks(activeClocks, 'loc_desert_dune', regionalBible);
    assert.equal(inDesert.length, 2);

    // Arrived in the river city: desert clock is pruned, non-zone quest clocks stay
    const inCity = pruneInactiveZoneClocks(activeClocks, 'loc_river_city', regionalBible);
    assert.equal(inCity.length, 1);
    assert.equal(inCity[0].id, 'quest_clock_timer');
  });

  it('suppresses threat clocks when sub-zone has suppressThreatClock or is sanctuary', () => {
    const sanctuaryBible: WorldBible = {
      ...bible,
      locations: [
        {
          id: 'loc_desert_post',
          name: 'Desert Outpost',
          description: 'Dry fortress',
          region: 'Desert',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'Dry',
          threatClockDefault: { name: 'Water', maxSegments: 7, crisisDescription: 'Thirst' },
          subZones: [
            {
              id: 'sz_cistern',
              name: 'Ancient Cistern',
              subType: 'sanctuary',
              dangerLevel: 1,
              atmosphere: 'Cool water',
              explorationHooks: [],
              pointsOfInterest: [],
            },
            {
              id: 'sz_resting_hall',
              name: 'Resting Hall',
              subType: 'vault',
              dangerLevel: 1,
              atmosphere: 'Quiet',
              explorationHooks: [],
              pointsOfInterest: [],
              suppressThreatClock: true,
            },
            {
              id: 'sz_ramparts',
              name: 'Sunny Ramparts',
              subType: 'hazard_zone',
              dangerLevel: 3,
              atmosphere: 'Hot stone',
              explorationHooks: [],
              pointsOfInterest: [],
            },
          ],
        },
      ],
    };

    const activeClocks = [
      { id: 'clock_loc_desert_post', name: 'Water', currentSegments: 3, maxSegments: 7, crisisDescription: 'Thirst' },
    ];

    // Inside normal ramparts: clock stays
    const inRamparts = pruneInactiveZoneClocks(activeClocks, 'loc_desert_post', sanctuaryBible, 'sz_ramparts');
    assert.equal(inRamparts.length, 1);

    // Inside sanctuary sub-zone: clock is suppressed and pruned
    const inCistern = pruneInactiveZoneClocks(activeClocks, 'loc_desert_post', sanctuaryBible, 'sz_cistern');
    assert.equal(inCistern.length, 0);

    // Inside explicit suppressThreatClock sub-zone: clock is suppressed and pruned
    const inRestingHall = pruneInactiveZoneClocks(activeClocks, 'loc_desert_post', sanctuaryBible, 'sz_resting_hall');
    assert.equal(inRestingHall.length, 0);

    // Ambient seeding respects sanctuary sub-zone: no clock seeded
    const seeded = seedAmbientClock([], 'loc_desert_post', sanctuaryBible, 'sz_cistern');
    assert.equal(seeded.length, 0);
  });

  it('stops ancestor clock inheritance when child location has suppressThreatClock: true', () => {
    const parentBible: WorldBible = {
      ...bible,
      locations: [
        {
          id: 'loc_desert_parent',
          name: 'The Great Desert',
          description: 'Dry desert',
          region: 'Desert',
          dangerLevel: 4,
          connectedLocationIds: [],
          atmosphere: 'Burning',
          threatClockDefault: { name: 'Water', maxSegments: 7, crisisDescription: 'Thirst' },
        },
        {
          id: 'loc_oasis_station',
          name: 'Safe Oasis Station',
          description: 'A protected post',
          region: 'Desert',
          parentLocationId: 'loc_desert_parent',
          dangerLevel: 1,
          connectedLocationIds: [],
          atmosphere: 'Peaceful',
          suppressThreatClock: true,
        },
      ],
    };

    // Does not inherit parent clock
    const clock = ensureClockForLocation([], parentBible.locations[1], parentBible);
    assert.equal(clock, null);

    // Prunes parent clock upon entering the safe station
    const active = [{ id: 'clock_loc_desert_parent', name: 'Water', currentSegments: 2, maxSegments: 7, crisisDescription: '' }];
    const pruned = pruneInactiveZoneClocks(active, 'loc_oasis_station', parentBible);
    assert.equal(pruned.length, 0);
  });
});

describe('Plan 13: hazard displacement', () => {
  it('displaces to hazardFallbackLocationId on high-risk failure', () => {
    assert.equal(resolveDisplacement(bible, 'loc_battlements', 'high', 'failure'), 'loc_moat');
    assert.equal(resolveDisplacement(bible, 'loc_battlements', 'high', 'critical_failure'), 'loc_moat');
  });

  it('does not displace on low/medium risk, success, or missing fallback', () => {
    assert.equal(resolveDisplacement(bible, 'loc_battlements', 'low', 'failure'), undefined);
    assert.equal(resolveDisplacement(bible, 'loc_battlements', 'high', 'success'), undefined);
    assert.equal(resolveDisplacement(bible, 'loc_moat', 'high', 'failure'), undefined);
  });

  it('resolveActionCheck wires displacement + clock into the resolution', () => {
    const res = GameEngine.resolveActionCheck('leap across the chasm', baseState, rpg, {
      riskLevel: 'high',
      forcedDiceRoll: 1, // nat 1 → critical_failure
      worldBible: bible,
      currentLocationId: 'loc_battlements',
      activeClocks: [],
    });
    assert.equal(res.outcome, 'critical_failure');
    assert.equal(res.displacedLocationId, 'loc_moat');
    assert.equal(res.stateDiff.locationChange, 'loc_moat');
    assert.ok(res.clockUpdate);
    assert.equal(res.clockUpdate!.clockId, 'clock_loc_battlements');
  });

  it('applyStateMutation moves location and persists the clock', () => {
    const res = GameEngine.resolveActionCheck('scale the battlements', baseState, rpg, {
      riskLevel: 'high',
      forcedDiceRoll: 1,
      worldBible: bible,
      currentLocationId: 'loc_battlements',
      activeClocks: [],
    });
    const updated = GameEngine.applyStateMutation(baseState, res.stateDiff, rpg);
    assert.equal(updated.currentLocationId, 'loc_moat');
    assert.ok(updated.discoveredLocationIds.includes('loc_moat'));
    const clock = (updated.activeTensionClocks ?? []).find((c) => c.id === 'clock_loc_battlements');
    assert.ok(clock);
    assert.equal(clock!.currentSegments, 2); // crit_fail ticks +2 from 0
  });
});

describe('Plan 13 follow-up: ambient seeding & writer clock authority', () => {
  it('seeds the ambient clock at 0/max on entry and is idempotent', () => {
    const seeded = seedAmbientClock([], 'loc_battlements', bible);
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].id, 'clock_loc_battlements');
    assert.equal(seeded[0].currentSegments, 0);
    assert.equal(seeded[0].maxSegments, 4);
    assert.equal(seeded[0].name, 'City Watch Alert');

    const again = seedAmbientClock(seeded, 'loc_battlements', bible);
    assert.equal(again, seeded, 'existing clock is never reset or duplicated');
  });

  it('seeds the regional ancestor clock for a child location and skips clockless zones', () => {
    const regionalBible: WorldBible = {
      ...bible,
      locations: [
        {
          id: 'loc_region_desert',
          name: 'The Great Desert',
          description: 'Vast expanse',
          region: 'Wilderness',
          dangerLevel: 4,
          connectedLocationIds: [],
          atmosphere: 'Scorching',
          threatClockDefault: { name: 'ذخیره آب کاروان', maxSegments: 6, crisisDescription: 'آب تمام می‌شود' },
        },
        {
          id: 'loc_desert_dune',
          name: 'Shifting Dunes',
          description: 'Dry sand',
          region: 'Wilderness',
          parentLocationId: 'loc_region_desert',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'Windy',
        },
      ],
    };

    const seeded = seedAmbientClock([], 'loc_desert_dune', regionalBible);
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].id, 'clock_loc_region_desert');
    assert.equal(seeded[0].name, 'ذخیره آب کاروان');

    assert.equal(seedAmbientClock([], 'loc_moat', bible).length, 0);
  });

  it('normalizes writer clock payload aliases and clamps raw deltas', () => {
    const normalized = normalizeClockChanges([
      { name: 'City Watch Alert', delta: 9, evidence: 'the alarm bell rings' },
      { clockId: 'clock_loc_battlements', delta: -5, reason: 'you bribe the watch' },
      { clockName: 'Zero', delta: 0 },
      { delta: 1 },
    ]);
    assert.equal(normalized.length, 2);
    assert.equal(normalized[0].clockName, 'City Watch Alert');
    assert.equal(normalized[0].delta, MAX_CLOCK_DELTA_PER_TURN);
    assert.equal(normalized[1].delta, -MAX_CLOCK_DELTA_PER_TURN);
  });

  it('resolves by id and by ZWNJ-insensitive clock name', () => {
    const clocks = seedAmbientClock([], 'loc_battlements', bible);
    const byName = resolveDeclaredClockChanges({
      declared: [{ clockName: 'city watch  alert', delta: 1, reason: 'the patrol spots you' }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(byName.applied.length, 1);
    assert.equal(byName.applied[0].clockId, 'clock_loc_battlements');
    assert.equal(byName.applied[0].newSegments, 1);

    const byId = resolveDeclaredClockChanges({
      declared: [{ clockId: 'clock_loc_battlements', delta: 2, reason: 'a fight breaks out' }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(byId.applied[0].newSegments, 2);
  });

  it('seeds a missing ambient clock before applying the writer delta', () => {
    const res = resolveDeclaredClockChanges({
      declared: [{ clockName: 'City Watch Alert', delta: 1, reason: 'the gates slam shut' }],
      activeClocks: [],
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(res.clocks.length, 1);
    assert.equal(res.applied[0].previousSegments, 0);
    assert.equal(res.applied[0].newSegments, 1);
  });

  it('requires a prose reason and rejects unknown or spent clocks', () => {
    const clocks = seedAmbientClock([], 'loc_battlements', bible);
    const noReason = resolveDeclaredClockChanges({
      declared: [{ clockName: 'City Watch Alert', delta: 1 }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(noReason.applied.length, 0);
    assert.equal(noReason.clocks[0].currentSegments, 0, 'rejected change never moves the clock');

    const unknown = resolveDeclaredClockChanges({
      declared: [{ clockName: 'Moon Phase', delta: 1, reason: 'the moon rises' }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(unknown.applied.length, 0);

    const triggered = [{ ...clocks[0], currentSegments: 4, isTriggered: true }];
    const spent = resolveDeclaredClockChanges({
      declared: [{ clockName: 'City Watch Alert', delta: 1, reason: 'more guards arrive' }],
      activeClocks: triggered,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(spent.applied.length, 0);
  });

  it('clamps merges, fills to crisis exactly once, and can relieve to zero', () => {
    const clocks = [{ ...seedAmbientClock([], 'loc_battlements', bible)[0], currentSegments: 3 }];
    const crisis = resolveDeclaredClockChanges({
      declared: [
        { clockName: 'City Watch Alert', delta: 2, reason: 'the alarm sounds' },
        { clockName: 'City Watch Alert', delta: 2, reason: 'reinforcements arrive' },
      ],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(crisis.applied.length, 1);
    assert.equal(crisis.applied[0].delta, 1, 'effective movement saturates at max');
    assert.equal(crisis.applied[0].newSegments, 4);
    assert.equal(crisis.applied[0].isCrisis, true);
    assert.equal(crisis.applied[0].crisisDescription, 'Guards breach the doors');
    assert.equal(crisis.clocks[0].isTriggered, true);

    const relief = resolveDeclaredClockChanges({
      declared: [{ clockName: 'City Watch Alert', delta: -2, reason: 'you douse the alarm' }],
      activeClocks: [{ ...clocks[0], currentSegments: 2 }],
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(relief.applied[0].newSegments, 0);
    assert.equal(relief.applied[0].isCrisis, false);
    assert.equal(relief.clocks[0].isTriggered, false);
  });

  it('skips a clock the dice engine already advanced this turn', () => {
    const clocks = seedAmbientClock([], 'loc_battlements', bible);
    const res = resolveDeclaredClockChanges({
      declared: [{ clockId: 'clock_loc_battlements', delta: 1, reason: 'same complication' }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
      skipClockIds: ['clock_loc_battlements'],
    });
    assert.equal(res.applied.length, 0);
    assert.equal(res.clocks[0].currentSegments, 0);
  });

  it('does not report a crisis for a clock that was already full and triggered', () => {
    const clocks = [{ ...seedAmbientClock([], 'loc_battlements', bible)[0], currentSegments: 4, isTriggered: true }];
    const res = resolveDeclaredClockChanges({
      declared: [{ clockName: 'City Watch Alert', delta: -1, reason: 'the watch stands down' }],
      activeClocks: clocks,
      locationId: 'loc_battlements',
      worldBible: bible,
    });
    assert.equal(res.applied.length, 0);
  });
});

describe('Plan 13 follow-up: journey-aware clock zone', () => {
  // Mirrors the production shape: a zone that owns a threat clock, a sanctuary
  // child that suppresses the inherited clock, and a plain child that inherits.
  const journeyBible: WorldBible = {
    ...bible,
    locations: [
      {
        id: 'loc_hiram',
        name: 'Hiram Plains',
        description: 'Open desert',
        region: 'Desert',
        dangerLevel: 4,
        connectedLocationIds: [],
        atmosphere: 'Scorching',
        threatClockDefault: { name: 'Water', maxSegments: 5, crisisDescription: 'The caravan runs dry' },
      },
      {
        id: 'loc_rabat',
        name: 'Red Rabat',
        description: 'Fortified shelter',
        region: 'Desert',
        parentLocationId: 'loc_hiram',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: 'Calm',
        suppressThreatClock: true,
      },
      {
        id: 'loc_ridges',
        name: 'Western Ridges',
        description: 'Rocky ridges',
        region: 'Desert',
        parentLocationId: 'loc_hiram',
        dangerLevel: 3,
        connectedLocationIds: [],
        atmosphere: 'Windy',
      },
    ],
  };

  it('uses the current location as the clock zone while the player is at rest', () => {
    assert.equal(resolveClockZoneLocationId({ currentLocationId: 'loc_rabat' }, journeyBible), 'loc_rabat');
    assert.equal(resolveClockZoneLocationId({ currentLocationId: 'loc_hiram' }, journeyBible), 'loc_hiram');
  });

  it('hands the clock zone to the destination while travelling into a clock zone', () => {
    const state = { currentLocationId: 'loc_rabat', travel: { destinationLocationId: 'loc_hiram' } };
    assert.equal(resolveClockZoneLocationId(state, journeyBible), 'loc_hiram');
  });

  it('keeps the origin zone while travelling toward a sanctuary destination', () => {
    const state = { currentLocationId: 'loc_hiram', travel: { destinationLocationId: 'loc_rabat' } };
    assert.equal(resolveClockZoneLocationId(state, journeyBible), 'loc_hiram');
  });

  it('shows the destination clock while travelling out of a sanctuary', () => {
    const state = { currentLocationId: 'loc_rabat', travel: { destinationLocationId: 'loc_hiram' } };
    const clocks = refreshZoneThreatClocks([], state, journeyBible);
    assert.equal(clocks.length, 1);
    assert.equal(clocks[0].id, 'clock_loc_hiram');
    assert.equal(clocks[0].name, 'Water');
    assert.equal(clocks[0].currentSegments, 0);
    assert.equal(clocks[0].maxSegments, 5);
  });

  it('shows the inherited zone clock while travelling into a child of the clock zone', () => {
    const state = { currentLocationId: 'loc_rabat', travel: { destinationLocationId: 'loc_ridges' } };
    const clocks = refreshZoneThreatClocks([], state, journeyBible);
    assert.equal(clocks.length, 1);
    assert.equal(clocks[0].id, 'clock_loc_hiram');
  });

  it('shows no clock while resting inside the sanctuary', () => {
    const clocks = refreshZoneThreatClocks([], { currentLocationId: 'loc_rabat' }, journeyBible);
    assert.equal(clocks.length, 0);
  });

  it('drops the zone clock once the caravan arrives inside the sanctuary', () => {
    const active = [
      { id: 'clock_loc_hiram', name: 'Water', currentSegments: 2, maxSegments: 5, crisisDescription: '' },
    ];
    const clocks = refreshZoneThreatClocks(active, { currentLocationId: 'loc_rabat' }, journeyBible);
    assert.equal(clocks.length, 0);
  });

  it('keeps the zone clock running (and its progress) while travelling toward a sanctuary', () => {
    const active = [
      { id: 'clock_loc_hiram', name: 'Water', currentSegments: 2, maxSegments: 5, crisisDescription: '' },
    ];
    const clocks = refreshZoneThreatClocks(active, {
      currentLocationId: 'loc_hiram',
      travel: { destinationLocationId: 'loc_rabat' },
    }, journeyBible);
    assert.equal(clocks.length, 1);
    assert.equal(clocks[0].currentSegments, 2, 'segment progress survives the journey');
  });

  it('never resets clock progress when the zone is refreshed', () => {
    const active = [
      { id: 'clock_loc_hiram', name: 'Water', currentSegments: 3, maxSegments: 5, crisisDescription: '' },
    ];
    const clocks = refreshZoneThreatClocks(active, { currentLocationId: 'loc_hiram' }, journeyBible);
    assert.equal(clocks.length, 1);
    assert.equal(clocks[0].currentSegments, 3);
  });

  it('leaves non-location clocks untouched while pruning', () => {
    const active = [
      { id: 'clock_story_arc', name: 'Arc tension', currentSegments: 1, maxSegments: 4, crisisDescription: '' },
    ];
    const clocks = refreshZoneThreatClocks(active, { currentLocationId: 'loc_rabat' }, journeyBible);
    assert.equal(clocks.length, 1);
    assert.equal(clocks[0].id, 'clock_story_arc');
  });
});
