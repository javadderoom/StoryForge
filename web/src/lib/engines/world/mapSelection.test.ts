import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCATION_SELECT_RADIUS,
  buildMapClipboard,
  cloneMapClipboard,
  collectSelectableRefs,
  marqueeSelectRefs,
  mapObjectRefKey,
  mergeMapObjectRefs,
  resolveTradeRoutePoints,
  ringIntersectsBounds,
  toggleMapObjectRef,
  translateMapObjects,
  translateTerrainFeature,
  type MapObjectRef,
  type MapSelectionSource,
} from './mapSelection';
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

// A square landmass with a square lake hole in its middle: (30,30)-(70,70).
const DONUT_HOLE: MapPoint[] = [
  { x: 30, y: 30 },
  { x: 70, y: 30 },
  { x: 70, y: 70 },
  { x: 30, y: 70 },
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
    description: '',
    region: '',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: '',
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
    waypoints: [{ x: 50, y: 10 }],
    ...over,
  } as WorldTradeRoute;
}

function layers(over: Partial<WorldMapSettings['visibleLayers']> = {}): WorldMapSettings['visibleLayers'] {
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

function settings(over: Partial<WorldMapSettings> = {}): WorldMapSettings {
  return { visibleLayers: layers(), ...over } as WorldMapSettings;
}

describe('mapSelection — refs', () => {
  it('merges without duplicates and keeps order', () => {
    const a: MapObjectRef[] = [{ kind: 'terrain', id: 't1' }];
    const b: MapObjectRef[] = [
      { kind: 'terrain', id: 't1' },
      { kind: 'placement', id: 'p1' },
    ];
    assert.deepEqual(mergeMapObjectRefs(a, b), [
      { kind: 'terrain', id: 't1' },
      { kind: 'placement', id: 'p1' },
    ]);
  });

  it('toggles a ref in and out', () => {
    const ref: MapObjectRef = { kind: 'location', id: 'l1' };
    const added = toggleMapObjectRef([], ref);
    assert.deepEqual(added, [ref]);
    assert.deepEqual(toggleMapObjectRef(added, ref), []);
  });

  it('keys a ref by kind and id', () => {
    assert.equal(mapObjectRefKey({ kind: 'trade_route', id: 'tr_1' }), 'trade_route:tr_1');
  });
});

describe('mapSelection — selectability', () => {
  it('collects every drawn object', () => {
    const source: MapSelectionSource = {
      locations: [location({ id: 'loc_1' })],
      tradeRoutes: [
        route({
          originLocationId: 'loc_1',
          destinationLocationId: 'loc_2',
        }),
      ],
      terrainFeatures: [terrain()],
      placements: [placement()],
    };
    const sourceWithDest: MapSelectionSource = {
      ...source,
      locations: [location({ id: 'loc_1' }), location({ id: 'loc_2', coordinates: { x: 80, y: 80 } })],
    };
    const refs = collectSelectableRefs(sourceWithDest, settings());
    assert.deepEqual(
      refs.map(mapObjectRefKey),
      ['location:loc_1', 'location:loc_2', 'trade_route:tr_1', 'terrain:terr_1', 'placement:pin_1']
    );
  });

  it('skips hidden, locked and layer-hidden objects', () => {
    const source: MapSelectionSource = {
      terrainFeatures: [
        terrain({ id: 'visible' }),
        terrain({ id: 'hidden', visible: false }),
        terrain({ id: 'locked', locked: true }),
      ],
      placements: [
        placement({ id: 'pin_visible' }),
        placement({ id: 'pin_hidden', visible: false }),
      ],
    };
    assert.deepEqual(
      collectSelectableRefs(source, settings()).map(mapObjectRefKey),
      ['terrain:visible', 'placement:pin_visible']
    );

    assert.deepEqual(
      collectSelectableRefs(source, settings({ visibleLayers: layers({ terrain: false }) })).map(
        mapObjectRefKey
      ),
      ['placement:pin_visible']
    );

    assert.deepEqual(
      collectSelectableRefs(source, settings({ visibleLayers: layers({ npcs: false }) })).map(
        mapObjectRefKey
      ),
      ['terrain:visible']
    );
  });

  it('does not select a route with a missing endpoint', () => {
    const source: MapSelectionSource = {
      locations: [location({ id: 'loc_a' })],
      tradeRoutes: [route({ originLocationId: 'loc_a', destinationLocationId: 'missing' })],
    };
    assert.deepEqual(collectSelectableRefs(source, settings()), [
      { kind: 'location', id: 'loc_a' },
    ]);
    assert.equal(resolveTradeRoutePoints(source.tradeRoutes![0], source.locations!).length, 2);
  });

  it('ignores terrain with no geometry', () => {
    const source: MapSelectionSource = {
      terrainFeatures: [{ id: 'empty', name: 'Empty', type: 'peak' } as MapTerrainFeature],
    };
    assert.deepEqual(collectSelectableRefs(source, settings()), []);
  });
});

describe('mapSelection — marquee geometry', () => {
  it('picks a polygon the band crosses', () => {
    const source = { terrainFeatures: [terrain()] };
    const hits = marqueeSelectRefs(
      source,
      { minX: -20, minY: 40, maxX: 20, maxY: 60 },
      settings()
    );
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:terr_1']);
  });

  it('picks a polygon that fully contains the band', () => {
    const source = { terrainFeatures: [terrain()] };
    const hits = marqueeSelectRefs(
      source,
      { minX: 10, minY: 10, maxX: 20, maxY: 20 },
      settings()
    );
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:terr_1']);
  });

  it('does not pick a polygon when the band is entirely inside one of its holes', () => {
    const source = { terrainFeatures: [terrain({ holes: [DONUT_HOLE] })] };
    // Inside the bounding box (0..100) but over the lake hole: the band is
    // entirely in the hole, so the continent that surrounds it stays out.
    const hits = marqueeSelectRefs(
      source,
      { minX: 40, minY: 40, maxX: 60, maxY: 60 },
      settings()
    );
    assert.deepEqual(hits, []);
  });

  it('picks a polygon whose land the band touches beside a hole', () => {
    const source = { terrainFeatures: [terrain({ holes: [DONUT_HOLE] })] };
    const hits = marqueeSelectRefs(
      source,
      { minX: 10, minY: 10, maxX: 50, maxY: 50 },
      settings()
    );
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:terr_1']);
  });

  it('does not pick anything outside the ring', () => {
    const source = { terrainFeatures: [terrain()] };
    const hits = marqueeSelectRefs(
      source,
      { minX: 120, minY: 120, maxX: 160, maxY: 160 },
      settings()
    );
    assert.deepEqual(hits, []);
  });

  it('picks a polyline the band crosses', () => {
    const source = {
      terrainFeatures: [
        terrain({
          id: 'river',
          name: 'River',
          type: 'river',
          polygon: undefined,
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 50 },
          ],
          width: 4,
        }),
      ],
    };
    const hits = marqueeSelectRefs(source, { minX: 40, minY: 40, maxX: 60, maxY: 60 }, settings());
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:river']);
  });

  it('picks a point feature inside the band', () => {
    const source = {
      terrainFeatures: [
        terrain({
          id: 'peak',
          name: 'Peak',
          type: 'peak',
          polygon: undefined,
          x: 50,
          y: 50,
          radius: 20,
        }),
      ],
    };
    const hits = marqueeSelectRefs(source, { minX: 55, minY: 55, maxX: 65, maxY: 65 }, settings());
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:peak']);
  });

  it('picks a settlement the band touches', () => {
    const source = { locations: [location({ coordinates: { x: 200, y: 200 } })] };
    const hits = marqueeSelectRefs(
      source,
      {
        minX: 200 - LOCATION_SELECT_RADIUS,
        minY: 200 - LOCATION_SELECT_RADIUS,
        maxX: 200 + LOCATION_SELECT_RADIUS,
        maxY: 200 + LOCATION_SELECT_RADIUS,
      },
      settings()
    );
    assert.deepEqual(hits.map(mapObjectRefKey), ['location:loc_1']);
  });

  it('picks a route whose stroke crosses the band', () => {
    const source = {
      locations: [
        location({ id: 'loc_a', coordinates: { x: 0, y: 0 } }),
        location({ id: 'loc_b', coordinates: { x: 200, y: 0 } }),
      ],
      tradeRoutes: [route({ originLocationId: 'loc_a', destinationLocationId: 'loc_b', waypoints: [] })],
    };
    const hits = marqueeSelectRefs(source, { minX: 90, minY: -40, maxX: 110, maxY: 40 }, settings());
    assert.deepEqual(hits.map(mapObjectRefKey), ['trade_route:tr_1']);
  });

  it('skips locked and layer-hidden objects', () => {
    const source = {
      terrainFeatures: [
        terrain({ id: 'visible' }),
        terrain({ id: 'locked', locked: true }),
        terrain({ id: 'no-layer', type: 'forest', visible: true }),
      ],
    };
    const hits = marqueeSelectRefs(
      source,
      { minX: -10, minY: -10, maxX: 110, maxY: 110 },
      settings({ visibleLayers: layers({ biomes: false }) })
    );
    assert.deepEqual(hits.map(mapObjectRefKey), ['terrain:visible']);
  });

  it('still detects a ring fully covering the band (corner test)', () => {
    assert.equal(
      ringIntersectsBounds(SQUARE, { minX: 40, minY: 40, maxX: 45, maxY: 45 }),
      true
    );
    assert.equal(
      ringIntersectsBounds(SQUARE, { minX: 40, minY: 40, maxX: 60, maxY: 60 }),
      true,
      'the hole is not known to this primitive — the terrain test owns holes'
    );
  });
});

