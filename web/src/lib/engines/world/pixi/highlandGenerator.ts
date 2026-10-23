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

  const cliffHeight = Math.max(10, Math.min(60, options.cliffHeight ?? 22));
  const terraceTiers = Math.max(1, Math.min(3, options.terraceTiers ?? 1));

  // Determine if input is a closed polygon or a line escarpment
  const isClosed =
    options.isPolygon ||
    (points.length >= 3 &&
      Math.hypot(
        points[0].x - points[points.length - 1].x,
        points[0].y - points[points.length - 1].y
      ) < 40);

  if (isClosed) {
    return generateOrganicClosedPlateau(points, cliffHeight, terraceTiers, rng, noise);
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
  noise: (x: number, y: number) => number
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
  const organicRim = subdivideAndJitter(ccwPts, 16, noise, rng);

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

  // 6. Build rocky cliff buttresses along scarp edges (facing S/SE away from NW sun)
  const buttresses: HighlandButtress[] = [];
  const cliffBasePoints: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];
  const talusLine: MapPoint[] = [];

  for (let i = 0; i < organicRim.length - 1; i++) {
    const p0 = organicRim[i];
    const p1 = organicRim[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const tang = { x: dx / segLen, y: dy / segLen };
    const norm = { x: -tang.y, y: tang.x }; // Outward normal

    // Lighting factor: NW sun shines from (-1, -1).
    // Outward edges pointing South (+Y) or East (+X) face the viewer and drop deep shadows.
    // Outward edges pointing North/West face the sun.
    const shadowFactor = Math.max(0, norm.y * 0.75 + norm.x * 0.35 + 0.1);
    const dropDist = cliffHeight * (0.55 + 0.55 * shadowFactor) * (0.85 + 0.3 * rng());

    // Base point for cliff foot
    const basePt: MapPoint = {
      x: Math.round(p0.x + norm.x * (dropDist * 0.4) + dropDist * 0.15),
      y: Math.round(p0.y + norm.y * (dropDist * 0.2) + dropDist * 0.85),
    };
    cliffBasePoints.push(basePt);

    // If edge drops cliff face:
    if (shadowFactor > 0.08 && segLen >= 8) {
      const numSteps = Math.max(1, Math.floor(segLen / 16));
      for (let s = 0; s < numSteps; s++) {
        const t = (s + 0.5) / numSteps;
        const rimX = p0.x + dx * t;
        const rimY = p0.y + dy * t;
        const toothH = dropDist * (0.8 + 0.35 * rng());

        const apexPt: MapPoint = { x: Math.round(rimX), y: Math.round(rimY) };
        const toePt: MapPoint = {
          x: Math.round(rimX + norm.x * (toothH * 0.35) + toothH * 0.12),
          y: Math.round(rimY + toothH * 0.85),
        };
        const leftBasePt: MapPoint = {
          x: Math.round(toePt.x - tang.x * 6),
          y: Math.round(toePt.y - tang.y * 3),
        };
        const rightBasePt: MapPoint = {
          x: Math.round(toePt.x + tang.x * 6),
          y: Math.round(toePt.y + tang.y * 3),
        };

        // Chisel strata rock lines (2-3 short slanted strokes, NOT long needle beards!)
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
  }

  // Complete cliff drop polygon
  const cliffDropPolygon: MapPoint[] = [
    ...organicRim,
    ...[...cliffBasePoints].reverse(),
  ];

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
    const norm = { x: -tang.y, y: tang.x };

    const dropDist = cliffHeight * (0.8 + 0.35 * rng());
    const basePt: MapPoint = {
      x: Math.round(p0.x + norm.x * (dropDist * 0.4) + dropDist * 0.15),
      y: Math.round(p0.y + norm.y * (dropDist * 0.2) + dropDist * 0.85),
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
        x: Math.round(rimX + norm.x * (toothH * 0.35) + toothH * 0.12),
        y: Math.round(rimY + toothH * 0.85),
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
  cliffBasePoints.push({
    x: Math.round(lastPt.x + 4),
    y: Math.round(lastPt.y + cliffHeight * 0.8),
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
        const nMag = noise(midX * 0.02, midY * 0.02) * 5 + (rng() - 0.5) * 2;
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

        const nMag = noise(midX * 0.02, midY * 0.02) * 4 + (rng() - 0.5) * 2;
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
