/**
 * splineTextRenderer.ts
 *
 * Curved & Spline-Aligned Typography Engine
 * (Plan 27 — Module 4)
 *
 * Renders curved, tracked geographic titles along physical natural features
 * (mountain ridgelines, meandering rivers, archipelago curves, bay shores):
 * - Distance-parameterized arc-length glyph transformation along Catmull-Rom guide splines.
 * - Exact glyph advance measurement with configurable letter spacing (tracking).
 * - Automatic upside-down readability protection (flips flow if traveling right-to-left).
 * - Perpendicular baseline offsets (+/- normal vector) to float above crests or banks.
 * - Smooth curvature-clamping preventing character collisions on sharp bends.
 * - Pure mathematical layout generation (`layoutCurvedText`) + Pixi container renderer.
 */

import { Container, Text, TextStyle } from 'pixi.js';
import type { MapPoint, CurvedLabelConfig, MapTerrainFeature, WorldLocation } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { clearContainer } from './renderers/shared';
import { getBoundingBox, getPolygonCentroid } from '../landSculpt/geometry';
import { isObjectVisible } from '../mapObjectOrder';
import { mapObjectKey } from '../mapSelection';
import { prepareSplineGlyphs, isRtlText } from './persianReshaper';
import {
  getDynamicTextResolution,
  getTerrainLabelLODTier,
  isElementVisibleAtZoom,
} from './lodManager';

export interface GlyphPlacement {
  char: string;
  x: number;
  y: number;
  rotation: number; // in radians
  width: number;
  arcLength: number;
}

export interface CurvedTextLayout {
  text: string;
  glyphs: GlyphPlacement[];
  totalArcLength: number;
  textWidth: number;
  pathPoints: MapPoint[];
  isFlipped: boolean;
}

export interface CurvedTextOptions extends Omit<CurvedLabelConfig, 'color'> {
  color?: string | number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: 'normal' | 'bold';
  maxCurvatureDegPerChar?: number;
  zoom?: number;
}

/**
 * Offscreen 2D canvas context for exact glyph advance measurements (in browser environments).
 */
let measureCtx: CanvasRenderingContext2D | null = null;
const glyphWidthCache = new Map<string, number>();

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document !== 'undefined' && document.createElement) {
    try {
      const canvas = document.createElement('canvas');
      measureCtx = canvas.getContext('2d');
    } catch {
      measureCtx = null;
    }
  }
  return measureCtx;
}

/**
 * Measures the typographic advance width of a character.
 */
