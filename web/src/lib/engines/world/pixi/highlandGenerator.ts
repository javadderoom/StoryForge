/**
 * Procedural Highland & Plateau / Mesa Generator
 *
 * Implements organic, hand-inked elevated tablelands and cliff escarpments
 * matching the authentic fantasy manuscript cartography style (e.g. Gerami Uplands).
 *
 * Replaces sterile CAD polygon extrusions with:
 * 1. Organically subdivided craggy table rims (natural spurs and bluffs).
 * 2. Realistic rock buttresses with dual-facet directional shading (NW sun).
 * 3. Short diagonal chisel rock strata (no uniform barcode needle combs).
 * 4. Grounding talus scree lines at the foot of the bluffs.
 * 5. Elevated warm parchment table wash with concentric terrace contours.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';
import {
  calculatePolygonArea,
  isPointInPolygon,
} from '../landSculpt/geometry';
import {
  generateProceduralMountainRange,
  type ProceduralPeak,
} from './mountainGenerator';

export interface HighlandButtress {
  rimApex: MapPoint;
  leftBase: MapPoint;
  rightBase: MapPoint;
  spinePt: MapPoint;
  sunlitPoly: MapPoint[];
  shadowPoly: MapPoint[];
  chiselLines: [MapPoint, MapPoint][];
}

export interface ProceduralHighland {
  id: string;
  tablePolygon: MapPoint[]; // Organic subdivided perimeter
  innerTablePolygon?: MapPoint[]; // Inset terrace bench
  rimPath: MapPoint[]; // Primary hand-inked craggy rim
  buttresses: HighlandButtress[]; // Rock buttresses along scarp
  cliffDropPolygon: MapPoint[]; // Overall shaded drop band
  /**
   * Outer cliff apron, ordered outer → inner. Filling these full rings from
   * light to dark produces the broad shaded escarpment belt in the Gerami
   * reference without needing a per-pixel gradient.
   */
  apronRings?: MapPoint[][];
  /** Eroded drainage / ridge folds across the table surface. */
  interiorRidges?: MapPoint[][];
  /** Radiating gullies crossing the outer cliff apron. */
  apronRavines?: MapPoint[][];
  /** Layered mountain peaks forming the escarpment ring. */
  cliffPeaks?: ProceduralPeak[];
  /** Short rock spurs breaking the rim silhouette. */
  rimSpurs?: [MapPoint, MapPoint][];
  strataHatches: [MapPoint, MapPoint][]; // Chisel rock strata marks
  talusLine: MapPoint[]; // Broken baseline
  terraceContours?: MapPoint[][]; // Secondary step contours
  elevation: number;
}

export interface HighlandOptions {
  seed?: number;
  cliffHeight?: number; // Height of cliff drop face in pixels (default: 22)
  cliffSteepness?: number; // 0..1 (default: 0.7)
  terraceTiers?: number; // 1, 2, or 3 stepped tiers (default: 1)
  isPolygon?: boolean;
}

/**
 * Generates procedural highland/plateau geometry from an authored path or polygon.
 */
export function generateProceduralHighland(
  points: MapPoint[],
  options: HighlandOptions = {}
): ProceduralHighland {
  if (!points || points.length < 2) {
    return {
      id: 'highland_empty',
      tablePolygon: points || [],
      rimPath: points || [],
      buttresses: [],
      cliffDropPolygon: [],
      strataHatches: [],
      talusLine: [],
      elevation: 600,
    };
  }

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const cliffHeight = Math.max(5, Math.min(90, options.cliffHeight ?? 36));
  const terraceTiers = Math.max(1, Math.min(3, options.terraceTiers ?? 1));

  // Determine if input is a closed polygon or a line escarpment.
  //
  // `isPolygon: false` is authoritative for the cliff-escarpment tool: a
  // ridge stroke that happens to end near its start must remain a ridge.
  // Only callers that omit the option keep the legacy proximity auto-detect.
  const isClosed =
    options.isPolygon === true ||
    (options.isPolygon === undefined &&
      points.length >= 3 &&
      Math.hypot(
        points[0].x - points[points.length - 1].x,
        points[0].y - points[points.length - 1].y
      ) < 40);

  if (isClosed) {
    return generateOrganicClosedPlateau(
      points,
      cliffHeight,
      terraceTiers,
      rng,
      noise,
      rawSeed
    );
  } else {
    return generateOrganicEscarpmentRidge(points, cliffHeight, terraceTiers, rng, noise);
  }
}

