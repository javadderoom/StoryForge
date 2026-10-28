import type { Graphics } from 'pixi.js';
import type {
  MapEntityPlacement,
  MapTerrainFeature,
  WorldLocation,
  WorldMapSettings,
} from '@/lib/types';
import {
  isObjectVisible,
  isTerrainVisibleInLayers,
  orderTerrainForRender,
} from '../mapObjectOrder';
import type { FillWithMaterial } from './renderTypes';

import { toFlatPoints } from './renderers/shared';
import {
  drawLandmass,
  drawWaterBody,
  drawLake,
  renderWaterliningToGraphics,
  flatWaterHoles,
} from './renderers/waterTerrainRenderer';
import {
  drawRiver,
  renderProceduralRiverToGraphics,
  renderDeltaToGraphics,
} from './renderers/riverTerrainRenderer';
import {
  drawHighland,
  renderProceduralHighlandToGraphics,
  drawValley,
  renderProceduralValleyToGraphics,
  drawRange,
  drawPeak,
  renderProceduralPeakToGraphics,
} from './renderers/reliefTerrainRenderer';
import {
  drawBiome,
  renderBiomeSymbolsToGraphics,
  drawSaltPan,
  renderProceduralSaltPanToGraphics,
  renderProceduralDuneFieldToGraphics,
  renderProceduralCanopyMassToGraphics,
} from './renderers/biomeTerrainRenderer';

export {
  toFlatPoints,
  drawLandmass,
  flatWaterHoles,
  drawWaterBody,
  drawLake,
  renderWaterliningToGraphics,
  drawRiver,
  renderProceduralRiverToGraphics,
  renderDeltaToGraphics,
  drawHighland,
  renderProceduralHighlandToGraphics,
  drawValley,
  renderProceduralValleyToGraphics,
  drawRange,
  drawPeak,
  renderProceduralPeakToGraphics,
  drawBiome,
  renderBiomeSymbolsToGraphics,
  drawSaltPan,
  renderProceduralSaltPanToGraphics,
  renderProceduralDuneFieldToGraphics,
  renderProceduralCanopyMassToGraphics,
};

export interface TerrainRenderContext {
  locations?: WorldLocation[];
  placements?: MapEntityPlacement[];
}

export function renderTerrain(
  g: Graphics,
  terrainFeatures: MapTerrainFeature[],
  settings: WorldMapSettings,
  fill: FillWithMaterial,
  context?: TerrainRenderContext
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
        drawBiome(g, feat, fill, context);
        break;
      case 'salt_pan':
        drawSaltPan(g, feat, fill);
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

/** Arcane anomalies: a faint violet ring. */
function drawAnomaly(g: Graphics, feat: MapTerrainFeature): void {
  if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
  const r = feat.radius || 26;
  g.circle(feat.x, feat.y, r).fill({ color: 0x693d7a, alpha: 0.18 });
  g.circle(feat.x, feat.y, r).stroke({ width: 1.6, color: 0x693d7a, alpha: 0.8 });
}
