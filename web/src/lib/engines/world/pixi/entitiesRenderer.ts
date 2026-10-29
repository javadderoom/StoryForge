import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type {
  CustomPlaceCategory,
  MapEntityPlacement,
  MapPoint,
  MapTerrainFeature,
  WorldLocation,
  WorldMapSettings,
  WorldTradeRoute,
} from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { mapObjectKey } from '../mapSelection';
import {
  isObjectVisible,
  isPlacementVisibleInLayers,
  orderPlacementsForRender,
} from '../mapObjectOrder';
import { resolvePlaceCategoryMeta, resolvePlaceMapAnchor } from '../placeCategories';
import type { DraggedNodeData } from './renderTypes';
import {
  calculateCounterScale,
  getDynamicTextResolution,
  getSettlementLODTier,
  isElementVisibleAtZoom,
} from './lodManager';

export function renderRoutes(
  g: Graphics,
  options: {
    tradeRoutes: WorldTradeRoute[];
    locations: WorldLocation[];
    selectionKeys: Set<string>;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
    zoom?: number;
  }): void {
    const {
      tradeRoutes,
      locations,
      selectionKeys,
      draggedNode,
      transientPos,
      settings,
      zoom = 1.0,
    } = options;
  g.clear();

    if (!settings.visibleLayers.caravanRoutes) return;

    const isRegionalOrCloser = isElementVisibleAtZoom(2, zoom, false);
    const counterScale = calculateCounterScale(zoom);

    for (const route of tradeRoutes) {
      if (!isObjectVisible(route)) continue;
      const isSelected = selectionKeys.has(mapObjectKey('trade_route', route.id));
      if (!isRegionalOrCloser && !isSelected) continue;

      const orig = locations.find((l) => l.id === route.originLocationId);
      const dest = locations.find((l) => l.id === route.destinationLocationId);
      if (!orig?.coordinates || !dest?.coordinates) continue;

      const originCoords =
        draggedNode?.type === 'location' && draggedNode.id === orig.id && transientPos
          ? transientPos
          : orig.coordinates;

      const destCoords =
        draggedNode?.type === 'location' && draggedNode.id === dest.id && transientPos
          ? transientPos
          : dest.coordinates;

      const waypoints = (route.waypoints || []).map((wp, idx) => {
        if (
          draggedNode?.type === 'waypoint' &&
          draggedNode.routeId === route.id &&
          draggedNode.index === idx &&
          transientPos
        ) {
          return transientPos;
        }
        return wp;
      });

      const fullPoints: MapPoint[] = [originCoords, ...waypoints, destCoords];

      let strokeColor: number = VINTAGE_PARCHMENT.caravanActive;
      if (route.status === 'raided') strokeColor = VINTAGE_PARCHMENT.caravanRaided;
      else if (route.status === 'blockaded') strokeColor = VINTAGE_PARCHMENT.caravanBlockaded;
      else if (route.status === 'secret') strokeColor = VINTAGE_PARCHMENT.caravanSecret;
      else if (route.status === 'seasonal') strokeColor = VINTAGE_PARCHMENT.caravanSeasonal;

      // Draw Main Route Line
      g.moveTo(fullPoints[0].x, fullPoints[0].y);
      for (let i = 1; i < fullPoints.length; i++) {
        g.lineTo(fullPoints[i].x, fullPoints[i].y);
      }
      g.stroke({
        width: isSelected ? Math.max(2, 4 * counterScale) : Math.max(1.5, 2.5 * counterScale),
        color: strokeColor,
        cap: 'round',
        join: 'round',
      });

      // Draggable Intermediate Waypoints
      // Shown when route is selected OR at Tactical zoom (zoom >= 1.75)
      const showWaypoints = isSelected || isElementVisibleAtZoom(4, zoom, false);
      if (showWaypoints) {
        const wpRadius = Math.max(3.5, 7 * counterScale);
        for (const wp of waypoints) {
          g.circle(wp.x, wp.y, wpRadius)
            .fill({ color: VINTAGE_PARCHMENT.caravanWaypoint })
            .stroke({ width: Math.max(1, 2 * counterScale), color: 0xffffff });
        }
      }
    }
  }

