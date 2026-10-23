/**
 * Procedural Mountain & Peak Geometry Generator
 *
 * Implements hand-inked 2.5D isometric fantasy cartography peaks matching
 * the illuminated manuscript aesthetic of classical fantasy maps (e.g. Faravand / Tolkien).
 *
 * Provides:
 * 1. Natural ridge elevation envelope (foothills tapering at endpoints, soaring central massifs).
 * 2. Deterministic pseudo-random variation (asymmetric apex lean, slope widths, crag jitter).
 * 3. Dual-facet directional lighting (sunlit West face + deeply shaded East face with ink hatching).
 * 4. Jagged snowcaps on summits exceeding the elevation snowline.
 * 5. Isometric back-to-front depth sorting based on peak base Y coordinates.
 * 6. Isolated standalone peaks and volcanoes.
 */

import type { MapPoint } from '@/lib/types';
import { makeRng } from '../landSculpt/noise';

export interface ProceduralPeak {
  id: string;
  baseY: number; // For isometric back-to-front depth sorting
  apex: MapPoint;
  leftFoot: MapPoint;
  rightFoot: MapPoint;
  ridgeBase: MapPoint;
  sunlitPoly: MapPoint[];
  shadowPoly: MapPoint[];
  snowcapSunlitPoly?: MapPoint[];
  snowcapShadowPoly?: MapPoint[];
  snowlinePath?: MapPoint[];
  cragSpine: MapPoint[];
  shadowHatchLines: [MapPoint, MapPoint][];
  groundHatchLines: [MapPoint, MapPoint][];
  isVolcano?: boolean;
  scale: number;
}

export interface MountainRangeOptions {
  seed?: number;
  scale?: number; // Base peak height Hmax in pixels (default: 55)
  rangeWidth?: number; // Lateral jitter/flanking width (default: 32)
  hasSnowcaps?: boolean; // Enable snowcaps on high summits (default: true)
  foothillDensity?: number; // Probability of flanking sub-peaks (default: 0.4)
}

/**
 * 32-bit FNV-1a hash function to deterministically derive a numeric seed from any string ID.
 */
export function hashStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Generates a complete chain of procedural 2.5D isometric peaks along an authored polyline spine.
 */
