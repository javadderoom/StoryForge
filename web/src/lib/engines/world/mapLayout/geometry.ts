import type { MapPoint, WorldMapData } from '@/lib/types/world';
import { LEGACY_AUTO_ANCHORS } from '@/lib/engines/world/cartographerEngine';

export const GOLDEN_ANGLE = 2.399963229728653;

export const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Geometry helpers.
// ---------------------------------------------------------------------------

export function distance(a: MapPoint, b: MapPoint): number {
  const dx = finite(b.x) - finite(a.x);
  const dy = finite(b.y) - finite(a.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Ray-cast point-in-polygon; degenerate or NaN-containing polygons are "outside". */
export function pointInPolygon(p: MapPoint, polygon: MapPoint[] | undefined): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = finite(polygon[i].x);
    const yi = finite(polygon[i].y);
    const xj = finite(polygon[j].x);
    const yj = finite(polygon[j].y);
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Land/water mask built from `mapData.terrainFeatures`. */
export interface MapMasks {
  landPolygons: MapPoint[][];
  waterPolygons: MapPoint[][];
  hasAnyMask: boolean;
}

export function buildMapMasks(mapData: WorldMapData | null | undefined): MapMasks {
  const terrain = mapData?.terrainFeatures ?? [];
  const landPolygons: MapPoint[][] = [];
  const waterPolygons: MapPoint[][] = [];
  for (const f of terrain) {
    const isWater = f.type === 'ocean' || f.type === 'sea' || f.type === 'lake';
    const isLand = f.type === 'continent' || f.type === 'island';
    if (isWater && f.polygon && f.polygon.length >= 3) waterPolygons.push(f.polygon);
    else if (isLand && f.polygon && f.polygon.length >= 3) landPolygons.push(f.polygon);
    // Water cut-outs carved as holes in landmass polygons count as water.
    if (isLand && f.holes) {
      for (const hole of f.holes) {
        if (hole && hole.length >= 3) waterPolygons.push(hole);
      }
    }
  }
  return {
    landPolygons,
    waterPolygons,
    hasAnyMask: landPolygons.length > 0 || waterPolygons.length > 0,
  };
}

/**
 * True when a pin may not rest here: inside a water polygon (including inland
 * water holes in landmasses), or outside every defined landmass when the world
 * paints continents. Worlds with no map geometry are entirely placeable.
 */
export function isWaterPoint(masks: MapMasks, p: MapPoint): boolean {
  if (!masks.hasAnyMask) return false;
  if (masks.waterPolygons.some((poly) => pointInPolygon(p, poly))) return true;
  if (masks.landPolygons.length > 0) {
    return !masks.landPolygons.some((poly) => pointInPolygon(p, poly));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Legacy remnant signature (mirrors `ensureLocationCoordinates` allocation:
// dx = k*70 - 35 and dy = k*50 - 25 for the same integer k ≥ 0 from a base
// anchor). Stored `coordinatesSource: 'legacy_auto'` stamps take precedence.
// ---------------------------------------------------------------------------

export function matchesLegacyAnchorSignature(
  p: MapPoint,
  anchors: ReadonlyArray<MapPoint> = LEGACY_AUTO_ANCHORS
): boolean {
  for (const anchor of anchors) {
    const dx = Math.round(finite(p.x)) - Math.round(anchor.x);
    const dy = Math.round(finite(p.y)) - Math.round(anchor.y);
    const kx = dx + 35;
    const ky = dy + 25;
    if (kx % 70 !== 0 || ky % 50 !== 0) continue;
    const kRx = kx / 70;
    const kRy = ky / 50;
    if (kRx >= 0 && kRx === kRy) return true;
  }
  return false;
}
