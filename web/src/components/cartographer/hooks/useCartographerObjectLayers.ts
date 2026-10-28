import { useCallback } from 'react';
import type {
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  WorldMapData,
  WorldBible,
  CustomPlaceCategory,
  StoryManifest,
} from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import type { SelectedMapItem } from '../inspector/types';
import {
  reorderTerrainByZ,
  reorderPlacementByZ,
  terrainCenter,
} from '@/lib/engines/world/mapObjectOrder';
import { resolvePlaceMapAnchor } from '@/lib/engines/world/placeCategories';
import { resolveMapRoutePoints, routeMidpoint } from '@/lib/engines/world/mapRoutes';
import { notify } from '@/lib/notify';

export type UpdateMapData = (updater: (prev: WorldMapData | undefined) => WorldMapData) => void;

export interface UseCartographerObjectLayersOptions {
  story: StoryManifest;
  mapData: WorldMapData;
  isPersian: boolean;
  commit: (label: string, action: () => void) => void;
  updateMapData: UpdateMapData;
  updateWorldBible: (updater: (prev: WorldBible) => WorldBible) => void;
  editLocation: (id: string, updated: Partial<WorldLocation>) => void;
  handleUpdateLocation: (id: string, updated: Partial<WorldLocation>) => void;
  handleUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  setSelection: (refs: MapObjectRef[]) => void;
  placeCategories: CustomPlaceCategory[];
  setPan: (pan: { x: number; y: number }) => void;
  zoom: number;
}

