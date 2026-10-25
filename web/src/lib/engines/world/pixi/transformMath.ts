import type { MapPoint, MapTerrainFeature } from '@/lib/types';

export type TransformHandleType =
  | 'nw'
  | 'ne'
  | 'se'
  | 'sw'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'rotate';

export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface TransformHandlePoint {
  type: TransformHandleType;
  x: number;
  y: number;
}

export const ROTATION_ARM_OFFSET = 24;

/**
 * Computes the 2D bounding box and center of a terrain feature.
 */
export function computeTerrainBounds(feature: MapTerrainFeature): BoundingBox2D | null {
  const points: MapPoint[] = [];

  if (feature.polygon && feature.polygon.length >= 3) {
    points.push(...feature.polygon);
  } else if (feature.points && feature.points.length >= 2) {
    points.push(...feature.points);
  } else if (typeof feature.x === 'number' && typeof feature.y === 'number') {
    const r = feature.radius ?? 24;
    points.push(
      { x: feature.x - r, y: feature.y - r },
      { x: feature.x + r, y: feature.y + r }
    );
  }

  if (points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(8, maxX - minX);
  const height = Math.max(8, maxY - minY);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/**
 * Returns the positions of the 8 bounding box scale handles + 1 rotation handle.
 */
export function getTransformHandles(box: BoundingBox2D): TransformHandlePoint[] {
  const { minX, minY, maxX, maxY, cx, cy } = box;

  return [
    // Corners
    { type: 'nw', x: minX, y: minY },
    { type: 'ne', x: maxX, y: minY },
    { type: 'se', x: maxX, y: maxY },
    { type: 'sw', x: minX, y: maxY },
    // Edge midpoints
    { type: 'n', x: cx, y: minY },
    { type: 's', x: cx, y: maxY },
    { type: 'w', x: minX, y: cy },
    { type: 'e', x: maxX, y: cy },
    // Rotation stalk handle (above north midpoint)
    { type: 'rotate', x: cx, y: minY - ROTATION_ARM_OFFSET },
  ];
}

/**
 * Applies a scale or rotation transformation to a list of points.
 */
export function applyTransform(
  points: MapPoint[],
  handle: TransformHandleType,
  box: BoundingBox2D,
  startPos: MapPoint,
  currentPos: MapPoint,
  preserveAspect = false
): MapPoint[] {
  if (points.length === 0) return [];

  if (handle === 'rotate') {
    const { cx, cy } = box;
    const startAngle = Math.atan2(startPos.y - cy, startPos.x - cx);
    const currentAngle = Math.atan2(currentPos.y - cy, currentPos.x - cx);
    const deltaAngle = currentAngle - startAngle;

    const cos = Math.cos(deltaAngle);
    const sin = Math.sin(deltaAngle);

    return points.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    });
  }

  // Anchor point that stays fixed during scale
  let anchorX = box.cx;
  let anchorY = box.cy;
  let origOppX = box.cx;
  let origOppY = box.cy;

  let affectsX = false;
  let affectsY = false;

  switch (handle) {
    case 'nw':
      anchorX = box.maxX;
      anchorY = box.maxY;
      origOppX = box.minX;
      origOppY = box.minY;
      affectsX = true;
      affectsY = true;
      break;
    case 'ne':
      anchorX = box.minX;
      anchorY = box.maxY;
      origOppX = box.maxX;
      origOppY = box.minY;
      affectsX = true;
      affectsY = true;
      break;
    case 'se':
      anchorX = box.minX;
      anchorY = box.minY;
      origOppX = box.maxX;
      origOppY = box.maxY;
      affectsX = true;
      affectsY = true;
      break;
    case 'sw':
      anchorX = box.maxX;
      anchorY = box.minY;
      origOppX = box.minX;
      origOppY = box.maxY;
      affectsX = true;
      affectsY = true;
      break;
    case 'n':
      anchorY = box.maxY;
      origOppY = box.minY;
      affectsY = true;
      break;
    case 's':
      anchorY = box.minY;
      origOppY = box.maxY;
      affectsY = true;
      break;
    case 'w':
      anchorX = box.maxX;
      origOppX = box.minX;
      affectsX = true;
      break;
    case 'e':
      anchorX = box.minX;
      origOppX = box.maxX;
      affectsX = true;
      break;
  }

  const origSpanX = origOppX - anchorX;
  const origSpanY = origOppY - anchorY;

  let scaleX = affectsX && Math.abs(origSpanX) > 0.001
    ? (currentPos.x - anchorX) / origSpanX
    : 1;

  let scaleY = affectsY && Math.abs(origSpanY) > 0.001
    ? (currentPos.y - anchorY) / origSpanY
    : 1;

  if (preserveAspect && affectsX && affectsY) {
    const maxScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
    scaleX = Math.sign(scaleX) * maxScale;
    scaleY = Math.sign(scaleY) * maxScale;
  }

  return points.map((p) => {
    return {
      x: affectsX ? anchorX + (p.x - anchorX) * scaleX : p.x,
      y: affectsY ? anchorY + (p.y - anchorY) * scaleY : p.y,
    };
  });
}
