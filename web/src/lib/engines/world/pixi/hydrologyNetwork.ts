/**
/**
 * hydrologyNetwork.ts
 *
 * Hydrology Graph Engine: Seamless River Confluences, Bifurcations & Delta Distributaries.
 *
 * Replaces isolated river polyline rendering with a topological hydrology graph:
 * - Detects confluences (tributaries joining) and bifurcations (delta branches splitting).
 * - Unions connected river water polygons into a single continuous surface (no alpha seams).
 * - Inks banks strictly along external shorelines—zero crossing bank lines at junctions.
 * - Supports arbitrary branching, islands, and braided channels with 100% author control.
 */

import type { Graphics } from 'pixi.js';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import polygonClipping, {
  type MultiPolygon as GeoMultiPolygon,
  type Ring as GeoRing,
} from 'polygon-clipping';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { hashStringToSeed } from './mountainGenerator';
import { generateProceduralRiver, type ProceduralRiver } from './riverGenerator';
import { toFlatPoints } from './renderers/shared';

export interface RiverNetwork {
  id: string;
  rivers: MapTerrainFeature[];
}

export interface RiverJunction {
  riverAId: string;
  riverBId: string;
  point: MapPoint;
}

export interface NetworkWaterPolygon {
  outer: MapPoint[];
  holes: MapPoint[][];
}

const DEFAULT_SNAP_THRESHOLD = 8.0;
const CAP_TOLERANCE = 2.4;

