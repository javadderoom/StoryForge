import type { MapPoint } from '@/lib/types';

export function toFlatPoints(pts: MapPoint[]): number[] {
  const flat: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    flat.push(pts[i].x, pts[i].y);
  }
  return flat;
}
