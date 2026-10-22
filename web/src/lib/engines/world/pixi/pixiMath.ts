/**
 * PixiJS Cartographer Math & Coordinate Projection Utilities
 * Provides high-precision coordinate transforms, anchor-preserving zoom,
 * vintage hex geometry, and procedural noise perturbations for vintage fantasy maps.
 */

import { MapPoint } from '@/lib/types';
import { createNoise2D } from 'simplex-noise';

export const CANVAS_WIDTH = 4000;
export const CANVAS_HEIGHT = 2800;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4.0;

const noise2D = createNoise2D();

/**
 * Projects screen/client coordinates to Map World coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  pan: { x: number; y: number },
  zoom: number
): MapPoint {
  const safeZoom = zoom <= 0 ? 1 : zoom;
  return {
    x: Math.round((screenX - pan.x) / safeZoom),
    y: Math.round((screenY - pan.y) / safeZoom),
  };
}

/**
 * Projects Map World coordinates to screen/client coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  pan: { x: number; y: number },
  zoom: number
): MapPoint {
  return {
    x: Math.round(worldX * zoom + pan.x),
    y: Math.round(worldY * zoom + pan.y),
  };
}

/**
 * Calculates new pan coordinates when zooming around a specific cursor position,
 * ensuring the point under the mouse cursor remains static.
 */
export function calculateZoomPan(
  cursorX: number,
  cursorY: number,
  oldPan: { x: number; y: number },
  oldZoom: number,
  newZoom: number
): { x: number; y: number } {
  if (oldZoom <= 0) return oldPan;
  const scaleRatio = newZoom / oldZoom;
  return {
    x: cursorX - (cursorX - oldPan.x) * scaleRatio,
    y: cursorY - (cursorY - oldPan.y) * scaleRatio,
  };
}

/**
 * Clamps zoom within reasonable limits to prevent memory exhaustion and subpixel breakdown
 */
export function clampZoom(zoom: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  return Math.min(max, Math.max(min, zoom));
}

/** A drag rectangle in container-relative screen pixels. */
export interface ZoomRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Fits the world area under a screen-space rectangle into the whole viewport.
 *
 * The result keeps the rectangle's centre at the viewport centre and uses the
 * tighter of the horizontal/vertical fits, so no part of the chosen area is
 * cropped. Zoom is clamped like every other map zoom; when the clamp stops the
 * fit, the rectangle is still centred instead of drifting to a corner.
 *
 * Returns null for degenerate input (a click without a drag, an unmeasured
 * container) so callers can leave the view untouched.
 */
export function calculateZoomToRect(
  rect: ZoomRect,
  viewport: { width: number; height: number },
  pan: { x: number; y: number },
  zoom: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM
): { zoom: number; pan: { x: number; y: number } } | null {
  if (
    !Number.isFinite(rect.x0) ||
    !Number.isFinite(rect.y0) ||
    !Number.isFinite(rect.x1) ||
    !Number.isFinite(rect.y1) ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    !Number.isFinite(pan.x) ||
    !Number.isFinite(pan.y) ||
    !Number.isFinite(zoom)
  ) {
    return null;
  }
  if (viewport.width <= 0 || viewport.height <= 0) return null;
  if (zoom <= 0) return null;

  const left = Math.min(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const right = Math.max(rect.x0, rect.x1);
  const bottom = Math.max(rect.y0, rect.y1);

  const screenWidth = right - left;
  const screenHeight = bottom - top;
  if (screenWidth <= 0 || screenHeight <= 0) return null;

  // The rectangle is dragged in screen space; convert it to world space with
  // the transform that is on screen right now.
  const worldWidth = screenWidth / zoom;
  const worldHeight = screenHeight / zoom;
  const worldCenterX = ((left + right) / 2 - pan.x) / zoom;
  const worldCenterY = ((top + bottom) / 2 - pan.y) / zoom;

  const fitted = Math.min(viewport.width / worldWidth, viewport.height / worldHeight);
  const nextZoom = clampZoom(fitted, min, max);

  return {
    zoom: nextZoom,
    pan: {
      x: viewport.width / 2 - worldCenterX * nextZoom,
      y: viewport.height / 2 - worldCenterY * nextZoom,
    },
  };
}

/**
 * Calculates vertices of a pointy-topped or flat-topped hexagon
 */
export function calculateHexVertices(
  centerX: number,
  centerY: number,
  radius: number,
  flatTopped = false
): MapPoint[] {
  const angleOffset = flatTopped ? 0 : Math.PI / 6;
  const vertices: MapPoint[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = angleOffset + (Math.PI / 3) * i;
    vertices.push({
      x: Math.round(centerX + radius * Math.cos(angle)),
      y: Math.round(centerY + radius * Math.sin(angle)),
    });
  }

  return vertices;
}

/**
 * Applies subtle organic Simplex noise to polygon points, giving hand-inked
 * vintage parchment coastline contours rather than sterile digital lines.
 */
export function generateOrganicParchmentContours(
  points: MapPoint[],
  amplitude = 5,
  frequency = 0.02
): MapPoint[] {
  if (points.length < 3) return points;

  return points.map((pt, i) => {
    const nx = noise2D(pt.x * frequency, pt.y * frequency);
    const ny = noise2D(pt.x * frequency + 100, pt.y * frequency + 100);

    return {
      x: Math.round(pt.x + nx * amplitude),
      y: Math.round(pt.y + ny * amplitude),
    };
  });
}
