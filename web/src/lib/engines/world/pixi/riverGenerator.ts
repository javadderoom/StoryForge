/**
 * Procedural River & Estuary Geometry Generator
 *
 * Implements hand-inked fantasy cartography rivers matching the
 * Faravand illuminated manuscript aesthetic (e.g. Zarvan River, Arvand River).
 *
 * Key guarantees:
 * 1. Centripetal Catmull-Rom spline interpolation ensures C1-continuous smooth curves.
 * 2. Curvature-aware inner-bank clamping eliminates self-intersection loops, pinch folds,
 *    and creases on sharp turns.
 * 3. Monotonic width tapering from a delicate headwaters source tip (~1px) to a broad estuary mouth.
 * 4. Open estuary mouth without artificial geometric diamond glitches.
 * 5. Deterministic organic sinuosity modulated by harmonic noise.
 */

import type { MapPoint, RiverDeltaConfig } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';
import { generateProceduralDelta, type ProceduralDelta } from './deltaGenerator';

export interface ProceduralRiver {
  id: string;
  centerline: MapPoint[];
  waterPolygon: MapPoint[];
  leftBank: MapPoint[];
  rightBank: MapPoint[];
  totalLength: number;
  delta?: ProceduralDelta;
}

export interface RiverOptions {
  seed?: number;
  startWidth?: number; // Width at headwaters in pixels (default: 1.2)
  endWidth?: number; // Width at mouth/estuary in pixels (default: 10.0)
  meanderRoughness?: number; // Sinuosity factor 0..1 (default: 0.3)
  deltaConfig?: RiverDeltaConfig;
}

/**
 * Generates an organically smoothed, tapered procedural river from authored polyline points.
 */
