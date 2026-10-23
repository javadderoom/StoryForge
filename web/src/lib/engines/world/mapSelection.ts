/**
 * mapSelection.ts
 *
 * Plan 23 — multi-object selection and the map clipboard.
 *
 * Selection is modelled as *references* (`kind` + `id`), never as copies of
 * the objects. The canvas, the engine and the page all compare the same key,
 * so a selection survives an edit, and a deleted/undone object simply drops
 * out of the resolved list instead of leaving a stale snapshot on screen.
 *
 * What lives here is deliberately pure — no React, no Pixi, no DOM:
 *
 *  - ref bookkeeping (merge / toggle / key)
 *  - marquee picking: which objects does a screen-space rubber band touch?
 *  - Ctrl+A: which objects can be selected at all right now?
 *  - the clipboard: snapshot the selection, and paste it back as new objects
 *    with fresh ids, an offset and references remapped inside the batch.
 *
 * The marquee selects on *intersection*, the way a design tool does: brushing
 * a coastline picks the landmass, and a band inside a bay does not pick the
 * continent whose bounding box happens to contain it.
 */

import type {
  CustomPlaceCategory,
  MapEntityPlacement,
  MapPoint,
  MapTerrainFeature,
  WorldLocation,
  WorldMapSettings,
  WorldTradeRoute,
} from '@/lib/types/world';
import type { MapBounds } from './mapHitTest';
import { isObjectLocked, isObjectVisible, isPlacementVisibleInLayers, isTerrainVisibleInLayers } from './mapObjectOrder';
import { isPointPlaceCategory } from './placeCategories';

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

/** The four things a map selection can contain. Matches `SelectedMapItem`. */
export type MapObjectKind = 'terrain' | 'placement' | 'location' | 'trade_route';

export interface MapObjectRef {
  kind: MapObjectKind;
  id: string;
}

export function mapObjectKey(kind: MapObjectKind, id: string): string {
  return `${kind}:${id}`;
}

export function mapObjectRefKey(ref: MapObjectRef): string {
  return mapObjectKey(ref.kind, ref.id);
}

