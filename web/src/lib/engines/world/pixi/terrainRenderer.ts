import type { Graphics } from 'pixi.js';
import type { MapPoint, MapTerrainFeature, WorldMapSettings } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { generateOrganicParchmentContours } from './pixiMath';
import {
  isObjectVisible,
  isTerrainVisibleInLayers,
  orderTerrainForRender,
} from '../mapObjectOrder';
import type { MapMaterialKey } from '../texturePalette';
import type { FillWithMaterial } from './renderTypes';
import {
  generateProceduralMountainRange,
  generateStandalonePeak,
  hashStringToSeed,
  type ProceduralPeak,
} from './mountainGenerator';
import {
  generateProceduralRiver,
  type ProceduralRiver,
} from './riverGenerator';
import {
  generateProceduralHighland,
  type ProceduralHighland,
} from './highlandGenerator';
import {
  generateBiomeSymbols,
  type BiomeFeatureSymbols,
} from './biomeSymbolGenerator';
import {
  generateProceduralValley,
  type ProceduralValley,
} from './valleyGenerator';

export function renderTerrain(
  g: Graphics,
  terrainFeatures: MapTerrainFeature[],
  settings: WorldMapSettings,
  fill: FillWithMaterial
): void {
  g.clear();

  for (const feat of orderTerrainForRender(terrainFeatures)) {
    if (!isObjectVisible(feat)) continue;
    if (!isTerrainVisibleInLayers(feat.type, settings.visibleLayers)) continue;

    switch (feat.type) {
      case 'continent':
      case 'island':
        drawLandmass(g, feat, fill);
        break;
      case 'highland':
      case 'plateau':
        drawHighland(g, feat, fill);
        break;
      case 'ocean':
      case 'sea':
        drawWaterBody(g, feat, 'ocean', fill);
        break;
      case 'lake':
        drawLake(g, feat, fill);
        break;
      case 'forest':
      case 'jungle':
      case 'desert':
      case 'swamp':
      case 'tundra':
      case 'wasteland':
      case 'plains':
      case 'oasis':
        drawBiome(g, feat, fill);
        break;
      case 'river':
        drawRiver(g, feat);
        break;
      case 'valley':
      case 'canyon':
      case 'chasm':
        drawValley(g, feat);
        break;
      case 'mountain_range':
        drawRange(g, feat);
        break;
      case 'peak':
      case 'volcano':
        drawPeak(g, feat);
        break;
      case 'arcane_anomaly':
        drawAnomaly(g, feat);
        break;
    }
  }
}

/** Continents and islands: parchment fill, inked coastline, echo rings. */
function drawLandmass(g: Graphics, feat: MapTerrainFeature, fill: FillWithMaterial): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const points = generateOrganicParchmentContours(feat.polygon, 3);
  const flatPoints = toFlatPoints(points);

  // Land fill — the paper material
  fill(g, flatPoints, 'land', VINTAGE_PARCHMENT.landFill, 1);

  // Hand-inked primary coastline
  g.poly(flatPoints).stroke({ width: 2.2, color: VINTAGE_PARCHMENT.coastlineInk });

  // Automated vintage coastline echo rings
  g.poly(flatPoints).stroke({ width: 5.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.45 });
  g.poly(flatPoints).stroke({ width: 11, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.15 });

  // Inland water is drawn only by its lake feature. A landmass no longer owns
  // a duplicate water hole, which is what made a carved lake appear twice: once
  // as a selectable lake and once as an unselectable gap in the land.
}

/** Flat hole rings used to cut islands out of every water fill layer. */
function flatWaterHoles(feat: MapTerrainFeature): number[][] {
  return (feat.holes ?? [])
    .filter((hole) => hole.length > 2)
    .map((hole) =>
      toFlatPoints(generateOrganicParchmentContours(hole, 2))
    );
}

/** Standing water: open-ocean sheets and large seas. */
function drawWaterBody(
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

  // 4. Shoreline wave echo rings
  g.poly(flatPoints).stroke({ width: 4.8, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.4 });
  g.poly(flatPoints).stroke({ width: 9.5, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.16 });
}

/**
 * Highlands and Plateaus / Mesas: elevated flat table surface, shaded cliff drop,
 * and rock strata hatching matching the Gerami Uplands style.
 */
