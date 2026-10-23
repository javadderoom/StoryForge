import polygonClipping, {
  type MultiPolygon as GeoMultiPolygon,
  type Polygon as GeoPolygon,
} from 'polygon-clipping';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import { VINTAGE_PARCHMENT } from '../pixi/vintageTheme';
import {
  CONTINENT_AREA_THRESHOLD,
  DEFAULT_SIMPLIFY_EPSILON,
  MIN_FEATURE_AREA,
  MIN_HOLE_AREA,
  type SculptOptions,
} from './types';
import {
  calculatePolygonArea,
  doAABBIntersect,
  getBoundingBox,
  getPolygonCentroid,
  isPointInPolygon,
} from './geometry';
import { simplifyPolygonRing } from './simplify';
import {
  featureToGeoPolygon,
  featuresToGeoMultiPolygon,
  geoRingToMapPoints,
  mapPointsToGeoRing,
} from './geojson';
import {
  buildLakeWaterMultiPolygon,
  createInlandLake,
  createUniqueFeatureId,
  findBestLakeMatch,
  isPointInLakeWater,
} from './waterFeatures';

// ============================================================================
// 6. BOOLEAN SCULPT OPERATION (PAINT & CARVE)
// ============================================================================

/**
 * Performs boolean union (Paint Land) or difference (Carve Water) operations
 * between existing landmasses and continuous brush strokes.
 *
 * @param existingFeatures Current map terrain features array
 * @param strokePolygon Single stroke polygon or array of continuous stroke stamps
 * @param mode 'paint' (deposit land) or 'carve' (cut water/erase)
 * @param options Configuration options for tolerance and minimum areas
 * @returns Updated array of terrain features
 */
