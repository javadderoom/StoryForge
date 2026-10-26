/**
 * saltPanGenerator.ts
 *
 * Specialized Biome Shaders & Textures: Salt Pan Playa & Evaporite Flats
 * (Plan 27 — Module 3.A)
 *
 * Generates natural cracked halite crusts and desiccated mud polygons for
 * arid salt pans like Sepidchal (سپیدچال):
 * - Poisson/Lloyd-spaced seeds tessellated into organic Voronoi polygonal plates.
 * - Rigorous Sutherland-Hodgman convex clipping against the playa boundary (zero edge leaks).
 * - Sun-bleached crystalline salt plate interiors.
 * - Concentric evaporation shrinkage rings inside large salt plates.
 * - Dark dried mud/brine halite seams and crystalline salt stipples.
 */

import type { MapPoint } from '@/lib/types';
import {
  calculatePolygonArea,
  getBoundingBox,
  getPolygonCentroid,
  isPointInPolygon,
} from '../landSculpt/geometry';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface SaltCell {
  id: string;
  seed: MapPoint;
  polygon: MapPoint[];
  shrinkageRings: MapPoint[][];
  saltCrystals: MapPoint[];
  area: number;
}

export interface ProceduralSaltPan {
  id: string;
  boundary: MapPoint[];
  cells: SaltCell[];
  crackLines: [MapPoint, MapPoint][];
  totalArea: number;
}

export interface SaltPanOptions {
  seed?: number;
  cellSize?: number; // Average diameter of salt plates in pixels (default: 24)
  roughness?: number; // Seam irregularity factor (0..1, default: 0.25)
  concentricRings?: boolean; // Draw inner evaporation rings (default: true)
  crustBrightness?: number; // 0..1 (default: 0.95)
}

/**
 * Sutherland-Hodgman half-plane clipper for 2D convex polygons.
 * Keeps points on the side of the line (P - M) · N >= 0.
 */
function clipPolygonWithHalfPlane(
  polygon: MapPoint[],
  midpoint: MapPoint,
  normal: MapPoint
): MapPoint[] {
  if (polygon.length < 3) return [];

  const isInside = (p: MapPoint) => {
    return (p.x - midpoint.x) * normal.x + (p.y - midpoint.y) * normal.y >= -1e-6;
  };

  const lineIntersection = (p1: MapPoint, p2: MapPoint): MapPoint => {
    const d1 = (p1.x - midpoint.x) * normal.x + (p1.y - midpoint.y) * normal.y;
    const d2 = (p2.x - midpoint.x) * normal.x + (p2.y - midpoint.y) * normal.y;
    const t = d1 / (d1 - d2);
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    };
  };

  const output: MapPoint[] = [];
  let s = polygon[polygon.length - 1];

  for (let i = 0; i < polygon.length; i++) {
    const e = polygon[i];
    if (isInside(e)) {
      if (isInside(s)) {
        output.push(e);
      } else {
        output.push(lineIntersection(s, e));
        output.push(e);
      }
    } else if (isInside(s)) {
      output.push(lineIntersection(s, e));
    }
    s = e;
  }

  return output;
}

/**
 * Clips a polygon against an arbitrary outer boundary polygon using Sutherland-Hodgman
 * edge-by-edge clipping.
 */
function clipPolygonAgainstBoundary(
  subject: MapPoint[],
  boundary: MapPoint[]
): MapPoint[] {
  if (subject.length < 3 || boundary.length < 3) return [];

  let outputList = subject;

  for (let i = 0; i < boundary.length; i++) {
    const b1 = boundary[i];
    const b2 = boundary[(i + 1) % boundary.length];

    // Outward or inward normal of boundary edge (b1 -> b2)
    const edgeDx = b2.x - b1.x;
    const edgeDy = b2.y - b1.y;
    const len = Math.hypot(edgeDx, edgeDy);
    if (len < 1e-6) continue;

    // Normal pointing inside CCW boundary: (-edgeDy, edgeDx)
    const normal = { x: -edgeDy / len, y: edgeDx / len };

    outputList = clipPolygonWithHalfPlane(outputList, b1, normal);
    if (outputList.length < 3) return [];
  }

  return outputList;
}

/**
 * Formats a spatial hash key for deduplicating crack edges.
 */
function edgeKey(p1: MapPoint, p2: MapPoint): string {
  const x1 = Math.round(p1.x * 2) / 2;
  const y1 = Math.round(p1.y * 2) / 2;
  const x2 = Math.round(p2.x * 2) / 2;
  const y2 = Math.round(p2.y * 2) / 2;

  if (x1 < x2 || (x1 === x2 && y1 <= y2)) {
    return `${x1},${y1}-${x2},${y2}`;
  }
  return `${x2},${y2}-${x1},${y1}`;
}

/**
 * Generates a full ProceduralSaltPan with Voronoi cracked crust and halite seams.
 */
