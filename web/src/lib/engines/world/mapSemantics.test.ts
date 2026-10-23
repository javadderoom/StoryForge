import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  MapEntityPlacement,
  MapTerrainFeature,
  StoryBeat,
  WorldBible,
  WorldLocation,
  WorldMapData,
  WorldTradeRoute,
} from '@/lib/types/world';
import { auditMapSemantics, getMapSemanticReconciliation } from './mapSemantics';

function makeWb(partial: Partial<WorldBible> = {}): WorldBible {
  return {
    worldId: 'world_test',
    worldName: 'Test World',
    summary: '',
    themeNotes: '',
    factions: [],
    locations: [],
    npcs: [],
    artifacts: [],
    bestiary: [],
    religions: [],
    timeline: [],
    laws: [],
    ...partial,
  } as unknown as WorldBible;
}

function location(over: Partial<WorldLocation> = {}): WorldLocation {
  return {
    id: 'loc_1',
    name: 'Town',
    description: '',
    region: '',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
    ...over,
  } as WorldLocation;
}

function terrain(over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return {
    id: 'terr_1',
    name: 'River',
    type: 'river',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    ...over,
  } as MapTerrainFeature;
}

function mapData(features: MapTerrainFeature[], placements: MapEntityPlacement[] = []): WorldMapData {
  return {
    version: 1,
    settings: {
      width: 2400,
      height: 1600,
      theme: 'parchment',
      gridType: 'none',
      gridSize: 40,
      showGridCoordinates: false,
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
        grid: false,
      },
    },
    terrainFeatures: features,
    placements,
  };
}

function beat(over: Partial<StoryBeat> = {}): StoryBeat {
  return {
    sceneId: 'scene_1',
    locationId: 'loc_1',
    narrativeText: '',
    choices: [],
    ...over,
  } as StoryBeat;
}

describe('mapSemantics — place links', () => {
  it('warns about a non-point place with no linked terrain', () => {
    const issues = auditMapSemantics(
      makeWb({
        locations: [location({ id: 'loc_river', category: 'waterway' })],
        mapData: mapData([]),
      })
    );
    assert.equal(issues.filter((issue) => issue.code === 'unlinked_non_point_place').length, 1);
  });

  it('does not warn when a non-point place has linked terrain', () => {
    const issues = auditMapSemantics(
      makeWb({
        locations: [location({ id: 'loc_river', category: 'waterway' })],
        mapData: mapData([terrain({ locationId: 'loc_river' })]),
      })
    );
    assert.equal(issues.filter((issue) => issue.code === 'unlinked_non_point_place').length, 0);
  });

  it('does not require a terrain link for a point place', () => {
    const issues = auditMapSemantics(
      makeWb({
        locations: [location({ category: 'settlement' })],
        mapData: mapData([]),
      })
    );
    assert.equal(issues.filter((issue) => issue.code === 'unlinked_non_point_place').length, 0);
  });

  it('reports terrain linked to a missing place', () => {
    const issues = auditMapSemantics(
      makeWb({ mapData: mapData([terrain({ locationId: 'loc_missing' })]) })
    );
    const issue = issues.find((entry) => entry.code === 'terrain_place_missing');
    assert.equal(issue?.severity, 'error');
    assert.match(issue?.message ?? '', /loc_missing/);
  });
});

describe('mapSemantics — story references', () => {
  it('reports a beat anchored to a missing place', () => {
    const issues = auditMapSemantics(makeWb(), {
      beats: [beat({ locationId: 'loc_missing' })],
    });
    assert.equal(issues.filter((issue) => issue.code === 'beat_location_missing').length, 1);
  });

  it('reports a pin pointing at a missing entity', () => {
    const issues = auditMapSemantics(
      makeWb({
        mapData: mapData([], [
          {
            id: 'pin_1',
            entityId: 'npc_missing',
            entityType: 'npc',
            x: 10,
            y: 10,
          },
        ]),
      })
    );
    assert.equal(issues.filter((issue) => issue.code === 'pin_entity_missing').length, 1);
  });

  it('reports a route endpoint that does not resolve', () => {
    const route: WorldTradeRoute = {
      id: 'tr_1',
      name: 'Road',
      originLocationId: 'loc_missing',
      destinationLocationId: 'loc_1',
    };
    const issues = auditMapSemantics(
      makeWb({ locations: [location()], tradeRoutes: [route] })
    );
    assert.equal(issues.filter((issue) => issue.code === 'route_endpoint_missing').length, 1);
  });

  it('reports duplicate place and terrain names as warnings', () => {
    const issues = auditMapSemantics(
      makeWb({
        locations: [location({ id: 'loc_a', name: 'Ashen Ford' }), location({ id: 'loc_b', name: 'ashen ford' })],
        mapData: mapData([
          terrain({ id: 'terr_a', name: 'Blue River' }),
          terrain({ id: 'terr_b', name: 'Blue River' }),
        ]),
      })
    );
    assert.equal(issues.filter((issue) => issue.code === 'duplicate_place_name').length, 1);
    assert.equal(issues.filter((issue) => issue.code === 'duplicate_terrain_name').length, 1);
    assert.equal(issues.find((issue) => issue.code === 'duplicate_place_name')?.severity, 'warning');
  });
});

describe('mapSemantics — reconciliation view', () => {
  it('lists unlinked non-point places and broken terrain links', () => {
    const result = getMapSemanticReconciliation(
      makeWb({
        locations: [
          location({ id: 'loc_river', name: 'River', category: 'waterway' }),
          location({ id: 'loc_town', name: 'Town', category: 'settlement' }),
        ],
      }),
      mapData([terrain({ id: 'terr_broken', locationId: 'loc_missing' })])
    );
    assert.deepEqual(result.unlinkedPlaces.map((place) => place.id), ['loc_river']);
    assert.deepEqual(result.missingPlaceLinks.map((feature) => feature.id), ['terr_broken']);
  });
});