export function measureCharWidth(
  char: string,
  fontSize: number,
  fontFamily = 'Cinzel, "Times New Roman", serif'
): number {
  const cacheKey = `${char}_${fontSize}_${fontFamily}`;
  const cached = glyphWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    const measured = ctx.measureText(char).width;
    const width = Math.round(measured * 10) / 10;
    glyphWidthCache.set(cacheKey, width);
    return width;
  }

  // Headless / SSR / Node.js fallback proportional widths
  let ratio = 0.65;
  if (char === ' ') ratio = 0.32;
  else if (/^[ijlI1!|.,:;']$/.test(char)) ratio = 0.28;
  else if (/^[frt"()\-]$/.test(char)) ratio = 0.42;
  else if (/^[MWmw—_]$/.test(char)) ratio = 0.88;
  else if (char.charCodeAt(0) > 255) ratio = 0.65; // Persian / non-latin

  const estimated = Math.round(fontSize * ratio * 10) / 10;
  glyphWidthCache.set(cacheKey, estimated);
  return estimated;
}

/**
 * Computes pure mathematical curved glyph placements along a guide spline.
 */
export function layoutCurvedText(
  text: string,
  pathPoints: MapPoint[],
  options: CurvedTextOptions = {}
): CurvedTextLayout | null {
  if (!text || !pathPoints || pathPoints.length < 2) return null;

  const rawText = options.uppercase !== false ? text.toUpperCase() : text;
  if (rawText.length === 0) return null;

  const { glyphs: shapedGlyphs, isRtl } = prepareSplineGlyphs(rawText);
  if (shapedGlyphs.length === 0) return null;

  const fontSize = options.fontSize ?? 15;
  const alignment = options.alignment ?? 'center';
  const baselineOffset = options.baselineOffset ?? 0;
  const maxCurvatureDeg = options.maxCurvatureDegPerChar ?? 25;
  const maxCurvatureRad = (maxCurvatureDeg * Math.PI) / 180;

  // 1. Check path direction and ensure readable flow
  let pts = sanitizePathPoints(pathPoints);
  if (pts.length < 2) return null;

  const dxTotal = pts[pts.length - 1].x - pts[0].x;
  let isFlipped = false;
  // If the path generally flows from right to left, reverse points for readability
  if (dxTotal < -10) {
    pts = [...pts].reverse();
    isFlipped = true;
  }

  // 2. Discretize guide spline into dense distance-parameterized samples
  const sampledSpline = sampleSplineArc(pts, 1.5);
  if (sampledSpline.length < 2) return null;

  const totalArcLength =
    sampledSpline[sampledSpline.length - 1].cumulativeDist;

  // 3. Measure glyph advance widths
  const charWidths: number[] = [];
  let totalCharsWidth = 0;
  for (let i = 0; i < shapedGlyphs.length; i++) {
    const w = measureCharWidth(shapedGlyphs[i], fontSize, options.fontFamily);
    charWidths.push(w);
    totalCharsWidth += w;
  }

  let letterSpacing = options.letterSpacing ?? (isRtl ? 1 : 4);
  let textWidth =
    totalCharsWidth + (shapedGlyphs.length - 1) * letterSpacing;

  // If text exceeds spline arc length, gracefully compress letter spacing
  if (textWidth > totalArcLength && shapedGlyphs.length > 1) {
    const excess = textWidth - totalArcLength;
    const compression = excess / (shapedGlyphs.length - 1);
    letterSpacing = Math.max(0, letterSpacing - compression);
    textWidth = totalCharsWidth + (shapedGlyphs.length - 1) * letterSpacing;
  }

  // 4. Determine starting offset along arc length based on alignment
  let startDist = 0;
  if (alignment === 'center') {
    startDist = (totalArcLength - textWidth) * 0.5;
  } else if (alignment === 'right') {
    startDist = totalArcLength - textWidth;
  }
  startDist = Math.max(0, startDist);

  // 5. Position each character along arc length
  const glyphs: GlyphPlacement[] = [];
  let currentDist = startDist;
  let prevAngle: number | null = null;

  for (let i = 0; i < shapedGlyphs.length; i++) {
    const char = shapedGlyphs[i];
    const w = charWidths[i];
    const centerDist = currentDist + w * 0.5;

    if (centerDist > totalArcLength + 20) break;

    const sample = evaluateSplineAtDistance(sampledSpline, centerDist);
    if (!sample) continue;

    // Angle of curve at glyph position
    let angle = sample.angle;

    // Curvature smoothing: prevent wild letter inversion on sharp bends
    if (prevAngle !== null) {
      let diff = angle - prevAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) > maxCurvatureRad) {
        angle = prevAngle + Math.sign(diff) * maxCurvatureRad;
      }
    }
    prevAngle = angle;

    // Normal vector for baseline offset (-sin, cos)
    const normX = -Math.sin(angle);
    const normY = Math.cos(angle);

    const gx = sample.point.x + normX * baselineOffset;
    const gy = sample.point.y + normY * baselineOffset;

    glyphs.push({
      char,
      x: Math.round(gx * 10) / 10,
      y: Math.round(gy * 10) / 10,
      rotation: Math.round(angle * 1000) / 1000,
      width: w,
      arcLength: Math.round(centerDist * 10) / 10,
    });

    currentDist += w + letterSpacing;
  }

  return {
    text: rawText,
    glyphs,
    totalArcLength: Math.round(totalArcLength * 10) / 10,
    textWidth: Math.round(textWidth * 10) / 10,
    pathPoints: pts,
    isFlipped,
  };
}

/**
 * Renders a CurvedTextLayout into a Pixi Container of rotated glyph Text instances.
 */
export function renderCurvedTextToContainer(
  targetContainer: Container,
  layout: CurvedTextLayout,
  options: CurvedTextOptions = {}
): Container {
  const container = new Container();
  const fontSize = options.fontSize ?? 15;
  const rawColor = options.color ?? VINTAGE_PARCHMENT.labelText;
  const color =
    typeof rawColor === 'number'
      ? rawColor
      : typeof rawColor === 'string' && rawColor.startsWith('#')
      ? parseInt(rawColor.slice(1), 16)
      : VINTAGE_PARCHMENT.labelText;
  const fontFamily = options.fontFamily ?? 'Cinzel, "Times New Roman", Georgia, serif';
  const fontStyle = options.fontStyle ?? 'normal';
  const fontWeight = options.fontWeight ?? 'bold';
  const resolution = getDynamicTextResolution(options.zoom ?? 1.0);

  const baseStyle = new TextStyle({
    fontFamily,
    fontSize,
    fontStyle,
    fontWeight,
    fill: color,
    dropShadow: {
      alpha: 0.35,
      angle: Math.PI / 4,
      blur: 2,
      color: 0xfcf7ea, // Parchment halo
      distance: 1,
    },
  });

  for (const glyph of layout.glyphs) {
    if (glyph.char === ' ') continue;

    const t = new Text({
      text: glyph.char,
      style: baseStyle,
      resolution,
    });
    t.anchor.set(0.5, 0.5);
    t.x = glyph.x;
    t.y = glyph.y;
    t.rotation = glyph.rotation;

    container.addChild(t);
  }

  targetContainer.addChild(container);
  return container;
}

/**
 * Derives an automatic guide baseline spline for any terrain feature.
 */
export function deriveFeatureGuideSpline(
  feat: MapTerrainFeature
): MapPoint[] | null {
  // 1. Explicitly configured label guide path
  if (feat.labelConfig?.pathPoints && feat.labelConfig.pathPoints.length >= 2) {
    return feat.labelConfig.pathPoints;
  }

  // 2. Linear feature polyline (river, mountain range ridgeline, valley)
  if (feat.points && feat.points.length >= 2) {
    return feat.points;
  }

  // 3. Areal polygon feature (lake, forest, desert, highland)
  if (feat.polygon && feat.polygon.length >= 3) {
    const aabb = getBoundingBox(feat.polygon);
    const centroid = getPolygonCentroid(feat.polygon);
    const width = aabb.maxX - aabb.minX;
    const height = aabb.maxY - aabb.minY;

    if (width >= height) {
      // Horizontal span across centroid
      const span = width * 0.35;
      return [
        { x: Math.round(centroid.x - span), y: Math.round(centroid.y) },
        { x: Math.round(centroid.x), y: Math.round(centroid.y - 4) },
        { x: Math.round(centroid.x + span), y: Math.round(centroid.y) },
      ];
    } else {
      // Gentle diagonal span
      const span = height * 0.35;
      return [
        { x: Math.round(centroid.x - span * 0.3), y: Math.round(centroid.y - span) },
        { x: Math.round(centroid.x), y: Math.round(centroid.y) },
        { x: Math.round(centroid.x + span * 0.3), y: Math.round(centroid.y + span) },
      ];
    }
  }

  return null;
}

export interface TerrainLabelTierContainers {
  tier1: Container;
  tier2: Container;
  tier3: Container;
}

/**
 * Renders curved, tracked geographic titles for all prominent and configured terrain features.
 * When a feature is linked to a WorldLocation (via locationId), prioritizes the canonical location's name.
 */
export function renderTerrainCurvedLabels(
  targetContainer: Container,
  terrainFeatures: MapTerrainFeature[],
  locations?: WorldLocation[],
  options?: {
    zoom?: number;
    selectionKeys?: Set<string>;
    tierContainers?: TerrainLabelTierContainers;
  }
): void {
  const zoom = options?.zoom ?? 1.0;
  const selectionKeys = options?.selectionKeys;
  const tierContainers = options?.tierContainers;

  if (tierContainers) {
    clearContainer(tierContainers.tier1);
    clearContainer(tierContainers.tier2);
    clearContainer(tierContainers.tier3);
  } else {
    clearContainer(targetContainer);
  }

  for (const feat of terrainFeatures) {
    if (!isObjectVisible(feat)) continue;

    const isSelected = feat.id && selectionKeys ? selectionKeys.has(mapObjectKey('terrain', feat.id)) : false;
    const tier = getTerrainLabelLODTier(feat.type);

    let destContainer = targetContainer;
    if (tierContainers) {
      if (isSelected || tier === 1) destContainer = tierContainers.tier1;
      else if (tier === 2) destContainer = tierContainers.tier2;
      else destContainer = tierContainers.tier3;
    } else {
      if (!isElementVisibleAtZoom(tier, zoom, isSelected)) continue;
    }

    // Canonical location name: if linked to a WorldLocation, prioritize the canonical location's name!
    const linkedLoc =
      feat.locationId && locations ? locations.find((l) => l.id === feat.locationId) : null;
    const displayName = linkedLoc?.name || feat.name;

    if (!displayName || displayName.trim().length === 0) continue;

    const config = feat.labelConfig;
    const isExplicitlyEnabled = config?.enabled === true;
    const isOptedOut = config?.enabled === false;
    if (isOptedOut) continue;

    // Suppress automatic labels for connected river tributaries & delta distributaries
    if (feat.connectedRiverId && !isExplicitlyEnabled) {
      continue;
    }

    const isProminentFeature =
      feat.type === 'mountain_range' ||
      feat.type === 'river' ||
      feat.type === 'desert' ||
      feat.type === 'lake' ||
      feat.type === 'forest' ||
      feat.type === 'highland';

    if (!isExplicitlyEnabled && !isProminentFeature && !config?.pathPoints) {
      continue;
    }

    const spline = deriveFeatureGuideSpline(feat);
    if (!spline || spline.length < 2) continue;

    // Determine thematic styling by feature category
    let color: number = VINTAGE_PARCHMENT.labelText;
    let baselineOffset = config?.baselineOffset ?? 0;

    if (feat.type === 'mountain_range') {
      color = VINTAGE_PARCHMENT.mountainInk;
      if (baselineOffset === 0) baselineOffset = -14;
    } else if (feat.type === 'river' || feat.type === 'lake') {
      color = VINTAGE_PARCHMENT.riverInk;
      if (baselineOffset === 0 && feat.type === 'river') baselineOffset = -8;
    } else if (feat.type === 'desert' || feat.type === 'wasteland') {
      color = 0x6e5233;
    } else if (feat.type === 'forest' || feat.type === 'jungle') {
      color = 0x223d1d;
    }

    const layout = layoutCurvedText(displayName, spline, {
      ...config,
      baselineOffset,
      fontSize:
        config?.fontSize ??
        (feat.type === 'mountain_range' || feat.type === 'desert' ? 16 : 14),
      letterSpacing:
        config?.letterSpacing ??
        (feat.type === 'mountain_range' || feat.type === 'desert' ? 6 : 4),
    });

    if (layout) {
      const customColor =
        typeof config?.color === 'number'
          ? config.color
          : typeof config?.color === 'string' && config.color.startsWith('#')
          ? parseInt(config.color.slice(1), 16)
          : color;

      renderCurvedTextToContainer(destContainer, layout, {
        ...config,
        color: customColor,
        zoom,
      });
    }
  }
}

// ============================================================================
// SPLINE ARC INTERPOLATION HELPERS
// ============================================================================

interface SplineSample {
  point: MapPoint;
  angle: number;
  cumulativeDist: number;
}

function sampleSplineArc(points: MapPoint[], step = 2.0): SplineSample[] {
  if (points.length < 2) return [];

  // Generate dense points using Catmull-Rom interpolation if >= 3 points
  const rawPoints =
    points.length >= 3 ? interpolateCatmullRom(points, 8) : points;

  const samples: SplineSample[] = [];
  let totalDist = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    const cur = rawPoints[i];
    if (i === 0) {
      const next = rawPoints[1];
      const angle = Math.atan2(next.y - cur.y, next.x - cur.x);
      samples.push({ point: cur, angle, cumulativeDist: 0 });
    } else {
      const prev = rawPoints[i - 1];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const segLen = Math.hypot(dx, dy);
      totalDist += segLen;
      const angle = Math.atan2(dy, dx);
      samples.push({ point: cur, angle, cumulativeDist: totalDist });
    }
  }

  return samples;
}

