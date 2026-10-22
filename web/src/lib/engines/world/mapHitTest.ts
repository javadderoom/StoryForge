/**
 * mapHitTest.ts
 *
 * Plan 21 — geometry-accurate picking for the Cartographer canvas.
 *
 * Why this module exists
 * ----------------------
 * The canvas used to hit-test through a bounding-box index that only knew
 * about point-shaped objects. Every shape an author actually draws — a
 * landmass, a river, a valley, a lore pin — is polygon- or polyline-shaped,
 * so it was never in the index. The practical effect: those objects could not
 * be selected, therefore could not be opened in the Inspector, therefore could
 * not be deleted. Authoring was effectively append-only.
 *
 * This module answers one question: "what did the author just click?"
 *
 * Rules
 * -----
 *  - Tiers. A pin (location / lore pin / waypoint) always beats an area, an
 *    area always beats a line, a line beats a point feature. Clicking a
 *    settlement that stands on a continent selects the settlement, not the
 *    continent.
 *  - Within a tier: nearest wins; ties go to the topmost object (highest
 *    draw order), then to the smaller object (an islet beats the continent it
 *    sits in).
 *  - Hidden and locked objects are never picked. A locked object is unlocked
 *    from the object list, exactly like a locked layer in a design tool.
 *  - Objects on a layer the author switched off are never picked, so a hidden
 *    settlement or road leaves genuine empty parchment behind.
 *
 * Pure module: no React, no Pixi, no DOM — so the behaviour is unit-testable
 * without a browser.
 */

import type {
  MapEntityPlacement,
  MapPoint,
  MapTerrainFeature,
  WorldLocation,
  WorldMapSettings,
  WorldTradeRoute,
} from '@/lib/types/world';
import {
  effectiveTerrainZIndex,
  isObjectLocked,
  isObjectVisible,
  isPlacementVisibleInLayers,
  isTerrainVisibleInLayers,
} from './mapObjectOrder';

/** Pick priority tiers — lower wins. */
export const HIT_TIER = {
  /** Locations, lore pins, route waypoints. */
  PIN: 0,
  /** Point terrain: peaks, volcanoes, oases. */
  POINT: 1,
  /** Ink lines: rivers, ranges, valleys, route strokes. */
  LINE: 2,
  /** Filled areas: landmasses, biomes, lakes. */
  AREA: 3,
} as const;

export type MapHitKind = 'location' | 'waypoint' | 'terrain' | 'placement' | 'trade_route';

export type MapHitCandidate =
  | { kind: 'location'; id: string; location: WorldLocation }
  | { kind: 'waypoint'; id: string; routeId: string; index: number; point: MapPoint }
  | { kind: 'terrain'; id: string; feature: MapTerrainFeature }
  | { kind: 'placement'; id: string; placement: MapEntityPlacement }
  | { kind: 'trade_route'; id: string; route: WorldTradeRoute; points: MapPoint[] };

export interface MapHitBase {
  /** Distance in world units; 0 means "inside the shape". */
  distance: number;
  tier: number;
  /** Draw order of the hit object (higher = on top). */
  zIndex: number;
  /** Enclosed area, used to break ties in favour of the smaller object. */
  area: number;
}

/**
 * A pick result. The union is keyed on `kind` so narrowing `hit.kind` also
 * narrows `hit.candidate` — the caller can read the payload without casting.
 */
export type MapHit = {
  [K in MapHitKind]: MapHitBase & {
    kind: K;
    id: string;
    candidate: Extract<MapHitCandidate, { kind: K }>;
  };
}[MapHitKind];

export interface MapHitTestOptions {
  /** Grab radius for pins, points and lines, in world units. */
  grabRadius?: number;
  /** Extra tolerance around a polygon edge. */
  edgeTolerance?: number;
  /**
   * The layer switches currently on screen. When provided, objects whose
   * layer is switched off are not pickable — hiding a layer must disable its
   * objects for clicking, exactly as it disables them for drawing.
   */
  visibleLayers?: WorldMapSettings['visibleLayers'];
}

