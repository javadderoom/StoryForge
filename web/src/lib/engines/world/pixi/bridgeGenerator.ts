/**
 * bridgeGenerator.ts
 *
 * Civil Infrastructure & River Crossings (Plan 27 — Module 5)
 *
 * Generates hand-inked fantasy manuscript bridges spanning rivers:
 * - Detects intersections between roads/caravan routes and rivers.
 * - Identifies landmark bridge locations (e.g. Zarrin-Pol / زرین‌پل).
 * - Generates masonry stone bridge anatomy:
 *   1. Solid parchment under-deck mask to prevent river water/banks bleeding through.
 *   2. Flared stone masonry abutments on both riverbanks.
 *   3. Elevated roadway deck with transverse plank / cobblestone paving.
 *   4. Parapet handrails and corner finial posts.
 *   5. Submerged stone piers with pointed cutwaters facing upstream and wake ripples downstream.
 *   6. 2.5D under-deck arch shadows.
 */

import type {
  MapPoint,
  MapRoute,
  MapTerrainFeature,
  WorldLocation,
  WorldTradeRoute,
} from '@/lib/types';
import { resolveMapRoutePoints, type MapRouteSource } from '../mapRoutes';

export interface BridgeAbutment {
  polygon: MapPoint[];
  wingLines: [MapPoint, MapPoint][];
}

export interface BridgePier {
  center: MapPoint;
  polygon: MapPoint[];
  cutwaterApex: MapPoint;
  tailApex: MapPoint;
  wakeRipples: MapPoint[][];
}

export interface ProceduralBridge {
  id: string;
  sourceType: 'route_crossing' | 'landmark_location';
  sourceId: string;
  riverId?: string;
  center: MapPoint;
  angle: number; // Deck heading angle in radians
  spanLength: number; // Total length spanning across the river
  deckWidth: number; // Width of roadway deck in pixels
  deckPolygon: MapPoint[]; // 4-point rectangle
  leftAbutment: BridgeAbutment;
  rightAbutment: BridgeAbutment;
  parapets: [MapPoint[], MapPoint[]]; // Top and bottom balustrade lines
  cornerPosts: MapPoint[]; // 4 deck corner posts
  transversePlanks: [MapPoint, MapPoint][]; // Planks or stone joints
  piers: BridgePier[]; // Submerged cutwater piers
  archShadows: MapPoint[][]; // Under-deck shadow vaults
}

export interface BridgeDetectionOptions {
  locations?: WorldLocation[];
  mapRoutes?: MapRoute[];
  tradeRoutes?: WorldTradeRoute[];
  terrainFeatures?: MapTerrainFeature[];
  routeSource?: MapRouteSource;
}

/**
 * 2D line segment intersection test.
 * Returns intersection point and interpolation parameters (0..1) if segments intersect.
 */
export function lineSegmentIntersection(
  p1: MapPoint,
  p2: MapPoint,
  p3: MapPoint,
  p4: MapPoint
): { point: MapPoint; t1: number; t2: number } | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-6) return null; // Parallel or colinear

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;

  const t1 = (dx * d2y - dy * d2x) / cross;
  const t2 = (dx * d1y - dy * d1x) / cross;

  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return {
      point: {
        x: p1.x + t1 * d1x,
        y: p1.y + t1 * d1y,
      },
      t1,
      t2,
    };
  }

  return null;
}

/**
 * Finds the closest point on a polyline to an arbitrary query point.
 */
export function closestPointOnPolyline(
  p: MapPoint,
  polyline: MapPoint[]
): {
  point: MapPoint;
  distance: number;
  segmentIndex: number;
  t: number;
  tangent: MapPoint;
} {
  if (polyline.length < 2) {
    const pt = polyline[0] ?? p;
    return {
      point: pt,
      distance: Math.hypot(p.x - pt.x, p.y - pt.y),
      segmentIndex: 0,
      t: 0,
      tangent: { x: 1, y: 0 },
    };
  }

  let minDistance = Number.POSITIVE_INFINITY;
  let bestPoint = polyline[0];
  let bestSegment = 0;
  let bestT = 0;
  let bestTangent = { x: 1, y: 0 };

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 1e-6) {
      t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    }

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const dist = Math.hypot(p.x - projX, p.y - projY);

    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = { x: projX, y: projY };
      bestSegment = i;
      bestT = t;
      const len = Math.sqrt(lenSq);
      bestTangent = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
    }
  }

  return {
    point: bestPoint,
    distance: minDistance,
    segmentIndex: bestSegment,
    t: bestT,
    tangent: bestTangent,
  };
}

/**
 * Checks whether a location represents an authored bridge landmark.
 */
export function isBridgeLocation(loc: WorldLocation): boolean {
  if (loc.category?.toLowerCase() === 'bridge') return true;
  const name = loc.name.toLowerCase();
  if (name.includes('پل') || name.includes('bridge')) return true;
  return false;
}

