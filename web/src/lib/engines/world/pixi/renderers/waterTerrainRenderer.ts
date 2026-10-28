import type { Graphics } from 'pixi.js';
import type { MapTerrainFeature } from '@/lib/types';
import { VINTAGE_PARCHMENT } from '../vintageTheme';
import { generateOrganicParchmentContours } from '../pixiMath';
import type { FillWithMaterial } from '../renderTypes';
import { hashStringToSeed } from '../mountainGenerator';
import {
  generateCoastlineWaterlines,
  generateLakeWaterlines,
  type ProceduralWaterlining,
} from '../waterliningGenerator';
import { toFlatPoints } from './shared';

/** Continents and islands: parchment fill, inked coastline, echo rings. */
export function drawLandmass(g: Graphics, feat: MapTerrainFeature, fill: FillWithMaterial): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const points = generateOrganicParchmentContours(feat.polygon, 3);
  const flatPoints = toFlatPoints(points);

  // Land fill — the paper material
  fill(g, flatPoints, 'land', VINTAGE_PARCHMENT.landFill, 1);

  // Hand-inked primary coastline
  g.poly(flatPoints).stroke({ width: 2.2, color: VINTAGE_PARCHMENT.coastlineInk });

  // Concentric Shoreline Waterlining (Plan 27 — Module 2)
  if (feat.waterliningConfig?.enabled !== false) {
    const seed = hashStringToSeed(feat.id || `coast_${points[0].x}_${points[0].y}`);
    const waterlines = generateCoastlineWaterlines(points, {
      seed,
      ...feat.waterliningConfig,
    });
    if (waterlines) {
      renderWaterliningToGraphics(g, waterlines);
    }
  } else {
    // Subtle fallback glow
    g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
  }

  // Inland water is drawn only by its lake feature. A landmass no longer owns
  // a duplicate water hole, which is what made a carved lake appear twice: once
  // as a selectable lake and once as an unselectable gap in the land.
}

/** Flat hole rings used to cut islands out of every water fill layer. */
export function flatWaterHoles(feat: MapTerrainFeature): number[][] {
  return (feat.holes ?? [])
    .filter((hole) => hole.length > 2)
    .map((hole) =>
      toFlatPoints(generateOrganicParchmentContours(hole, 2))
    );
}

/** Standing water: open-ocean sheets and large seas. */
export function drawWaterBody(
  g: Graphics,
  feat: MapTerrainFeature,
  material: 'ocean' | 'water',
  fill: FillWithMaterial
): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const points = generateOrganicParchmentContours(feat.polygon, 2);
  const flatPoints = toFlatPoints(points);

  // A lake can contain an island. Cut those islands out of the water fill so
  // the land underneath (drawn in the land band) stays visible.
  fill(g, flatPoints, material, VINTAGE_PARCHMENT.oceanWash, 1, flatWaterHoles(feat));

  g.poly(flatPoints).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
  g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
}

/**
 * Lakes: hand-inked fantasy manuscript lakes with multi-tier depth wash
 * (shallow turquoise shelf + deep indigo core) and shoreline wave echo rings.
 */
export function drawLake(
  g: Graphics,
  feat: MapTerrainFeature,
  fill: FillWithMaterial
): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const points = generateOrganicParchmentContours(feat.polygon, 2);
  const flatPoints = toFlatPoints(points);

  // 1. Shallow coastal shelf wash. Islands inside the lake are land, not
  // water, so their rings are cut out of both the flat and textured fill.
  fill(
    g,
    flatPoints,
    'water',
    VINTAGE_PARCHMENT.lakeShallow,
    1,
    flatWaterHoles(feat)
  );

  // 2. Deep lake shelf / center bathymetric depression
  if (points.length >= 4) {
    let cx = 0;
    let cy = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
    }
    cx /= points.length;
    cy /= points.length;

    const deepPoints = points.map((p) => ({
      x: cx + (p.x - cx) * 0.65,
      y: cy + (p.y - cy) * 0.65,
    }));
    const deepFlat = toFlatPoints(deepPoints);
    g.poly(deepFlat).fill({ color: VINTAGE_PARCHMENT.lakeDeep, alpha: 0.55 });

    // The deep wash is contracted around the lake centre, so contract each
    // island hole by the same amount before cutting it out of that wash.
    for (const hole of feat.holes ?? []) {
      if (hole.length <= 2) continue;
      const holePoints = generateOrganicParchmentContours(hole, 2).map((p) => ({
        x: cx + (p.x - cx) * 0.65,
        y: cy + (p.y - cy) * 0.65,
      }));
      g.poly(toFlatPoints(holePoints)).cut();
    }

    g.poly(deepFlat).stroke({ width: 1.0, color: VINTAGE_PARCHMENT.coastlineInk, alpha: 0.25 });
  }

  // 3. Hand-inked primary dark coastline
  g.poly(flatPoints).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });

  // 4. Concentric Shoreline Waterlining (Plan 27 — Module 2: Lake Veridia, Lake Firouzeh)
  if (feat.waterliningConfig?.enabled !== false) {
    const seed = hashStringToSeed(feat.id || `lake_${points[0].x}_${points[0].y}`);
    const waterlines = generateLakeWaterlines(points, {
      seed,
      ...feat.waterliningConfig,
    });
    if (waterlines) {
      renderWaterliningToGraphics(g, waterlines);
    }
  } else {
    g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
  }
}

/**
 * Renders a ProceduralWaterlining geometry object onto Pixi Graphics.
 * Draws successive concentric wave echo contours with atmospheric stroke width
 * and opacity falloff, plus stippled/broken wave crests on the outer ring.
 */
export function renderWaterliningToGraphics(
  g: Graphics,
  waterlines: ProceduralWaterlining
): void {
  for (const ring of waterlines.rings) {
    if (ring.isStippled && ring.dashSegments && ring.dashSegments.length > 0) {
      // Outermost broken wave crest stipples
      for (const [start, end] of ring.dashSegments) {
        g.moveTo(start.x, start.y).lineTo(end.x, end.y);
      }
      g.stroke({
        width: ring.strokeWidth,
        color: ring.color,
        alpha: ring.alpha,
        cap: 'round',
      });
    } else if (ring.polygon.length >= 3) {
      // Continuous concentric wave contour
      g.poly(toFlatPoints(ring.polygon)).stroke({
        width: ring.strokeWidth,
        color: ring.color,
        alpha: ring.alpha,
        cap: 'round',
        join: 'round',
      });
    }
  }
}
