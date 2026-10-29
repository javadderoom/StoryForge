/**
 * Procedural Biome Symbols & Flora Generator
 *
 * Implements hand-inked cartography symbols matching the Faravand style
 * (e.g. Old Sarvestan forests, dune deserts, marshlands).
 *
 * Key features:
 * 1. Tree clusters (deciduous, pine, palm) with sunlit West crowns,
 *    deep-inked East shadow hatching, and back-to-front Y-depth sorting.
 * 2. Wind-swept sand dune ridges for deserts.
 * 3. Marsh reed tufts and dark peat hollows for swamps.
 * 4. Point-in-polygon containment to ensure symbols stay cleanly within authored biome bounds.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export type TreeKind = 'deciduous' | 'pine' | 'palm';

export interface ProceduralTree {
  x: number;
  y: number;
  radius: number;
  kind: TreeKind;
  crownPoly: MapPoint[]; // Outer contour
  shadowPoly: MapPoint[]; // Shaded eastern lobe
  hatchLines: [MapPoint, MapPoint][];
  trunk: [MapPoint, MapPoint];
}

export interface SandDuneRidge {
  crestPath: MapPoint[];
  shadowPoly: MapPoint[];
}

export interface MarshReedTuft {
  x: number;
  y: number;
  blades: [MapPoint, MapPoint][];
}

export interface BiomeFeatureSymbols {
  trees: ProceduralTree[];
  sandDunes: SandDuneRidge[];
  marshReeds: MarshReedTuft[];
}

export interface BiomeSymbolOptions {
  seed?: number;
  density?: 'sparse' | 'medium' | 'dense';
  treeKind?: TreeKind;
}

/**
 * Generates procedural fantasy cartography symbols for any biome polygon.
 */
export function generateBiomeSymbols(
  polygon: MapPoint[],
  biomeType: string,
  options: BiomeSymbolOptions = {}
): BiomeFeatureSymbols {
  const result: BiomeFeatureSymbols = {
    trees: [],
    sandDunes: [],
    marshReeds: [],
  };

  if (!polygon || polygon.length < 3) return result;

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);

  // Compute bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of polygon) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 20 || height < 20) return result;

  const density = options.density ?? 'medium';
  const spacing = density === 'dense' ? 24 : density === 'sparse' ? 44 : 32;

  // 1. Forest & Jungle: Clustered Hand-Inked Tree Canopies
  if (biomeType === 'forest' || biomeType === 'jungle' || biomeType === 'oasis') {
    const isJungle = biomeType === 'jungle';
    const isOasis = biomeType === 'oasis';
    const defaultKind: TreeKind = isOasis ? 'palm' : isJungle ? 'deciduous' : (options.treeKind ?? 'deciduous');

    const trees: ProceduralTree[] = [];
    const stepX = spacing;
    const stepY = spacing * 0.85;

    for (let y = minY + 15; y < maxY - 15; y += stepY) {
      for (let x = minX + 15; x < maxX - 15; x += stepX) {
        // Jitter coordinates organically
        const jx = Math.round(x + (rng() - 0.5) * spacing * 0.7);
        const jy = Math.round(y + (rng() - 0.5) * spacing * 0.6);

        if (isPointInPolygon({ x: jx, y: jy }, polygon)) {
          const kind = defaultKind;
          const radius = isJungle ? 11 + rng() * 5 : 8 + rng() * 4;
          trees.push(createTree(jx, jy, radius, kind, rng));
        }
      }
    }

    // Depth sorting strictly by Y: background trees drawn before foreground trees
    trees.sort((a, b) => a.y - b.y);
    result.trees = trees;
    return result;
  }

  // 2. Desert: Wind-swept Sand Dune Ridges
  if (biomeType === 'desert' || biomeType === 'wasteland') {
    const dunes: SandDuneRidge[] = [];
    const duneSpacing = spacing * 1.4;

    for (let y = minY + 20; y < maxY - 20; y += duneSpacing) {
      for (let x = minX + 25; x < maxX - 25; x += duneSpacing * 1.5) {
        const cx = x + (rng() - 0.5) * 20;
        const cy = y + (rng() - 0.5) * 15;

        if (isPointInPolygon({ x: cx, y: cy }, polygon)) {
          const duneLen = 22 + rng() * 20;
          const curveH = 5 + rng() * 4;

          const p0: MapPoint = { x: Math.round(cx - duneLen * 0.5), y: Math.round(cy + curveH * 0.3) };
          const pMid: MapPoint = { x: Math.round(cx), y: Math.round(cy - curveH) };
          const p1: MapPoint = { x: Math.round(cx + duneLen * 0.5), y: Math.round(cy + curveH * 0.5) };

          // Shaded slope down to South-East
          const shadowBase: MapPoint = {
            x: Math.round(cx + 3),
            y: Math.round(cy + curveH * 0.8),
          };

          dunes.push({
            crestPath: [p0, pMid, p1],
            shadowPoly: [p0, pMid, p1, shadowBase],
          });
        }
      }
    }

    result.sandDunes = dunes;
    return result;
  }

  // 3. Swamp / Wetland: Tufted Marsh Reeds
  if (biomeType === 'swamp') {
    const reeds: MarshReedTuft[] = [];
    const reedSpacing = spacing * 1.1;

    for (let y = minY + 15; y < maxY - 15; y += reedSpacing) {
      for (let x = minX + 15; x < maxX - 15; x += reedSpacing) {
        const cx = Math.round(x + (rng() - 0.5) * 18);
        const cy = Math.round(y + (rng() - 0.5) * 18);

        if (isPointInPolygon({ x: cx, y: cy }, polygon)) {
          const h = 7 + rng() * 5;
          reeds.push({
            x: cx,
            y: cy,
            blades: [
              [{ x: cx, y: cy }, { x: cx, y: cy - h }],
              [{ x: cx - 2, y: cy }, { x: cx - 4, y: cy - h * 0.85 }],
              [{ x: cx + 2, y: cy }, { x: cx + 4, y: cy - h * 0.85 }],
            ],
          });
        }
      }
    }

    result.marshReeds = reeds;
    return result;
  }

  return result;
}