/**
 * Generates an organic, hand-inked mesa / plateau with craggy bluffs and terrace benches.
 */
function generateOrganicClosedPlateau(
  polygon: MapPoint[],
  cliffHeight: number,
  tiers: number,
  rng: () => number,
  noise: (x: number, y: number) => number,
  seed: number
): ProceduralHighland {
  // 1. Ensure closed loop without duplicate consecutive points
  const rawPts: MapPoint[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const prev = rawPts[rawPts.length - 1];
    if (!prev || Math.hypot(curr.x - prev.x, curr.y - prev.y) > 2) {
      rawPts.push(curr);
    }
  }
  if (rawPts.length < 3) rawPts.push({ x: rawPts[0].x + 30, y: rawPts[0].y + 30 });
  if (Math.hypot(rawPts[0].x - rawPts[rawPts.length - 1].x, rawPts[0].y - rawPts[rawPts.length - 1].y) > 4) {
    rawPts.push(rawPts[0]);
  }

  // 2. Ensure counter-clockwise winding so normals point outward
  const ccwPts = ensureCCW(rawPts);

  // 3. Subdivide and smooth into organic craggy contour (removes artificial straight CAD edges)
  const organicRim = subdivideAndJitter(ccwPts, 14, noise, rng);

  // 4. Compute centroid for terrace insets
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < organicRim.length - 1; i++) {
    cx += organicRim[i].x;
    cy += organicRim[i].y;
  }
  const count = organicRim.length - 1 || 1;
  cx /= count;
  cy /= count;

  // 5. Inset terrace contour (flat mesa tableland bench)
  const innerTablePolygon: MapPoint[] = organicRim.map((p) => {
    const dx = cx - p.x;
    const dy = cy - p.y;
    const dist = Math.hypot(dx, dy);
    const inset = Math.min(14, dist * 0.18);
    return {
      x: Math.round(p.x + (dx / (dist || 1)) * inset),
      y: Math.round(p.y + (dy / (dist || 1)) * inset),
    };
  });

  // 5b. Broad outward cliff apron. The reference upland is a massif, not a
  // line drawing: the escarpment belt must read from a distance.
  const apronWidth = Math.max(10, cliffHeight * 2);
  const apronFractions = [1, 0.88, 0.76, 0.64, 0.52, 0.4, 0.28, 0.16, 0.06];
  const apronRings = apronFractions.map((fraction) =>
    offsetRing(organicRim, apronWidth * fraction, noise)
  );

  // Radiating gullies break the apron bands into an eroded mountainside.
  const outerApron = apronRings[Math.min(3, apronRings.length - 1)];
  const apronRavines: MapPoint[][] = [];
  const ravineStep = Math.max(2, Math.floor((organicRim.length - 1) / 28));
  for (let i = 0; i < organicRim.length - 1; i += ravineStep) {
    const rimPoint = organicRim[i];
    const outerPoint = outerApron[Math.min(i, outerApron.length - 1)];
    const mid: MapPoint = {
      x: Math.round((rimPoint.x + outerPoint.x) / 2 + (rng() - 0.5) * 8),
      y: Math.round((rimPoint.y + outerPoint.y) / 2 + (rng() - 0.5) * 8),
    };
    apronRavines.push([rimPoint, mid, outerPoint]);
  }

  // 5c. Eroded interior folds. These break up the flat table and give the
  // plateau the wind-carved, wrinkled surface of the reference.
  const interiorRidges = generateInteriorRidges(organicRim, rng, noise);

  // 5d. Short spur strokes that break the rim silhouette.
  const rimSpurs = generateRimSpurs(organicRim, rng);

  // 5e. Layered mountain peaks ring the table. These are the actual
  // escarpment mass; the apron and buttresses only supply its base shadow.
  const cliffPeaks = generateProceduralMountainRange(organicRim, {
    seed: seed + 7919,
    scale: Math.max(48, Math.min(115, cliffHeight * 1.55)),
    rangeWidth: Math.max(22, Math.min(62, cliffHeight * 0.85)),
    hasSnowcaps: false,
    foothillDensity: 0.6,
  });

  // 6. Build rocky cliff buttresses along scarp edges (facing S/SE away from NW sun)
  const buttresses: HighlandButtress[] = [];
  const cliffBasePoints: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];
  const talusLine: MapPoint[] = [];
  let distanceSinceButtress = 0;
  let nextButtressGap = 20 + rng() * 16;

  for (let i = 0; i < organicRim.length - 1; i++) {
    const p0 = organicRim[i];
    const p1 = organicRim[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const tang = { x: dx / segLen, y: dy / segLen };
    // `ensureCCW` produces a standard CCW ring, whose outward normal is
    // (dy, -dx). The old (-dy, dx) pointed INTO the plateau, so every cliff
    // was painted under the table fill and vanished.
    const norm = { x: tang.y, y: -tang.x };

    // Lighting factor: NW sun shines from (-1, -1).
    // Outward edges pointing South (+Y) or East (+X) face the viewer and drop deep shadows.
    // Outward edges pointing North/West face the sun.
    const shadowFactor = Math.max(0, norm.y * 0.75 + norm.x * 0.35 + 0.1);
    const dropDist = cliffHeight * (0.75 + 0.65 * shadowFactor) * (0.9 + 0.25 * rng());

    // Base point for cliff foot
    const basePt: MapPoint = {
      x: Math.round(p0.x + norm.x * dropDist * 0.55 + dropDist * 0.08),
      y: Math.round(p0.y + norm.y * dropDist * 0.55 + dropDist * 0.18),
    };
    cliffBasePoints.push(basePt);
    distanceSinceButtress += segLen;

    // One broad buttress every ~45px. The old per-segment teeth turned the
    // escarpment into a barcode; a massif needs overlapping rock faces.
    if (distanceSinceButtress < nextButtressGap || segLen < 6) continue;
    distanceSinceButtress = 0;
    nextButtressGap = 20 + rng() * 18;

    // Occasional gaps keep the escarpment from reading as a repeating saw.
    if (rng() < 0.08) continue;

    const apexOffset = (rng() - 0.5) * segLen * 0.6;
    const rimX = (p0.x + p1.x) * 0.5 + tang.x * apexOffset;
    const rimY = (p0.y + p1.y) * 0.5 + tang.y * apexOffset;
    const toothH = dropDist * (0.65 + 0.5 * rng());
    const apexPt: MapPoint = { x: Math.round(rimX), y: Math.round(rimY) };
    const toePt: MapPoint = {
      x: Math.round(rimX + norm.x * toothH * 0.9),
      y: Math.round(rimY + norm.y * toothH * 0.9),
    };
    const halfWidth = 12 + segLen * 0.4 + rng() * 16;
    const leftBasePt: MapPoint = {
      x: Math.round(toePt.x - tang.x * halfWidth + norm.x * 3),
      y: Math.round(toePt.y - tang.y * halfWidth + norm.y * 3),
    };
    const rightBasePt: MapPoint = {
      x: Math.round(toePt.x + tang.x * halfWidth + norm.x * 3),
      y: Math.round(toePt.y + tang.y * halfWidth + norm.y * 3),
    };

    // Chisel strata: short, slanted rock cuts following the face.
    const chiselLines: [MapPoint, MapPoint][] = [];
    const numChisels = 3 + Math.floor(rng() * 2);
    for (let c = 0; c < numChisels; c++) {
      const ct = (c + 1) / (numChisels + 1);
      const cx1 =
        apexPt.x +
        (toePt.x - apexPt.x) * ct +
        tang.x * (ct - 0.5) * halfWidth * 1.2 +
        (rng() - 0.5) * 2;
      const cy1 =
        apexPt.y +
        (toePt.y - apexPt.y) * ct +
        tang.y * (ct - 0.5) * halfWidth * 1.2;
      const strokeLen = 6 + rng() * 8;
      chiselLines.push([
        { x: Math.round(cx1), y: Math.round(cy1) },
        {
          x: Math.round(cx1 + tang.x * strokeLen * 0.55 + 2),
          y: Math.round(cy1 + tang.y * strokeLen * 0.55 + strokeLen * 0.55),
        },
      ]);
      strataHatches.push(chiselLines[chiselLines.length - 1]);
    }

    const toeLeft = {
      x: Math.round(toePt.x - tang.x * halfWidth * 0.28),
      y: Math.round(toePt.y - tang.y * halfWidth * 0.28),
    };
    const toeRight = {
      x: Math.round(toePt.x + tang.x * halfWidth * 0.28),
      y: Math.round(toePt.y + tang.y * halfWidth * 0.28),
    };

    buttresses.push({
      rimApex: apexPt,
      leftBase: leftBasePt,
      rightBase: rightBasePt,
      spinePt: toePt,
      // Jagged quads read as rock buttresses instead of clean triangles.
      sunlitPoly: [apexPt, leftBasePt, toeLeft, toePt],
      shadowPoly: [apexPt, toePt, toeRight, rightBasePt],
      chiselLines,
    });

    talusLine.push(leftBasePt, toePt, rightBasePt);
  }

  // The outer apron ring is a clean non-self-intersecting mass. The old
  // rim + reversed-base polygon crossed itself on irregular shapes.
  const cliffDropPolygon = apronRings[0];

  // Secondary terrace step contours
  const terraceContours: MapPoint[][] = [innerTablePolygon];
  if (tiers > 1) {
    const tier2: MapPoint[] = organicRim.map((pt, i) => {
      const base = cliffBasePoints[Math.min(i, cliffBasePoints.length - 1)] || pt;
      return {
        x: Math.round(pt.x + (base.x - pt.x) * 0.45),
        y: Math.round(pt.y + (base.y - pt.y) * 0.45),
      };
    });
    terraceContours.push(tier2);
  }

  return {
    id: `plateau_${Math.round(polygon[0].x)}_${Math.round(polygon[0].y)}`,
    tablePolygon: organicRim,
    innerTablePolygon,
    rimPath: organicRim,
    buttresses,
    cliffDropPolygon,
    apronRings,
    interiorRidges,
    apronRavines,
    cliffPeaks,
    rimSpurs,
    strataHatches,
    talusLine,
    terraceContours,
    elevation: 850,
  };
}