export function drawHighland(
  g: Graphics,
  feat: MapTerrainFeature,
  fill: FillWithMaterial
): void {
  const points =
    feat.polygon && feat.polygon.length >= 3
      ? feat.polygon
      : feat.points && feat.points.length >= 2
      ? feat.points
      : null;

  if (!points) return;

  const isPolygon = Boolean(feat.polygon && feat.polygon.length >= 3);
  const seed = hashStringToSeed(feat.id || `highland_${points[0].x}_${points[0].y}`);
  const cliffHeight = feat.width ? Math.max(10, Math.min(90, feat.width)) : 36;
  const terraceTiers = feat.elevation && feat.elevation > 1500 ? 2 : 1;

  const highland = generateProceduralHighland(points, {
    seed,
    cliffHeight,
    terraceTiers,
    isPolygon,
  });

  renderProceduralHighlandToGraphics(g, highland, fill);
}

/**
 * Renders a ProceduralHighland geometry object onto a Pixi Graphics context.
 */
export function renderProceduralHighlandToGraphics(
  g: Graphics,
  highland: ProceduralHighland,
  fill: FillWithMaterial
): void {
  const strokePath = (
    points: MapPoint[],
    width: number,
    color: number,
    alpha = 1
  ) => {
    if (points.length < 2) return;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
  };

  /** Closed ribbon around a polyline, used for soft eroded fold shadows. */
  const ribbonPolygon = (points: MapPoint[], width: number): MapPoint[] => {
    if (points.length < 2) return [];
    const left: MapPoint[] = [];
    const right: MapPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      left.push({ x: points[i].x + nx * width * 0.5, y: points[i].y + ny * width * 0.5 });
      right.push({ x: points[i].x - nx * width * 0.5, y: points[i].y - ny * width * 0.5 });
    }
    return [...left, ...right.reverse()];
  };

  const hasCliffPeaks = (highland.cliffPeaks?.length ?? 0) > 0;

  // 1. Ground shadow / cliff base. Closed plateaus get a broad flat mass
  // under the peak ring; open escarpments keep their original drop band.
  if (highland.cliffDropPolygon.length >= 3) {
    g.poly(toFlatPoints(highland.cliffDropPolygon)).fill({
      color: VINTAGE_PARCHMENT.highlandCliff,
      alpha: hasCliffPeaks ? 0.06 : 0.38,
    });
  }

  // 2. Elevated table surface. `desert` is the tan material; the old `land`
  // material washed the plateau back to almost the same colour as the paper.
  if (highland.tablePolygon.length >= 3) {
    const tableFlat = toFlatPoints(highland.tablePolygon);
    fill(g, tableFlat, 'desert', VINTAGE_PARCHMENT.highlandTop, 1);
  }

  // 3. Eroded interior folds and drainage. A soft ribbon on the east side
  // plus a light west lip gives the fold volume.
  for (const ridge of highland.interiorRidges ?? []) {
    const shadowRibbon = ribbonPolygon(ridge, 10);
    if (shadowRibbon.length >= 3) {
      g.poly(toFlatPoints(shadowRibbon)).fill({
        color: VINTAGE_PARCHMENT.highlandCliff,
        alpha: 0.15,
      });
    }
    strokePath(
      ridge.map((point) => ({ x: point.x - 1.5, y: point.y - 1.5 })),
      3.0,
      VINTAGE_PARCHMENT.mountainHighlight,
      0.16
    );
    strokePath(ridge, 1.05, VINTAGE_PARCHMENT.highlandHatch, 0.5);
  }

  if (hasCliffPeaks) {
    // 4a. Layered eskers/peaks ring the table (Gerami Uplands style). They
    // are generated by the same mountain engine as standalone ranges, then
    // rendered in the highland palette rather than the generic mountain one.
    for (const peak of highland.cliffPeaks ?? []) {
      if (peak.sunlitPoly.length >= 3) {
        g.poly(toFlatPoints(peak.sunlitPoly)).fill({
          color: VINTAGE_PARCHMENT.highlandTop,
          alpha: 0.82,
        });
      }
      if (peak.shadowPoly.length >= 3) {
        g.poly(toFlatPoints(peak.shadowPoly)).fill({
          color: VINTAGE_PARCHMENT.highlandCliff,
          alpha: 0.86,
        });
      }
      if (peak.cragSpine.length >= 2) {
        strokePath(peak.cragSpine, 1.2, VINTAGE_PARCHMENT.mountainInk, 0.66);
      }
      for (const [start, end] of peak.shadowHatchLines) {
        strokePath([start, end], 0.9, VINTAGE_PARCHMENT.highlandHatch, 0.36);
      }
    }
  } else {
    // 4b. Open escarpment / legacy fallback: buttresses along the scarp.
    for (const buttress of highland.buttresses) {
      if (buttress.sunlitPoly.length >= 3) {
        g.poly(toFlatPoints(buttress.sunlitPoly)).fill({
          color: VINTAGE_PARCHMENT.highlandTop,
          alpha: 0.52,
        });
      }
      if (buttress.shadowPoly.length >= 3) {
        g.poly(toFlatPoints(buttress.shadowPoly)).fill({
          color: VINTAGE_PARCHMENT.highlandCliff,
          alpha: 0.68,
        });
      }
      strokePath(
        [buttress.rimApex, buttress.spinePt],
        1.25,
        VINTAGE_PARCHMENT.highlandHatch,
        0.55
      );
      strokePath(
        [buttress.leftBase, buttress.spinePt, buttress.rightBase],
        1.2,
        VINTAGE_PARCHMENT.mountainInk,
        0.8
      );
      for (const [start, end] of buttress.chiselLines) {
        strokePath([start, end], 1.1, VINTAGE_PARCHMENT.highlandHatch, 0.72);
      }
    }

    for (const [start, end] of highland.rimSpurs ?? []) {
      strokePath([start, end], 1.25, VINTAGE_PARCHMENT.highlandHatch, 0.42);
    }
  }

  // 5. Thick hand-inked rim lip. Two passes: a heavy silhouette and a fine
  // inner contour so the edge reads as rock, not a marker line.
  if (highland.rimPath.length >= 2) {
    strokePath(highland.rimPath, 3.4, VINTAGE_PARCHMENT.mountainInk, 1);
    strokePath(highland.rimPath, 1.15, VINTAGE_PARCHMENT.highlandHatch, 0.8);
  }

  // 6. Grounding talus line along the foot of the escarpment.
  if (highland.talusLine.length >= 2) {
    strokePath(highland.talusLine, 1.0, VINTAGE_PARCHMENT.mountainInk, 0.36);
  }

  // 7. Secondary terrace contours.
  for (const contour of highland.terraceContours ?? []) {
    strokePath(contour, 1.15, VINTAGE_PARCHMENT.highlandCliff, 0.24);
  }
}

