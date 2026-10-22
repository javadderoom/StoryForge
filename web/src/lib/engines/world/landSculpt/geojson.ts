import type {
  MultiPolygon as GeoMultiPolygon,
  Polygon as GeoPolygon,
  Ring as GeoRing,
  Pair as GeoPoint,
} from 'polygon-clipping';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';

// ============================================================================
// 5. GEOJSON COORDINATE MAPPING UTILITIES
// ============================================================================

/**
 * Converts domain MapPoint[] to GeoJSON GeoRing, ensuring explicit closure.
 */
export function mapPointsToGeoRing(points: MapPoint[]): GeoRing {
  if (points.length === 0) return [];
  const ring: GeoPoint[] = points.map((p) => [
    Math.round(p.x * 10) / 10,
    Math.round(p.y * 10) / 10,
  ]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/**
 * Converts GeoJSON GeoRing to domain MapPoint[], stripping redundant closing point.
 */
export function geoRingToMapPoints(ring: GeoRing): MapPoint[] {
  if (ring.length === 0) return [];
  const isClosed =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const limit = isClosed ? ring.length - 1 : ring.length;
  const result: MapPoint[] = [];
  for (let i = 0; i < limit; i++) {
    result.push({
      x: Math.round(ring[i][0] * 10) / 10,
      y: Math.round(ring[i][1] * 10) / 10,
    });
  }
  return result;
}

/**
 * Converts MapTerrainFeature into a GeoJSON Polygon ([outerRing, ...holes]).
 */
export function featureToGeoPolygon(feature: MapTerrainFeature): GeoPolygon | null {
  if (!feature.polygon || feature.polygon.length < 3) return null;
  const outerRing = mapPointsToGeoRing(feature.polygon);
  if (outerRing.length < 4) return null;

  const rings: GeoPolygon = [outerRing];
  if (feature.holes && feature.holes.length > 0) {
    for (const hole of feature.holes) {
      if (hole.length >= 3) {
        const holeRing = mapPointsToGeoRing(hole);
        if (holeRing.length >= 4) {
          rings.push(holeRing);
        }
      }
    }
  }
  return rings;
}

/**
 * Converts multiple MapTerrainFeature landmasses to a GeoJSON MultiPolygon.
 */
export function featuresToGeoMultiPolygon(features: MapTerrainFeature[]): GeoMultiPolygon {
  const multiPoly: GeoMultiPolygon = [];
  for (const feat of features) {
    if (
      (feat.type === 'continent' || feat.type === 'island') &&
      feat.polygon &&
      feat.polygon.length >= 3
    ) {
      const poly = featureToGeoPolygon(feat);
      if (poly) multiPoly.push(poly);
    }
  }
  return multiPoly;
}
