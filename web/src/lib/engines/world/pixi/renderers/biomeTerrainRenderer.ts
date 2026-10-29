import type { Graphics } from 'pixi.js';
import type {
  MapEntityPlacement,
  MapTerrainFeature,
  WorldLocation,
} from '@/lib/types';
import { VINTAGE_PARCHMENT } from '../vintageTheme';
import type { MapMaterialKey } from '../../texturePalette';
import type { FillWithMaterial } from '../renderTypes';
import { hashStringToSeed } from '../mountainGenerator';
import {
  generateBiomeSymbols,
  generateBiomeStrokeSymbols,
  type BiomeFeatureSymbols,
} from '../biomeSymbolGenerator';
import {
  generateProceduralSaltPan,
  type ProceduralSaltPan,
} from '../saltPanGenerator';
import {
  generateProceduralDuneField,
  type ProceduralDuneField,
} from '../duneFieldGenerator';
import {
  generateProceduralCanopyMass,
  type ProceduralCanopyMass,
} from '../canopyMassGenerator';
import { toFlatPoints } from './shared';

export interface BiomeRenderContext {
  locations?: WorldLocation[];
  placements?: MapEntityPlacement[];
}

/** Biomes: translucent washes laid over the land plus procedural hand-inked flora/symbols. */
export function drawBiome(
  g: Graphics,
  feat: MapTerrainFeature,
  fill: FillWithMaterial,
  context?: BiomeRenderContext
): void {
  // 1. Linear / Stroke or Single-Point Feature (e.g. tree belts, coastal palm lines, copses)
  if (feat.points && feat.points.length > 0) {
    if (feat.symbolFamily || (feat.scatterInstances && feat.scatterInstances.length > 0)) {
      return; // High-res flora sprites rendered via GPU symbolLayer
    }
    const seed = hashStringToSeed(feat.id || `biome_stroke_${feat.points[0].x}_${feat.points[0].y}`);
    const symbols = generateBiomeStrokeSymbols(feat.points, feat.type, {
      seed,
      width: feat.width ?? 30,
      density: 'medium',
    });
    renderBiomeSymbolsToGraphics(g, symbols, feat.type);
    return;
  }

  // 2. Areal Polygon Feature (Enclosed broad regional biomes)
  if (!feat.polygon || feat.polygon.length <= 2) return;

  // Check if this biome is an authored salt depression (e.g. Sepidchal / سپیدچال)
  const name = (feat.name || '').toLowerCase();
  const desc = (feat.description || '').toLowerCase();
  if (
    feat.type === 'salt_pan' ||
    name.includes('سپید') ||
    name.includes('نمک') ||
    name.includes('salt') ||
    desc.includes('نمک') ||
    desc.includes('salt pan') ||
    desc.includes('playa')
  ) {
    drawSaltPan(g, feat, fill);
    return;
  }

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

  // If this biome feature has dedicated flora species / symbol scattering,
  // suppress procedural canopy blobs and legacy wireframe symbols so they never collide!
  if (feat.symbolFamily || (feat.scatterInstances && feat.scatterInstances.length > 0)) {
    return;
  }

  // 2. Continuous Forest Canopy Massing (Plan 27 — Module 3.C: Jangal-e Shabnam)
  if (
    (feat.type === 'forest' || feat.type === 'jungle') &&
    feat.canopyConfig?.enabled !== false
  ) {
    const seed = hashStringToSeed(feat.id || `forest_${feat.polygon[0].x}_${feat.polygon[0].y}`);
    const canopyMass = generateProceduralCanopyMass(feat.polygon, {
      seed,
      treeKind: feat.type === 'jungle' ? 'jungle' : 'deciduous',
      ...feat.canopyConfig,
    });
    if (canopyMass) {
      renderProceduralCanopyMassToGraphics(g, canopyMass, fill);
      return;
    }
  }

  // 3. Sinuous Barchan Sand Dunes for Deserts & Wastelands (Plan 27 — Module 3.B: Hiram Steppe)
  if (feat.type === 'desert' || feat.type === 'wasteland') {
    const seed = hashStringToSeed(feat.id || `desert_${feat.polygon[0].x}_${feat.polygon[0].y}`);
    const exclusionZones: Array<{ x: number; y: number; radius?: number }> = [];
    if (context?.locations) {
      for (const loc of context.locations) {
        if (loc.coordinates && loc.coordinates.x > 0) {
          exclusionZones.push({ x: loc.coordinates.x, y: loc.coordinates.y, radius: 46 });
        }
      }
    }
    if (context?.placements) {
      for (const pl of context.placements) {
        exclusionZones.push({ x: pl.x, y: pl.y, radius: 38 });
      }
    }

    const duneField = generateProceduralDuneField(feat.polygon, {
      seed,
      ...feat.duneConfig,
      exclusionZones,
    });
    if (duneField) {
      renderProceduralDuneFieldToGraphics(g, duneField);
      return;
    }
  }

  // 4. Procedural Hand-inked Symbols (Trees, Marsh Reeds)
  if (feat.symbolFamily || (feat.scatterInstances && feat.scatterInstances.length > 0)) {
    return; // High-res flora & relief symbols rendered via GPU symbolLayer
  }

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
 * Salt Pan Playa (Plan 27 — Module 3.A):
 * Sun-bleached crystalline white evaporite flats with Voronoi cracked salt plate crusts,
 * concentric shrinkage rings, and dark halite seams (e.g. Sepidchal / سپیدچال).
 */
export function drawSaltPan(
  g: Graphics,
  feat: MapTerrainFeature,
  fill: FillWithMaterial
): void {
  if (!feat.polygon || feat.polygon.length <= 2) return;
  const flatPoints = toFlatPoints(feat.polygon);

  // 1. Soft crystalline white evaporite base wash
  const saltWashColor = 0xfaf7eb;
  fill(g, flatPoints, 'desert', saltWashColor, 0.75);

  // Outer inked boundary
  g.poly(flatPoints).stroke({
    width: 1.2,
    color: VINTAGE_PARCHMENT.coastlineInk,
    alpha: 0.85,
  });

  // 2. Procedural Voronoi Cracked Salt Crust
  const seed = hashStringToSeed(feat.id || `salt_pan_${feat.polygon[0].x}_${feat.polygon[0].y}`);
  const saltPan = generateProceduralSaltPan(feat.polygon, {
    seed,
    cellSize: 24,
    concentricRings: true,
  });

  if (!saltPan) return;

  renderProceduralSaltPanToGraphics(g, saltPan);
}

/**
 * Renders a ProceduralSaltPan geometry object onto Pixi Graphics.
 */
export function renderProceduralSaltPanToGraphics(
  g: Graphics,
  saltPan: ProceduralSaltPan
): void {
  // 1. Individual salt plates with crystalline highlights
  for (const cell of saltPan.cells) {
    if (cell.polygon.length >= 3) {
      g.poly(toFlatPoints(cell.polygon)).fill({
        color: 0xfffef7, // Crystalline white salt plate
        alpha: 0.9,
      });
    }

    // 2. Concentric evaporation shrinkage rings inside plates
    for (const ring of cell.shrinkageRings) {
      if (ring.length >= 3) {
        g.poly(toFlatPoints(ring)).stroke({
          width: 0.75,
          color: 0x7c644f, // Brine contour
          alpha: 0.35,
        });
      }
    }

    // 3. Salt crystal stipples
    for (const crystal of cell.saltCrystals) {
      g.circle(crystal.x, crystal.y, 0.85).fill({
        color: 0x543f2d,
        alpha: 0.65,
      });
    }
  }

  // 4. Inked Halite Seam / Crack Lines
  for (const [pA, pB] of saltPan.crackLines) {
    g.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y);
  }
  if (saltPan.crackLines.length > 0) {
    g.stroke({
      width: 1.05,
      color: 0x4a3726, // Dark dried silt / brine ink
      alpha: 0.85,
      cap: 'round',
    });
  }
}

