import type { Graphics } from 'pixi.js';
import type { MapTerrainFeature, WorldMapSettings } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { generateOrganicParchmentContours } from './pixiMath';
import {
  isObjectVisible,
  isTerrainVisibleInLayers,
  orderTerrainForRender,
} from '../mapObjectOrder';
import type { MapMaterialKey } from '../texturePalette';
import type { FillWithMaterial } from './renderTypes';

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
    const flatPoints: number[] = [];
    for (const pt of points) flatPoints.push(pt.x, pt.y);

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
      const holeFlat: number[] = [];
      for (const pt of holePoints) holeFlat.push(pt.x, pt.y);

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
    const flatPoints: number[] = [];
    for (const pt of points) flatPoints.push(pt.x, pt.y);

    fill(g, flatPoints, material, VINTAGE_PARCHMENT.oceanWash, 1);
    g.poly(flatPoints).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
    g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
  }

  /** Biomes: translucent washes laid over the land. */
  function drawBiome(g: Graphics, feat: MapTerrainFeature, fill: FillWithMaterial): void {
    if (!feat.polygon || feat.polygon.length <= 2) return;
    const flatPoints: number[] = [];
    for (const pt of feat.polygon) flatPoints.push(pt.x, pt.y);

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

  /** Rivers: winding blue-grey ink lines. */
  function drawRiver(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.points || feat.points.length < 2) return;
    const pts = feat.points;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({
      width: feat.width || 3.5,
      color: VINTAGE_PARCHMENT.riverInk,
      cap: 'round',
      join: 'round',
    });
  }

  /**
   * Valleys, canyons and chasms: a dark cleft with a hand-inked lip.
   *
   * The Valley tool and the AI Oracle both produce these, but the renderer
   * had no branch for them — they lived in the data and never appeared on
   * the map (Cartographer truth audit, item #2).
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

  /** Mountain ranges: a shaded spine with a hand-inked crest. */
  function drawRange(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.points || feat.points.length < 2) return;
    const pts = feat.points;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({
      width: feat.width || 25,
      color: VINTAGE_PARCHMENT.mountainShade,
      alpha: 0.6,
      cap: 'round',
    });
    g.stroke({ width: 3, color: VINTAGE_PARCHMENT.mountainInk, cap: 'round' });
  }

  /** Peaks and volcanoes: woodcut triangles with a snowcap. */
  function drawPeak(g: Graphics, feat: MapTerrainFeature): void {
    if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
    const x = feat.x;
    const y = feat.y;
    const r = feat.radius || 30;

    g.poly([x, y - r, x - r * 0.8, y + r * 0.7, x + r * 0.8, y + r * 0.7])
      .fill({ color: feat.type === 'volcano' ? 0x7f1d1d : VINTAGE_PARCHMENT.landFill })
      .stroke({ width: 2, color: VINTAGE_PARCHMENT.mountainInk });

    g.poly([x, y - r, x, y + r * 0.7, x + r * 0.8, y + r * 0.7]).fill({
      color: VINTAGE_PARCHMENT.mountainShade,
      alpha: 0.5,
    });

    g.poly([x, y - r, x - r * 0.3, y - r * 0.3, x + r * 0.3, y - r * 0.3]).fill({
      color: VINTAGE_PARCHMENT.mountainSnowcap,
    });
  }

  /** Arcane anomalies: a faint violet ring. */
  function drawAnomaly(g: Graphics, feat: MapTerrainFeature): void {
    if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
    const r = feat.radius || 26;
    g.circle(feat.x, feat.y, r).fill({ color: 0x693d7a, alpha: 0.18 });
    g.circle(feat.x, feat.y, r).stroke({ width: 1.6, color: 0x693d7a, alpha: 0.8 });
  }