describe('mapSelection — translation (group move)', () => {
  it('translates every geometry anchor of a terrain feature', () => {
    const moved = translateTerrainFeature(
      terrain({
        id: 'terr_1',
        polygon: SQUARE,
        holes: [DONUT_HOLE],
        points: [{ x: 1, y: 2 }],
        x: 7,
        y: 8,
      }),
      10,
      -5
    );
    assert.equal(moved.id, 'terr_1');
    assert.equal(moved.name, 'Continent');
    assert.deepEqual(moved.polygon, [
      { x: 10, y: -5 },
      { x: 110, y: -5 },
      { x: 110, y: 95 },
      { x: 10, y: 95 },
    ]);
    assert.deepEqual(moved.holes![0][0], { x: 40, y: 25 });
    assert.deepEqual(moved.points![0], { x: 11, y: -3 });
    assert.equal(moved.x, 17);
    assert.equal(moved.y, 3);
  });

  it('moves only the selected objects and keeps the others by reference', () => {
    const untouchedTerrain = terrain({ id: 'terr_2' });
    const untouchedLocation = location({ id: 'loc_2' });
    const source: MapSelectionSource = {
      terrainFeatures: [terrain({ id: 'terr_1' }), untouchedTerrain],
      placements: [placement({ id: 'pin_1' }), placement({ id: 'pin_2' })],
      locations: [location({ id: 'loc_1' }), untouchedLocation],
      tradeRoutes: [
        route({ id: 'tr_1', waypoints: [{ x: 5, y: 5 }] }),
        route({ id: 'tr_2', waypoints: undefined }),
      ],
    };

    const moved = translateMapObjects(
      source,
      [
        { kind: 'terrain', id: 'terr_1' },
        { kind: 'placement', id: 'pin_1' },
        { kind: 'location', id: 'loc_1' },
        { kind: 'trade_route', id: 'tr_1' },
      ],
      12,
      -8
    );

    assert.equal(moved.terrainFeatures[0].polygon![0].x, 12);
    assert.equal(moved.terrainFeatures[0].polygon![0].y, -8);
    assert.equal(moved.terrainFeatures[1], untouchedTerrain);
    assert.deepEqual(
      { x: moved.placements[0].x, y: moved.placements[0].y },
      { x: 62, y: 42 }
    );
    assert.equal(moved.placements[1].x, 50);
    assert.deepEqual(moved.locations[0].coordinates, { x: 62, y: 42 });
    assert.equal(moved.locations[0].coordinatesSource, 'manual');
    assert.equal(moved.locations[1], untouchedLocation);
    assert.deepEqual(moved.tradeRoutes[0].waypoints, [{ x: 17, y: -3 }]);
    assert.equal(moved.tradeRoutes[0].originLocationId, 'loc_a');
    assert.equal(moved.tradeRoutes[1].waypoints, undefined);
  });

  it('returns the same objects for a zero delta', () => {
    const feature = terrain();
    const source: MapSelectionSource = { terrainFeatures: [feature] };
    const moved = translateMapObjects(source, [{ kind: 'terrain', id: 'terr_1' }], 0, 0);
    assert.equal(moved.terrainFeatures[0], feature);
  });

  it('moves a location without coordinates safely', () => {
    const moved = translateMapObjects(
      { locations: [location({ id: 'loc_1', coordinates: undefined })] },
      [{ kind: 'location', id: 'loc_1' }],
      5,
      5
    );
    assert.equal(moved.locations[0].coordinates, undefined);
  });
});

