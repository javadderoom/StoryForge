import type { Graphics } from 'pixi.js';
import type { WorldMapSettings } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { CANVAS_WIDTH, CANVAS_HEIGHT, calculateHexVertices } from './pixiMath';
import type { FillWithMaterial } from './renderTypes';

export function renderBackground(g: Graphics, fill: FillWithMaterial): void {
  g.clear();

    // Ocean wash — the flat theme colour, with the sea material laid over it.
    fill(
      g,
      [0, 0, CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0, CANVAS_HEIGHT],
      'ocean',
      VINTAGE_PARCHMENT.oceanWash,
      1
    );

    // Antique sea wavelets across open waters (woodcut cartographic ripples)
    const waveSpacing = 160;
    for (let y = 80; y < CANVAS_HEIGHT - 80; y += waveSpacing) {
      const rowOffset = (Math.floor(y / waveSpacing) % 2) * (waveSpacing / 2);
      for (let x = 80 + rowOffset; x < CANVAS_WIDTH - 80; x += waveSpacing) {
        g.moveTo(x - 12, y)
          .bezierCurveTo(x - 8, y - 3, x - 4, y - 3, x, y)
          .bezierCurveTo(x + 4, y + 3, x + 8, y + 3, x + 12, y)
          .stroke({ width: 0.8, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.22 });
        g.moveTo(x - 6, y + 5)
          .bezierCurveTo(x - 3, y + 2, x, y + 2, x + 3, y + 5)
          .stroke({ width: 0.6, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.16 });
      }
    }

    // Outer vintage cartographic double border
    const borderPadding = 18;
    g.rect(
      borderPadding,
      borderPadding,
      CANVAS_WIDTH - borderPadding * 2,
      CANVAS_HEIGHT - borderPadding * 2
    ).stroke({
      width: 4,
      color: VINTAGE_PARCHMENT.borderFrame,
    });

    const innerPadding = 28;
    g.rect(
      innerPadding,
      innerPadding,
      CANVAS_WIDTH - innerPadding * 2,
      CANVAS_HEIGHT - innerPadding * 2
    ).stroke({
      width: 1.5,
      color: VINTAGE_PARCHMENT.coastlineHatch,
    });

    // Corner rosettes
    const corners = [
      { x: innerPadding, y: innerPadding },
      { x: CANVAS_WIDTH - innerPadding, y: innerPadding },
      { x: innerPadding, y: CANVAS_HEIGHT - innerPadding },
      { x: CANVAS_WIDTH - innerPadding, y: CANVAS_HEIGHT - innerPadding },
    ];
    for (const c of corners) {
      g.circle(c.x, c.y, 8).fill({ color: VINTAGE_PARCHMENT.borderFrame });
      g.circle(c.x, c.y, 4).fill({ color: VINTAGE_PARCHMENT.capitalGold });
    }
}

export function renderGrid(g: Graphics, settings: WorldMapSettings): void {
    g.clear();

    if (!settings.visibleLayers.grid || settings.gridType === 'none') {
      return;
    }

    const gridSize = settings.gridSize || 100;
    const strokeColor = VINTAGE_PARCHMENT.gridRuling;

    if (settings.gridType === 'square') {
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        g.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT).stroke({
          width: 0.8,
          color: strokeColor,
          alpha: 0.5,
        });
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        g.moveTo(0, y).lineTo(CANVAS_WIDTH, y).stroke({
          width: 0.8,
          color: strokeColor,
          alpha: 0.5,
        });
      }
    } else if (settings.gridType === 'hex') {
      const hexR = gridSize * 0.55;
      const stepX = gridSize * 1.5;
      const stepY = gridSize;

      for (let col = 0; col * stepX <= CANVAS_WIDTH; col++) {
        for (let row = 0; row * stepY <= CANVAS_HEIGHT; row++) {
          const hx = col * stepX;
          const hy = row * stepY + (col % 2 === 1 ? gridSize / 2 : 0);
          const vertices = calculateHexVertices(hx, hy, hexR);

          const polyPoints: number[] = [];
          for (const v of vertices) {
            polyPoints.push(v.x, v.y);
          }

          g.poly(polyPoints).stroke({
            width: 0.6,
            color: strokeColor,
            alpha: 0.45,
          });
        }
      }
    }
  }
