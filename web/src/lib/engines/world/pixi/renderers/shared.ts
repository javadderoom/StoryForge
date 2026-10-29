import type { Container } from 'pixi.js';
import type { MapPoint } from '@/lib/types';

export function toFlatPoints(pts: MapPoint[]): number[] {
  const flat: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    flat.push(pts[i].x, pts[i].y);
  }
  return flat;
}

/**
 * Safely removes and destroys all children of a Pixi Container,
 * freeing child Text instances, event listeners, and GPU canvas textures.
 * Prevents V8 heap and WebGL texture memory leaks during repeated render passes.
 */
export function clearContainer(container?: Container | null): void {
  if (!container) return;
  while (container.children.length > 0) {
    const child = container.removeChildAt(container.children.length - 1);
    child.destroy({ children: true });
  }
}

