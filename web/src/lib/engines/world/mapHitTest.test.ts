import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EDGE_TOLERANCE,
  DEFAULT_GRAB_RADIUS,
  HIT_TIER,
  buildMapHitCandidates,
  compareMapHits,
  distanceToPolyline,
  distanceToSegment,
  hitTestMapObjects,
  hitTestMapObjectsIn,
  pointInPolygon,
  ringArea,
  type MapHitCandidate,
} from './mapHitTest';
import type {
  MapEntityPlacement,
  MapPoint,
  MapTerrainFeature,
  WorldLocation,
  WorldMapSettings,
  WorldTradeRoute,
} from '@/lib/types/world';

const SQUARE: MapPoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

function terrain(over: Partial<MapTerrainFeature> = {}): MapTerrainFeature {
  return {
    id: 'terr_1',
    name: 'Continent',
    type: 'continent',
    polygon: SQUARE,
    ...over,
  } as MapTerrainFeature;
}

function location(over: Partial<WorldLocation> = {}): WorldLocation {
  return {
    id: 'loc_1',
    name: 'Town',
    coordinates: { x: 50, y: 50 },
    ...over,
  } as WorldLocation;
}

function placement(over: Partial<MapEntityPlacement> = {}): MapEntityPlacement {
  return {
    id: 'pin_1',
    entityId: 'npc_1',
    entityType: 'npc',
    x: 50,
    y: 50,
    ...over,
  } as MapEntityPlacement;
}

function route(over: Partial<WorldTradeRoute> = {}): WorldTradeRoute {
  return {
    id: 'tr_1',
    name: 'Road',
    originLocationId: 'loc_a',
    destinationLocationId: 'loc_b',
    waypoints: [],
    ...over,
  } as WorldTradeRoute;
}

function layers(
  over: Partial<WorldMapSettings['visibleLayers']> = {}
): WorldMapSettings['visibleLayers'] {
  return {
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
    ...over,
  };
}

describe('mapHitTest — geometry primitives', () => {
  it('detects a point inside a ring', () => {
    assert.equal(pointInPolygon({ x: 50, y: 50 }, SQUARE), true);
  });

  it('detects a point outside a ring', () => {
    assert.equal(pointInPolygon({ x: 150, y: 50 }, SQUARE), false);
    assert.equal(pointInPolygon({ x: -5, y: 50 }, SQUARE), false);
  });

  it('measures the distance to a segment', () => {
    assert.equal(distanceToSegment({ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 }), 10);
    assert.equal(distanceToSegment({ x: 50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }), 0);
    // Beyond the end of the segment the distance is measured to the endpoint.
    assert.equal(distanceToSegment({ x: 150, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }), 50);
  });

  it('measures the distance to a polyline', () => {
    const line: MapPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    assert.equal(distanceToPolyline({ x: 50, y: 20 }, line), 20);
  });

  it('computes the area of a ring', () => {
    assert.equal(ringArea(SQUARE), 10000);
  });
});

describe('mapHitTest — picking authored shapes', () => {
  it('picks a landmass when the click lands inside its polygon', () => {
    const hit = hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [terrain()] });
    assert.ok(hit);
    assert.equal(hit.kind, 'terrain');
    assert.equal(hit.tier, HIT_TIER.AREA);
    assert.equal(hit.distance, 0);
  });

  it('picks a landmass when the click lands near its coastline', () => {
    // 5 units off the eastern shore — inside the edge tolerance.
    const hit = hitTestMapObjectsIn({ x: 105, y: 50 }, { terrainFeatures: [terrain()] });
    assert.ok(hit);
    assert.equal(hit.kind, 'terrain');
    assert.ok(hit.distance > 0 && hit.distance <= DEFAULT_EDGE_TOLERANCE);
  });

  it('misses a landmass when the click is far away', () => {
    assert.equal(hitTestMapObjectsIn({ x: 400, y: 400 }, { terrainFeatures: [terrain()] }), null);
  });

  it('misses a landmass when the click lands inside one of its holes', () => {
    const holed = terrain({
      holes: [
        [
          { x: 40, y: 40 },
          { x: 60, y: 40 },
          { x: 60, y: 60 },
          { x: 40, y: 60 },
        ],
      ],
    });
    assert.equal(hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [holed] }), null);
  });

  it('picks a river polyline', () => {
    const river = terrain({
      id: 'terr_river',
      name: 'River',
      type: 'river',
      polygon: undefined,
      points: [
        { x: 0, y: 200 },
        { x: 200, y: 200 },
      ],
    });
    const hit = hitTestMapObjectsIn({ x: 100, y: 203 }, { terrainFeatures: [river] });
    assert.ok(hit);
    assert.equal(hit.kind, 'terrain');
    assert.equal(hit.tier, HIT_TIER.LINE);
  });

  it('picks a point feature such as a peak', () => {
    const peak = terrain({
      id: 'terr_peak',
      name: 'Peak',
      type: 'peak',
      polygon: undefined,
      x: 300,
      y: 300,
      radius: 20,
    });
    const hit = hitTestMapObjectsIn({ x: 305, y: 305 }, { terrainFeatures: [peak] });
    assert.ok(hit);
    assert.equal(hit.tier, HIT_TIER.POINT);
  });

  it('picks a lore pin', () => {
    const hit = hitTestMapObjectsIn({ x: 50, y: 50 }, { placements: [placement()] });
    assert.ok(hit);
    assert.equal(hit.kind, 'placement');
    assert.equal(hit.tier, HIT_TIER.PIN);
  });
});