function distanceSq(p1: MapPoint, p2: MapPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function distToSegmentSq(p: MapPoint, v: MapPoint, w: MapPoint): number {
  const l2 = distanceSq(v, w);
  if (l2 === 0) return distanceSq(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distanceSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

export function distToPolyline(p: MapPoint, points: MapPoint[]): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.sqrt(distanceSq(p, points[0]));
  let minD2 = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i++) {
    const d2 = distToSegmentSq(p, points[i], points[i + 1]);
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

/**
 * Checks if two rivers are connected geometrically (endpoint touching/close to polyline)
 * or topologically via `connectedRiverId`.
 */
export function areRiversConnected(
  r1: MapTerrainFeature,
  r2: MapTerrainFeature,
  snapThreshold = DEFAULT_SNAP_THRESHOLD
): boolean {
  if (r1.id === r2.id) return false;
  if (r1.connectedRiverId === r2.id || r2.connectedRiverId === r1.id) return true;

  const pts1 = r1.points || [];
  const pts2 = r2.points || [];
  if (pts1.length < 2 || pts2.length < 2) return false;

  // The endpoint must actually reach the other river's water surface
  const w1 = r1.width || 10;
  const w2 = r2.width || 10;
  const threshold1 = Math.max(snapThreshold, w2 * 0.5 + 2.5);
  const threshold2 = Math.max(snapThreshold, w1 * 0.5 + 2.5);

  // Check r1 endpoints against r2 polyline
  const r1Start = pts1[0];
  const r1End = pts1[pts1.length - 1];
  if (distToPolyline(r1Start, pts2) <= threshold1) return true;
  if (distToPolyline(r1End, pts2) <= threshold1) return true;

  // Check r2 endpoints against r1 polyline
  const r2Start = pts2[0];
  const r2End = pts2[pts2.length - 1];
  if (distToPolyline(r2Start, pts1) <= threshold2) return true;
  if (distToPolyline(r2End, pts1) <= threshold2) return true;

  return false;
}

/**
 * Groups a collection of river terrain features into connected networks using Disjoint Set Union.
 */
export function findConnectedRiverNetworks(
  rivers: MapTerrainFeature[],
  snapThreshold = DEFAULT_SNAP_THRESHOLD
): RiverNetwork[] {
  const n = rivers.length;
  if (n === 0) return [];

  const parent: number[] = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  // Pairwise connectivity check
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (areRiversConnected(rivers[i], rivers[j], snapThreshold)) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, MapTerrainFeature[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(rivers[i]);
  }

  const result: RiverNetwork[] = [];
  for (const [rootIdx, members] of groups.entries()) {
    result.push({
      id: members.length === 1 ? members[0].id : `net_${members[0].id}_${members.length}`,
      rivers: members,
    });
  }

  return result;
}

function toGeoRing(pts: MapPoint[]): GeoRing {
  const ring: GeoRing = [];
  for (const p of pts) ring.push([p.x, p.y]);
  if (ring.length > 0) ring.push([pts[0].x, pts[0].y]);
  return ring;
}

function fromGeoRing(ring: GeoRing): MapPoint[] {
  const out: MapPoint[] = [];
  for (const [x, y] of ring) out.push({ x, y });
  return out;
}

function polylineLength(pts: MapPoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

/**
 * Builds external cap chords (open headwaters & mouths) that should NOT be stroked with ink.
 * Internal junction endpoints (where one river flows into or out of another) are excluded.
 */
function buildExternalCapChords(
  procRivers: ProceduralRiver[],
  allRivers: MapTerrainFeature[]
): Array<[MapPoint, MapPoint]> {
  const caps: Array<[MapPoint, MapPoint]> = [];

  for (let i = 0; i < procRivers.length; i++) {
    const river = procRivers[i];
    const feat = allRivers[i];
    const pts = feat.points || [];
    if (pts.length < 2) continue;

    const startPt = pts[0];
    const endPt = pts[pts.length - 1];

    // Check if start point is an internal junction with another river
    const isStartInternal = allRivers.some((other, j) => {
      if (i === j) return false;
      const otherProc = procRivers[j];
      const dist = distToPolyline(startPt, other.points || []);
      const threshold = Math.max(DEFAULT_SNAP_THRESHOLD, (other.width || 10) * 0.5 + 2.5);
      return dist <= threshold;
    });

    if (!isStartInternal && river.leftBank[0] && river.rightBank[0]) {
      caps.push([river.leftBank[0], river.rightBank[0]]);
    }

    // Check if end point is an internal junction with another river
    const isEndInternal = allRivers.some((other, j) => {
      if (i === j) return false;
      const otherProc = procRivers[j];
      const dist = distToPolyline(endPt, other.points || []);
      const threshold = Math.max(DEFAULT_SNAP_THRESHOLD, (other.width || 10) * 0.5 + 2.5);
      return dist <= threshold;
    });

    const lastL = river.leftBank[river.leftBank.length - 1];
    const lastR = river.rightBank[river.rightBank.length - 1];
    if (!isEndInternal && lastL && lastR) {
      caps.push([lastL, lastR]);
    }
  }

  return caps;
}

/**
 * Extracts continuous shoreline bank runs from a merged multi-polygon, dropping external caps.
 */
export function buildNetworkShorelineRuns(
  rings: MapPoint[][],
  caps: Array<[MapPoint, MapPoint]>,
  tolerance = CAP_TOLERANCE
): MapPoint[][] {
  const near = (p: MapPoint, q: MapPoint) => Math.hypot(p.x - q.x, p.y - q.y) <= tolerance;
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

    // Completely closed island ring or shoreline without caps
    if (kept.every(Boolean)) {
      runs.push([...loop, loop[0]]);
      continue;
    }
    if (!kept.some(Boolean)) continue;

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

  return runs.filter((r) => r.length >= 2 && polylineLength(r) >= 2.0);
}

/**
 * Generates unified water polygons and outer bank strokes for a connected RiverNetwork.
 */
export function generateNetworkGeometry(network: RiverNetwork): {
  waterPolygons: NetworkWaterPolygon[];
  shorelineRuns: MapPoint[][];
} {
  const rivers = network.rivers;
  if (rivers.length === 0) return { waterPolygons: [], shorelineRuns: [] };

  const procRivers: ProceduralRiver[] = [];
  for (const feat of rivers) {
    if (!feat.points || feat.points.length < 2) continue;
    const seed = hashStringToSeed(feat.id || `river_${feat.points[0].x}_${feat.points[0].y}`);
    procRivers.push(
      generateProceduralRiver(feat.points, {
        seed,
        startWidth: Math.min(1.2, Math.max(0.4, (feat.width || 11.0) * 0.25)),
        endWidth: feat.width || 11.0,
        meanderRoughness: 0.3,
      })
    );
  }

  if (procRivers.length === 0) return { waterPolygons: [], shorelineRuns: [] };
  if (procRivers.length === 1) {
    // Single river optimization
    const r = procRivers[0];
    const runs: MapPoint[][] = [];
    if (r.leftBank.length >= 2) runs.push(r.leftBank);
    if (r.rightBank.length >= 2) runs.push(r.rightBank);
    return {
      waterPolygons: r.waterPolygon.length >= 3 ? [{ outer: r.waterPolygon, holes: [] }] : [],
      shorelineRuns: runs,
    };
  }

  // Multi-river network union
  const geoPolys = procRivers
    .filter((r) => r.waterPolygon.length >= 3)
    .map((r) => [toGeoRing(r.waterPolygon)]);

  if (geoPolys.length === 0) return { waterPolygons: [], shorelineRuns: [] };

  let merged: GeoMultiPolygon;
  try {
    merged = polygonClipping.union(geoPolys[0], ...geoPolys.slice(1)) as GeoMultiPolygon;
  } catch {
    // Fallback: per-river rendering if clipping fails
    const fallbackPolys: NetworkWaterPolygon[] = procRivers
      .filter((r) => r.waterPolygon.length >= 3)
      .map((r) => ({ outer: r.waterPolygon, holes: [] }));
    const fallbackRuns: MapPoint[][] = [];
    for (const r of procRivers) {
      if (r.leftBank.length >= 2) fallbackRuns.push(r.leftBank);
      if (r.rightBank.length >= 2) fallbackRuns.push(r.rightBank);
    }
    return { waterPolygons: fallbackPolys, shorelineRuns: fallbackRuns };
  }

  const rings: MapPoint[][] = [];
  const waterPolygons: NetworkWaterPolygon[] = [];

  for (const poly of merged) {
    if (poly.length === 0) continue;
    const outer = fromGeoRing(poly[0]);
    if (outer.length < 3) continue;

    rings.push(outer);
    const holes: MapPoint[][] = [];

    // Inner rings (rIdx >= 1) are holes representing islands / dry land between river channels
    for (let rIdx = 1; rIdx < poly.length; rIdx++) {
      const hole = fromGeoRing(poly[rIdx]);
      if (hole.length >= 3) {
        rings.push(hole);
        holes.push(hole);
      }
    }

    waterPolygons.push({ outer, holes });
  }

  const caps = buildExternalCapChords(procRivers, rivers);
  const shorelineRuns = buildNetworkShorelineRuns(rings, caps);

  return { waterPolygons, shorelineRuns };
}

/**
 * Renders an entire connected RiverNetwork onto a Pixi.js Graphics context.
 * Strictly cuts out all interior island holes so the dry land between channels is never painted blue.
 */
export function renderRiverNetworkToGraphics(g: Graphics, network: RiverNetwork): void {
  const { waterPolygons, shorelineRuns } = generateNetworkGeometry(network);

  // 1. Water wash (single continuous surface, with dry-land holes strictly cut out)
  for (const { outer, holes } of waterPolygons) {
    if (outer.length < 3) continue;
    g.poly(toFlatPoints(outer)).fill({
      color: VINTAGE_PARCHMENT.riverWash,
      alpha: 0.6,
    });
    for (const hole of holes) {
      if (hole.length >= 3) {
        g.poly(toFlatPoints(hole)).cut();
      }
    }
  }

  // 2. Continuous exterior and island bank strokes (no crossing lines at confluences/forks)
  for (const run of shorelineRuns) {
    if (run.length < 2) continue;
    g.moveTo(run[0].x, run[0].y);
    for (let i = 1; i < run.length; i++) {
      g.lineTo(run[i].x, run[i].y);
    }
    g.stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.riverBankInk,
      cap: 'round',
      join: 'round',
    });
  }
}

/**
 * Spawns a new distributary branch from an existing river.
 * Computes an organic diverging bifurcation starting along the parent river
 * and fanning outward towards the coast/mouth.
 */
export function createDistributaryBranch(
  parentRiver: MapTerrainFeature,
  options: {
    branchFraction?: number; // 0.70 .. 0.90 along length
    angleOffsetDegrees?: number; // e.g. +28° or -28°
    lengthMultiplier?: number; // relative branch length
    isPersian?: boolean;
  } = {}
): MapTerrainFeature | null {
  const pts = parentRiver.points || [];
  if (pts.length < 2) return null;

  const fraction = Math.max(0.6, Math.min(0.92, options.branchFraction ?? 0.8));
  const angleDeg = options.angleOffsetDegrees ?? 28;
  const isPersian = options.isPersian ?? false;

  // Arc length parameterization
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(d);
    totalLen += d;
  }

  if (totalLen < 15) return null;

  const targetDist = totalLen * fraction;
  let acc = 0;
  let splitIdx = 0;
  let tSeg = 0;

  for (let i = 0; i < segLens.length; i++) {
    if (acc + segLens[i] >= targetDist) {
      splitIdx = i;
      tSeg = (targetDist - acc) / segLens[i];
      break;
    }
    acc += segLens[i];
  }

  const pA = pts[splitIdx];
  const pB = pts[splitIdx + 1];
  const splitPt: MapPoint = {
    x: Math.round(pA.x + (pB.x - pA.x) * tSeg),
    y: Math.round(pA.y + (pB.y - pA.y) * tSeg),
  };

  // Flow direction at split point
  const fwdX = pB.x - pA.x;
  const fwdY = pB.y - pA.y;
  const baseAngle = Math.atan2(fwdY, fwdX);
  const branchAngle = baseAngle + (angleDeg * Math.PI) / 180;

  const remainingLen = totalLen * (1 - fraction);
  const branchLen = remainingLen * (options.lengthMultiplier ?? 1.15);

  const midDist = branchLen * 0.5;
  const endDist = branchLen;

  // Sinuous intermediate control point
  const normX = -Math.sin(branchAngle);
  const normY = Math.cos(branchAngle);

  const midPt: MapPoint = {
    x: Math.round(splitPt.x + Math.cos(branchAngle) * midDist + normX * 4),
    y: Math.round(splitPt.y + Math.sin(branchAngle) * midDist + normY * 4),
  };

  const endPt: MapPoint = {
    x: Math.round(splitPt.x + Math.cos(branchAngle) * endDist),
    y: Math.round(splitPt.y + Math.sin(branchAngle) * endDist),
  };

  const parentWidth = parentRiver.width || 11.0;
  const branchWidth = Math.max(3.5, Math.round(parentWidth * 0.65));

  const branchName = isPersian
    ? `انشعاب ${parentRiver.name || 'رودخانه'}`
    : `Branch of ${parentRiver.name || 'River'}`;

  return {
    id: `terr_branch_${Date.now().toString(36)}`,
    name: branchName,
    type: 'river',
    points: [splitPt, midPt, endPt],
    width: branchWidth,
    elevation: Math.max(20, (parentRiver.elevation || 150) - 40),
    connectedRiverId: parentRiver.id,
    locationId: parentRiver.locationId,
    groupId: parentRiver.groupId,
    labelConfig: { enabled: false },
  };
}