/**
 * Creates an individual hand-drawn tree symbol with shaded East lobe.
 */
export function createTree(
  x: number,
  y: number,
  radius: number,
  kind: TreeKind,
  rng: () => number
): ProceduralTree {
  const crownPoly: MapPoint[] = [];
  const shadowPoly: MapPoint[] = [];
  const hatchLines: [MapPoint, MapPoint][] = [];

  const trunkH = Math.max(3, Math.round(radius * 0.45));
  const trunk: [MapPoint, MapPoint] = [
    { x, y: y + trunkH },
    { x, y },
  ];

  if (kind === 'deciduous') {
    // 6-8 lobed cloud crown
    const lobes = 7;
    for (let i = 0; i < lobes; i++) {
      const angle = (i / lobes) * Math.PI * 2;
      const r = radius * (0.8 + 0.35 * rng());
      crownPoly.push({
        x: Math.round(x + r * Math.cos(angle)),
        y: Math.round(y + r * Math.sin(angle) * 0.85), // slightly squashed vertically
      });
    }

    // Shadow face on Eastern side (angle between -PI/4 and PI/2)
    shadowPoly.push({ x, y });
    for (let i = 0; i <= 3; i++) {
      const angle = -Math.PI * 0.2 + (i / 3) * Math.PI * 0.8;
      shadowPoly.push({
        x: Math.round(x + radius * 0.9 * Math.cos(angle)),
        y: Math.round(y + radius * 0.75 * Math.sin(angle)),
      });
    }

    // Cross-hatching on eastern shadow lobe
    const numHatches = 3;
    for (let i = 0; i < numHatches; i++) {
      const t = 0.2 + (i / numHatches) * 0.7;
      const hx = x + radius * 0.25 * t;
      const hy = y - radius * 0.3 + i * 3;
      hatchLines.push([
        { x: Math.round(hx), y: Math.round(hy) },
        { x: Math.round(hx + radius * 0.5), y: Math.round(hy + 2) },
      ]);
    }
  } else if (kind === 'pine') {
    // Tiered triangular conifer spire
    const h = radius * 1.8;
    const apex: MapPoint = { x, y: Math.round(y - h) };
    const left: MapPoint = { x: Math.round(x - radius), y: Math.round(y) };
    const right: MapPoint = { x: Math.round(x + radius), y: Math.round(y) };

    crownPoly.push(apex, left, { x, y: Math.round(y + 1) }, right);
    // East slope is shadowed
    shadowPoly.push(apex, { x, y: Math.round(y + 1) }, right);

    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const sy = apex.y + h * t;
      hatchLines.push([
        { x, y: Math.round(sy) },
        { x: Math.round(x + radius * t * 0.8), y: Math.round(sy + 1.5) },
      ]);
    }
  } else {
    // Palm fronds
    crownPoly.push({ x, y });
    const fronds = 5;
    for (let i = 0; i < fronds; i++) {
      const angle = -Math.PI * 0.8 + (i / (fronds - 1)) * Math.PI * 1.6;
      const frondLen = radius * 1.3;
      crownPoly.push({
        x: Math.round(x + frondLen * Math.cos(angle)),
        y: Math.round(y + frondLen * Math.sin(angle) * 0.7),
      });
    }
  }

  return {
    x,
    y,
    radius,
    kind,
    crownPoly,
    shadowPoly,
    hatchLines,
    trunk,
  };
}

