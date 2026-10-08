/**
 * landSculptEngine.ts
 *
 * Core algorithmic geometry engine for continuous land sculpting in StoryForge.
 * Implements:
 *   1. Sub-step continuous stroke interpolation (gap elimination at 60 FPS).
 *   2. Procedural organic radial stamp generation perturbed by continuous 2D Simplex noise.
 *   3. Martinez-Rueda-Feito boolean polygon clipping (Union for Paint, Difference for Carve).
 *   4. Topological hole support for inland lakes, inland seas, and straits.
 *   5. High-speed Ramer-Douglas-Peucker (RDP) polygon simplification with radial pre-filtering.
 *   6. Multi-stage geometric sanitization, sliver pruning, and <10ms consolidation budget.
 */

import polygonClipping, {
  MultiPolygon as GeoMultiPolygon,
  Polygon as GeoPolygon,
  Ring as GeoRing,
  Pair as GeoPoint,
} from 'polygon-clipping';
import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { MapPoint, MapTerrainFeature } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './pixi/vintageTheme';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export const DEFAULT_SIMPLIFY_EPSILON = 1.5; // pixels
export const MIN_FEATURE_AREA = 15.0; // sq pixels (discard outer slivers)
export const MIN_HOLE_AREA = 20.0; // sq pixels (discard needle pinholes)
export const DUPLICATE_TOLERANCE_SQ = 1e-4; // sq pixels (~0.01 px)
export const COLLINEAR_CROSS_TOLERANCE = 1e-5;
export const CONTINENT_AREA_THRESHOLD = 150000; // sq pixels

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BrushStrokeConfig {
  size: number; // 20 - 250 px
  roughness: number; // 0.0 - 1.0 (noise amplitude)
  mode: 'paint' | 'carve';
}

