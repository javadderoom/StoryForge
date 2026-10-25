import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  lineSegmentIntersection,
  closestPointOnPolyline,
  isBridgeLocation,
  generateProceduralBridge,
  detectBridges,
} from './bridgeGenerator';
import type { MapPoint, MapTerrainFeature, WorldLocation, WorldTradeRoute } from '@/lib/types';

describe('bridgeGenerator — Geometry Primitives', () => {
  it('detects intersecting lines and returns the exact crossing coordinate', () => {
    // Road crossing from (0, 50) to (100, 50)
    // River flowing from (50, 0) to (50, 100)
    const hit = lineSegmentIntersection(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 50, y: 0 },
      { x: 50, y: 100 }
    );

    assert.ok(hit !== null);
    assert.equal(Math.round(hit.point.x), 50);
    assert.equal(Math.round(hit.point.y), 50);
    assert.equal(hit.t1, 0.5);
    assert.equal(hit.t2, 0.5);
  });

  it('returns null for parallel or non-intersecting line segments', () => {
    // Parallel segments
    const parallel = lineSegmentIntersection(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 10 },
      { x: 100, y: 10 }
    );
    assert.equal(parallel, null);

    // Skew lines that do not cross within segment bounds
    const disjoint = lineSegmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 50, y: -20 },
      { x: 50, y: 20 }
    );
    assert.equal(disjoint, null);
  });

  it('finds closest point and tangent on a river polyline', () => {
    const polyline: MapPoint[] = [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 150, y: 150 },
    ];

    const res = closestPointOnPolyline({ x: 90, y: 50 }, polyline);
    assert.equal(Math.round(res.point.x), 100);
    assert.equal(Math.round(res.point.y), 50);
    assert.equal(Math.round(res.distance), 10);
    assert.equal(res.segmentIndex, 0);
    assert.equal(res.tangent.x, 0);
    assert.equal(res.tangent.y, 1);
  });
});

describe('bridgeGenerator — Procedural Bridge Synthesis', () => {
  it('generates a complete bridge structure with deck, abutments, parapets, and piers', () => {
    const bridge = generateProceduralBridge({
      id: 'bridge_test_1',
      sourceType: 'landmark_location',
      sourceId: 'loc_zarrin_pol',
      center: { x: 500, y: 500 },
      angle: 0, // Horizontal deck
      riverAngle: Math.PI / 2, // Vertical river flowing downwards
      spanLength: 48,
      deckWidth: 12,
    });

    assert.equal(bridge.id, 'bridge_test_1');
    assert.equal(bridge.deckPolygon.length, 4);

    // Verify deck rectangle bounds
    // Center at 500, span 48 -> x from 476 to 524
    // Width 12 -> y from 494 to 506
    const xs = bridge.deckPolygon.map((p) => Math.round(p.x));
    const ys = bridge.deckPolygon.map((p) => Math.round(p.y));
    assert.ok(xs.includes(476));
    assert.ok(xs.includes(524));
    assert.ok(ys.includes(494));
    assert.ok(ys.includes(506));

    // Verify abutments exist on both left and right
    assert.equal(bridge.leftAbutment.polygon.length, 4);
    assert.equal(bridge.rightAbutment.polygon.length, 4);

    // Verify 2 parapet balustrades and 4 corner posts
    assert.equal(bridge.parapets.length, 2);
    assert.equal(bridge.cornerPosts.length, 4);

    // Verify transverse planks
    assert.ok(bridge.transversePlanks.length > 5);

    // For span 48 (>= 42), it should generate 2 cutwater piers
    assert.equal(bridge.piers.length, 2);
    for (const pier of bridge.piers) {
      assert.equal(pier.polygon.length, 4);
      // Upstream cutwater apex should point upward (opposite to river flow downwards)
      assert.ok(pier.cutwaterApex.y < pier.center.y);
      // Downstream tail should point downward
      assert.ok(pier.tailApex.y > pier.center.y);
      assert.equal(pier.wakeRipples.length, 2);
    }

    // Verify arch shadow vaults
    assert.ok(bridge.archShadows.length >= 2);
  });
});

