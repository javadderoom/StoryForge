/**
 * mapRoutes.ts
 *
 * Plan 25 — the pure geometry and metadata layer for drawn roads.
 *
 * A route is stored as two endpoint *references* plus a free-drawn interior
 * path. Nothing here touches React, Pixi or the DOM, so the renderer, the hit
 * test, the marquee, the Inspector and the unit tests all agree on:
 *
 *  - where an endpoint resolves to right now,
 *  - which geo element the next click should snap to,
 *  - how a freehand stroke becomes a small, stable path,
 *  - what a road kind looks like and how hard it is to travel.
 */

import type {
  CustomPlaceCategory,
  MapEntityPlacement,
  MapPoint,
  MapRoute,
  MapRouteAnchor,
  MapRouteDifficulty,
  MapRouteEndpoint,
  MapRouteEndpointRef,
  MapRouteKind,
  MapRouteLineStyle,
  MapTerrainFeature,
  WorldLocation,
} from '@/lib/types/world';
import { isObjectLocked, isObjectVisible } from './mapObjectOrder';
import { isPointPlaceCategory } from './placeCategories';

export interface MapRouteSource {
  locations?: WorldLocation[];
  terrainFeatures?: MapTerrainFeature[];
  placements?: MapEntityPlacement[];
  placeCategories?: CustomPlaceCategory[];
}

export interface RouteKindMeta {
  en: string;
  fa: string;
  width: number;
  lineStyle: MapRouteLineStyle;
  color: number;
  casing: number;
  defaultDifficulty: MapRouteDifficulty;
  travelMultiplier: number;
}

/**
 * The one style table for every road type. `width` is in world units at zoom
 * 1; the renderer multiplies nothing, so a road keeps its weight when the map
 * is zoomed. Colours are muted inks that sit on parchment without competing
 * with the blue rivers or the orange caravan overlay.
 */
export const MAP_ROUTE_KIND_META: Record<MapRouteKind, RouteKindMeta> = {
  highway: {
    en: 'Highway',
    fa: 'شاهراه',
    width: 4.4,
    lineStyle: 'double',
    color: 0x8a5a2b,
    casing: 0x3f2a17,
    defaultDifficulty: 1,
    travelMultiplier: 1,
  },
  road: {
    en: 'Road',
    fa: 'جاده',
    width: 3.2,
    lineStyle: 'solid',
    color: 0x8a6a45,
    casing: 0x4a3520,
    defaultDifficulty: 2,
    travelMultiplier: 1.2,
  },
  dirt_road: {
    en: 'Dirt Road',
    fa: 'جاده خاکی',
    width: 2.7,
    lineStyle: 'dashed',
    color: 0x9c7c4f,
    casing: 0x4f3a22,
    defaultDifficulty: 2,
    travelMultiplier: 1.4,
  },
  trail: {
    en: 'Trail',
    fa: 'راه مالرو',
    width: 2,
    lineStyle: 'dashed',
    color: 0x6b5a45,
    casing: 0x3a2f23,
    defaultDifficulty: 3,
    travelMultiplier: 1.8,
  },
  mountain_pass: {
    en: 'Mountain Pass',
    fa: 'گردنه کوهستانی',
    width: 2.4,
    lineStyle: 'dashed',
    color: 0x7a4b2a,
    casing: 0x3f2614,
    defaultDifficulty: 4,
    travelMultiplier: 2.4,
  },
  bridge: {
    en: 'Bridge',
    fa: 'پل',
    width: 4,
    lineStyle: 'solid',
    color: 0x9b7653,
    casing: 0x4c3724,
    defaultDifficulty: 1,
    travelMultiplier: 1,
  },
  ferry: {
    en: 'Ferry',
    fa: 'گذرگاه آبی',
    width: 2.4,
    lineStyle: 'dotted',
    color: 0x4f7fa3,
    casing: 0x28465c,
    defaultDifficulty: 3,
    travelMultiplier: 2,
  },
  sea_lane: {
    en: 'Sea Lane',
    fa: 'گذرگاه دریایی',
    width: 2.2,
    lineStyle: 'dotted',
    color: 0x3f6f93,
    casing: 0x213e53,
    defaultDifficulty: 3,
    travelMultiplier: 1.6,
  },
  secret_path: {
    en: 'Secret Path',
    fa: 'گذر مخفی',
    width: 1.8,
    lineStyle: 'dotted',
    color: 0x6b4c8a,
    casing: 0x352646,
    defaultDifficulty: 4,
    travelMultiplier: 2,
  },
  caravan: {
    en: 'Caravan Road',
    fa: 'شاهراه کاروان',
    width: 3.4,
    lineStyle: 'solid',
    color: 0xb07a3c,
    casing: 0x5b3d1c,
    defaultDifficulty: 2,
    travelMultiplier: 1.3,
  },
};