export function renderSettlements(
  g: Graphics,
  labelsContainer: Container,
  options: {
    locations: WorldLocation[];
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
    isPersian: boolean;
    placeCategories?: CustomPlaceCategory[];
    terrainFeatures?: MapTerrainFeature[];
    zoom?: number;
    selectionKeys?: Set<string>;
  }
): void {
  const {
    locations,
    draggedNode,
    transientPos,
    settings,
    placeCategories,
    terrainFeatures,
    zoom = 1.0,
    selectionKeys,
  } = options;
  g.clear();
  labelsContainer.removeChildren();

  if (!settings.visibleLayers.settlements && !settings.visibleLayers.labels) return;

  const counterScale = calculateCounterScale(zoom);
  const textResolution = getDynamicTextResolution(zoom);

  for (const loc of locations) {
    if (!isObjectVisible(loc)) continue;
    const meta = resolvePlaceCategoryMeta(loc.category, placeCategories);
    const isPoint = meta.renderAs === 'settlement';
    const isDragged = draggedNode?.type === 'location' && draggedNode.id === loc.id;
    const isSelected = selectionKeys?.has(mapObjectKey('location', loc.id)) ?? false;

    // Semantic LOD filter: only show if current zoom matches settlement tier OR if selected
    const tier = getSettlementLODTier(loc.category);
    if (!isElementVisibleAtZoom(tier, zoom, isSelected)) {
      continue;
    }

    // Plan 24: a river/steppe/sea is a semantic place, not a settlement. Its
    // linked terrain is already drawn by the terrain layer; here it gets a
    // readable label and no city shield. Unlike a point pin it does not need
    // its own coordinates when a linked feature supplies the anchor.
    if (!isPoint) {
      if (!settings.visibleLayers.labels) continue;
      const anchor = resolvePlaceMapAnchor(loc, terrainFeatures);
      if (!anchor) continue;
      drawPlaceLabel(
        g,
        labelsContainer,
        loc.name,
        anchor,
        meta.renderAs === 'settlement' ? 'label' : meta.renderAs,
        counterScale,
        textResolution
      );
      continue;
    }

    if (!loc.coordinates || loc.coordinates.x <= 0) continue;
    if (!settings.visibleLayers.settlements) continue;

    const coords = isDragged && transientPos ? transientPos : loc.coordinates;
    const { x, y } = coords;

    const isCapital = loc.category === 'capital';
    const isFortress = loc.category === 'stronghold';
    const isDungeon = loc.category === 'dungeon';

    const baseRadius = isCapital ? 16 : isFortress ? 13 : 11;
    const radius = Math.max(4, baseRadius * counterScale);
    let fillColor: number = VINTAGE_PARCHMENT.fortressIron;
    if (isCapital) fillColor = VINTAGE_PARCHMENT.capitalGold;
    else if (isDungeon) fillColor = VINTAGE_PARCHMENT.dungeonCrimson;

    // Soft parchment under-halo to guarantee sharp contrast over textured terrain
    g.circle(x, y, radius + 3 * counterScale).fill({
      color: VINTAGE_PARCHMENT.bgParchment,
      alpha: 0.88,
    });

    // Outer Shield / Roundel (the selection ring is drawn by the shared
    // overlay, so every kind of map object is highlighted the same way)
    g.circle(x, y, radius)
      .fill({ color: fillColor })
      .stroke({
        width: Math.max(1, 2 * counterScale),
        color: VINTAGE_PARCHMENT.settlementBorder,
      });

    // Inner heraldic core
    g.circle(x, y, radius * 0.45).fill({
      color: 0xffffff,
    });

    // Settlement Name Plaque / Banner
    if (settings.visibleLayers.labels && loc.name) {
      const textStyle = new TextStyle({
        fontSize: isCapital ? 13 : 11,
        fontWeight: isCapital ? 'bold' : 'normal',
        fill: VINTAGE_PARCHMENT.labelText,
        fontFamily: 'serif',
      });

      const labelText = new Text({
        text: loc.name,
        style: textStyle,
        resolution: textResolution,
      });
      labelText.anchor.set(0.5, 0);
      labelText.scale.set(counterScale);
      labelText.x = x;
      labelText.y = y + radius + 4 * counterScale;

      // Background banner rect
      const textW = labelText.width + 12 * counterScale;
      const textH = labelText.height + 4 * counterScale;
      g.roundRect(
        x - textW / 2,
        y + radius + 2.5 * counterScale,
        textW,
        textH,
        Math.max(2, 4 * counterScale)
      )
        .fill({ color: VINTAGE_PARCHMENT.labelBannerBg, alpha: 0.92 })
        .stroke({
          width: Math.max(0.75, 1 * counterScale),
          color: VINTAGE_PARCHMENT.labelBannerBorder,
        });

      labelsContainer.addChild(labelText);
    }
  }
}

