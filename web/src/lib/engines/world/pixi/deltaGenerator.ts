/**
 * deltaGenerator.ts
 *
 * Hydrology V2 — Alluvial Delta Archipelago & Braided Estuary
 *
 * A delta is drawn as a fork of channels with land *between* them, which is the
 * opposite of the earlier "fan of water with islands floating in it":
 * - Distributaries leave from across the trunk mouth (never one shared apex
 *   point, which produced a starburst of ink) and diverge on sinuous splines.
 * - Channels narrow toward the sea and flare again at their mouths as the
 *   current slows and drops its sediment.
 * - Islands are cut from the gaps between facing channel banks, so they always
 *   fit, never float over open water, and taper to points at both ends.
 * - Silt hatches and small tree crowns live inside the islands; the water,
 *   shoreline and canopy are composed by the renderer in that order.
 *
 * `buildDeltaWaterRings` / `buildDeltaShorelineRuns` expose the composed water
 * body and its open-ended coastline so the renderer can ink the delta once
 * instead of drawing every bank twice.
 */

import type { MapPoint, RiverDeltaConfig } from '@/lib/types';
import polygonClipping, {
  type MultiPolygon as GeoMultiPolygon,
  type Polygon as GeoPolygon,
  type Ring as GeoRing,
} from 'polygon-clipping';
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

/** Even-odd point-in-polygon test shared by trees, hatches and islets. */
function pointInPolygon(polygon: MapPoint[], x: number, y: number): boolean {
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
}

