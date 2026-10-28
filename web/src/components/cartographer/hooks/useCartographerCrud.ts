import { useCallback } from 'react';
import type {
  WorldLocation,
  WorldTradeRoute,
  MapRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  WorldCreature,
  NPCDossier,
  WorldArtifact,
  TimelineEvent,
  WorldMapData,
  CustomPlaceCategory,
  StoryManifest,
} from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import { detachRoutesFromRef } from '@/lib/engines/world/mapRoutes';
import { notify } from '@/lib/notify';

export type UpdateMapData = (updater: (prev: WorldMapData | undefined) => WorldMapData) => void;

export interface UseCartographerCrudOptions {
  story: StoryManifest;
  mapData: WorldMapData;
  placeCategories: CustomPlaceCategory[];
  isPersian: boolean;
  commit: (label: string, action: () => void) => void;
  updateMapData: UpdateMapData;
  removeFromSelection: (refs: MapObjectRef[]) => void;
  setSelection: (refs: MapObjectRef[]) => void;
  addLocation: (loc: WorldLocation) => void;
  editLocation: (id: string, updated: Partial<WorldLocation>) => void;
  deleteLocation: (id: string) => void;
  addTradeRoute: (route: WorldTradeRoute) => void;
  editTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  deleteTradeRoute: (id: string) => void;
  addCreature: (creature: WorldCreature) => void;
  editCreature: (id: string, updated: Partial<WorldCreature>) => void;
  deleteCreature: (id: string) => void;
  addNpc: (npc: NPCDossier) => void;
  editNpc: (id: string, updated: Partial<NPCDossier>) => void;
  deleteNpc: (id: string) => void;
  addArtifact: (artifact: WorldArtifact) => void;
  editArtifact: (id: string, updated: Partial<WorldArtifact>) => void;
  deleteArtifact: (id: string) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  editTimelineEvent: (id: string, updated: Partial<TimelineEvent>) => void;
  deleteTimelineEvent: (id: string) => void;
}

