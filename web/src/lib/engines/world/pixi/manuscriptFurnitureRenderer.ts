/**
 * manuscriptFurnitureRenderer.ts
 *
 * Master orchestrator for Manuscript Furniture & Embellishments (Plan 27 Phase E.3).
 *
 * Coordinates:
 * - 16-point nautical compass rose (compassRoseRenderer.ts)
 * - Baroque title cartouche "FARAVAND" (cartoucheRenderer.ts)
 * - Dual-unit linear scale bar (scaleBarRenderer.ts)
 * - Hand-inked maritime vignettes (caravel ships & mythical sea serpents)
 */

import { Graphics, Container } from 'pixi.js';
import type { MapPoint, ManuscriptFurnitureConfig, MaritimeVignette } from '@/lib/types';
import { renderCompassRose } from './compassRoseRenderer';
import { renderTitleCartouche } from './cartoucheRenderer';
import { renderScaleBar } from './scaleBarRenderer';

/**
 * Procedural geometry for a hand-inked caravel / galleon sailing ship.
 */
export function generateCaravelGeometry(vignette: MaritimeVignette) {
  const { x, y, scale = 1.0, mirror = false } = vignette;
  const s = scale;
  const dir = mirror ? -1 : 1;

  // Hull
  const hull: MapPoint[] = [
    { x: x - 32 * s * dir, y: y + 2 * s }, // bowsprit base
    { x: x - 42 * s * dir, y: y - 8 * s }, // bowsprit tip
    { x: x - 28 * s * dir, y: y + 8 * s }, // forecastle
    { x: x - 18 * s * dir, y: y + 14 * s }, // waist
    { x: x + 16 * s * dir, y: y + 14 * s },
    { x: x + 28 * s * dir, y: y + 6 * s }, // poop deck
    { x: x + 30 * s * dir, y: y - 2 * s }, // stern transom
    { x: x + 24 * s * dir, y: y + 18 * s }, // keel stern
    { x: x - 20 * s * dir, y: y + 18 * s }, // keel bow
  ];

  // Masts & Yardarms
  const mainMast = {
    base: { x: x + 2 * s * dir, y: y + 14 * s },
    top: { x: x + 2 * s * dir, y: y - 36 * s },
    yardLower: [
      { x: x - 16 * s * dir, y: y - 8 * s },
      { x: x + 20 * s * dir, y: y - 8 * s },
    ],
    yardUpper: [
      { x: x - 12 * s * dir, y: y - 24 * s },
      { x: x + 16 * s * dir, y: y - 24 * s },
    ],
  };

  const foreMast = {
    base: { x: x - 16 * s * dir, y: y + 12 * s },
    top: { x: x - 16 * s * dir, y: y - 26 * s },
    yard: [
      { x: x - 28 * s * dir, y: y - 10 * s },
      { x: x - 4 * s * dir, y: y - 10 * s },
    ],
  };

  const mizzenMast = {
    base: { x: x + 20 * s * dir, y: y + 10 * s },
    top: { x: x + 20 * s * dir, y: y - 18 * s },
    lateenYard: [
      { x: x + 10 * s * dir, y: y + 4 * s },
      { x: x + 28 * s * dir, y: y - 16 * s },
    ],
  };

  // Billowing Main Course Sail
  const mainSail: MapPoint[] = [
    { x: x - 16 * s * dir, y: y - 8 * s },
    { x: x + 20 * s * dir, y: y - 8 * s },
    { x: x + 16 * s * dir, y: y + 6 * s },
    { x: x + 2 * s * dir, y: y + 9 * s }, // bellied curve bottom
    { x: x - 14 * s * dir, y: y + 6 * s },
  ];

  // Topsail
  const mainTopSail: MapPoint[] = [
    { x: x - 12 * s * dir, y: y - 24 * s },
    { x: x + 16 * s * dir, y: y - 24 * s },
    { x: x + 14 * s * dir, y: y - 12 * s },
    { x: x - 10 * s * dir, y: y - 12 * s },
  ];

  // Fore Sail
  const foreSail: MapPoint[] = [
    { x: x - 28 * s * dir, y: y - 10 * s },
    { x: x - 4 * s * dir, y: y - 10 * s },
    { x: x - 6 * s * dir, y: y + 4 * s },
    { x: x - 24 * s * dir, y: y + 4 * s },
  ];

  // Wake Ripples
  const wakeRipples = [
    [
      { x: x - 34 * s * dir, y: y + 20 * s },
      { x: x + 36 * s * dir, y: y + 20 * s },
    ],
    [
      { x: x - 22 * s * dir, y: y + 23 * s },
      { x: x + 26 * s * dir, y: y + 23 * s },
    ],
  ];

  return {
    hull,
    mainMast,
    foreMast,
    mizzenMast,
    mainSail,
    mainTopSail,
    foreSail,
    wakeRipples,
  };
}

