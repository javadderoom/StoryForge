/**
 * waterFeatures.ts
 *
 * Single source of truth for inland water.
 *
 * Landmasses describe land only. Every enclosed body of water is a `lake`
 * feature, and a lake may carry holes when it contains an island. Keeping the
 * same water in a landmass `holes` array *and* in a companion lake made the
 * map draw the patch twice: once as the lake (selectable) and once as "the
 * absence of land" inside the continent (not selectable).
 *
 * This module owns:
 *  - matching an old land hole to an existing lake so custom IDs/names survive,
 *  - creating a lake for a hole that has no semantic feature yet,
 *  - reconstructing lake water geometry for boolean sculpt operations, and
 *  - migrating legacy maps that still store water as land holes.
 */

import polygonClipping, {
  type MultiPolygon as GeoMultiPolygon,
  type Polygon as GeoPolygon,
} from 'polygon-clipping';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import {
  doAABBIntersect,
  getBoundingBox,
  getPolygonCentroid,
  getSqDist,
  isPointInPolygon,
} from './geometry';
import { featureToGeoPolygon } from './geojson';

export function isLandmassFeature(feature: MapTerrainFeature): boolean {
  return feature.type === 'continent' || feature.type === 'island';
}

/** True when a point is inside the feature's filled area, respecting its holes. */
export function featureContainsPoint(
  feature: MapTerrainFeature,
  point: MapPoint
): boolean {
  if (!feature.polygon || feature.polygon.length < 3) return false;
  if (!isPointInPolygon(point, feature.polygon)) return false;
  return !(feature.holes ?? []).some(
    (hole) => hole.length >= 3 && isPointInPolygon(point, hole)
  );
}

/**
 * Scores how likely a lake is the semantic owner of an old land hole.
 *
 * The sculpt engine creates the companion lake from the same ring, so legacy
 * duplicates overlap almost perfectly. The fallback centroid checks also let a
 * lake survive small simplification changes without spawning a second lake.
 */
export function scoreHoleAgainstLake(hole: MapPoint[], lake: MapTerrainFeature): number {
  if (!lake.polygon || lake.polygon.length < 3) return 0;

  const holeCentroid = getPolygonCentroid(hole);
  const lakeCentroid = getPolygonCentroid(lake.polygon);
  const holeBbox = getBoundingBox(hole);
  const lakeBbox = getBoundingBox(lake.polygon);
  const distSq = getSqDist(holeCentroid, lakeCentroid);

  if (doAABBIntersect(holeBbox, lakeBbox)) {
    const ixMin = Math.max(holeBbox.minX, lakeBbox.minX);
    const ixMax = Math.min(holeBbox.maxX, lakeBbox.maxX);
    const iyMin = Math.max(holeBbox.minY, lakeBbox.minY);
    const iyMax = Math.min(holeBbox.maxY, lakeBbox.maxY);
    const overlapArea = Math.max(0, ixMax - ixMin) * Math.max(0, iyMax - iyMin);
    if (overlapArea > 0) {
      return overlapArea / (1 + Math.sqrt(distSq));
    }
  }

  if (
    isPointInPolygon(holeCentroid, lake.polygon) ||
    isPointInPolygon(lakeCentroid, hole)
  ) {
    return 1 / (1 + Math.sqrt(distSq));
  }

  return 0;
}

/** Finds the best unmatched lake for a hole, preserving its identity. */
export function findBestLakeMatch(
  hole: MapPoint[],
  lakes: MapTerrainFeature[],
  excludedIds: ReadonlySet<string> = new Set()
): MapTerrainFeature | null {
  let best: MapTerrainFeature | null = null;
  let bestScore = 0;

  for (const lake of lakes) {
    if (excludedIds.has(lake.id)) continue;
    const score = scoreHoleAgainstLake(hole, lake);
    if (score > bestScore) {
      bestScore = score;
      best = lake;
    }
  }

  return best;
}