export function useCartographerCrud({
  story,
  mapData,
  placeCategories,
  isPersian,
  commit,
  updateMapData,
  removeFromSelection,
  setSelection,
  addLocation,
  editLocation,
  deleteLocation,
  addTradeRoute,
  editTradeRoute,
  deleteTradeRoute,
  addCreature,
  editCreature,
  deleteCreature,
  addNpc,
  editNpc,
  deleteNpc,
  addArtifact,
  editArtifact,
  deleteArtifact,
  addTimelineEvent,
  editTimelineEvent,
  deleteTimelineEvent,
}: UseCartographerCrudOptions) {
  // Terrain CRUD
  const handleAddTerrain = useCallback(
    (feature: MapTerrainFeature) => {
      commit('Add terrain', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: [...current.terrainFeatures, feature],
          };
        });
      });
      notify.success(isPersian ? 'عارضه طبیعی به نقشه افزوده شد' : 'Terrain feature added');
    },
    [commit, mapData, updateMapData, isPersian]
  );

  const handleUpdateTerrain = useCallback(
    (id: string, updated: Partial<MapTerrainFeature>) => {
      commit('Edit terrain', () => {
        let targetLocationId: string | undefined;
        updateMapData((prev) => {
          const current = prev || mapData;
          const target = current.terrainFeatures.find((f) => f.id === id);
          targetLocationId = updated.locationId !== undefined ? updated.locationId : target?.locationId;
          return {
            ...current,
            terrainFeatures: current.terrainFeatures.map((f) => (f.id === id ? { ...f, ...updated } : f)),
          };
        });
        if (targetLocationId) {
          const locPatch: Partial<WorldLocation> = {};
          if (updated.name !== undefined) locPatch.name = updated.name;
          if (updated.locked !== undefined) locPatch.locked = updated.locked;
          if (updated.visible !== undefined) locPatch.visible = updated.visible;
          if (Object.keys(locPatch).length > 0) {
            editLocation(targetLocationId, locPatch);
          }
        }
      });
    },
    [commit, mapData, updateMapData, editLocation]
  );

  const handleDeleteTerrain = useCallback(
    (id: string) => {
      commit('Delete terrain', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: current.terrainFeatures.filter((f) => f.id !== id),
            routes: detachRoutesFromRef(
              current.routes ?? [],
              { kind: 'terrain', id },
              {
                locations: story.worldBible.locations,
                terrainFeatures: current.terrainFeatures,
                placements: current.placements,
                placeCategories,
              }
            ),
          };
        });
        removeFromSelection([{ kind: 'terrain', id }]);
      });
      notify.info(isPersian ? 'عارضه طبیعی حذف شد' : 'Terrain feature deleted');
    },
    [commit, mapData, updateMapData, story.worldBible.locations, placeCategories, removeFromSelection, isPersian]
  );

  const handleReplaceTerrain = useCallback(
    (features: MapTerrainFeature[]) => {
      commit('Sculpt terrain', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: features,
          };
        });
      });
    },
    [commit, mapData, updateMapData]
  );

  // Location Handlers
  const handleAddLocation = useCallback(
    (loc: WorldLocation) => {
      commit('Add location', () => addLocation(loc));
    },
    [commit, addLocation]
  );

  const handleUpdateLocation = useCallback(
    (id: string, updated: Partial<WorldLocation>) => {
      commit(updated.coordinates ? 'Move pin' : 'Edit location', () => {
        editLocation(id, updated);
        const terrainPatch: Partial<MapTerrainFeature> = {};
        if (updated.name !== undefined) terrainPatch.name = updated.name;
        if (updated.locked !== undefined) terrainPatch.locked = updated.locked;
        if (updated.visible !== undefined) terrainPatch.visible = updated.visible;

        if (Object.keys(terrainPatch).length > 0) {
          updateMapData((prev) => {
            const current = prev || mapData;
            const hasLinked = current.terrainFeatures.some((f) => f.locationId === id);
            if (!hasLinked) return current;
            return {
              ...current,
              terrainFeatures: current.terrainFeatures.map((f) =>
                f.locationId === id ? { ...f, ...terrainPatch } : f
              ),
            };
          });
        }
      });
    },
    [commit, editLocation, updateMapData, mapData]
  );

  const handleDeleteLocation = useCallback(
    (id: string) => {
      commit('Delete location', () => {
        deleteLocation(id);
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            routes: detachRoutesFromRef(
              current.routes ?? [],
              { kind: 'location', id },
              {
                locations: story.worldBible.locations,
                terrainFeatures: current.terrainFeatures,
                placements: current.placements,
                placeCategories,
              }
            ),
          };
        });
        removeFromSelection([{ kind: 'location', id }]);
      });
    },
    [commit, deleteLocation, updateMapData, mapData, story.worldBible.locations, placeCategories, removeFromSelection]
  );

  // Trade Route Handlers
  const handleAddTradeRoute = useCallback(
    (route: WorldTradeRoute) => {
      commit('Add trade route', () => addTradeRoute(route));
    },
    [commit, addTradeRoute]
  );

  const handleUpdateTradeRoute = useCallback(
    (id: string, updated: Partial<WorldTradeRoute>) => {
      commit(updated.waypoints ? 'Move waypoint' : 'Edit trade route', () => {
        editTradeRoute(id, updated);
      });
    },
    [commit, editTradeRoute]
  );

  const handleDeleteTradeRoute = useCallback(
    (id: string) => {
      commit('Delete trade route', () => {
        deleteTradeRoute(id);
        removeFromSelection([{ kind: 'trade_route', id }]);
      });
    },
    [commit, deleteTradeRoute, removeFromSelection]
  );

  // Drawn Roads & Paths (Plan 25)
  const handleAddRoad = useCallback(
    (route: MapRoute) => {
      commit('Draw road', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            routes: [...(current.routes ?? []), route],
          };
        });
      });
      notify.success(isPersian ? 'جاده روی نقشه ترسیم شد' : 'Road added to the map');
    },
    [commit, updateMapData, mapData, isPersian]
  );

  const handleUpdateRoad = useCallback(
    (id: string, updated: Partial<MapRoute>) => {
      commit('Edit road', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            routes: (current.routes ?? []).map((route) =>
              route.id === id ? { ...route, ...updated } : route
            ),
          };
        });
      });
    },
    [commit, updateMapData, mapData]
  );

  const handleDeleteRoad = useCallback(
    (id: string) => {
      commit('Delete road', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            routes: (current.routes ?? []).filter((route) => route.id !== id),
          };
        });
        removeFromSelection([{ kind: 'route', id }]);
      });
    },
    [commit, updateMapData, mapData, removeFromSelection]
  );

  const handleToggleRoadVisibility = useCallback(
    (id: string) => {
      const route = (mapData.routes || []).find((item) => item.id === id);
      if (!route) return;
      handleUpdateRoad(id, { visible: route.visible === false });
    },
    [handleUpdateRoad, mapData.routes]
  );

  const handleToggleRoadLock = useCallback(
    (id: string) => {
      const route = (mapData.routes || []).find((item) => item.id === id);
      if (!route) return;
      handleUpdateRoad(id, { locked: !(route.locked === true) });
    },
    [handleUpdateRoad, mapData.routes]
  );

  // Placements Handlers
  const handleAddPlacement = useCallback(
    (placement: MapEntityPlacement) => {
      commit('Pin entity', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: [...current.placements, placement],
          };
        });
      });
      notify.success(isPersian ? 'سنجاق روی نقشه ثبت شد' : 'Entity pinned to map');
    },
    [commit, updateMapData, mapData, isPersian]
  );

  const handleDeletePlacement = useCallback(
    (id: string) => {
      commit('Remove pin', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: current.placements.filter((p) => p.id !== id),
            routes: detachRoutesFromRef(
              current.routes ?? [],
              { kind: 'placement', id },
              {
                locations: story.worldBible.locations,
                terrainFeatures: current.terrainFeatures,
                placements: current.placements,
                placeCategories,
              }
            ),
          };
        });
        removeFromSelection([{ kind: 'placement', id }]);
      });
    },
    [commit, updateMapData, mapData, story.worldBible.locations, placeCategories, removeFromSelection]
  );

  // Bestiary / Creature Handlers
  const handleUpdateCreature = useCallback(
    (id: string, updated: Partial<WorldCreature>) => {
      commit('Edit creature', () => {
        editCreature(id, updated);
      });
    },
    [commit, editCreature]
  );

  const handleDeleteCreature = useCallback(
    (id: string) => {
      commit('Delete creature', () => {
        deleteCreature(id);
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: (current.placements || []).filter((p) => p.entityId !== id),
          };
        });
        removeFromSelection([{ kind: 'placement', id }]);
      });
    },
    [commit, deleteCreature, updateMapData, mapData, removeFromSelection]
  );

  // NPC Handlers
  const handleUpdateNpc = useCallback(
    (id: string, updated: Partial<NPCDossier>) => {
      commit('Edit NPC', () => {
        editNpc(id, updated);
      });
    },
    [commit, editNpc]
  );

  const handleDeleteNpc = useCallback(
    (id: string) => {
      commit('Delete NPC', () => {
        deleteNpc(id);
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: (current.placements || []).filter((p) => p.entityId !== id),
          };
        });
        removeFromSelection([{ kind: 'placement', id }]);
      });
    },
    [commit, deleteNpc, updateMapData, mapData, removeFromSelection]
  );

  // Artifact Handlers
  const handleUpdateArtifact = useCallback(
    (id: string, updated: Partial<WorldArtifact>) => {
      commit('Edit artifact', () => {
        editArtifact(id, updated);
      });
    },
    [commit, editArtifact]
  );

  const handleDeleteArtifact = useCallback(
    (id: string) => {
      commit('Delete artifact', () => {
        deleteArtifact(id);
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: (current.placements || []).filter((p) => p.entityId !== id),
          };
        });
        removeFromSelection([{ kind: 'placement', id }]);
      });
    },
    [commit, deleteArtifact, updateMapData, mapData, removeFromSelection]
  );

  // Timeline Event Handlers
  const handleUpdateTimelineEvent = useCallback(
    (id: string, updated: Partial<TimelineEvent>) => {
      commit('Edit timeline event', () => {
        editTimelineEvent(id, updated);
      });
    },
    [commit, editTimelineEvent]
  );

  const handleDeleteTimelineEvent = useCallback(
    (id: string) => {
      commit('Delete timeline event', () => {
        deleteTimelineEvent(id);
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            placements: (current.placements || []).filter((p) => p.entityId !== id),
          };
        });
        removeFromSelection([{ kind: 'placement', id }]);
      });
    },
    [commit, deleteTimelineEvent, updateMapData, mapData, removeFromSelection]
  );

  const handleAddGeneratedElement = useCallback(
    (payload: {
      entityType: 'bestiary' | 'npc' | 'timeline' | 'artifact' | 'location';
      entity: unknown;
      placement: MapEntityPlacement;
    }) => {
      commit(`Spawn ${payload.entityType} with AI`, () => {
        if (payload.entityType === 'bestiary') {
          addCreature(payload.entity as WorldCreature);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'npc') {
          addNpc(payload.entity as NPCDossier);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'timeline') {
          addTimelineEvent(payload.entity as TimelineEvent);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'artifact') {
          addArtifact(payload.entity as WorldArtifact);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'location') {
          addLocation(payload.entity as WorldLocation);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        }
      });

      // Automatically select the newly spawned pin
      setSelection([{ kind: 'placement', id: payload.placement.id }]);
    },
    [
      commit,
      addCreature,
      addNpc,
      addTimelineEvent,
      addArtifact,
      addLocation,
      updateMapData,
      mapData,
      setSelection,
    ]
  );

  const handleDeleteObject = useCallback(
    (ref: { kind: string; id: string }) => {
      if (ref.kind === 'location') handleDeleteLocation(ref.id);
      else if (ref.kind === 'placement') handleDeletePlacement(ref.id);
      else if (ref.kind === 'terrain') handleDeleteTerrain(ref.id);
      else if (ref.kind === 'route') handleDeleteRoad(ref.id);
      else if (ref.kind === 'trade_route') handleDeleteTradeRoute(ref.id);
    },
    [handleDeleteLocation, handleDeletePlacement, handleDeleteTerrain, handleDeleteRoad, handleDeleteTradeRoute]
  );

  return {
    handleAddTerrain,
    handleUpdateTerrain,
    handleDeleteTerrain,
    handleReplaceTerrain,
    handleAddLocation,
    handleUpdateLocation,
    handleDeleteLocation,
    handleAddTradeRoute,
    handleUpdateTradeRoute,
    handleDeleteTradeRoute,
    handleAddRoad,
    handleUpdateRoad,
    handleDeleteRoad,
    handleToggleRoadVisibility,
    handleToggleRoadLock,
    handleAddPlacement,
    handleDeletePlacement,
    handleUpdateCreature,
    handleDeleteCreature,
    handleUpdateNpc,
    handleDeleteNpc,
    handleUpdateArtifact,
    handleDeleteArtifact,
    handleUpdateTimelineEvent,
    handleDeleteTimelineEvent,
    handleAddGeneratedElement,
    handleDeleteObject,
  };
}