export const DEFAULT_GRAB_RADIUS = 14;
export const DEFAULT_EDGE_TOLERANCE = 10;

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

/**
 * Ray-casting point-in-polygon test.
 *
 * Works for both screen-space (y down) and world-space (y up) rings: the
 * crossing count is orientation independent. A point exactly on an edge may
 * land on either side, which is acceptable — the edge tolerance covers it.
 */
export function pointInPolygon(point: MapPoint, ring: MapPoint[]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const straddles = yi > point.y !== yj > point.y;
    if (straddles) {
      const crossX = ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (point.x < crossX) inside = !inside;
    }
  }
  return inside;
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(p: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Shortest distance from a point to a polyline (open or closed). */
export function distanceToPolyline(p: MapPoint, points: MapPoint[]): number {
  if (!points || points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const d = distanceToSegment(p, points[i - 1], points[i]);
    if (d < best) best = d;
  }
  return best;
}

/** Shortest distance from a point to a closed ring's edges. */
export function distanceToRing(p: MapPoint, ring: MapPoint[]): number {
  if (!ring || ring.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const d = distanceToSegment(p, ring[i - 1], ring[i]);
    if (d < best) best = d;
  }
  // The ring is stored open (the closing edge is implicit).
  if (ring.length > 2) {
    const closing = distanceToSegment(p, ring[ring.length - 1], ring[0]);
    if (closing < best) best = closing;
  }
  return best;
}

/** Absolute area of a ring (shoelace). */
export function ringArea(ring: MapPoint[]): number {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(sum / 2);
}

// ---------------------------------------------------------------------------
// Candidate construction
// ---------------------------------------------------------------------------

export interface MapHitCandidateInput {
  locations?: WorldLocation[];
  tradeRoutes?: WorldTradeRoute[];
  terrainFeatures?: MapTerrainFeature[];
  placements?: MapEntityPlacement[];
}

/**
 * Flattens the world into a list of pickable objects. The route polyline is
 * resolved here (origin → waypoints → destination) so a click on the stroke
 * of a road can be picked, not only its waypoint dots.
 *
 * Only objects the renderer can actually draw are indexed: a location at the
 * unplaced `x <= 0` sentinel and a route with a missing endpoint have no ink on
 * the map, so indexing them would create invisible click targets.
 */
export function buildMapHitCandidates(input: MapHitCandidateInput): MapHitCandidate[] {
  const candidates: MapHitCandidate[] = [];
  const locations = input.locations ?? [];
  const routes = input.tradeRoutes ?? [];

  for (const loc of locations) {
    // x <= 0 is the "not placed on the map" sentinel; the renderer skips those
    // settlements, so they must not be pickable at the left edge either.
    if (loc.coordinates && loc.coordinates.x > 0) {
      candidates.push({ kind: 'location', id: loc.id, location: loc });
    }
  }

  for (const route of routes) {
    const origin = locations.find((l) => l.id === route.originLocationId);
    const dest = locations.find((l) => l.id === route.destinationLocationId);
    // A route without both endpoint coordinates is not drawn. Its waypoint
    // dots are not drawn either, so indexing them would make invisible
    // handles clickable.
    if (!origin?.coordinates || !dest?.coordinates) continue;

    const waypoints = route.waypoints ?? [];
    waypoints.forEach((point, index) => {
      candidates.push({ kind: 'waypoint', id: `wp_${route.id}_${index}`, routeId: route.id, index, point });
    });
    candidates.push({
      kind: 'trade_route',
      id: route.id,
      route,
      points: [origin.coordinates, ...waypoints, dest.coordinates],
    });
  }

  for (const feature of input.terrainFeatures ?? []) {
    candidates.push({ kind: 'terrain', id: feature.id, feature });
  }

  for (const placement of input.placements ?? []) {
    candidates.push({ kind: 'placement', id: placement.id, placement });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOfPoints(points: MapPoint[], pad = 0): MapBounds | null {
  if (!points || points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/**
 * The bounding box of a pickable object, used as the coarse filter in front
 * of the exact geometry test. Returns null for an object with no geometry at
 * all (an authored feature that never got its points) — such an object has
 * nothing to click.
 */
export function hitCandidateBounds(candidate: MapHitCandidate, pad = 0): MapBounds | null {
  switch (candidate.kind) {
    case 'location':
      return candidate.location.coordinates
        ? boundsOfPoints([candidate.location.coordinates], pad)
        : null;
    case 'waypoint':
      return boundsOfPoints([candidate.point], pad);
    case 'placement':
      return boundsOfPoints([{ x: candidate.placement.x, y: candidate.placement.y }], pad);
    case 'trade_route':
      return boundsOfPoints(candidate.points, pad);
    case 'terrain': {
      const feature = candidate.feature;
      if (feature.polygon && feature.polygon.length > 0) {
        const ring = boundsOfPoints(feature.polygon, pad);
        if (!ring) return null;
        for (const hole of feature.holes ?? []) {
          const holeBox = boundsOfPoints(hole);
          if (!holeBox) continue;
          ring.minX = Math.min(ring.minX, holeBox.minX);
          ring.minY = Math.min(ring.minY, holeBox.minY);
          ring.maxX = Math.max(ring.maxX, holeBox.maxX);
          ring.maxY = Math.max(ring.maxY, holeBox.maxY);
        }
        return ring;
      }
      if (feature.points && feature.points.length > 0) {
        return boundsOfPoints(feature.points, pad);
      }
      if (typeof feature.x === 'number' && typeof feature.y === 'number') {
        const r = (feature.radius ?? 0) + pad;
        return { minX: feature.x - r, minY: feature.y - r, maxX: feature.x + r, maxY: feature.y + r };
      }
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// The hit test
// ---------------------------------------------------------------------------

function hitFor(
  candidate: MapHitCandidate,
  point: MapPoint,
  grab: number,
  edge: number,
  layers?: WorldMapSettings['visibleLayers']
): MapHit | null {
  switch (candidate.kind) {
    case 'location': {
      if (layers && !layers.settlements) return null;
      const c = candidate.location.coordinates!;
      const distance = Math.hypot(point.x - c.x, point.y - c.y);
      if (distance > grab + 12) return null;
      return {
        kind: 'location',
        id: candidate.id,
        distance,
        tier: HIT_TIER.PIN,
        zIndex: 0,
        area: 0,
        candidate,
      };
    }

    case 'waypoint': {
      if (layers && !layers.caravanRoutes) return null;
      const distance = Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y);
      if (distance > grab) return null;
      return {
        kind: 'waypoint',
        id: candidate.id,
        distance,
        tier: HIT_TIER.PIN,
        zIndex: 0,
        area: 0,
        candidate,
      };
    }

    case 'placement': {
      const placement = candidate.placement;
      if (!isObjectVisible(placement) || isObjectLocked(placement)) return null;
      if (layers && !isPlacementVisibleInLayers(placement.entityType, layers)) return null;
      const distance = Math.hypot(point.x - placement.x, point.y - placement.y);
      if (distance > grab) return null;
      return {
        kind: 'placement',
        id: candidate.id,
        distance,
        tier: HIT_TIER.PIN,
        zIndex: placement.zIndex ?? 0,
        area: 0,
        candidate,
      };
    }

    case 'trade_route': {
      if (layers && !layers.caravanRoutes) return null;
      const distance = distanceToPolyline(point, candidate.points);
      if (distance > grab) return null;
      return {
        kind: 'trade_route',
        id: candidate.id,
        distance,
        tier: HIT_TIER.LINE,
        zIndex: 0,
        area: 0,
        candidate,
      };
    }

    case 'terrain':
      return hitTerrain(candidate, point, grab, edge, layers);
  }
}

function hitTerrain(
  candidate: Extract<MapHitCandidate, { kind: 'terrain' }>,
  point: MapPoint,
  grab: number,
  edge: number,
  layers?: WorldMapSettings['visibleLayers']
): MapHit | null {
  const feature = candidate.feature;
  if (!isObjectVisible(feature) || isObjectLocked(feature)) return null;
  if (layers && !isTerrainVisibleInLayers(feature.type, layers)) return null;

  const zIndex = effectiveTerrainZIndex(feature, 0);

  // 1. Filled area (landmass, biome, lake) — a polygon with optional holes.
  const polygon = feature.polygon;
  if (polygon && polygon.length >= 3) {
    const area = ringArea(polygon);
    const holes = feature.holes ?? [];
    const inHole = holes.some((hole) => hole.length >= 3 && pointInPolygon(point, hole));
    if (!inHole && pointInPolygon(point, polygon)) {
      return {
        kind: 'terrain',
        id: candidate.id,
        distance: 0,
        tier: HIT_TIER.AREA,
        zIndex,
        area,
        candidate,
      };
    }
    const edgeDistance = distanceToRing(point, polygon);
    if (edgeDistance <= edge) {
      return {
        kind: 'terrain',
        id: candidate.id,
        distance: edgeDistance,
        tier: HIT_TIER.AREA,
        zIndex,
        area,
        candidate,
      };
    }
    return null;
  }

  // 2. Ink line (river, range, valley).
  const points = feature.points;
  if (points && points.length >= 1) {
    const halfWidth = (feature.width ?? 0) / 2;
    const distance = distanceToPolyline(point, points);
    if (distance > grab + halfWidth) return null;
    return {
      kind: 'terrain',
      id: candidate.id,
      distance,
      tier: HIT_TIER.LINE,
      zIndex,
      area: 0,
      candidate,
    };
  }

  // 3. Point feature (peak, volcano, oasis).
  if (typeof feature.x === 'number' && typeof feature.y === 'number') {
    const radius = feature.radius ?? 0;
    const distance = Math.hypot(point.x - feature.x, point.y - feature.y) - radius;
    if (distance > grab) return null;
    return {
      kind: 'terrain',
      id: candidate.id,
      distance,
      tier: HIT_TIER.POINT,
      zIndex,
      area: 0,
      candidate,
    };
  }

  return null;
}

/**
 * Orders two hits: tier first, then distance, then topmost, then smallest.
 */
export function compareMapHits(a: MapHit, b: MapHit): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.distance !== b.distance) return a.distance - b.distance;
  if (a.zIndex !== b.zIndex) return b.zIndex - a.zIndex;
  if (a.area !== b.area) return a.area - b.area;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Returns the object under the point, or null when the click hit nothing.
 */
export function hitTestMapObjects(
  point: MapPoint,
  candidates: MapHitCandidate[],
  options?: MapHitTestOptions
): MapHit | null {
  const grab = options?.grabRadius ?? DEFAULT_GRAB_RADIUS;
  const edge = options?.edgeTolerance ?? DEFAULT_EDGE_TOLERANCE;
  const layers = options?.visibleLayers;

  let best: MapHit | null = null;
  for (const candidate of candidates) {
    const hit = hitFor(candidate, point, grab, edge, layers);
    if (!hit) continue;
    if (!best || compareMapHits(hit, best) < 0) best = hit;
  }
  return best;
}

/**
 * Convenience entry point: hit-tests straight against the world's collections
 * (locations, routes, terrain features, lore pins) without the caller having
 * to flatten them first.
 */
export function hitTestMapObjectsIn(
  point: MapPoint,
  input: MapHitCandidateInput,
  options?: MapHitTestOptions
): MapHit | null {
  return hitTestMapObjects(point, buildMapHitCandidates(input), options);
}
