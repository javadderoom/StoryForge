/**
 * canopyMassGenerator.ts
 *
 * Continuous Forest Canopy Massing & Grove Shading
 * (Plan 27 — Module 3.C)
 *
 * Generates continuous cloud-like foliage banks and canopy masses for dense ancient
 * woodlands like Jangal-e Shabnam (جنگل شبنم) and Old Sarvestan:
 * - Scalloped, lobed outer canopy perimeter with organic leafy billows.
 * - Interior elevated woodland groves with multi-lobed bubble hulls.
 * - Sunlit Northwest rim crown highlights (illuminated facing sunlight).
 * - Shaded Southeast flank depth washes with fine ink cross-hatching.
 * - Interior billowing crown crest arcs indicating deep tree volume.
 * - Peripheral sentinel trees feathering the edges into open clearings.
 * - Back-to-front Y-depth sorting for proper painter's algorithm layering.
 */

import type { MapPoint, CanopyMassConfig } from '@/lib/types';
import {
  calculatePolygonArea,
  calculateSignedArea,
  getBoundingBox,
  isPointInPolygon,
} from '../landSculpt/geometry';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface CanopyGrove {
  id: string;
  center: MapPoint;
  perimeterPoly: MapPoint[];
  sunlitPoly: MapPoint[];
  shadowPoly: MapPoint[];
  shadowHatches: [MapPoint, MapPoint][];
  interiorScallops: MapPoint[][];
  area: number;
}

export interface SentinelTree {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: 'deciduous' | 'pine' | 'jungle';
  crownPoly: MapPoint[];
  shadowPoly: MapPoint[];
  trunk: [MapPoint, MapPoint];
}

export interface ProceduralCanopyMass {
  id: string;
  boundary: MapPoint[];
  scallopedBoundary: MapPoint[];
  groves: CanopyGrove[];
  sentinelTrees: SentinelTree[];
  totalArea: number;
  treeKind: 'deciduous' | 'pine' | 'jungle';
}

export interface CanopyMassOptions extends CanopyMassConfig {
  seed?: number;
}

/**
 * Generates a complete procedural continuous canopy mass for a forest/jungle polygon.
 */
export function generateProceduralCanopyMass(
  boundary: MapPoint[],
  options: CanopyMassOptions = {}
): ProceduralCanopyMass | null {
  if (!boundary || boundary.length < 3) return null;

  const totalArea = calculatePolygonArea(boundary);
  if (totalArea < 50) return null;

  const seed = options.seed ?? 42;
  const rng = makeRng(seed);
  const noise = getNoiseFunction(seed);

  const density = options.density ?? 'medium';
  const scallopScale = Math.max(0.5, Math.min(2.0, options.scallopScale ?? 1.0));
  const treeKind = options.treeKind ?? 'deciduous';
  const includeHatches = options.hatchShading !== false;
  const includeSentinelTrees = options.sentinelTrees !== false;

  // 1. Generate scalloped outer perimeter contour
  const scallopedBoundary = generateScallopedContour(boundary, scallopScale, rng);

  // 2. Interior elevated woodland groves
  const aabb = getBoundingBox(boundary);
  const groveSpacing =
    (density === 'dense' ? 36 : density === 'sparse' ? 64 : 48) * scallopScale;

  const groves: CanopyGrove[] = [];
  let groveCounter = 0;

  for (let y = aabb.minY + 20; y <= aabb.maxY - 20; y += groveSpacing * 0.85) {
    for (let x = aabb.minX + 20; x <= aabb.maxX - 20; x += groveSpacing) {
      // Jitter grid
      const jx = Math.round(x + (rng() - 0.5) * groveSpacing * 0.6);
      const jy = Math.round(y + (rng() - 0.5) * groveSpacing * 0.5);
      const center: MapPoint = { x: jx, y: jy };

      if (!isPointInPolygon(center, boundary)) continue;

      const baseRadius = (16 + rng() * 12) * scallopScale;
      const grove = createCanopyGrove(
        `grove_${seed}_${groveCounter++}`,
        center,
        baseRadius,
        treeKind,
        includeHatches,
        rng,
        noise
      );

      // Keep grove if center and primary points stay within woodland bounds
      if (isPointInPolygon(center, boundary)) {
        groves.push(grove);
      }
    }
  }

  // 3. Peripheral Sentinel Trees (feathering the edge clearings)
  const sentinelTrees: SentinelTree[] = [];
  if (includeSentinelTrees) {
    const sentinelCount = Math.max(
      3,
      Math.min(18, Math.round(Math.sqrt(totalArea) * 0.25))
    );

    for (let i = 0; i < sentinelCount; i++) {
      const sx = Math.round(aabb.minX + rng() * (aabb.maxX - aabb.minX));
      const sy = Math.round(aabb.minY + rng() * (aabb.maxY - aabb.minY));
      const pt: MapPoint = { x: sx, y: sy };

      if (!isPointInPolygon(pt, boundary)) continue;

      // Check distance from existing grove centers so trees sit in clearings or near edges
      let nearGrove = false;
      for (const g of groves) {
        if (Math.hypot(sx - g.center.x, sy - g.center.y) < 22 * scallopScale) {
          nearGrove = true;
          break;
        }
      }

      if (nearGrove && rng() > 0.35) continue;

      const radius = (7 + rng() * 5) * scallopScale;
      sentinelTrees.push(
        createSentinelTree(`sentinel_${seed}_${i}`, sx, sy, radius, treeKind, rng)
      );
    }
  }

  // Back-to-front Y-depth sorting
  groves.sort((a, b) => a.center.y - b.center.y);
  sentinelTrees.sort((a, b) => a.y - b.y);

  return {
    id: `canopy_mass_${seed}`,
    boundary,
    scallopedBoundary,
    groves,
    sentinelTrees,
    totalArea,
    treeKind,
  };
}

