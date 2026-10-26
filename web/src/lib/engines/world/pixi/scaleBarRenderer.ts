/**
 * scaleBarRenderer.ts
 *
 * Procedural dual-unit linear scale bar generator & renderer
 * for the illuminated manuscript cartography engine (Plan 27 Phase E.3).
 *
 * Visual Features:
 * - Dual-track alternating hatched blocks (top: Imperial Parasangs / Farsakh, bottom: Miles).
 * - Subdivided lead block with fine measurement intervals.
 * - Serif unit titling ("PARASANGS" and "MILES") and numeric callouts.
 * - Classical architectural finials and end brackets.
 * - Parchment background underlay protecting legibility over varied terrain.
 */

import { Graphics, Container, Text } from 'pixi.js';
import type { MapPoint, ScaleBarConfig } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';

export interface ScaleBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  isFilled: boolean;
  track: 'primary' | 'secondary';
}

export interface ScaleTick {
  x: number;
  yTop: number;
  yBottom: number;
  isMajor: boolean;
  label?: string;
  position: 'top' | 'bottom';
}

export interface ScaleBarGeometry {
  bounds: { x: number; y: number; width: number; height: number };
  center: MapPoint;
  blocks: ScaleBlock[];
  ticks: ScaleTick[];
  finials: {
    left: MapPoint[];
    right: MapPoint[];
  };
  labels: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    align: 'left' | 'center' | 'right';
  }>;
}

/**
 * Computes pure mathematical coordinates for the dual-unit linear scale bar.
 */
export function generateScaleBarGeometry(config: ScaleBarConfig = {}): ScaleBarGeometry {
  const x = config.x ?? 240;
  const y = config.y ?? 1500;
  const W = config.width ?? 320;
  const H = config.height ?? 22;
  const divisions = config.divisions ?? 4;

  const halfH = H / 2;
  const blockW = W / divisions;

  const blocks: ScaleBlock[] = [];
  const ticks: ScaleTick[] = [];
  const labels: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    align: 'left' | 'center' | 'right';
  }> = [];

  // 1. Primary Track (Top - Parasangs)
  const topY = y - halfH;
  // Lead block (first division) subdivided into 4 sub-blocks
  const subDivCount = 4;
  const subBlockW = blockW / subDivCount;
  for (let s = 0; s < subDivCount; s++) {
    blocks.push({
      x: x + s * subBlockW,
      y: topY,
      width: subBlockW,
      height: halfH,
      isFilled: s % 2 === 1,
      track: 'primary',
    });
  }

  // Remaining major blocks for Primary Track
  for (let d = 1; d < divisions; d++) {
    blocks.push({
      x: x + d * blockW,
      y: topY,
      width: blockW,
      height: halfH,
      isFilled: d % 2 === 0,
      track: 'primary',
    });
  }

  // 2. Secondary Track (Bottom - Miles)
  const botY = y;
  for (let d = 0; d < divisions; d++) {
    blocks.push({
      x: x + d * blockW,
      y: botY,
      width: blockW,
      height: halfH,
      isFilled: d % 2 === 1,
      track: 'secondary',
    });
  }

  // 3. Division Ticks & Numeric Callouts
  const primaryTotal = config.primaryRatio ?? 50;
  const secondaryTotal = config.secondaryRatio ?? 175;

  // Top ticks (Parasangs)
  for (let d = 0; d <= divisions; d++) {
    const tickX = x + d * blockW;
    const val = Math.round((d / divisions) * primaryTotal);
    ticks.push({
      x: tickX,
      yTop: topY - 5,
      yBottom: topY,
      isMajor: true,
      label: String(val),
      position: 'top',
    });

    labels.push({
      text: String(val),
      x: tickX,
      y: topY - 10,
      fontSize: 10,
      align: 'center',
    });
  }

  // Bottom ticks (Miles)
  for (let d = 0; d <= divisions; d++) {
    const tickX = x + d * blockW;
    const val = Math.round((d / divisions) * secondaryTotal);
    ticks.push({
      x: tickX,
      yTop: botY + halfH,
      yBottom: botY + halfH + 5,
      isMajor: true,
      label: String(val),
      position: 'bottom',
    });

    labels.push({
      text: String(val),
      x: tickX,
      y: botY + halfH + 11,
      fontSize: 10,
      align: 'center',
    });
  }

  // Unit Labels
  const primaryUnit = config.primaryUnit ?? 'PARASANGS';
  const secondaryUnit = config.secondaryUnit ?? 'MILES';

  labels.push({
    text: primaryUnit,
    x: x + W / 2,
    y: topY - 22,
    fontSize: 11,
    align: 'center',
  });

  labels.push({
    text: secondaryUnit,
    x: x + W / 2,
    y: botY + halfH + 24,
    fontSize: 11,
    align: 'center',
  });

  // 4. Architectural Decorative End Finials
  const leftFinial: MapPoint[] = [
    { x: x, y: topY },
    { x: x - 6, y: topY - 4 },
    { x: x - 10, y: y },
    { x: x - 6, y: botY + halfH + 4 },
    { x: x, y: botY + halfH },
  ];

  const rightFinial: MapPoint[] = [
    { x: x + W, y: topY },
    { x: x + W + 6, y: topY - 4 },
    { x: x + W + 10, y: y },
    { x: x + W + 6, y: botY + halfH + 4 },
    { x: x + W, y: botY + halfH },
  ];

  return {
    bounds: { x: x - 18, y: topY - 32, width: W + 36, height: H + 64 },
    center: { x: x + W / 2, y },
    blocks,
    ticks,
    finials: {
      left: leftFinial,
      right: rightFinial,
    },
    labels,
  };
}