/** A quiet label for a semantic place that is drawn by terrain, not a pin. */
function drawPlaceLabel(
  g: Graphics,
  labelsContainer: Container,
  text: string,
  point: MapPoint,
  renderAs: 'label' | 'line' | 'water' | 'anomaly',
  counterScale = 1.0,
  textResolution = 1.0
): void {
  const color =
    renderAs === 'water' || renderAs === 'line'
      ? VINTAGE_PARCHMENT.riverInk
      : renderAs === 'anomaly'
      ? VINTAGE_PARCHMENT.caravanSecret
      : VINTAGE_PARCHMENT.labelText;

  const label = new Text({
    text,
    style: new TextStyle({
      fontSize: 10,
      fontStyle: 'italic',
      fill: color,
      fontFamily: 'serif',
    }),
    resolution: textResolution,
  });
  label.anchor.set(0.5, 0.5);
  label.scale.set(counterScale);
  label.x = point.x;
  label.y = point.y;
  labelsContainer.addChild(label);

  const half = (label.width / 2) + 4 * counterScale;
  g.moveTo(point.x - half, point.y + 8 * counterScale)
    .lineTo(point.x + half, point.y + 8 * counterScale)
    .stroke({ width: Math.max(0.6, 0.8 * counterScale), color, alpha: 0.45 });
}