describe('mapHitTest — priority', () => {
  it('prefers a settlement over the landmass it stands on', () => {
    const hit = hitTestMapObjectsIn(
      { x: 50, y: 50 },
      { terrainFeatures: [terrain()], locations: [location()] }
    );
    assert.ok(hit);
    assert.equal(hit.kind, 'location');
  });

  it('prefers a lore pin over the landmass it stands on', () => {
    const hit = hitTestMapObjectsIn(
      { x: 50, y: 50 },
      { terrainFeatures: [terrain()], placements: [placement()] }
    );
    assert.ok(hit);
    assert.equal(hit.kind, 'placement');
  });

  it('prefers the smaller area when two areas are hit at the same distance', () => {
    const islet = terrain({
      id: 'terr_islet',
      name: 'Islet',
      type: 'island',
      polygon: [
        { x: 40, y: 40 },
        { x: 60, y: 40 },
        { x: 60, y: 60 },
        { x: 40, y: 60 },
      ],
    });
    const hit = hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [terrain(), islet] });
    assert.ok(hit);
    assert.equal(hit.id, 'terr_islet');
  });

  it('prefers the topmost object when two objects are otherwise equal', () => {
    const low = terrain({ id: 'terr_low', zIndex: 10 });
    const high = terrain({ id: 'terr_high', zIndex: 900 });
    const hit = hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [low, high] });
    assert.ok(hit);
    assert.equal(hit.id, 'terr_high');
  });

  it('prefers a waypoint over the route stroke it sits on', () => {
    const candidates = buildMapHitCandidates({
      locations: [
        location({ id: 'loc_a', coordinates: { x: 10, y: 0 } }),
        location({ id: 'loc_b', coordinates: { x: 210, y: 0 } }),
      ],
      tradeRoutes: [route({ waypoints: [{ x: 110, y: 0 }] })],
    });
    const hit = hitTestMapObjects({ x: 110, y: 0 }, candidates);
    assert.ok(hit);
    assert.equal(hit.kind, 'waypoint');
  });

  it('picks a route stroke away from its waypoints', () => {
    const candidates = buildMapHitCandidates({
      locations: [
        location({ id: 'loc_a', coordinates: { x: 10, y: 0 } }),
        location({ id: 'loc_b', coordinates: { x: 210, y: 0 } }),
      ],
      tradeRoutes: [route()],
    });
    const hit = hitTestMapObjects({ x: 110, y: 0 }, candidates);
    assert.ok(hit);
    assert.equal(hit.kind, 'trade_route');
  });

  it('sorts hits by tier, then distance, then topmost, then smallest', () => {
    const a = {
      kind: 'terrain' as const,
      id: 'a',
      distance: 5,
      tier: HIT_TIER.AREA,
      zIndex: 0,
      area: 10,
      candidate: { kind: 'terrain' as const, id: 'terr_1', feature: terrain() },
    };
    const b = { ...a, id: 'b', tier: HIT_TIER.PIN };
    assert.ok(compareMapHits(b, a) < 0);
    const c = { ...a, id: 'c', distance: 1 };
    assert.ok(compareMapHits(c, a) < 0);
    const d = { ...a, id: 'd', zIndex: 50 };
    assert.ok(compareMapHits(d, a) < 0);
    const e = { ...a, id: 'e', area: 1 };
    assert.ok(compareMapHits(e, a) < 0);
  });
});

describe('mapHitTest — hidden and locked objects', () => {
  it('never picks a hidden landmass', () => {
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [terrain({ visible: false })] }),
      null
    );
  });

  it('never picks a locked landmass', () => {
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, { terrainFeatures: [terrain({ locked: true })] }),
      null
    );
  });

  it('never picks a hidden or locked pin', () => {
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, { placements: [placement({ visible: false })] }),
      null
    );
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, { placements: [placement({ locked: true })] }),
      null
    );
  });
});