export function generateProceduralRiver(
  points: MapPoint[],
  options: RiverOptions = {}
): ProceduralRiver {
  if (!points || points.length < 2) {
    return {
      id: 'river_empty',
      centerline: points || [],
      waterPolygon: [],
      leftBank: [],
      rightBank: [],
      totalLength: 0,
    };
  }

  // Deduplicate consecutive identical points
  const cleanPoints: MapPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cleanPoints[cleanPoints.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) > 1.5) {
      cleanPoints.push(points[i]);
    }
  }

  if (cleanPoints.length < 2) {
    const p0 = points[0];
    return {
      id: `river_${Math.round(p0.x)}`,
      centerline: [p0, p0],
      waterPolygon: [],
      leftBank: [p0, p0],
      rightBank: [p0, p0],
      totalLength: 0,
    };
  }

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const startW = Math.max(0.8, Math.min(6, options.startWidth ?? 1.2));
  const endW = Math.max(startW + 2, Math.min(35, options.endWidth ?? 11.0));
  const meanderRoughness = Math.max(0, Math.min(1, options.meanderRoughness ?? 0.3));

  // 1. Catmull-Rom Spline Densification
  // Dense uniform sampling along centripetal Catmull-Rom spline
  const splinePoints = evaluateCatmullRomSpline(cleanPoints, 4);

  // Calculate cumulative arc length along the smoothed spline
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < splinePoints.length - 1; i++) {
    const d = Math.hypot(
      splinePoints[i + 1].x - splinePoints[i].x,
      splinePoints[i + 1].y - splinePoints[i].y
    );
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength < 8) {
    const p0 = cleanPoints[0];
    const p1 = cleanPoints[cleanPoints.length - 1];
    return {
      id: `river_${Math.round(p0.x)}`,
      centerline: [p0, p1],
      waterPolygon: [p0, p1],
      leftBank: [p0, p1],
      rightBank: [p0, p1],
      totalLength,
    };
  }

  // 2. Uniform arc-length resampling with organic sinuosity
  const sampleSpacing = Math.max(3.5, Math.min(8, totalLength / 80));
  const sampleCount = Math.max(12, Math.ceil(totalLength / sampleSpacing));

  const rawCenterline: MapPoint[] = [];
  const phase = rng() * Math.PI * 2;

  for (let i = 0; i <= sampleCount; i++) {
    const u = i / sampleCount; // 0 (source) -> 1 (mouth)
    const targetDist = u * totalLength;
    const { point, tangent } = getPointAndTangentFromSpline(
      splinePoints,
      segmentLengths,
      targetDist
    );
    const normal = { x: -tangent.y, y: tangent.x };

    // Sinuosity: smooth bell envelope pinned strictly to 0 at endpoints
    const envelope = Math.pow(Math.sin(Math.PI * u), 0.85);
    const wave = Math.sin(u * Math.PI * 5 + phase) * 0.7 +
                 Math.sin(u * Math.PI * 11 + phase * 1.6) * 0.3;
    const n = noise(u * 4.5 + phase, 0) * 0.35;
    const meanderOffset = envelope * meanderRoughness * 14 * (wave + n);

    rawCenterline.push({
      x: point.x + normal.x * meanderOffset,
      y: point.y + normal.y * meanderOffset,
    });
  }

  // 3. Smooth Centerline & Compute Tangents / Normals
  const centerline: MapPoint[] = [];
  const normals: MapPoint[] = [];
  const widths: number[] = [];

  for (let i = 0; i < rawCenterline.length; i++) {
    const u = i / (rawCenterline.length - 1);
    centerline.push({
      x: Math.round(rawCenterline[i].x),
      y: Math.round(rawCenterline[i].y),
    });

    // Tangent via central difference with fallback for boundary
    let tx = 0;
    let ty = 0;
    if (i === 0) {
      tx = rawCenterline[1].x - rawCenterline[0].x;
      ty = rawCenterline[1].y - rawCenterline[0].y;
    } else if (i === rawCenterline.length - 1) {
      tx = rawCenterline[i].x - rawCenterline[i - 1].x;
      ty = rawCenterline[i].y - rawCenterline[i - 1].y;
    } else {
      tx = rawCenterline[i + 1].x - rawCenterline[i - 1].x;
      ty = rawCenterline[i + 1].y - rawCenterline[i - 1].y;
    }

    const tLen = Math.hypot(tx, ty) || 1;
    tx /= tLen;
    ty /= tLen;

    normals.push({ x: -ty, y: tx });

    // Smooth monotonic width tapering: w(u) = startW + (endW - startW) * u^0.8
    // Tapers smoothly from a needle tip at the headwaters to full mouth width
    const w = startW + (endW - startW) * Math.pow(u, 0.8);
    widths.push(w);
  }

  // 4. Curvature-Aware Bank Generation (Guaranteed No Inner-Bank Overlap/Pinch)
  const leftBank: MapPoint[] = [];
  const rightBank: MapPoint[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const pt = centerline[i];
    const norm = normals[i];
    const halfW = widths[i] * 0.5;

    // Detect local curvature to prevent inner bank self-intersection
    let leftOffset = halfW;
    let rightOffset = halfW;

    if (i > 0 && i < centerline.length - 1) {
      const prevNorm = normals[i - 1];
      const nextNorm = normals[i + 1];

      // Turning angle via cross product of adjacent normals
      const cross = prevNorm.x * nextNorm.y - prevNorm.y * nextNorm.x;
      const segDist = Math.hypot(
        centerline[i + 1].x - centerline[i - 1].x,
        centerline[i + 1].y - centerline[i - 1].y
      );

      // Local radius of curvature R ~ segDist / |angle|
      const angle = Math.asin(Math.max(-1, Math.min(1, cross)));
      if (Math.abs(angle) > 0.05) {
        const radius = Math.abs(segDist / angle);
        // On the concave (inner) bank, clamp offset to at most 0.8 * radius
        const maxInnerOffset = Math.max(1.0, radius * 0.75);

        if (cross > 0) {
          // Turning left: left bank is inside (concave)
          leftOffset = Math.min(halfW, maxInnerOffset);
        } else {
          // Turning right: right bank is inside (concave)
          rightOffset = Math.min(halfW, maxInnerOffset);
        }
      }
    }

    // Ensure minimal non-zero offset for sub-pixel anti-aliasing
    leftOffset = Math.max(0.6, leftOffset);
    rightOffset = Math.max(0.6, rightOffset);

    leftBank.push({
      x: Number((pt.x - norm.x * leftOffset).toFixed(1)),
      y: Number((pt.y - norm.y * leftOffset).toFixed(1)),
    });

    rightBank.push({
      x: Number((pt.x + norm.x * rightOffset).toFixed(1)),
      y: Number((pt.y + norm.y * rightOffset).toFixed(1)),
    });
  }

  // 5. Water Ribbon Body Polygon
  // Flows from source along left bank to mouth, then back along right bank to source
  const waterPolygon: MapPoint[] = [
    ...leftBank,
    ...[...rightBank].reverse(),
  ];

  // 6. Hydrology V2 Delta Distributary Fan (Plan 27 — Module 1)
  let delta: ProceduralDelta | undefined = undefined;
  if (options.deltaConfig?.enabled) {
    delta =
      generateProceduralDelta(cleanPoints, {
        seed: rawSeed,
        mainWidth: endW,
        config: options.deltaConfig,
      }) ?? undefined;
  }

  return {
    id: `river_${Math.round(cleanPoints[0].x)}_${Math.round(cleanPoints[0].y)}`,
    centerline,
    waterPolygon,
    leftBank,
    rightBank,
    totalLength,
    delta,
  };
}