export function renderPlacements(
  g: Graphics,
  placements: MapEntityPlacement[],
  settings: WorldMapSettings,
  labelsContainer?: Container,
  options?: {
    zoom?: number;
    selectionKeys?: Set<string>;
  }
): void {
  g.clear();
  if (labelsContainer) labelsContainer.removeChildren();

  const zoom = options?.zoom ?? 1.0;
  const selectionKeys = options?.selectionKeys;
  const counterScale = calculateCounterScale(zoom);
  const textResolution = getDynamicTextResolution(zoom);

  // Placed lore pins are visible starting at Tier 3 (Provincial, zoom >= 1.0)
  const isProvincialOrCloser = isElementVisibleAtZoom(3, zoom, false);
  const isTactical = isElementVisibleAtZoom(4, zoom, false);

  // Plan 21: pins are drawn in their own draw order, and a hidden pin is
  // simply not drawn (the category switch still applies on top of it).
  for (const p of orderPlacementsForRender(placements)) {
    if (!isObjectVisible(p)) continue;

    if (!isPlacementVisibleInLayers(p.entityType, settings.visibleLayers)) continue;

    const isSelected = selectionKeys?.has(mapObjectKey('placement', p.id)) ?? false;
    // Declutter when zooming out: hide lore pins unless selected or in Provincial/Tactical view
    if (!isProvincialOrCloser && !isSelected) continue;

    const { x, y } = p;

    // Soft parchment under-halo to guarantee sharp contrast over textured terrain
    const haloBase = p.entityType === 'bestiary' ? 16 : 14;
    const haloRadius = Math.max(5, haloBase * counterScale);
    g.circle(x, y, haloRadius).fill({
      color: VINTAGE_PARCHMENT.bgParchment,
      alpha: 0.88,
    });

    const tokenRadius = Math.max(4, 11 * counterScale);
    const strokeW = Math.max(1, 2 * counterScale);

    if (p.entityType === 'bestiary') {
      // Beast Token: Spiked dark crimson roundel with amber/gold beast core
      const bestiaryRadius = Math.max(4.5, 12 * counterScale);
      g.circle(x, y, bestiaryRadius)
        .fill({ color: 0x4c0519 })
        .stroke({ width: strokeW, color: 0xe11d48 });
      g.circle(x, y, Math.max(2.5, 6.5 * counterScale)).fill({ color: 0xbe123c });
      g.circle(x, y, Math.max(1, 2.5 * counterScale)).fill({ color: 0xfef08a });

      // If Danger Level is high, draw warning fang pips in Tactical view (zoom >= 1.75) or when selected
      if ((isTactical || isSelected) && p.notes && /danger [45]|dc 2[0-9]|calamity/i.test(p.notes)) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
          const px = x + Math.cos(angle) * (bestiaryRadius + 2 * counterScale);
          const py = y + Math.sin(angle) * (bestiaryRadius + 2 * counterScale);
          g.circle(px, py, Math.max(0.8, 1.8 * counterScale)).fill({ color: 0xf59e0b });
        }
      }
    } else if (p.entityType === 'npc') {
      // Stationed NPC: Sapphire shield token
      g.circle(x, y, tokenRadius)
        .fill({ color: 0x1e3a8a })
        .stroke({ width: strokeW, color: 0x3b82f6 });
      g.circle(x, y, Math.max(1.8, 4.5 * counterScale)).fill({ color: 0x93c5fd });
    } else if (p.entityType === 'timeline') {
      // Story Encounter: Amber diamond
      const dy = 11 * counterScale;
      const dx = 9 * counterScale;
      g.poly([
        { x, y: y - dy },
        { x: x + dx, y },
        { x, y: y + dy },
        { x: x - dx, y },
      ])
        .fill({ color: 0x78350f })
        .stroke({ width: strokeW, color: 0xf59e0b });
      g.circle(x, y, Math.max(1.5, 3.5 * counterScale)).fill({ color: 0xfef3c7 });
    } else if (p.entityType === 'artifact') {
      // Artifact: Amethyst mystic diamond
      const dy = 11 * counterScale;
      const dx = 9 * counterScale;
      g.poly([
        { x, y: y - dy },
        { x: x + dx, y },
        { x, y: y + dy },
        { x: x - dx, y },
      ])
        .fill({ color: 0x581c87 })
        .stroke({ width: strokeW, color: 0xa855f7 });
      g.circle(x, y, Math.max(1.5, 3.5 * counterScale)).fill({ color: 0xf5d0fe });
    } else {
      let pinColor = 0x4f46e5;
      if (p.entityType === 'deity') pinColor = 0xeab308;

      g.circle(x, y, Math.max(3.5, 9 * counterScale))
        .fill({ color: pinColor })
        .stroke({ width: Math.max(0.8, 1.5 * counterScale), color: 0xffffff });
    }

    // Name label banner beneath the pin
    if (labelsContainer && settings.visibleLayers.labels !== false && p.customLabel) {
      const textStyle = new TextStyle({
        fontSize: 10,
        fontWeight: p.entityType === 'bestiary' ? 'bold' : 'normal',
        fill: p.entityType === 'bestiary' ? 0x4c0519 : VINTAGE_PARCHMENT.labelText,
        fontFamily: 'serif',
      });

      const iconPrefix =
        p.entityType === 'bestiary'
          ? '🐉 '
          : p.entityType === 'npc'
          ? '👤 '
          : p.entityType === 'timeline'
          ? '⚔️ '
          : p.entityType === 'artifact'
          ? '✨ '
          : '';

      const labelText = new Text({
        text: `${iconPrefix}${p.customLabel}`,
        style: textStyle,
        resolution: textResolution,
      });
      labelText.anchor.set(0.5, 0);
      labelText.scale.set(counterScale);
      labelText.x = x;
      labelText.y = y + 15 * counterScale;

      const textW = labelText.width + 10 * counterScale;
      const textH = labelText.height + 3 * counterScale;
      g.roundRect(
        x - textW / 2,
        y + 14 * counterScale,
        textW,
        textH,
        Math.max(2, 3 * counterScale)
      )
        .fill({
          color: p.entityType === 'bestiary' ? 0xfff1f2 : VINTAGE_PARCHMENT.labelBannerBg,
          alpha: 0.94,
        })
        .stroke({
          width: Math.max(0.75, 1 * counterScale),
          color: p.entityType === 'bestiary' ? 0xfecdd3 : VINTAGE_PARCHMENT.labelBannerBorder,
        });

      labelsContainer.addChild(labelText);
    }
  }
}
