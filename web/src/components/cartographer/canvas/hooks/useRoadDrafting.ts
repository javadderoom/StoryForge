import { useCallback, useEffect, useRef } from 'react';
import type {
  MapPoint,
  MapRoute,
  MapRouteEndpoint,
  WorldBible,
} from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import type { PixiCartographerEngine } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import {
  createMapRoute,
  resolveRouteEndpointPoint,
  simplifyRoutePath,
  snapRouteEndpoint,
  type MapRouteSource,
} from '@/lib/engines/world/mapRoutes';
import { normalizeLandWaterFeatures } from '@/lib/engines/world/landSculpt/waterFeatures';
import type { CartographerTool } from '../../CartographerHeader';

export interface RouteSnapTarget {
  endpoint: MapRouteEndpoint;
  point: MapPoint;
  label?: string;
}

export interface RouteDraftState {
  origin: MapRouteEndpoint;
  path: MapPoint[];
  press: { start: MapPoint; moved: boolean } | null;
  justStarted: boolean;
}

export interface UseRoadDraftingOptions {
  activeTool: CartographerTool;
  worldBible: WorldBible;
  isPersian: boolean;
  zoom: number;
  engineRef: React.RefObject<PixiCartographerEngine | null>;
  setDraftPoints: React.Dispatch<React.SetStateAction<MapPoint[]>>;
  onAddRoute: (route: MapRoute) => void;
  onSelectionChange: (refs: MapObjectRef[]) => void;
}

