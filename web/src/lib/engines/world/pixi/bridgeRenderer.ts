/**
 * bridgeRenderer.ts
 *
 * Renders procedural manuscript fantasy bridges into Pixi.js Graphics.
 * Matches the illuminated parchment aesthetic of Faravand:
 * - Opaque parchment/stone under-deck mask to prevent river water showing through.
 * - Flared masonry abutments anchoring into the riverbanks.
 * - Ashlar paving / timber planks.
 * - Cutwater piers deflecting river currents with downstream wake ripples.
 * - Parapet railings with corner stone finials.
 */

import { Graphics } from 'pixi.js';
import type { MapPoint } from '@/lib/types';
import type { ProceduralBridge } from './bridgeGenerator';
import { VINTAGE_PARCHMENT } from './vintageTheme';

function toFlatPoints(points: MapPoint[]): number[] {
  const flat = new Array<number>(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

/**
 * Renders a collection of ProceduralBridge geometry objects onto a Pixi Graphics context.
 */
export function renderBridgesToGraphics(g: Graphics, bridges: ProceduralBridge[]): void {
  if (bridges.length === 0) return;

  // 1. Base Layer: Solid Parchment Mask
  // Covers river water wash, bank lines, and sandbars under the bridge
  for (const bridge of bridges) {
    if (bridge.leftAbutment.polygon.length >= 3) {
      g.poly(toFlatPoints(bridge.leftAbutment.polygon)).fill({
        color: VINTAGE_PARCHMENT.landFill,
        alpha: 1.0,
      });
    }
    if (bridge.rightAbutment.polygon.length >= 3) {
      g.poly(toFlatPoints(bridge.rightAbutment.polygon)).fill({
        color: VINTAGE_PARCHMENT.landFill,
        alpha: 1.0,
      });
    }
    if (bridge.deckPolygon.length >= 3) {
      g.poly(toFlatPoints(bridge.deckPolygon)).fill({
        color: VINTAGE_PARCHMENT.landFill,
        alpha: 1.0,
      });
    }
  }

  // 2. Piers in the Water with Pointed Cutwaters
  for (const bridge of bridges) {
    for (const pier of bridge.piers) {
      // Pier stone body
      if (pier.polygon.length >= 3) {
        g.poly(toFlatPoints(pier.polygon)).fill({
          color: 0xc8bcab, // Warm ashlar stone wash
          alpha: 0.95,
        });
        g.poly(toFlatPoints(pier.polygon)).stroke({
          width: 1.2,
          color: VINTAGE_PARCHMENT.primaryInk,
        });
      }

      // Cutwater spine line (upstream prow)
      g.moveTo(pier.cutwaterApex.x, pier.cutwaterApex.y)
        .lineTo(pier.center.x, pier.center.y)
        .stroke({
          width: 0.9,
          color: VINTAGE_PARCHMENT.primaryInk,
          alpha: 0.7,
        });

      // Downstream wake ripples
      for (const ripple of pier.wakeRipples) {
        if (ripple.length >= 2) {
          g.moveTo(ripple[0].x, ripple[0].y);
          for (let i = 1; i < ripple.length; i++) {
            g.lineTo(ripple[i].x, ripple[i].y);
          }
          g.stroke({
            width: 1.1,
            color: VINTAGE_PARCHMENT.coastlineGlow,
            alpha: 0.65,
            cap: 'round',
            join: 'round',
          });
        }
      }
    }
  }

  // 3. Under-Deck Barrel Vault Arch Shadows
  for (const bridge of bridges) {
    for (const shadowPoly of bridge.archShadows) {
      if (shadowPoly.length >= 3) {
        g.poly(toFlatPoints(shadowPoly)).fill({
          color: 0x1e130c,
          alpha: 0.28,
        });
      }
    }
  }

  // 4. Deck Planks / Ashlar Paving Joints
  for (const bridge of bridges) {
    for (const [pA, pB] of bridge.transversePlanks) {
      g.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y);
    }
    if (bridge.transversePlanks.length > 0) {
      g.stroke({
        width: 0.8,
        color: VINTAGE_PARCHMENT.secondaryInk,
        alpha: 0.45,
        cap: 'butt',
      });
    }
  }

  // 5. Masonry Abutments Outline & Wing Walls
  for (const bridge of bridges) {
    if (bridge.leftAbutment.polygon.length >= 3) {
      g.poly(toFlatPoints(bridge.leftAbutment.polygon)).stroke({
        width: 1.3,
        color: VINTAGE_PARCHMENT.primaryInk,
      });
    }
    if (bridge.rightAbutment.polygon.length >= 3) {
      g.poly(toFlatPoints(bridge.rightAbutment.polygon)).stroke({
        width: 1.3,
        color: VINTAGE_PARCHMENT.primaryInk,
      });
    }

    // Wing lines
    for (const [wA, wB] of bridge.leftAbutment.wingLines) {
      g.moveTo(wA.x, wA.y).lineTo(wB.x, wB.y);
    }
    for (const [wA, wB] of bridge.rightAbutment.wingLines) {
      g.moveTo(wA.x, wA.y).lineTo(wB.x, wB.y);
    }
    if (
      bridge.leftAbutment.wingLines.length > 0 ||
      bridge.rightAbutment.wingLines.length > 0
    ) {
      g.stroke({
        width: 1.0,
        color: VINTAGE_PARCHMENT.primaryInk,
        alpha: 0.85,
      });
    }
  }

  // 6. Parapet Balustrades & Corner Posts
  for (const bridge of bridges) {
    for (const parapet of bridge.parapets) {
      if (parapet.length >= 2) {
        g.moveTo(parapet[0].x, parapet[0].y);
        for (let i = 1; i < parapet.length; i++) {
          g.lineTo(parapet[i].x, parapet[i].y);
        }
        g.stroke({
          width: 1.6,
          color: VINTAGE_PARCHMENT.primaryInk,
          cap: 'round',
          join: 'round',
        });
      }
    }

    // 4 Corner Post Finials
    for (const post of bridge.cornerPosts) {
      g.circle(post.x, post.y, 2.2)
        .fill({ color: 0xfffaee })
        .stroke({ width: 1.2, color: VINTAGE_PARCHMENT.primaryInk });
    }
  }
}