function evaluateSplineAtDistance(
  samples: SplineSample[],
  targetDist: number
): { point: MapPoint; angle: number } | null {
  if (samples.length === 0) return null;
  if (targetDist <= 0) return { point: samples[0].point, angle: samples[0].angle };

  const last = samples[samples.length - 1];
  if (targetDist >= last.cumulativeDist) {
    return { point: last.point, angle: last.angle };
  }

  // Binary search for interval
  let low = 0;
  let high = samples.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].cumulativeDist < targetDist) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx = Math.max(1, Math.min(samples.length - 1, low));
  const s0 = samples[idx - 1];
  const s1 = samples[idx];

  const segDist = s1.cumulativeDist - s0.cumulativeDist || 1e-4;
  const t = Math.max(0, Math.min(1, (targetDist - s0.cumulativeDist) / segDist));

  const px = s0.point.x + (s1.point.x - s0.point.x) * t;
  const py = s0.point.y + (s1.point.y - s0.point.y) * t;

  return {
    point: { x: px, y: py },
    angle: s0.angle,
  };
}

function interpolateCatmullRom(pts: MapPoint[], segmentsPerSpan = 8): MapPoint[] {
  const result: MapPoint[] = [];
  const n = pts.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      result.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }

  result.push(pts[n - 1]);
  return result;
}

function sanitizePathPoints(points: MapPoint[]): MapPoint[] {
  const result: MapPoint[] = [];
  for (const pt of points) {
    const prev = result[result.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 1.0) continue;
    result.push(pt);
  }
  return result;
}
