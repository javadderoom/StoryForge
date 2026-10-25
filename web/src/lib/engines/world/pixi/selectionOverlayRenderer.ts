import type { Graphics } from 'pixi.js';
import type {
  CustomPlaceCategory,
  MapEntityPlacement,
  MapPoint,
  MapRoute,
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
import {
  isPointPlaceCategory,
  placeLabelHalfWidth,
  PLACE_LABEL_HALF_HEIGHT,
  resolvePlaceMapAnchor,
} from '../placeCategories';
import type { DraggedNodeData } from './renderTypes';
import { resolveMapRoutePoints } from '../mapRoutes';

export function renderSelectionOverlay(
  g: Graphics,
  options: {
    selectionKeys: Set<string>;
    terrainFeatures: MapTerrainFeature[];
    placements: MapEntityPlacement[];
    locations: WorldLocation[];
    tradeRoutes: WorldTradeRoute[];
    mapRoutes?: MapRoute[];
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
    placeCategories?: CustomPlaceCategory[];
  }): void {
  g.clear();

    const {
      selectionKeys,
      terrainFeatures,
      placements,
      locations,
      tradeRoutes,
      mapRoutes,
      draggedNode,
      transientPos,
      settings,
      placeCategories,
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

    const strokeLabel = (anchor: MapPoint, name: string) => {
      const halfWidth = placeLabelHalfWidth(name);
      const box = {
        x: anchor.x - halfWidth,
        y: anchor.y - PLACE_LABEL_HALF_HEIGHT,
        width: halfWidth * 2,
        height: PLACE_LABEL_HALF_HEIGHT * 2,
      };
      g.roundRect(box.x, box.y, box.width, box.height, 5).stroke({
        width: HALO_WIDTH,
        color: haloColor,
        alpha: 0.9,
      });
      g.roundRect(box.x, box.y, box.width, box.height, 5).stroke({
        width: INK_WIDTH,
        color: inkColor,
      });
    };

    // Terrain: polygons, ink lines and point features.
    for (const feature of terrainFeatures) {
      if (!selectionKeys.has(mapObjectKey('terrain', feature.id))) continue;
      if (!isObjectVisible(feature)) continue;
      if (!isTerrainVisibleInLayers(feature.type, settings.visibleLayers)) continue;

      if (feature.polygon && feature.polygon.length >= 3) {
        const poly = feature.polygon.map((point, index) => {
          const isDragged =
            draggedNode?.type === 'terrain_vertex' &&
            draggedNode.id === feature.id &&
            draggedNode.subType === 'polygon' &&
            draggedNode.index === index;
          return isDragged && transientPos ? transientPos : point;
        });
        strokePolyline(poly, true);
        // Render midpoint insertion handles
        for (let i = 0; i < poly.length; i++) {
          const p1 = poly[i];
          const p2 = poly[(i + 1) % poly.length];
          if (Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 16) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            g.circle(mx, my, 3.5)
              .fill({ color: 0xd97706, alpha: 0.85 })
              .stroke({ width: 1.2, color: 0xfffbeb });
          }
        }
        // Render primary vertex anchor handles
        poly.forEach((point) => {
          g.circle(point.x, point.y, 4.5)
            .fill({ color: 0xfffbeb })
            .stroke({ width: 1.5, color: 0xb45309 });
        });
      } else if (feature.points && feature.points.length > 0) {
        const pts = feature.points.map((point, index) => {
          const isDragged =
            draggedNode?.type === 'terrain_vertex' &&
            draggedNode.id === feature.id &&
            draggedNode.subType === 'points' &&
            draggedNode.index === index;
          return isDragged && transientPos ? transientPos : point;
        });
        strokePolyline(pts, false);
        // Render midpoint insertion handles
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          if (Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 16) {
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            g.circle(mx, my, 3.5)
              .fill({ color: 0xd97706, alpha: 0.85 })
              .stroke({ width: 1.2, color: 0xfffbeb });
          }
        }
        // Render primary vertex anchor handles
        pts.forEach((point) => {
          g.circle(point.x, point.y, 4.5)
            .fill({ color: 0xfffbeb })
            .stroke({ width: 1.5, color: 0xb45309 });
        });
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

    // Places: point categories follow their pin; non-point categories are
    // outlined by the label that is actually drawn for them.
    for (const location of locations) {
      if (!selectionKeys.has(mapObjectKey('location', location.id)) || !isObjectVisible(location)) continue;
      const isPoint = isPointPlaceCategory(location.category, placeCategories);

      if (isPoint) {
        if (!settings.visibleLayers.settlements) continue;
        const coords =
          draggedNode?.type === 'location' && draggedNode.id === location.id && transientPos
            ? transientPos
            : location.coordinates;
        if (!coords) continue;
        strokeCircle(coords.x, coords.y, 19);
        continue;
      }

      if (!settings.visibleLayers.labels) continue;
      const anchor = resolvePlaceMapAnchor(location, terrainFeatures);
      if (!anchor) continue;
      strokeLabel(anchor, location.name);
    }

    // Drawn roads (Plan 25). The source is the live view, so an endpoint that
    // follows a dragged settlement or a moved terrain resolves correctly.
    if (settings.visibleLayers.routes !== false) {
      for (const route of mapRoutes ?? []) {
        if (!selectionKeys.has(mapObjectKey('route', route.id)) || !isObjectVisible(route)) continue;
        const transient =
          draggedNode?.type === 'route_vertex' &&
          draggedNode.routeId === route.id &&
          draggedNode.index !== undefined &&
          transientPos
            ? { index: draggedNode.index, point: transientPos }
            : null;
        const resolved = resolveMapRoutePoints(
          route,
          { locations, terrainFeatures, placements, placeCategories },
          transient
        );
        strokePolyline(resolved.points, false);
      }
    }

    // Trade routes (endpoints and waypoints follow a live drag).
    if (settings.visibleLayers.caravanRoutes) {
      for (const route of tradeRoutes) {
        if (!selectionKeys.has(mapObjectKey('trade_route', route.id)) || !isObjectVisible(route)) continue;

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
