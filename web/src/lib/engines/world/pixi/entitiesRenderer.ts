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
  terrainCenter,
} from '../mapObjectOrder';
import { resolvePlaceCategoryMeta } from '../placeCategories';
import type { DraggedNodeData } from './renderTypes';

export function renderRoutes(
  g: Graphics,
  options: {
    tradeRoutes: WorldTradeRoute[];
    locations: WorldLocation[];
    selectionKeys: Set<string>;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
  }): void {
    const { tradeRoutes, locations, selectionKeys, draggedNode, transientPos, settings } = options;
  g.clear();

    if (!settings.visibleLayers.caravanRoutes) return;

    for (const route of tradeRoutes) {
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

      // The amber selection overlay is drawn later, on top of every layer;
      // this flag only decides whether the draggable waypoint dots appear.
      const isSelected = selectionKeys.has(mapObjectKey('trade_route', route.id));

      // Draw Main Route Line
      g.moveTo(fullPoints[0].x, fullPoints[0].y);
      for (let i = 1; i < fullPoints.length; i++) {
        g.lineTo(fullPoints[i].x, fullPoints[i].y);
      }
      g.stroke({
        width: isSelected ? 4 : 2.5,
        color: strokeColor,
        cap: 'round',
        join: 'round',
      });

      // Draggable Intermediate Waypoints
      if (isSelected) {
        for (const wp of waypoints) {
          g.circle(wp.x, wp.y, 7)
            .fill({ color: VINTAGE_PARCHMENT.caravanWaypoint })
            .stroke({ width: 2, color: 0xffffff });
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
  }
): void {
  const {
    locations,
    draggedNode,
    transientPos,
    settings,
    placeCategories,
    terrainFeatures,
  } = options;
  g.clear();
  labelsContainer.removeChildren();

  if (!settings.visibleLayers.settlements && !settings.visibleLayers.labels) return;

  const linkedByLocation = new Map<string, MapTerrainFeature>();
  for (const feature of terrainFeatures ?? []) {
    if (feature.locationId) linkedByLocation.set(feature.locationId, feature);
  }

  for (const loc of locations) {
    if (!loc.coordinates || loc.coordinates.x <= 0) continue;

    const meta = resolvePlaceCategoryMeta(loc.category, placeCategories);
    const isPoint = meta.geometryKind === 'point' && meta.renderAs === 'settlement';
    const isDragged = draggedNode?.type === 'location' && draggedNode.id === loc.id;
    const coords = isDragged && transientPos ? transientPos : loc.coordinates;
    const { x, y } = coords;

    // Plan 24: a river/steppe/sea is a semantic place, not a settlement. Its
    // linked terrain is already drawn by the terrain layer; here it gets a
    // readable label and no city shield.
    if (!isPoint) {
      if (!settings.visibleLayers.labels) continue;
      const linked = linkedByLocation.get(loc.id);
      const labelPoint = (linked && terrainCenter(linked)) || { x, y };
      drawPlaceLabel(
        g,
        labelsContainer,
        loc.name,
        labelPoint,
        meta.renderAs === 'settlement' ? 'label' : meta.renderAs
      );
      continue;
    }

    if (!settings.visibleLayers.settlements) continue;

    const isCapital = loc.category === 'capital';
    const isFortress = loc.category === 'stronghold';
    const isDungeon = loc.category === 'dungeon';

    const radius = isCapital ? 16 : isFortress ? 13 : 11;
    let fillColor: number = VINTAGE_PARCHMENT.fortressIron;
    if (isCapital) fillColor = VINTAGE_PARCHMENT.capitalGold;
    else if (isDungeon) fillColor = VINTAGE_PARCHMENT.dungeonCrimson;

    // Outer Shield / Roundel (the selection ring is drawn by the shared
    // overlay, so every kind of map object is highlighted the same way)
    g.circle(x, y, radius)
      .fill({ color: fillColor })
      .stroke({
        width: 2,
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
      });
      labelText.anchor.set(0.5, 0);
      labelText.x = x;
      labelText.y = y + radius + 4;

      // Background banner rect
      const textW = labelText.width + 12;
      const textH = labelText.height + 4;
      g.roundRect(x - textW / 2, y + radius + 3, textW, textH, 4)
        .fill({ color: VINTAGE_PARCHMENT.labelBannerBg, alpha: 0.92 })
        .stroke({ width: 1, color: VINTAGE_PARCHMENT.labelBannerBorder });

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
  renderAs: 'label' | 'line' | 'water' | 'anomaly'
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
  });
  label.anchor.set(0.5, 0.5);
  label.x = point.x;
  label.y = point.y;
  labelsContainer.addChild(label);

  const half = label.width / 2 + 4;
  g.moveTo(point.x - half, point.y + 8)
    .lineTo(point.x + half, point.y + 8)
    .stroke({ width: 0.8, color, alpha: 0.45 });
}

export function renderPlacements(
  g: Graphics,
  placements: MapEntityPlacement[],
  settings: WorldMapSettings
): void {
  g.clear();

    // Plan 21: pins are drawn in their own draw order, and a hidden pin is
    // simply not drawn (the category switch still applies on top of it).
    for (const p of orderPlacementsForRender(placements)) {
      if (!isObjectVisible(p)) continue;

      if (!isPlacementVisibleInLayers(p.entityType, settings.visibleLayers)) continue;

      let pinColor = 0x4f46e5;
      if (p.entityType === 'npc') pinColor = 0x3b82f6;
      else if (p.entityType === 'bestiary') pinColor = 0xdc2626;
      else if (p.entityType === 'artifact') pinColor = 0x9333ea;
      else if (p.entityType === 'deity') pinColor = 0xeab308;

      g.circle(p.x, p.y, 9)
        .fill({ color: pinColor })
        .stroke({ width: 1.5, color: 0xffffff });
    }
  }