export function generateProceduralMountainRange(
  points: MapPoint[],
  options: MountainRangeOptions = {}
): ProceduralPeak[] {
  if (!points || points.length === 0) return [];

  const rawSeed = options.seed ?? 42;
  const rng = makeRng(rawSeed);

  const baseHmax = Math.max(20, Math.min(120, options.scale ?? 55));
  const rangeWidth = Math.max(10, Math.min(100, options.rangeWidth ?? 32));
  const hasSnowcaps = options.hasSnowcaps ?? true;
  const foothillDensity = Math.max(0, Math.min(1, options.foothillDensity ?? 0.4));

  // Single point fallback: generate a solitary grand massif
  if (points.length === 1) {
    const singlePeak = generateStandalonePeak(
      points[0],
      baseHmax * 0.75,
      'peak',
      rawSeed
    );
    return [singlePeak];
  }

  // 1. Calculate cumulative segment lengths along the spine
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength < 12) {
    const singlePeak = generateStandalonePeak(
      points[0],
      baseHmax * 0.75,
      'peak',
      rawSeed
    );
    return [singlePeak];
  }

  // 2. Sample along the spine with natural overlapping intervals
  // Peak stepping step size is ~0.45 * average peak base width
  const stepDist = Math.max(18, Math.min(45, baseHmax * 0.5));
  const numSteps = Math.max(2, Math.ceil(totalLength / stepDist));

  const peaks: ProceduralPeak[] = [];
  let peakIndex = 0;

  for (let step = 0; step <= numSteps; step++) {
    const targetDist = (step / numSteps) * totalLength;
    const t = targetDist / totalLength; // Normalized 0..1

    // Interpolate position and tangent on spine
    const { point: spinePt, tangent } = getPointAndTangentAtDistance(
      points,
      segmentLengths,
      targetDist
    );

    // Normal vector perpendicular to spine
    const normal = { x: -tangent.y, y: tangent.x };

    // Ridge Elevation Envelope:
    // Natural bell curve: endpoints taper into low rolling foothills, central section rises to summits
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.65);
    const mainHeight = baseHmax * (0.35 + 0.65 * envelope) * (0.8 + 0.4 * rng());

    // Lateral offset for spine peak: staggered slightly across the ridge
    const latOffset = (rng() - 0.5) * rangeWidth * 0.6;
    const peakBaseX = spinePt.x + normal.x * latOffset;
    const peakBaseY = spinePt.y + normal.y * latOffset;

    // Generate primary spine peak
    const peak = createIsometricPeak({
      id: `peak_main_${peakIndex++}`,
      base: { x: Math.round(peakBaseX), y: Math.round(peakBaseY) },
      height: mainHeight,
      rng,
      hasSnowcaps: hasSnowcaps && mainHeight >= baseHmax * 0.45,
    });
    peaks.push(peak);

    // Flanking foothill (sub-peak): natural clustering on either side of the main spine
    if (envelope > 0.3 && rng() < foothillDensity) {
      const side = rng() > 0.5 ? 1 : -1;
      const flankOffset = side * (rangeWidth * (0.45 + 0.35 * rng()));
      const alongJitter = (rng() - 0.5) * stepDist * 0.6;

      const flankX = spinePt.x + normal.x * flankOffset + tangent.x * alongJitter;
      const flankY = spinePt.y + normal.y * flankOffset + tangent.y * alongJitter;
      const flankHeight = mainHeight * (0.45 + 0.35 * rng());

      const flankPeak = createIsometricPeak({
        id: `peak_flank_${peakIndex++}`,
        base: { x: Math.round(flankX), y: Math.round(flankY) },
        height: flankHeight,
        rng,
        hasSnowcaps: hasSnowcaps && flankHeight >= baseHmax * 0.55,
      });
      peaks.push(flankPeak);
    }
  }

  // 3. Strictly sort all peaks by base Y coordinate (back-to-front 2.5D rendering)
  // Ensures background massifs (lower Y) are drawn before foreground peaks (higher Y)
  peaks.sort((a, b) => a.baseY - b.baseY);

  return peaks;
}

/**
 * Generates an isolated standalone mountain peak or volcano.
 */
export function generateStandalonePeak(
  center: MapPoint,
  radius = 35,
  type: 'peak' | 'volcano' = 'peak',
  seed = 42
): ProceduralPeak {
  const rng = makeRng(seed);
  const isVolcano = type === 'volcano';
  const height = radius * 1.5;

  return createIsometricPeak({
    id: `standalone_${Math.round(center.x)}_${Math.round(center.y)}`,
    base: { x: center.x, y: center.y + radius * 0.3 },
    height,
    rng,
    isVolcano,
    hasSnowcaps: !isVolcano && height >= 35,
  });
}

// ============================================================================
// INTERNAL PEAK GEOMETRY & SHADING BUILDER
// ============================================================================

interface CreatePeakParams {
  id: string;
  base: MapPoint;
  height: number;
  rng: () => number;
  isVolcano?: boolean;
  hasSnowcaps?: boolean;
}