/** Biomes: translucent washes laid over the land plus procedural hand-inked flora/symbols. */
export function drawBiome(g: Graphics, feat: MapTerrainFeature, fill: FillWithMaterial): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const flatPoints = toFlatPoints(feat.polygon);

  let color: number = VINTAGE_PARCHMENT.biomeForest;
  let material: MapMaterialKey = 'forest';
  if (feat.type === 'jungle') {
    color = VINTAGE_PARCHMENT.biomeJungle;
    material = 'forest';
  } else if (feat.type === 'desert') {
    color = VINTAGE_PARCHMENT.biomeDesert;
    material = 'desert';
  } else if (feat.type === 'swamp') {
    color = VINTAGE_PARCHMENT.biomeSwamp;
    material = 'swamp';
  } else if (feat.type === 'tundra') {
    color = VINTAGE_PARCHMENT.biomeTundra;
    material = 'tundra';
  } else if (feat.type === 'oasis') {
    color = 0x6f8f5a;
    material = 'plains';
  } else if (feat.type === 'wasteland') {
    color = 0x8a7a63;
    material = 'desert';
  } else if (feat.type === 'plains') {
    color = 0xc9b87a;
    material = 'plains';
  }

  // 1. Soft watercolor wash tint
  fill(g, flatPoints, material, color, 0.35);
  g.poly(flatPoints).stroke({ width: 1, color, alpha: 0.6 });

  // 2. Procedural Hand-inked Symbols (Trees, Sand Dunes, Marsh Reeds)
  const seed = hashStringToSeed(feat.id || `biome_${feat.polygon[0].x}_${feat.polygon[0].y}`);
  const symbols = generateBiomeSymbols(feat.polygon, feat.type, {
    seed,
    density: 'medium',
  });

  renderBiomeSymbolsToGraphics(g, symbols, feat.type);
}

