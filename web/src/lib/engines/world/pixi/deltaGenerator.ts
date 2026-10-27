/**
 * deltaGenerator.ts
 *
 * Hydrology V2 — Hierarchical Alluvial Delta Archipelago & Braided Estuary
 *
 * Recreates authentic fantasy manuscript deltas matching the reference:
 * - 2-Stage Hierarchical Bifurcation: Trunk splits smoothly into 2 primary arms,
 *   which each bifurcate into secondary distributaries and braided anastomoses.
 * - Organic Sinuous Meanders: Flowing Catmull-Rom splines modulated by continuous noise
 *   (no straight radial spoke rays).
 * - Alluvial Archipelago & Barrier Islets:
 *   * Shield-shaped Central Island between the primary arms.
 *   * Sinuous flanking peninsular lobes between secondary channels.
 *   * 4–8 discrete rounded offshore barrier islets scattered in the coastal bay.
 * - Lush Delta Forest Canopy: Dense green woodland tree groves and canopy lobes
 *   covering the islands, matching the lush delta vegetation in the reference.
 */

import type { MapPoint, RiverDeltaConfig } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface DistributaryBranch {
  id: string;
  order: number; // 0 = main thoroughfare, 1 = primary fork, 2 = secondary, 3 = cross-braid
  centerline: MapPoint[];
  leftBank: MapPoint[];
  rightBank: MapPoint[];
  waterPolygon: MapPoint[];
  startWidth: number;
  endWidth: number;
}

export interface DeltaTreeLobe {
  center: MapPoint;
  radius: number;
  shade: number; // 0..1 tone variation
}