export interface SculptOptions {
  simplifyTolerance?: number; // Epsilon for Douglas-Peucker (default 1.5)
  minArea?: number; // Minimum polygon area to keep (default 15.0)
  minHoleArea?: number; // Minimum hole area to keep (default 20.0)
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================================================
// DETERMINISTIC PRNG & SIMPLEX NOISE CACHE
// ============================================================================

/**
 * Fast 32-bit Mulberry32 deterministic pseudo-random number generator.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level noise cache for zero allocation overhead during 60 FPS painting
const noiseCache = new Map<number, NoiseFunction2D>();
const defaultNoise: NoiseFunction2D = createNoise2D();

/**
 * Retrieves a cached NoiseFunction2D instance for the given seed.
 */
export function getNoiseFunction(seed?: number): NoiseFunction2D {
  if (seed === undefined) return defaultNoise;
  let noise = noiseCache.get(seed);
  if (!noise) {
    noise = createNoise2D(makeRng(seed));
    noiseCache.set(seed, noise);
  }
  return noise;
}

// ============================================================================
// 1. DISTANCE & 2D GEOMETRY PRIMITIVES
// ============================================================================

/**
 * Calculates squared Euclidean distance between two points.
 */
export function getSqDist(p1: MapPoint, p2: MapPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

/**
 * Calculates squared perpendicular distance from point p to line segment (p1, p2)
 * using clamped orthogonal projection parameter t in [0, 1].
 */
export function getSqSegmentDist(p: MapPoint, p1: MapPoint, p2: MapPoint): number {
  let x = p1.x;
  let y = p1.y;
  const dx = p2.x - x;
  const dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  const distX = p.x - x;
  const distY = p.y - y;
  return distX * distX + distY * distY;
}

/**
 * Calculates signed polygon area using the 2D Shoelace formula.
 * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW).
 */
export function calculateSignedArea(points: MapPoint[] | GeoRing): number {
  const n = points.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p1 = points[i];
    const p2 = points[j];
    const x1 = Array.isArray(p1) ? p1[0] : (p1 as MapPoint).x;
    const y1 = Array.isArray(p1) ? p1[1] : (p1 as MapPoint).y;
    const x2 = Array.isArray(p2) ? p2[0] : (p2 as MapPoint).x;
    const y2 = Array.isArray(p2) ? p2[1] : (p2 as MapPoint).y;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/**
 * Calculates absolute polygon area.
 */
export function calculatePolygonArea(points: MapPoint[] | GeoRing): number {
  return Math.abs(calculateSignedArea(points));
}

/**
 * Computes Axis-Aligned Bounding Box (AABB) for an array of points.
 */
export function getBoundingBox(points: MapPoint[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Checks if two AABB bounding boxes intersect.
 */
export function doAABBIntersect(b1: BoundingBox, b2: BoundingBox): boolean {
  return !(b2.minX > b1.maxX || b2.maxX < b1.minX || b2.minY > b1.maxY || b2.maxY < b1.minY);
}

// ============================================================================
// 2. STROKE INTERPOLATION & ORGANIC STAMP GENERATION
// ============================================================================

/**
 * Interpolates discrete mouse pointer movements into dense sub-step coordinates.
 * Eliminates gaps and beading when dragging rapidly across the map canvas.
 *
 * @param p0 Start point
 * @param p1 End point
 * @param stepSize Maximum distance between adjacent interpolated points
 * @param optionsOrIncludeStart Boolean or options object specifying whether to include p0 (default true)
 * @returns Array of dense intermediate points
 */
export function interpolateStrokePoints(
  p0: MapPoint,
  p1: MapPoint,
  stepSize: number,
  optionsOrIncludeStart: boolean | { includeStart?: boolean } = true
): MapPoint[] {
  const includeStart =
    typeof optionsOrIncludeStart === 'boolean'
      ? optionsOrIncludeStart
      : optionsOrIncludeStart?.includeStart ?? true;

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.hypot(dx, dy);

  const roundedP0: MapPoint = { x: Math.round(p0.x), y: Math.round(p0.y) };
  const roundedP1: MapPoint = { x: Math.round(p1.x), y: Math.round(p1.y) };

  if (dist === 0) {
    return includeStart ? [roundedP0] : [];
  }

  const effectiveStep = Math.max(1, stepSize || 10);
  const steps = Math.max(1, Math.ceil(dist / effectiveStep));
  const points: MapPoint[] = [];

  const startIdx = includeStart ? 0 : 1;
  for (let i = startIdx; i <= steps; i++) {
    const t = i / steps;
    const pt: MapPoint =
      i === 0
        ? roundedP0
        : i === steps
        ? roundedP1
        : {
            x: Math.round(p0.x + t * dx),
            y: Math.round(p0.y + t * dy),
          };

    if (
      points.length === 0 ||
      points[points.length - 1].x !== pt.x ||
      points[points.length - 1].y !== pt.y
    ) {
      points.push(pt);
    }
  }

  return points;
}

/**
 * Generates an organic radial polygon stamp centered at (cx, cy) perturbed by Simplex noise.
 * Guaranteed 100% seamless closed loop (sampled on unit circle in 2D noise space) and strictly
 * star-convex (no self-intersections or degenerate folds).
 *
 * @param cx Center X coordinate
 * @param cy Center Y coordinate
 * @param radius Base radius in map pixels
 * @param roughness Modulation factor (0.0 = smooth circle, 1.0 = rugged coastline)
 * @param seed Optional deterministic seed for reproducibility
 * @param vertexCount Number of vertices (default 32, clamped to [24, 64])
 * @returns Array of polygon boundary vertices
 */
export function generateOrganicStamp(
  cx: number,
  cy: number,
  radius: number,
  roughness: number,
  seed?: number,
  vertexCount = 32
): MapPoint[] {
  const safeRadius = Math.max(1, radius);
  const clampedRoughness = Math.max(0, Math.min(1, roughness));
  const count = Math.max(24, Math.min(64, Math.round(vertexCount || 32)));

  // Fast path for perfect circular stamps (zero roughness)
  if (clampedRoughness === 0) {
    const circlePoints: MapPoint[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      circlePoints.push({
        x: Math.round(cx + safeRadius * Math.cos(angle)),
        y: Math.round(cy + safeRadius * Math.sin(angle)),
      });
    }
    return circlePoints;
  }

  const noise = getNoiseFunction(seed);
  const freq1 = 1.2; // Macro promontory/bay frequency
  const freq2 = 3.6; // Micro jagged coastline frequency
  const maxAmplitude = 0.35 * clampedRoughness; // Max +/-35% radial perturbation

  // Spatial world-continuity offset
  const worldOffsetX = (cx * 0.003) % 100;
  const worldOffsetY = (cy * 0.003) % 100;

  const points: MapPoint[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Sample continuous loop in 2D noise space (zero angular seam at 0 / 2*PI)
    const n1 = noise(cosA * freq1 + worldOffsetX, sinA * freq1 + worldOffsetY);
    const n2 = noise(cosA * freq2 + worldOffsetX * 2, sinA * freq2 + worldOffsetY * 2);
    const combinedNoise = n1 * 0.7 + n2 * 0.3;

    // Modulate radius strictly bounded: r in [0.65 * safeRadius, 1.35 * safeRadius]
    const r = safeRadius * (1 + maxAmplitude * combinedNoise);

    points.push({
      x: Math.round(cx + r * cosA),
      y: Math.round(cy + r * sinA),
    });
  }

  return points;
}

// ============================================================================
// 3. SANITIZATION PIPELINE & RING UTILITIES
// ============================================================================

/**
 * Removes consecutive duplicate vertices whose distance squared <= toleranceSq.
 */
export function removeDuplicateVertices(
  points: MapPoint[],
  toleranceSq = DUPLICATE_TOLERANCE_SQ
): MapPoint[] {
  if (points.length <= 1) return points.slice();
  const result: MapPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    if (getSqDist(prev, curr) > toleranceSq) {
      result.push(curr);
    }
  }
  return result;
}

/**
 * Removes collinear intermediate vertices along polygon boundaries.
 */
export function removeCollinearVertices(
  points: MapPoint[],
  crossTolerance = COLLINEAR_CROSS_TOLERANCE
): MapPoint[] {
  if (points.length < 3) return points.slice();
  const n = points.length;
  const result: MapPoint[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    // 2D cross product: (curr - prev) x (next - curr)
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) > crossTolerance) {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points.slice();
}

/**
 * Ensures coordinate ring has no duplicate end point (open ring format for MapTerrainFeature).
 */
export function ensureOpenRing(points: MapPoint[]): MapPoint[] {
  if (points.length === 0) return [];
  const last = points[points.length - 1];
  const first = points[0];
  if (points.length > 1 && Math.abs(last.x - first.x) < 1e-4 && Math.abs(last.y - first.y) < 1e-4) {
    return points.slice(0, points.length - 1);
  }
  return points.slice();
}

/**
 * Ensures coordinate ring has an explicit matching end point (closed ring format for polygon-clipping).
 */
export function ensureClosedRing(points: MapPoint[]): MapPoint[] {
  if (points.length === 0) return [];
  const open = ensureOpenRing(points);
  if (open.length < 3) return open;
  return [...open, { x: open[0].x, y: open[0].y }];
}

/**
 * Determines whether a polygon or hole is a degenerate sliver below threshold area.
 */
export function isDegeneratePolygon(points: MapPoint[], minArea = MIN_FEATURE_AREA): boolean {
  if (points.length < 3) return true;
  return calculatePolygonArea(points) < minArea;
}

// ============================================================================
// 4. RAMER-DOUGLAS-PEUCKER (RDP) SIMPLIFICATION
// ============================================================================

/**
 * High-speed O(N) radial distance pre-filter pass.
 * Discards points closer than sqEpsilon before running iterative RDP.
 */
export function simplifyRadialDist(points: MapPoint[], sqEpsilon: number): MapPoint[] {
  if (points.length <= 2) return points.slice();
  let prev = points[0];
  const result: MapPoint[] = [prev];
  const lastIdx = points.length - 1;

  for (let i = 1; i < lastIdx; i++) {
    const pt = points[i];
    if (getSqDist(pt, prev) > sqEpsilon) {
      result.push(pt);
      prev = pt;
    }
  }

  result.push(points[lastIdx]);
  return result;
}

/**
 * Iterative stack-based Ramer-Douglas-Peucker simplification on a polyline.
 * Uses Uint8Array markers to eliminate recursion stack overflow.
 */
export function simplifyPolyline(
  points: MapPoint[],
  epsilon = DEFAULT_SIMPLIFY_EPSILON
): MapPoint[] {
  const len = points.length;
  if (len <= 2) return points.slice();
  const sqEpsilon = epsilon * epsilon;

  // 1. Fast linear radial pre-pass
  const radialFiltered = simplifyRadialDist(points, sqEpsilon);
  const fLen = radialFiltered.length;
  if (fLen <= 2) return radialFiltered;

  // 2. Iterative RDP with index stack
  const markers = new Uint8Array(fLen);
  markers[0] = 1;
  markers[fLen - 1] = 1;
  const stack: [number, number][] = [[0, fLen - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxSqDist = 0;
    let maxIdx = -1;
    const p1 = radialFiltered[start];
    const p2 = radialFiltered[end];

    for (let i = start + 1; i < end; i++) {
      const sqDist = getSqSegmentDist(radialFiltered[i], p1, p2);
      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        maxIdx = i;
      }
    }

    if (maxSqDist > sqEpsilon && maxIdx !== -1) {
      markers[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const result: MapPoint[] = [];
  for (let i = 0; i < fLen; i++) {
    if (markers[i] === 1) {
      result.push(radialFiltered[i]);
    }
  }
  return result;
}

/**
 * Simplifies a closed 2D polygon ring.
 * Rotates the ring to an extreme vertex (guaranteed outer convex corner)
 * so collinear initial vertices are cleanly simplified away without endpoint bias.
 */
export function simplifyPolygonRing(
  ring: MapPoint[],
  epsilon = DEFAULT_SIMPLIFY_EPSILON
): MapPoint[] {
  const open = ensureOpenRing(ring);
  if (open.length < 3) return open;

  // 1. Deduplicate & remove collinear
  const cleaned = removeCollinearVertices(removeDuplicateVertices(open));
  if (cleaned.length < 3) return cleaned;

  // 2. Find extreme vertex (min X, tiebreak min Y)
  let minIdx = 0;
  for (let i = 1; i < cleaned.length; i++) {
    if (
      cleaned[i].x < cleaned[minIdx].x ||
      (cleaned[i].x === cleaned[minIdx].x && cleaned[i].y < cleaned[minIdx].y)
    ) {
      minIdx = i;
    }
  }

  // 3. Rotate ring so extreme corner is at index 0
  const rotated: MapPoint[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    rotated.push(cleaned[(minIdx + i) % cleaned.length]);
  }
  // Temporarily close for polyline RDP
  rotated.push({ x: rotated[0].x, y: rotated[0].y });

  // 4. Run RDP
  const simplified = simplifyPolyline(rotated, epsilon);

  // 5. Restore open ring format
  const result = ensureOpenRing(simplified);
  return result.length >= 3 ? result : cleaned;
}

/**
 * General Ramer-Douglas-Peucker simplification function.
 * Auto-detects whether the input is a closed ring or an open polyline.
 */
export function simplifyDouglasPeucker(
  points: MapPoint[],
  tolerance = DEFAULT_SIMPLIFY_EPSILON
): MapPoint[] {
  if (points.length <= 2) return points.slice();
  const isClosed =
    points.length >= 4 &&
    Math.abs(points[0].x - points[points.length - 1].x) < 1e-4 &&
    Math.abs(points[0].y - points[points.length - 1].y) < 1e-4;

  if (isClosed) {
    return simplifyPolygonRing(points, tolerance);
  }
  return simplifyPolyline(points, tolerance);
}

/**
 * Master sanitization utility for a polygon ring.
 * Eliminates duplicate vertices, collinear points, and degenerate slivers.
 */
export function sanitizePolygonRing(
  ring: MapPoint[],
  minArea = MIN_FEATURE_AREA
): MapPoint[] {
  const open = ensureOpenRing(ring);
  if (open.length < 3) return [];

  const cleaned = removeCollinearVertices(removeDuplicateVertices(open));
  if (cleaned.length < 3 || calculatePolygonArea(cleaned) < minArea) {
    return [];
  }
  return cleaned;
}

/**
 * Master sanitization & simplification utility for terrain feature polygons.
 */
export function sanitizeAndSimplifyPolygon(
  points: MapPoint[],
  epsilon = DEFAULT_SIMPLIFY_EPSILON
): MapPoint[] {
  const simplified = simplifyPolygonRing(points, epsilon);
  if (isDegeneratePolygon(simplified, MIN_FEATURE_AREA)) {
    return [];
  }
  return simplified;
}

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

  // 1. Separate landmasses from non-land features (mountains, rivers, biomes, etc.)
  const landFeatures = existingFeatures.filter(
    (f) =>
      (f.type === 'continent' || f.type === 'island') &&
      f.polygon &&
      f.polygon.length >= 3
  );
  const nonLandFeatures = existingFeatures.filter(
    (f) =>
      f.type !== 'continent' &&
      f.type !== 'island' &&
      f.type !== 'lake' // Existing caldera lakes will be refreshed if inside carved areas
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

  // 5. Convert existing land features to GeoMultiPolygon
  const existingMultiPoly = featuresToGeoMultiPolygon(landFeatures);

  // 6. Execute Boolean Clipping
  let resultMultiPoly: GeoMultiPolygon;

  if (mode === 'paint') {
    if (existingMultiPoly.length === 0) {
      if (strokeGeoPolys.length === 1) {
        resultMultiPoly = [strokeGeoPolys[0]];
      } else {
        try {
          resultMultiPoly = polygonClipping.union(
            strokeGeoPolys[0],
            ...strokeGeoPolys.slice(1)
          ) as GeoMultiPolygon;
        } catch {
          resultMultiPoly = strokeGeoPolys;
        }
      }
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
    // All land eroded away -> clean open ocean
    return nonLandFeatures;
  }

  // Map each output polygon back to the most overlapping parent land feature
  const landBBoxes = landFeatures.map((lf) => ({
    feature: lf,
    bbox: lf.polygon ? getBoundingBox(lf.polygon) : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }));

  interface ProcessedPiece {
    outerRing: MapPoint[];
    holes: MapPoint[][];
    parent: MapTerrainFeature | null;
    area: number;
  }

  const processedPieces: ProcessedPiece[] = [];
  const createdLakes: MapTerrainFeature[] = [];

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

          // Generate companion lake feature for inspection, styling & echo rings
          createdLakes.push({
            id: `terr_lake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            name: 'Inland Caldera Lake',
            type: 'lake',
            polygon: simplifiedHole,
            color: '#4f728c',
            description: 'An inland water body carved into the landmass',
            climateZone: 'temperate',
          });
        }
      }
    }

    // Find overlapping parent
    const pieceBbox = getBoundingBox(simplifiedOuter);
    let bestParent: MapTerrainFeature | null = null;
    let maxOverlapArea = 0;

    for (const lb of landBBoxes) {
      if (doAABBIntersect(pieceBbox, lb.bbox)) {
        const ixMin = Math.max(pieceBbox.minX, lb.bbox.minX);
        const ixMax = Math.min(pieceBbox.maxX, lb.bbox.maxX);
        const iyMin = Math.max(pieceBbox.minY, lb.bbox.minY);
        const iyMax = Math.min(pieceBbox.maxY, lb.bbox.maxY);
        const overlapArea = (ixMax - ixMin) * (iyMax - iyMin);
        if (overlapArea > maxOverlapArea) {
          maxOverlapArea = overlapArea;
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

    // Primary piece retains parent position and identity
    const primaryPiece = pieces[0];
    const primaryType = isSplit
      ? 'island'
      : parent.type === 'continent'
      ? 'continent'
      : 'island';
    const primaryName = isSplit ? `${parent.name} (Major)` : parent.name;

    orderedLandFeatures[idx] = {
      id: parent.id,
      name: primaryName,
      type: primaryType,
      color: parent.color || VINTAGE_PARCHMENT.landFillHex,
      polygon: primaryPiece.outerRing,
      holes: primaryPiece.holes.length > 0 ? primaryPiece.holes : undefined,
      description: parent.description,
      climateZone: parent.climateZone || 'temperate',
    };

    // Secondary pieces from splits become independent islands
    for (let s = 1; s < pieces.length; s++) {
      const secPiece = pieces[s];
      secondaryPieces.push({
        id: `${parent.id}_isle_${s + 1}`,
        name: `${parent.name} (Isle ${s + 1})`,
        type: 'island',
        color: parent.color || VINTAGE_PARCHMENT.landFillHex,
        polygon: secPiece.outerRing,
        holes: secPiece.holes.length > 0 ? secPiece.holes : undefined,
        description: parent.description,
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
      holes: piece.holes.length > 0 ? piece.holes : undefined,
      climateZone: 'temperate',
    });
  }

  const finalLand = [
    ...orderedLandFeatures.filter((f): f is MapTerrainFeature => f !== null),
    ...secondaryPieces,
    ...newLandFeatures,
  ];

  // Combine updated land features, newly created lakes, and surviving non-land features
  return [...finalLand, ...createdLakes, ...nonLandFeatures];
}
