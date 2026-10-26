/**
 * duneFieldGenerator.ts
 *
 * Specialized Biome Shaders & Textures: Sinuous Barchan Sand Dunes & Windward Ripple Hatching
 * (Plan 27 — Module 3.B)
 *
 * Generates natural, interlocking barchan dune fields for arid sand wastes
 * like Hiram Steppe (دشت هیرام):
 * - Sinuous crescent ridge crests oriented perpendicular to the regional prevailing wind angle.
 * - Catenary crescent crests with curved horns extending downwind.
 * - Shaded leeward slip-face crescent pockets filled with warm ochre/sand shadow wash and cross-hatching.
 * - Parallel windward ripple lines (striae) along the gentle windward slope.
 * - Staggered en-echelon row placement with organic jitter.
 * - Strict polygon boundary containment to prevent edge leaks.
 */

import type { MapPoint, DuneFieldConfig } from '@/lib/types';
import {
  calculatePolygonArea,
  getBoundingBox,
  isPointInPolygon,
} from '../landSculpt/geometry';
import { makeRng, getNoiseFunction } from '../landSculpt/noise';

export interface BarchanDune {
  id: string;
  center: MapPoint;
  width: number;
  length: number;
  crestSpline: MapPoint[];
  leftHorn: MapPoint;
  rightHorn: MapPoint;
  apex: MapPoint;
  slipFacePoly: MapPoint[];
  slipFaceHatches: [MapPoint, MapPoint][];
  windwardRipples: MapPoint[][];
  isMegadune?: boolean;
}

export interface ProceduralDuneField {
  id: string;
  boundary: MapPoint[];
  dunes: BarchanDune[];
  windAngleRad: number;
  totalArea: number;
}

export interface DuneFieldOptions extends DuneFieldConfig {
  seed?: number;
}

/**
 * Generates a complete procedural barchan dune field within an authored polygon.
 */
