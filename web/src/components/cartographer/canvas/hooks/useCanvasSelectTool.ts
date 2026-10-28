import React, { useCallback } from 'react';
import type {
  WorldBible,
  WorldMapSettings,
  MapTerrainFeature,
  MapRoute,
  MapPoint,
} from '@/lib/types';
import type { PixiCartographerEngine } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import {
  marqueeSelectRefs,
  mergeMapObjectRefs,
  sameMapObjectRef,
  toggleMapObjectRef,
  type MapObjectRef,
} from '@/lib/engines/world/mapSelection';
import { screenToWorld } from '@/lib/engines/world/pixi/pixiMath';
import { normalizeLandWaterFeatures } from '@/lib/engines/world/landSculpt/waterFeatures';
import type { MarqueeState, SelectionDragState } from './useCanvasGestures';
import { MARQUEE_THRESHOLD_PX } from './useCanvasGestures';
import type { ActiveVertex } from './useVertexEditing';
import type { DraggedNodeData } from '@/lib/engines/world/pixi/PixiCartographerEngine';

export interface UseCanvasSelectToolOptions {
  engineRef: React.RefObject<PixiCartographerEngine | null>;
  settings: WorldMapSettings;
  selection: MapObjectRef[];
  worldBible: WorldBible;
  terrainFeaturesRef: React.RefObject<MapTerrainFeature[]>;
  mapRoutesRef: React.RefObject<MapRoute[]>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  zoom: number;
  onSelectionChange: (refs: MapObjectRef[]) => void;
  onMoveSelection: (refs: MapObjectRef[], dx: number, dy: number) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  selectVertex: (vertex: ActiveVertex | null) => void;
  clearActiveVertex: () => void;
  startDraggingNode: (nodeData: DraggedNodeData, point: MapPoint) => void;
  setSelectionDragState: (next: SelectionDragState | null) => void;
  setMarqueeState: (next: MarqueeState | null) => void;
}