/**
 * Standard ray-casting point-in-polygon test.
 */
function isPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface BiomeStrokeSymbolOptions {
  seed?: number;
  width?: number; // corridor width in pixels (e.g. 15 to 80, default 30)
  density?: 'sparse' | 'medium' | 'dense';
  treeKind?: TreeKind;
}

/**
 * Generates procedural fantasy cartography symbols along a stroke path or at a single point coordinate.
 * Ideal for linear tree belts along shorelines/rivers/roads, and single-click standalone trees or copses.
 */
export function generateBiomeStrokeSymbols(
  points: MapPoint[],
  biomeType: string,
  options: BiomeStrokeSymbolOptions = {}
): BiomeFeatureSymbols {
  const result: BiomeFeatureSymbols = {
    trees: [],
    sandDunes: [],
    marshReeds: [],
  };

  if (!points || points.length === 0) return result;

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);

  const isJungle = biomeType === 'jungle';
  const isOasis = biomeType === 'oasis';
  const isTundra = biomeType === 'tundra';
  const defaultKind: TreeKind = isOasis ? 'palm' : isTundra ? 'pine' : (options.treeKind ?? 'deciduous');
  const width = Math.max(10, options.width ?? 30);
  const density = options.density ?? 'medium';

  // 1. SINGLE-POINT CLICK STAMP
  if (points.length === 1) {
    const pt = points[0];
    if (
      biomeType === 'forest' ||
      biomeType === 'jungle' ||
      biomeType === 'oasis' ||
      biomeType === 'tundra' ||
      biomeType === 'plains'
    ) {
      const baseRadius = isJungle ? 12 : 9;
      // If narrow corridor (<= 20px), place 1 single standalone tree
      if (width <= 20) {
        result.trees.push(createTree(pt.x, pt.y, baseRadius + rng() * 2, defaultKind, rng));
      } else {
        // Tight copse of 3 trees
        result.trees.push(createTree(pt.x, pt.y - 4, baseRadius, defaultKind, rng));
        result.trees.push(
          createTree(Math.round(pt.x - width * 0.28), Math.round(pt.y + 3), baseRadius * 0.9, defaultKind, rng)
        );
        result.trees.push(
          createTree(Math.round(pt.x + width * 0.3), Math.round(pt.y + 4), baseRadius * 0.95, defaultKind, rng)
        );
      }
      result.trees.sort((a, b) => a.y - b.y);
      return result;
    }

    if (biomeType === 'desert' || biomeType === 'wasteland') {
      const duneLen = 24 + rng() * 10;
      const curveH = 5 + rng() * 3;
      const p0: MapPoint = { x: Math.round(pt.x - duneLen * 0.5), y: Math.round(pt.y + curveH * 0.3) };
      const pMid: MapPoint = { x: Math.round(pt.x), y: Math.round(pt.y - curveH) };
      const p1: MapPoint = { x: Math.round(pt.x + duneLen * 0.5), y: Math.round(pt.y + curveH * 0.5) };
      result.sandDunes.push({
        crestPath: [p0, pMid, p1],
        shadowPoly: [p0, pMid, p1, { x: Math.round(pt.x + 3), y: Math.round(pt.y + curveH * 0.8) }],
      });
      return result;
    }

    if (biomeType === 'swamp') {
      const h = 8 + rng() * 4;
      result.marshReeds.push({
        x: pt.x,
        y: pt.y,
        blades: [
          [{ x: pt.x, y: pt.y }, { x: pt.x, y: pt.y - h }],
          [{ x: pt.x - 2, y: pt.y }, { x: pt.x - 4, y: pt.y - h * 0.85 }],
          [{ x: pt.x + 2, y: pt.y }, { x: pt.x + 4, y: pt.y - h * 0.85 }],
        ],
      });
      return result;
    }

    return result;
  }

  // 2. POLYLINE STROKE CORRIDOR
  // Calculate total path distance and segment lengths
  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(d);
    totalLength += d;
  }

  if (totalLength <= 0) return result;

  // Spacing between symbol steps along the stroke
  const spacing = density === 'dense' ? 18 : density === 'sparse' ? 34 : 24;
  const numSteps = Math.max(1, Math.round(totalLength / spacing));
  const stepDist = totalLength / numSteps;

  const sampleAtDist = (targetDist: number): { pt: MapPoint; norm: MapPoint; tang: MapPoint } => {
    let accumulated = 0;
    for (let i = 0; i < segLengths.length; i++) {
      const segLen = segLengths[i];
      if (accumulated + segLen >= targetDist || i === segLengths.length - 1) {
        const segRemain = targetDist - accumulated;
        const t = segLen > 0 ? Math.max(0, Math.min(1, segRemain / segLen)) : 0;
        const p0 = points[i];
        const p1 = points[i + 1];
        const px = p0.x + (p1.x - p0.x) * t;
        const py = p0.y + (p1.y - p0.y) * t;
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        return {
          pt: { x: px, y: py },
          norm: { x: -Math.sin(angle), y: Math.cos(angle) },
          tang: { x: Math.cos(angle), y: Math.sin(angle) },
        };
      }
      accumulated += segLen;
    }
    const last = points[points.length - 1];
    return { pt: last, norm: { x: 0, y: -1 }, tang: { x: 1, y: 0 } };
  };

  // Trees (Forest, Jungle, Oasis, Tundra, Plains)
  if (
    biomeType === 'forest' ||
    biomeType === 'jungle' ||
    biomeType === 'oasis' ||
    biomeType === 'tundra' ||
    biomeType === 'plains'
  ) {
    const trees: ProceduralTree[] = [];
    const baseRadius = isJungle ? 11 : 8.5;

    for (let s = 0; s <= numSteps; s++) {
      const curDist = s * stepDist;
      const { pt, norm, tang } = sampleAtDist(curDist);

      if (width <= 16) {
        // Single row of trees along the spine
        const offset = (rng() - 0.5) * width * 0.7;
        const tx = Math.round(pt.x + norm.x * offset + tang.x * (rng() - 0.5) * 6);
        const ty = Math.round(pt.y + norm.y * offset + tang.y * (rng() - 0.5) * 6);
        const radius = baseRadius + rng() * 3.5;
        trees.push(createTree(tx, ty, radius, defaultKind, rng));
      } else {
        // Multi-tree copse across corridor width
        const treesAcross = Math.max(1, Math.min(3, Math.round(width / 22)));
        for (let k = 0; k < treesAcross; k++) {
          const spreadFactor = ((k + 0.5) / treesAcross - 0.5) * width * 0.85;
          const tx = Math.round(pt.x + norm.x * spreadFactor + tang.x * (rng() - 0.5) * 8);
          const ty = Math.round(pt.y + norm.y * spreadFactor + tang.y * (rng() - 0.5) * 8);
          const radius = baseRadius + rng() * 3.5;
          trees.push(createTree(tx, ty, radius, defaultKind, rng));
        }
      }
    }

    trees.sort((a, b) => a.y - b.y);
    result.trees = trees;
    return result;
  }

  // Sand Dunes along stroke
  if (biomeType === 'desert' || biomeType === 'wasteland') {
    const dunes: SandDuneRidge[] = [];
    const duneStep = spacing * 1.3;
    const duneCount = Math.max(1, Math.round(totalLength / duneStep));

    for (let s = 0; s <= duneCount; s++) {
      const curDist = s * (totalLength / duneCount);
      const { pt } = sampleAtDist(curDist);
      const duneLen = 20 + rng() * 16;
      const curveH = 4 + rng() * 3;
      const cx = pt.x + (rng() - 0.5) * (width * 0.4);
      const cy = pt.y + (rng() - 0.5) * (width * 0.4);

      const p0: MapPoint = { x: Math.round(cx - duneLen * 0.5), y: Math.round(cy + curveH * 0.3) };
      const pMid: MapPoint = { x: Math.round(cx), y: Math.round(cy - curveH) };
      const p1: MapPoint = { x: Math.round(cx + duneLen * 0.5), y: Math.round(cy + curveH * 0.5) };

      dunes.push({
        crestPath: [p0, pMid, p1],
        shadowPoly: [p0, pMid, p1, { x: Math.round(cx + 3), y: Math.round(cy + curveH * 0.8) }],
      });
    }

    result.sandDunes = dunes;
    return result;
  }

  // Swamp Marsh Reeds along stroke
  if (biomeType === 'swamp') {
    const reeds: MarshReedTuft[] = [];
    for (let s = 0; s <= numSteps; s++) {
      const curDist = s * stepDist;
      const { pt, norm } = sampleAtDist(curDist);
      const offset = (rng() - 0.5) * width * 0.8;
      const cx = Math.round(pt.x + norm.x * offset);
      const cy = Math.round(pt.y + norm.y * offset);
      const h = 7 + rng() * 4;
      reeds.push({
        x: cx,
        y: cy,
        blades: [
          [{ x: cx, y: cy }, { x: cx, y: cy - h }],
          [{ x: cx - 2, y: cy }, { x: cx - 4, y: cy - h * 0.85 }],
          [{ x: cx + 2, y: cy }, { x: cx + 4, y: cy - h * 0.85 }],
        ],
      });
    }

    result.marshReeds = reeds;
    return result;
  }

  return result;
}