export function generateProceduralDuneField(
  boundary: MapPoint[],
  options: DuneFieldOptions = {}
): ProceduralDuneField | null {
  if (!boundary || boundary.length < 3) return null;

  const totalArea = calculatePolygonArea(boundary);
  if (totalArea < 50) return null;

  const seed = options.seed ?? 42;
  const rng = makeRng(seed);
  const noise = getNoiseFunction(seed);

  const density = options.density ?? 'medium';
  const duneScale = Math.max(0.4, Math.min(2.5, options.duneScale ?? 1.0));
  const rippleHatching = options.rippleHatching !== false;

  // Prevailing wind direction in radians (default: 35°, blowing north-east)
  const windAngleDeg = options.windAngleDegrees ?? 35;
  const windAngleRad = (windAngleDeg * Math.PI) / 180;

  // Unit wind vector pointing downwind
  const cosW = Math.cos(windAngleRad);
  const sinW = Math.sin(windAngleRad);
  const windX = cosW;
  const windY = sinW;

  // Unit cross-wind normal vector (pointing to the left of wind direction)
  const normX = -sinW;
  const normY = cosW;

  // Spacing parameters based on density
  let baseSpacing = 32;
  let baseWidth = 30;
  if (density === 'dense') {
    baseSpacing = 22;
    baseWidth = 24;
  } else if (density === 'sparse') {
    baseSpacing = 46;
    baseWidth = 42;
  }

  const rowSpacing = baseSpacing * duneScale * 0.9;
  const colSpacing = baseSpacing * duneScale * 1.35;

  const aabb = getBoundingBox(boundary);
  const centerX = (aabb.minX + aabb.maxX) * 0.5;
  const centerY = (aabb.minY + aabb.maxY) * 0.5;
  const diagRadius =
    Math.hypot(aabb.maxX - aabb.minX, aabb.maxY - aabb.minY) * 0.5 + 40;

  const dunes: BarchanDune[] = [];
  let duneCounter = 0;

  // Iterate along wind frame (u across-wind, v downwind)
  let rowIndex = 0;
  for (let v = -diagRadius; v <= diagRadius; v += rowSpacing) {
    const isOddRow = rowIndex % 2 === 1;
    const rowOffset = isOddRow ? colSpacing * 0.5 : 0;
    rowIndex++;

    for (let u = -diagRadius; u <= diagRadius; u += colSpacing) {
      // Jitter grid organically
      const jitterU = (rng() - 0.5) * colSpacing * 0.45;
      const jitterV = (rng() - 0.5) * rowSpacing * 0.35;
      const sampleU = u + rowOffset + jitterU;
      const sampleV = v + jitterV;

      // Transform from wind coordinate system back to map world coordinates
      const worldX = centerX + normX * sampleU + windX * sampleV;
      const worldY = centerY + normY * sampleU + windY * sampleV;
      const duneCenter: MapPoint = {
        x: Math.round(worldX * 10) / 10,
        y: Math.round(worldY * 10) / 10,
      };

      // Check center containment
      if (!isPointInPolygon(duneCenter, boundary)) {
        continue;
      }

      // Occasional "megadune" (prominent barchan ridge)
      const isMegadune = rng() < 0.16;
      const scaleMultiplier = (isMegadune ? 1.35 : 0.85 + rng() * 0.3) * duneScale;
      const width = baseWidth * scaleMultiplier;
      const length = width * (0.44 + rng() * 0.12);

      const dune = createBarchanDune(
        `dune_${seed}_${duneCounter++}`,
        duneCenter,
        width,
        length,
        windX,
        windY,
        normX,
        normY,
        rippleHatching,
        noise,
        isMegadune
      );

      // Verify that primary crest points stay strictly within boundary
      if (
        !isPointInPolygon(dune.apex, boundary) ||
        !isPointInPolygon(dune.leftHorn, boundary) ||
        !isPointInPolygon(dune.rightHorn, boundary)
      ) {
        continue;
      }

      dunes.push(dune);
    }
  }

  // Sort dunes by projection along wind direction so upwind dunes render before downwind dunes
  dunes.sort((a, b) => {
    const projA = a.center.x * windX + a.center.y * windY;
    const projB = b.center.x * windX + b.center.y * windY;
    return projA - projB;
  });

  return {
    id: `dune_field_${seed}`,
    boundary,
    dunes,
    windAngleRad,
    totalArea,
  };
}

/**
 * Computes the geometry of a single barchan dune with crescent crest,
 * leeward slip-face shadow pocket, slip-face hatching, and windward ripple striae.
 */