/**
 * Generates an organic escarpment ridge line with cascading rock bluffs.
 */
function generateOrganicEscarpmentRidge(
  points: MapPoint[],
  cliffHeight: number,
  tiers: number,
  rng: () => number,
  noise: (x: number, y: number) => number
): ProceduralHighland {
  const smoothedRim = subdivideOpenLine(points, 16, noise, rng);
  const rimSpurs = generateRimSpurs(smoothedRim, rng);
  const buttresses: HighlandButtress[] = [];
  const cliffBasePoints: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];
  const talusLine: MapPoint[] = [];

  for (let i = 0; i < smoothedRim.length - 1; i++) {
    const p0 = smoothedRim[i];
    const p1 = smoothedRim[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const tang = { x: dx / segLen, y: dy / segLen };
    const norm = { x: tang.y, y: -tang.x };

    const dropDist = cliffHeight * (0.95 + 0.45 * rng());
    const basePt: MapPoint = {
      x: Math.round(p0.x + norm.x * dropDist * 0.55 + dropDist * 0.08),
      y: Math.round(p0.y + norm.y * dropDist * 0.55 + dropDist * 0.18),
    };
    cliffBasePoints.push(basePt);

    const numSteps = Math.max(1, Math.floor(segLen / 16));
    for (let s = 0; s < numSteps; s++) {
      const t = (s + 0.5) / numSteps;
      const rimX = p0.x + dx * t;
      const rimY = p0.y + dy * t;
      const toothH = dropDist * (0.8 + 0.35 * rng());

      const apexPt: MapPoint = { x: Math.round(rimX), y: Math.round(rimY) };
      const toePt: MapPoint = {
        x: Math.round(rimX + norm.x * toothH * 0.82 + toothH * 0.08),
        y: Math.round(rimY + norm.y * toothH * 0.82 + toothH * 0.16),
      };
      const leftBasePt: MapPoint = {
        x: Math.round(toePt.x - tang.x * 6),
        y: Math.round(toePt.y - tang.y * 3),
      };
      const rightBasePt: MapPoint = {
        x: Math.round(toePt.x + tang.x * 6),
        y: Math.round(toePt.y + tang.y * 3),
      };

      const chiselLines: [MapPoint, MapPoint][] = [];
      const numChisels = 2 + Math.floor(rng() * 2);
      for (let c = 0; c < numChisels; c++) {
        const ct = (c + 1) / (numChisels + 1);
        const cx1 = apexPt.x + (toePt.x - apexPt.x) * ct + (rng() - 0.5) * 2;
        const cy1 = apexPt.y + (toePt.y - apexPt.y) * ct;
        const strokeLen = 4 + rng() * 6;
        chiselLines.push([
          { x: Math.round(cx1), y: Math.round(cy1) },
          { x: Math.round(cx1 + 2 + rng() * 2), y: Math.round(cy1 + strokeLen) },
        ]);
        strataHatches.push(chiselLines[chiselLines.length - 1]);
      }

      buttresses.push({
        rimApex: apexPt,
        leftBase: leftBasePt,
        rightBase: rightBasePt,
        spinePt: toePt,
        sunlitPoly: [apexPt, leftBasePt, toePt],
        shadowPoly: [apexPt, toePt, rightBasePt],
        chiselLines,
      });

      talusLine.push(leftBasePt, toePt, rightBasePt);
    }
  }

  const lastPt = smoothedRim[smoothedRim.length - 1];
  const prevPt = smoothedRim[smoothedRim.length - 2] || lastPt;
  const tailLen = Math.hypot(lastPt.x - prevPt.x, lastPt.y - prevPt.y) || 1;
  const tailNorm = {
    x: (lastPt.y - prevPt.y) / tailLen,
    y: -(lastPt.x - prevPt.x) / tailLen,
  };
  cliffBasePoints.push({
    x: Math.round(lastPt.x + tailNorm.x * cliffHeight * 0.55 + cliffHeight * 0.08),
    y: Math.round(lastPt.y + tailNorm.y * cliffHeight * 0.55 + cliffHeight * 0.18),
  });

  const cliffDropPolygon: MapPoint[] = [
    ...smoothedRim,
    ...[...cliffBasePoints].reverse(),
  ];

  return {
    id: `escarpment_${Math.round(points[0].x)}_${Math.round(points[0].y)}`,
    tablePolygon: smoothedRim,
    rimPath: smoothedRim,
    buttresses,
    cliffDropPolygon,
    rimSpurs,
    strataHatches,
    talusLine,
    elevation: 750,
  };
}