/**
 * Transforms a raw polygon into an undulating scalloped cloud canopy contour.
 */
function generateScallopedContour(
  polygon: MapPoint[],
  scallopScale: number,
  rng: () => number
): MapPoint[] {
  const n = polygon.length;
  if (n < 3) return polygon;

  // Ensure CCW orientation
  const signedArea = calculateSignedArea(polygon);
  const pts = signedArea < 0 ? [...polygon].reverse() : polygon;

  const targetLobeLen = 16 * scallopScale;
  const result: MapPoint[] = [];

  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const edgeLen = Math.hypot(dx, dy) || 1e-4;

    const numLobes = Math.max(1, Math.round(edgeLen / targetLobeLen));
    const lobeStep = edgeLen / numLobes;

    const ux = dx / edgeLen;
    const uy = dy / edgeLen;
    // Outward normal for CCW
    const nx = uy;
    const ny = -ux;

    for (let k = 0; k < numLobes; k++) {
      const s0 = k * lobeStep;
      const s1 = (k + 1) * lobeStep;
      const smid = (s0 + s1) * 0.5;

      const x0 = p1.x + ux * s0;
      const y0 = p1.y + uy * s0;
      const x1 = p1.x + ux * s1;
      const y1 = p1.y + uy * s1;

      // Parabolic outward bulge
      const bulge = (3.5 + rng() * 2.5) * scallopScale;
      const xmid = p1.x + ux * smid + nx * bulge;
      const ymid = p1.y + uy * smid + ny * bulge;

      if (k === 0 && result.length === 0) {
        result.push({ x: Math.round(x0 * 10) / 10, y: Math.round(y0 * 10) / 10 });
      }

      // Midpoint arc
      result.push({ x: Math.round(xmid * 10) / 10, y: Math.round(ymid * 10) / 10 });
      result.push({ x: Math.round(x1 * 10) / 10, y: Math.round(y1 * 10) / 10 });
    }
  }

  return result;
}

/**
 * Creates an elevated, multi-lobed interior canopy grove with sunlit NW rim
 * and shaded SE flank.
 */
