import type { Graphics } from 'pixi.js';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import { VINTAGE_PARCHMENT } from '../vintageTheme';
import { hashStringToSeed } from '../mountainGenerator';
import {
  generateProceduralRiver,
  type ProceduralRiver,
} from '../riverGenerator';
import {
  buildDeltaShorelineRuns,
  buildDeltaWaterRings,
  type ProceduralDelta,
} from '../deltaGenerator';
import { toFlatPoints } from './shared';

/**
 * Rivers: organically meandered, tapered variable-width blue ribbons with crisp dark ink banks.
 */
export function drawRiver(g: Graphics, feat: MapTerrainFeature): void {
  if (!feat.points || feat.points.length < 2) return;

  const seed = hashStringToSeed(feat.id || `river_${feat.points[0].x}_${feat.points[0].y}`);
  const river = generateProceduralRiver(feat.points, {
    seed,
    startWidth: 1.2,
    endWidth: feat.width || 11.0,
    meanderRoughness: 0.3,
    deltaConfig: feat.deltaConfig,
  });

  renderProceduralRiverToGraphics(g, river);
}

/**
 * Renders a ProceduralRiver geometry object onto a Pixi Graphics context.
 */
export function renderProceduralRiverToGraphics(g: Graphics, river: ProceduralRiver): void {
  // Hydrology V2 Delta Distributary Fan (Plan 27 — Module 1)
  if (river.delta) {
    renderDeltaToGraphics(g, river.delta);
    return;
  }

  // 1. Soft Watercolor Wash
  if (river.waterPolygon.length >= 3) {
    g.poly(toFlatPoints(river.waterPolygon)).fill({
      color: VINTAGE_PARCHMENT.riverWash,
      alpha: 0.6,
    });
  }

  // 2. Left Bank Hand-inked Outline
  if (river.leftBank.length >= 2) {
    g.moveTo(river.leftBank[0].x, river.leftBank[0].y);
    for (let i = 1; i < river.leftBank.length; i++) {
      g.lineTo(river.leftBank[i].x, river.leftBank[i].y);
    }
    g.stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.riverBankInk,
      cap: 'round',
      join: 'round',
    });
  }

  // 3. Right Bank Hand-inked Outline
  if (river.rightBank.length >= 2) {
    g.moveTo(river.rightBank[0].x, river.rightBank[0].y);
    for (let i = 1; i < river.rightBank.length; i++) {
      g.lineTo(river.rightBank[i].x, river.rightBank[i].y);
    }
    g.stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.riverBankInk,
      cap: 'round',
      join: 'round',
    });
  }
}

/**
 * Delta rendering: one shoreline, one water tone, islands lifted out of it.
 *
 * Draw order matters here. Water goes down per channel first, then the islands
 * (cut from the channel gaps, so they always fit) are painted back in as land,
 * then every land/water edge is inked in one pass, and the canopy is laid on
 * top so no bank line cuts across the trees.
 *
 * The merged water ring from `buildDeltaWaterRings` is used for the shoreline
 * only. Filling it would flood the wedge between the arms: a branching body of
 * water has a self-touching boundary at the fork, which neither nonzero fill
 * nor earcut triangulation can resolve.
 */
export function renderDeltaToGraphics(g: Graphics, delta: ProceduralDelta): void {
  const waterRings = buildDeltaWaterRings(delta);
  const shorelineRuns = buildDeltaShorelineRuns(delta, waterRings);

  // 1. Water. Trunk last so the confluence reads as one body, with the branch
  //    washes drawn under it.
  const wash = (pts: MapPoint[]) => {
    if (pts.length < 3) return;
    g.poly(toFlatPoints(pts)).fill({
      color: VINTAGE_PARCHMENT.riverWash,
      alpha: 0.55,
    });
  };

  for (const b of delta.branches) wash(b.waterPolygon);
  wash(delta.trunkWaterPolygon);

  // 2. Islands: land lifted out of the water.
  for (const island of delta.islands) {
    if (island.polygon.length < 3) continue;
    const flatPts = toFlatPoints(island.polygon);
    const isIslet = island.kind === 'islet';

    // Shallow-water shadow on the seaward side gives the land some relief.
    if (!isIslet) {
      const shadow = island.polygon.map((p) => ({ x: p.x + 0.9, y: p.y + 0.9 }));
      g.poly(toFlatPoints(shadow)).fill({
        color: VINTAGE_PARCHMENT.riverBankInk,
        alpha: 0.1,
      });
    }

    // Parchment body, then a barely-there silt tint. The old 0.28-0.38 wash
    // turned every island into a solid green blob.
    g.poly(flatPts).fill({
      color: VINTAGE_PARCHMENT.landFill,
      alpha: 1.0,
    });
    g.poly(flatPts).fill({
      color: VINTAGE_PARCHMENT.biomeForest,
      alpha: isIslet ? 0.14 : 0.1,
    });

    // Silt hatching, now actually populated by the generator.
    if (island.hatchLines.length > 0) {
      for (const [hA, hB] of island.hatchLines) {
        g.moveTo(hA.x, hA.y).lineTo(hB.x, hB.y);
      }
      g.stroke({
        width: 0.7,
        color: VINTAGE_PARCHMENT.coastlineHatch,
        alpha: 0.42,
        cap: 'round',
      });
    }
  }

  // 3. Shoreline. One stroke pass over the union boundary (open where the
  //    channels meet the sea) plus each island rim, so every water edge in the
  //    delta is inked the same way instead of a dozen separate bank polylines.
  const inkRuns = (runs: MapPoint[][], width: number, alpha: number) => {
    if (runs.length === 0) return;
    for (const run of runs) {
      if (run.length < 2) continue;
      g.moveTo(run[0].x, run[0].y);
      for (let i = 1; i < run.length; i++) {
        g.lineTo(run[i].x, run[i].y);
      }
    }
    g.stroke({
      width,
      color: VINTAGE_PARCHMENT.riverBankInk,
      alpha,
      cap: 'round',
      join: 'round',
    });
  };

  inkRuns(shorelineRuns, 1.25, 0.92);

  const islandRims: MapPoint[][] = [];
  for (const island of delta.islands) {
    if (island.polygon.length < 3) continue;
    islandRims.push([...island.polygon, island.polygon[0]]);
  }
  inkRuns(islandRims, 1.0, 0.85);

  // 4. Woodland canopy. Each tree is a small clump of overlapping crowns with
  //    no outline: a single inked circle per tree read as a grape on a stick.
  const crownTones = [0x3d5030, 0x455838, 0x4d6240];
  const litTones = [0x5a7043, 0x627a4a, 0x6b8352];
  for (const island of delta.islands) {
    for (const tree of island.trees) {
      const idx = Math.min(crownTones.length - 1, Math.floor(tree.shade * 3));
      const { x, y } = tree.center;
      const r = tree.radius;

      // Ground shadow, set south-east like the rest of the map's relief.
      g.circle(x + r * 0.34, y + r * 0.3, r * 1.02).fill({
        color: 0x2c3a22,
        alpha: 0.16,
      });

      // Clumped silhouette: main crown plus two offset lobes.
      g.circle(x, y, r).fill({ color: crownTones[idx], alpha: 0.9 });
      g.circle(x - r * 0.52, y + r * 0.18, r * 0.62).fill({
        color: crownTones[idx],
        alpha: 0.85,
      });
      g.circle(x + r * 0.44, y - r * 0.4, r * 0.56).fill({
        color: litTones[idx],
        alpha: 0.8,
      });
    }
  }
}