/**
 * Subdivides and smooths a closed polygon with organic fractal noise,
 * ensuring no sharp CAD lines or artificial geometric angles remain.
 */
function subdivideAndJitter(
  polygon: MapPoint[],
  maxSegmentLen: number,
  noise: (x: number, y: number) => number,
  rng: () => number
): MapPoint[] {
  let pts = [...polygon];

  // Up to 2 subdivision passes
  for (let pass = 0; pass < 2; pass++) {
    const next: MapPoint[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push(p0);

      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (d > maxSegmentLen) {
        const midX = (p0.x + p1.x) * 0.5;
        const midY = (p0.y + p1.y) * 0.5;
        const nx = -(p1.y - p0.y) / d;
        const ny = (p1.x - p0.x) / d;

        // Perturb perpendicular to segment
        const nMag = noise(midX * 0.02, midY * 0.02) * 8 + (rng() - 0.5) * 3;
        next.push({
          x: Math.round(midX + nx * nMag),
          y: Math.round(midY + ny * nMag),
        });
      }
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }

  return pts;
}

/**
 * Subdivides and smooths an open line with fractal noise.
 */
function subdivideOpenLine(
  points: MapPoint[],
  maxSegmentLen: number,
  noise: (x: number, y: number) => number,
  rng: () => number
): MapPoint[] {
  let pts = [...points];

  for (let pass = 0; pass < 2; pass++) {
    const next: MapPoint[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push(p0);

      const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (d > maxSegmentLen) {
        const midX = (p0.x + p1.x) * 0.5;
        const midY = (p0.y + p1.y) * 0.5;
        const nx = -(p1.y - p0.y) / d;
        const ny = (p1.x - p0.x) / d;

        const nMag = noise(midX * 0.02, midY * 0.02) * 6 + (rng() - 0.5) * 2;
        next.push({
          x: Math.round(midX + nx * nMag),
          y: Math.round(midY + ny * nMag),
        });
      }
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }

  return pts;
}

/**
 * Offsets a closed ring outward (positive distance) or inward (negative).
 * Uses averaged vertex normals with a clamped miter so crags remain stable.
 */
function offsetRing(
  ring: MapPoint[],
  distance: number,
  noise?: (x: number, y: number) => number
): MapPoint[] {
  const pts =
    ring.length > 2 &&
    Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y) < 1
      ? ring.slice(0, -1)
      : [...ring];

  if (pts.length < 3) return ring.map((point) => ({ ...point }));

  const normal = (a: MapPoint, b: MapPoint): MapPoint => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dy / len, y: -dx / len };
  };

  const offset: MapPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const n1 = normal(prev, curr);
    const n2 = normal(curr, next);

    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;

    // Miter length grows at sharp corners; cap it so the apron stays clean.
    const miter = Math.min(2.4, 1 / Math.max(0.42, nx * n1.x + ny * n1.y));
    // Vary the belt width per rim vertex. All rings share the same noise
    // field, so the bands stay nested while the outer edge reads as foothills.
    const wobble = noise
      ? 0.78 + (noise(curr.x * 0.017, curr.y * 0.017) + 1) * 0.27
      : 1;
    offset.push({
      x: Math.round(curr.x + nx * distance * miter * wobble),
      y: Math.round(curr.y + ny * distance * miter * wobble),
    });
  }

  offset.push({ ...offset[0] });
  return offset;
}