export function sameMapObjectRef(a: MapObjectRef, b: MapObjectRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Union of two selections, preserving order and dropping duplicates. */
export function mergeMapObjectRefs(a: MapObjectRef[], b: MapObjectRef[]): MapObjectRef[] {
  const seen = new Set(a.map(mapObjectRefKey));
  const result = [...a];
  for (const ref of b) {
    const key = mapObjectRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

/** Adds a ref if absent, removes it if present (Shift/Ctrl-click). */
export function toggleMapObjectRef(refs: MapObjectRef[], ref: MapObjectRef): MapObjectRef[] {
  const key = mapObjectRefKey(ref);
  return refs.some((r) => mapObjectRefKey(r) === key)
    ? refs.filter((r) => mapObjectRefKey(r) !== key)
    : [...refs, ref];
}

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------

export interface MapSelectionSource {
  locations?: WorldLocation[];
  tradeRoutes?: WorldTradeRoute[];
  terrainFeatures?: MapTerrainFeature[];
  placements?: MapEntityPlacement[];
  /** Plan 24: non-point places are selected through their linked terrain. */
  placeCategories?: CustomPlaceCategory[];
}

/** Screen-world radius used to pick a settlement by its pin. */
export const LOCATION_SELECT_RADIUS = 18;
/** Screen-world radius used to pick a lore pin. */
export const PLACEMENT_SELECT_RADIUS = 13;
/** Extra tolerance around a route stroke. */
export const ROUTE_SELECT_PAD = 8;

/**
 * Whether the renderer will actually draw this route.
 *
 * A route is drawn only when both endpoint locations exist and carry
 * coordinates; a copied/legacy route with a dangling endpoint is invisible,
 * so it must not be selectable either.
 */
export function isTradeRouteDrawn(route: WorldTradeRoute, locations: WorldLocation[]): boolean {
  const hasOrigin = locations.some(
    (l) => l.id === route.originLocationId && Boolean(l.coordinates)
  );
  const hasDestination = locations.some(
    (l) => l.id === route.destinationLocationId && Boolean(l.coordinates)
  );
  return hasOrigin && hasDestination;
}

/** The route's full stroke: origin → waypoints → destination. */
export function resolveTradeRoutePoints(
  route: WorldTradeRoute,
  locations: WorldLocation[]
): MapPoint[] {
  const origin = locations.find((l) => l.id === route.originLocationId)?.coordinates;
  const destination = locations.find((l) => l.id === route.destinationLocationId)?.coordinates;
  const points: MapPoint[] = [];
  if (origin) points.push(origin);
  points.push(...(route.waypoints ?? []));
  if (destination) points.push(destination);
  return points;
}

// ---------------------------------------------------------------------------
// Geometry — rectangle intersection tests
// ---------------------------------------------------------------------------

/** Tolerance for the orientation tests; coordinates are whole pixels. */
const EPSILON = 1e-9;

export function pointInBounds(point: MapPoint, bounds: MapBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

export function expandBounds(bounds: MapBounds, pad: number): MapBounds {
  return {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  };
}

function orientation(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(a: MapPoint, b: MapPoint, p: MapPoint): boolean {
  if (Math.abs(orientation(a, b, p)) > EPSILON) return false;
  return (
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.y >= Math.min(a.y, b.y) - EPSILON &&
    p.y <= Math.max(a.y, b.y) + EPSILON
  );
}

export function segmentsIntersect(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean {
  const d1 = orientation(c, d, a);
  const d2 = orientation(c, d, b);
  const d3 = orientation(a, b, c);
  const d4 = orientation(a, b, d);

  const straddles = (x: number, y: number) => (x > EPSILON && y < -EPSILON) || (x < -EPSILON && y > EPSILON);
  if (straddles(d1, d2) && straddles(d3, d4)) return true;

  if (Math.abs(d1) <= EPSILON && pointOnSegment(c, d, a)) return true;
  if (Math.abs(d2) <= EPSILON && pointOnSegment(c, d, b)) return true;
  if (Math.abs(d3) <= EPSILON && pointOnSegment(a, b, c)) return true;
  if (Math.abs(d4) <= EPSILON && pointOnSegment(a, b, d)) return true;

  return false;
}

/** True when a segment touches the rectangle (endpoints inside or crossing). */
export function segmentIntersectsBounds(a: MapPoint, b: MapPoint, bounds: MapBounds): boolean {
  if (pointInBounds(a, bounds) || pointInBounds(b, bounds)) return true;

  const corners: MapPoint[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
}

/** True when an open polyline touches the rectangle. */
export function polylineIntersectsBounds(points: MapPoint[], bounds: MapBounds): boolean {
  if (points.length === 0) return false;
  if (points.length === 1) return pointInBounds(points[0], bounds);
  for (let i = 1; i < points.length; i++) {
    if (segmentIntersectsBounds(points[i - 1], points[i], bounds)) return true;
  }
  return false;
}

/**
 * True when a closed ring touches the rectangle.
 *
 * Three cases matter and all are covered: a vertex inside the rect, an edge
 * crossing the rect, and the rect living entirely inside the ring (a small
 * marquee inside a continent still selects it — check the rect corners
 * against the ring). A marquee inside a lake hole correctly selects nothing,
 * because neither the hole's edges nor the outer coastline are touched.
 */
export function ringIntersectsBounds(ring: MapPoint[], bounds: MapBounds): boolean {
  if (ring.length === 0) return false;
  if (ring.some((point) => pointInBounds(point, bounds))) return true;

  const corners: MapPoint[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  if (corners.some((corner) => pointInRing(corner, ring))) return true;

  for (let i = 1; i < ring.length; i++) {
    if (segmentIntersectsBounds(ring[i - 1], ring[i], bounds)) return true;
  }
  if (ring.length > 2 && segmentIntersectsBounds(ring[ring.length - 1], ring[0], bounds)) return true;

  return false;
}

/** Ray-casting point-in-ring, local copy so this module stays self-contained. */
function pointInRing(point: MapPoint, ring: MapPoint[]): boolean {
  if (ring.length < 3) return false;
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

/** True when the rectangle lies entirely inside a closed ring. */
export function ringContainsBounds(ring: MapPoint[], bounds: MapBounds): boolean {
  if (ring.length < 3) return false;
  const corners: MapPoint[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  return corners.every((corner) => pointInRing(corner, ring));
}

/** True when a circle touches the rectangle. */
export function circleIntersectsBounds(
  x: number,
  y: number,
  radius: number,
  bounds: MapBounds
): boolean {
  const nearestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const nearestY = Math.max(bounds.minY, Math.min(y, bounds.maxY));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

// ---------------------------------------------------------------------------
// Selectability
// ---------------------------------------------------------------------------

function terrainHasGeometry(feature: MapTerrainFeature): boolean {
  return Boolean(
    (feature.polygon && feature.polygon.length >= 3) ||
      (feature.points && feature.points.length > 0) ||
      (typeof feature.x === 'number' && typeof feature.y === 'number')
  );
}

/**
 * Objects the author can select right now: drawn, not hidden, not locked.
 * The layer switches are honoured exactly as the renderer honours them, so
 * Ctrl+A can never select something that is not on the screen.
 */
export function collectSelectableRefs(
  source: MapSelectionSource,
  settings?: WorldMapSettings
): MapObjectRef[] {
  const refs: MapObjectRef[] = [];
  const locations = source.locations ?? [];
  const layers = settings?.visibleLayers;

  if (!layers || layers.settlements) {
    for (const location of locations) {
      if (!location.coordinates || location.coordinates.x <= 0) continue;
      if (!isPointPlaceCategory(location.category, source.placeCategories)) continue;
      refs.push({ kind: 'location', id: location.id });
    }
  }

  if (!layers || layers.caravanRoutes) {
    for (const route of source.tradeRoutes ?? []) {
      if (!isTradeRouteDrawn(route, locations)) continue;
      refs.push({ kind: 'trade_route', id: route.id });
    }
  }

  for (const feature of source.terrainFeatures ?? []) {
    if (!isObjectVisible(feature) || isObjectLocked(feature)) continue;
    if (layers && !isTerrainVisibleInLayers(feature.type, layers)) continue;
    if (!terrainHasGeometry(feature)) continue;
    refs.push({ kind: 'terrain', id: feature.id });
  }

  for (const placement of source.placements ?? []) {
    if (!isObjectVisible(placement) || isObjectLocked(placement)) continue;
    if (layers && !isPlacementVisibleInLayers(placement.entityType, layers)) continue;
    refs.push({ kind: 'placement', id: placement.id });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Marquee picking
// ---------------------------------------------------------------------------

function terrainIntersectsBounds(feature: MapTerrainFeature, bounds: MapBounds): boolean {
  if (feature.polygon && feature.polygon.length >= 3) {
    // A band drawn entirely inside a lake hole is over water, not over the
    // landmass that surrounds it — the hole wins over the outer ring.
    const holes = feature.holes ?? [];
    if (holes.some((hole) => hole.length >= 3 && ringContainsBounds(hole, bounds))) {
      return false;
    }
    return ringIntersectsBounds(feature.polygon, bounds);
  }
  if (feature.points && feature.points.length > 0) {
    const pad = Math.max(2, (feature.width ?? 0) / 2);
    return polylineIntersectsBounds(feature.points, expandBounds(bounds, pad));
  }
  if (typeof feature.x === 'number' && typeof feature.y === 'number') {
    return circleIntersectsBounds(feature.x, feature.y, (feature.radius ?? 24) + 4, bounds);
  }
  return false;
}

/**
 * Everything the rubber band touches, subject to the same visibility rules as
 * {@link collectSelectableRefs}.
 */
export function marqueeSelectRefs(
  source: MapSelectionSource,
  bounds: MapBounds,
  settings?: WorldMapSettings
): MapObjectRef[] {
  const selectable = collectSelectableRefs(source, settings);
  if (selectable.length === 0) return [];

  const wanted = new Set(selectable.map(mapObjectRefKey));
  const refs: MapObjectRef[] = [];
  const locations = source.locations ?? [];

  for (const location of locations) {
    if (!wanted.has(mapObjectKey('location', location.id))) continue;
    const coords = location.coordinates!;
    if (circleIntersectsBounds(coords.x, coords.y, LOCATION_SELECT_RADIUS, bounds)) {
      refs.push({ kind: 'location', id: location.id });
    }
  }

  for (const route of source.tradeRoutes ?? []) {
    if (!wanted.has(mapObjectKey('trade_route', route.id))) continue;
    const points = resolveTradeRoutePoints(route, locations);
    if (polylineIntersectsBounds(points, expandBounds(bounds, ROUTE_SELECT_PAD))) {
      refs.push({ kind: 'trade_route', id: route.id });
    }
  }

  for (const feature of source.terrainFeatures ?? []) {
    if (!wanted.has(mapObjectKey('terrain', feature.id))) continue;
    if (terrainIntersectsBounds(feature, bounds)) {
      refs.push({ kind: 'terrain', id: feature.id });
    }
  }

  for (const placement of source.placements ?? []) {
    if (!wanted.has(mapObjectKey('placement', placement.id))) continue;
    if (circleIntersectsBounds(placement.x, placement.y, PLACEMENT_SELECT_RADIUS, bounds)) {
      refs.push({ kind: 'placement', id: placement.id });
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Translation — moving a selection as one object
// ---------------------------------------------------------------------------

/** Translates one terrain feature's geometry; the id and metadata stay put. */
export function translateTerrainFeature(
  feature: MapTerrainFeature,
  dx: number,
  dy: number
): MapTerrainFeature {
  if (dx === 0 && dy === 0) return feature;
  return {
    ...feature,
    x: typeof feature.x === 'number' ? feature.x + dx : feature.x,
    y: typeof feature.y === 'number' ? feature.y + dy : feature.y,
    points: feature.points ? offsetRing(feature.points, dx, dy) : undefined,
    polygon: feature.polygon ? offsetRing(feature.polygon, dx, dy) : undefined,
    holes: feature.holes?.map((hole) => offsetRing(hole, dx, dy)),
  };
}

export function translatePlacement(
  placement: MapEntityPlacement,
  dx: number,
  dy: number
): MapEntityPlacement {
  if (dx === 0 && dy === 0) return placement;
  return { ...placement, x: placement.x + dx, y: placement.y + dy };
}

export function translateLocation(
  location: WorldLocation,
  dx: number,
  dy: number
): WorldLocation {
  if (dx === 0 && dy === 0) return location;
  return {
    ...location,
    coordinates: location.coordinates
      ? offsetPoint(location.coordinates, dx, dy)
      : location.coordinates,
    // Plan 19: a hand-dragged pin is the author's authority forever. The
    // auto-fit solver treats manual pins as hard anchors.
    coordinatesSource: location.coordinates ? 'manual' : location.coordinatesSource,
  };
}

/**
 * Translates a route's free geometry.
 *
 * The endpoints are location ids, not points: they move when their settlement
 * moves. Only the waypoints are owned by the route itself, so a route dragged
 * on its own bends through its waypoints while staying anchored to its towns.
 */
export function translateTradeRoute(
  route: WorldTradeRoute,
  dx: number,
  dy: number
): WorldTradeRoute {
  if (dx === 0 && dy === 0) return route;
  return {
    ...route,
    waypoints: route.waypoints?.map((point) => offsetPoint(point, dx, dy)),
  };
}

export interface MapTranslationResult {
  terrainFeatures: MapTerrainFeature[];
  placements: MapEntityPlacement[];
  locations: WorldLocation[];
  tradeRoutes: WorldTradeRoute[];
}

/**
 * Returns full lists with only the referenced objects translated.
 *
 * Unselected objects keep their identity (same reference), which keeps React
 * and Pixi comparisons cheap and makes the result easy to assert in tests.
 */
export function translateMapObjects(
  source: MapSelectionSource,
  refs: MapObjectRef[],
  dx: number,
  dy: number
): MapTranslationResult {
  const terrainIds = new Set(refs.filter((r) => r.kind === 'terrain').map((r) => r.id));
  const placementIds = new Set(
    refs.filter((r) => r.kind === 'placement').map((r) => r.id)
  );
  const locationIds = new Set(refs.filter((r) => r.kind === 'location').map((r) => r.id));
  const routeIds = new Set(refs.filter((r) => r.kind === 'trade_route').map((r) => r.id));

  return {
    terrainFeatures: (source.terrainFeatures ?? []).map((feature) =>
      terrainIds.has(feature.id) ? translateTerrainFeature(feature, dx, dy) : feature
    ),
    placements: (source.placements ?? []).map((placement) =>
      placementIds.has(placement.id) ? translatePlacement(placement, dx, dy) : placement
    ),
    locations: (source.locations ?? []).map((location) =>
      locationIds.has(location.id) ? translateLocation(location, dx, dy) : location
    ),
    tradeRoutes: (source.tradeRoutes ?? []).map((route) =>
      routeIds.has(route.id) ? translateTradeRoute(route, dx, dy) : route
    ),
  };
}

// ---------------------------------------------------------------------------
// Clipboard
// ---------------------------------------------------------------------------

export interface MapClipboard {
  locations: WorldLocation[];
  tradeRoutes: WorldTradeRoute[];
  terrainFeatures: MapTerrainFeature[];
  placements: MapEntityPlacement[];
}

export interface CloneClipboardOptions {
  offsetX: number;
  offsetY: number;
  /** Appended to names, e.g. " (copy)" / " (رونوشت)". */
  copySuffix: string;
  /** Returns a fresh, unique id for the given object kind. */
  makeId: (kind: MapObjectKind) => string;
}

export interface ClonedClipboard extends MapClipboard {
  /** The pasted objects, ready to become the new selection. */
  refs: MapObjectRef[];
}

/** Takes a detached snapshot of the selected objects. */
export function buildMapClipboard(
  source: MapSelectionSource,
  refs: MapObjectRef[]
): MapClipboard {
  const wanted = new Set(refs.map(mapObjectRefKey));
  return {
    locations: (source.locations ?? []).filter((l) => wanted.has(mapObjectKey('location', l.id))),
    tradeRoutes: (source.tradeRoutes ?? []).filter((r) =>
      wanted.has(mapObjectKey('trade_route', r.id))
    ),
    terrainFeatures: (source.terrainFeatures ?? []).filter((f) =>
      wanted.has(mapObjectKey('terrain', f.id))
    ),
    placements: (source.placements ?? []).filter((p) =>
      wanted.has(mapObjectKey('placement', p.id))
    ),
  };
}

export function clipboardSize(clipboard: MapClipboard): number {
  return (
    clipboard.locations.length +
    clipboard.tradeRoutes.length +
    clipboard.terrainFeatures.length +
    clipboard.placements.length
  );
}

function offsetPoint(point: MapPoint, dx: number, dy: number): MapPoint {
  return { x: point.x + dx, y: point.y + dy };
}

function offsetRing(ring: MapPoint[], dx: number, dy: number): MapPoint[] {
  return ring.map((point) => offsetPoint(point, dx, dy));
}

function withCopySuffix(name: string | undefined, suffix: string): string | undefined {
  if (!name) return name;
  return name.endsWith(suffix) ? name : `${name}${suffix}`;
}

/**
 * Clones a clipboard payload as new objects.
 *
 * Rules:
 *  - every object gets a fresh id and every geometric anchor moves by the
 *    paste offset (polygons, holes, polylines, x/y, waypoints, coordinates);
 *  - references *inside* the copied batch are remapped to the new ids (copy a
 *    town and the road between two copied towns, and the pasted road connects
 *    the pasted towns, not the originals);
 *  - references that leave the batch are kept only where they still make
 *    sense (a route whose far end was not copied keeps that end); a copied
 *    location's hierarchy/adjacency edges are dropped rather than silently
 *    pointing at the original's neighbours.
 */
export function cloneMapClipboard(
  clipboard: MapClipboard,
  options: CloneClipboardOptions
): ClonedClipboard {
  const { offsetX, offsetY, copySuffix, makeId } = options;

  const newIds = new Map<string, string>();
  for (const feature of clipboard.terrainFeatures) newIds.set(feature.id, makeId('terrain'));
  for (const placement of clipboard.placements) newIds.set(placement.id, makeId('placement'));
  for (const location of clipboard.locations) newIds.set(location.id, makeId('location'));
  for (const route of clipboard.tradeRoutes) newIds.set(route.id, makeId('trade_route'));
  const remapOrKeep = (id: string) => newIds.get(id) ?? id;
  const remapInBatch = (id: string | undefined) =>
    id === undefined ? undefined : newIds.get(id);

  const terrainFeatures: MapTerrainFeature[] = clipboard.terrainFeatures.map((feature) => ({
    ...feature,
    id: newIds.get(feature.id)!,
    name: withCopySuffix(feature.name, copySuffix) ?? feature.name,
    x: typeof feature.x === 'number' ? feature.x + offsetX : feature.x,
    y: typeof feature.y === 'number' ? feature.y + offsetY : feature.y,
    points: feature.points ? offsetRing(feature.points, offsetX, offsetY) : undefined,
    polygon: feature.polygon ? offsetRing(feature.polygon, offsetX, offsetY) : undefined,
    holes: feature.holes?.map((hole) => offsetRing(hole, offsetX, offsetY)),
    // Keep a place link only when that place was copied in the same batch.
    // A duplicate must never silently attach itself to the original's place.
    locationId: feature.locationId ? newIds.get(feature.locationId) : undefined,
  }));

  const placements: MapEntityPlacement[] = clipboard.placements.map((placement) => ({
    ...placement,
    id: newIds.get(placement.id)!,
    x: placement.x + offsetX,
    y: placement.y + offsetY,
    customLabel: withCopySuffix(placement.customLabel, copySuffix),
  }));

  const locations: WorldLocation[] = clipboard.locations.map((location) => ({
    ...location,
    id: newIds.get(location.id)!,
    name: withCopySuffix(location.name, copySuffix) ?? location.name,
    coordinates: location.coordinates
      ? offsetPoint(location.coordinates, offsetX, offsetY)
      : location.coordinates,
    // A duplicate is a new hand-placed pin, not a solver/legacy remnant.
    coordinatesSource: location.coordinates ? 'manual' : location.coordinatesSource,
    parentLocationId: remapInBatch(location.parentLocationId),
    connectedLocationIds: (location.connectedLocationIds ?? [])
      .map((id) => newIds.get(id))
      .filter((id): id is string => Boolean(id)),
  }));

  const tradeRoutes: WorldTradeRoute[] = clipboard.tradeRoutes.map((route) => ({
    ...route,
    id: newIds.get(route.id)!,
    name: withCopySuffix(route.name, copySuffix) ?? route.name,
    originLocationId: remapOrKeep(route.originLocationId),
    destinationLocationId: remapOrKeep(route.destinationLocationId),
    intermediateLocationIds: route.intermediateLocationIds?.map(remapOrKeep),
    waypoints: route.waypoints?.map((point) => offsetPoint(point, offsetX, offsetY)),
  }));

  return {
    locations,
    tradeRoutes,
    terrainFeatures,
    placements,
    refs: [
      ...terrainFeatures.map((feature): MapObjectRef => ({ kind: 'terrain', id: feature.id })),
      ...placements.map((placement): MapObjectRef => ({ kind: 'placement', id: placement.id })),
      ...locations.map((location): MapObjectRef => ({ kind: 'location', id: location.id })),
      ...tradeRoutes.map((route): MapObjectRef => ({ kind: 'trade_route', id: route.id })),
    ],
  };
}
