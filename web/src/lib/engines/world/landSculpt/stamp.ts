import type { MapPoint } from '@/lib/types';
import { getNoiseFunction } from './noise';

// ============================================================================
// 2. STROKE INTERPOLATION & ORGANIC STAMP GENERATION
// ============================================================================

export const MAX_INTERPOLATION_STEPS = 2000;

/**
 * Interpolates discrete mouse pointer movements into dense sub-step coordinates.
 * Eliminates gaps and beading when dragging rapidly across the map canvas.
 *
 * @param p0 Start point
 * @param p1 End point
 * @param stepSize Maximum distance between adjacent interpolated points
 * @param optionsOrIncludeStart Boolean or options object specifying whether to include p0 (default true)
 * @returns Array of dense intermediate points
 */
export function interpolateStrokePoints(
  p0: MapPoint,
  p1: MapPoint,
  stepSize: number,
  optionsOrIncludeStart: boolean | { includeStart?: boolean } = true
): MapPoint[] {
  const includeStart =
    typeof optionsOrIncludeStart === 'boolean'
      ? optionsOrIncludeStart
      : optionsOrIncludeStart?.includeStart ?? true;

  // Guard against non-finite (NaN, Infinity) coordinates
  if (
    !p0 ||
    !p1 ||
    !Number.isFinite(p0.x) ||
    !Number.isFinite(p0.y) ||
    !Number.isFinite(p1.x) ||
    !Number.isFinite(p1.y)
  ) {
    if (!includeStart) return [];
    const safeX = Number.isFinite(p0?.x) ? Math.round(p0.x) : 0;
    const safeY = Number.isFinite(p0?.y) ? Math.round(p0.y) : 0;
    return [{ x: safeX, y: safeY }];
  }

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.hypot(dx, dy);

  const roundedP0: MapPoint = { x: Math.round(p0.x), y: Math.round(p0.y) };
  const roundedP1: MapPoint = { x: Math.round(p1.x), y: Math.round(p1.y) };

  if (dist === 0 || !Number.isFinite(dist)) {
    return includeStart ? [roundedP0] : [];
  }

  const effectiveStep = Math.max(1, Number.isFinite(stepSize) && stepSize > 0 ? stepSize : 10);
  const rawSteps = Math.ceil(dist / effectiveStep);
  const steps = Math.min(
    MAX_INTERPOLATION_STEPS,
    Math.max(1, Number.isFinite(rawSteps) ? rawSteps : 1)
  );
  const points: MapPoint[] = [];

  const startIdx = includeStart ? 0 : 1;
  for (let i = startIdx; i <= steps; i++) {
    const t = i / steps;
    const pt: MapPoint =
      i === 0
        ? roundedP0
        : i === steps
        ? roundedP1
        : {
            x: Math.round(p0.x + t * dx),
            y: Math.round(p0.y + t * dy),
          };

    if (
      points.length === 0 ||
      points[points.length - 1].x !== pt.x ||
      points[points.length - 1].y !== pt.y
    ) {
      points.push(pt);
    }
  }

  return points;
}

/**
 * Generates an organic radial polygon stamp centered at (cx, cy) perturbed by Simplex noise.
 * Guaranteed 100% seamless closed loop (sampled on unit circle in 2D noise space) and strictly
 * star-convex (no self-intersections or degenerate folds).
 *
 * @param cx Center X coordinate
 * @param cy Center Y coordinate
 * @param radius Base radius in map pixels
 * @param roughness Modulation factor (0.0 = smooth circle, 1.0 = rugged coastline)
 * @param seed Optional deterministic seed for reproducibility
 * @param vertexCount Number of vertices (default 32, clamped to [24, 64])
 * @returns Array of polygon boundary vertices
 */
export function generateOrganicStamp(
  cx: number,
  cy: number,
  radius: number,
  roughness: number,
  seed?: number,
  vertexCount = 32
): MapPoint[] {
  const safeRadius = Math.max(1, radius);
  const clampedRoughness = Math.max(0, Math.min(1, roughness));
  const count = Math.max(24, Math.min(64, Math.round(vertexCount || 32)));

  // Fast path for perfect circular stamps (zero roughness)
  if (clampedRoughness === 0) {
    const circlePoints: MapPoint[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      circlePoints.push({
        x: Math.round(cx + safeRadius * Math.cos(angle)),
        y: Math.round(cy + safeRadius * Math.sin(angle)),
      });
    }
    return circlePoints;
  }

  const noise = getNoiseFunction(seed);
  const freq1 = 1.2; // Macro promontory/bay frequency
  const freq2 = 3.6; // Micro jagged coastline frequency
  const maxAmplitude = 0.35 * clampedRoughness; // Max +/-35% radial perturbation

  // Spatial world-continuity offset
  const worldOffsetX = (cx * 0.003) % 100;
  const worldOffsetY = (cy * 0.003) % 100;

  const points: MapPoint[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Sample continuous loop in 2D noise space (zero angular seam at 0 / 2*PI)
    const n1 = noise(cosA * freq1 + worldOffsetX, sinA * freq1 + worldOffsetY);
    const n2 = noise(cosA * freq2 + worldOffsetX * 2, sinA * freq2 + worldOffsetY * 2);
    const combinedNoise = n1 * 0.7 + n2 * 0.3;

    // Modulate radius strictly bounded: r in [0.65 * safeRadius, 1.35 * safeRadius]
    const r = safeRadius * (1 + maxAmplitude * combinedNoise);

    points.push({
      x: Math.round(cx + r * cosA),
      y: Math.round(cy + r * sinA),
    });
  }

  return points;
}
