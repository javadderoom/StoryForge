import type { Graphics } from 'pixi.js';
import type {
  MapEntityPlacement,
  MapPoint,
  WorldLocation,
  WorldMapSettings,
  WorldTradeRoute,
  MapTerrainFeature,
} from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { mapObjectKey } from '../mapSelection';
import {
  isObjectVisible,
  isPlacementVisibleInLayers,
  isTerrainVisibleInLayers,
} from '../mapObjectOrder';
import type { DraggedNodeData } from './renderTypes';

export function renderSelectionOverlay(
  g: Graphics,
  options: {
    selectionKeys: Set<string>;
    terrainFeatures: MapTerrainFeature[];
    placements: MapEntityPlacement[];
    locations: WorldLocation[];
    tradeRoutes: WorldTradeRoute[];
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
  }): void {
  g.clear();

    const {
      selectionKeys,
      terrainFeatures,
      placements,
      locations,
      tradeRoutes,
      draggedNode,
      transientPos,
      settings,
    } = options;
    if (selectionKeys.size === 0) return;

    const haloColor = VINTAGE_PARCHMENT.selectionHalo;
    const inkColor = VINTAGE_PARCHMENT.selectionInk;
    const HALO_WIDTH = 6;
    const INK_WIDTH = 2.2;

    const strokePolyline = (points: MapPoint[], closed: boolean) => {
      if (points.length < 2) return;
      const flat = points.flatMap((point) => [point.x, point.y]);
      if (closed) {
        g.poly(flat).stroke({ width: HALO_WIDTH, color: haloColor, alpha: 0.9 });
        g.poly(flat).stroke({ width: INK_WIDTH, color: inkColor });
        return;
      }
      for (const pass of [
        { width: HALO_WIDTH, color: haloColor, alpha: 0.9 },
        { width: INK_WIDTH, color: inkColor, alpha: 1 },
      ]) {
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
        g.stroke({ width: pass.width, color: pass.color, alpha: pass.alpha, cap: 'round', join: 'round' });
      }
    };

    const strokeCircle = (x: number, y: number, radius: number) => {
      g.circle(x, y, radius).stroke({ width: HALO_WIDTH, color: haloColor, alpha: 0.9 });
      g.circle(x, y, radius).stroke({ width: INK_WIDTH, color: inkColor });
    };

    // Terrain: polygons, ink lines and point features.
    for (const feature of terrainFeatures) {
      if (!selectionKeys.has(mapObjectKey('terrain', feature.id))) continue;
      if (!isObjectVisible(feature)) continue;
      if (!isTerrainVisibleInLayers(feature.type, settings.visibleLayers)) continue;

      if (feature.polygon && feature.polygon.length >= 3) {
        strokePolyline(feature.polygon, true);
      } else if (feature.points && feature.points.length > 0) {
        strokePolyline(feature.points, false);
      } else if (typeof feature.x === 'number' && typeof feature.y === 'number') {
        strokeCircle(feature.x, feature.y, (feature.radius ?? 24) + 4);
      }
    }

    // Lore pins.
    for (const placement of placements) {
      if (!selectionKeys.has(mapObjectKey('placement', placement.id))) continue;
      if (!isObjectVisible(placement)) continue;
      if (!isPlacementVisibleInLayers(placement.entityType, settings.visibleLayers)) continue;
      strokeCircle(placement.x, placement.y, 15);
    }

    // Settlements (follow the transient position while a pin is being dragged).
    if (settings.visibleLayers.settlements) {
      for (const location of locations) {
        if (!selectionKeys.has(mapObjectKey('location', location.id))) continue;
        const coords =
          draggedNode?.type === 'location' && draggedNode.id === location.id && transientPos
            ? transientPos
            : location.coordinates;
        if (!coords) continue;
        strokeCircle(coords.x, coords.y, 19);
      }
    }

    // Trade routes (endpoints and waypoints follow a live drag).
    if (settings.visibleLayers.caravanRoutes) {
      for (const route of tradeRoutes) {
        if (!selectionKeys.has(mapObjectKey('trade_route', route.id))) continue;

        const origin = locations.find((l) => l.id === route.originLocationId)?.coordinates;
        const destination = locations.find((l) => l.id === route.destinationLocationId)?.coordinates;
        const originCoords =
          draggedNode?.type === 'location' &&
          draggedNode.id === route.originLocationId &&
          transientPos
            ? transientPos
            : origin;
        const destinationCoords =
          draggedNode?.type === 'location' &&
          draggedNode.id === route.destinationLocationId &&
          transientPos
            ? transientPos
            : destination;
        if (!originCoords || !destinationCoords) continue;

        const points: MapPoint[] = [originCoords];
        for (const [index, waypoint] of (route.waypoints ?? []).entries()) {
          const isDraggedWaypoint =
            draggedNode?.type === 'waypoint' &&
            draggedNode.routeId === route.id &&
            draggedNode.index === index &&
            transientPos;
          points.push(isDraggedWaypoint ? transientPos! : waypoint);
        }
        points.push(destinationCoords);
        strokePolyline(points, false);
      }
    }
  }