/**
 * Procedural geometry for a classical coiled sea serpent (leviathan).
 */
export function generateSeaSerpentGeometry(vignette: MaritimeVignette) {
  const { x, y, scale = 1.0, mirror = false } = vignette;
  const s = scale;
  const dir = mirror ? -1 : 1;

  // Head and arched neck
  const headJaws: MapPoint[] = [
    { x: x - 28 * s * dir, y: y - 18 * s }, // upper snout
    { x: x - 38 * s * dir, y: y - 16 * s }, // jaw tip
    { x: x - 34 * s * dir, y: y - 11 * s }, // open mouth corner
    { x: x - 40 * s * dir, y: y - 8 * s },  // lower jaw tip
    { x: x - 26 * s * dir, y: y - 4 * s },  // throat
    { x: x - 18 * s * dir, y: y + 6 * s },  // neck base
    { x: x - 10 * s * dir, y: y + 10 * s },
    { x: x - 14 * s * dir, y: y + 3 * s },
    { x: x - 20 * s * dir, y: y - 10 * s },
  ];

  // Dorsal crest spine horns
  const crestHorns = [
    [
      { x: x - 24 * s * dir, y: y - 16 * s },
      { x: x - 22 * s * dir, y: y - 24 * s },
      { x: x - 18 * s * dir, y: y - 13 * s },
    ],
    [
      { x: x - 16 * s * dir, y: y - 9 * s },
      { x: x - 13 * s * dir, y: y - 17 * s },
      { x: x - 11 * s * dir, y: y - 4 * s },
    ],
  ];

  // First Arch Loop (breaking water)
  const loop1: MapPoint[] = [
    { x: x - 4 * s * dir, y: y + 10 * s },
    { x: x + 6 * s * dir, y: y - 6 * s },
    { x: x + 16 * s * dir, y: y - 6 * s },
    { x: x + 24 * s * dir, y: y + 10 * s },
    { x: x + 18 * s * dir, y: y + 10 * s },
    { x: x + 13 * s * dir, y: y + 0 * s },
    { x: x + 7 * s * dir, y: y + 0 * s },
    { x: x + 1 * s * dir, y: y + 10 * s },
  ];

  // Second Arch Loop (tail whip)
  const loop2: MapPoint[] = [
    { x: x + 28 * s * dir, y: y + 10 * s },
    { x: x + 36 * s * dir, y: y - 2 * s },
    { x: x + 44 * s * dir, y: y + 10 * s },
    { x: x + 40 * s * dir, y: y + 10 * s },
    { x: x + 35 * s * dir, y: y + 3 * s },
    { x: x + 31 * s * dir, y: y + 10 * s },
  ];

  // Tail fluke fins
  const tailFluke: MapPoint[] = [
    { x: x + 44 * s * dir, y: y + 10 * s },
    { x: x + 50 * s * dir, y: y + 0 * s },
    { x: x + 54 * s * dir, y: y - 8 * s },
    { x: x + 48 * s * dir, y: y - 4 * s },
    { x: x + 43 * s * dir, y: y + 8 * s },
  ];

  // Water splashes / foam ripples
  const splashRipples = [
    [
      { x: x - 32 * s * dir, y: y + 11 * s },
      { x: x + 52 * s * dir, y: y + 11 * s },
    ],
    [
      { x: x - 18 * s * dir, y: y + 14 * s },
      { x: x + 34 * s * dir, y: y + 14 * s },
    ],
  ];

  return {
    headJaws,
    crestHorns,
    loop1,
    loop2,
    tailFluke,
    splashRipples,
  };
}

