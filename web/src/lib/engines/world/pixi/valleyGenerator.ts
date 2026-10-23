/**
 * Procedural Valley, Canyon & Chasm Generator
 *
 * Implements sunken rift clefts and rocky gorges with dual fault lips,
 * interior rock strata hatching, and dark crevasse shadow floors.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface ProceduralValley {
  id: string;
  gorgePolygon: MapPoint[]; // Sunken floor polygon
  leftRim: MapPoint[]; // North/West upper fault lip
  rightRim: MapPoint[]; // South/East upper fault lip
  centerCrevasse: MapPoint[]; // Dark bottom cleft line
  strataHatches: [MapPoint, MapPoint][]; // Inward-facing cliff strata
  width: number;
}

export interface ValleyOptions {
  seed?: number;
  width?: number; // Total gorge width (default: 28)
  depth?: number; // Cleft depth factor 0..1 (default: 0.6)
}

/**
 * Generates a sunken rift canyon with dual cliff lips and inward strata hatching.
 */
export function generateProceduralValley(
  points: MapPoint[],
  options: ValleyOptions = {}
): ProceduralValley {
  if (!points || points.length < 2) {
    return {
      id: 'valley_empty',
      gorgePolygon: points || [],
      leftRim: points || [],
      rightRim: points || [],
      centerCrevasse: points || [],
      strataHatches: [],
      width: 28,
    };
  }

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const gorgeWidth = Math.max(12, Math.min(80, options.width ?? 28));
  const halfW = gorgeWidth * 0.5;

  const leftRim: MapPoint[] = [];
  const rightRim: MapPoint[] = [];
  const centerCrevasse: MapPoint[] = [];
  const strataHatches: [MapPoint, MapPoint][] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    // Tangent calculation
    let tx = 0;
    let ty = 0;
    if (i === 0) {
      tx = points[1].x - points[0].x;
      ty = points[1].y - points[0].y;
    } else if (i === points.length - 1) {
      tx = points[i].x - points[i - 1].x;
      ty = points[i].y - points[i - 1].y;
    } else {
      tx = points[i + 1].x - points[i - 1].x;
      ty = points[i + 1].y - points[i - 1].y;
    }

    const tLen = Math.hypot(tx, ty) || 1;
    tx /= tLen;
    ty /= tLen;
    const norm = { x: -ty, y: tx };

    // Jittered rim fault points
    const crag1 = noise(pt.x * 0.05, pt.y * 0.05) * 3;
    const crag2 = noise(pt.x * 0.05 + 80, pt.y * 0.05 + 80) * 3;

    const lPt: MapPoint = {
      x: Math.round(pt.x - norm.x * (halfW + crag1)),
      y: Math.round(pt.y - norm.y * (halfW + crag1)),
    };
    const rPt: MapPoint = {
      x: Math.round(pt.x + norm.x * (halfW + crag2)),
      y: Math.round(pt.y + norm.y * (halfW + crag2)),
    };

    leftRim.push(lPt);
    rightRim.push(rPt);

    const cleftJitter = (rng() - 0.5) * (halfW * 0.25);
    const cPt: MapPoint = {
      x: Math.round(pt.x + norm.x * cleftJitter),
      y: Math.round(pt.y + norm.y * cleftJitter),
    };
    centerCrevasse.push(cPt);

    // Inward rock strata hatch lines
    if (i > 0) {
      // Left rim hatch inward
      const hLenL = halfW * (0.35 + 0.35 * rng());
      strataHatches.push([
        lPt,
        {
          x: Math.round(lPt.x + norm.x * hLenL),
          y: Math.round(lPt.y + norm.y * hLenL),
        },
      ]);

      // Right rim hatch inward (more heavily shaded since it faces South/East)
      const hLenR = halfW * (0.45 + 0.45 * rng());
      strataHatches.push([
        rPt,
        {
          x: Math.round(rPt.x - norm.x * hLenR),
          y: Math.round(rPt.y - norm.y * hLenR),
        },
      ]);
    }
  }

  // Closed gorge floor polygon
  const gorgePolygon: MapPoint[] = [
    ...leftRim,
    ...[...rightRim].reverse(),
  ];

  return {
    id: `valley_${Math.round(points[0].x)}_${Math.round(points[0].y)}`,
    gorgePolygon,
    leftRim,
    rightRim,
    centerCrevasse,
    strataHatches,
    width: gorgeWidth,
  };
}