export function useRoadDrafting({
  activeTool,
  worldBible,
  isPersian,
  zoom,
  engineRef,
  setDraftPoints,
  onAddRoute,
  onSelectionChange,
}: UseRoadDraftingOptions) {
  const routeDraftRef = useRef<RouteDraftState | null>(null);
  const routeSnapRef = useRef<RouteSnapTarget | null>(null);
  const routePointerRef = useRef<MapPoint | null>(null);

  const getRouteSource = useCallback((): MapRouteSource => {
    const data = worldBible.mapData ?? worldBible.ontology?.mapData;
    return {
      locations: worldBible.locations,
      terrainFeatures: normalizeLandWaterFeatures(data?.terrainFeatures ?? []),
      placements: data?.placements,
      placeCategories: worldBible.ontology?.placeCategories,
    };
  }, [
    worldBible.locations,
    worldBible.mapData,
    worldBible.ontology?.mapData,
    worldBible.ontology?.placeCategories,
  ]);

  const snapRouteAt = useCallback(
    (point: MapPoint): RouteSnapTarget | null => {
      const snap = snapRouteEndpoint(point, getRouteSource());
      return snap
        ? { endpoint: snap.endpoint, point: snap.endpoint.fallback, label: snap.label }
        : null;
    },
    [getRouteSource]
  );

  const updateRoutePreview = useCallback(
    (draft: RouteDraftState, cursor: MapPoint, snap: RouteSnapTarget | null) => {
      const origin = resolveRouteEndpointPoint(draft.origin, getRouteSource()).point;
      const points = [origin, ...draft.path, snap?.point ?? cursor];
      setDraftPoints(points);
      engineRef.current?.renderRouteSnapPreview(snap?.point ?? null);
    },
    [engineRef, getRouteSource, setDraftPoints]
  );

  const cancelRouteDraft = useCallback(() => {
    routeDraftRef.current = null;
    routeSnapRef.current = null;
    routePointerRef.current = null;
    setDraftPoints([]);
    engineRef.current?.renderRouteSnapPreview(null);
  }, [engineRef, setDraftPoints]);

  const finishRouteDraft = useCallback(
    (endPoint: MapPoint, destinationEndpoint?: MapRouteEndpoint) => {
      const draft = routeDraftRef.current;
      if (!draft) return;

      const source = getRouteSource();
      const originPoint = resolveRouteEndpointPoint(draft.origin, source).point;
      const destination = destinationEndpoint ?? { fallback: endPoint };

      if (
        !destinationEndpoint &&
        draft.path.length === 0 &&
        Math.hypot(endPoint.x - originPoint.x, endPoint.y - originPoint.y) < 2
      ) {
        cancelRouteDraft();
        return;
      }

      const path = simplifyRoutePath(draft.path, 1.5).filter(
        (point) =>
          Math.hypot(point.x - originPoint.x, point.y - originPoint.y) > 0.75
      );

      const route = createMapRoute({
        id: `road_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
        origin: draft.origin,
        destination,
        path,
        isPersian,
        source,
      });

      onAddRoute(route);
      onSelectionChange([{ kind: 'route', id: route.id }]);
      routeDraftRef.current = null;
      routeSnapRef.current = null;
      routePointerRef.current = null;
      setDraftPoints([]);
      engineRef.current?.renderRouteSnapPreview(null);
    },
    [
      cancelRouteDraft,
      engineRef,
      getRouteSource,
      isPersian,
      onAddRoute,
      onSelectionChange,
      setDraftPoints,
    ]
  );

  useEffect(() => {
    if (activeTool === 'draw_route') return;
    if (routeDraftRef.current) cancelRouteDraft();
    engineRef.current?.renderRouteSnapPreview(null);
  }, [activeTool, cancelRouteDraft, engineRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const draft = routeDraftRef.current;
      if (!draft) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRouteDraft();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const cursor = routePointerRef.current;
        if (!cursor) return;
        const snap = snapRouteAt(cursor);
        finishRouteDraft(cursor, snap?.endpoint);
        return;
      }
      if (event.key === 'Backspace' && draft.path.length > 0) {
        event.preventDefault();
        draft.path = draft.path.slice(0, -1);
        const cursor = routePointerRef.current;
        if (cursor) updateRoutePreview(draft, cursor, routeSnapRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelRouteDraft, finishRouteDraft, snapRouteAt, updateRoutePreview]);

  const handleRoadMouseDown = (worldPoint: MapPoint) => {
    routePointerRef.current = worldPoint;
    const snap = snapRouteAt(worldPoint);
    routeSnapRef.current = snap;
    const draft = routeDraftRef.current;

    if (!draft) {
      const nextDraft: RouteDraftState = {
        origin: snap?.endpoint ?? { fallback: worldPoint },
        path: [],
        press: { start: worldPoint, moved: false },
        justStarted: true,
      };
      routeDraftRef.current = nextDraft;
      updateRoutePreview(nextDraft, worldPoint, snap);
      return;
    }

    draft.press = { start: worldPoint, moved: false };
    draft.justStarted = false;
    updateRoutePreview(draft, worldPoint, snap);
  };

  const handleRoadMouseMove = (worldPoint: MapPoint) => {
    routePointerRef.current = worldPoint;
    const snap = snapRouteAt(worldPoint);
    routeSnapRef.current = snap;
    const draft = routeDraftRef.current;

    if (draft) {
      if (draft.press) {
        const moved =
          draft.press.moved ||
          Math.hypot(
            worldPoint.x - draft.press.start.x,
            worldPoint.y - draft.press.start.y
          ) *
            zoom >
            3;
        if (moved) {
          draft.press.moved = true;
          const origin = resolveRouteEndpointPoint(draft.origin, getRouteSource()).point;
          const last = draft.path[draft.path.length - 1] ?? origin;
          const minStep = Math.max(1, 2 / zoom);
          if (Math.hypot(worldPoint.x - last.x, worldPoint.y - last.y) >= minStep) {
            draft.path.push(worldPoint);
          }
        }
      }
      updateRoutePreview(draft, worldPoint, snap);
    } else {
      engineRef.current?.renderRouteSnapPreview(snap?.point ?? null);
    }
  };

  const handleRoadMouseUp = () => {
    const routeDraft = routeDraftRef.current;
    if (routeDraft && routeDraft.press) {
      const press = routeDraft.press;
      routeDraft.press = null;
      const cursor = routePointerRef.current ?? press.start;
      const snap = routeSnapRef.current;
      const originPoint = resolveRouteEndpointPoint(
        routeDraft.origin,
        getRouteSource()
      ).point;

      if (routeDraft.justStarted && !press.moved) {
        routeDraft.justStarted = false;
      } else if (press.moved) {
        finishRouteDraft(cursor, snap?.endpoint);
      } else if (
        snap &&
        Math.hypot(snap.point.x - originPoint.x, snap.point.y - originPoint.y) > 2
      ) {
        finishRouteDraft(snap.point, snap.endpoint);
      } else {
        routeDraft.path.push(press.start);
        updateRoutePreview(routeDraft, cursor, snap);
      }
    }
  };

  return {
    routeDraftRef,
    routeSnapRef,
    routePointerRef,
    getRouteSource,
    snapRouteAt,
    updateRoutePreview,
    cancelRouteDraft,
    finishRouteDraft,
    handleRoadMouseDown,
    handleRoadMouseMove,
    handleRoadMouseUp,
  };
}