/**
 * Generates a full ProceduralBridge geometry object given center, orientation, span, and deck width.
 */
export function generateProceduralBridge(options: {
  id: string;
  sourceType: 'route_crossing' | 'landmark_location';
  sourceId: string;
  riverId?: string;
  center: MapPoint;
  angle: number; // Deck heading in radians
  riverAngle?: number; // River flow angle in radians (used for upstream cutwaters)
  spanLength?: number;
  deckWidth?: number;
}): ProceduralBridge {
  const {
    id,
    sourceType,
    sourceId,
    riverId,
    center,
    angle,
    riverAngle = angle + Math.PI / 2,
    spanLength = 32,
    deckWidth = 10,
  } = options;

  const L = Math.max(16, spanLength);
  const W = Math.max(6, deckWidth);
  const halfL = L / 2;
  const halfW = W / 2;

  // Deck direction unit vector (tangent)
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  // Deck normal unit vector (perpendicular across deck)
  const nx = -uy;
  const ny = ux;

  // 1. Four corners of the main deck rectangle
  // P1: Left bank, top edge
  const p1: MapPoint = {
    x: center.x - ux * halfL - nx * halfW,
    y: center.y - uy * halfL - ny * halfW,
  };
  // P2: Right bank, top edge
  const p2: MapPoint = {
    x: center.x + ux * halfL - nx * halfW,
    y: center.y + uy * halfL - ny * halfW,
  };
  // P3: Right bank, bottom edge
  const p3: MapPoint = {
    x: center.x + ux * halfL + nx * halfW,
    y: center.y + uy * halfL + ny * halfW,
  };
  // P4: Left bank, bottom edge
  const p4: MapPoint = {
    x: center.x - ux * halfL + nx * halfW,
    y: center.y - uy * halfL + ny * halfW,
  };

  const deckPolygon = [p1, p2, p3, p4];

  // 2. Parapet lines & corner posts
  const leftParapet = [p1, p2];
  const rightParapet = [p4, p3];
  const cornerPosts = [p1, p2, p3, p4];

  // 3. Flared stone abutments on both banks
  const abutmentDepth = Math.max(6, Math.min(12, L * 0.22));
  const abutmentFlare = Math.max(2.5, W * 0.22);

  // Left bank abutment (anchoring into left riverbank)
  const laTop: MapPoint = {
    x: p1.x - ux * abutmentDepth - nx * abutmentFlare,
    y: p1.y - uy * abutmentDepth - ny * abutmentFlare,
  };
  const laBottom: MapPoint = {
    x: p4.x - ux * abutmentDepth + nx * abutmentFlare,
    y: p4.y - uy * abutmentDepth + ny * abutmentFlare,
  };
  const leftAbutment: BridgeAbutment = {
    polygon: [p1, laTop, laBottom, p4],
    wingLines: [
      [p1, laTop],
      [p4, laBottom],
    ],
  };

  // Right bank abutment (anchoring into right riverbank)
  const raTop: MapPoint = {
    x: p2.x + ux * abutmentDepth - nx * abutmentFlare,
    y: p2.y + uy * abutmentDepth - ny * abutmentFlare,
  };
  const raBottom: MapPoint = {
    x: p3.x + ux * abutmentDepth + nx * abutmentFlare,
    y: p3.y + uy * abutmentDepth + ny * abutmentFlare,
  };
  const rightAbutment: BridgeAbutment = {
    polygon: [p2, raTop, raBottom, p3],
    wingLines: [
      [p2, raTop],
      [p3, raBottom],
    ],
  };

  // 4. Transverse plank or cobblestone joint lines
  const transversePlanks: [MapPoint, MapPoint][] = [];
  const plankSpacing = 4.0;
  const numPlanks = Math.floor(L / plankSpacing);
  for (let i = 1; i < numPlanks; i++) {
    const s = -halfL + i * plankSpacing;
    const a: MapPoint = {
      x: center.x + ux * s - nx * (halfW - 0.5),
      y: center.y + uy * s - ny * (halfW - 0.5),
    };
    const b: MapPoint = {
      x: center.x + ux * s + nx * (halfW - 0.5),
      y: center.y + uy * s + ny * (halfW - 0.5),
    };
    transversePlanks.push([a, b]);
  }

  // 5. Piers in the water with pointed cutwaters pointing upstream
  const piers: BridgePier[] = [];
  const archShadows: MapPoint[][] = [];

  // Determine number of piers based on span length
  const pierPositions: number[] = [];
  if (L >= 42) {
    pierPositions.push(-halfL * 0.45, halfL * 0.45);
  } else if (L >= 20) {
    pierPositions.push(0);
  }

  // River flow vector
  const rx = Math.cos(riverAngle);
  const ry = Math.sin(riverAngle);

  // Upstream direction is opposite river flow: (-rx, -ry)
  const upX = -rx;
  const upY = -ry;
  // Downstream direction
  const downX = rx;
  const downY = ry;

  const pierThickness = Math.max(3, W * 0.35);
  const cutwaterLength = Math.max(4, W * 0.65);

  for (const pos of pierPositions) {
    const pierCenter: MapPoint = {
      x: center.x + ux * pos,
      y: center.y + uy * pos,
    };

    // Pier cutwater pointed upstream
    const cutwaterApex: MapPoint = {
      x: pierCenter.x + upX * (halfW + cutwaterLength),
      y: pierCenter.y + upY * (halfW + cutwaterLength),
    };

    // Pier tail pointed downstream
    const tailApex: MapPoint = {
      x: pierCenter.x + downX * (halfW + cutwaterLength * 0.8),
      y: pierCenter.y + downY * (halfW + cutwaterLength * 0.8),
    };

    // Lateral pier corners
    const leftCorner: MapPoint = {
      x: pierCenter.x - ux * (pierThickness / 2),
      y: pierCenter.y - uy * (pierThickness / 2),
    };
    const rightCorner: MapPoint = {
      x: pierCenter.x + ux * (pierThickness / 2),
      y: pierCenter.y + uy * (pierThickness / 2),
    };

    const pierPoly: MapPoint[] = [cutwaterApex, rightCorner, tailApex, leftCorner];

    // Wake ripples downstream
    const wakeRipples: MapPoint[][] = [];
    for (let r = 1; r <= 2; r++) {
      const ripOffset = halfW + cutwaterLength * 0.8 + r * 4.5;
      const ripApex: MapPoint = {
        x: pierCenter.x + downX * ripOffset,
        y: pierCenter.y + downY * ripOffset,
      };
      const ripL: MapPoint = {
        x: ripApex.x - downX * 3 - ux * (4 + r * 2),
        y: ripApex.y - downY * 3 - uy * (4 + r * 2),
      };
      const ripR: MapPoint = {
        x: ripApex.x - downX * 3 + ux * (4 + r * 2),
        y: ripApex.y - downY * 3 + uy * (4 + r * 2),
      };
      wakeRipples.push([ripL, ripApex, ripR]);
    }

    piers.push({
      center: pierCenter,
      polygon: pierPoly,
      cutwaterApex,
      tailApex,
      wakeRipples,
    });
  }

  // 6. Arch barrel vault shadows under deck spans
  // Shaded band along the downstream side between abutments and piers
  const allSupports = [-halfL, ...pierPositions, halfL];
  for (let i = 0; i < allSupports.length - 1; i++) {
    const s1 = allSupports[i];
    const s2 = allSupports[i + 1];
    const shadowDepth = Math.max(2, W * 0.28);

    const a1: MapPoint = {
      x: center.x + ux * s1 + nx * (halfW - shadowDepth),
      y: center.y + uy * s1 + ny * (halfW - shadowDepth),
    };
    const a2: MapPoint = {
      x: center.x + ux * s2 + nx * (halfW - shadowDepth),
      y: center.y + uy * s2 + ny * (halfW - shadowDepth),
    };
    const a3: MapPoint = {
      x: center.x + ux * s2 + nx * halfW,
      y: center.y + uy * s2 + ny * halfW,
    };
    const a4: MapPoint = {
      x: center.x + ux * s1 + nx * halfW,
      y: center.y + uy * s1 + ny * halfW,
    };

    archShadows.push([a1, a2, a3, a4]);
  }

  return {
    id,
    sourceType,
    sourceId,
    riverId,
    center,
    angle,
    spanLength: L,
    deckWidth: W,
    deckPolygon,
    leftAbutment,
    rightAbutment,
    parapets: [leftParapet, rightParapet],
    cornerPosts,
    transversePlanks,
    piers,
    archShadows,
  };
}

