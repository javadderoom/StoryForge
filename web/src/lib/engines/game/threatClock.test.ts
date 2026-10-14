import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tickTensionClock,
  ensureClockForLocation,
  resolveDisplacement,
  clockIdForLocation,
  pruneInactiveZoneClocks,
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