/**
 * Renders hand-inked maritime vignettes onto PixiJS Graphics.
 */
export function renderMaritimeVignettes(graphics: Graphics, vignettes: MaritimeVignette[]): void {
  const darkInk = 0x2c1810;
  const sailCream = 0xfcf8ee;
  const shadowParchment = 0xebdcc4;
  const toFlat = (pts: MapPoint[]) => pts.flatMap((p) => [p.x, p.y]);

  for (const v of vignettes) {
    if (v.type === 'caravel') {
      const ship = generateCaravelGeometry(v);

      // 1. Water ripples under hull
      for (const ripple of ship.wakeRipples) {
        graphics.moveTo(ripple[0].x, ripple[0].y).lineTo(ripple[1].x, ripple[1].y).stroke({
          color: darkInk,
          width: 0.8,
          alpha: 0.45,
        });
      }

      // 2. Hull Planking
      graphics
        .poly(toFlat(ship.hull))
        .fill({ color: shadowParchment, alpha: 0.95 })
        .stroke({ color: darkInk, width: 1.3, alpha: 0.95 });

      // 3. Masts
      const masts = [ship.mainMast, ship.foreMast, ship.mizzenMast];
      for (const m of masts) {
        graphics.moveTo(m.base.x, m.base.y).lineTo(m.top.x, m.top.y).stroke({
          color: darkInk,
          width: 1.2,
          alpha: 0.95,
        });
      }

      // Yards
      graphics.moveTo(ship.mainMast.yardLower[0].x, ship.mainMast.yardLower[0].y).lineTo(ship.mainMast.yardLower[1].x, ship.mainMast.yardLower[1].y).stroke({ color: darkInk, width: 0.9 });
      graphics.moveTo(ship.mainMast.yardUpper[0].x, ship.mainMast.yardUpper[0].y).lineTo(ship.mainMast.yardUpper[1].x, ship.mainMast.yardUpper[1].y).stroke({ color: darkInk, width: 0.8 });
      graphics.moveTo(ship.foreMast.yard[0].x, ship.foreMast.yard[0].y).lineTo(ship.foreMast.yard[1].x, ship.foreMast.yard[1].y).stroke({ color: darkInk, width: 0.8 });
      graphics.moveTo(ship.mizzenMast.lateenYard[0].x, ship.mizzenMast.lateenYard[0].y).lineTo(ship.mizzenMast.lateenYard[1].x, ship.mizzenMast.lateenYard[1].y).stroke({ color: darkInk, width: 0.8 });

      // 4. Billowing Sails
      const sails = [ship.mainSail, ship.mainTopSail, ship.foreSail];
      for (const sail of sails) {
        graphics
          .poly(toFlat(sail))
          .fill({ color: sailCream, alpha: 0.96 })
          .stroke({ color: darkInk, width: 0.9, alpha: 0.9 });
      }

      // Masthead streaming pennant
      const pennant: MapPoint[] = [
        { x: ship.mainMast.top.x, y: ship.mainMast.top.y },
        { x: ship.mainMast.top.x + 14 * (v.mirror ? -1 : 1), y: ship.mainMast.top.y + 2 },
        { x: ship.mainMast.top.x, y: ship.mainMast.top.y + 5 },
      ];
      graphics.poly(toFlat(pennant)).fill({ color: 0x8c2d19, alpha: 0.9 }).stroke({ color: darkInk, width: 0.5 });
    } else if (v.type === 'sea_serpent') {
      const serpent = generateSeaSerpentGeometry(v);

      // Water ripples
      for (const ripple of serpent.splashRipples) {
        graphics.moveTo(ripple[0].x, ripple[0].y).lineTo(ripple[1].x, ripple[1].y).stroke({
          color: darkInk,
          width: 0.9,
          alpha: 0.45,
        });
      }

      // Arched Loops
      const loops = [serpent.loop1, serpent.loop2, serpent.headJaws, serpent.tailFluke];
      for (const loop of loops) {
        graphics
          .poly(toFlat(loop))
          .fill({ color: shadowParchment, alpha: 0.95 })
          .stroke({ color: darkInk, width: 1.25, alpha: 0.95 });
      }

      // Crest Horns
      for (const horn of serpent.crestHorns) {
        graphics.poly(toFlat(horn)).fill({ color: darkInk, alpha: 0.9 }).stroke({ color: darkInk, width: 0.8 });
      }

      // Serpent Eye
      const eyeX = v.x - 28 * (v.scale ?? 1.0) * (v.mirror ? -1 : 1);
      const eyeY = v.y - 12 * (v.scale ?? 1.0);
      graphics.circle(eyeX, eyeY, 1.4).fill({ color: darkInk, alpha: 1.0 });
    }
  }
}

