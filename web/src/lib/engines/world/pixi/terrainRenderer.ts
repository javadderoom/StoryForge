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
  const cliffHeight = feat.width ? Math.max(10, Math.min(60, feat.width)) : 22;
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
  // 1. Shaded Cliff Drop Face (behind / underneath the rim)
  if (highland.cliffDropPolygon.length >= 3) {
    g.poly(toFlatPoints(highland.cliffDropPolygon)).fill({
      color: VINTAGE_PARCHMENT.highlandCliff,
      alpha: 0.72,
    });
  }

  // 2. Rock Strata Hatching Lines along cliff drop face
  for (const [start, end] of highland.strataHatches) {
    g.moveTo(start.x, start.y).lineTo(end.x, end.y);
  }
  if (highland.strataHatches.length > 0) {
    g.stroke({
      width: 1.15,
      color: VINTAGE_PARCHMENT.highlandHatch,
      alpha: 0.78,
      cap: 'round',
    });
  }

  // 3. Elevated Flat Table Surface Polygon
  if (highland.tablePolygon.length >= 3) {
    const tableFlat = toFlatPoints(highland.tablePolygon);
    fill(g, tableFlat, 'land', VINTAGE_PARCHMENT.highlandTop, 1);
  }

  // 4. Hand-inked Upper Cliff Rim Lip
  if (highland.rimPath.length >= 2) {
    g.moveTo(highland.rimPath[0].x, highland.rimPath[0].y);
    for (let i = 1; i < highland.rimPath.length; i++) {
      g.lineTo(highland.rimPath[i].x, highland.rimPath[i].y);
    }
    g.stroke({
      width: 2.0,
      color: VINTAGE_PARCHMENT.mountainInk,
      cap: 'round',
      join: 'round',
    });
  }

  // 5. Secondary Terrace Step Contours (if multi-tiered)
  if (highland.terraceContours) {
    for (const contour of highland.terraceContours) {
      if (contour.length >= 2) {
        g.moveTo(contour[0].x, contour[0].y);
        for (let i = 1; i < contour.length; i++) {
          g.lineTo(contour[i].x, contour[i].y);
        }
        g.stroke({
          width: 1.2,
          color: VINTAGE_PARCHMENT.coastlineHatch,
          alpha: 0.55,
          cap: 'round',
          join: 'round',
        });
      }
    }
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
  const baseScale = feat.elevation ? Math.max(35, Math.min(85, feat.elevation / 45)) : (feat.width ? feat.width * 1.8 : 55);

  const peaks = generateProceduralMountainRange(feat.points, {
    seed,
    scale: baseScale,
    rangeWidth: feat.width || 32,
    hasSnowcaps: (feat.elevation ?? 3200) >= 2400,
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
      color: VINTAGE_PARCHMENT.mountainSnowcap,
    });
  }
  if (peak.snowcapShadowPoly && peak.snowcapShadowPoly.length >= 3) {
    g.poly(toFlatPoints(peak.snowcapShadowPoly)).fill({
      color: 0xede6d8, // Shaded snow tone
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