export function useCartographerObjectLayers({
  story,
  mapData,
  isPersian,
  commit,
  updateMapData,
  updateWorldBible,
  editLocation,
  handleUpdateLocation,
  handleUpdateTradeRoute,
  setSelection,
  placeCategories,
  setPan,
  zoom,
}: UseCartographerObjectLayersOptions) {
  const handleSetTerrainState = useCallback(
    (id: string, patch: Partial<MapTerrainFeature>, label: string) => {
      commit(label, () => {
        let linkedLocId: string | undefined;
        updateMapData((prev) => {
          const current = prev || mapData;
          const target = current.terrainFeatures.find((f) => f.id === id);
          linkedLocId = target?.locationId;
          return {
            ...current,
            terrainFeatures: current.terrainFeatures.map((f) =>
              f.id === id ? { ...f, ...patch } : f
            ),
          };
        });
        if (linkedLocId) {
          const locPatch: Partial<WorldLocation> = {};
          if (patch.locked !== undefined) locPatch.locked = patch.locked;
          if (patch.visible !== undefined) locPatch.visible = patch.visible;
          if (Object.keys(locPatch).length > 0) {
            editLocation(linkedLocId, locPatch);
          }
        }
      });
    },
    [commit, mapData, updateMapData, editLocation]
  );

  const handleSetPlacementState = useCallback(
    (id: string, patch: Partial<MapEntityPlacement>, label: string) => {
      commit(label, () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: current.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          };
        });
      });
    },
    [commit, mapData, updateMapData]
  );

  /**
   * Sets one visibility state across many elements as a single action:
   * one undo step and one notification.
   */
  const handleSetElementsVisibility = useCallback(
    (
      targets: Array<{ kind: 'terrain' | 'placement' | 'location' | 'route' | 'road'; id: string }>,
      visible: boolean
    ) => {
      if (targets.length === 0) return;

      const terrainIds = new Set(targets.filter((t) => t.kind === 'terrain').map((t) => t.id));
      const placementIds = new Set(targets.filter((t) => t.kind === 'placement').map((t) => t.id));
      const roadIds = new Set(targets.filter((t) => t.kind === 'road').map((t) => t.id));
      const locationIds = new Set(targets.filter((t) => t.kind === 'location').map((t) => t.id));
      const tradeRouteIds = new Set(targets.filter((t) => t.kind === 'route').map((t) => t.id));

      const touchesMapData = terrainIds.size + placementIds.size + roadIds.size > 0;
      const touchesWorldBible = locationIds.size + tradeRouteIds.size > 0;
      if (!touchesMapData && !touchesWorldBible) return;

      commit(visible ? 'Show elements' : 'Hide elements', () => {
        if (touchesMapData) {
          updateMapData((prev) => {
            const current = prev || mapData;
            return {
              ...current,
              terrainFeatures: current.terrainFeatures.map((f) =>
                terrainIds.has(f.id) ? { ...f, visible } : f
              ),
              placements: current.placements.map((p) =>
                placementIds.has(p.id) ? { ...p, visible } : p
              ),
              routes: (current.routes ?? []).map((r) =>
                roadIds.has(r.id) ? { ...r, visible } : r
              ),
            };
          });
        }
        if (touchesWorldBible) {
          updateWorldBible((prev) => ({
            ...prev,
            locations: (prev.locations ?? []).map((l) =>
              locationIds.has(l.id) ? { ...l, visible } : l
            ),
            tradeRoutes: (prev.tradeRoutes ?? []).map((r) =>
              tradeRouteIds.has(r.id) ? { ...r, visible } : r
            ),
          }));
        }
      });

      notify.info(
        isPersian
          ? `${targets.length} عنصر ${visible ? 'نمایش' : 'پنهان'} شد`
          : `${targets.length} element${targets.length === 1 ? '' : 's'} ${
              visible ? 'shown' : 'hidden'
            }`
      );
    },
    [commit, mapData, updateMapData, updateWorldBible, isPersian]
  );

  const handleToggleTerrainVisibility = useCallback(
    (id: string) => {
      const feature = (mapData.terrainFeatures || []).find((f) => f.id === id);
      if (!feature) return;
      handleSetTerrainState(id, { visible: feature.visible === false }, 'Toggle layer visibility');
    },
    [handleSetTerrainState, mapData]
  );

  const handleToggleTerrainLock = useCallback(
    (id: string) => {
      const feature = (mapData.terrainFeatures || []).find((f) => f.id === id);
      if (!feature) return;
      handleSetTerrainState(id, { locked: !(feature.locked === true) }, 'Toggle layer lock');
    },
    [handleSetTerrainState, mapData]
  );

  const handleTogglePlacementVisibility = useCallback(
    (id: string) => {
      const pin = (mapData.placements || []).find((p) => p.id === id);
      if (!pin) return;
      handleSetPlacementState(id, { visible: pin.visible === false }, 'Toggle pin visibility');
    },
    [handleSetPlacementState, mapData]
  );

  const handleTogglePlacementLock = useCallback(
    (id: string) => {
      const pin = (mapData.placements || []).find((p) => p.id === id);
      if (!pin) return;
      handleSetPlacementState(id, { locked: !(pin.locked === true) }, 'Toggle pin lock');
    },
    [handleSetPlacementState, mapData]
  );

  const handleToggleLocationVisibility = useCallback(
    (id: string) => {
      const loc = (story.worldBible.locations || []).find((l) => l.id === id);
      if (!loc) return;
      handleUpdateLocation(id, { visible: loc.visible === false });
    },
    [handleUpdateLocation, story.worldBible.locations]
  );

  const handleToggleLocationLock = useCallback(
    (id: string) => {
      const loc = (story.worldBible.locations || []).find((l) => l.id === id);
      if (!loc) return;
      handleUpdateLocation(id, { locked: !(loc.locked === true) });
    },
    [handleUpdateLocation, story.worldBible.locations]
  );

  const handleToggleRouteVisibility = useCallback(
    (id: string) => {
      const route = (story.worldBible.tradeRoutes || []).find((r) => r.id === id);
      if (!route) return;
      handleUpdateTradeRoute(id, { visible: route.visible === false });
    },
    [handleUpdateTradeRoute, story.worldBible.tradeRoutes]
  );

  const handleToggleRouteLock = useCallback(
    (id: string) => {
      const route = (story.worldBible.tradeRoutes || []).find((r) => r.id === id);
      if (!route) return;
      handleUpdateTradeRoute(id, { locked: !(route.locked === true) });
    },
    [handleUpdateTradeRoute, story.worldBible.tradeRoutes]
  );

  const handleReorderTerrain = useCallback(
    (id: string, direction: 'forward' | 'backward') => {
      commit(direction === 'forward' ? 'Bring layer forward' : 'Send layer backward', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: reorderTerrainByZ(current.terrainFeatures, id, direction),
          };
        });
      });
    },
    [commit, mapData, updateMapData]
  );

  const handleReorderPlacement = useCallback(
    (id: string, direction: 'forward' | 'backward') => {
      commit(direction === 'forward' ? 'Bring pin forward' : 'Send pin backward', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: reorderPlacementByZ(current.placements, id, direction),
          };
        });
      });
    },
    [commit, mapData, updateMapData]
  );

  const handleRenameTerrain = useCallback(
    (id: string, name: string) => {
      handleSetTerrainState(id, { name }, 'Rename feature');
    },
    [handleSetTerrainState]
  );

  const handleRenamePlacement = useCallback(
    (id: string, label: string) => {
      handleSetPlacementState(id, { customLabel: label }, 'Rename pin');
    },
    [handleSetPlacementState]
  );

  /** Selects a map object from the object list and centres the camera on it. */
  const handleSelectMapObject = useCallback((item: SelectedMapItem) => {
    if (!item) return;

    if (item.type === 'multiple') {
      setSelection(item.members.map((m) => ({ kind: m.type, id: m.data.id })));
      return;
    }

    if (item.type === 'group') {
      setSelection(item.data.memberRefs);
      return;
    }

    setSelection([{ kind: item.type, id: item.data.id }]);

    const point =
      item.type === 'terrain'
        ? terrainCenter(item.data)
        : item.type === 'location'
        ? resolvePlaceMapAnchor(item.data, mapData.terrainFeatures)
        : item.type === 'placement'
        ? { x: item.data.x, y: item.data.y }
        : item.type === 'route'
        ? routeMidpoint(
            resolveMapRoutePoints(item.data, {
              locations: story.worldBible.locations,
              terrainFeatures: mapData.terrainFeatures,
              placements: mapData.placements,
              placeCategories,
            }).points
          )
        : null;
    if (!point) return;

    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    setPan({
      x: screenW / 2 - point.x * zoom,
      y: screenH / 2 - point.y * zoom,
    });
  }, [setSelection, mapData.terrainFeatures, mapData.placements, story.worldBible.locations, placeCategories, setPan, zoom]);

  return {
    handleSetTerrainState,
    handleSetPlacementState,
    handleSetElementsVisibility,
    handleToggleTerrainVisibility,
    handleToggleTerrainLock,
    handleTogglePlacementVisibility,
    handleTogglePlacementLock,
    handleToggleLocationVisibility,
    handleToggleLocationLock,
    handleToggleRouteVisibility,
    handleToggleRouteLock,
    handleReorderTerrain,
    handleReorderPlacement,
    handleRenameTerrain,
    handleRenamePlacement,
    handleSelectMapObject,
  };
}
