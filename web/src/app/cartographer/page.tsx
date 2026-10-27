'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeOntology, useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  WorldMapData,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapRoute,
  WorldCreature,
  WorldArtifact,
  TimelineEvent,
  NPCDossier,
} from '@/lib/types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getOrInitializeWorldMapData,
  ensureLocationCoordinates,
} from '@/lib/engines/world/cartographerEngine';
import { clampZoom, calculateZoomPan } from '@/lib/engines/world/pixi/pixiMath';
import { CartographerHeader, CartographerTool } from '@/components/cartographer/CartographerHeader';
import { CartographerToolbar } from '@/components/cartographer/CartographerToolbar';
import { PixiCartographerCanvas } from '@/components/cartographer/PixiCartographerCanvas';
import { CartographerLayerPanel } from '@/components/cartographer/CartographerLayerPanel';
import { CartographerEntityPalette } from '@/components/cartographer/CartographerEntityPalette';
import { CartographerElementsPanel } from '@/components/cartographer/CartographerElementsPanel';
import {
  detachRoutesFromRef,
  resolveMapRoutePoints,
  routeMidpoint,
} from '@/lib/engines/world/mapRoutes';
import { CartographerInspector, SelectedMapItem } from '@/components/cartographer/CartographerInspector';
import { CartographerSelectionBar } from '@/components/cartographer/CartographerSelectionBar';
import { CartographerAiOracleModal } from '@/components/cartographer/CartographerAiOracleModal';
import { notify } from '@/lib/notify';
import { reorderPlacementByZ, reorderTerrainByZ, terrainCenter } from '@/lib/engines/world/mapObjectOrder';
import { resolvePlaceMapAnchor } from '@/lib/engines/world/placeCategories';
import { peekRedoLabel, peekUndoLabel } from '@/lib/engines/world/cartographerHistory';
import { useCartographerHistory } from '@/components/cartographer/hooks/useCartographerHistory';
import { useCartographerAutoFit } from '@/components/cartographer/hooks/useCartographerAutoFit';
import { useCartographerSelection } from '@/components/cartographer/hooks/useCartographerSelection';

