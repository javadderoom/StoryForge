import type { Graphics } from 'pixi.js';
import type { MapPoint } from '@/lib/types';
import type { CartographerTool } from '@/components/cartographer/CartographerHeader';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { renderRouteDraft } from './routeRenderer';

export function renderInteraction(
  g: Graphics,
  options: {
    draftPoints: MapPoint[];
    rulerPoints: MapPoint[];
    activeTool: CartographerTool;
    isPersian: boolean;
  }): void {
  const { draftPoints, rulerPoints, activeTool } = options;
  g.clear();

    // In-Progress Drafting Line / Polygon Preview
    if (activeTool === 'draw_route') {
      renderRouteDraft(g, draftPoints, false);
    } else if (draftPoints.length > 0) {
      g.moveTo(draftPoints[0].x, draftPoints[0].y);
      for (let i = 1; i < draftPoints.length; i++) {
        g.lineTo(draftPoints[i].x, draftPoints[i].y);
      }
      g.stroke({
        width: 2.5,
        color: 0x3b82f6,
      });

      for (const pt of draftPoints) {
        g.circle(pt.x, pt.y, 4).fill({ color: 0x3b82f6 });
      }
    }

    // Distance Ruler Measurement
    if (rulerPoints.length === 2) {
      const p1 = rulerPoints[0];
      const p2 = rulerPoints[1];

      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({
        width: 2,
        color: 0xd97706,
      });
      g.circle(p1.x, p1.y, 5).fill({ color: 0xd97706 });
      g.circle(p2.x, p2.y, 5).fill({ color: 0xd97706 });
    }
  }

export function renderBrushPreview(
  g: Graphics,
  stamps: MapPoint[][],
  mode: 'paint' | 'carve'
): void {
  g.clear();

    if (stamps.length === 0) return;

    for (const stamp of stamps) {
      if (stamp.length < 3) continue;
      const flat: number[] = [];
      for (const pt of stamp) {
        flat.push(pt.x, pt.y);
      }

      if (mode === 'paint') {
        g.poly(flat)
          .fill({ color: VINTAGE_PARCHMENT.landFill, alpha: 0.85 })
          .stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk, alpha: 0.9 });
      } else {
        // Carve mode: ocean wash with warning stroke
        g.poly(flat)
          .fill({ color: VINTAGE_PARCHMENT.oceanWash, alpha: 0.9 })
          .stroke({ width: 2.0, color: 0xdc2626, alpha: 0.8 });
      }
    }
  }

export function renderBrushCursor(
  g: Graphics,
  point: MapPoint | null,
  radius: number,
  mode: 'paint' | 'carve'
): void {
  g.clear();

    if (!point) return;

    const strokeColor = mode === 'paint' ? VINTAGE_PARCHMENT.coastlineInk : 0xdc2626;

    // Outer guide circle
    g.circle(point.x, point.y, radius).stroke({
      width: 1.5,
      color: strokeColor,
      alpha: 0.65,
    });

    // Center reticle dot
    g.circle(point.x, point.y, 2.5).fill({
      color: strokeColor,
      alpha: 0.8,
    });
  }