/**
 * Renders procedural biome symbols (hand-inked trees, dune ridges, marsh reeds).
 */
export function renderBiomeSymbolsToGraphics(
  g: Graphics,
  symbols: BiomeFeatureSymbols,
  biomeType: string
): void {
  // 1. Sand Dunes (Desert / Wasteland)
  for (const dune of symbols.sandDunes) {
    if (dune.shadowPoly.length >= 3) {
      g.poly(toFlatPoints(dune.shadowPoly)).fill({
        color: VINTAGE_PARCHMENT.duneShade,
        alpha: 0.55,
      });
    }
    if (dune.crestPath.length >= 2) {
      g.moveTo(dune.crestPath[0].x, dune.crestPath[0].y);
      for (let i = 1; i < dune.crestPath.length; i++) {
        g.lineTo(dune.crestPath[i].x, dune.crestPath[i].y);
      }
      g.stroke({
        width: 1.2,
        color: VINTAGE_PARCHMENT.primaryInk,
        cap: 'round',
        join: 'round',
        alpha: 0.85,
      });
    }
  }

  // 2. Marsh Reeds (Swamp)
  for (const tuft of symbols.marshReeds) {
    for (const [start, end] of tuft.blades) {
      g.moveTo(start.x, start.y).lineTo(end.x, end.y);
    }
  }
  if (symbols.marshReeds.length > 0) {
    g.stroke({
      width: 1.2,
      color: VINTAGE_PARCHMENT.marshReed,
      cap: 'round',
      alpha: 0.85,
    });
  }

  // 3. Trees (Forest / Jungle / Oasis / Tundra)
  // Trees are already strictly Y-sorted in generateBiomeSymbols!
  for (const tree of symbols.trees) {
    // Small Trunk
    g.moveTo(tree.trunk[0].x, tree.trunk[0].y)
      .lineTo(tree.trunk[1].x, tree.trunk[1].y)
      .stroke({
        width: 1.5,
        color: VINTAGE_PARCHMENT.treeTrunk,
        cap: 'round',
      });

    // Sunlit Crown (West lobe)
    if (tree.crownPoly.length >= 3) {
      g.poly(toFlatPoints(tree.crownPoly)).fill({
        color:
          biomeType === 'jungle'
            ? VINTAGE_PARCHMENT.biomeJungle
            : biomeType === 'tundra'
            ? 0x5a6e5e
            : VINTAGE_PARCHMENT.treeCrownHighlight,
      });
    }

    // Shaded East lobe
    if (tree.shadowPoly.length >= 3) {
      g.poly(toFlatPoints(tree.shadowPoly)).fill({
        color: VINTAGE_PARCHMENT.treeCrownShadow,
        alpha: 0.75,
      });
    }

    // Outer inked contour
    if (tree.crownPoly.length >= 3) {
      g.poly(toFlatPoints(tree.crownPoly)).stroke({
        width: 1.0,
        color: VINTAGE_PARCHMENT.mountainInk,
        alpha: 0.85,
      });
    }

    // Shadow hatch lines on eastern lobe
    for (const [start, end] of tree.hatchLines) {
      g.moveTo(start.x, start.y).lineTo(end.x, end.y);
    }
    if (tree.hatchLines.length > 0) {
      g.stroke({
        width: 0.85,
        color: VINTAGE_PARCHMENT.mountainInk,
        alpha: 0.65,
        cap: 'round',
      });
    }
  }
}

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
  });

  renderProceduralRiverToGraphics(g, river);
}

/**
 * Renders a ProceduralRiver geometry object onto a Pixi Graphics context.
 */