export function generateProceduralSaltPan(
  boundary: MapPoint[],
  options: SaltPanOptions = {}
): ProceduralSaltPan | null {
  if (!boundary || boundary.length < 3) return null;

  const totalArea = calculatePolygonArea(boundary);
  if (totalArea < 25) return null;

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);
  const noise = getNoiseFunction(rawSeed);

  const targetCellSize = Math.max(14, Math.min(60, options.cellSize ?? 24));
  const concentricRings = options.concentricRings !== false;

  // 1. Boundary Bounding Box
  const box = getBoundingBox(boundary);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;

  // 2. Generate Jittered Seed Grid inside Boundary
  const rawSeeds: MapPoint[] = [];
  const step = targetCellSize * 0.95;

  const xSteps = Math.ceil(width / step);
  const ySteps = Math.ceil(height / step);

  for (let ix = 0; ix <= xSteps; ix++) {
    for (let iy = 0; iy <= ySteps; iy++) {
      const baseX = box.minX + ix * step + (iy % 2 === 1 ? step * 0.5 : 0);
      const baseY = box.minY + iy * step;

      const jitterX = (rng() - 0.5) * step * 0.55;
      const jitterY = (rng() - 0.5) * step * 0.55;

      const pt: MapPoint = {
        x: Math.round((baseX + jitterX) * 10) / 10,
        y: Math.round((baseY + jitterY) * 10) / 10,
      };

      // Keep seeds that fall inside or right along boundary
      if (isPointInPolygon(pt, boundary)) {
        rawSeeds.push(pt);
      }
    }
  }

  // Fallback: If boundary is narrow/small and no seeds were captured, use centroid
  if (rawSeeds.length === 0) {
    const centroid = getPolygonCentroid(boundary);
    rawSeeds.push(centroid);
  }

  // 3. Voronoi Half-Plane Clipping for Each Seed
  const cells: SaltCell[] = [];
  const searchRadius = targetCellSize * 2.3;
  const searchRadiusSq = searchRadius * searchRadius;

  const crackEdgeMap = new Map<string, [MapPoint, MapPoint]>();

  for (let i = 0; i < rawSeeds.length; i++) {
    const si = rawSeeds[i];

    // Find neighbor seeds within search radius
    const neighbors: MapPoint[] = [];
    for (let j = 0; j < rawSeeds.length; j++) {
      if (i === j) continue;
      const sj = rawSeeds[j];
      const dx = sj.x - si.x;
      const dy = sj.y - si.y;
      if (dx * dx + dy * dy <= searchRadiusSq) {
        neighbors.push(sj);
      }
    }

    // Initial bounding polygon for cell centered at si
    const h = targetCellSize * 1.5;
    let cellPoly: MapPoint[] = [
      { x: si.x - h, y: si.y - h },
      { x: si.x + h, y: si.y - h },
      { x: si.x + h, y: si.y + h },
      { x: si.x - h, y: si.y + h },
    ];

    // Clip against perpendicular bisectors of neighbors
    for (const sj of neighbors) {
      const mid: MapPoint = {
        x: (si.x + sj.x) * 0.5,
        y: (si.y + sj.y) * 0.5,
      };
      const dx = si.x - sj.x;
      const dy = si.y - sj.y;
      const len = Math.hypot(dx, dy) || 1;
      const normal = { x: dx / len, y: dy / len };

      cellPoly = clipPolygonWithHalfPlane(cellPoly, mid, normal);
      if (cellPoly.length < 3) break;
    }

    if (cellPoly.length < 3) continue;

    // Clip cell polygon against the outer boundary polygon
    // To ensure zero edge leaks outside the salt pan
    let clippedPoly = cellPoly;
    const isFullyInside = cellPoly.every((p) => isPointInPolygon(p, boundary));
    if (!isFullyInside) {
      clippedPoly = clipPolygonAgainstBoundary(cellPoly, boundary);
    }

    if (clippedPoly.length < 3) continue;

    const area = calculatePolygonArea(clippedPoly);
    if (area < 10) continue;

    const centroid = getPolygonCentroid(clippedPoly);

    // 4. Concentric Evaporative Shrinkage Rings inside the cell
    const shrinkageRings: MapPoint[][] = [];
    if (concentricRings && area >= 45) {
      // Primary shrinkage contour
      const ring1: MapPoint[] = clippedPoly.map((p) => ({
        x: Number((centroid.x + (p.x - centroid.x) * 0.55).toFixed(1)),
        y: Number((centroid.y + (p.y - centroid.y) * 0.55).toFixed(1)),
      }));
      shrinkageRings.push(ring1);

      // Secondary shrinkage contour for large plates
      if (area >= 160) {
        const ring2: MapPoint[] = clippedPoly.map((p) => ({
          x: Number((centroid.x + (p.x - centroid.x) * 0.28).toFixed(1)),
          y: Number((centroid.y + (p.y - centroid.y) * 0.28).toFixed(1)),
        }));
        shrinkageRings.push(ring2);
      }
    }

    // 5. Crystalline Salt Crystals (Stipples near center)
    const saltCrystals: MapPoint[] = [];
    const numCrystals = area >= 100 ? 3 : area >= 40 ? 2 : 1;
    for (let c = 0; c < numCrystals; c++) {
      const ang = c * (Math.PI * 2 / numCrystals) + (rawSeed % 7);
      const rad = 2.0 + (c * 1.5);
      saltCrystals.push({
        x: Number((centroid.x + Math.cos(ang) * rad).toFixed(1)),
        y: Number((centroid.y + Math.sin(ang) * rad).toFixed(1)),
      });
    }

    // 6. Collect crack edge lines
    for (let e = 0; e < clippedPoly.length; e++) {
      const pA = clippedPoly[e];
      const pB = clippedPoly[(e + 1) % clippedPoly.length];
      const key = edgeKey(pA, pB);
      if (!crackEdgeMap.has(key)) {
        crackEdgeMap.set(key, [pA, pB]);
      }
    }

    cells.push({
      id: `salt_cell_${i}`,
      seed: si,
      polygon: clippedPoly,
      shrinkageRings,
      saltCrystals,
      area,
    });
  }

  const crackLines = Array.from(crackEdgeMap.values());

  return {
    id: `salt_pan_${Math.round(boundary[0].x)}_${Math.round(boundary[0].y)}`,
    boundary,
    cells,
    crackLines,
    totalArea,
  };
}