/**
 * Renders a ProceduralDuneField geometry object onto Pixi Graphics.
 * Features illuminated crescent slip-face pockets, leeward cross-hatching,
 * windward ripple striae, and crisp hand-inked barchan crest ridges.
 */
export function renderProceduralDuneFieldToGraphics(
  g: Graphics,
  field: ProceduralDuneField
): void {
  for (const dune of field.dunes) {
    // 1. Leeward Slip Face Shadow Pocket
    if (dune.slipFacePoly.length >= 3) {
      g.poly(toFlatPoints(dune.slipFacePoly)).fill({
        color: dune.isMegadune ? 0xa87c42 : VINTAGE_PARCHMENT.duneShade,
        alpha: dune.isMegadune ? 0.32 : 0.22,
      });
    }

    // 2. Slip Face Hatch Lines (Cross-hatching down the steep leeward slope)
    for (const [start, end] of dune.slipFaceHatches) {
      g.moveTo(start.x, start.y).lineTo(end.x, end.y);
    }
    if (dune.slipFaceHatches.length > 0) {
      g.stroke({
        width: 0.65,
        color: VINTAGE_PARCHMENT.secondaryInk,
        alpha: 0.24,
        cap: 'round',
      });
    }

    // 3. Parallel Windward Ripple Striae (Stoss slope micro-waves)
    for (const ripple of dune.windwardRipples) {
      if (ripple.length >= 2) {
        g.moveTo(ripple[0].x, ripple[0].y);
        for (let i = 1; i < ripple.length; i++) {
          g.lineTo(ripple[i].x, ripple[i].y);
        }
        g.stroke({
          width: 0.6,
          color: VINTAGE_PARCHMENT.secondaryInk,
          alpha: 0.20,
          cap: 'round',
          join: 'round',
        });
      }
    }

    // 4. Inked Barchan Crest Ridge
    if (dune.crestSpline.length >= 2) {
      g.moveTo(dune.crestSpline[0].x, dune.crestSpline[0].y);
      for (let i = 1; i < dune.crestSpline.length; i++) {
        g.lineTo(dune.crestSpline[i].x, dune.crestSpline[i].y);
      }
      g.stroke({
        width: dune.isMegadune ? 1.25 : 1.0,
        color: 0x6e4e30,
        cap: 'round',
        join: 'round',
        alpha: dune.isMegadune ? 0.68 : 0.52,
      });
    }
  }
}