export interface DeltaIsland {
  id: string;
  kind: 'central' | 'lobe' | 'islet';
  polygon: MapPoint[];
  hatchLines: [MapPoint, MapPoint][];
  center: MapPoint;
  trees: DeltaTreeLobe[];
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
function evaluateSpline(points: MapPoint[], step = 3.5): MapPoint[] {
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

    // Smooth width progression
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
 * Generates an organic rounded closed polygon (e.g. for an island or islet)
 * from a center coordinate, base radius, aspect ratio, and noise.
 */
function createOrganicIsland(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  angleRad: number,
  vertexCount: number,
  noiseFn: (x: number, y: number) => number,
  noiseOffset: number
): MapPoint[] {
  const points: MapPoint[] = [];
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  for (let i = 0; i < vertexCount; i++) {
    const theta = (i * 2 * Math.PI) / vertexCount;
    // Harmonic noise for soft lobed organic perimeter
    const n = noiseFn(Math.cos(theta) * 1.5 + noiseOffset, Math.sin(theta) * 1.5 + noiseOffset);
    const radMod = 1.0 + n * 0.28;

    const lx = Math.cos(theta) * rx * radMod;
    const ly = Math.sin(theta) * ry * radMod;

    // Rotate by flow angle
    const gx = cx + lx * cosA - ly * sinA;
    const gy = cy + lx * sinA + ly * cosA;

    points.push({
      x: Number(gx.toFixed(1)),
      y: Number(gy.toFixed(1)),
    });
  }

  // Smooth with spline to ensure C1 continuity
  return evaluateSpline([...points, points[0]], 3.0);
}

/**
 * Stems dense tree canopy cluster positions within an island polygon.
 */
function populateIslandTrees(
  polygon: MapPoint[],
  densityCount: number,
  rng: () => number
): DeltaTreeLobe[] {
  if (polygon.length < 3 || densityCount <= 0) return [];

  // Compute bounding box
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 8 || h < 8) return [];

  // Point in polygon test
  const isInside = (x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const trees: DeltaTreeLobe[] = [];
  const maxAttempts = densityCount * 4;
  let attempts = 0;

  while (trees.length < densityCount && attempts < maxAttempts) {
    attempts++;
    // Inset slightly from perimeter
    const px = minX + 0.15 * w + rng() * 0.7 * w;
    const py = minY + 0.15 * h + rng() * 0.7 * h;

    if (isInside(px, py)) {
      trees.push({
        center: { x: Number(px.toFixed(1)), y: Number(py.toFixed(1)) },
        radius: 6.5 + rng() * 5.5, // 6.5 - 12px tree crowns
        shade: rng(),
      });
    }
  }

  return trees;
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

  const mainWidth = Math.max(4, options.mainWidth ?? 14.0);
  const apexFraction = Math.max(0.68, Math.min(0.92, config?.apexFraction ?? 0.80));
  const spreadDegrees = Math.max(25, Math.min(80, config?.spreadAngleDegrees ?? 52));
  const fanSpreadRad = (spreadDegrees * Math.PI) / 180;
  const requestedBranches = Math.max(2, Math.min(6, config?.distributariesCount ?? 4));
  const showTrees = config?.showVegetation !== false;

  // 1. Spline Densification of the full river path
  const spline = evaluateSpline(cleanPoints, 3.5);
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < spline.length - 1; i++) {
    const d = Math.hypot(spline[i + 1].x - spline[i].x, spline[i + 1].y - spline[i].y);
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength < 24) return null; // River too short for delta

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

  // Normal to overall flow direction
  const normX = -Math.sin(baseAngle);
  const normY = Math.cos(baseAngle);
  const fwdX = Math.cos(baseAngle);
  const fwdY = Math.sin(baseAngle);

  // 4. Hierarchical 2-Stage Bifurcation Network
  // Instead of all branches shooting straight from the apex:
  // - Trunk divides at Apex into Primary Left and Primary Right arms (at ~35% delta span)
  // - Left & Right arms then each bifurcate into secondary distributaries
  const midDist = deltaSpan * 0.44;

  const branches: DistributaryBranch[] = [];

  // Generate N distributary channels flowing naturally towards the sea
  const numBranches = requestedBranches;

  // Discharge distribution: central streams are wider than lateral outer streams
  const rawDischarges: number[] = [];
  let totalDischarge = 0;
  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1);
    const centerDist = Math.abs(v - 0.5) * 2; // 0 (center) to 1 (outer)
    const q = Math.exp(-1.4 * centerDist * centerDist);
    rawDischarges.push(q);
    totalDischarge += q;
  }

  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1); // 0 (leftmost) to 1 (rightmost)

    // Angular deviation from base flow
    const fanAngle = -fanSpreadRad * 0.5 + v * fanSpreadRad;
    const finalAngle = baseAngle + fanAngle;

    // Intermediate bifurcation waypoint
    // Channels diverge from apex towards their respective left/right primary corridors
    const sideSign = v < 0.5 ? -1 : 1;
    const primaryDivergence = Math.abs(v - 0.5) * 1.6;
    const midLat = sideSign * (midDist * Math.tan(fanSpreadRad * 0.28) * primaryDivergence);
    const midNoise = noise(k * 3.7 + rawSeed * 0.1, 0.4) * 8.0;

    const midPt: MapPoint = {
      x: apexPoint.x + fwdX * midDist + normX * (midLat + midNoise),
      y: apexPoint.y + fwdY * midDist + normY * (midLat + midNoise),
    };

    // Estuary Mouth Terminus: slightly staggered natural distance
    const spanVariation = 1.0 + 0.14 * (1 - Math.abs(v - 0.5) * 1.5) + (rng() - 0.5) * 0.08;
    const branchLen = deltaSpan * spanVariation;

    const termNoise = noise(k * 2.1 + 10.0, rawSeed * 0.2) * 6.0;
    const mouthPt: MapPoint = {
      x: apexPoint.x + Math.cos(finalAngle) * branchLen + normX * termNoise,
      y: apexPoint.y + Math.sin(finalAngle) * branchLen + normY * termNoise,
    };

    // 4-point natural meandering spline: Apex -> Intermediate 1 -> Intermediate 2 -> Mouth
    const intermediate2: MapPoint = {
      x: (midPt.x + mouthPt.x) * 0.5 + normX * (noise(k * 5.1, 0.8) * 7.0),
      y: (midPt.y + mouthPt.y) * 0.5 + normY * (noise(k * 5.1, 0.8) * 7.0),
    };

    const bSpline = evaluateSpline([apexPoint, midPt, intermediate2, mouthPt], 3.0);

    // Discharge-weighted width: central channels carry more volume
    const dischargeShare = rawDischarges[k] / totalDischarge;
    const bStartW = Math.max(2.4, mainWidth * dischargeShare * 1.7);
    // At the mouth, channels organically flare open into the sea (just like the reference!)
    const bEndW = Math.max(2.0, bStartW * 0.85 + (rng() - 0.5) * 1.2);

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

  // 5. Alluvial Archipelago & Islands (Matching the reference aesthetic)
  const islands: DeltaIsland[] = [];

  // A. Central Delta Island:
  // Located between the inner main arms in the upper/mid delta
  const centralIslandWidth = deltaSpan * 0.24;
  const centralIslandLength = deltaSpan * 0.40;
  const centralIslandCenter: MapPoint = {
    x: apexPoint.x + fwdX * (deltaSpan * 0.38) + normX * (noise(rawSeed, 0.1) * 4.0),
    y: apexPoint.y + fwdY * (deltaSpan * 0.38) + normY * (noise(rawSeed, 0.1) * 4.0),
  };

  const centralPoly = createOrganicIsland(
    centralIslandCenter.x,
    centralIslandCenter.y,
    centralIslandLength * 0.5,
    centralIslandWidth * 0.5,
    baseAngle,
    14,
    noise,
    rawSeed * 0.3
  );

  const centralTrees = showTrees ? populateIslandTrees(centralPoly, 9, rng) : [];

  islands.push({
    id: 'delta_island_central',
    kind: 'central',
    polygon: centralPoly,
    hatchLines: [],
    center: centralIslandCenter,
    trees: centralTrees,
  });

  // B. Flanking Peninsulas / Lobes (between adjacent distributaries):
  for (let k = 0; k < numBranches - 1; k++) {
    const leftBranch = branches[k];
    const rightBranch = branches[k + 1];

    const leftBank = leftBranch.rightBank;
    const rightBank = rightBranch.leftBank;

    const minLen = Math.min(leftBank.length, rightBank.length);
    if (minLen < 10) continue;

    // Sample from 45% down to 88% near mouth
    const startIndex = Math.floor(minLen * 0.45);
    const endIndex = Math.floor(minLen * 0.88);

    if (endIndex <= startIndex + 3) continue;

    // Average center
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let i = startIndex; i <= endIndex; i += 2) {
      sumX += (leftBank[i].x + rightBank[i].x) * 0.5;
      sumY += (leftBank[i].y + rightBank[i].y) * 0.5;
      count++;
    }
    const lobeCenter: MapPoint = { x: sumX / count, y: sumY / count };

    // Form an organic elongated lobe between the two channels
    const lobeDist = Math.hypot(
      leftBank[endIndex].x - leftBank[startIndex].x,
      leftBank[endIndex].y - leftBank[startIndex].y
    );
    const lobeW = Math.max(
      6,
      Math.hypot(
        rightBank[Math.floor((startIndex + endIndex) / 2)].x -
          leftBank[Math.floor((startIndex + endIndex) / 2)].x,
        rightBank[Math.floor((startIndex + endIndex) / 2)].y -
          leftBank[Math.floor((startIndex + endIndex) / 2)].y
      ) * 0.42
    );

    const lobePoly = createOrganicIsland(
      lobeCenter.x,
      lobeCenter.y,
      lobeDist * 0.42,
      lobeW,
      baseAngle,
      12,
      noise,
      k * 4.7 + rawSeed
    );

    const lobeTrees = showTrees ? populateIslandTrees(lobePoly, 5, rng) : [];

    islands.push({
      id: `delta_island_lobe_${k}`,
      kind: 'lobe',
      polygon: lobePoly,
      hatchLines: [],
      center: lobeCenter,
      trees: lobeTrees,
    });
  }

  // C. Discrete Barrier Islets (Offshore Delta Shoals):
  // 5 to 7 rounded islands scattered just beyond the river mouths into the bay,
  // matching the reference map's barrier island chain!
  const isletCount = 6;
  for (let m = 0; m < isletCount; m++) {
    const u = (m + 0.5) / isletCount; // 0..1 across the delta fan
    const angle = baseAngle - fanSpreadRad * 0.46 + u * fanSpreadRad * 0.92;

    // Distances staggered in the shallow bay (1.02 to 1.22 of delta span)
    const distFactor = 1.02 + 0.18 * Math.sin(u * Math.PI) + (rng() - 0.5) * 0.08;
    const isletDist = deltaSpan * distFactor;

    const ix = apexPoint.x + Math.cos(angle) * isletDist;
    const iy = apexPoint.y + Math.sin(angle) * isletDist;

    const rBase = 8.0 + rng() * 11.0; // 8 - 19px radius
    const aspect = 0.8 + rng() * 0.5;

    const isletPoly = createOrganicIsland(
      ix,
      iy,
      rBase,
      rBase * aspect,
      baseAngle + (rng() - 0.5) * 0.5,
      10,
      noise,
      m * 7.3 + rawSeed * 0.5
    );

    const isletTrees = showTrees ? populateIslandTrees(isletPoly, rBase > 12 ? 3 : 1, rng) : [];

    islands.push({
      id: `delta_islet_${m}`,
      kind: 'islet',
      polygon: isletPoly,
      hatchLines: [],
      center: { x: ix, y: iy },
      trees: isletTrees,
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