export function applySculptOperation(
  existingFeatures: MapTerrainFeature[],
  strokePolygon: MapPoint[] | MapPoint[][],
  mode: 'paint' | 'carve',
  options?: SculptOptions
): MapTerrainFeature[] {
  const tolerance = options?.simplifyTolerance ?? DEFAULT_SIMPLIFY_EPSILON;
  const minArea = options?.minArea ?? MIN_FEATURE_AREA;
  const minHoleArea = options?.minHoleArea ?? MIN_HOLE_AREA;

  // 1. Separate landmasses, existing lakes, and other non-land features
  const landFeatures = existingFeatures.filter(
    (f) =>
      (f.type === 'continent' || f.type === 'island') &&
      f.polygon &&
      f.polygon.length >= 3
  );
  const existingLakeFeatures = existingFeatures.filter((f) => f.type === 'lake');
  const otherNonLandFeatures = existingFeatures.filter(
    (f) =>
      f.type !== 'continent' &&
      f.type !== 'island' &&
      f.type !== 'lake'
  );

  // 2. Normalize stroke input to array of stroke polygons
  const rawStrokes: MapPoint[][] =
    strokePolygon.length > 0 && Array.isArray(strokePolygon[0]) && 'x' in (strokePolygon[0] as unknown as Record<string, unknown>)
      ? (strokePolygon as MapPoint[][])
      : strokePolygon.length > 0 && 'x' in (strokePolygon[0] as unknown as Record<string, unknown>)
      ? [strokePolygon as MapPoint[]]
      : (strokePolygon as MapPoint[][]);

  const validStrokes = rawStrokes.filter((pts) => pts && pts.length >= 3);
  if (validStrokes.length === 0) {
    return existingFeatures;
  }

  // Pre-simplify stroke stamps
  const simplifiedStrokes =
    tolerance > 0
      ? validStrokes.map((pts) => simplifyPolygonRing(pts, tolerance))
      : validStrokes;

  // 3. Fast Short-Circuits for Carve in empty ocean
  if (mode === 'carve') {
    if (landFeatures.length === 0) {
      // Carving on empty ocean is a safe no-op
      return existingFeatures;
    }

    const strokeAllPoints = simplifiedStrokes.flat();
    const strokeAABB = getBoundingBox(strokeAllPoints);

    let overlapsAny = false;
    for (const land of landFeatures) {
      if (land.polygon && land.polygon.length >= 3) {
        const landAABB = getBoundingBox(land.polygon);
        if (doAABBIntersect(strokeAABB, landAABB)) {
          overlapsAny = true;
          break;
        }
      }
    }

    if (!overlapsAny) {
      // Stroke does not intersect any land bounding box -> immediate no-op
      return existingFeatures;
    }
  }

  // 4. Convert strokes to GeoPolygon array
  const strokeGeoPolys: GeoPolygon[] = simplifiedStrokes
    .map((pts) => {
      const ring = mapPointsToGeoRing(pts);
      return ring.length >= 4 ? [ring] : null;
    })
    .filter((p): p is GeoPolygon => p !== null);

  if (strokeGeoPolys.length === 0) {
    return existingFeatures;
  }

  // Compute stroke MultiPolygon for clipping operations
  let strokeMultiPoly: GeoMultiPolygon;
  if (strokeGeoPolys.length === 1) {
    strokeMultiPoly = [strokeGeoPolys[0]];
  } else {
    try {
      strokeMultiPoly = polygonClipping.union(
        strokeGeoPolys[0],
        ...strokeGeoPolys.slice(1)
      ) as GeoMultiPolygon;
    } catch {
      strokeMultiPoly = [strokeGeoPolys[0]];
    }
  }

  // 5. Convert existing land features to GeoMultiPolygon.
  //
  // Landmasses no longer carry water in their `holes` arrays. Reconstruct the
  // land-minus-water geometry from the semantic lake features so painting next
  // to a lake cannot silently fill that lake with land.
  const existingLandMultiPoly = featuresToGeoMultiPolygon(landFeatures);
  const existingLakeWaterMultiPoly = buildLakeWaterMultiPolygon(
    existingLakeFeatures,
    landFeatures
  );

  let existingMultiPoly = existingLandMultiPoly;
  if (existingLandMultiPoly.length > 0 && existingLakeWaterMultiPoly.length > 0) {
    try {
      existingMultiPoly = polygonClipping.difference(
        existingLandMultiPoly,
        existingLakeWaterMultiPoly
      ) as GeoMultiPolygon;
    } catch {
      existingMultiPoly = existingLandMultiPoly;
    }
  }

  // 6. Execute Boolean Clipping
  let resultMultiPoly: GeoMultiPolygon;

  if (mode === 'paint') {
    if (existingMultiPoly.length === 0) {
      resultMultiPoly = strokeMultiPoly;
    } else {
      try {
        resultMultiPoly = polygonClipping.union(
          existingMultiPoly,
          ...strokeGeoPolys
        ) as GeoMultiPolygon;
      } catch {
        resultMultiPoly = [...existingMultiPoly, ...strokeGeoPolys];
      }
    }
  } else {
    // Mode === 'carve': difference(existing, stroke)
    try {
      resultMultiPoly = polygonClipping.difference(
        existingMultiPoly,
        strokeMultiPoly
      ) as GeoMultiPolygon;
    } catch {
      resultMultiPoly = existingMultiPoly;
    }
  }

  // 7. Sanitize, Filter Slivers, and Reconstruct Land Features & Inland Lakes
  if (resultMultiPoly.length === 0) {
    // All land eroded away -> clean open ocean; preserve standalone lakes not covered by carve
    const strokeAllPoints = simplifiedStrokes.flat();
    const strokeAABB = getBoundingBox(strokeAllPoints);
    const survivingLakes = existingLakeFeatures.filter(
      (l) => !l.polygon || !doAABBIntersect(getBoundingBox(l.polygon), strokeAABB)
    );
    return [...survivingLakes, ...otherNonLandFeatures];
  }

  // Map each output polygon back to the most overlapping parent land feature
  const landBBoxes = landFeatures.map((lf) => ({
    feature: lf,
    bbox: lf.polygon ? getBoundingBox(lf.polygon) : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    area: lf.polygon ? calculatePolygonArea(lf.polygon) : 0,
  }));

  interface ProcessedPiece {
    outerRing: MapPoint[];
    holes: MapPoint[][];
    parent: MapTerrainFeature | null;
    area: number;
  }

  const processedPieces: ProcessedPiece[] = [];
  const holeList: { hole: MapPoint[]; pieceIndex: number }[] = [];

  for (let i = 0; i < resultMultiPoly.length; i++) {
    const geoPoly = resultMultiPoly[i];
    const outerGeoRing = geoPoly[0];
    const rawOuterArea = calculatePolygonArea(outerGeoRing);

    // Discard degenerate slivers (< minArea)
    if (rawOuterArea < minArea) {
      continue;
    }

    const outerPoints = geoRingToMapPoints(outerGeoRing);
    const simplifiedOuter =
      tolerance > 0 ? simplifyPolygonRing(outerPoints, tolerance) : outerPoints;

    const area = calculatePolygonArea(simplifiedOuter);
    if (simplifiedOuter.length < 3 || area < minArea) {
      continue;
    }

    // Process interior holes (inland lakes/cutouts)
    const validHoles: MapPoint[][] = [];
    for (let h = 1; h < geoPoly.length; h++) {
      const holeRing = geoPoly[h];
      const holeArea = calculatePolygonArea(holeRing);
      if (holeArea >= minHoleArea) {
        const holePoints = geoRingToMapPoints(holeRing);
        const simplifiedHole =
          tolerance > 0 ? simplifyPolygonRing(holePoints, tolerance) : holePoints;
        if (simplifiedHole.length >= 3 && calculatePolygonArea(simplifiedHole) >= minHoleArea) {
          validHoles.push(simplifiedHole);
          holeList.push({ hole: simplifiedHole, pieceIndex: processedPieces.length });
        }
      }
    }

    // Find overlapping parent.
    //
    // A piece that sits in lake water (not on an island inside it) is a new
    // landmass, not a detached part of the surrounding continent. Conversely,
    // an island that already exists inside the lake must keep its own identity
    // rather than being stolen by the continent's much larger bounding box.
    const pieceBbox = getBoundingBox(simplifiedOuter);
    const pieceCentroid = getPolygonCentroid(simplifiedOuter);
    const pieceStartsInWater =
      simplifiedOuter.length > 0 &&
      isPointInLakeWater(simplifiedOuter[0], existingLakeFeatures, landFeatures);

    let bestParent: MapTerrainFeature | null = null;
    let bestScore = 0;

    if (!pieceStartsInWater) {
      for (const lb of landBBoxes) {
        if (!doAABBIntersect(pieceBbox, lb.bbox)) continue;

        // Legacy maps may still carry holes on the landmass. A piece inside one
        // cannot belong to that landmass.
        const insideHole =
          !!lb.feature.holes?.some(
            (hole) =>
              simplifiedOuter.length > 0 &&
              isPointInPolygon(simplifiedOuter[0], hole) &&
              (simplifiedOuter.length < 2 || isPointInPolygon(simplifiedOuter[1], hole))
          );
        if (insideHole) continue;

        const ixMin = Math.max(pieceBbox.minX, lb.bbox.minX);
        const ixMax = Math.min(pieceBbox.maxX, lb.bbox.maxX);
        const iyMin = Math.max(pieceBbox.minY, lb.bbox.minY);
        const iyMax = Math.min(pieceBbox.maxY, lb.bbox.maxY);
        const overlapArea = (ixMax - ixMin) * (iyMax - iyMin);

        // Prefer the smallest existing landmass that actually contains the
        // piece's centre. That keeps Russian-doll islands attached to their
        // own island feature instead of the surrounding continent.
        const score = lb.feature.polygon && isPointInPolygon(pieceCentroid, lb.feature.polygon)
          ? 1e15 / Math.max(lb.area, 1) + overlapArea / 1e9
          : overlapArea;

        if (score > bestScore) {
          bestScore = score;
          bestParent = lb.feature;
        }
      }
    }

    processedPieces.push({
      outerRing: simplifiedOuter,
      holes: validHoles,
      parent: bestParent,
      area,
    });
  }

  // Match holes to existing lake features by centroid/proximity, preserving IDs and metadata.
  // Lakes own the water: the surrounding landmass only gets its outer coast.
  const matchedLakeIds = new Set<string>();
  const finalLakes: MapTerrainFeature[] = [];
  const usedIds = new Set(existingFeatures.map((feature) => feature.id));

  for (const { hole, pieceIndex } of holeList) {
    // A hole that contains land pieces is a lake with islands. The lake owns
    // those island outlines as holes so its fill never paints over the land.
    const lakeHoles = processedPieces
      .map((piece, index) => ({ piece, index }))
      .filter(
        ({ piece, index }) =>
          index !== pieceIndex &&
          piece.outerRing.length >= 3 &&
          isPointInPolygon(piece.outerRing[0], hole)
      )
      .map(({ piece }) => piece.outerRing);

    const bestLakeMatch = findBestLakeMatch(
      hole,
      existingLakeFeatures,
      matchedLakeIds
    );

    if (bestLakeMatch) {
      matchedLakeIds.add(bestLakeMatch.id);
      finalLakes.push({
        ...bestLakeMatch,
        polygon: hole,
        holes: lakeHoles.length > 0 ? lakeHoles : bestLakeMatch.holes,
      });
    } else {
      const id = createUniqueFeatureId(
        `terr_lake_${Math.round(hole[0].x)}_${Math.round(hole[0].y)}`,
        usedIds
      );
      const lake = createInlandLake(hole, id);
      finalLakes.push({
        ...lake,
        holes: lakeHoles.length > 0 ? lakeHoles : undefined,
      });
    }
  }

  // Preserve standalone lakes that were not matched to holes
  const strokeAllPoints = simplifiedStrokes.flat();
  const strokeAABB = getBoundingBox(strokeAllPoints);

  for (const lake of existingLakeFeatures) {
    if (matchedLakeIds.has(lake.id)) continue;
    if (!lake.polygon || lake.polygon.length < 3) {
      finalLakes.push(lake);
      continue;
    }

    const lakeBbox = getBoundingBox(lake.polygon);

    if (mode === 'carve') {
      // Standalone lakes in carve mode are water and persist
      finalLakes.push(lake);
    } else {
      // Mode === 'paint': check if paint stroke covers or trims the lake
      if (!doAABBIntersect(strokeAABB, lakeBbox)) {
        // Not touching paint stroke: preserve completely
        finalLakes.push(lake);
      } else {
        try {
          const lakeGeo = featureToGeoPolygon(lake);
          if (lakeGeo) {
            const diff = polygonClipping.difference(
              [lakeGeo],
              strokeMultiPoly
            ) as GeoMultiPolygon;

            let keptOriginal = false;
            for (const diffPoly of diff ?? []) {
              const outerPoints = geoRingToMapPoints(diffPoly[0]);
              if (
                outerPoints.length < 3 ||
                calculatePolygonArea(outerPoints) < minHoleArea
              ) {
                continue;
              }

              const holes = diffPoly
                .slice(1)
                .map((ring) => geoRingToMapPoints(ring))
                .filter(
                  (hole) => hole.length >= 3 && calculatePolygonArea(hole) >= minHoleArea
                );

              if (!keptOriginal) {
                keptOriginal = true;
                finalLakes.push({
                  ...lake,
                  polygon: outerPoints,
                  holes: holes.length > 0 ? holes : undefined,
                });
              } else {
                const id = createUniqueFeatureId(
                  `terr_lake_${Math.round(outerPoints[0].x)}_${Math.round(outerPoints[0].y)}`,
                  usedIds
                );
                finalLakes.push({
                  ...createInlandLake(outerPoints, id, lake),
                  holes: holes.length > 0 ? holes : undefined,
                });
              }
            }
          }
        } catch {
          finalLakes.push(lake);
        }
      }
    }
  }

  // Count and map processed pieces back to parent features preserving input order
  const piecesByParentId = new Map<string, ProcessedPiece[]>();
  const unparentedPieces: ProcessedPiece[] = [];

  for (const piece of processedPieces) {
    if (piece.parent) {
      const list = piecesByParentId.get(piece.parent.id) || [];
      list.push(piece);
      piecesByParentId.set(piece.parent.id, list);
    } else {
      unparentedPieces.push(piece);
    }
  }

  const orderedLandFeatures: (MapTerrainFeature | null)[] = new Array(landFeatures.length).fill(null);
  const secondaryPieces: MapTerrainFeature[] = [];

  for (let idx = 0; idx < landFeatures.length; idx++) {
    const parent = landFeatures[idx];
    const pieces = piecesByParentId.get(parent.id);
    if (!pieces || pieces.length === 0) continue;

    // Sort pieces by area descending so primary landmass stays first
    pieces.sort((a, b) => b.area - a.area);

    const isSplit = pieces.length > 1;

    // Primary piece retains parent position and identity.
    //
    // The parent is SPREAD, not rebuilt from a field list: the sculpting only
    // changes geometry, so everything else the author set (elevation, colour,
    // description, and the Plan 21 layer controls `visible` / `locked` /
    // `zIndex`) has to survive the stroke. Rebuilding from an explicit list
    // silently dropped those fields on every brush stroke.
    const primaryPiece = pieces[0];
    const primaryType = isSplit
      ? (primaryPiece.area >= CONTINENT_AREA_THRESHOLD ? 'continent' : 'island')
      : parent.type === 'continent'
      ? 'continent'
      : 'island';
    const primaryName = isSplit ? `${parent.name} (Major)` : parent.name;

    orderedLandFeatures[idx] = {
      ...parent,
      name: primaryName,
      type: primaryType,
      color: parent.color || VINTAGE_PARCHMENT.landFillHex,
      polygon: primaryPiece.outerRing,
      // Inland water is owned by lake features, never duplicated here.
      holes: undefined,
      climateZone: parent.climateZone || 'temperate',
    };

    // Secondary pieces from splits become independent islands
    for (let s = 1; s < pieces.length; s++) {
      const secPiece = pieces[s];
      secondaryPieces.push({
        ...parent,
        id: `${parent.id}_isle_${s + 1}`,
        name: `${parent.name} (Isle ${s + 1})`,
        type: 'island',
        color: parent.color || VINTAGE_PARCHMENT.landFillHex,
        polygon: secPiece.outerRing,
        holes: undefined,
        climateZone: parent.climateZone || 'temperate',
      });
    }
  }

  // Handle unparented pieces (newly painted land where no previous land existed)
  const newLandFeatures: MapTerrainFeature[] = [];
  const existingLandCount = landFeatures.length;

  for (let i = 0; i < unparentedPieces.length; i++) {
    const piece = unparentedPieces[i];
    const id = `terr_land_${Date.now().toString(36)}_${i}`;
    let name: string;
    let type: 'continent' | 'island';

    if (existingLandCount === 0 && newLandFeatures.length === 0) {
      name = 'The First Continent';
      type = 'continent';
    } else {
      name = `Isle of ${String.fromCharCode(65 + (i % 26))}`;
      type = piece.area > CONTINENT_AREA_THRESHOLD ? 'continent' : 'island';
    }

    newLandFeatures.push({
      id,
      name,
      type,
      color: VINTAGE_PARCHMENT.landFillHex,
      polygon: piece.outerRing,
      holes: undefined,
      climateZone: 'temperate',
    });
  }

  const finalLand = [
    ...orderedLandFeatures.filter((f): f is MapTerrainFeature => f !== null),
    ...secondaryPieces,
    ...newLandFeatures,
  ];

  // Combine updated land features, lakes (preserved & new), and surviving non-land features
  return [...finalLand, ...finalLakes, ...otherNonLandFeatures];
}