/**
 * Scans routes and locations for river crossings and generates procedural bridges.
 */
export function detectBridges(options: BridgeDetectionOptions): ProceduralBridge[] {
  const {
    locations = [],
    mapRoutes = [],
    tradeRoutes = [],
    terrainFeatures = [],
    routeSource,
  } = options;

  const bridges: ProceduralBridge[] = [];
  const rivers = terrainFeatures.filter(
    (f) => f.type === 'river' && f.points && f.points.length >= 2 && f.visible !== false
  );

  if (rivers.length === 0 && locations.length === 0) return bridges;

  // Track crossing coordinates to avoid duplicate bridges within 16px
  const existingCrossings: MapPoint[] = [];

  function isNearExisting(p: MapPoint, threshold = 16): boolean {
    return existingCrossings.some((ep) => Math.hypot(p.x - ep.x, p.y - ep.y) < threshold);
  }

  // 1. Detect landmark bridge locations (e.g. Zarrin-Pol / زرین‌پل)
  for (const loc of locations) {
    if (!loc.coordinates || loc.visible === false) continue;
    if (!isBridgeLocation(loc)) continue;

    // Look for a river within 50px
    let nearestRiver: MapTerrainFeature | null = null;
    let nearestDist = Number.POSITIVE_INFINITY;
    let snapResult: ReturnType<typeof closestPointOnPolyline> | null = null;

    for (const river of rivers) {
      if (!river.points || river.points.length < 2) continue;
      const res = closestPointOnPolyline(loc.coordinates, river.points);
      if (res.distance < nearestDist) {
        nearestDist = res.distance;
        nearestRiver = river;
        snapResult = res;
      }
    }

    let bridgeCenter = loc.coordinates;
    let deckAngle = 0; // Default horizontal
    let riverAngle = Math.PI / 2;
    let span = 36;
    let deckW = 12;

    if (nearestRiver && snapResult && nearestDist <= 55) {
      // Snap to river centerline
      bridgeCenter = snapResult.point;
      const riverTangent = snapResult.tangent;
      riverAngle = Math.atan2(riverTangent.y, riverTangent.x);
      // Bridge spans perpendicular across the river
      deckAngle = riverAngle + Math.PI / 2;
      const riverW = nearestRiver.width ?? 14;
      span = Math.max(28, riverW + 18);
      deckW = Math.max(10, Math.min(18, span * 0.35));
    }

    const bridge = generateProceduralBridge({
      id: `bridge_loc_${loc.id}`,
      sourceType: 'landmark_location',
      sourceId: loc.id,
      riverId: nearestRiver?.id,
      center: bridgeCenter,
      angle: deckAngle,
      riverAngle,
      spanLength: span,
      deckWidth: deckW,
    });

    bridges.push(bridge);
    existingCrossings.push(bridgeCenter);
  }

  // Helper to test a polyline against rivers
  const testPolylineAgainstRivers = (
    polyline: MapPoint[],
    sourceType: 'route_crossing',
    sourceId: string,
    routeWidth = 4
  ) => {
    if (polyline.length < 2) return;

    for (let i = 0; i < polyline.length - 1; i++) {
      const rA = polyline[i];
      const rB = polyline[i + 1];

      for (const river of rivers) {
        const rPoints = river.points!;
        for (let j = 0; j < rPoints.length - 1; j++) {
          const vA = rPoints[j];
          const vB = rPoints[j + 1];

          const hit = lineSegmentIntersection(rA, rB, vA, vB);
          if (hit && !isNearExisting(hit.point, 18)) {
            const roadDx = rB.x - rA.x;
            const roadDy = rB.y - rA.y;
            const roadAngle = Math.atan2(roadDy, roadDx);

            const riverDx = vB.x - vA.x;
            const riverDy = vB.y - vA.y;
            const riverAngle = Math.atan2(riverDy, riverDx);

            const riverW = river.width ?? 12;
            const span = Math.max(24, riverW + 16);
            const deckW = Math.max(7, routeWidth + 3);

            const bridge = generateProceduralBridge({
              id: `bridge_${sourceId}_${Math.round(hit.point.x)}_${Math.round(hit.point.y)}`,
              sourceType,
              sourceId,
              riverId: river.id,
              center: hit.point,
              angle: roadAngle,
              riverAngle,
              spanLength: span,
              deckWidth: deckW,
            });

            bridges.push(bridge);
            existingCrossings.push(hit.point);
          }
        }
      }
    }
  };

  // 2. Detect intersections with drawn map routes (MapRoute)
  for (const route of mapRoutes) {
    if (route.visible === false) continue;
    let points: MapPoint[] = [];
    if (routeSource) {
      points = resolveMapRoutePoints(route, routeSource).points;
    } else {
      points = [route.origin.fallback, ...(route.path ?? []), route.destination.fallback];
    }
    testPolylineAgainstRivers(points, 'route_crossing', route.id, route.width ?? 4);
  }

  // 3. Detect intersections with trade caravan routes (WorldTradeRoute)
  const locMap = new Map(locations.map((l) => [l.id, l]));
  for (const tradeRoute of tradeRoutes) {
    if (tradeRoute.visible === false) continue;
    const orig = locMap.get(tradeRoute.originLocationId);
    const dest = locMap.get(tradeRoute.destinationLocationId);
    if (!orig?.coordinates || !dest?.coordinates) continue;

    const fullPoints: MapPoint[] = [
      orig.coordinates,
      ...(tradeRoute.waypoints ?? []),
      dest.coordinates,
    ];
    testPolylineAgainstRivers(fullPoints, 'route_crossing', tradeRoute.id, 5);
  }

  return bridges;
}