describe('mapHitTest — layer visibility', () => {
  it('never picks a settlement from a hidden settlements layer', () => {
    const input = { locations: [location()] };
    assert.ok(hitTestMapObjectsIn({ x: 50, y: 50 }, input, { visibleLayers: layers() }));
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, input, {
        visibleLayers: layers({ settlements: false }),
      }),
      null
    );
  });

  it('never picks a route stroke or waypoint from a hidden caravan-routes layer', () => {
    const input = {
      locations: [
        location({ id: 'loc_a', coordinates: { x: 10, y: 50 } }),
        location({ id: 'loc_b', coordinates: { x: 210, y: 50 } }),
      ],
      tradeRoutes: [route({ waypoints: [{ x: 110, y: 50 }] })],
    };

    // Both the waypoint dot and the stroke disappear with the layer.
    assert.equal(
      hitTestMapObjectsIn({ x: 110, y: 50 }, input, {
        visibleLayers: layers({ caravanRoutes: false }),
      }),
      null
    );
    assert.equal(
      hitTestMapObjectsIn({ x: 150, y: 50 }, input, {
        visibleLayers: layers({ caravanRoutes: false }),
      }),
      null
    );

    // Hiding only the settlements keeps the route pickable.
    assert.equal(
      hitTestMapObjectsIn({ x: 110, y: 50 }, input, {
        visibleLayers: layers({ settlements: false }),
      })?.kind,
      'waypoint'
    );
  });

  it('never picks terrain from a hidden category layer', () => {
    const input = { terrainFeatures: [terrain()] };
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, input, {
        visibleLayers: layers({ terrain: false }),
      }),
      null
    );
    // The wrong category switch must not hide it.
    assert.ok(
      hitTestMapObjectsIn({ x: 50, y: 50 }, input, {
        visibleLayers: layers({ water: false }),
      })
    );

    const river = terrain({
      id: 'terr_river',
      name: 'River',
      type: 'river',
      polygon: undefined,
      points: [
        { x: 0, y: 200 },
        { x: 200, y: 200 },
      ],
    });
    assert.equal(
      hitTestMapObjectsIn({ x: 100, y: 200 }, { terrainFeatures: [river] }, {
        visibleLayers: layers({ water: false }),
      }),
      null
    );
  });

  it('never picks a pin from a hidden pin layer', () => {
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, { placements: [placement()] }, {
        visibleLayers: layers({ npcs: false }),
      }),
      null
    );
  });

  it('still picks a visible object when a hidden layer covers it', () => {
    const input = {
      locations: [location()],
      terrainFeatures: [terrain()],
      placements: [placement()],
    };
    // Hiding settlements removes the top pin; the visible lore pin below it
    // wins instead of the click falling through to nothing.
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, input, {
        visibleLayers: layers({ settlements: false }),
      })?.kind,
      'placement'
    );
    // With pins hidden too, the visible continent is still pickable.
    assert.equal(
      hitTestMapObjectsIn({ x: 50, y: 50 }, input, {
        visibleLayers: layers({ settlements: false, npcs: false }),
      })?.kind,
      'terrain'
    );
  });
});

describe('mapHitTest — candidate construction', () => {
  it('builds candidates for every pickable kind', () => {
    const candidates = buildMapHitCandidates({
      locations: [
        location({ id: 'loc_a', coordinates: { x: 10, y: 0 } }),
        location({ id: 'loc_b', coordinates: { x: 210, y: 0 } }),
      ],
      tradeRoutes: [route({ waypoints: [{ x: 110, y: 0 }] })],
      terrainFeatures: [terrain()],
      placements: [placement()],
    });
    const kinds = candidates.map((c) => c.kind);
    assert.equal(kinds.filter((k) => k === 'location').length, 2);
    assert.equal(kinds.filter((k) => k === 'waypoint').length, 1);
    assert.equal(kinds.filter((k) => k === 'trade_route').length, 1);
    assert.equal(kinds.filter((k) => k === 'terrain').length, 1);
    assert.equal(kinds.filter((k) => k === 'placement').length, 1);
  });

  it('skips locations without coordinates and the unplaced sentinel', () => {
    const candidates = buildMapHitCandidates({
      locations: [
        location({ id: 'loc_none', coordinates: undefined }),
        location({ id: 'loc_unplaced', coordinates: { x: 0, y: 50 } }),
      ],
    });
    assert.equal(candidates.length, 0);
  });

  it('does not build a route stroke when the endpoints are unplaced', () => {
    const candidates = buildMapHitCandidates({
      tradeRoutes: [route()],
    });
    assert.equal(candidates.filter((c) => c.kind === 'trade_route').length, 0);
  });

  it('does not index waypoints of a route the renderer never draws', () => {
    const candidates = buildMapHitCandidates({
      locations: [location({ id: 'loc_a', coordinates: { x: 10, y: 10 } })],
      // loc_b does not exist, so the renderer skips the whole route.
      tradeRoutes: [route({ waypoints: [{ x: 100, y: 100 }] })],
    });
    assert.equal(candidates.filter((c) => c.kind === 'waypoint').length, 0);
    assert.equal(candidates.filter((c) => c.kind === 'trade_route').length, 0);
  });

  it('does not create a point target for a non-point place category', () => {
    const candidates = buildMapHitCandidates({
      locations: [
        location({ id: 'loc_river', category: 'waterway', coordinates: { x: 50, y: 50 } }),
        location({ id: 'loc_steppe', category: 'plains', coordinates: { x: 70, y: 70 } }),
        location({ id: 'loc_town', category: 'settlement', coordinates: { x: 90, y: 90 } }),
      ],
      placeCategories: [],
    });
    const locationIds = candidates
      .filter((candidate) => candidate.kind === 'location')
      .map((candidate) => candidate.id);
    assert.deepEqual(locationIds, ['loc_town']);
  });
});
