import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MapEntityPlacement, WorldBible } from '@/lib/types';
import {
  buildLorePlacement,
  listLoreCandidates,
  loreKindForTool,
  loreKindLabel,
  makeLorePlacementId,
} from './lorePlacement';

function bible(overrides: Partial<WorldBible> = {}): WorldBible {
  return {
    worldId: 'w1',
    worldName: 'Test World',
    summary: '',
    themeNotes: '',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    ...overrides,
  };
}

const npc = (id: string, name: string) => ({
  id,
  name,
  title: 'Keeper of the Gate',
  role: 'guard',
  currentLocationId: 'loc_1',
  personalityTraits: [],
  speechStyle: '',
  goals: [],
  secrets: [],
  initialTrust: 0,
});

describe('lorePlacement — Civilization & Lore tools', () => {
  it('maps every lore tool to a pin kind and nothing else', () => {
    assert.equal(loreKindForTool('place_npc'), 'npc');
    assert.equal(loreKindForTool('place_creature'), 'bestiary');
    assert.equal(loreKindForTool('place_relic'), 'artifact');
    assert.equal(loreKindForTool('place_deity'), 'deity');
    assert.equal(loreKindForTool('place_timeline'), 'timeline');

    // Geometry tools and the settlement/road tools are not lore pins.
    assert.equal(loreKindForTool('terrain_river'), null);
    assert.equal(loreKindForTool('place_settlement'), null);
    assert.equal(loreKindForTool('draw_caravan'), null);
    assert.equal(loreKindForTool(undefined), null);
  });

  it('labels a kind in both languages', () => {
    assert.equal(loreKindLabel('npc', false), 'NPC');
    assert.equal(loreKindLabel('npc', true), 'شخصیت');
  });

  it('lists candidates from the matching world-bible array', () => {
    const world = bible({
      npcs: [npc('npc_1', 'Yara the Gatekeeper')],
      bestiary: [
        {
          id: 'c_1',
          name: 'Ash Drake',
          speciesCategory: 'draconic',
          dangerLevel: 4,
          habitatLocationIds: [],
          behavioralTactics: '',
          weaknesses: [],
          resistances: [],
          harvestableLoot: [],
          loreDescription: '',
        },
      ],
      artifacts: [
        {
          id: 'a_1',
          name: 'The Ninth Key',
          title: 'Key',
          originEra: 'Second Age',
          rarity: 'legendary',
          description: '',
          powers: [],
          currentHolderType: 'vault',
          currentHolderId: 'vault_1',
        },
      ],
      religions: [
        {
          id: 'd_1',
          name: 'Zarvan',
          title: 'Flame-Bearer',
          domain: 'forge',
          sacredSymbol: 'flame',
          coreDogma: '',
          taboos: [],
          divineBlessings: [],
          affiliatedFactionIds: [],
          holyLocationIds: [],
        },
      ],
      timeline: [
        {
          id: 't_1',
          yearOrEra: 'Year 812',
          title: 'The Long Siege',
          summary: '',
          significance: '',
          knownByPublic: true,
        },
      ],
    });

    assert.equal(listLoreCandidates(world, 'npc')[0]?.name, 'Yara the Gatekeeper');
    assert.equal(listLoreCandidates(world, 'bestiary')[0]?.name, 'Ash Drake');
    assert.equal(listLoreCandidates(world, 'artifact')[0]?.name, 'The Ninth Key');
    assert.equal(listLoreCandidates(world, 'deity')[0]?.name, 'Zarvan');
    assert.equal(listLoreCandidates(world, 'timeline')[0]?.name, 'The Long Siege');

    // Subtitles carry the useful second line.
    assert.match(listLoreCandidates(world, 'npc')[0].subtitle, /Keeper of the Gate/);
    assert.match(listLoreCandidates(world, 'bestiary')[0].subtitle, /Draconic/);
    assert.match(listLoreCandidates(world, 'timeline')[0].subtitle, /Year 812/);
  });

  it('flags entities that are already pinned, per kind', () => {
    const world = bible({
      npcs: [npc('npc_1', 'Yara')],
      religions: [
        {
          id: 'npc_1',
          name: 'Zarvan',
          title: '',
          domain: 'light',
          sacredSymbol: '',
          coreDogma: '',
          taboos: [],
          divineBlessings: [],
          affiliatedFactionIds: [],
          holyLocationIds: [],
        },
      ],
    });

    // Same id, different kind: only the npc pin counts for the npc list.
    const placements: MapEntityPlacement[] = [
      { id: 'pin_a', entityId: 'npc_1', entityType: 'npc', x: 10, y: 20 },
    ];

    assert.equal(listLoreCandidates(world, 'npc', placements)[0].pinned, true);
    assert.equal(listLoreCandidates(world, 'deity', placements)[0].pinned, false);
  });

  it('returns an empty list for a world that has no entities of that kind', () => {
    const world = bible();
    for (const kind of ['npc', 'bestiary', 'artifact', 'deity', 'timeline'] as const) {
      assert.deepEqual(listLoreCandidates(world, kind), []);
    }
    assert.deepEqual(listLoreCandidates(null, 'npc'), []);
  });

  it('builds a labelled pin at rounded coordinates', () => {
    const pin = buildLorePlacement('pin_1', 'deity', 'd_1', 'Zarvan', { x: 120.4, y: 88.8 });

    assert.equal(pin.id, 'pin_1');
    assert.equal(pin.entityId, 'd_1');
    assert.equal(pin.entityType, 'deity');
    assert.deepEqual({ x: pin.x, y: pin.y }, { x: 120, y: 89 });
    // The label is what makes the pin readable on the map.
    assert.equal(pin.customLabel, 'Zarvan');
  });

  it('makes ids in the Cartographer pin shape', () => {
    assert.match(makeLorePlacementId(0), /^pin_0$/);
    assert.match(makeLorePlacementId(1_700_000_000_000), /^pin_[0-9a-z]+$/);
  });
});