export function renderProceduralRiverToGraphics(g: Graphics, river: ProceduralRiver): void {
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
 * Valleys, canyons and chasms: sunken rift gorge with dual fault rims,
 * dark floor crevasse, and inward rock strata hatching.
 */
export function drawValley(g: Graphics, feat: MapTerrainFeature): void {
  if (!feat.points || feat.points.length < 2) return;

  const seed = hashStringToSeed(feat.id || `valley_${feat.points[0].x}_${feat.points[0].y}`);
  const valley = generateProceduralValley(feat.points, {
    seed,
    width: feat.width || 28,
  });

  renderProceduralValleyToGraphics(g, valley);
}

/**
 * Renders a ProceduralValley geometry object onto a Pixi Graphics context.
 */
export function renderProceduralValleyToGraphics(g: Graphics, valley: ProceduralValley): void {
  // 1. Sunken Gorge Shadow Floor
  if (valley.gorgePolygon.length >= 3) {
    g.poly(toFlatPoints(valley.gorgePolygon)).fill({
      color: VINTAGE_PARCHMENT.canyonFloor,
      alpha: 0.6,
    });
  }

  // 2. Inward Cliff Strata Hatching
  for (const [start, end] of valley.strataHatches) {
    g.moveTo(start.x, start.y).lineTo(end.x, end.y);
  }
  if (valley.strataHatches.length > 0) {
    g.stroke({
      width: 1.1,
      color: VINTAGE_PARCHMENT.canyonLip,
      alpha: 0.7,
      cap: 'round',
    });
  }

  // 3. Bottom Central Crevasse Cleft Line
  if (valley.centerCrevasse.length >= 2) {
    g.moveTo(valley.centerCrevasse[0].x, valley.centerCrevasse[0].y);
    for (let i = 1; i < valley.centerCrevasse.length; i++) {
      g.lineTo(valley.centerCrevasse[i].x, valley.centerCrevasse[i].y);
    }
    g.stroke({
      width: 1.6,
      color: VINTAGE_PARCHMENT.mountainCrag,
      alpha: 0.85,
      cap: 'round',
      join: 'round',
    });
  }

  // 4. North/West Left Fault Rim Lip
  if (valley.leftRim.length >= 2) {
    g.moveTo(valley.leftRim[0].x, valley.leftRim[0].y);
    for (let i = 1; i < valley.leftRim.length; i++) {
      g.lineTo(valley.leftRim[i].x, valley.leftRim[i].y);
    }
    g.stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.primaryInk,
      cap: 'round',
      join: 'round',
    });
  }

  // 5. South/East Right Fault Rim Lip
  if (valley.rightRim.length >= 2) {
    g.moveTo(valley.rightRim[0].x, valley.rightRim[0].y);
    for (let i = 1; i < valley.rightRim.length; i++) {
      g.lineTo(valley.rightRim[i].x, valley.rightRim[i].y);
    }
    g.stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.primaryInk,
      cap: 'round',
      join: 'round',
    });
  }
}

/**
 * Mountain ranges: chains of procedural 2.5D isometric peaks with dual-facet shading,
 * snowcaps, and back-to-front depth sorting.
 */
export function drawRange(g: Graphics, feat: MapTerrainFeature): void {
  if (!feat.points || feat.points.length === 0) return;

  const seed = hashStringToSeed(feat.id || `mountain_${feat.points[0].x}_${feat.points[0].y}`);
  // If feat.scale is provided, respect it directly!
  // Otherwise fall back to feat.width / elevation
  const baseScale =
    feat.scale ??
    (feat.width ? Math.round(feat.width / 0.58) : undefined) ??
    (feat.elevation ? Math.max(35, Math.min(85, feat.elevation / 45)) : 55);

  const rangeWidth = feat.width ?? Math.round(baseScale * 0.58);
  const hasSnowcaps = feat.hasSnowcaps ?? (feat.elevation ? feat.elevation >= 2400 : true);

  const peaks = generateProceduralMountainRange(feat.points, {
    seed,
    scale: baseScale,
    rangeWidth,
    hasSnowcaps,
  });

  for (const peak of peaks) {
    renderProceduralPeakToGraphics(g, peak);
  }
}

/**
 * Peaks and volcanoes: standalone 2.5D woodcut peaks with illuminated facet shading.
 */
export function drawPeak(g: Graphics, feat: MapTerrainFeature): void {
  if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
  const radius = feat.radius || 30;
  const seed = hashStringToSeed(feat.id || `peak_${feat.x}_${feat.y}`);
  const isVolcano = feat.type === 'volcano';

  const peak = generateStandalonePeak(
    { x: feat.x, y: feat.y },
    radius,
    isVolcano ? 'volcano' : 'peak',
    seed
  );

  renderProceduralPeakToGraphics(g, peak);
}

