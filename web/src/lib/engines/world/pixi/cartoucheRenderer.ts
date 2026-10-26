/**
 * cartoucheRenderer.ts
 *
 * Procedural Baroque & Renaissance title cartouche generator & renderer
 * for the illuminated manuscript cartography engine (Plan 27 Phase E.3).
 *
 * Visual Features:
 * - Architectural strapwork frame with classical corner volutes and acanthus flourishes.
 * - Solid multi-layer parchment shield/plaque masking terrain beneath.
 * - Double hairline border with corner rivets and decorative inner fillet.
 * - Grand illuminated Roman serif titling ("FARAVAND") with tracking and drop stroke.
 * - Waving banner ribbon for subtitle ("TERRA INCOGNITA" / Realm Name) with folded swallowtail folds.
 * - Lower heraldic drop flourish / palmette finial.
 */

import { Graphics, Container, Text } from 'pixi.js';
import type { MapPoint, TitleCartoucheConfig } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';

export interface CartoucheCornerVolute {
  outerCurve: MapPoint[];
  innerCurve: MapPoint[];
  eyePoint: MapPoint;
}

export interface CartoucheRibbon {
  frontPoints: MapPoint[];
  leftFold: MapPoint[];
  rightFold: MapPoint[];
  leftSwallowtail: MapPoint[];
  rightSwallowtail: MapPoint[];
}

export interface CartoucheGeometry {
  bounds: { x: number; y: number; width: number; height: number };
  center: MapPoint;
  plaquePolygon: MapPoint[];
  innerFrame: MapPoint[];
  cornerVolutes: CartoucheCornerVolute[];
  ribbon: CartoucheRibbon;
  topCrest: MapPoint[];
  bottomDrop: MapPoint[];
}

/**
 * Computes pure mathematical coordinates for the Baroque strapwork title cartouche.
 */
