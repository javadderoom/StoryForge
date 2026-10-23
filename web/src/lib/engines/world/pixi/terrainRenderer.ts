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
      case 'ocean':
      case 'sea':
        drawWaterBody(g, feat, 'ocean', fill);
        break;
      case 'lake':
        drawWaterBody(g, feat, 'water', fill);
        break;
      case 'forest':
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

  // Interior carved water holes (lakes, inland seas, straits)
  for (const hole of feat.holes ?? []) {
    if (hole.length <= 2) continue;
    const holePoints = generateOrganicParchmentContours(hole, 2);
    const holeFlat = toFlatPoints(holePoints);

    fill(g, holeFlat, 'water', VINTAGE_PARCHMENT.oceanWash, 1);
    g.poly(holeFlat).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
    g.poly(holeFlat).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
  }
}

/** Standing water: lakes, inland seas and open-ocean sheets. */
function drawWaterBody(
  g: Graphics,
  feat: MapTerrainFeature,
  material: 'ocean' | 'water',
  fill: FillWithMaterial
): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const points = generateOrganicParchmentContours(feat.polygon, 2);
  const flatPoints = toFlatPoints(points);

  fill(g, flatPoints, material, VINTAGE_PARCHMENT.oceanWash, 1);
  g.poly(flatPoints).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
  g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
}

/** Biomes: translucent washes laid over the land. */
function drawBiome(g: Graphics, feat: MapTerrainFeature, fill: FillWithMaterial): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const flatPoints = toFlatPoints(feat.polygon);

  let color: number = VINTAGE_PARCHMENT.biomeForest;
  let material: MapMaterialKey = 'forest';
  if (feat.type === 'desert') {
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

  fill(g, flatPoints, material, color, 0.35);
  g.poly(flatPoints).stroke({ width: 1, color, alpha: 0.6 });
}

/**
 * Rivers: organically meandered, tapered variable-width blue ribbons with crisp dark ink banks.
 */
export function drawRiver(g: Graphics, feat: MapTerrainFeature): void {
  if (!feat.points || feat.points.length < 2) return;

  const seed = hashStringToSeed(feat.id || `river_${feat.points[0].x}_${feat.points[0].y}`);
  const river = generateProceduralRiver(feat.points, {
    seed,
    startWidth: 2.0,
    endWidth: feat.width || 10.0,
    meanderRoughness: 0.35,
    enableDelta: (feat.points.length >= 3),
  });

  renderProceduralRiverToGraphics(g, river);
}

/**
 * Renders a ProceduralRiver geometry object onto a Pixi Graphics context.
 */
export function renderProceduralRiverToGraphics(g: Graphics, river: ProceduralRiver): void {
  // 1. Water Ribbon Body
  if (river.waterPolygon.length >= 3) {
    g.poly(toFlatPoints(river.waterPolygon)).fill({
      color: VINTAGE_PARCHMENT.riverWash,
      alpha: 0.75,
    });
  }

  // 2. Left Bank Outline
  if (river.leftBank.length >= 2) {
    g.moveTo(river.leftBank[0].x, river.leftBank[0].y);
    for (let i = 1; i < river.leftBank.length; i++) {
      g.lineTo(river.leftBank[i].x, river.leftBank[i].y);
    }
    g.stroke({
      width: 1.6,
      color: VINTAGE_PARCHMENT.riverBankInk,
      cap: 'round',
      join: 'round',
    });
  }

  // 3. Right Bank Outline
  if (river.rightBank.length >= 2) {
    g.moveTo(river.rightBank[0].x, river.rightBank[0].y);
    for (let i = 1; i < river.rightBank.length; i++) {
      g.lineTo(river.rightBank[i].x, river.rightBank[i].y);
    }
    g.stroke({
      width: 1.6,
      color: VINTAGE_PARCHMENT.riverBankInk,
      cap: 'round',
      join: 'round',
    });
  }

  // 4. Delta Estuary Distributary Channels
  for (const branch of river.deltaBranches ?? []) {
    if (branch.waterPolygon.length >= 3) {
      g.poly(toFlatPoints(branch.waterPolygon)).fill({
        color: VINTAGE_PARCHMENT.riverWash,
        alpha: 0.7,
      });
    }

    if (branch.leftBank.length >= 2) {
      g.moveTo(branch.leftBank[0].x, branch.leftBank[0].y);
      for (let i = 1; i < branch.leftBank.length; i++) {
        g.lineTo(branch.leftBank[i].x, branch.leftBank[i].y);
      }
      g.stroke({ width: 1.3, color: VINTAGE_PARCHMENT.riverBankInk, cap: 'round', join: 'round' });
    }

    if (branch.rightBank.length >= 2) {
      g.moveTo(branch.rightBank[0].x, branch.rightBank[0].y);
      for (let i = 1; i < branch.rightBank.length; i++) {
        g.lineTo(branch.rightBank[i].x, branch.rightBank[i].y);
      }
      g.stroke({ width: 1.3, color: VINTAGE_PARCHMENT.riverBankInk, cap: 'round', join: 'round' });
    }
  }

  // 5. Delta Sandbar Islands
  for (const island of river.sandbarIslands ?? []) {
    const flatIsland = toFlatPoints(island);
    g.poly(flatIsland).fill({ color: VINTAGE_PARCHMENT.sandbarFill, alpha: 0.95 });
    g.poly(flatIsland).stroke({ width: 1.2, color: VINTAGE_PARCHMENT.coastlineInk, alpha: 0.75 });
  }
}

/**
 * Valleys, canyons and chasms: a dark cleft with a hand-inked lip.
 */
function drawValley(g: Graphics, feat: MapTerrainFeature): void {
  if (!feat.points || feat.points.length < 2) return;
  const pts = feat.points;
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y);
  }
  g.stroke({
    width: feat.width || 28,
    color: VINTAGE_PARCHMENT.valleyInk,
    alpha: 0.28,
    cap: 'round',
    join: 'round',
  });
  g.stroke({
    width: 2,
    color: VINTAGE_PARCHMENT.valleyInk,
    alpha: 0.85,
    cap: 'round',
    join: 'round',
  });
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