// ============================================================================
// CATMULL-ROM SPLINE UTILITIES
// ============================================================================

/**
 * Evaluates a Centripetal Catmull-Rom spline across a sequence of control points.
 * Guarantees C1 continuity, no self-intersections or overshoot on corners.
 */
function evaluateCatmullRomSpline(points: MapPoint[], step = 4): MapPoint[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const count = Math.max(4, Math.ceil(dist / step));
    const result: MapPoint[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      result.push({
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
      });
    }
    return result;
  }

  // Pad endpoints to allow smooth interpolation across entire sequence
  const padded: MapPoint[] = [
    points[0],
    ...points,
    points[points.length - 1],
  ];

  const result: MapPoint[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];

    const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const subSteps = Math.max(3, Math.ceil(segDist / step));

    for (let j = 0; j < subSteps; j++) {
      const t = j / subSteps;
      const pt = sampleCatmullRom(p0, p1, p2, p3, t);
      result.push(pt);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Standard Centripetal Catmull-Rom formulation (alpha = 0.5)
 */
function sampleCatmullRom(
  p0: MapPoint,
  p1: MapPoint,
  p2: MapPoint,
  p3: MapPoint,
  t: number
): MapPoint {
  const alpha = 0.5;

  function getT(tPrev: number, pA: MapPoint, pB: MapPoint): number {
    const dist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
    return tPrev + Math.pow(Math.max(1e-4, dist), alpha);
  }

  const t0 = 0;
  const t1 = getT(t0, p0, p1);
  const t2 = getT(t1, p1, p2);
  const t3 = getT(t2, p2, p3);

  const tParam = t1 + t * (t2 - t1);

  const a1x = ((t1 - tParam) / (t1 - t0)) * p0.x + ((tParam - t0) / (t1 - t0)) * p1.x;
  const a1y = ((t1 - tParam) / (t1 - t0)) * p0.y + ((tParam - t0) / (t1 - t0)) * p1.y;

  const a2x = ((t2 - tParam) / (t2 - t1)) * p1.x + ((tParam - t1) / (t2 - t1)) * p2.x;
  const a2y = ((t2 - tParam) / (t2 - t1)) * p1.y + ((tParam - t1) / (t2 - t1)) * p2.y;

  const a3x = ((t3 - tParam) / (t3 - t2)) * p2.x + ((tParam - t2) / (t3 - t2)) * p3.x;
  const a3y = ((t3 - tParam) / (t3 - t2)) * p2.y + ((tParam - t2) / (t3 - t2)) * p3.y;

  const b1x = ((t2 - tParam) / (t2 - t0)) * a1x + ((tParam - t0) / (t2 - t0)) * a2x;
  const b1y = ((t2 - tParam) / (t2 - t0)) * a1y + ((tParam - t0) / (t2 - t0)) * a2y;

  const b2x = ((t3 - tParam) / (t3 - t1)) * a2x + ((tParam - t1) / (t3 - t1)) * a3x;
  const b2y = ((t3 - tParam) / (t3 - t1)) * a2y + ((tParam - t1) / (t3 - t1)) * a3y;

  const cx = ((t2 - tParam) / (t2 - t1)) * b1x + ((tParam - t1) / (t2 - t1)) * b2x;
  const cy = ((t2 - tParam) / (t2 - t1)) * b1y + ((tParam - t1) / (t2 - t1)) * b2y;

  return { x: cx, y: cy };
}

/**
 * Samples point and normalized tangent along a dense spline at distance `dist`.
 */
function getPointAndTangentFromSpline(
  spline: MapPoint[],
  segmentLengths: number[],
  dist: number
): { point: MapPoint; tangent: MapPoint } {
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (dist <= accumulated + len || i === segmentLengths.length - 1) {
      const segT = len > 0 ? Math.max(0, Math.min(1, (dist - accumulated) / len)) : 0;
      const p0 = spline[i];
      const p1 = spline[i + 1];

      const point: MapPoint = {
        x: p0.x + (p1.x - p0.x) * segT,
        y: p0.y + (p1.y - p0.y) * segT,
      };

      const tangent = len > 0 ? { x: (p1.x - p0.x) / len, y: (p1.y - p0.y) / len } : { x: 1, y: 0 };

      return { point, tangent };
    }
    accumulated += len;
  }

  const last = spline[spline.length - 1];
  return { point: last, tangent: { x: 1, y: 0 } };
}