/**
 * Renders an individual 2.5D isometric peak onto a Pixi Graphics context.
 */
export function renderProceduralPeakToGraphics(g: Graphics, peak: ProceduralPeak): void {
  // 1. Sunlit West Face
  if (peak.sunlitPoly.length >= 3) {
    g.poly(toFlatPoints(peak.sunlitPoly)).fill({
      color: peak.isVolcano ? 0x7a2222 : VINTAGE_PARCHMENT.landFill,
    });
  }

  // 2. Deep Shadow East Face
  if (peak.shadowPoly.length >= 3) {
    g.poly(toFlatPoints(peak.shadowPoly)).fill({
      color: peak.isVolcano ? 0x4a1212 : VINTAGE_PARCHMENT.mountainShade,
      alpha: 0.88,
    });
  }

  // 3. Hand-inked Shadow Hatching Lines on East Face
  for (const [start, end] of peak.shadowHatchLines) {
    g.moveTo(start.x, start.y).lineTo(end.x, end.y);
  }
  if (peak.shadowHatchLines.length > 0) {
    g.stroke({
      width: 1.15,
      color: VINTAGE_PARCHMENT.mountainInk,
      alpha: 0.68,
      cap: 'round',
    });
  }

  // 4. Snowcap Summits
  if (peak.snowcapSunlitPoly && peak.snowcapSunlitPoly.length >= 3) {
    g.poly(toFlatPoints(peak.snowcapSunlitPoly)).fill({
      color: 0xffffff, // Pure crisp snowcap
    });
  }
  if (peak.snowcapShadowPoly && peak.snowcapShadowPoly.length >= 3) {
    g.poly(toFlatPoints(peak.snowcapShadowPoly)).fill({
      color: 0xdde6ed, // Cool shaded mountain snow
    });
  }

  // 4b. Hand-inked Jagged Lower Snowline
  if (peak.snowlinePath && peak.snowlinePath.length >= 2) {
    g.moveTo(peak.snowlinePath[0].x, peak.snowlinePath[0].y);
    for (let i = 1; i < peak.snowlinePath.length; i++) {
      g.lineTo(peak.snowlinePath[i].x, peak.snowlinePath[i].y);
    }
    g.stroke({
      width: 1.25,
      color: VINTAGE_PARCHMENT.mountainInk,
      cap: 'round',
      join: 'round',
      alpha: 0.9,
    });
  }

  // 5. Central Crag Dividing Ridge Line
  if (peak.cragSpine.length >= 2) {
    g.moveTo(peak.cragSpine[0].x, peak.cragSpine[0].y);
    for (let i = 1; i < peak.cragSpine.length; i++) {
      g.lineTo(peak.cragSpine[i].x, peak.cragSpine[i].y);
    }
    g.stroke({
      width: 1.8,
      color: VINTAGE_PARCHMENT.mountainCrag,
      cap: 'round',
      join: 'round',
    });
  }

  // 6. Outer Silhouette Stroke
  g.moveTo(peak.leftFoot.x, peak.leftFoot.y)
    .lineTo(peak.apex.x, peak.apex.y)
    .lineTo(peak.rightFoot.x, peak.rightFoot.y)
    .stroke({
      width: 2.0,
      color: VINTAGE_PARCHMENT.mountainInk,
      cap: 'round',
      join: 'round',
    });

  // 7. Grounding Ink Hash Marks at Foot
  for (const [start, end] of peak.groundHatchLines) {
    g.moveTo(start.x, start.y).lineTo(end.x, end.y);
  }
  if (peak.groundHatchLines.length > 0) {
    g.stroke({
      width: 1.0,
      color: VINTAGE_PARCHMENT.mountainInk,
      alpha: 0.5,
      cap: 'round',
    });
  }
}

/** Arcane anomalies: a faint violet ring. */
function drawAnomaly(g: Graphics, feat: MapTerrainFeature): void {
  if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
  const r = feat.radius || 26;
  g.circle(feat.x, feat.y, r).fill({ color: 0x693d7a, alpha: 0.18 });
  g.circle(feat.x, feat.y, r).stroke({ width: 1.6, color: 0x693d7a, alpha: 0.8 });
}

function toFlatPoints(pts: MapPoint[]): number[] {
  const flat: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    flat.push(pts[i].x, pts[i].y);
  }
  return flat;
}
