import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  MapRoute,
  MapTerrainFeature,
  WorldLocation,
} from '@/lib/types/world';
import {
  createMapRoute,
  detachRoutesFromRef,
  MAP_ROUTE_KIND_META,
  nearestPointOnPolyline,
  resolveMapRoutePoints,
  resolveRouteEndpointPoint,
  routeLength,
  routeMidpoint,
  simplifyRoutePath,
  snapRouteEndpoint,
  type MapRouteSource,
} from './mapRoutes';

const city = (overrides: Partial<WorldLocation> = {}): WorldLocation =>
  ({
    id: 'loc_city',
    name: 'Haven',
    category: 'settlement',
    coordinates: { x: 100, y: 100 },
    ...overrides,
  }) as WorldLocation;

const riverTerrain = (overrides: Partial<MapTerrainFeature> = {}): MapTerrainFeature =>
  ({
    id: 'terr_river',
    name: 'Long River',
    type: 'river',
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    ...overrides,
  }) as MapTerrainFeature;

describe('mapRoutes — endpoint geometry', () => {
  it('nearestPointOnPolyline finds the closest point on an open line', () => {
    const hit = nearestPointOnPolyline({ x: 50, y: 10 }, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    assert.ok(hit);
    assert.deepEqual(hit.point, { x: 50, y: 0 });
    assert.equal(hit.segment, 0);
    assert.equal(hit.t, 0.5);
    assert.equal(hit.distance, 10);
  });

  it('a closed ring includes its closing edge', () => {
    const ring = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const hit = nearestPointOnPolyline({ x: -10, y: 50 }, ring, true);
    assert.ok(hit);
    assert.deepEqual(hit.point, { x: 0, y: 50 });
    assert.equal(hit.segment, 3, 'the closing edge is segment 3');
  });

  it('resolves a snapped segment live when the river is redrawn', () => {
    const source: MapRouteSource = { terrainFeatures: [riverTerrain()] };
    const endpoint = {
      ref: { kind: 'terrain' as const, id: 'terr_river' },
      anchor: { kind: 'segment' as const, segment: 0, t: 0.5 },
      fallback: { x: 100, y: 0 },
    };

    assert.deepEqual(resolveRouteEndpointPoint(endpoint, source).point, { x: 100, y: 0 });

    const moved: MapRouteSource = {
      terrainFeatures: [riverTerrain({ points: [{ x: 0, y: 50 }, { x: 200, y: 50 }] })],
    };
    assert.deepEqual(resolveRouteEndpointPoint(endpoint, moved).point, { x: 100, y: 50 });
  });

  it('resolves a free end from its fallback', () => {
    const resolved = resolveRouteEndpointPoint({ fallback: { x: 12, y: 34 } }, {});
    assert.deepEqual(resolved.point, { x: 12, y: 34 });
    assert.equal(resolved.dangling, false);
  });

  it('marks a missing target as dangling and falls back to the last point', () => {
    const resolved = resolveRouteEndpointPoint(
      {
        ref: { kind: 'terrain', id: 'terr_gone' },
        anchor: { kind: 'point' },
        fallback: { x: 7, y: 8 },
      },
      {}
    );
    assert.deepEqual(resolved.point, { x: 7, y: 8 });
    assert.equal(resolved.dangling, true);
  });
});

describe('mapRoutes — snapping priority', () => {
  it('prefers a settlement pin over the river it stands on', () => {
    const source: MapRouteSource = {
      locations: [city({ id: 'loc_city', coordinates: { x: 100, y: 2 } })],
      terrainFeatures: [riverTerrain()],
    };
    const snap = snapRouteEndpoint({ x: 100, y: 1 }, source);
    assert.ok(snap);
    assert.equal(snap.endpoint.ref?.kind, 'location');
    assert.deepEqual(snap.endpoint.anchor, { kind: 'point' });
    assert.equal(snap.label, 'Haven');
  });

  it('snaps a road end to a river segment when no pin is near', () => {
    const source: MapRouteSource = {
      locations: [city({ id: 'loc_city', coordinates: { x: 100, y: 200 } })],
      terrainFeatures: [riverTerrain()],
    };
    const snap = snapRouteEndpoint({ x: 50, y: 6 }, source);
    assert.ok(snap);
    assert.equal(snap.endpoint.ref?.kind, 'terrain');
    assert.equal(snap.endpoint.ref?.id, 'terr_river');
    assert.deepEqual(snap.endpoint.anchor, { kind: 'segment', segment: 0, t: 0.25 });
  });

  it('attaches to the linked terrain of a non-point place', () => {
    const source: MapRouteSource = {
      locations: [
        city({
          id: 'loc_river',
          name: 'Long River',
          category: 'river',
          coordinates: { x: 0, y: 0 },
        }),
      ],
      terrainFeatures: [riverTerrain({ locationId: 'loc_river' })],
    };
    const snap = snapRouteEndpoint({ x: 120, y: 4 }, source);
    assert.ok(snap);
    assert.equal(snap.endpoint.ref?.kind, 'terrain');
    assert.equal(snap.endpoint.ref?.id, 'terr_river');
  });

  it('returns null when nothing is within the radius', () => {
    const source: MapRouteSource = { terrainFeatures: [riverTerrain()] };
    assert.equal(snapRouteEndpoint({ x: 100, y: 500 }, source), null);
  });
});

describe('mapRoutes — path resolution and simplification', () => {
  it('resolves a route to endpoints plus free path', () => {
    const route: MapRoute = {
      id: 'road_1',
      name: 'Haven Road',
      kind: 'road',
      difficulty: 2,
      origin: { fallback: { x: 0, y: 0 } },
      destination: { fallback: { x: 100, y: 0 } },
      path: [
        { x: 30, y: 10 },
        { x: 70, y: 10 },
      ],
    };
    const resolved = resolveMapRoutePoints(route, {});
    assert.deepEqual(resolved.points, [
      { x: 0, y: 0 },
      { x: 30, y: 10 },
      { x: 70, y: 10 },
      { x: 100, y: 0 },
    ]);
    assert.equal(resolved.danglingOrigin, false);
    assert.deepEqual(routeMidpoint(resolved.points), { x: 50, y: 10 });
    assert.ok(routeLength(resolved.points) > 100);
  });

  it('uses a transient point for a vertex drag preview', () => {
    const route: MapRoute = {
      id: 'road_1',
      name: 'Haven Road',
      kind: 'road',
      difficulty: 2,
      origin: { fallback: { x: 0, y: 0 } },
      destination: { fallback: { x: 100, y: 0 } },
      path: [{ x: 50, y: 0 }],
    };
    const resolved = resolveMapRoutePoints(route, {}, { index: 0, point: { x: 50, y: 40 } });
    assert.deepEqual(resolved.points[1], { x: 50, y: 40 });
    assert.deepEqual(route.path, [{ x: 50, y: 0 }], 'the source route is untouched');
  });

  it('simplifies a dense freehand stroke without moving its ends', () => {
    const points = Array.from({ length: 201 }, (_, index) => ({
      x: index,
      y: Math.sin(index / 6) * 8,
    }));
    const simplified = simplifyRoutePath(points, 2);
    assert.ok(simplified.length < points.length / 2);
    assert.deepEqual(simplified[0], points[0]);
    assert.deepEqual(simplified[simplified.length - 1], points[points.length - 1]);
  });
});

describe('mapRoutes — lifecycle and defaults', () => {
  it('detaches both ends that referenced a deleted object', () => {
    const route: MapRoute = {
      id: 'road_1',
      name: 'River Road',
      kind: 'road',
      difficulty: 2,
      origin: {
        ref: { kind: 'terrain', id: 'terr_river' },
        anchor: { kind: 'point' },
        fallback: { x: 0, y: 0 },
      },
      destination: {
        ref: { kind: 'location', id: 'loc_city' },
        anchor: { kind: 'point' },
        fallback: { x: 100, y: 0 },
      },
      path: [],
    };

    const afterRiver = detachRoutesFromRef([route], { kind: 'terrain', id: 'terr_river' });
    assert.equal(afterRiver[0].origin.ref, undefined);
    assert.deepEqual(afterRiver[0].origin.fallback, { x: 0, y: 0 });
    assert.equal(afterRiver[0].destination.ref?.id, 'loc_city');

    const afterCity = detachRoutesFromRef(afterRiver, { kind: 'location', id: 'loc_city' });
    assert.equal(afterCity[0].destination.ref, undefined);
  });

  it('does not rewrite routes that do not reference the deleted object', () => {
    const route: MapRoute = {
      id: 'road_1',
      name: 'Free Road',
      kind: 'trail',
      difficulty: 3,
      origin: { fallback: { x: 0, y: 0 } },
      destination: { fallback: { x: 10, y: 0 } },
      path: [],
    };
    const result = detachRoutesFromRef([route], { kind: 'terrain', id: 'terr_x' });
    assert.equal(result[0], route, 'the array and object are returned unchanged');
  });

  it('creates kind defaults and a bilingual name from endpoint labels', () => {
    const source: MapRouteSource = {
      locations: [city({ id: 'loc_city', name: 'Haven' })],
    };
    const route = createMapRoute({
      id: 'road_1',
      kind: 'mountain_pass',
      origin: {
        ref: { kind: 'location', id: 'loc_city' },
        anchor: { kind: 'point' },
        fallback: { x: 100, y: 100 },
      },
      destination: { fallback: { x: 400, y: 300 } },
      isPersian: false,
      source,
    });
    assert.equal(route.difficulty, MAP_ROUTE_KIND_META.mountain_pass.defaultDifficulty);
    assert.equal(route.travelMultiplier, MAP_ROUTE_KIND_META.mountain_pass.travelMultiplier);
    assert.match(route.name, /Mountain Pass/);
    assert.match(route.name, /Haven/);
  });

  it('keeps two roads between the same pair independent', () => {
    const a: MapRoute = {
      id: 'road_1',
      name: 'North Road',
      kind: 'road',
      difficulty: 2,
      origin: { fallback: { x: 0, y: 0 } },
      destination: { fallback: { x: 100, y: 0 } },
      path: [{ x: 50, y: 20 }],
    };
    const b: MapRoute = { ...a, id: 'road_2', name: 'South Road', path: [{ x: 50, y: -20 }] };
    const source: MapRouteSource = {};
    assert.notDeepEqual(
      resolveMapRoutePoints(a, source).points,
      resolveMapRoutePoints(b, source).points
    );
  });
});