function parseHex(c: string | number | undefined, fallback: number): number {
  if (typeof c === 'number') return c;
  if (!c) return fallback;
  if (c.startsWith('#')) return parseInt(c.slice(1), 16) || fallback;
  return fallback;
}

/**
 * Renders the dual-unit linear scale bar onto PixiJS Graphics and Container.
 */
export function renderScaleBar(
  graphics: Graphics,
  textContainer: Container,
  config: ScaleBarConfig = {}
): void {
  const geom = generateScaleBarGeometry(config);

  const darkInk = parseHex(config.primaryColor, 0x2c1810);
  const lightFill = parseHex(config.secondaryColor, 0xfbf7ee);
  const parchmentBase = parseHex(VINTAGE_PARCHMENT.landFill, 0xf4ede0);
  const brassAccent = 0x8c6d3b;

  const toFlat = (pts: MapPoint[]) => pts.flatMap((p) => [p.x, p.y]);

  // 1. Parchment Underlay
  graphics
    .rect(geom.bounds.x, geom.bounds.y, geom.bounds.width, geom.bounds.height)
    .fill({ color: parchmentBase, alpha: 0.88 })
    .stroke({ color: darkInk, width: 0.7, alpha: 0.4 });

  // 2. Draw Scale Track Blocks
  for (const block of geom.blocks) {
    const fillColor = block.isFilled ? darkInk : lightFill;
    graphics
      .rect(block.x, block.y, block.width, block.height)
      .fill({ color: fillColor, alpha: block.isFilled ? 0.95 : 0.92 })
      .stroke({ color: darkInk, width: 0.85, alpha: 0.9 });
  }

  // Center horizontal dividing line separating top & bottom tracks
  const leftX = geom.blocks[0]?.x ?? 0;
  const rightX = leftX + (config.width ?? 320);
  graphics.moveTo(leftX, geom.center.y).lineTo(rightX, geom.center.y).stroke({ color: darkInk, width: 1.2, alpha: 0.95 });

  // 3. Ticks
  for (const tick of geom.ticks) {
    graphics.moveTo(tick.x, tick.yTop).lineTo(tick.x, tick.yBottom).stroke({ color: darkInk, width: 1.0, alpha: 0.9 });
  }

  // 4. End Finials
  graphics
    .poly(toFlat(geom.finials.left))
    .fill({ color: brassAccent, alpha: 0.9 })
    .stroke({ color: darkInk, width: 1.0, alpha: 0.9 });

  graphics
    .poly(toFlat(geom.finials.right))
    .fill({ color: brassAccent, alpha: 0.9 })
    .stroke({ color: darkInk, width: 1.0, alpha: 0.9 });

  // 5. Typography
  for (const label of geom.labels) {
    const isUnit = label.text === (config.primaryUnit ?? 'PARASANGS') || label.text === (config.secondaryUnit ?? 'MILES');
    const textStyle = {
      fontFamily: '"Cinzel", "Times New Roman", "Georgia", serif',
      fontSize: label.fontSize,
      fontWeight: (isUnit ? 'bold' : 'normal') as 'bold' | 'normal',
      fill: isUnit ? '#2c1810' : '#4a382c',
      letterSpacing: isUnit ? 2.5 : 0.5,
    };

    const pixiText = new Text({
      text: label.text,
      style: textStyle,
    });
    pixiText.anchor.set(0.5, 0.5);
    pixiText.x = label.x;
    pixiText.y = label.y;
    textContainer.addChild(pixiText);
  }
}
