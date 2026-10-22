import type { MapPoint } from '@/lib/types';
import {
  COLLINEAR_CROSS_TOLERANCE,
  DEFAULT_SIMPLIFY_EPSILON,
  DUPLICATE_TOLERANCE_SQ,
  MIN_FEATURE_AREA,
} from './types';
import {
  calculatePolygonArea,
  getSqDist,
  getSqSegmentDist,
} from './geometry';

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