function polygonBounds(polygon: MapPoint[]) {
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
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/** Shortest distance from a point to the polygon outline. */
function distanceToPolygonEdge(polygon: MapPoint[], x: number, y: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ax = polygon[j].x;
    const ay = polygon[j].y;
    const bx = polygon[i].x;
    const by = polygon[i].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Stems tree canopy lobes. Crowns are small and must clear the island outline
 * by their own radius, so a grove reads as woodland on a manuscript map
 * instead of circles spilling into the channels.
 */
function populateIslandTrees(
  polygon: MapPoint[],
  densityCount: number,
  rng: () => number
): DeltaTreeLobe[] {
  if (polygon.length < 3 || densityCount <= 0) return [];

  const { minX, minY, w, h } = polygonBounds(polygon);
  if (w < 5 || h < 5) return [];

  const trees: DeltaTreeLobe[] = [];
  const maxAttempts = densityCount * 24;
  let attempts = 0;

  while (trees.length < densityCount && attempts < maxAttempts) {
    attempts++;
    const px = minX + 0.12 * w + rng() * 0.76 * w;
    const py = minY + 0.12 * h + rng() * 0.76 * h;

    if (!pointInPolygon(polygon, px, py)) continue;

    const radius = 1.7 + rng() * 1.3; // 1.7 - 3.0px crowns
    const clearance = distanceToPolygonEdge(polygon, px, py);
    if (clearance < radius + 0.35) continue;
    // Grove density: crowns may just touch, but never merge into a blob.
    const minGap = radius + 1.15;
    if (
      trees.some(
        (t) => Math.hypot(t.center.x - px, t.center.y - py) < minGap + t.radius * 0.5
      )
    ) {
      continue;
    }

    trees.push({
      center: { x: Number(px.toFixed(1)), y: Number(py.toFixed(1)) },
      radius,
      shade: rng(),
    });
  }

  return trees;
}

/**
 * Silt hatching: short strokes laid roughly parallel to the flow. The renderer
 * has always read `hatchLines`; until now nothing ever populated it.
 *
 * Strokes are clipped to the local island width, otherwise on a narrow silt bar
 * they poke out over the water.
 */
function populateSiltHatches(
  polygon: MapPoint[],
  count: number,
  angleRad: number,
  rng: () => number
): [MapPoint, MapPoint][] {
  const hatches: [MapPoint, MapPoint][] = [];
  if (polygon.length < 3 || count <= 0) return hatches;

  const { minX, minY, w, h } = polygonBounds(polygon);
  if (w < 5 || h < 5) return hatches;

  let attempts = 0;
  while (hatches.length < count && attempts < count * 20) {
    attempts++;
    const x = minX + 0.24 * w + rng() * 0.52 * w;
    const y = minY + 0.24 * h + rng() * 0.52 * h;
    if (!pointInPolygon(polygon, x, y)) continue;

    // Keep the stroke fully inside the land, whatever the local width is.
    const clearance = distanceToPolygonEdge(polygon, x, y);
    if (clearance < 1.4) continue;

    const len = Math.min(3.5 + rng() * 3.5, (clearance - 0.5) * 2);
    if (len < 1.6) continue;

    const angle = angleRad + (rng() - 0.5) * 0.35;
    const hA = {
      x: Number((x - Math.cos(angle) * len * 0.5).toFixed(1)),
      y: Number((y - Math.sin(angle) * len * 0.5).toFixed(1)),
    };
    const hB = {
      x: Number((x + Math.cos(angle) * len * 0.5).toFixed(1)),
      y: Number((y + Math.sin(angle) * len * 0.5).toFixed(1)),
    };
    if (!pointInPolygon(polygon, hA.x, hA.y) || !pointInPolygon(polygon, hB.x, hB.y)) {
      continue;
    }
    hatches.push([hA, hB]);
  }

  return hatches;
}

/** Samples a bank polyline between two arc fractions (0 = apex, 1 = mouth). */
function sampleBankRange(bank: MapPoint[], from: number, to: number, count: number): MapPoint[] {
  const out: MapPoint[] = [];
  if (bank.length < 2 || count < 2) return out;
  for (let i = 0; i < count; i++) {
    const u = from + ((to - from) * i) / (count - 1);
    const idx = Math.min(bank.length - 1, Math.max(0, Math.round(u * (bank.length - 1))));
    out.push(bank[idx]);
  }
  return out;
}

/** Returns whichever bank of `branch` faces `toward` (orientation-agnostic). */
function facingBank(branch: DistributaryBranch, toward: MapPoint): MapPoint[] {
  const mid = Math.floor(branch.leftBank.length / 2);
  const left = branch.leftBank[mid] ?? branch.leftBank[0];
  const right = branch.rightBank[mid] ?? branch.rightBank[0];
  const dLeft = Math.hypot(left.x - toward.x, left.y - toward.y);
  const dRight = Math.hypot(right.x - toward.x, right.y - toward.y);
  return dLeft <= dRight ? branch.leftBank : branch.rightBank;
}

/**
 * Builds a lens-shaped island from the two facing banks of a channel gap.
 *
 * This is the key difference from the old ellipse approach: the island is
 * derived from the channels that bound it, so it always fits the gap, never
 * floats over open water, and narrows or widens exactly as the channels do.
 *
 * The outline is a lens rather than the raw gap: the island tapers to a point
 * at both ends and is widest in the middle. Using the raw bank points instead
 * gave trapezoids with two flat ends, which read as drawn-on triangles.
 */
function createLensIsland(
  bankA: MapPoint[],
  bankB: MapPoint[],
  from: number,
  to: number,
  noiseFn: (x: number, y: number) => number,
  noiseOffset: number,
  margin = 1.3
): { polygon: MapPoint[]; center: MapPoint } | null {
  const count = 16;
  // Both banks run apex -> mouth, and both are sampled from -> to so that
  // sideA[i] and sideB[i] sit across the gap from each other. (Sampling one of
  // them backwards produces a zigzag rather than a lens.)
  const sideA = sampleBankRange(bankA, from, to, count);
  const sideB = sampleBankRange(bankB, from, to, count);
  if (sideA.length < count || sideB.length < count) return null;

  const ringA: MapPoint[] = [];
  const ringB: MapPoint[] = [];
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const pA = sideA[i];
    const pB = sideB[i];

    const dx = pA.x - pB.x;
    const dy = pA.y - pB.y;
    const gap = Math.hypot(dx, dy);
    const ux = gap > 0.001 ? dx / gap : 0;
    const uy = gap > 0.001 ? dy / gap : 0;
    const mx = (pA.x + pB.x) * 0.5;
    const my = (pA.y + pB.y) * 0.5;

    // 0 at both tips, 1 in the middle. The 0.55 exponent keeps the lens fat in
    // the middle and sharply tapered at the ends, like a silt bar.
    const profile = Math.pow(Math.sin(Math.PI * t), 0.55);
    const wobble = noiseFn(t * 3.3 + noiseOffset, noiseOffset * 0.6) * 0.9;
    const half = Math.max(0, (gap * 0.5 - margin) * profile + wobble * profile);

    ringA.push({ x: mx + ux * half, y: my + uy * half });
    ringB.push({ x: mx - ux * half, y: my - uy * half });
    cx += mx;
    cy += my;
  }

  cx /= count;
  cy /= count;

  const outline = [...ringA, ...ringB.reverse()];
  const polygon = evaluateSpline([...outline, outline[0]], 2.5);
  if (polygon.length < 6) return null;

  return { polygon, center: { x: Number(cx.toFixed(1)), y: Number(cy.toFixed(1)) } };
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

  // Discharge distribution: central streams carry a little more than the outer
  // arms, but every arm must read as a real channel. A steep falloff left the
  // outer arms as 2px trickles, which made the fan look like three rivers and
  // two scratches.
  const rawDischarges: number[] = [];
  let totalDischarge = 0;
  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1);
    const centerDist = Math.abs(v - 0.5) * 2; // 0 (center) to 1 (outer)
    const q = Math.exp(-0.7 * centerDist * centerDist);
    rawDischarges.push(q);
    totalDischarge += q;
  }

  for (let k = 0; k < numBranches; k++) {
    const v = numBranches === 1 ? 0.5 : k / (numBranches - 1); // 0 (leftmost) to 1 (rightmost)

    // Angular deviation from base flow
    const fanAngle = -fanSpreadRad * 0.5 + v * fanSpreadRad;
    const finalAngle = baseAngle + fanAngle;

    // Distributaries leave from across the trunk mouth, not from one shared
    // point: a common origin is what produces the starburst of ink at the apex.
    const originLat = (v - 0.5) * mainWidth * 0.44;
    const originPt: MapPoint = {
      x: apexPoint.x + normX * originLat,
      y: apexPoint.y + normY * originLat,
    };

    // Stay attached to the trunk for the first fifth of the fan, then diverge.
    const shoulderNoise = noise(k * 1.9, 0.2) * 3.0;
    const shoulderPt: MapPoint = {
      x: originPt.x + fwdX * deltaSpan * 0.18 + normX * (originLat * 0.35 + shoulderNoise),
      y: originPt.y + fwdY * deltaSpan * 0.18 + normY * (originLat * 0.35 + shoulderNoise),
    };

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

    // 5-point natural meandering spline: Origin -> Shoulder -> Mid -> Inter2 -> Mouth
    const intermediate2: MapPoint = {
      x: (midPt.x + mouthPt.x) * 0.5 + normX * (noise(k * 5.1, 0.8) * 7.0),
      y: (midPt.y + mouthPt.y) * 0.5 + normY * (noise(k * 5.1, 0.8) * 7.0),
    };

    const bSpline = evaluateSpline([originPt, shoulderPt, midPt, intermediate2, mouthPt], 3.0);

    // Discharge-weighted width: central channels carry more volume. The share
    // factor keeps the distributaries summing to roughly the trunk width, so
    // the fan does not open into a lake.
    const dischargeShare = rawDischarges[k] / totalDischarge;
    const bStartW = Math.max(2.2, mainWidth * dischargeShare * 1.25);
    // Estuary mouths flare as the current slows and drops its sediment load.
    const bEndW = bStartW * (1.45 + rng() * 0.45);

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

  // 5. Alluvial Archipelago & Islands
  //
  // Every island is cut from the gap between two channels, so it can never
  // float over open water or sit across a bank line. The old version placed
  // free-floating ellipses by angle, and they overlapped both channels and
  // each other.
  const islands: DeltaIsland[] = [];
  const midPair = Math.max(0, Math.floor((numBranches - 1) / 2));

  const buildGapIsland = (
    a: DistributaryBranch,
    b: DistributaryBranch,
    from: number,
    to: number,
    idSuffix: string,
    noiseOffset: number,
    treeCount: number,
    hatchCount: number
  ): DeltaIsland | null => {
    const midOfA = a.centerline[Math.floor(a.centerline.length * 0.6)];
    const midOfB = b.centerline[Math.floor(b.centerline.length * 0.6)];
    const lens = createLensIsland(
      facingBank(a, midOfB),
      facingBank(b, midOfA),
      from,
      to,
      noise,
      noiseOffset
    );
    if (!lens) return null;

    return {
      id: `delta_island_${idSuffix}`,
      kind: idSuffix === 'central' ? 'central' : 'lobe',
      polygon: lens.polygon,
      hatchLines: populateSiltHatches(lens.polygon, hatchCount, baseAngle - Math.PI / 2, rng),
      center: lens.center,
      trees: showTrees ? populateIslandTrees(lens.polygon, treeCount, rng) : [],
    };
  };

  // A. Central island: the fork island, in the middle gap, upper half of the fan.
  {
    const a = branches[midPair];
    const b = branches[midPair + 1];
    const central = a && b ? buildGapIsland(a, b, 0.28, 0.75, 'central', rawSeed * 0.3, 14, 16) : null;
    if (central) {
      islands.push(central);
    } else {
      // Fallback: a small organic island so the delta always reads as a delta.
      const fallbackCenter: MapPoint = {
        x: apexPoint.x + fwdX * (deltaSpan * 0.38),
        y: apexPoint.y + fwdY * (deltaSpan * 0.38),
      };
      const poly = createOrganicIsland(
        fallbackCenter.x,
        fallbackCenter.y,
        deltaSpan * 0.16,
        deltaSpan * 0.09,
        baseAngle,
        12,
        noise,
        rawSeed * 0.3
      );
      islands.push({
        id: 'delta_island_central',
        kind: 'central',
        polygon: poly,
        hatchLines: populateSiltHatches(poly, 6, baseAngle - Math.PI / 2, rng),
        center: fallbackCenter,
        trees: showTrees ? populateIslandTrees(poly, 4, rng) : [],
      });
    }
  }

  // B. Lobe islands: one per remaining gap, closer to the mouths.
  for (let k = 0; k < numBranches - 1; k++) {
    if (k === midPair) continue;
    const a = branches[k];
    const b = branches[k + 1];
    if (!a || !b) continue;

    const lobe = buildGapIsland(a, b, 0.5, 0.95, `lobe_${k}`, k * 4.7 + rawSeed, 18, 14);
    if (lobe) islands.push(lobe);
  }

  // C. Barrier islets: small shoals just beyond the mouths. These are shoals,
  // not islands — a couple of tree crowns at most, and small enough that they
  // read as sandbars rather than offshore boulders.
  const isletCount = 5;
  for (let m = 0; m < isletCount; m++) {
    const u = (m + 0.5 + (rng() - 0.5) * 0.34) / isletCount; // 0..1 across the fan
    const angle = baseAngle - fanSpreadRad * 0.44 + u * fanSpreadRad * 0.88;

    // Staggered in the shallow bay, clear of the mouths (1.32 to 1.5 of span).
    const distFactor = 1.34 + 0.1 * Math.sin(u * Math.PI) + (rng() - 0.5) * 0.08;
    const isletDist = deltaSpan * distFactor;

    const ix = apexPoint.x + Math.cos(angle) * isletDist;
    const iy = apexPoint.y + Math.sin(angle) * isletDist;

    const rBase = 2.6 + rng() * 3.9; // 2.6 - 6.5px
    const aspect = 0.65 + rng() * 0.65;

    const isletPoly = createOrganicIsland(
      ix,
      iy,
      rBase,
      rBase * aspect,
      baseAngle + (rng() - 0.5) * 0.7,
      9,
      noise,
      m * 7.3 + rawSeed * 0.5
    );

    // Barrier shoals are bare sand: a tree on a five-pixel islet reads as an
    // eye, not as vegetation.
    islands.push({
      id: `delta_islet_${m}`,
      kind: 'islet',
      polygon: isletPoly,
      hatchLines: [],
      center: { x: ix, y: iy },
      trees: [],
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

// ============================================================================
// WATER BODY COMPOSITION
// ============================================================================
//
// A delta is one connected body of water. Drawing each distributary as its own
// translucent polygon stacks alpha where the channels overlap the trunk and
// each other, producing dark seams and a starburst of ink at the fork. These
// builders merge the water into a single surface and give the renderer one
// shoreline instead of a dozen bank polylines.

const CAP_TOLERANCE = 1.6;

function toGeoRing(pts: MapPoint[]): GeoRing {
  const ring: GeoRing = [];
  for (const p of pts) ring.push([p.x, p.y]);
  ring.push([pts[0].x, pts[0].y]);
  return ring;
}

function fromGeoRing(ring: GeoRing): MapPoint[] {
  const out: MapPoint[] = [];
  for (const [x, y] of ring) out.push({ x, y });
  return out;
}

/**
 * Unions the trunk and every distributary into one water surface.
 * Returns outer rings in world coordinates (holes are not expected — inlets
 * and island gaps are open to the sea by construction).
 */
export function buildDeltaWaterRings(delta: ProceduralDelta): MapPoint[][] {
  const polygons: GeoPolygon[] = [];
  for (const pts of [
    delta.trunkWaterPolygon,
    ...delta.branches.map((b) => b.waterPolygon),
  ]) {
    if (pts.length >= 3) polygons.push([toGeoRing(pts)]);
  }
  if (polygons.length === 0) return [];

  const fallback = (): MapPoint[][] => polygons.map((p) => fromGeoRing(p[0]));

  let merged: GeoMultiPolygon;
  try {
    merged = polygonClipping.union(polygons[0], ...polygons.slice(1)) as GeoMultiPolygon;
  } catch {
    // Self-intersecting ribbons can defeat the clipper; per-channel fills are
    // still readable, so degrade instead of dropping the water entirely.
    return fallback();
  }

  const rings: MapPoint[][] = [];
  for (const poly of merged) {
    const outer = poly[0];
    if (!outer || outer.length < 4) continue;
    const ring = fromGeoRing(outer);
    if (ring.length >= 3) rings.push(ring);
  }
  return rings.length > 0 ? rings : fallback();
}

/** The short chords where a channel opens into another channel or the sea. */
function deltaCapChords(delta: ProceduralDelta): Array<[MapPoint, MapPoint]> {
  const caps: Array<[MapPoint, MapPoint]> = [];

  // Trunk source: the river above the delta continues off-map, so no line here.
  const tStart = [delta.trunkLeftBank[0], delta.trunkRightBank[0]];
  if (tStart[0] && tStart[1]) caps.push([tStart[0], tStart[1]]);

  // Distributary mouths: the water simply ends at the sea.
  for (const b of delta.branches) {
    const l = b.leftBank[b.leftBank.length - 1];
    const r = b.rightBank[b.rightBank.length - 1];
    if (l && r) caps.push([l, r]);
  }

  return caps;
}

function polylineLength(pts: MapPoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

/**
 * Boundary polylines of the unioned delta water, with the cap chords removed.
 * The renderer strokes these once: one continuous coastline around the whole
 * fan, with open ends where the rivers run into the sea.
 */
export function buildDeltaShorelineRuns(
  delta: ProceduralDelta,
  waterRings?: MapPoint[][]
): MapPoint[][] {
  const rings = waterRings ?? buildDeltaWaterRings(delta);
  const caps = deltaCapChords(delta);
  const near = (p: MapPoint, q: MapPoint, tol = CAP_TOLERANCE) =>
    Math.hypot(p.x - q.x, p.y - q.y) <= tol;

  const runs: MapPoint[][] = [];

  for (const ring of rings) {
    if (ring.length < 4) continue;

    const loop = ring.slice();
    const first = loop[0];
    const last = loop[loop.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) < 0.01) loop.pop();

    const n = loop.length;
    if (n < 3) continue;

    const kept: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % n];
      const onCap = caps.some(
        ([a, b]) => (near(p, a) && near(q, b)) || (near(p, b) && near(q, a))
      );
      kept.push(!onCap);
    }

    if (kept.every(Boolean)) {
      runs.push([...loop, loop[0]]);
      continue;
    }
    if (!kept.some(Boolean)) continue;

    // Start the walk just after a break so a run never wraps past index 0.
    const startBreak = kept.findIndex((k) => !k);
    let current: MapPoint[] = [];
    for (let step = 1; step <= n; step++) {
      const i = (startBreak + step) % n;
      if (kept[i]) {
        if (current.length === 0) current.push(loop[i]);
        current.push(loop[(i + 1) % n]);
      } else {
        if (current.length >= 2) runs.push(current);
        current = [];
      }
    }
    if (current.length >= 2) runs.push(current);
  }

  return runs.filter((run) => run.length >= 2 && polylineLength(run) >= 2.5);
}