export function generateCartoucheGeometry(config: TitleCartoucheConfig = {}): CartoucheGeometry {
  const cx = config.x ?? 320;
  const cy = config.y ?? 180;
  const W = config.width ?? 380;
  const H = config.height ?? 170;

  const left = cx - W / 2;
  const right = cx + W / 2;
  const top = cy - H / 2;
  const bottom = cy + H / 2;
  const cornerR = 24;

  // 1. Plaque Outer Polygon (chamfered / notched architectural tablet)
  const plaquePolygon: MapPoint[] = [
    { x: left + cornerR, y: top },
    { x: cx - 40, y: top },
    { x: cx, y: top - 8 }, // top center arch apex
    { x: cx + 40, y: top },
    { x: right - cornerR, y: top },
    { x: right, y: top + cornerR },
    { x: right, y: bottom - cornerR },
    { x: right - cornerR, y: bottom },
    { x: cx + 40, y: bottom },
    { x: cx, y: bottom + 6 }, // bottom subtle point
    { x: cx - 40, y: bottom },
    { x: left + cornerR, y: bottom },
    { x: left, y: bottom - cornerR },
    { x: left, y: top + cornerR },
  ];

  // 2. Inner Frame Border (inset 8px)
  const pad = 9;
  const innerFrame: MapPoint[] = [
    { x: left + cornerR + pad * 0.5, y: top + pad },
    { x: right - cornerR - pad * 0.5, y: top + pad },
    { x: right - pad, y: top + cornerR + pad * 0.5 },
    { x: right - pad, y: bottom - cornerR - pad * 0.5 },
    { x: right - cornerR - pad * 0.5, y: bottom - pad },
    { x: left + cornerR + pad * 0.5, y: bottom - pad },
    { x: left + pad, y: bottom - cornerR - pad * 0.5 },
    { x: left + pad, y: top + cornerR + pad * 0.5 },
  ];

  // 3. Baroque Corner Strapwork Volutes
  const volutes: CartoucheCornerVolute[] = [];
  const corners = [
    { x: left, y: top, dx: -1, dy: -1 },
    { x: right, y: top, dx: 1, dy: -1 },
    { x: right, y: bottom, dx: 1, dy: 1 },
    { x: left, y: bottom, dx: -1, dy: 1 },
  ];

  for (const c of corners) {
    const ox = c.x;
    const oy = c.y;
    const outerCurve: MapPoint[] = [
      { x: ox + c.dx * 18, y: oy },
      { x: ox + c.dx * 28, y: oy + c.dy * 12 },
      { x: ox + c.dx * 22, y: oy + c.dy * 26 },
      { x: ox + c.dx * 6, y: oy + c.dy * 22 },
      { x: ox, y: oy + c.dy * 18 },
    ];
    const innerCurve: MapPoint[] = [
      { x: ox + c.dx * 14, y: oy + c.dy * 6 },
      { x: ox + c.dx * 18, y: oy + c.dy * 14 },
      { x: ox + c.dx * 12, y: oy + c.dy * 16 },
    ];
    volutes.push({
      outerCurve,
      innerCurve,
      eyePoint: { x: ox + c.dx * 14, y: oy + c.dy * 14 },
    });
  }

  // 4. Subtitle Ribbon Banner (nested across lower third)
  const ribbonY = cy + 32;
  const ribbonHalfW = W * 0.38;
  const ribbonH = 26;

  const frontPoints: MapPoint[] = [
    { x: cx - ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx + ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx + ribbonHalfW, y: ribbonY + ribbonH / 2 },
    { x: cx - ribbonHalfW, y: ribbonY + ribbonH / 2 },
  ];

  // Swallowtail tails flanking the ribbon
  const tailReach = 28;
  const tailDrop = 10;
  const leftFold: MapPoint[] = [
    { x: cx - ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx - ribbonHalfW, y: ribbonY + ribbonH / 2 },
    { x: cx - ribbonHalfW - 8, y: ribbonY + ribbonH / 2 + 6 },
  ];
  const rightFold: MapPoint[] = [
    { x: cx + ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx + ribbonHalfW, y: ribbonY + ribbonH / 2 },
    { x: cx + ribbonHalfW + 8, y: ribbonY + ribbonH / 2 + 6 },
  ];

  const leftSwallowtail: MapPoint[] = [
    { x: cx - ribbonHalfW - 8, y: ribbonY - ribbonH / 2 + tailDrop },
    { x: cx - ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx - ribbonHalfW, y: ribbonY + ribbonH / 2 },
    { x: cx - ribbonHalfW - 8, y: ribbonY + ribbonH / 2 + 6 },
    { x: cx - ribbonHalfW - tailReach, y: ribbonY + ribbonH / 2 + 10 },
    { x: cx - ribbonHalfW - tailReach + 10, y: ribbonY + 2 }, // notch
    { x: cx - ribbonHalfW - tailReach, y: ribbonY - ribbonH / 2 + 2 },
  ];

  const rightSwallowtail: MapPoint[] = [
    { x: cx + ribbonHalfW + 8, y: ribbonY - ribbonH / 2 + tailDrop },
    { x: cx + ribbonHalfW, y: ribbonY - ribbonH / 2 },
    { x: cx + ribbonHalfW, y: ribbonY + ribbonH / 2 },
    { x: cx + ribbonHalfW + 8, y: ribbonY + ribbonH / 2 + 6 },
    { x: cx + ribbonHalfW + tailReach, y: ribbonY + ribbonH / 2 + 10 },
    { x: cx + ribbonHalfW + tailReach - 10, y: ribbonY + 2 }, // notch
    { x: cx + ribbonHalfW + tailReach, y: ribbonY - ribbonH / 2 + 2 },
  ];

  // 5. Top Crest Shell / Palmette
  const topCrest: MapPoint[] = [
    { x: cx - 24, y: top - 4 },
    { x: cx - 14, y: top - 18 },
    { x: cx, y: top - 24 },
    { x: cx + 14, y: top - 18 },
    { x: cx + 24, y: top - 4 },
  ];

  // 6. Bottom Drop Finial
  const bottomDrop: MapPoint[] = [
    { x: cx - 18, y: bottom + 4 },
    { x: cx - 8, y: bottom + 16 },
    { x: cx, y: bottom + 24 },
    { x: cx + 8, y: bottom + 16 },
    { x: cx + 18, y: bottom + 4 },
  ];

  return {
    bounds: { x: left, y: top, width: W, height: H },
    center: { x: cx, y: cy },
    plaquePolygon,
    innerFrame,
    cornerVolutes: volutes,
    ribbon: {
      frontPoints,
      leftFold,
      rightFold,
      leftSwallowtail,
      rightSwallowtail,
    },
    topCrest,
    bottomDrop,
  };
}