export default function CartographerPage() {
  const router = useRouter();
  const {
    story,
    setSelectedStoryId,
    storiesList,
    selectedWorldId,
    worldsList,
    updateWorldBible,
    deleteWorld,
    addLocation,
    editLocation,
    deleteLocation,
    addTradeRoute,
    editTradeRoute,
    deleteTradeRoute,
    updateMapData,
    saveToServer,
    isSyncing,
    hasLocalDraft,
    isPersian,
    editNpc,
    deleteNpc,
    addNpc,
    addCreature,
    editCreature,
    deleteCreature,
    addTimelineEvent,
    editTimelineEvent,
    deleteTimelineEvent,
    addArtifact,
    editArtifact,
    deleteArtifact,
  } = useStudioStory();

  // Active tool and floating panel state.
  const [activeTool, setActiveTool] = useState<CartographerTool>('select');
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isElementsPanelOpen, setIsElementsPanelOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isAiOracleOpen, setIsAiOracleOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Viewport transform state.
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 80, y: 40 });

  // Ensure map data exists.
  const mapData: WorldMapData = useMemo(() => {
    return getOrInitializeWorldMapData(story.worldBible, isPersian);
  }, [story.worldBible, isPersian]);

  const mapSettings: WorldMapSettings = mapData.settings;
  const placeCategories = useMemo(
    () => normalizeOntology(story.worldBible.ontology, isPersian).placeCategories,
    [story.worldBible.ontology, isPersian]
  );

  const seedKey = selectedWorldId || story.worldId || story.worldBible.worldName || 'storyforge-world';

  const { history, commit, handleUndo, handleRedo } = useCartographerHistory({
    worldBible: story.worldBible,
    updateWorldBible,
    isPersian,
  });

  const { autoFitSnapshot, handleAutoFit, handleUndoAutoFit } = useCartographerAutoFit({
    worldBible: story.worldBible,
    seedKey,
    isPersian,
    commit,
    updateWorldBible,
  });

  const {
    selection,
    setSelection,
    selectedItems,
    selectedItem,
    removeFromSelection,
    handleDeleteSelection,
    handleMoveSelection,
    handleDuplicateSelection,
  } = useCartographerSelection({
    worldBible: story.worldBible,
    mapData,
    mapSettings,
    placeCategories,
    commit,
    updateMapData,
    updateWorldBible,
    isPersian,
    setActiveTool,
  });


  // Ensure initial locations have coordinates if unassigned
  useEffect(() => {
    const rawLocs = story.worldBible.locations || [];
    const needsCoordinates = rawLocs.some((l) => !l.coordinates || l.coordinates.x <= 0);
    if (needsCoordinates && rawLocs.length > 0) {
      const coordMap = new Map<string, { x: number; y: number }>();
      rawLocs.forEach((l) => {
        if (l.coordinates) coordMap.set(l.id, l.coordinates);
      });
      const resolved = ensureLocationCoordinates(rawLocs, coordMap);
      updateWorldBible((prev) => ({
        ...prev,
        locations: resolved,
      }));
    }
  }, [story.worldBible.locations, updateWorldBible]);

  // View Controls
  const handleZoomIn = () => {
    const newZoom = clampZoom(zoom * 1.2);
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight - 64;
      const newPan = calculateZoomPan(w / 2, h / 2, pan, zoom, newZoom);
      setZoom(newZoom);
      setPan(newPan);
    } else {
      setZoom(newZoom);
    }
  };
  const handleZoomOut = () => {
    const newZoom = clampZoom(zoom / 1.2);
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight - 64;
      const newPan = calculateZoomPan(w / 2, h / 2, pan, zoom, newZoom);
      setZoom(newZoom);
      setPan(newPan);
    } else {
      setZoom(newZoom);
    }
  };
  const handleResetView = () => {
    setZoom(0.85);
    setPan({ x: 80, y: 40 });
  };
  const handleFitView = () => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      const h = window.innerHeight - 64;
      const fitZoom = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT) * 0.95;
      setZoom(Math.max(0.3, fitZoom));
      setPan({
        x: (w - CANVAS_WIDTH * fitZoom) / 2,
        y: (h - CANVAS_HEIGHT * fitZoom) / 2,
      });
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Settings & Layers
  const handleUpdateSettings = (partial: Partial<WorldMapSettings>) => {
    updateMapData((prev) => ({
      ...(prev || mapData),
      settings: {
        ...((prev || mapData).settings),
        ...partial,
      },
    }));
  };

  // Terrain CRUD
  const handleAddTerrain = (feature: MapTerrainFeature) => {
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
  };

  const handleUpdateTerrain = (id: string, updated: Partial<MapTerrainFeature>) => {
    commit('Edit terrain', () => {
      updateMapData((prev) => {
        const current = prev || mapData;
        return {
          ...current,
          terrainFeatures: current.terrainFeatures.map((f) => (f.id === id ? { ...f, ...updated } : f)),
        };
      });
    });
  };

  const handleDeleteTerrain = (id: string) => {
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
  };

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
  const handleAddLocation = (loc: WorldLocation) => {
    commit('Add location', () => addLocation(loc));
  };

  const handleUpdateLocation = (id: string, updated: Partial<WorldLocation>) => {
    commit(updated.coordinates ? 'Move pin' : 'Edit location', () => {
      editLocation(id, updated);
    });
  };

  const handleDeleteLocation = (id: string) => {
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
  };

  const handleDeleteCurrentWorld = async () => {
    const worldId = selectedWorldId || story.worldId;
    if (!worldId) return;

    const world = worldsList.find((candidate) => candidate.id === worldId);
    const storyCount =
      world?.storyCount ??
      storiesList.filter(
        (candidate) =>
          (candidate as { worldId?: string }).worldId === worldId ||
          candidate.id === worldId
      ).length;
    const worldLabel = world?.name || story.worldBible.worldName;

    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف جهان' : 'Delete World',
      message:
        storyCount > 0
          ? isPersian
            ? `جهان «${worldLabel}» و ${storyCount} داستان داخل آن برای همیشه حذف شوند؟ این کار شامل انجیل جهان، نقشه و نشست‌های بازی است و قابل بازگشت نیست.`
            : `Permanently delete "${worldLabel}" and all ${storyCount} ${
                storyCount === 1 ? 'story' : 'stories'
              }? This deletes its world bible, map, and play sessions. It cannot be undone.`
          : isPersian
            ? `جهان خالی «${worldLabel}» برای همیشه حذف شود؟`
            : `Permanently delete the empty world "${worldLabel}"?`,
      confirmText: isPersian ? 'حذف جهان' : 'Delete World',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      await deleteWorld(worldId);
      router.push('/studio/stories');
    }
  };


  // Trade Route Handlers
  const handleAddTradeRoute = (route: WorldTradeRoute) => {
    commit('Add trade route', () => addTradeRoute(route));
  };

  const handleUpdateTradeRoute = (id: string, updated: Partial<WorldTradeRoute>) => {
    commit(updated.waypoints ? 'Move waypoint' : 'Edit trade route', () => {
      editTradeRoute(id, updated);
    });
  };

  const handleDeleteTradeRoute = (id: string) => {
    commit('Delete trade route', () => {
      deleteTradeRoute(id);
      removeFromSelection([{ kind: 'trade_route', id }]);
    });
  };

  // Drawn Roads & Paths (Plan 25)
  const handleAddRoad = (route: MapRoute) => {
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
  };

  const handleUpdateRoad = (id: string, updated: Partial<MapRoute>) => {
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
  };

  const handleDeleteRoad = (id: string) => {
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
  };

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
  const handleAddPlacement = (placement: MapEntityPlacement) => {
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
  };

  const handleDeletePlacement = (id: string) => {
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
  };

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
      entity: any;
      placement: MapEntityPlacement;
    }) => {
      commit(`Spawn ${payload.entityType} with AI`, () => {
        if (payload.entityType === 'bestiary') {
          addCreature(payload.entity);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'npc') {
          addNpc(payload.entity);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'timeline') {
          addTimelineEvent(payload.entity);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'artifact') {
          addArtifact(payload.entity);
          updateMapData((prev) => ({
            ...(prev || mapData),
            placements: [...(prev?.placements || mapData.placements || []), payload.placement],
          }));
        } else if (payload.entityType === 'location') {
          addLocation(payload.entity);
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

  // -----------------------------------------------------------------------
  // Plan 21 — per-object layer controls
  //
  // Every one of these goes through `commit()`, so each is a single undoable
  // step rather than a silent mutation of the world.
  // -----------------------------------------------------------------------
  const handleSetTerrainState = useCallback(
    (id: string, patch: Partial<MapTerrainFeature>, label: string) => {
      commit(label, () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: current.terrainFeatures.map((f) =>
              f.id === id ? { ...f, ...patch } : f
            ),
          };
        });
      });
    },
    [commit, mapData, updateMapData]
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
   * one undo step and one notification. Map objects are batched into one
   * map-data write; locations and trade routes are batched into one
   * world-bible write — bypassing the per-item CRUD notifications that
   * would otherwise stack a toast per element.
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
    setPan({ x: screenW / 2 - point.x * zoom, y: screenH / 2 - point.y * zoom });
  }, [mapData.terrainFeatures, mapData.placements, placeCategories, story.worldBible.locations, setSelection, zoom]);


  // Station NPC at location
  const handleStationNpc = (npcId: string, locationId: string) => {
    commit('Station NPC', () => {
      editNpc(npcId, { currentLocationId: locationId });
    });
    notify.success(isPersian ? 'شخصیت در این شهر مستقر شد' : 'NPC stationed at location');
  };

  // Select Entity from Palette for Placement
  const handleSelectEntityForPlacement = (type: string, id: string) => {
    if (type === 'location') {
      const loc = story.worldBible.locations.find((l) => l.id === id);
      if (loc) {
        setSelection([{ kind: 'location', id: loc.id }]);
        const anchor = resolvePlaceMapAnchor(loc, mapData.terrainFeatures);
        if (anchor) {
          // Center camera on the place's pin, or its linked terrain label.
          const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
          setPan({
            x: screenW / 2 - anchor.x * zoom,
            y: screenH / 2 - anchor.y * zoom,
          });
        }
      }
    } else {
      // Place as pin in current screen center
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const centerWorldX = Math.round((-pan.x + screenW / 2) / zoom);
      const centerWorldY = Math.round((-pan.y + screenH / 2) / zoom);

      const newPin: MapEntityPlacement = {
        id: `pin_${Date.now().toString(36)}`,
        entityId: id,
        entityType: type as MapEntityPlacement['entityType'],
        x: centerWorldX,
        y: centerWorldY,
      };
      handleAddPlacement(newPin);
      setSelection([{ kind: 'placement', id: newPin.id }]);
    }
    setIsPaletteOpen(false);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative select-none">
      {/* Top Workstation Header */}
      <CartographerHeader
        worldName={story.worldBible.worldName}
        worldsList={worldsList}
        selectedWorldId={selectedWorldId || story.worldId || ''}
        onSelectWorld={(id) => {
          // Select world or first story in world
          const matchingStory = storiesList.find((s) => (s as { worldId?: string }).worldId === id);
          if (matchingStory) {
            setSelectedStoryId(matchingStory.id);
          }
        }}
        onDeleteWorld={handleDeleteCurrentWorld}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        settings={mapSettings}
        onUpdateSettings={handleUpdateSettings}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onFitView={handleFitView}
        isSyncing={isSyncing}
        hasUnsavedChanges={hasLocalDraft}
        onSave={saveToServer}
        onOpenAiOracle={() => setIsAiOracleOpen(true)}
        onAutoFit={handleAutoFit}
        canUndoAutoFit={!!autoFitSnapshot && autoFitSnapshot.length > 0}
        onUndoAutoFit={handleUndoAutoFit}
        canUndo={history.past.length > 0}
        onUndo={handleUndo}
        canRedo={history.future.length > 0}
        onRedo={handleRedo}
        undoLabel={peekUndoLabel(history)}
        redoLabel={peekRedoLabel(history)}
        onToggleLayerPanel={() => {
          setIsLayerPanelOpen((v) => !v);
          setIsPaletteOpen(false);
          setIsElementsPanelOpen(false);
        }}
        isLayerPanelOpen={isLayerPanelOpen}
        onToggleElementsPanel={() => {
          setIsElementsPanelOpen((v) => !v);
          setIsLayerPanelOpen(false);
          setIsPaletteOpen(false);
        }}
        isElementsPanelOpen={isElementsPanelOpen}
        onTogglePalette={() => {
          setIsPaletteOpen((v) => !v);
          setIsLayerPanelOpen(false);
          setIsElementsPanelOpen(false);
        }}
        isPaletteOpen={isPaletteOpen}
        isPersian={isPersian}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Canvas Workstation Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Hardware-Accelerated PixiJS WebGL Canvas */}
        <PixiCartographerCanvas
          worldBible={story.worldBible}
          settings={mapSettings}
          activeTool={activeTool}
          selection={selection}
          onSelectionChange={setSelection}
          onMoveSelection={handleMoveSelection}
          onUpdateTradeRoute={handleUpdateTradeRoute}
          onAddTradeRoute={handleAddTradeRoute}
          onUpdateRoute={handleUpdateRoad}
          onAddRoute={handleAddRoad}
          onUpdateTerrain={handleUpdateTerrain}
          onAddTerrain={handleAddTerrain}
          onReplaceTerrain={handleReplaceTerrain}
          onAddLocation={handleAddLocation}
          onAddPlacement={handleAddPlacement}
          onAddGeneratedElement={handleAddGeneratedElement}
          onDeleteObject={handleDeleteObject}
          onAskOracle={() => setIsAiOracleOpen(true)}
          isPersian={isPersian}
          zoom={zoom}
          setZoom={setZoom}
          pan={pan}
          setPan={setPan}
        />

        {/* Floating Tool Palette (Left) */}
        <CartographerToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          isPersian={isPersian}
        />

        {/* Layer Visibility Drawer (Right) */}
        {isLayerPanelOpen && (
          <CartographerLayerPanel
            settings={mapSettings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setIsLayerPanelOpen(false)}
            isPersian={isPersian}
          />
        )}

        {/* Elements List Drawer with Accordion Categories (Right) */}
        {isElementsPanelOpen && (
          <CartographerElementsPanel
            worldBible={story.worldBible}
            mapData={mapData}
            onClose={() => setIsElementsPanelOpen(false)}
            isPersian={isPersian}
            onSelectMapObject={handleSelectMapObject}
            onToggleTerrainVisibility={handleToggleTerrainVisibility}
            onToggleTerrainLock={handleToggleTerrainLock}
            onDeleteTerrain={handleDeleteTerrain}
            onTogglePlacementVisibility={handleTogglePlacementVisibility}
            onTogglePlacementLock={handleTogglePlacementLock}
            onDeletePlacement={handleDeletePlacement}
            onToggleLocationVisibility={handleToggleLocationVisibility}
            onToggleLocationLock={handleToggleLocationLock}
            onDeleteLocation={handleDeleteLocation}
            onToggleRouteVisibility={handleToggleRouteVisibility}
            onToggleRouteLock={handleToggleRouteLock}
            onDeleteRoute={handleDeleteTradeRoute}
            onToggleRoadVisibility={handleToggleRoadVisibility}
            onToggleRoadLock={handleToggleRoadLock}
            onDeleteRoad={handleDeleteRoad}
            placeCategories={placeCategories}
            onSetElementsVisibility={handleSetElementsVisibility}
          />
        )}

        {/* World Bible Entities Palette (Right) */}
        {isPaletteOpen && (
          <CartographerEntityPalette
            worldBible={story.worldBible}
            onSelectEntityForPlacement={handleSelectEntityForPlacement}
            onClose={() => setIsPaletteOpen(false)}
            isPersian={isPersian}
            mapData={mapData}
            onSelectMapObject={handleSelectMapObject}
            onToggleTerrainVisibility={handleToggleTerrainVisibility}
            onToggleTerrainLock={handleToggleTerrainLock}
            onRenameTerrain={handleRenameTerrain}
            onReorderTerrain={handleReorderTerrain}
            onDeleteTerrain={handleDeleteTerrain}
            onTogglePlacementVisibility={handleTogglePlacementVisibility}
            onTogglePlacementLock={handleTogglePlacementLock}
            onRenamePlacement={handleRenamePlacement}
            onReorderPlacement={handleReorderPlacement}
            onDeletePlacement={handleDeletePlacement}
          />
        )}

        {/* Multi-selection actions (Plan 23). A single object keeps the full
            Inspector; two or more get the compact floating bar instead. */}
        {selectedItems.length > 1 && (
          <CartographerSelectionBar
            count={selectedItems.length}
            onDuplicate={handleDuplicateSelection}
            onDelete={() => void handleDeleteSelection(selection)}
            onClear={() => setSelection([])}
            isPersian={isPersian}
          />
        )}

        {/* Selected Node Inspector Drawer (Right) */}
        {selectedItem && (
          <CartographerInspector
            selectedItem={selectedItem}
            onClose={() => setSelection([])}
            onUpdateLocation={handleUpdateLocation}
            onDeleteLocation={handleDeleteLocation}
            onUpdateTradeRoute={handleUpdateTradeRoute}
            onDeleteTradeRoute={handleDeleteTradeRoute}
            onUpdateTerrain={handleUpdateTerrain}
            onDeleteTerrain={handleDeleteTerrain}
            onDeletePlacement={handleDeletePlacement}
            onUpdateRoute={handleUpdateRoad}
            onDeleteRoute={handleDeleteRoad}
            onToggleRouteVisibility={handleToggleRoadVisibility}
            onToggleRouteLock={handleToggleRoadLock}
            onToggleTerrainVisibility={handleToggleTerrainVisibility}
            onToggleTerrainLock={handleToggleTerrainLock}
            onTogglePlacementVisibility={handleTogglePlacementVisibility}
            onTogglePlacementLock={handleTogglePlacementLock}
            npcs={story.worldBible.npcs || []}
            factions={story.worldBible.factions || []}
            locations={story.worldBible.locations || []}
            placeCategories={placeCategories}
            terrainFeatures={mapData.terrainFeatures}
            placements={mapData.placements}
            bestiary={story.worldBible.bestiary || []}
            artifacts={story.worldBible.artifacts || []}
            timeline={story.worldBible.timeline || []}
            onUpdateCreature={handleUpdateCreature}
            onDeleteCreature={handleDeleteCreature}
            onUpdateArtifact={handleUpdateArtifact}
            onDeleteArtifact={handleDeleteArtifact}
            onUpdateTimelineEvent={handleUpdateTimelineEvent}
            onDeleteTimelineEvent={handleDeleteTimelineEvent}
            onUpdateNpc={handleUpdateNpc}
            onDeleteNpc={handleDeleteNpc}
            onStationNpc={handleStationNpc}
            isPersian={isPersian}
          />
        )}
      </main>

      {/* AI Cartographer Oracle Modal */}
      <CartographerAiOracleModal
        worldBible={story.worldBible}
        isOpen={isAiOracleOpen}
        onClose={() => setIsAiOracleOpen(false)}
        onApplyGeneratedRoutes={(newRoutes) => {
          newRoutes.forEach((r) => addTradeRoute(r));
        }}
        onApplyGeneratedTerrain={(newTerrain) => {
          newTerrain.forEach((t) => handleAddTerrain(t));
        }}
        isPersian={isPersian}
      />
    </div>
  );
}
