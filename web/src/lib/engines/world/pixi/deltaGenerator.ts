/**
 * deltaGenerator.ts
 *
 * Hydrology V2 — River Deltas & Distributaries (Plan 27 — Module 1)
 *
 * Generates natural branching distributary fans and alluvial sediment islands
 * for river mouths emptying into coastal waters or terminal lakes:
 * - Identifies delta apex along the lower course of the river.
 * - Spawns a fan of distributary streams with organic sinuosity and discharge-weighted width.
 * - Synthesizes alluvial silt/sandbar islands in the inter-channel voids.
 * - Embellishes islands with subtle manuscript silt hatching.
 */

import type { MapPoint, RiverDeltaConfig } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface DistributaryBranch {
  id: string;
  order: number; // 0 = main channel, 1 = secondary
  centerline: MapPoint[];
  leftBank: MapPoint[];
  rightBank: MapPoint[];
  waterPolygon: MapPoint[];
  startWidth: number;
  endWidth: number;
}

export interface DeltaIsland {
  id: string;
  polygon: MapPoint[];
  hatchLines: [MapPoint, MapPoint][];
  center: MapPoint;
}

export interface ProceduralDelta {
  riverId: string;
  apexPoint: MapPoint;
  apexFraction: number;
  trunkCenterline: MapPoint[];
  trunkLeftBank: MapPoint[];
  trunkRightBank: MapPoint[];
  trunkWaterPolygon: MapPoint[];
  branches: DistributaryBranch[];
  islands: DeltaIsland[];
}

export interface DeltaOptions {
  seed?: number;
  mainWidth?: number; // Main river width at apex (default: 14)
  config?: RiverDeltaConfig;
}

/**
 * Evaluates Catmull-Rom spline point at parameter t (0..1) between p1 and p2.
 */
function sampleCatmullRom(
  p0: MapPoint,
  p1: MapPoint,
  p2: MapPoint,
  p3: MapPoint,
  t: number
): MapPoint {
  const t2 = t * t;
  const t3 = t2 * t;

  const f0 = -0.5 * t3 + t2 - 0.5 * t;
  const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f3 = 0.5 * t3 - 0.5 * t2;

  return {
    x: p0.x * f0 + p1.x * f1 + p2.x * f2 + p3.x * f3,
    y: p0.y * f0 + p1.y * f1 + p2.y * f2 + p3.y * f3,
  };
}

/**
 * Subdivides a polyline into dense Catmull-Rom spline points.
 */