function parseHex(c: string | number | undefined, fallback: number): number {
  if (typeof c === 'number') return c;
  if (!c) return fallback;
  if (c.startsWith('#')) return parseInt(c.slice(1), 16) || fallback;
  return fallback;
}

/**
 * Renders the Baroque strapwork title cartouche onto PixiJS Graphics and Container.
 */
export function renderTitleCartouche(
  graphics: Graphics,
  textContainer: Container,
  config: TitleCartoucheConfig = {}
): void {
  const geom = generateCartoucheGeometry(config);

  const darkInk = parseHex(config.primaryColor, 0x2c1810);
  const parchmentFill = parseHex(config.fillColor, 0xfcf8ee);
  const parchmentShade = parseHex(VINTAGE_PARCHMENT.landFill, 0xf2e8d3);
  const brassAccent = 0x8c6d3b;

  const toFlat = (pts: MapPoint[]) => pts.flatMap((p) => [p.x, p.y]);

  // 1. Drop Shadow / Depth Rim (subtle offset)
  if (config.shadow !== false) {
    const shadowPts = geom.plaquePolygon.map((p) => ({ x: p.x + 3.5, y: p.y + 4.5 }));
    graphics.poly(toFlat(shadowPts)).fill({ color: 0x2c1810, alpha: 0.16 });
  }

  // 2. Plaque Background Fill
  graphics
    .poly(toFlat(geom.plaquePolygon))
    .fill({ color: parchmentFill, alpha: 0.96 })
    .stroke({ color: darkInk, width: 2.2, alpha: 0.95 });

  // 3. Top Crest & Bottom Drop Ornaments
  graphics
    .poly(toFlat(geom.topCrest))
    .fill({ color: parchmentShade, alpha: 0.9 })
    .stroke({ color: darkInk, width: 1.4, alpha: 0.9 });
  // Crest interior fan striae
  graphics.moveTo(geom.center.x, geom.bounds.y - 8).lineTo(geom.center.x, geom.bounds.y - 23).stroke({ color: darkInk, width: 0.8, alpha: 0.7 });
  graphics.moveTo(geom.center.x - 10, geom.bounds.y - 6).lineTo(geom.center.x - 12, geom.bounds.y - 17).stroke({ color: darkInk, width: 0.7, alpha: 0.6 });
  graphics.moveTo(geom.center.x + 10, geom.bounds.y - 6).lineTo(geom.center.x + 12, geom.bounds.y - 17).stroke({ color: darkInk, width: 0.7, alpha: 0.6 });

  graphics
    .poly(toFlat(geom.bottomDrop))
    .fill({ color: parchmentShade, alpha: 0.9 })
    .stroke({ color: darkInk, width: 1.4, alpha: 0.9 });

  // 4. Corner Volutes (Baroque Scrollwork)
  for (const volute of geom.cornerVolutes) {
    graphics
      .poly(toFlat(volute.outerCurve))
      .fill({ color: parchmentShade, alpha: 0.88 })
      .stroke({ color: darkInk, width: 1.2, alpha: 0.9 });

    graphics
      .poly(toFlat(volute.innerCurve))
      .stroke({ color: darkInk, width: 0.8, alpha: 0.75 });

    graphics.circle(volute.eyePoint.x, volute.eyePoint.y, 2.2).fill({ color: darkInk, alpha: 0.85 });
  }

  // 5. Inner Hairline Fillet Border
  graphics.poly(toFlat(geom.innerFrame)).stroke({ color: darkInk, width: 0.75, alpha: 0.7 });

  // Corner Diamond Rivets inside fillet
  const pad = 14;
  const rivets = [
    { x: geom.bounds.x + pad, y: geom.bounds.y + pad },
    { x: geom.bounds.x + geom.bounds.width - pad, y: geom.bounds.y + pad },
    { x: geom.bounds.x + geom.bounds.width - pad, y: geom.bounds.y + geom.bounds.height - pad },
    { x: geom.bounds.x + pad, y: geom.bounds.y + geom.bounds.height - pad },
  ];
  for (const r of rivets) {
    graphics.circle(r.x, r.y, 1.8).fill({ color: brassAccent, alpha: 0.9 }).stroke({ color: darkInk, width: 0.6 });
  }

  // 6. Subtitle Ribbon Banner
  const { frontPoints, leftFold, rightFold, leftSwallowtail, rightSwallowtail } = geom.ribbon;

  // Under-folds (dark shaded parchment behind)
  graphics.poly(toFlat(leftFold)).fill({ color: darkInk, alpha: 0.75 });
  graphics.poly(toFlat(rightFold)).fill({ color: darkInk, alpha: 0.75 });

  // Swallowtail tails
  graphics
    .poly(toFlat(leftSwallowtail))
    .fill({ color: parchmentShade, alpha: 0.94 })
    .stroke({ color: darkInk, width: 1.0, alpha: 0.9 });
  graphics
    .poly(toFlat(rightSwallowtail))
    .fill({ color: parchmentShade, alpha: 0.94 })
    .stroke({ color: darkInk, width: 1.0, alpha: 0.9 });

  // Front Ribbon Plaque
  graphics
    .poly(toFlat(frontPoints))
    .fill({ color: parchmentFill, alpha: 0.98 })
    .stroke({ color: darkInk, width: 1.3, alpha: 0.95 });

  // 7. Typography (Rendered with PixiJS Text)
  const titleText = config.title ?? 'FARAVAND';
  const subtitleText = config.subtitle ?? 'TERRA INCOGNITA';
  const calloutText = config.callout ?? 'CHRONICA REGNI';

  // Primary Title: Grand Classical Roman Serif
  const titleStyle = {
    fontFamily: '"Cinzel Decorative", "Cinzel", "Times New Roman", "Georgia", serif',
    fontSize: 27,
    fontWeight: 'bold' as const,
    fill: '#23140e',
    letterSpacing: 6,
    stroke: {
      color: '#fffef9',
      width: 3.5,
    },
  };
  const titlePixi = new Text({
    text: titleText.toUpperCase(),
    style: titleStyle,
  });
  titlePixi.anchor.set(0.5, 0.5);
  titlePixi.x = geom.center.x;
  titlePixi.y = geom.center.y - 24;
  textContainer.addChild(titlePixi);

  // Subtitle Ribbon Text
  const subtitleStyle = {
    fontFamily: '"Cinzel", "Times New Roman", "Georgia", serif',
    fontSize: 12,
    fontWeight: 'bold' as const,
    fill: '#4a3325',
    letterSpacing: 3,
  };
  const subtitlePixi = new Text({
    text: subtitleText.toUpperCase(),
    style: subtitleStyle,
  });
  subtitlePixi.anchor.set(0.5, 0.5);
  subtitlePixi.x = geom.center.x;
  subtitlePixi.y = geom.center.y + 32;
  textContainer.addChild(subtitlePixi);

  // Callout Text (small classical inscription at top or bottom)
  if (calloutText) {
    const calloutStyle = {
      fontFamily: '"Times New Roman", "Georgia", serif',
      fontSize: 9.5,
      fontStyle: 'italic' as const,
      fill: '#7a6252',
      letterSpacing: 1.5,
    };
    const calloutPixi = new Text({
      text: calloutText,
      style: calloutStyle,
    });
    calloutPixi.anchor.set(0.5, 0.5);
    calloutPixi.x = geom.center.x;
    calloutPixi.y = geom.center.y - 50;
    textContainer.addChild(calloutPixi);
  }
}