describe('mapSelection — clipboard', () => {
  it('snapshots only the selected objects', () => {
    const source: MapSelectionSource = {
      terrainFeatures: [terrain({ id: 't1' }), terrain({ id: 't2' })],
      placements: [placement({ id: 'p1' })],
    };
    const clipboard = buildMapClipboard(source, [{ kind: 'terrain', id: 't2' }]);
    assert.deepEqual(clipboard.terrainFeatures.map((f) => f.id), ['t2']);
    assert.deepEqual(clipboard.placements, []);
  });

  it('offsets every geometric anchor and gives fresh ids', () => {
    const clipboard = {
      locations: [
        location({
          id: 'loc_1',
          coordinates: { x: 10, y: 20 },
          connectedLocationIds: ['loc_1'],
          parentLocationId: 'loc_1',
        }),
      ],
      tradeRoutes: [
        route({
          id: 'tr_1',
          originLocationId: 'loc_1',
          destinationLocationId: 'loc_outside',
          waypoints: [{ x: 5, y: 5 }],
        }),
      ],
      terrainFeatures: [
        terrain({
          id: 'terr_1',
          polygon: SQUARE,
          holes: [DONUT_HOLE],
          points: [{ x: 1, y: 1 }],
          x: 7,
          y: 8,
        }),
      ],
      placements: [placement({ id: 'pin_1', customLabel: 'Camp' })],
    };

    let counter = 0;
    const clones = cloneMapClipboard(clipboard, {
      offsetX: 100,
      offsetY: 200,
      copySuffix: ' (copy)',
      makeId: (kind) => `${kind}_new_${++counter}`,
    });

    const feat = clones.terrainFeatures[0];
    assert.equal(feat.id, 'terrain_new_1');
    assert.equal(feat.polygon![0].x, 100);
    assert.equal(feat.polygon![0].y, 200);
    assert.equal(feat.holes![0][0].x, 130);
    assert.equal(feat.points![0].x, 101);
    assert.equal(feat.x, 107);
    assert.equal(feat.y, 208);
    assert.equal(feat.name, 'Continent (copy)');

    const pin = clones.placements[0];
    assert.equal(pin.id, 'placement_new_2');
    assert.equal(pin.x, 150);
    assert.equal(pin.y, 250);
    assert.equal(pin.entityId, 'npc_1', 'the pin still points at the same lore entity');
    assert.equal(pin.customLabel, 'Camp (copy)');

    const loc = clones.locations[0];
    assert.equal(loc.id, 'location_new_3');
    assert.deepEqual(loc.coordinates, { x: 110, y: 220 });
    assert.equal(loc.coordinatesSource, 'manual');
    assert.equal(loc.name, 'Town (copy)');
    assert.deepEqual(loc.connectedLocationIds, [loc.id], 'self-reference is remapped');
    assert.equal(loc.parentLocationId, loc.id);

    const road = clones.tradeRoutes[0];
    assert.equal(road.id, 'trade_route_new_4');
    assert.equal(road.originLocationId, loc.id, 'endpoint inside the batch is remapped');
    assert.equal(road.destinationLocationId, 'loc_outside', 'endpoint outside the batch is kept');
    assert.deepEqual(road.waypoints, [{ x: 105, y: 205 }]);
    assert.equal(road.name, 'Road (copy)');
  });

  it('drops a copied location’s edges to neighbours outside the batch', () => {
    const clones = cloneMapClipboard(
      {
        locations: [
          location({
            id: 'loc_1',
            connectedLocationIds: ['loc_outside'],
            parentLocationId: 'loc_outside',
          }),
        ],
        tradeRoutes: [],
        terrainFeatures: [],
        placements: [],
      },
      { offsetX: 0, offsetY: 0, copySuffix: ' (copy)', makeId: () => 'new_loc' }
    );
    assert.deepEqual(clones.locations[0].connectedLocationIds, []);
    assert.equal(clones.locations[0].parentLocationId, undefined);
  });

  it('returns refs for everything it created', () => {
    const clones = cloneMapClipboard(
      {
        locations: [location({ id: 'loc_1' })],
        tradeRoutes: [],
        terrainFeatures: [terrain({ id: 'terr_1' })],
        placements: [placement({ id: 'pin_1' })],
      },
      { offsetX: 10, offsetY: 10, copySuffix: ' (copy)', makeId: (kind) => `${kind}_2` }
    );
    assert.deepEqual(
      clones.refs.map(mapObjectRefKey).sort(),
      ['location:location_2', 'placement:placement_2', 'terrain:terrain_2']
    );
  });

  it('does not mutate the clipboard snapshot', () => {
    const original = terrain({ id: 'terr_1', polygon: SQUARE });
    const clipboard = {
      locations: [],
      tradeRoutes: [],
      terrainFeatures: [original],
      placements: [],
    };
    cloneMapClipboard(clipboard, {
      offsetX: 500,
      offsetY: 500,
      copySuffix: ' (copy)',
      makeId: () => 'new',
    });
    assert.deepEqual(original.polygon, SQUARE);
    assert.equal(original.id, 'terr_1');
  });
});
