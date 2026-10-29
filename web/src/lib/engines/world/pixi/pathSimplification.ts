import type { MapPoint } from '@/lib/types';

/**
 * Calculates perpendicular distance from a point P to a line segment AB.
 */
export function perpendicularDistance(p: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  // Cross product / length gives perpendicular distance
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(lenSq);
}

/**
 * Standard Ramer-Douglas-Peucker (RDP) algorithm for polyline simplification.
 * Reduces the number of points in a curve while preserving its overall shape.
 *
 * @param points Array of points along the path
 * @param epsilon Distance tolerance threshold. Larger = fewer points, smaller = more detail. Default 6.
 * @returns Simplified array of points
 */
export function simplifyPoints(points: MapPoint[], epsilon: number = 6): MapPoint[] {
  if (!points || points.length <= 2) {
    return points ? [...points] : [];
  }

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, index + 1), epsilon);
    const right = simplifyPoints(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Simplifies a closed polygon using RDP while preserving its closed nature
 * and ensuring it doesn't collapse below 3 distinct vertices.
 *
 * @param polygon Array of polygon vertices
 * @param epsilon Distance tolerance threshold. Default 8.
 * @returns Simplified closed polygon vertices
 */
export function simplifyPolygon(polygon: MapPoint[], epsilon: number = 8): MapPoint[] {
  if (!polygon || polygon.length < 3) {
    return polygon ? [...polygon] : [];
  }

  // Check if polygon has duplicate closing point
  const isClosed =
    polygon.length > 3 &&
    Math.hypot(
      polygon[0].x - polygon[polygon.length - 1].x,
      polygon[0].y - polygon[polygon.length - 1].y
    ) < 5;

  const pts = isClosed ? polygon.slice(0, polygon.length - 1) : [...polygon];
  if (pts.length <= 4) return polygon;

  // Find the point furthest from the start point to split the closed loop into two segments
  let maxDist = 0;
  let splitIndex = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y);
    if (d > maxDist) {
      maxDist = d;
      splitIndex = i;
    }
  }

  const part1 = pts.slice(0, splitIndex + 1);
  const part2 = pts.slice(splitIndex).concat([pts[0]]);

  const simp1 = simplifyPoints(part1, epsilon);
  const simp2 = simplifyPoints(part2, epsilon);

  // Combine results without duplicating splitIndex or start point
  const combined = simp1.slice(0, simp1.length - 1).concat(simp2.slice(0, simp2.length - 1));

  // If simplification decimated too much (e.g. less than 3 vertices), fallback to a lighter epsilon
  if (combined.length < 3) {
    return simplifyPolygon(polygon, Math.max(2, epsilon * 0.5));
  }

  return combined;
}