describe('bridgeGenerator — Landmark & Route Crossing Detection', () => {
  const river: MapTerrainFeature = {
    id: 'river_zarvan',
    name: 'Zarvan River',
    type: 'river',
    width: 14,
    points: [
      { x: 500, y: 100 },
      { x: 500, y: 500 },
      { x: 500, y: 900 },
    ],
  };

  it('identifies bridge locations by category or name', () => {
    assert.equal(isBridgeLocation({ name: 'زرین پل (Zarrin-Pol)' } as WorldLocation), true);
    assert.equal(isBridgeLocation({ name: 'Stone Bridge' } as WorldLocation), true);
    assert.equal(isBridgeLocation({ name: 'کاروانسرا', category: 'bridge' } as WorldLocation), true);
    assert.equal(isBridgeLocation({ name: 'چاه سنگ', category: 'settlement' } as WorldLocation), false);
  });

  it('snaps a landmark bridge (Zarrin-Pol) onto a nearby river', () => {
    const zarrinPol: WorldLocation = {
      id: 'loc_zarrin',
      name: 'زرین پل (Zarrin-Pol)',
      category: 'settlement',
      coordinates: { x: 512, y: 480 }, // 12px away from river at x=500
      dangerLevel: 2,
    } as WorldLocation;

    const detected = detectBridges({
      locations: [zarrinPol],
      terrainFeatures: [river],
    });

    assert.equal(detected.length, 1);
    const bridge = detected[0];
    assert.equal(bridge.sourceType, 'landmark_location');
    assert.equal(bridge.sourceId, 'loc_zarrin');
    assert.equal(bridge.riverId, 'river_zarvan');
    // Center snapped to river x = 500
    assert.equal(Math.round(bridge.center.x), 500);
    assert.equal(Math.round(bridge.center.y), 480);
    // River runs vertically (dy > 0), so deck spans horizontally (angle ~= Math.PI)
    assert.ok(Math.abs(Math.cos(bridge.angle)) > 0.9);
  });

  it('detects trade caravan route crossing a river', () => {
    const locA: WorldLocation = {
      id: 'loc_a',
      name: 'West Camp',
      coordinates: { x: 200, y: 300 },
    } as WorldLocation;

    const locB: WorldLocation = {
      id: 'loc_b',
      name: 'East Outpost',
      coordinates: { x: 800, y: 300 },
    } as WorldLocation;

    const caravan: WorldTradeRoute = {
      id: 'route_caravan_1',
      name: 'Silk Way',
      originLocationId: 'loc_a',
      destinationLocationId: 'loc_b',
      waypoints: [],
    } as WorldTradeRoute;

    const detected = detectBridges({
      locations: [locA, locB],
      tradeRoutes: [caravan],
      terrainFeatures: [river],
    });

    assert.equal(detected.length, 1);
    const bridge = detected[0];
    assert.equal(bridge.sourceType, 'route_crossing');
    assert.equal(bridge.sourceId, 'route_caravan_1');
    assert.equal(Math.round(bridge.center.x), 500);
    assert.equal(Math.round(bridge.center.y), 300);
  });

  it('does not create duplicate bridges for overlapping crossings within threshold', () => {
    const locA: WorldLocation = {
      id: 'loc_a',
      name: 'West Camp',
      coordinates: { x: 200, y: 300 },
    } as WorldLocation;

    const locB: WorldLocation = {
      id: 'loc_b',
      name: 'East Outpost',
      coordinates: { x: 800, y: 300 },
    } as WorldLocation;

    // Both a landmark location and a caravan route cross at the exact same location
    const zarrinPol: WorldLocation = {
      id: 'loc_zarrin',
      name: 'زرین پل',
      coordinates: { x: 500, y: 300 },
    } as WorldLocation;

    const caravan: WorldTradeRoute = {
      id: 'route_caravan_1',
      name: 'Silk Way',
      originLocationId: 'loc_a',
      destinationLocationId: 'loc_b',
    } as WorldTradeRoute;

    const detected = detectBridges({
      locations: [locA, locB, zarrinPol],
      tradeRoutes: [caravan],
      terrainFeatures: [river],
    });

    // Should only yield 1 bridge, avoiding duplicates
    assert.equal(detected.length, 1);
  });
});