function createIsometricPeak({
  id,
  base,
  height,
  rng,
  isVolcano = false,
  hasSnowcaps = false,
}: CreatePeakParams): ProceduralPeak {
  const safeHeight = Math.max(12, height);
  // Base width ratio: 1.25 to 1.75 times the height
  const baseWidth = safeHeight * (1.25 + 0.45 * rng());

  // Apex lean (asymmetry): mountain summit organically leans left or right
  const apexLean = (rng() - 0.5) * 0.28 * baseWidth;
  const apex: MapPoint = {
    x: Math.round(base.x + apexLean),
    y: Math.round(base.y - safeHeight),
  };

  // Base endpoints
  const leftFoot: MapPoint = {
    x: Math.round(base.x - baseWidth * 0.55),
    y: Math.round(base.y),
  };
  const rightFoot: MapPoint = {
    x: Math.round(base.x + baseWidth * 0.55),
    y: Math.round(base.y),
  };

  // Ridge Base point where the central crag meets the ground
  // Slightly lower than the foot line (+8% height) to give authentic 3D perspective
  const ridgeBase: MapPoint = {
    x: Math.round(base.x + (rng() - 0.5) * 0.12 * baseWidth),
    y: Math.round(base.y + safeHeight * 0.08),
  };

  // Central crag spine (jagged dividing ridge connecting apex to base)
  const cragSpine = buildCragSpine(apex, ridgeBase, safeHeight, rng);

  // West slope (sunlit face): Polygon [leftFoot -> apex -> crag spine down -> ridgeBase -> leftFoot]
  const sunlitPoly: MapPoint[] = [leftFoot, apex, ...cragSpine.slice(1, -1), ridgeBase];

  // East slope (shadow face): Polygon [apex -> rightFoot -> ridgeBase -> crag spine up -> apex]
  const shadowPoly: MapPoint[] = [apex, rightFoot, ridgeBase, ...[...cragSpine.slice(1, -1)].reverse()];

  // Hand-inked shadow hatching lines along the East face
  const shadowHatchLines = generateShadowHatching(
    cragSpine,
    apex,
    rightFoot,
    ridgeBase,
    safeHeight,
    rng
  );

  // Grounding ink marks at the base
  const groundHatchLines = generateGroundHatching(leftFoot, rightFoot, ridgeBase, rng);

  // Snowcap geometry (cut at upper 28-35% of the summit)
  let snowcapSunlitPoly: MapPoint[] | undefined;
  let snowcapShadowPoly: MapPoint[] | undefined;
  let snowlinePath: MapPoint[] | undefined;

  if (hasSnowcaps && !isVolcano && safeHeight >= 16) {
    const snowLevel = 0.32; // Upper 32%
    const snowY = apex.y + safeHeight * snowLevel;

    // Cut points on the left silhouette, central crag, and right silhouette
    const snowLeft: MapPoint = {
      x: Math.round(apex.x + (leftFoot.x - apex.x) * snowLevel),
      y: Math.round(snowY),
    };
    const snowRight: MapPoint = {
      x: Math.round(apex.x + (rightFoot.x - apex.x) * snowLevel),
      y: Math.round(snowY),
    };
    const snowCrag: MapPoint = {
      x: Math.round(apex.x + (ridgeBase.x - apex.x) * snowLevel),
      y: Math.round(snowY + (rng() - 0.5) * 3),
    };

    // Jagged crag teeth along the lower snowline
    const midLeftTeeth: MapPoint = {
      x: Math.round((snowLeft.x + snowCrag.x) * 0.5),
      y: Math.round(snowY + 2 + rng() * 3),
    };
    const midRightTeeth: MapPoint = {
      x: Math.round((snowCrag.x + snowRight.x) * 0.5),
      y: Math.round(snowY + 2 + rng() * 3),
    };

    snowcapSunlitPoly = [apex, snowLeft, midLeftTeeth, snowCrag];
    snowcapShadowPoly = [apex, snowCrag, midRightTeeth, snowRight];
    snowlinePath = [snowLeft, midLeftTeeth, snowCrag, midRightTeeth, snowRight];
  }

  return {
    id,
    baseY: base.y,
    apex,
    leftFoot,
    rightFoot,
    ridgeBase,
    sunlitPoly,
    shadowPoly,
    snowcapSunlitPoly,
    snowcapShadowPoly,
    snowlinePath,
    cragSpine,
    shadowHatchLines,
    groundHatchLines,
    isVolcano,
    scale: safeHeight,
  };
}

/**
 * Builds a jagged, organic central dividing crag spine connecting the apex to the ridge base.
 */