function evaluateSpline(points: MapPoint[], step = 4): MapPoint[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const count = Math.max(4, Math.ceil(dist / step));
    const res: MapPoint[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      res.push({
        x: p0.x + (p1.x - p0.x) * t,
        y: p0.y + (p1.y - p0.y) * t,
      });
    }
    return res;
  }

  const padded: MapPoint[] = [points[0], ...points, points[points.length - 1]];
  const result: MapPoint[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];
    const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const count = Math.max(3, Math.ceil(segDist / step));
    for (let j = 0; j < count; j++) {
      result.push(sampleCatmullRom(p0, p1, p2, p3, j / count));
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Resamples polyline at a specific arc-length distance.
 */
function getPointAtArcLength(
  points: MapPoint[],
  lengths: number[],
  target: number
): { point: MapPoint; tangent: MapPoint; index: number } {
  if (target <= 0) {
    const tx = points[1].x - points[0].x;
    const ty = points[1].y - points[0].y;
    const len = Math.hypot(tx, ty) || 1;
    return { point: points[0], tangent: { x: tx / len, y: ty / len }, index: 0 };
  }

  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    const seg = lengths[i];
    if (acc + seg >= target || i === lengths.length - 1) {
      const rem = target - acc;
      const t = seg > 1e-6 ? Math.max(0, Math.min(1, rem / seg)) : 0;
      const a = points[i];
      const b = points[i + 1];
      const pt: MapPoint = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { point: pt, tangent: { x: dx / len, y: dy / len }, index: i };
    }
    acc += seg;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  return { point: last, tangent: { x: dx / len, y: dy / len }, index: points.length - 1 };
}

/**
 * Computes curvature-aware left and right banks for a river channel.
 */
function generateChannelBanks(
  centerline: MapPoint[],
  startWidth: number,
  endWidth: number
): { leftBank: MapPoint[]; rightBank: MapPoint[]; waterPolygon: MapPoint[] } {
  if (centerline.length < 2) {
    return { leftBank: centerline, rightBank: centerline, waterPolygon: [] };
  }

  const normals: MapPoint[] = [];
  const widths: number[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const u = i / (centerline.length - 1);
    let tx = 0;
    let ty = 0;
    if (i === 0) {
      tx = centerline[1].x - centerline[0].x;
      ty = centerline[1].y - centerline[0].y;
    } else if (i === centerline.length - 1) {
      tx = centerline[i].x - centerline[i - 1].x;
      ty = centerline[i].y - centerline[i - 1].y;
    } else {
      tx = centerline[i + 1].x - centerline[i - 1].x;
      ty = centerline[i + 1].y - centerline[i - 1].y;
    }
    const len = Math.hypot(tx, ty) || 1;
    normals.push({ x: -ty / len, y: tx / len });

    const w = startWidth + (endWidth - startWidth) * Math.pow(u, 0.85);
    widths.push(w);
  }

  const leftBank: MapPoint[] = [];
  const rightBank: MapPoint[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const pt = centerline[i];
    const n = normals[i];
    const halfW = widths[i] * 0.5;

    leftBank.push({
      x: Number((pt.x - n.x * halfW).toFixed(1)),
      y: Number((pt.y - n.y * halfW).toFixed(1)),
    });
    rightBank.push({
      x: Number((pt.x + n.x * halfW).toFixed(1)),
      y: Number((pt.y + n.y * halfW).toFixed(1)),
    });
  }

  const waterPolygon: MapPoint[] = [...leftBank, ...[...rightBank].reverse()];
  return { leftBank, rightBank, waterPolygon };
}

/**
 * Generates procedural river delta branching fan and alluvial islands.
 */
export function generateProceduralDelta(
  cleanPoints: MapPoint[],
  options: DeltaOptions = {}
): ProceduralDelta | null {
  if (!cleanPoints || cleanPoints.length < 2) return null;

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);
  const config = options.config;

  const mainWidth = Math.max(4, options.mainWidth ?? 12.0);
  const apexFraction = Math.max(0.65, Math.min(0.92, config?.apexFraction ?? 0.80));
  const spreadDegrees = Math.max(25, Math.min(80, config?.spreadAngleDegrees ?? 48));
  const fanSpreadRad = (spreadDegrees * Math.PI) / 180;
  const numBranches = Math.max(2, Math.min(6, config?.distributariesCount ?? 4));

  // 1. Catmull-Rom Spline Densification of the full river path
  const spline = evaluateSpline(cleanPoints, 3.5);
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < spline.length - 1; i++) {
    const d = Math.hypot(spline[i + 1].x - spline[i].x, spline[i + 1].y - spline[i].y);
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength < 24) return null; // River too short for realistic delta fan

  // 2. Identify Delta Apex
  const apexDist = totalLength * apexFraction;
  const { point: apexPoint, tangent: apexTangent } = getPointAtArcLength(
    spline,
    segmentLengths,
    apexDist
  );

  const mouthPoint = spline[spline.length - 1];
  const deltaVectorX = mouthPoint.x - apexPoint.x;
  const deltaVectorY = mouthPoint.y - apexPoint.y;
  const deltaSpan = Math.hypot(deltaVectorX, deltaVectorY);

  if (deltaSpan < 10) return null;

  const baseAngle = Math.atan2(deltaVectorY, deltaVectorX);

  // 3. Trunk River (from Source up to Apex)
  const trunkPoints: MapPoint[] = [];
  let acc = 0;
  for (let i = 0; i < spline.length; i++) {
    trunkPoints.push(spline[i]);
    if (i < segmentLengths.length) {
      acc += segmentLengths[i];
      if (acc >= apexDist) break;
    }
  }
  trunkPoints.push(apexPoint);

  const trunk = generateChannelBanks(trunkPoints, 1.2, mainWidth);

  // 4. Distributary Branches
  // Calculate relative discharge: central branches carry more volume
  const rawDischarges: number[] = [];
  let totalDischarge = 0;
  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1); // 0..1
    const centerDist = Math.abs(v - 0.5) * 2; // 0 (center) to 1 (outer)
    const q = Math.exp(-1.4 * centerDist * centerDist);
    rawDischarges.push(q);
    totalDischarge += q;
  }

  const branches: DistributaryBranch[] = [];

  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1);
    const branchAngleOffset = -fanSpreadRad / 2 + v * fanSpreadRad;
    const branchHeading = baseAngle + branchAngleOffset;

    // Length variation: slight natural organic curvature
    const lenFactor = 1.0 + 0.12 * (1 - Math.abs(v - 0.5) * 2) + (rng() - 0.5) * 0.1;
    const branchLen = deltaSpan * lenFactor;

    const bMouth: MapPoint = {
      x: apexPoint.x + Math.cos(branchHeading) * branchLen,
      y: apexPoint.y + Math.sin(branchHeading) * branchLen,
    };

    // Organic mid-point meander
    const midX = (apexPoint.x + bMouth.x) / 2;
    const midY = (apexPoint.y + bMouth.y) / 2;
    const normX = -Math.sin(branchHeading);
    const normY = Math.cos(branchHeading);
    const lateralNoise = noise(k * 2.3 + rawSeed * 0.1, 0.5) * 8.0;

    const bMid: MapPoint = {
      x: midX + normX * lateralNoise,
      y: midY + normY * lateralNoise,
    };

    // Discretize branch centerline
    const bSpline = evaluateSpline([apexPoint, bMid, bMouth], 3.0);

    // Calculate branch width from discharge share
    const dischargeShare = rawDischarges[k] / totalDischarge;
    const bStartW = Math.max(1.8, mainWidth * dischargeShare * 1.6);
    const bEndW = Math.max(1.2, Math.min(8.0, bStartW * 0.65));

    const { leftBank, rightBank, waterPolygon } = generateChannelBanks(bSpline, bStartW, bEndW);

    branches.push({
      id: `distributary_${k}`,
      order: k === Math.floor(numBranches / 2) ? 0 : 1,
      centerline: bSpline,
      leftBank,
      rightBank,
      waterPolygon,
      startWidth: bStartW,
      endWidth: bEndW,
    });
  }

  // 5. Alluvial Sediment Islands (Delta Bars) between adjacent branches
  const islands: DeltaIsland[] = [];

  for (let k = 0; k < numBranches - 1; k++) {
    const leftBranch = branches[k];
    const rightBranch = branches[k + 1];

    const leftBankLine = leftBranch.rightBank; // Right bank of left channel
    const rightBankLine = rightBranch.leftBank; // Left bank of right channel

    const minLen = Math.min(leftBankLine.length, rightBankLine.length);
    if (minLen < 6) continue;

    // Build closed perimeter:
    // Start slightly below apex tip (say 18% along branch) out to 90% near mouth
    const startIndex = Math.max(1, Math.floor(minLen * 0.18));
    const endIndex = Math.min(minLen - 1, Math.floor(minLen * 0.90));

    if (endIndex <= startIndex + 2) continue;

    const islandPoly: MapPoint[] = [];

    // Traverse downstream along right channel's left bank
    for (let i = startIndex; i <= endIndex; i++) {
      islandPoly.push(rightBankLine[i]);
    }

    // Traverse upstream along left channel's right bank
    for (let i = endIndex; i >= startIndex; i--) {
      islandPoly.push(leftBankLine[i]);
    }

    // Check island width / area
    let minGap = Number.POSITIVE_INFINITY;
    let maxGap = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      const gap = Math.hypot(
        rightBankLine[i].x - leftBankLine[i].x,
        rightBankLine[i].y - leftBankLine[i].y
      );
      if (gap < minGap) minGap = gap;
      if (gap > maxGap) maxGap = gap;
    }

    if (maxGap < 4.5 || islandPoly.length < 4) continue;

    // Island centroid
    let sumX = 0;
    let sumY = 0;
    for (const p of islandPoly) {
      sumX += p.x;
      sumY += p.y;
    }
    const center: MapPoint = {
      x: sumX / islandPoly.length,
      y: sumY / islandPoly.length,
    };

    // Interior silt hatch lines
    const hatchLines: [MapPoint, MapPoint][] = [];
    const hatchStep = Math.max(3, Math.floor((endIndex - startIndex) / 4));
    for (let i = startIndex + 1; i < endIndex; i += hatchStep) {
      const pL = leftBankLine[i];
      const pR = rightBankLine[i];
      // Draw transverse silt line inside island
      const hA: MapPoint = {
        x: pL.x + (pR.x - pL.x) * 0.25,
        y: pL.y + (pR.y - pL.y) * 0.25,
      };
      const hB: MapPoint = {
        x: pL.x + (pR.x - pL.x) * 0.75,
        y: pL.y + (pR.y - pL.y) * 0.75,
      };
      hatchLines.push([hA, hB]);
    }

    islands.push({
      id: `delta_island_${k}`,
      polygon: islandPoly,
      hatchLines,
      center,
    });
  }

  return {
    riverId: `delta_${Math.round(apexPoint.x)}_${Math.round(apexPoint.y)}`,
    apexPoint,
    apexFraction,
    trunkCenterline: trunkPoints,
    trunkLeftBank: trunk.leftBank,
    trunkRightBank: trunk.rightBank,
    trunkWaterPolygon: trunk.waterPolygon,
    branches,
    islands,
  };
}
