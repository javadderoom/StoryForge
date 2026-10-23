/**
 * Procedural River & Estuary Geometry Generator
 *
 * Implements hand-inked fantasy cartography rivers matching the
 * Faravand illuminated manuscript style (e.g. Zarvan River, Arvand River).
 *
 * Provides:
 * 1. Monotonic width tapering from headwaters (narrow spring) to mouth/estuary.
 * 2. Organic meander sinuosity using harmonic spline perturbations.
 * 3. Dual-bank coordinates for crisp outer dark-ink shoreline outlines.
 * 4. Solid water ribbon polygon for translucent aqua wash fills.
 * 5. Braided delta estuary channels with sandbar islands at the ocean/lake outlet.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface DeltaBranch {
  waterPolygon: MapPoint[];
  leftBank: MapPoint[];
  rightBank: MapPoint[];
}

export interface ProceduralRiver {
  id: string;
  centerline: MapPoint[];
  waterPolygon: MapPoint[];
  leftBank: MapPoint[];
  rightBank: MapPoint[];
  deltaBranches?: DeltaBranch[];
  sandbarIslands?: MapPoint[][];
  totalLength: number;
}

export interface RiverOptions {
  seed?: number;
  startWidth?: number; // Width at headwaters in pixels (default: 2.0)
  endWidth?: number; // Width at mouth/estuary in pixels (default: 9.0)
  meanderRoughness?: number; // Sinuosity factor 0..1 (default: 0.35)
  enableDelta?: boolean; // Generate braided estuary mouth (default: true if length >= 80)
}

/**
 * Generates a tapered, organically meandered procedural river from an authored polyline.
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

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const startW = Math.max(1.0, Math.min(10, options.startWidth ?? 2.0));
  const endW = Math.max(startW, Math.min(30, options.endWidth ?? 9.0));
  const meanderRoughness = Math.max(0, Math.min(1, options.meanderRoughness ?? 0.35));

  // 1. Calculate cumulative segment lengths
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength < 10) {
    // Degenerate short river: simple stroked path
    const p0 = points[0];
    const p1 = points[points.length - 1];
    return {
      id: `river_${Math.round(p0.x)}`,
      centerline: [p0, p1],
      waterPolygon: [p0, p1],
      leftBank: [p0, p1],
      rightBank: [p0, p1],
      totalLength,
    };
  }

  // 2. Dense resampling along the path (step ~ 5px)
  const stepSize = Math.max(4, Math.min(10, totalLength / 60));
  const sampleCount = Math.max(10, Math.ceil(totalLength / stepSize));

  const centerline: MapPoint[] = [];
  const leftBank: MapPoint[] = [];
  const rightBank: MapPoint[] = [];

  const phase = rng() * Math.PI * 2;
  const enableDelta = options.enableDelta ?? totalLength >= 80;
  // If delta is active, the main trunk transitions to delta branches at u >= 0.85
  const deltaStartU = enableDelta ? 0.86 : 1.0;

  for (let i = 0; i <= sampleCount; i++) {
    const u = i / sampleCount; // Normalized 0..1 from headwaters to mouth
    const targetDist = u * totalLength;

    const { point, tangent } = getPointAndTangent(points, segmentLengths, targetDist);
    const normal = { x: -tangent.y, y: tangent.x };

    // Organic Sinuosity Perturbation:
    // Tapered envelope keeps the origin and destination locked to authored points
    const envelope = Math.pow(Math.sin(Math.PI * u), 0.75);
    const wave1 = Math.sin(u * Math.PI * 4 + phase);
    const wave2 = Math.sin(u * Math.PI * 9 + phase * 1.5) * 0.5;
    const n = noise(u * 5 + phase, 0) * 0.4;
    const meanderDist = envelope * meanderRoughness * 18 * (wave1 + wave2 + n);

    const perturbedX = point.x + normal.x * meanderDist;
    const perturbedY = point.y + normal.y * meanderDist;
    const centerPt: MapPoint = {
      x: Math.round(perturbedX),
      y: Math.round(perturbedY),
    };
    centerline.push(centerPt);

    // Monotonic width tapering formula: w(u) = startW + (endW - startW) * u^0.75
    const currentWidth = startW + (endW - startW) * Math.pow(u, 0.75);
    const halfW = currentWidth * 0.5;

    leftBank.push({
      x: Math.round(perturbedX - normal.x * halfW),
      y: Math.round(perturbedY - normal.y * halfW),
    });

    rightBank.push({
      x: Math.round(perturbedX + normal.x * halfW),
      y: Math.round(perturbedY + normal.y * halfW),
    });
  }

  // Closed water body polygon: from headwaters along left bank, then back along right bank
  const waterPolygon: MapPoint[] = [
    ...leftBank,
    ...[...rightBank].reverse(),
  ];

  // 3. Braided Delta Estuary & Sandbars at terminus
  let deltaBranches: DeltaBranch[] | undefined;
  let sandbarIslands: MapPoint[][] | undefined;

  if (enableDelta && centerline.length >= 8) {
    const deltaIdx = Math.floor(centerline.length * deltaStartU);
    const originPt = centerline[deltaIdx];
    const endPt = centerline[centerline.length - 1];

    const dx = endPt.x - originPt.x;
    const dy = endPt.y - originPt.y;
    const deltaLen = Math.hypot(dx, dy);

    if (deltaLen > 15) {
      const deltaTang = { x: dx / deltaLen, y: dy / deltaLen };
      const deltaNorm = { x: -deltaTang.y, y: deltaTang.x };

      // Left branch
      const leftEnd: MapPoint = {
        x: Math.round(endPt.x + deltaNorm.x * (endW * 0.85) + deltaTang.x * 5),
        y: Math.round(endPt.y + deltaNorm.y * (endW * 0.85) + deltaTang.y * 5),
      };
      const leftBranchLeft = [originPt, leftEnd];
      const leftBranchRight = [
        originPt,
        {
          x: Math.round(leftEnd.x - deltaNorm.x * (endW * 0.4)),
          y: Math.round(leftEnd.y - deltaNorm.y * (endW * 0.4)),
        },
      ];

      // Right branch
      const rightEnd: MapPoint = {
        x: Math.round(endPt.x - deltaNorm.x * (endW * 0.85) + deltaTang.x * 5),
        y: Math.round(endPt.y - deltaNorm.y * (endW * 0.85) + deltaTang.y * 5),
      };
      const rightBranchRight = [originPt, rightEnd];
      const rightBranchLeft = [
        originPt,
        {
          x: Math.round(rightEnd.x + deltaNorm.x * (endW * 0.4)),
          y: Math.round(rightEnd.y + deltaNorm.y * (endW * 0.4)),
        },
      ];

      deltaBranches = [
        {
          waterPolygon: [...leftBranchLeft, ...[...leftBranchRight].reverse()],
          leftBank: leftBranchLeft,
          rightBank: leftBranchRight,
        },
        {
          waterPolygon: [...rightBranchLeft, ...[...rightBranchRight].reverse()],
          leftBank: rightBranchLeft,
          rightBank: rightBranchRight,
        },
      ];

      // Central sandbar teardrop islet
      const islandCenter: MapPoint = {
        x: Math.round(originPt.x + deltaTang.x * (deltaLen * 0.55)),
        y: Math.round(originPt.y + deltaTang.y * (deltaLen * 0.55)),
      };
      const islandLen = deltaLen * 0.35;
      const islandW = endW * 0.3;

      sandbarIslands = [
        [
          { x: Math.round(islandCenter.x - deltaTang.x * islandLen * 0.5), y: Math.round(islandCenter.y - deltaTang.y * islandLen * 0.5) },
          { x: Math.round(islandCenter.x + deltaNorm.x * islandW), y: Math.round(islandCenter.y + deltaNorm.y * islandW) },
          { x: Math.round(islandCenter.x + deltaTang.x * islandLen * 0.5), y: Math.round(islandCenter.y + deltaTang.y * islandLen * 0.5) },
          { x: Math.round(islandCenter.x - deltaNorm.x * islandW), y: Math.round(islandCenter.y - deltaNorm.y * islandW) },
        ],
      ];
    }
  }

  return {
    id: `river_${Math.round(points[0].x)}_${Math.round(points[0].y)}`,
    centerline,
    waterPolygon,
    leftBank,
    rightBank,
    deltaBranches,
    sandbarIslands,
    totalLength,
  };
}

/**
 * Interpolates point and normalized tangent along a polyline at target distance.
 */
function getPointAndTangent(
  points: MapPoint[],
  segmentLengths: number[],
  dist: number
): { point: MapPoint; tangent: MapPoint } {
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (dist <= accumulated + len || i === segmentLengths.length - 1) {
      const segT = len > 0 ? Math.max(0, Math.min(1, (dist - accumulated) / len)) : 0;
      const p0 = points[i];
      const p1 = points[i + 1];

      const point: MapPoint = {
        x: p0.x + (p1.x - p0.x) * segT,
        y: p0.y + (p1.y - p0.y) * segT,
      };

      const tangent = len > 0 ? { x: (p1.x - p0.x) / len, y: (p1.y - p0.y) / len } : { x: 1, y: 0 };

      return { point, tangent };
    }
    accumulated += len;
  }

  const lastIdx = points.length - 1;
  return {
    point: points[lastIdx],
    tangent: { x: 1, y: 0 },
  };
}