export const MAP_ROUTE_DIFFICULTY_LABELS: Record<
  MapRouteDifficulty,
  { en: string; fa: string }
> = {
  1: { en: 'Easy', fa: 'آسان' },
  2: { en: 'Moderate', fa: 'متوسط' },
  3: { en: 'Hard', fa: 'سخت' },
  4: { en: 'Severe', fa: 'بسیار سخت' },
  5: { en: 'Treacherous', fa: 'صعب‌العبور' },
};

export function routeKindLabel(kind: MapRouteKind, isPersian: boolean): string {
  return isPersian ? MAP_ROUTE_KIND_META[kind].fa : MAP_ROUTE_KIND_META[kind].en;
}

export function routeDifficultyLabel(
  difficulty: MapRouteDifficulty,
  isPersian: boolean
): string {
  return isPersian
    ? MAP_ROUTE_DIFFICULTY_LABELS[difficulty].fa
    : MAP_ROUTE_DIFFICULTY_LABELS[difficulty].en;
}

/** Default name for a newly drawn road, in the author's language. */
export function defaultMapRouteName(
  originLabel: string,
  destinationLabel: string,
  kind: MapRouteKind,
  isPersian: boolean
): string {
  const kindLabel = routeKindLabel(kind, isPersian);
  const from = originLabel || (isPersian ? 'مبدأ' : 'Origin');
  const to = destinationLabel || (isPersian ? 'مقصد' : 'Destination');
  return isPersian ? `${kindLabel}: ${from} ← ${to}` : `${kindLabel}: ${from} → ${to}`;
}

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export interface NearestPolylinePoint {
  point: MapPoint;
  segment: number;
  t: number;
  distance: number;
}

/**
 * Nearest point on a polyline. A closed ring includes its implicit closing
 * edge, and `segment === points.length - 1` addresses that edge.
 */