export function useCanvasSelectTool({
  engineRef,
  settings,
  selection,
  worldBible,
  terrainFeaturesRef,
  mapRoutesRef,
  containerRef,
  pan,
  zoom,
  onSelectionChange,
  onMoveSelection,
  onUpdateTerrain,
  selectVertex,
  clearActiveVertex,
  startDraggingNode,
  setSelectionDragState,
  setMarqueeState,
}: UseCanvasSelectToolOptions) {
  /**
   * Primary mouse down on the canvas while the `select` tool is active.
   * Dispatches between vertex editing, transform handles, group dragging,
   * single-object picking, and empty-parchment rubber-banding.
   */
  const handleSelectMouseDown = useCallback(
    (e: React.MouseEvent, worldPoint: MapPoint) => {
      if (!engineRef.current) return;

      const hit = engineRef.current.pickAt(worldPoint, settings.visibleLayers);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;

      if (hit) {
        const hitRef: MapObjectRef =
          hit.kind === 'waypoint'
            ? { kind: 'trade_route', id: hit.candidate.routeId }
            : hit.kind === 'route_vertex'
            ? { kind: 'route', id: hit.candidate.routeId }
            : hit.kind === 'terrain_vertex' ||
              hit.kind === 'terrain_midpoint' ||
              hit.kind === 'transform_handle'
            ? { kind: 'terrain', id: hit.candidate.featureId }
            : hit.kind === 'route'
            ? { kind: 'route', id: hit.candidate.route.id }
            : hit.kind === 'location'
            ? { kind: 'location', id: hit.candidate.location.id }
            : hit.kind === 'terrain'
            ? { kind: 'terrain', id: hit.candidate.feature.id }
            : hit.kind === 'placement'
            ? { kind: 'placement', id: hit.candidate.placement.id }
            : { kind: 'trade_route', id: hit.candidate.route.id };

        if (additive) {
          onSelectionChange(toggleMapObjectRef(selection, hitRef));
          return;
        }

        // Clicking a midpoint inserts a new vertex and immediately begins dragging it!
        if (hit.kind === 'terrain_midpoint') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const mid = hit.candidate;
          const feature = terrainFeaturesRef.current.find((f) => f.id === mid.featureId);
          if (feature) {
            if (mid.subType === 'points' && feature.points) {
              const newPoints = [...feature.points];
              newPoints.splice(mid.insertIndex, 0, mid.point);
              onUpdateTerrain(feature.id, { points: newPoints });
            } else if (mid.subType === 'polygon' && feature.polygon) {
              const newPolygon = [...feature.polygon];
              newPolygon.splice(mid.insertIndex, 0, mid.point);
              onUpdateTerrain(feature.id, { polygon: newPolygon });
            }

            const nodeData: DraggedNodeData = {
              type: 'terrain_vertex',
              id: mid.featureId,
              index: mid.insertIndex,
              subType: mid.subType,
              startPoint: mid.point,
            };
            startDraggingNode(nodeData, mid.point);
            selectVertex({ featureId: mid.featureId, index: mid.insertIndex, subType: mid.subType });
            return;
          }
        }

        // A transform handle (scale / rotate) scales or spins the entire feature.
        if (hit.kind === 'transform_handle') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const th = hit.candidate;
          const nodeData: DraggedNodeData = {
            type: 'transform_handle',
            id: th.featureId,
            handleType: th.handleType,
            originBox: th.box,
            startPoint: th.point,
          };
          startDraggingNode(nodeData, th.point);
          return;
        }

        // A terrain vertex is an edit handle: select the owning terrain, then drag that vertex.
        if (hit.kind === 'terrain_vertex') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const vertex = hit.candidate;
          const nodeData: DraggedNodeData = {
            type: 'terrain_vertex',
            id: vertex.featureId,
            index: vertex.index,
            subType: vertex.subType,
            startPoint: vertex.point,
          };
          startDraggingNode(nodeData, vertex.point);
          selectVertex({ featureId: vertex.featureId, index: vertex.index, subType: vertex.subType });
          return;
        }

        // A road vertex is an edit handle: select the owning road, then drag
        // only that vertex. The same gesture works for caravan waypoints.
        if (hit.kind === 'route_vertex') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const vertex = hit.candidate;
          const nodeData: DraggedNodeData = {
            type: 'route_vertex',
            id: hit.id,
            routeId: vertex.routeId,
            index: vertex.index,
            startPoint: vertex.point,
          };
          startDraggingNode(nodeData, vertex.point);
          return;
        }

        // A waypoint is an edit handle, not a selection member: select the
        // owning route, then drag only that vertex.
        if (hit.kind === 'waypoint') {
          const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
          if (!alreadySelected) onSelectionChange([hitRef]);

          const wpData = hit.candidate;
          const nodeData: DraggedNodeData = {
            type: 'waypoint',
            id: hit.id,
            routeId: wpData.routeId,
            index: wpData.index,
            startPoint: wpData.point,
          };
          startDraggingNode(nodeData, wpData.point);
          return;
        }

        const alreadySelected = selection.some((ref) => sameMapObjectRef(ref, hitRef));
        // Plan 23: a member of a multi-selection stays selected when pressed,
        // because dragging now moves the whole set — the design-tool behaviour.
        if (!alreadySelected) onSelectionChange([hitRef]);

        const dragRefs = alreadySelected ? selection : [hitRef];
        const hasMovableGeometry = dragRefs.some((ref) => {
          if (ref.kind === 'route') {
            const route = mapRoutesRef.current.find((item) => item.id === ref.id);
            return Boolean(
              route &&
                ((route.path?.length ?? 0) > 0 ||
                  (!route.origin.ref && !route.destination.ref))
            );
          }
          if (ref.kind !== 'trade_route') return true;
          const route = (worldBible.tradeRoutes ?? []).find((r) => r.id === ref.id);
          return Boolean(route?.waypoints?.length);
        });
        // A route with no waypoints has nothing of its own to move (its ends
        // are towns). Leave it selected without starting a dead drag.
        if (!hasMovableGeometry) return;

        // No preventDefault: pressing the map should blur a focused Inspector
        // field so arrow-key nudges reach the map again.
        setSelectionDragState({
          refs: dragRefs,
          origin: worldPoint,
          delta: { x: 0, y: 0 },
          moved: false,
        });
        return;
      }

      // Empty parchment: begin a rubber band. A press-and-release without
      // movement clears the selection when it ends.
      clearActiveVertex();
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      setMarqueeState({
        x0: e.clientX - rect.left,
        y0: e.clientY - rect.top,
        x1: e.clientX - rect.left,
        y1: e.clientY - rect.top,
        additive,
        base: additive ? selection : [],
      });
    },
    [
      clearActiveVertex,
      containerRef,
      engineRef,
      mapRoutesRef,
      onSelectionChange,
      onUpdateTerrain,
      selectVertex,
      selection,
      setMarqueeState,
      setSelectionDragState,
      settings.visibleLayers,
      startDraggingNode,
      terrainFeaturesRef,
      worldBible.tradeRoutes,
    ]
  );

  /**
   * Finalizes a group move translation upon mouse release.
   */
  const commitSelectionDragEnd = useCallback(
    (move: SelectionDragState | null) => {
      if (!move) return;
      setSelectionDragState(null);
      if (move.moved) {
        const dx = Math.round(move.delta.x);
        const dy = Math.round(move.delta.y);
        if (dx !== 0 || dy !== 0) onMoveSelection(move.refs, dx, dy);
      }
    },
    [onMoveSelection, setSelectionDragState]
  );

  /**
   * Finalizes a marquee selection band upon mouse release.
   */
  const commitMarqueeEnd = useCallback(
    (band: MarqueeState | null) => {
      if (!band) return;
      setMarqueeState(null);
      const moved =
        Math.abs(band.x1 - band.x0) > MARQUEE_THRESHOLD_PX ||
        Math.abs(band.y1 - band.y0) > MARQUEE_THRESHOLD_PX;

      if (!moved) {
        // A plain click on empty parchment clears; Shift/Ctrl-click keeps it.
        if (!band.additive) onSelectionChange([]);
      } else {
        const topLeft = screenToWorld(
          Math.min(band.x0, band.x1),
          Math.min(band.y0, band.y1),
          pan,
          zoom
        );
        const bottomRight = screenToWorld(
          Math.max(band.x0, band.x1),
          Math.max(band.y0, band.y1),
          pan,
          zoom
        );
        const bandMapData = worldBible.mapData ?? worldBible.ontology?.mapData;
        const hits = marqueeSelectRefs(
          {
            locations: worldBible.locations,
            tradeRoutes: worldBible.tradeRoutes,
            mapRoutes: bandMapData?.routes,
            terrainFeatures: normalizeLandWaterFeatures(
              bandMapData?.terrainFeatures ?? []
            ),
            placements: bandMapData?.placements,
            placeCategories: worldBible.ontology?.placeCategories,
          },
          {
            minX: topLeft.x,
            minY: topLeft.y,
            maxX: bottomRight.x,
            maxY: bottomRight.y,
          },
          settings
        );
        onSelectionChange(band.additive ? mergeMapObjectRefs(band.base, hits) : hits);
      }
    },
    [
      onSelectionChange,
      pan,
      setMarqueeState,
      settings,
      worldBible.locations,
      worldBible.mapData,
      worldBible.ontology?.mapData,
      worldBible.ontology?.placeCategories,
      worldBible.tradeRoutes,
      zoom,
    ]
  );

  return {
    handleSelectMouseDown,
    commitSelectionDragEnd,
    commitMarqueeEnd,
  };
}