function buildCragSpine(
  apex: MapPoint,
  base: MapPoint,
  height: number,
  rng: () => number
): MapPoint[] {
  const steps = Math.max(2, Math.min(5, Math.floor(height / 15)));
  const spine: MapPoint[] = [apex];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const nx = apex.x + (base.x - apex.x) * t;
    const ny = apex.y + (base.y - apex.y) * t;
    // Crag crinkle jitter perpendicular to the ridge slope
    const jitter = (rng() - 0.5) * (height * 0.08);
    spine.push({
      x: Math.round(nx + jitter),
      y: Math.round(ny),
    });
  }

  spine.push(base);
  return spine;
}

/**
 * Generates delicate hand-inked shadow hatch lines descending along the East face of the mountain.
 */
function generateShadowHatching(
  cragSpine: MapPoint[],
  apex: MapPoint,
  rightFoot: MapPoint,
  ridgeBase: MapPoint,
  height: number,
  rng: () => number
): [MapPoint, MapPoint][] {
  const hatchLines: [MapPoint, MapPoint][] = [];
  const lineSpacing = Math.max(3.5, Math.min(6, height * 0.08));
  const count = Math.floor((height * 0.75) / lineSpacing);

  for (let i = 1; i < count; i++) {
    const t = i / count;
    // Start point along the crag spine
    const startY = apex.y + (ridgeBase.y - apex.y) * t;
    const startX = apex.x + (ridgeBase.x - apex.x) * t;

    // End point along the right silhouette slope
    const endY = startY + 1.5 + rng() * 2;
    const slopeT = Math.max(0, Math.min(1, (endY - apex.y) / (rightFoot.y - apex.y)));
    const maxSlopeX = apex.x + (rightFoot.x - apex.x) * slopeT;

    // Hatch line spans 40% to 85% of the shadow slope width
    const lengthFrac = 0.45 + 0.45 * rng();
    const endX = startX + (maxSlopeX - startX) * lengthFrac;

    if (endX > startX + 2 && endY > startY) {
      hatchLines.push([
        { x: Math.round(startX), y: Math.round(startY) },
        { x: Math.round(endX), y: Math.round(endY) },
      ]);
    }
  }

  return hatchLines;
}

/**
 * Generates small horizontal ink grounding strokes at the base of the peak.
 */
function generateGroundHatching(
  leftFoot: MapPoint,
  rightFoot: MapPoint,
  ridgeBase: MapPoint,
  rng: () => number
): [MapPoint, MapPoint][] {
  const groundLines: [MapPoint, MapPoint][] = [];
  const numLines = 2 + Math.floor(rng() * 3);

  for (let i = 0; i < numLines; i++) {
    const t = 0.2 + 0.6 * rng();
    const cx = leftFoot.x + (rightFoot.x - leftFoot.x) * t;
    const cy = ridgeBase.y + 1 + i * 2;
    const len = 4 + rng() * 8;

    groundLines.push([
      { x: Math.round(cx - len * 0.5), y: Math.round(cy) },
      { x: Math.round(cx + len * 0.5), y: Math.round(cy) },
    ]);
  }

  return groundLines;
}

/**
 * Helper to interpolate a point and normalized tangent along a polyline at a given distance.
 */
function getPointAndTangentAtDistance(
  points: MapPoint[],
  segmentLengths: number[],
  dist: number
): { point: MapPoint; tangent: MapPoint } {
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (dist <= accumulated + len || i === segmentLengths.length - 1) {
      const segT = len > 0 ? Math.max(0, Math.min(1, (dist - accumulated) / len)) : 0;
      const p0 = points[i];
      const p1 = points[i + 1];

      const point: MapPoint = {
        x: p0.x + (p1.x - p0.x) * segT,
        y: p0.y + (p1.y - p0.y) * segT,
      };

      const tangent = len > 0 ? { x: (p1.x - p0.x) / len, y: (p1.y - p0.y) / len } : { x: 1, y: 0 };

      return { point, tangent };
    }
    accumulated += len;
  }

  const lastIdx = points.length - 1;
  return {
    point: points[lastIdx],
    tangent: { x: 1, y: 0 },
  };
}