/**
 * Main coordinator function to render all manuscript furniture items.
 */
export function renderManuscriptFurniture(
  graphics: Graphics,
  textContainer: Container,
  config: ManuscriptFurnitureConfig = {},
  mapWidth: number = 2400,
  mapHeight: number = 1600
): void {
  if (config.enabled === false) return;

  // 1. Compass Rose (default: open water in lower right / Gulf of Marvarid)
  const compassCfg = config.compassRose ?? {};
  if (compassCfg.enabled !== false) {
    const resolvedCompass = {
      x: compassCfg.x ?? mapWidth - 260,
      y: compassCfg.y ?? mapHeight - 280,
      radius: compassCfg.radius ?? 110,
      ...compassCfg,
    };
    renderCompassRose(graphics, textContainer, resolvedCompass);
  }

  // 2. Title Cartouche (default: upper left open margin)
  const cartoucheCfg = config.cartouche ?? {};
  if (cartoucheCfg.enabled !== false) {
    const resolvedCartouche = {
      x: cartoucheCfg.x ?? 250,
      y: cartoucheCfg.y ?? 130,
      width: cartoucheCfg.width ?? 380,
      height: cartoucheCfg.height ?? 160,
      title: cartoucheCfg.title ?? 'FARAVAND',
      subtitle: cartoucheCfg.subtitle ?? 'TERRA INCOGNITA',
      callout: cartoucheCfg.callout ?? 'CHRONICA REGNI',
      ...cartoucheCfg,
    };
    renderTitleCartouche(graphics, textContainer, resolvedCartouche);
  }

  // 3. Dual-Unit Scale Bar (default: lower left margin)
  const scaleBarCfg = config.scaleBar ?? {};
  if (scaleBarCfg.enabled !== false) {
    const resolvedScaleBar = {
      x: scaleBarCfg.x ?? 120,
      y: scaleBarCfg.y ?? mapHeight - 75,
      width: scaleBarCfg.width ?? 320,
      height: scaleBarCfg.height ?? 22,
      primaryUnit: scaleBarCfg.primaryUnit ?? 'PARASANGS',
      secondaryUnit: scaleBarCfg.secondaryUnit ?? 'MILES',
      primaryRatio: scaleBarCfg.primaryRatio ?? 50,
      secondaryRatio: scaleBarCfg.secondaryRatio ?? 175,
      ...scaleBarCfg,
    };
    renderScaleBar(graphics, textContainer, resolvedScaleBar);
  }

  // 4. Maritime Vignettes (caravel ship & sea serpent in deep waters)
  const defaultVignettes: MaritimeVignette[] = [
    {
      id: 'vignette_caravel_south',
      type: 'caravel',
      x: mapWidth * 0.45,
      y: mapHeight - 160,
      scale: 1.15,
      mirror: false,
    },
    {
      id: 'vignette_serpent_east',
      type: 'sea_serpent',
      x: mapWidth - 440,
      y: mapHeight - 180,
      scale: 1.0,
      mirror: true,
    },
  ];

  const vignettes = config.vignettes ?? defaultVignettes;
  if (vignettes.length > 0) {
    renderMaritimeVignettes(graphics, vignettes);
  }
}