function createCanopyGrove(
  id: string,
  center: MapPoint,
  radius: number,
  kind: 'deciduous' | 'pine' | 'jungle',
  includeHatches: boolean,
  rng: () => number,
  noise: (x: number, y: number) => number
): CanopyGrove {
  const numLobes = kind === 'pine' ? 5 : 7;
  const perimeterPoly: MapPoint[] = [];

  for (let i = 0; i < numLobes * 2; i++) {
    const angle = (i / (numLobes * 2)) * Math.PI * 2;
    const lobeMod = 0.85 + 0.25 * Math.sin(numLobes * angle);
    const noiseVal = 0.12 * noise(center.x * 0.05 + Math.cos(angle), center.y * 0.05 + Math.sin(angle));
    const r = radius * (lobeMod + noiseVal);

    const px = center.x + r * Math.cos(angle);
    const py = center.y + r * Math.sin(angle) * (kind === 'pine' ? 1.15 : 0.85);

    perimeterPoly.push({
      x: Math.round(px * 10) / 10,
      y: Math.round(py * 10) / 10,
    });
  }

  // 1. Sunlit Northwest Rim (facing -X, -Y)
  // Angles between 3*PI/4 (135°) and 5*PI/4 (225°)
  const sunlitPoly: MapPoint[] = [{ x: center.x, y: center.y }];
  for (let i = 0; i <= 4; i++) {
    const angle = Math.PI * 0.8 + (i / 4) * Math.PI * 0.6;
    const r = radius * 1.05;
    sunlitPoly.push({
      x: Math.round((center.x + r * Math.cos(angle)) * 10) / 10,
      y: Math.round((center.y + r * Math.sin(angle) * 0.85) * 10) / 10,
    });
  }

  // 2. Shaded Southeast Flank (facing +X, +Y)
  // Angles between -PI/4 (-45°) and PI/3 (60°)
  const shadowPoly: MapPoint[] = [{ x: center.x, y: center.y }];
  for (let i = 0; i <= 4; i++) {
    const angle = -Math.PI * 0.25 + (i / 4) * Math.PI * 0.7;
    const r = radius * 0.95;
    shadowPoly.push({
      x: Math.round((center.x + r * Math.cos(angle)) * 10) / 10,
      y: Math.round((center.y + r * Math.sin(angle) * 0.85) * 10) / 10,
    });
  }

  // 3. Southeast Shadow Hatching
  const shadowHatches: [MapPoint, MapPoint][] = [];
  if (includeHatches) {
    const hatchCount = 4;
    for (let h = 0; h < hatchCount; h++) {
      const frac = (h + 1) / (hatchCount + 1);
      const hx = center.x + radius * 0.25 + frac * radius * 0.55;
      const hy = center.y + (frac - 0.5) * radius * 0.5;

      shadowHatches.push([
        { x: Math.round(hx), y: Math.round(hy) },
        { x: Math.round(hx + 3.5), y: Math.round(hy + 5.5) },
      ]);
    }
  }

  // 4. Interior Billowing Scallop Arcs (volume crests inside the grove)
  const interiorScallops: MapPoint[][] = [];
  const numInnerArcs = 2;
  for (let a = 0; a < numInnerArcs; a++) {
    const arcRadius = radius * (0.4 + a * 0.25);
    const startAngle = Math.PI * (0.6 + a * 0.2);
    const arcPts: MapPoint[] = [];

    for (let p = 0; p <= 3; p++) {
      const ang = startAngle + (p / 3) * Math.PI * 0.5;
      arcPts.push({
        x: Math.round((center.x + arcRadius * Math.cos(ang)) * 10) / 10,
        y: Math.round((center.y + arcRadius * Math.sin(ang) * 0.85) * 10) / 10,
      });
    }

    interiorScallops.push(arcPts);
  }

  const area = calculatePolygonArea(perimeterPoly);

  return {
    id,
    center,
    perimeterPoly,
    sunlitPoly,
    shadowPoly,
    shadowHatches,
    interiorScallops,
    area,
  };
}

/**
 * Creates a discrete peripheral sentinel tree symbol for edges and clearings.
 */
function createSentinelTree(
  id: string,
  x: number,
  y: number,
  radius: number,
  kind: 'deciduous' | 'pine' | 'jungle',
  rng: () => number
): SentinelTree {
  const crownPoly: MapPoint[] = [];
  const shadowPoly: MapPoint[] = [];

  const trunkH = Math.max(3, Math.round(radius * 0.45));
  const trunk: [MapPoint, MapPoint] = [
    { x, y: y + trunkH },
    { x, y },
  ];

  if (kind === 'pine') {
    // Triangular pine crown
    const h = radius * 1.8;
    const w = radius * 0.9;
    crownPoly.push({ x, y: y - h });
    crownPoly.push({ x: x + w, y });
    crownPoly.push({ x: x - w, y });

    // Eastern half is shadow
    shadowPoly.push({ x, y: y - h });
    shadowPoly.push({ x: x + w, y });
    shadowPoly.push({ x, y });
  } else {
    // Deciduous / jungle cloud crown
    const lobes = 6;
    for (let i = 0; i < lobes; i++) {
      const angle = (i / lobes) * Math.PI * 2;
      const r = radius * (0.8 + 0.35 * rng());
      crownPoly.push({
        x: Math.round(x + r * Math.cos(angle)),
        y: Math.round(y + r * Math.sin(angle) * 0.85),
      });
    }

    shadowPoly.push({ x, y });
    for (let i = 0; i <= 3; i++) {
      const angle = -Math.PI * 0.2 + (i / 3) * Math.PI * 0.8;
      shadowPoly.push({
        x: Math.round(x + radius * 0.9 * Math.cos(angle)),
        y: Math.round(y + radius * 0.75 * Math.sin(angle)),
      });
    }
  }

  return {
    id,
    x,
    y,
    radius: Math.round(radius * 10) / 10,
    kind,
    crownPoly,
    shadowPoly,
    trunk,
  };
}
