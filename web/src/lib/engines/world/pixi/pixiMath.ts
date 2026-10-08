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
