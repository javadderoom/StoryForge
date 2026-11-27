import test from 'node:test';
import assert from 'node:assert/strict';
import { syncWorldEntitiesToMap } from './syncMapPlacements';
import type { StoryEncounter, WorldBible } from '@/lib/types';

function makeWorldBible(): WorldBible {
  return {
    worldId: 'w_test',
    worldName: 'Test World',
    summary: '',
    themeNotes: '',
    locations: [
      {
        id: 'loc_a',
        name: 'Chahsang',
        description: 'Well town',
        dangerLevel: 2,
        coordinates: { x: 400, y: 600 },
      },
      {
        id: 'loc_b',
        name: 'Far City',
        description: 'Distant',
        dangerLevel: 3,
        coordinates: { x: 1800, y: 400 },
      },
    ],
    factions: [
      {
        id: 'fac_1',
        name: 'Raiders',
        description: 'Bandits',
        alignment: 'Chaotic',
        territoryIds: ['loc_a'],
        rivalFactionIds: [],
        alliedFactionIds: [],
        publicGoals: 'Loot',
      },
    ],
    npcs: [
      {
        id: 'npc_1',
        name: 'Borzou',
        title: 'Caravan Master',
        kind: 'individual',
        currentLocationId: 'loc_a',
        personalityTraits: [],
        goals: [],
        speechStyle: '',
        initialTrust: 0,
      },
      {
        id: 'npc_2',
        name: 'Far Guard',
        title: 'Guard',
        kind: 'template',
        currentLocationId: 'loc_b',
        personalityTraits: [],
        goals: [],
        speechStyle: '',
        initialTrust: 0,
      },
    ],
    bestiary: [
      {
        id: 'beast_1',
        name: 'Salt Scorpion',
        speciesCategory: 'beast',
        dangerLevel: 3,
        description: 'Venomous',
        habitatLocationIds: ['loc_a'],
      },
    ],
    artifacts: [
      {
        id: 'art_1',
        name: 'Water Tally',
        title: 'Tally',
        originEra: 'Current',
        rarity: 'uncommon',
        description: 'Notched stick',
        powers: [],
        currentHolderType: 'location',
        currentHolderId: 'loc_a',
      },
    ],
    quests: [
      {
        id: 'q_1',
        title: 'Escort Caravan',
        summary: 'Reach Shakh Zarrin',
        giverNpcId: 'npc_1',
        originLocationId: 'loc_a',
        objectives: [],
      },
    ],
    timeline: [
      {
        id: 'evt_1',
        title: 'Wells Dry Up',
        yearOrEra: 'Year 1',
        eraCategory: 'contemporary',
        summary: 'Drought',
        linkedLocationIds: ['loc_a'],
      },
    ],
    religions: [],
    mapData: {
      version: 1,
      settings: {
        width: 2400,
        height: 1600,
        theme: 'parchment',
        gridType: 'hex',
        gridSize: 50,
        showGridCoordinates: true,
        visibleLayers: {
          terrain: true,
          water: true,
          mountains: true,
          valleys: true,
          biomes: true,
          settlements: true,
          caravanRoutes: true,
          npcs: true,
          bestiary: true,
          relics: true,
          deities: true,
          timeline: true,
          factionBorders: true,
          labels: true,
          grid: true,
        },
      },
      terrainFeatures: [],
      placements: [
        {
          id: 'pin_existing_npc',
          entityId: 'npc_1',
          entityType: 'npc',
          x: 410,
          y: 610,
          customLabel: 'Borzou',
        },
      ],
    },
  } as unknown as WorldBible;
}

test('syncWorldEntitiesToMap places unplaced entities without duplicating existing pins', () => {
  const wb = makeWorldBible();
  const encounters: StoryEncounter[] = [
    {
      id: 'enc_1',
      title: 'Water Rationing',
      narrativeText: 'Test encounter',
      locationId: 'loc_a',
      locationTags: [],
      triggerConditions: {
        triggerType: 'on_enter',
        weight: 80,
        repeatable: false,
        requiredItemIds: [],
        requiredCompletedEventIds: [],
        forbiddenEventIds: [],
      },
    },
  ];

  const res = syncWorldEntitiesToMap({
    worldBible: wb,
    encounters,
    scopeLocationIds: ['loc_a'],
  });

  // npc_1 already pinned, npc_2 outside scope -> should NOT be added
  assert.equal(res.added.some((p) => p.entityId === 'npc_1'), false);
  assert.equal(res.added.some((p) => p.entityId === 'npc_2'), false);

  // loc_a entities should all be added
  assert.equal(res.added.some((p) => p.entityType === 'encounter' && p.entityId === 'enc_1'), true);
  assert.equal(res.added.some((p) => p.entityType === 'quest' && p.entityId === 'q_1'), true);
  assert.equal(res.added.some((p) => p.entityType === 'faction_outpost' && p.entityId === 'fac_1'), true);
  assert.equal(res.added.some((p) => p.entityType === 'bestiary' && p.entityId === 'beast_1'), true);
  assert.equal(res.added.some((p) => p.entityType === 'artifact' && p.entityId === 'art_1'), true);
  assert.equal(res.added.some((p) => p.entityType === 'timeline' && p.entityId === 'evt_1'), true);

  // Existing pin preserved untouched at index 0
  assert.equal(res.nextPlacements[0].id, 'pin_existing_npc');
  assert.equal(res.nextPlacements[0].x, 410);

  // All newly added pins maintain non-overlapping spacing
  for (let i = 0; i < res.added.length; i++) {
    for (let j = i + 1; j < res.added.length; j++) {
      const dx = res.added[i].x - res.added[j].x;
      const dy = res.added[i].y - res.added[j].y;
      assert.ok(Math.hypot(dx, dy) >= 20, `Pins ${res.added[i].id} and ${res.added[j].id} overlap`);
    }
  }
});

test('syncWorldEntitiesToMap tags template NPCs with group icon', () => {
  const wb = makeWorldBible();
  const res = syncWorldEntitiesToMap({ worldBible: wb });
  const guardPin = res.added.find((p) => p.entityId === 'npc_2');
  assert.ok(guardPin);
  assert.equal(guardPin.customIcon, 'group');
});
