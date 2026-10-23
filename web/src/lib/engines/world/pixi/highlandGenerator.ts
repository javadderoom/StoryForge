/**
 * Procedural Highland & Plateau / Mesa Generator
 *
 * Implements flat-topped elevated landforms matching the "GERAMI UPLANDS"
 * from the Faravand fantasy cartography style.
 *
 * Key features:
 * 1. Elevated flat table surface (higher floor than surrounding land, not a pointed mountain).
 * 2. Stepped, hand-inked escarpment cliff edge rims with fault crags.
 * 3. Shaded vertical/slanted rock strata hatching along drop-off faces.
 * 4. Supports both polyline cliff escarpments and closed plateau polygons with multi-tier steps.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface CliffFaceSegment {
  rimPoint: MapPoint;
  basePoint: MapPoint;
  hatchLines: [MapPoint, MapPoint][];
}

export interface ProceduralHighland {
  id: string;
  tablePolygon: MapPoint[]; // Flat elevated surface
  rimPath: MapPoint[]; // Upper hand-inked cliff lip
  cliffDropPolygon: MapPoint[]; // Shaded cliff face band
  strataHatches: [MapPoint, MapPoint][]; // Rock strata hatching lines
  terraceContours?: MapPoint[][]; // Secondary step contours
  elevation: number;
}

export interface HighlandOptions {
  seed?: number;
  cliffHeight?: number; // Height of cliff drop face in pixels (default: 20)
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
      cliffDropPolygon: [],
      strataHatches: [],
      elevation: 600,
    };
  }

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const cliffHeight = Math.max(8, Math.min(60, options.cliffHeight ?? 22));
  const terraceTiers = Math.max(1, Math.min(3, options.terraceTiers ?? 1));

  // Determine if input is a closed polygon or a line escarpment
  const isClosed =
    options.isPolygon ||
    (points.length >= 3 &&
      Math.hypot(
        points[0].x - points[points.length - 1].x,
        points[0].y - points[points.length - 1].y
      ) < 25);

  if (isClosed) {
    return generateClosedPlateau(points, cliffHeight, terraceTiers, rng, noise);
  } else {
    return generateEscarpmentRidge(points, cliffHeight, terraceTiers, rng, noise);
  }
}

/**
 * Generates an elevated plateau polygon with shaded cliff walls on its drop-off edges.
 */
function generateClosedPlateau(
  polygon: MapPoint[],
  cliffHeight: number,
  tiers: number,
  rng: () => number,
  noise: (x: number, y: number) => number
): ProceduralHighland {
  // Ensure closed loop
  const pts = [...polygon];
  if (
    Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) > 5
  ) {
    pts.push(pts[0]);
  }

  // Jitter rim slightly for organic hand-drawn appearance
  const rimPath: MapPoint[] = pts.map((pt, i) => {
    if (i === 0 || i === pts.length - 1) return pt;
    const nx = noise(pt.x * 0.03, pt.y * 0.03) * 3;
    const ny = noise(pt.x * 0.03 + 50, pt.y * 0.03 + 50) * 3;
    return {
      x: Math.round(pt.x + nx),
      y: Math.round(pt.y + ny),
    };
  });

  // Calculate cliff drop face: in classic 2.5D cartography, drop-off shadow falls South/East (+Y / +X)
  const cliffBasePoints: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];

  // Identify southern and eastern edges where cliff walls face the viewer
  for (let i = 0; i < rimPath.length - 1; i++) {
    const p0 = rimPath[i];
    const p1 = rimPath[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const tang = { x: dx / len, y: dy / len };
    const norm = { x: -tang.y, y: tang.x }; // Normal points outward for CCW

    // Cliff drops primarily on edges facing South (+Y) or South-East
    const dropFactor = Math.max(0, norm.y * 0.7 + norm.x * 0.3);
    const dropH = cliffHeight * (0.6 + 0.6 * dropFactor) * (0.85 + 0.3 * rng());

    const basePt: MapPoint = {
      x: Math.round(p0.x + norm.x * (dropH * 0.3)),
      y: Math.round(p0.y + dropH),
    };
    cliffBasePoints.push(basePt);

    // Vertical/slanted strata rock hatch lines
    if (dropFactor > 0.15 && len > 5) {
      const numLines = Math.max(1, Math.floor(len / 4.5));
      for (let j = 0; j < numLines; j++) {
        const t = j / numLines;
        const rx = p0.x + dx * t;
        const ry = p0.y + dy * t;
        const hLen = dropH * (0.75 + 0.35 * rng());
        // Slanted angle ~ 75-85 degrees
        const slantX = (rng() - 0.4) * 3;
        strataHatches.push([
          { x: Math.round(rx), y: Math.round(ry) },
          { x: Math.round(rx + slantX), y: Math.round(ry + hLen) },
        ]);
      }
    }
  }

  // Cliff drop band polygon
  const cliffDropPolygon: MapPoint[] = [
    ...rimPath,
    ...[...cliffBasePoints].reverse(),
  ];

  // Secondary terrace contour step if tiers > 1
  const terraceContours: MapPoint[][] = [];
  if (tiers > 1) {
    const tier2: MapPoint[] = rimPath.map((pt, i) => {
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
    tablePolygon: rimPath,
    rimPath,
    cliffDropPolygon,
    strataHatches,
    terraceContours,
    elevation: 850,
  };
}

/**
 * Generates an escarpment ridge line with cliff drops on one side.
 */
function generateEscarpmentRidge(
  points: MapPoint[],
  cliffHeight: number,
  tiers: number,
  rng: () => number,
  noise: (x: number, y: number) => number
): ProceduralHighland {
  const rimPath: MapPoint[] = [...points];
  const cliffBasePoints: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const tang = { x: dx / len, y: dy / len };
    // Normal to the right of the ridge line
    const norm = { x: -tang.y, y: tang.x };

    const dropH = cliffHeight * (0.8 + 0.4 * rng());
    const base0: MapPoint = {
      x: Math.round(p0.x + norm.x * (dropH * 0.4) + (rng() - 0.5) * 3),
      y: Math.round(p0.y + dropH * 0.8),
    };
    cliffBasePoints.push(base0);

    // Strata hatching
    const numLines = Math.max(2, Math.floor(len / 4.5));
    for (let j = 0; j < numLines; j++) {
      const t = j / numLines;
      const rx = p0.x + dx * t;
      const ry = p0.y + dy * t;
      const hLen = dropH * (0.7 + 0.4 * rng());
      const slantX = norm.x * (hLen * 0.4) + (rng() - 0.5) * 2;
      strataHatches.push([
        { x: Math.round(rx), y: Math.round(ry) },
        { x: Math.round(rx + slantX), y: Math.round(ry + hLen * 0.8) },
      ]);
    }
  }

  // Connect last point
  const lastPt = points[points.length - 1];
  cliffBasePoints.push({
    x: Math.round(lastPt.x + 4),
    y: Math.round(lastPt.y + cliffHeight * 0.8),
  });

  const cliffDropPolygon: MapPoint[] = [
    ...rimPath,
    ...[...cliffBasePoints].reverse(),
  ];

  return {
    id: `escarpment_${Math.round(points[0].x)}_${Math.round(points[0].y)}`,
    tablePolygon: rimPath,
    rimPath,
    cliffDropPolygon,
    strataHatches,
    elevation: 750,
  };
}