/** Creates a unique feature id from a readable base. */
export function createUniqueFeatureId(base: string, usedIds: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

/** Creates the semantic lake that owns a carved inland water body. */
export function createInlandLake(
  hole: MapPoint[],
  id: string,
  source?: MapTerrainFeature
): MapTerrainFeature {
  return {
    id,
    name: 'Inland Caldera Lake',
    type: 'lake',
    polygon: hole,
    color: '#4f728c',
    description: 'An inland water body carved into the landmass',
    climateZone: source?.climateZone ?? 'temperate',
  };
}

/**
 * Land features fully enclosed by a lake. These are islands inside the water,
 * so the lake must own matching holes or its fill would cover them.
 */
export function findNestedLandFeatures(
  lake: MapTerrainFeature,
  landFeatures: MapTerrainFeature[]
): MapTerrainFeature[] {
  if (!lake.polygon || lake.polygon.length < 3) return [];

  return landFeatures.filter((land) => {
    if (!isLandmassFeature(land) || !land.polygon || land.polygon.length < 3) {
      return false;
    }
    if (land.id === lake.id || land.polygon.length < 3) return false;
    return land.polygon.every((point) => isPointInPolygon(point, lake.polygon!));
  });
}

/**
 * Water geometry for a lake, with nested islands removed.
 *
 * Sculpting needs this to answer "where is land?" without ever writing the
 * same water into a continent's `holes` array again.
 */
export function lakeWaterGeometry(
  lake: MapTerrainFeature,
  landFeatures: MapTerrainFeature[]
): GeoMultiPolygon {
  const lakeGeo = featureToGeoPolygon(lake);
  if (!lakeGeo) return [];

  const nestedLand: GeoPolygon[] = [];
  for (const land of findNestedLandFeatures(lake, landFeatures)) {
    const geo = featureToGeoPolygon(land);
    if (geo) nestedLand.push(geo);
  }

  if (nestedLand.length === 0) return [lakeGeo];

  try {
    return polygonClipping.difference([lakeGeo], ...nestedLand) as GeoMultiPolygon;
  } catch {
    return [lakeGeo];
  }
}

/** All lake water as one MultiPolygon, ready for a boolean difference. */
export function buildLakeWaterMultiPolygon(
  lakes: MapTerrainFeature[],
  landFeatures: MapTerrainFeature[]
): GeoMultiPolygon {
  const water: GeoMultiPolygon = [];
  for (const lake of lakes) {
    water.push(...lakeWaterGeometry(lake, landFeatures));
  }
  return water;
}

/**
 * Whether a point falls in lake water rather than on an island inside it.
 * Used while matching boolean-result pieces back to their parent landmass.
 */
export function isPointInLakeWater(
  point: MapPoint,
  lakes: MapTerrainFeature[],
  landFeatures: MapTerrainFeature[]
): boolean {
  for (const lake of lakes) {
    if (!lake.polygon || lake.polygon.length < 3) continue;
    if (!isPointInPolygon(point, lake.polygon)) continue;
    if ((lake.holes ?? []).some((hole) => hole.length >= 3 && isPointInPolygon(point, hole))) {
      continue;
    }
    if (
      findNestedLandFeatures(lake, landFeatures).some(
        (land) => land.polygon && isPointInPolygon(point, land.polygon)
      )
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Migrates legacy terrain where a landmass still owns water holes.
 *
 * For every hole we reuse a matching lake (keeping its ID, name and styling)
 * or create one. The landmass is then left with its outer coast only. The
 * result is idempotent: a map that already follows the invariant is returned
 * unchanged.
 */
export function normalizeLandWaterFeatures(
  features: MapTerrainFeature[]
): MapTerrainFeature[] {
  const landFeatures = features.filter(isLandmassFeature);
  const landWithHoles = landFeatures.filter(
    (feature) => feature.holes && feature.holes.length > 0
  );
  if (landWithHoles.length === 0) return features;

  const existingLakes = features.filter((feature) => feature.type === 'lake');
  const usedIds = new Set(features.map((feature) => feature.id));
  const matchedLakeIds = new Set<string>();
  const lakeGeometry = new Map<string, { polygon: MapPoint[]; holes?: MapPoint[][] }>();
  const createdLakes: MapTerrainFeature[] = [];

  for (const land of landWithHoles) {
    const holes = land.holes ?? [];
    for (let index = 0; index < holes.length; index++) {
      const hole = holes[index];
      if (!hole || hole.length < 3) continue;

      const match = findBestLakeMatch(hole, existingLakes, matchedLakeIds);
      if (match) {
        matchedLakeIds.add(match.id);
        lakeGeometry.set(match.id, { polygon: hole, holes: match.holes });
        continue;
      }

      const id = createUniqueFeatureId(
        `terr_lake_${land.id}_${index + 1}`,
        usedIds
      );
      const lake = createInlandLake(hole, id, land);
      matchedLakeIds.add(id);
      lakeGeometry.set(id, { polygon: hole });
      createdLakes.push(lake);
    }
  }

  // If an island already exists inside a migrated lake, make it a lake hole so
  // the water fill cannot paint over the island. New lakes get the same help.
  const allLakes: MapTerrainFeature[] = [
    ...existingLakes.map((lake) => {
      const geometry = lakeGeometry.get(lake.id);
      return geometry ? { ...lake, ...geometry } : lake;
    }),
    ...createdLakes.map((lake) => {
      const geometry = lakeGeometry.get(lake.id);
      return geometry ? { ...lake, ...geometry } : lake;
    }),
  ];

  for (const lake of allLakes) {
    const inferredHoles = findNestedLandFeatures(lake, landFeatures)
      .map((land) => land.polygon)
      .filter((polygon): polygon is MapPoint[] => !!polygon && polygon.length >= 3);

    const current = lakeGeometry.get(lake.id);
    if (!current) continue;
    if (inferredHoles.length > 0) {
      current.holes = inferredHoles;
    }
  }

  const createdWithGeometry = createdLakes.map((lake) => {
    const geometry = lakeGeometry.get(lake.id);
    return geometry ? { ...lake, ...geometry } : lake;
  });

  return [
    ...features.map((feature) => {
      if (isLandmassFeature(feature) && feature.holes && feature.holes.length > 0) {
        return { ...feature, holes: undefined };
      }

      if (feature.type === 'lake') {
        const geometry = lakeGeometry.get(feature.id);
        if (geometry) {
          return { ...feature, ...geometry };
        }
      }

      return feature;
    }),
    ...createdWithGeometry,
  ];
}
