/**
 * waterliningGenerator.ts
 *
 * Coastal & Shoreline Waterlining: Concentric Wave Echo Contours
 * (Plan 27 — Module 2)
 *
 * Replaces blurry solid shoreline strokes with authentic illuminated manuscript
 * concentric wave echo contours:
 * - Successive outward buffer rings for continents and ocean islands.
 * - Successive inward buffer rings for inland lakes (e.g. Lake Veridia, Lake Firouzeh).
 * - Multi-tier distance spacing with miter-limit clamped vertex bisector expansion.
 * - Subtle organic wave modulation along arc-length.
 * - Atmospheric stroke width and opacity falloff fading into the open sea.
 * - Outermost ring stippling/dashing as broken wave crests.
 */

import type { MapPoint, WaterliningConfig } from '@/lib/types';
import {
  calculatePolygonArea,
  calculateSignedArea,
  getBoundingBox,
} from '../landSculpt/geometry';
import { getNoiseFunction } from '../landSculpt/noise';
import { VINTAGE_PARCHMENT } from './vintageTheme';

export interface WaterlineRing {
  index: number;
  distance: number;
  polygon: MapPoint[];
  strokeWidth: number;
  alpha: number;
  color: number;
  isStippled: boolean;
  dashSegments?: [MapPoint, MapPoint][];
}

export interface ProceduralWaterlining {
  id: string;
  sourceType: 'land' | 'lake';
  rings: WaterlineRing[];
  shoreline: MapPoint[];
}

export interface WaterlineOptions extends WaterliningConfig {
  seed?: number;
  color?: number;
}

/**
 * Standard atmospheric falloff table for 4-tier manuscript waterlines.
 */
const WATERLINE_TIER_STYLES = [
  { strokeWidth: 1.4, alpha: 0.45, color: 0x486b7f }, // Ring 0: Darkest near-shore ink
  { strokeWidth: 1.0, alpha: 0.30, color: 0x486b7f }, // Ring 1: Medium wave
  { strokeWidth: 0.75, alpha: 0.18, color: 0x5a7d91 }, // Ring 2: Distant wave
  { strokeWidth: 0.6, alpha: 0.10, color: 0x6d8e9f }, // Ring 3: Soft sea stipple
];

/**
 * Generates outward concentric wave echo contours for landmasses and islands.
 */
export function generateCoastlineWaterlines(
  polygon: MapPoint[],
  options: WaterlineOptions = {}
): ProceduralWaterlining | null {
  if (!polygon || polygon.length < 3) return null;

  const totalArea = calculatePolygonArea(polygon);
  if (totalArea < 40) return null;

  const seed = options.seed ?? 42;
  const ringCount = Math.max(1, Math.min(6, options.ringCount ?? 4));
  const baseDistance = options.baseDistance ?? 4.0;
  const distanceStep = options.distanceStep ?? 5.5;
  const stippledOuter = options.stippledOuter !== false;

  const cleanPolygon = sanitizePolygon(polygon);
  if (cleanPolygon.length < 3) return null;

  const rings: WaterlineRing[] = [];

  for (let i = 0; i < ringCount; i++) {
    const distance = baseDistance + i * distanceStep;
    const isOutermost = i === ringCount - 1 && stippledOuter;

    const offsetPoints = offsetPolygonContour(cleanPolygon, distance, {
      outward: true,
      noiseSeed: seed + i * 17,
      miterLimit: 2.2,
    });

    if (offsetPoints.length < 3) continue;

    const style =
      WATERLINE_TIER_STYLES[Math.min(i, WATERLINE_TIER_STYLES.length - 1)];

    const dashSegments = isOutermost
      ? createStippledDashSegments(offsetPoints, 12, 8)
      : undefined;

    rings.push({
      index: i,
      distance,
      polygon: offsetPoints,
      strokeWidth: style.strokeWidth,
      alpha: style.alpha,
      color: options.color ?? style.color,
      isStippled: isOutermost,
      dashSegments,
    });
  }

  return {
    id: `waterline_coast_${seed}`,
    sourceType: 'land',
    rings,
    shoreline: cleanPolygon,
  };
}

/**
 * Generates inward concentric wave echo contours for inland lakes and seas.
 */
export function generateLakeWaterlines(
  polygon: MapPoint[],
  options: WaterlineOptions = {}
): ProceduralWaterlining | null {
  if (!polygon || polygon.length < 3) return null;

  const initialArea = calculatePolygonArea(polygon);
  if (initialArea < 100) return null;

  const seed = options.seed ?? 42;
  const ringCount = Math.max(1, Math.min(6, options.ringCount ?? 4));
  const baseDistance = options.baseDistance ?? 3.5;
  const distanceStep = options.distanceStep ?? 4.5;
  const stippledOuter = options.stippledOuter !== false;

  const cleanPolygon = sanitizePolygon(polygon);
  if (cleanPolygon.length < 3) return null;

  const rings: WaterlineRing[] = [];

  for (let i = 0; i < ringCount; i++) {
    const distance = baseDistance + i * distanceStep;
    const isOutermost = i === ringCount - 1 && stippledOuter;

    const offsetPoints = offsetPolygonContour(cleanPolygon, distance, {
      outward: false,
      noiseSeed: seed + i * 23,
      miterLimit: 1.8,
    });

    if (offsetPoints.length < 3) break;

    // Check if inward offset has inverted or collapsed
    const currentArea = calculatePolygonArea(offsetPoints);
    if (currentArea < 30 || currentArea > initialArea) {
      break;
    }

    const style =
      WATERLINE_TIER_STYLES[Math.min(i, WATERLINE_TIER_STYLES.length - 1)];

    const dashSegments = isOutermost
      ? createStippledDashSegments(offsetPoints, 10, 6)
      : undefined;

    rings.push({
      index: i,
      distance,
      polygon: offsetPoints,
      strokeWidth: style.strokeWidth,
      alpha: style.alpha,
      color: options.color ?? style.color,
      isStippled: isOutermost,
      dashSegments,
    });
  }

  return {
    id: `waterline_lake_${seed}`,
    sourceType: 'lake',
    rings,
    shoreline: cleanPolygon,
  };
}

