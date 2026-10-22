import type { MapPoint } from '@/lib/types';
import type { Ring as GeoRing } from 'polygon-clipping';
import type { BoundingBox } from './types';

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

/**
 * Calculates centroid of a polygon ring by vertex averaging.
 */
export function getPolygonCentroid(points: MapPoint[]): MapPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < points.length; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
}

/**
 * Tests whether a 2D point is inside a polygon ring using ray casting.
 */
export function isPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