/**
 * Renders a ProceduralCanopyMass geometry object onto Pixi Graphics.
 * Renders the scalloped woodland perimeter, sunlit NW crown lobes, shaded SE flanks,
 * interior billowing canopy crests, and peripheral sentinel trees with trunks.
 */
export function renderProceduralCanopyMassToGraphics(
  g: Graphics,
  canopy: ProceduralCanopyMass,
  fill: FillWithMaterial
): void {
  const isJungle = canopy.treeKind === 'jungle';
  const baseWashColor = isJungle ? VINTAGE_PARCHMENT.biomeJungle : VINTAGE_PARCHMENT.biomeForest;
  const highlightColor = isJungle ? 0x5a8a48 : VINTAGE_PARCHMENT.treeCrownHighlight;
  const shadowColor = isJungle ? 0x223d1d : VINTAGE_PARCHMENT.treeCrownShadow;

  // 1. Scalloped Outer Boundary Contour
  if (canopy.scallopedBoundary.length >= 3) {
    const flatContour = toFlatPoints(canopy.scallopedBoundary);
    fill(g, flatContour, 'forest', baseWashColor, 0.45);
    g.poly(flatContour).stroke({
      width: 1.4,
      color: VINTAGE_PARCHMENT.primaryInk,
      alpha: 0.85,
      cap: 'round',
      join: 'round',
    });
  }

  // 2. Interior Elevated Canopy Groves (sorted Y back-to-front)
  for (const grove of canopy.groves) {
    // Grove Base Wash
    if (grove.perimeterPoly.length >= 3) {
      g.poly(toFlatPoints(grove.perimeterPoly)).fill({
        color: baseWashColor,
        alpha: 0.65,
      });
    }

    // Sunlit NW Crown Rim
    if (grove.sunlitPoly.length >= 3) {
      g.poly(toFlatPoints(grove.sunlitPoly)).fill({
        color: highlightColor,
        alpha: 0.85,
      });
    }

    // Shaded SE Flank
    if (grove.shadowPoly.length >= 3) {
      g.poly(toFlatPoints(grove.shadowPoly)).fill({
        color: shadowColor,
        alpha: 0.72,
      });
    }

    // Grove Perimeter Inked Ridge
    if (grove.perimeterPoly.length >= 3) {
      g.poly(toFlatPoints(grove.perimeterPoly)).stroke({
        width: 1.15,
        color: VINTAGE_PARCHMENT.mountainInk,
        alpha: 0.82,
        cap: 'round',
        join: 'round',
      });
    }

    // Interior Billowing Scallop Arcs
    for (const arc of grove.interiorScallops) {
      if (arc.length >= 2) {
        g.moveTo(arc[0].x, arc[0].y);
        for (let i = 1; i < arc.length; i++) {
          g.lineTo(arc[i].x, arc[i].y);
        }
        g.stroke({
          width: 0.85,
          color: VINTAGE_PARCHMENT.mountainInk,
          alpha: 0.6,
          cap: 'round',
          join: 'round',
        });
      }
    }

    // SE Shadow Hatching
    for (const [start, end] of grove.shadowHatches) {
      g.moveTo(start.x, start.y).lineTo(end.x, end.y);
    }
    if (grove.shadowHatches.length > 0) {
      g.stroke({
        width: 0.85,
        color: VINTAGE_PARCHMENT.mountainInk,
        alpha: 0.62,
        cap: 'round',
      });
    }
  }

  // 3. Peripheral Sentinel Trees
  for (const tree of canopy.sentinelTrees) {
    // Small Trunk
    g.moveTo(tree.trunk[0].x, tree.trunk[0].y)
      .lineTo(tree.trunk[1].x, tree.trunk[1].y)
      .stroke({
        width: 1.5,
        color: VINTAGE_PARCHMENT.treeTrunk,
        cap: 'round',
      });

    // Sunlit Crown
    if (tree.crownPoly.length >= 3) {
      g.poly(toFlatPoints(tree.crownPoly)).fill({
        color: highlightColor,
        alpha: 0.9,
      });
    }

    // Shaded Eastern/Southern Lobe
    if (tree.shadowPoly.length >= 3) {
      g.poly(toFlatPoints(tree.shadowPoly)).fill({
        color: shadowColor,
        alpha: 0.75,
      });
    }

    // Crown Contour
    if (tree.crownPoly.length >= 3) {
      g.poly(toFlatPoints(tree.crownPoly)).stroke({
        width: 0.95,
        color: VINTAGE_PARCHMENT.mountainInk,
        alpha: 0.85,
        cap: 'round',
        join: 'round',
      });
    }
  }
}