export function nearestPointOnPolyline(
  point: MapPoint,
  points: MapPoint[],
  closed = false
): NearestPolylinePoint | null {
  if (!points || points.length === 0) return null;
  if (points.length === 1) {
    return {
      point: { ...points[0] },
      segment: 0,
      t: 0,
      distance: Math.hypot(point.x - points[0].x, point.y - points[0].y),
    };
  }

  const segmentCount = closed ? points.length : points.length - 1;
  let best: NearestPolylinePoint | null = null;

  for (let segment = 0; segment < segmentCount; segment++) {
    const a = points[segment];
    const b = points[(segment + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const nearest = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(point.x - nearest.x, point.y - nearest.y);
    if (!best || distance < best.distance) {
      best = {
        point: nearest,
        segment,
        t,
        distance,
      };
    }
  }

  return best;
}

type RouteTargetGeometry =
  | { kind: 'point'; point: MapPoint }
  | { kind: 'polyline'; points: MapPoint[] }
  | { kind: 'ring'; points: MapPoint[] };

function terrainGeometry(feature: MapTerrainFeature): RouteTargetGeometry | null {
  if (feature.polygon && feature.polygon.length >= 3) {
    return { kind: 'ring', points: feature.polygon };
  }
  if (feature.points && feature.points.length > 0) {
    return feature.points.length === 1
      ? { kind: 'point', point: feature.points[0] }
      : { kind: 'polyline', points: feature.points };
  }
  if (typeof feature.x === 'number' && typeof feature.y === 'number') {
    return { kind: 'point', point: { x: feature.x, y: feature.y } };
  }
  return null;
}

function targetGeometryFromRef(
  ref: MapRouteEndpointRef,
  source: MapRouteSource
): RouteTargetGeometry | null {
  if (ref.kind === 'terrain') {
    const feature = (source.terrainFeatures ?? []).find((item) => item.id === ref.id);
    return feature ? terrainGeometry(feature) : null;
  }

  if (ref.kind === 'placement') {
    const placement = (source.placements ?? []).find((item) => item.id === ref.id);
    return placement ? { kind: 'point', point: { x: placement.x, y: placement.y } } : null;
  }

  const location = (source.locations ?? []).find((item) => item.id === ref.id);
  if (!location) return null;

  if (isPointPlaceCategory(location.category, source.placeCategories)) {
    return location.coordinates ? { kind: 'point', point: location.coordinates } : null;
  }

  // A river / mountain / sea can exist as a semantic place with its geometry
  // realized by a linked terrain. Attach to the geometry, not to the label.
  const linked = (source.terrainFeatures ?? []).find((item) => item.locationId === ref.id);
  if (linked) {
    const geometry = terrainGeometry(linked);
    if (geometry) return geometry;
  }

  return location.coordinates ? { kind: 'point', point: location.coordinates } : null;
}

function anchorForGeometry(
  geometry: RouteTargetGeometry,
  point: MapPoint
): { anchor: MapRouteAnchor; point: MapPoint } {
  if (geometry.kind === 'point') {
    return { anchor: { kind: 'point' }, point: geometry.point };
  }
  const nearest = nearestPointOnPolyline(point, geometry.points, geometry.kind === 'ring');
  if (!nearest) return { anchor: { kind: 'point' }, point };
  return {
    anchor: { kind: 'segment', segment: nearest.segment, t: nearest.t },
    point: nearest.point,
  };
}

/** The live world position of one route end. */
export function resolveRouteEndpointPoint(
  endpoint: MapRouteEndpoint,
  source: MapRouteSource
): { point: MapPoint; dangling: boolean } {
  if (!endpoint.ref) return { point: { ...endpoint.fallback }, dangling: false };

  const geometry = targetGeometryFromRef(endpoint.ref, source);
  if (!geometry) return { point: { ...endpoint.fallback }, dangling: true };

  if (geometry.kind === 'point') {
    return { point: { ...geometry.point }, dangling: false };
  }

  const anchor = endpoint.anchor;
  if (!anchor || anchor.kind !== 'segment') {
    const nearest = nearestPointOnPolyline(
      endpoint.fallback,
      geometry.points,
      geometry.kind === 'ring'
    );
    return { point: nearest ? nearest.point : { ...endpoint.fallback }, dangling: false };
  }

  const count = geometry.points.length;
  if (count === 0) return { point: { ...endpoint.fallback }, dangling: true };

  if (geometry.kind === 'polyline') {
    const segment = Math.max(0, Math.min(anchor.segment, count - 2));
    const a = geometry.points[segment];
    const b = geometry.points[segment + 1] ?? a;
    return {
      point: { x: a.x + (b.x - a.x) * anchor.t, y: a.y + (b.y - a.y) * anchor.t },
      dangling: false,
    };
  }

  const segment = Math.max(0, Math.min(anchor.segment, count - 1));
  const a = geometry.points[segment];
  const b = geometry.points[(segment + 1) % count];
  return {
    point: { x: a.x + (b.x - a.x) * anchor.t, y: a.y + (b.y - a.y) * anchor.t },
    dangling: false,
  };
}

export function endpointLabelForRef(
  ref: MapRouteEndpointRef | undefined,
  source: MapRouteSource,
  fallback: string
): string {
  if (!ref) return fallback;
  if (ref.kind === 'location') {
    return (source.locations ?? []).find((item) => item.id === ref.id)?.name ?? fallback;
  }
  if (ref.kind === 'terrain') {
    return (source.terrainFeatures ?? []).find((item) => item.id === ref.id)?.name ?? fallback;
  }
  const placement = (source.placements ?? []).find((item) => item.id === ref.id);
  return placement?.customLabel ?? fallback;
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

export const ROUTE_SNAP_RADIUS = 30;

interface SnapCandidate {
  tier: number;
  distance: number;
  endpoint: MapRouteEndpoint;
  label: string;
}

/**
 * Finds the geo element a route end should attach to. Pins beat point terrain,
 * point terrain beats lines, and lines beat areas — so clicking a city that
 * stands on a river attaches to the city, while clicking the open riverbank
 * attaches to the river.
 */
export function snapRouteEndpoint(
  point: MapPoint,
  source: MapRouteSource,
  radius = ROUTE_SNAP_RADIUS
): { endpoint: MapRouteEndpoint; label: string; distance: number } | null {
  const candidates: SnapCandidate[] = [];

  for (const location of source.locations ?? []) {
    if (!isObjectVisible(location) || isObjectLocked(location)) continue;
    if (!isPointPlaceCategory(location.category, source.placeCategories)) continue;
    if (!location.coordinates || location.coordinates.x <= 0) continue;
    const distance = Math.hypot(point.x - location.coordinates.x, point.y - location.coordinates.y);
    if (distance > radius) continue;
    candidates.push({
      tier: 0,
      distance,
      label: location.name,
      endpoint: {
        ref: { kind: 'location', id: location.id },
        anchor: { kind: 'point' },
        fallback: { ...location.coordinates },
      },
    });
  }

  for (const placement of source.placements ?? []) {
    if (!isObjectVisible(placement) || isObjectLocked(placement)) continue;
    const distance = Math.hypot(point.x - placement.x, point.y - placement.y);
    if (distance > radius) continue;
    candidates.push({
      tier: 1,
      distance,
      label: placement.customLabel ?? placement.entityType,
      endpoint: {
        ref: { kind: 'placement', id: placement.id },
        anchor: { kind: 'point' },
        fallback: { x: placement.x, y: placement.y },
      },
    });
  }

  for (const feature of source.terrainFeatures ?? []) {
    if (!isObjectVisible(feature) || isObjectLocked(feature)) continue;
    const geometry = terrainGeometry(feature);
    if (!geometry) continue;
    const { anchor, point: attached } = anchorForGeometry(geometry, point);
    const distance = Math.hypot(point.x - attached.x, point.y - attached.y);
    if (distance > radius) continue;
    const tier = geometry.kind === 'point' ? 2 : geometry.kind === 'polyline' ? 3 : 4;
    candidates.push({
      tier,
      distance,
      label: feature.name,
      endpoint: {
        ref: { kind: 'terrain', id: feature.id },
        anchor,
        fallback: attached,
      },
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.distance - b.distance));
  const best = candidates[0];
  return { endpoint: best.endpoint, label: best.label, distance: best.distance };
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

export interface ResolvedMapRoute {
  points: MapPoint[];
  origin: MapPoint;
  destination: MapPoint;
  danglingOrigin: boolean;
  danglingDestination: boolean;
}

/** Applies a lateral lane offset to the free middle, tapering to the ends. */
function applyLaneOffset(points: MapPoint[], offset: number): MapPoint[] {
  if (!offset) return points;
  if (points.length === 2) {
    const [a, b] = points;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return points;
    return [
      a,
      {
        x: (a.x + b.x) / 2 + (-dy / length) * offset,
        y: (a.y + b.y) / 2 + (dx / length) * offset,
      },
      b,
    ];
  }
  if (points.length < 3) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const previous = points[index - 1];
    const next = points[index + 1];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return point;
    const taper = Math.min(1, index / 2, (points.length - 1 - index) / 2);
    return {
      x: point.x + (-dy / length) * offset * taper,
      y: point.y + (dx / length) * offset * taper,
    };
  });
}

/**
 * Resolves a route to the polyline the renderer, the picker and the marquee
 * all use. `beta` is the transient drag preview for one path vertex.
 */
export function resolveMapRoutePoints(
  route: MapRoute,
  source: MapRouteSource,
  transient?: { index: number; point: MapPoint } | null
): ResolvedMapRoute {
  const originResult = resolveRouteEndpointPoint(route.origin, source);
  const destinationResult = resolveRouteEndpointPoint(route.destination, source);

  const path = (route.path ?? []).map((point, index) =>
    transient && transient.index === index ? { ...transient.point } : point
  );

  const points = [originResult.point, ...path, destinationResult.point];
  const offsetPoints = route.offset ? applyLaneOffset(points, route.offset) : points;

  return {
    points: offsetPoints,
    origin: offsetPoints[0],
    destination: offsetPoints[offsetPoints.length - 1],
    danglingOrigin: originResult.dangling,
    danglingDestination: destinationResult.dangling,
  };
}

export function isMapRouteDrawn(route: MapRoute): boolean {
  return Boolean(route.origin?.fallback && route.destination?.fallback);
}

// ---------------------------------------------------------------------------
// Freehand simplification
// ---------------------------------------------------------------------------

function squareDistance(point: MapPoint, a: MapPoint, b: MapPoint): number {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point.x - x;
  dy = point.y - y;
  return dx * dx + dy * dy;
}

function simplifySection(
  points: MapPoint[],
  first: number,
  last: number,
  toleranceSq: number,
  output: MapPoint[]
): void {
  let maxDistance = toleranceSq;
  let index = 0;
  for (let i = first + 1; i < last; i++) {
    const distance = squareDistance(points[i], points[first], points[last]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }
  if (index === 0) return;
  if (index - first > 1) simplifySection(points, first, index, toleranceSq, output);
  output.push(points[index]);
  if (last - index > 1) simplifySection(points, index, last, toleranceSq, output);
}

/**
 * Ramer–Douglas–Peucker. A freehand drag can produce hundreds of samples;
 * this keeps the shape while keeping the saved JSON small.
 */
export function simplifyRoutePath(points: MapPoint[], tolerance = 2): MapPoint[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }));
  const toleranceSq = tolerance * tolerance;
  const output: MapPoint[] = [{ ...points[0] }];
  simplifySection(points, 0, points.length - 1, toleranceSq, output);
  output.push({ ...points[points.length - 1] });
  return output;
}

// ---------------------------------------------------------------------------
// Detach / lifecycle
// ---------------------------------------------------------------------------

/** Detaches every route end that pointed at a now-deleted object. */
export function detachRoutesFromRef(
  routes: MapRoute[],
  ref: MapRouteEndpointRef,
  source?: MapRouteSource
): MapRoute[] {
  let changed = false;
  const next = routes.map((route) => {
    const detach = (endpoint: MapRouteEndpoint): MapRouteEndpoint => {
      if (endpoint.ref?.kind !== ref.kind || endpoint.ref.id !== ref.id) return endpoint;
      changed = true;
      const fallback = source
        ? resolveRouteEndpointPoint(endpoint, source).point
        : endpoint.fallback;
      return { ...endpoint, ref: undefined, anchor: undefined, fallback };
    };
    const origin = detach(route.origin);
    const destination = detach(route.destination);
    return origin === route.origin && destination === route.destination
      ? route
      : { ...route, origin, destination };
  });
  return changed ? next : routes;
}

/**
 * Default endpoints for a route created from two snapped elements. Kept here
 * so a future AI/road generator produces the same shape as the canvas tool.
 */
export function createMapRoute(input: {
  id: string;
  name?: string;
  kind?: MapRouteKind;
  difficulty?: MapRouteDifficulty;
  origin: MapRouteEndpoint;
  destination: MapRouteEndpoint;
  path?: MapPoint[];
  isPersian?: boolean;
  source?: MapRouteSource;
}): MapRoute {
  const kind = input.kind ?? 'road';
  const meta = MAP_ROUTE_KIND_META[kind];
  const source = input.source ?? {};
  const originLabel =
    input.origin.label ?? endpointLabelForRef(input.origin.ref, source, input.isPersian ? 'مبدأ' : 'Origin');
  const destinationLabel =
    input.destination.label ??
    endpointLabelForRef(input.destination.ref, source, input.isPersian ? 'مقصد' : 'Destination');

  return {
    id: input.id,
    name:
      input.name ??
      defaultMapRouteName(originLabel, destinationLabel, kind, input.isPersian === true),
    kind,
    difficulty: input.difficulty ?? meta.defaultDifficulty,
    origin: input.origin,
    destination: input.destination,
    path: input.path ?? [],
    travelMultiplier: meta.travelMultiplier,
  };
}

/** Midpoint along the route, used to centre the camera or place a label. */
export function routeMidpoint(points: MapPoint[]): MapPoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { ...points[0] };

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (total === 0) return { ...points[0] };

  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    remaining -= length;
  }
  return { ...points[points.length - 1] };
}

/** Approximate length in world units. Useful for future travel integration. */
export function routeLength(points: MapPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}