/**
 * Computes a robust offset polygon contour using vertex bisector normal expansion.
 */
export function offsetPolygonContour(
  polygon: MapPoint[],
  distance: number,
  options: {
    outward: boolean;
    noiseSeed?: number;
    miterLimit?: number;
  }
): MapPoint[] {
  const n = polygon.length;
  if (n < 3) return [];

  const miterLimit = options.miterLimit ?? 2.0;
  const noise =
    options.noiseSeed !== undefined ? getNoiseFunction(options.noiseSeed) : null;

  // Ensure strict Counter-Clockwise (CCW) vertex ordering for predictable normal math
  const signedArea = calculateSignedArea(polygon);
  const pts = signedArea < 0 ? [...polygon].reverse() : polygon;

  // Precompute unit edge vectors and normals
  const edgeNormals: { nx: number; ny: number }[] = [];
  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    const dx = pts[nextIdx].x - pts[i].x;
    const dy = pts[nextIdx].y - pts[i].y;
    const len = Math.hypot(dx, dy) || 1e-6;

    // For CCW polygon:
    // Outward normal: (dy / len, -dx / len)
    // Inward normal:  (-dy / len, dx / len)
    if (options.outward) {
      edgeNormals.push({ nx: dy / len, ny: -dx / len });
    } else {
      edgeNormals.push({ nx: -dy / len, ny: dx / len });
    }
  }

  const offsetResult: MapPoint[] = [];

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const nPrev = edgeNormals[prevIdx];
    const nCur = edgeNormals[i];

    // Angle bisector normal
    const vx = nPrev.nx + nCur.nx;
    const vy = nPrev.ny + nCur.ny;
    const vLen = Math.hypot(vx, vy);

    let bx: number;
    let by: number;
    let miterFactor: number;

    if (vLen < 1e-4) {
      bx = nCur.nx;
      by = nCur.ny;
      miterFactor = 1.0;
    } else {
      bx = vx / vLen;
      by = vy / vLen;
      // Dot product: cos(alpha) = vLen / 2 -> miterFactor = 2 / vLen
      miterFactor = Math.min(miterLimit, 2.0 / vLen);
    }

    // Organic wave ripple modulation
    let effectiveDist = distance;
    if (noise) {
      const wobble =
        1.0 + 0.12 * noise(pts[i].x * 0.015, pts[i].y * 0.015);
      effectiveDist = distance * wobble;
    }

    const shift = effectiveDist * miterFactor;
    offsetResult.push({
      x: Math.round((pts[i].x + bx * shift) * 10) / 10,
      y: Math.round((pts[i].y + by * shift) * 10) / 10,
    });
  }

  return offsetResult;
}

/**
 * Discretizes a closed polyline into broken wave crest dash segments
 * for illuminated manuscript outer wave rings.
 */
export function createStippledDashSegments(
  points: MapPoint[],
  dashLength = 12,
  gapLength = 8
): [MapPoint, MapPoint][] {
  const segments: [MapPoint, MapPoint][] = [];
  const n = points.length;
  if (n < 2) return segments;

  let currentDist = 0;
  let isDashing = true;
  const cycle = dashLength + gapLength;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const edgeLen = Math.hypot(dx, dy);
    if (edgeLen < 1) continue;

    const ux = dx / edgeLen;
    const uy = dy / edgeLen;

    let segmentProgress = 0;
    while (segmentProgress < edgeLen) {
      const posInCycle = currentDist % cycle;
      if (posInCycle < dashLength) {
        // We are inside a dash
        const dashRemaining = dashLength - posInCycle;
        const step = Math.min(dashRemaining, edgeLen - segmentProgress);

        const startPt: MapPoint = {
          x: Math.round((p1.x + ux * segmentProgress) * 10) / 10,
          y: Math.round((p1.y + uy * segmentProgress) * 10) / 10,
        };
        const endPt: MapPoint = {
          x: Math.round((p1.x + ux * (segmentProgress + step)) * 10) / 10,
          y: Math.round((p1.y + uy * (segmentProgress + step)) * 10) / 10,
        };

        if (step > 1.5) {
          segments.push([startPt, endPt]);
        }

        segmentProgress += step;
        currentDist += step;
      } else {
        // We are inside a gap
        const gapRemaining = cycle - posInCycle;
        const step = Math.min(gapRemaining, edgeLen - segmentProgress);
        segmentProgress += step;
        currentDist += step;
      }
    }
  }

  return segments;
}

/**
 * Sanitizes input polygon by removing duplicate and degenerate vertices.
 */
function sanitizePolygon(points: MapPoint[]): MapPoint[] {
  if (points.length < 3) return [];
  const clean: MapPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = clean[clean.length - 1];
    if (prev && Math.hypot(cur.x - prev.x, cur.y - prev.y) < 1.0) {
      continue;
    }
    clean.push(cur);
  }

  // Remove matching end vertex if closed loop repeats start point
  if (
    clean.length > 2 &&
    Math.hypot(
      clean[0].x - clean[clean.length - 1].x,
      clean[0].y - clean[clean.length - 1].y
    ) < 1.0
  ) {
    clean.pop();
  }

  return clean;
}
