import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MapPoint,
  MapRoute,
  MapTerrainFeature,
  WorldTradeRoute,
} from '@/lib/types';
import type { DraggedNodeData } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import { applyTransform } from '@/lib/engines/world/pixi/transformMath';
import type { ActiveVertex } from './useVertexEditing';

export interface UseCanvasNodeDragOptions {
  tradeRoutesRef: React.RefObject<WorldTradeRoute[]>;
  mapRoutesRef: React.RefObject<MapRoute[]>;
  terrainFeaturesRef: React.RefObject<MapTerrainFeature[]>;
  onUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  onUpdateRoute: (id: string, updated: Partial<MapRoute>) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  selectVertex: (vertex: ActiveVertex | null) => void;
}

export function useCanvasNodeDrag({
  tradeRoutesRef,
  mapRoutesRef,
  terrainFeaturesRef,
  onUpdateTradeRoute,
  onUpdateRoute,
  onUpdateTerrain,
  selectVertex,
}: UseCanvasNodeDragOptions) {
  // Buffered drag state for zero-server-request 60fps moves
  const [draggedNode, setDraggedNode] = useState<DraggedNodeData | null>(null);
  const [transientPos, setTransientPos] = useState<MapPoint | null>(null);

  const draggedNodeRef = useRef<DraggedNodeData | null>(null);
  const transientPosRef = useRef<MapPoint | null>(null);

  useEffect(() => {
    draggedNodeRef.current = draggedNode;
  }, [draggedNode]);

  useEffect(() => {
    transientPosRef.current = transientPos;
  }, [transientPos]);

  const updateTransientPos = useCallback((point: MapPoint) => {
    setTransientPos(point);
    transientPosRef.current = point;
  }, []);

  const startDraggingNode = useCallback(
    (nodeData: DraggedNodeData, point: MapPoint) => {
      setDraggedNode(nodeData);
      draggedNodeRef.current = nodeData;
      setTransientPos(point);
      transientPosRef.current = point;
    },
    []
  );

  /**
   * Commits the active dragged node (waypoint, route vertex, terrain vertex,
   * or transform handle) to world state when the mouse is released.
   */
  const commitNodeDragEnd = useCallback(() => {
    const active = draggedNodeRef.current;
    const finalPos = transientPosRef.current;

    if (active && finalPos) {
      const hasMoved = active.startPoint.x !== finalPos.x || active.startPoint.y !== finalPos.y;

      if (hasMoved && active.type === 'waypoint' && active.routeId && active.index !== undefined) {
        const route = tradeRoutesRef.current.find((r) => r.id === active.routeId);
        if (route && route.waypoints) {
          const updatedWaypoints = [...route.waypoints];
          updatedWaypoints[active.index] = finalPos;
          onUpdateTradeRoute(route.id, { waypoints: updatedWaypoints });
        }
      }

      if (hasMoved && active.type === 'route_vertex' && active.routeId && active.index !== undefined) {
        const route = mapRoutesRef.current.find((r) => r.id === active.routeId);
        if (route) {
          const updatedPath = [...(route.path ?? [])];
          updatedPath[active.index] = finalPos;
          onUpdateRoute(route.id, { path: updatedPath });
        }
      }

      if (hasMoved && active.type === 'terrain_vertex' && active.id && active.index !== undefined) {
        const feature = terrainFeaturesRef.current.find((f) => f.id === active.id);
        if (feature) {
          if (active.subType === 'points' && feature.points) {
            const updatedPoints = [...feature.points];
            updatedPoints[active.index] = finalPos;
            onUpdateTerrain(feature.id, { points: updatedPoints });
          } else if (active.subType === 'polygon' && feature.polygon) {
            const updatedPolygon = [...feature.polygon];
            updatedPolygon[active.index] = finalPos;
            onUpdateTerrain(feature.id, { polygon: updatedPolygon });
          }
        }
      }

      if (
        hasMoved &&
        active.type === 'transform_handle' &&
        active.id &&
        active.originBox &&
        active.handleType
      ) {
        const feature = terrainFeaturesRef.current.find((f) => f.id === active.id);
        if (feature) {
          if (feature.points && feature.points.length >= 2) {
            const transformed = applyTransform(
              feature.points,
              active.handleType,
              active.originBox,
              active.startPoint,
              finalPos,
              false
            );
            onUpdateTerrain(feature.id, { points: transformed });
          } else if (feature.polygon && feature.polygon.length >= 3) {
            const transformed = applyTransform(
              feature.polygon,
              active.handleType,
              active.originBox,
              active.startPoint,
              finalPos,
              false
            );
            onUpdateTerrain(feature.id, { polygon: transformed });
          }
        }
      }
    }

    setDraggedNode(null);
    setTransientPos(null);
    draggedNodeRef.current = null;
    transientPosRef.current = null;
  }, [
    mapRoutesRef,
    onUpdateRoute,
    onUpdateTerrain,
    onUpdateTradeRoute,
    terrainFeaturesRef,
    tradeRoutesRef,
  ]);

  return {
    draggedNode,
    transientPos,
    draggedNodeRef,
    transientPosRef,
    updateTransientPos,
    startDraggingNode,
    commitNodeDragEnd,
  };
}