function createBarchanDune(
  id: string,
  center: MapPoint,
  width: number,
  length: number,
  windX: number,
  windY: number,
  normX: number,
  normY: number,
  includeRipples: boolean,
  noise: (x: number, y: number) => number,
  isMegadune: boolean
): BarchanDune {
  const halfWidth = width * 0.5;

  // 1. Apex (windward frontmost crest point, pointing into the wind: -windVector)
  const apexDist = length * 0.35;
  const apex: MapPoint = {
    x: Math.round((center.x - windX * apexDist) * 10) / 10,
    y: Math.round((center.y - windY * apexDist) * 10) / 10,
  };

  // 2. Horns (curved tips extending downwind: +windVector and +/-normVector)
  const hornDownwindDist = length * 0.65;
  const leftHorn: MapPoint = {
    x: Math.round((center.x + normX * halfWidth + windX * hornDownwindDist) * 10) / 10,
    y: Math.round((center.y + normY * halfWidth + windY * hornDownwindDist) * 10) / 10,
  };
  const rightHorn: MapPoint = {
    x: Math.round((center.x - normX * halfWidth + windX * hornDownwindDist) * 10) / 10,
    y: Math.round((center.y - normY * halfWidth + windY * hornDownwindDist) * 10) / 10,
  };

  // 3. Crest Spline: Parameterized catenary/parabolic curve from right horn (-1) to apex (0) to left horn (+1)
  const numCrestPoints = 9;
  const crestSpline: MapPoint[] = [];

  for (let i = 0; i < numCrestPoints; i++) {
    const t = -1 + (2 * i) / (numCrestPoints - 1); // -1 .. +1
    const u = t * halfWidth; // cross-wind coordinate
    const v = -apexDist + t * t * length; // downwind parabolic arc

    // Subtle natural noise perturbation
    const noiseVal = noise(center.x * 0.05 + i * 0.2, center.y * 0.05);
    const noiseOffset = noiseVal * (length * 0.08);

    const ptX = center.x + normX * u + windX * (v + noiseOffset);
    const ptY = center.y + normY * u + windY * (v + noiseOffset);

    crestSpline.push({
      x: Math.round(ptX * 10) / 10,
      y: Math.round(ptY * 10) / 10,
    });
  }

  // 4. Leeward Slip Face Polygon & Hatch Lines
  // The slip face base forms an inner crescent chord downwind of the crest
  const numBasePoints = 7;
  const slipFaceBasePoints: MapPoint[] = [];

  for (let i = 0; i < numBasePoints; i++) {
    const t = 1 - (2 * i) / (numBasePoints - 1); // +1 (left horn) down to -1 (right horn)
    const u = t * halfWidth * 0.92;
    const vBase = -apexDist + length * 0.45 + t * t * (length * 0.55);

    const ptX = center.x + normX * u + windX * vBase;
    const ptY = center.y + normY * u + windY * vBase;

    slipFaceBasePoints.push({
      x: Math.round(ptX * 10) / 10,
      y: Math.round(ptY * 10) / 10,
    });
  }

  // Enclosed slip-face pocket: crest spline (right to left) followed by base points (left to right)
  const slipFacePoly: MapPoint[] = [
    ...crestSpline,
    ...slipFaceBasePoints,
  ];

  // Fine cross-hatch shading strokes along leeward slope
  const slipFaceHatches: [MapPoint, MapPoint][] = [];
  const hatchCount = isMegadune ? 6 : 4;
  for (let h = 0; h < hatchCount; h++) {
    const frac = (h + 1) / (hatchCount + 1); // 0..1 along crescent
    const crestIdx = Math.min(
      crestSpline.length - 1,
      Math.max(0, Math.floor(frac * (crestSpline.length - 1)))
    );
    const baseIdx = Math.min(
      slipFaceBasePoints.length - 1,
      Math.max(0, Math.floor((1 - frac) * (slipFaceBasePoints.length - 1)))
    );

    slipFaceHatches.push([crestSpline[crestIdx], slipFaceBasePoints[baseIdx]]);
  }

  // 5. Parallel Windward Ripple Lines (Striae)
  const windwardRipples: MapPoint[][] = [];
  if (includeRipples) {
    const numRipples = isMegadune ? 3 : 2;
    for (let r = 1; r <= numRipples; r++) {
      const upwindOffset = r * (length * 0.28);
      const rippleSpan = 1.0 - r * 0.2; // slightly shorter span
      const ripplePts: MapPoint[] = [];
      const ptsCount = 5;

      for (let p = 0; p < ptsCount; p++) {
        const t = (-rippleSpan + (2 * rippleSpan * p) / (ptsCount - 1));
        const u = t * halfWidth;
        const v = -apexDist + t * t * length - upwindOffset;

        const rx = center.x + normX * u + windX * v;
        const ry = center.y + normY * u + windY * v;

        ripplePts.push({
          x: Math.round(rx * 10) / 10,
          y: Math.round(ry * 10) / 10,
        });
      }

      windwardRipples.push(ripplePts);
    }
  }

  return {
    id,
    center,
    width: Math.round(width * 10) / 10,
    length: Math.round(length * 10) / 10,
    crestSpline,
    leftHorn,
    rightHorn,
    apex,
    slipFacePoly,
    slipFaceHatches,
    windwardRipples,
    isMegadune,
  };
}