/**
 * Eroded ridge folds across the table. The reference surface is covered in
 * short, branching wrinkles — not a handful of radial cracks — so we trace
 * many short curved runs and branch some of them.
 */
function generateInteriorRidges(
  rim: MapPoint[],
  rng: () => number,
  noise: (x: number, y: number) => number
): MapPoint[][] {
  if (rim.length < 4) return [];

  const area = calculatePolygonArea(rim);
  const count = Math.max(6, Math.min(24, Math.round(area / 6_500)));
  const bbox = rim.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxX: Math.max(acc.maxX, point.x),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const traceRidge = (start: MapPoint, initialAngle: number, steps: number): MapPoint[] => {
    const path: MapPoint[] = [{ ...start }];
    let current = { ...start };
    let angle = initialAngle;

    for (let step = 0; step < steps; step++) {
      angle +=
        noise(current.x * 0.021, current.y * 0.021) * 0.9 +
        (rng() - 0.5) * 0.34;
      const stepLen = 12 + rng() * 10;
      const next: MapPoint = {
        x: Math.round(current.x + Math.cos(angle) * stepLen),
        y: Math.round(current.y + Math.sin(angle) * stepLen),
      };
      if (!isPointInPolygon(next, rim)) break;
      path.push(next);
      current = next;
    }

    return path.length >= 3 ? smoothPath(path) : [];
  };

  const ridges: MapPoint[][] = [];

  for (let r = 0; r < count; r++) {
    let start: MapPoint | null = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = {
        x: Math.round(bbox.minX + rng() * (bbox.maxX - bbox.minX)),
        y: Math.round(bbox.minY + rng() * (bbox.maxY - bbox.minY)),
      };
      if (isPointInPolygon(candidate, rim)) {
        start = candidate;
        break;
      }
    }
    if (!start) continue;

    const main = traceRidge(start, rng() * Math.PI * 2, 7 + Math.floor(rng() * 5));
    if (main.length === 0) continue;
    ridges.push(main);

    // Branch a third of the folds into a second short wrinkle.
    if (main.length >= 3 && rng() < 0.35) {
      const branchStart = main[Math.floor(rng() * (main.length - 1))];
      const branch = traceRidge(
        branchStart,
        rng() * Math.PI * 2,
        3 + Math.floor(rng() * 3)
      );
      if (branch.length > 0) ridges.push(branch);
    }
  }

  return ridges;
}

/** Chaikin smoothing for short polylines (one or two passes). */
function smoothPath(points: MapPoint[], passes = 2): MapPoint[] {
  let current = points;
  for (let pass = 0; pass < passes; pass++) {
    if (current.length < 3) break;
    const next: MapPoint[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      next.push(
        { x: Math.round(a.x * 0.75 + b.x * 0.25), y: Math.round(a.y * 0.75 + b.y * 0.25) },
        { x: Math.round(a.x * 0.25 + b.x * 0.75), y: Math.round(a.y * 0.25 + b.y * 0.75) }
      );
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/** Short outward strokes that break the rim into rocky teeth and spurs. */
function generateRimSpurs(
  rim: MapPoint[],
  rng: () => number
): [MapPoint, MapPoint][] {
  if (rim.length < 3) return [];

  const spurs: [MapPoint, MapPoint][] = [];
  const step = Math.max(1, Math.floor(rim.length / 12));

  for (let i = 0; i < rim.length - 1; i += step) {
    const a = rim[i];
    const b = rim[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const tangent = { x: dx / len, y: dy / len };
    const normal = { x: tangent.y, y: -tangent.x };
    const length = 8 + rng() * 20;
    const along = (rng() - 0.5) * 5;

    spurs.push([
      { x: Math.round(a.x), y: Math.round(a.y) },
      {
        x: Math.round(a.x + normal.x * length + tangent.x * along),
        y: Math.round(a.y + normal.y * length + tangent.y * along),
      },
    ]);
  }

  return spurs;
}

/**
 * Ensures a polygon loop is counter-clockwise (signed area > 0).
 */
function ensureCCW(pts: MapPoint[]): MapPoint[] {
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    area += (pts[i + 1].x - pts[i].x) * (pts[i + 1].y + pts[i].y);
  }
  if (area > 0) {
    return [...pts].reverse();
  }
  return pts;
}
