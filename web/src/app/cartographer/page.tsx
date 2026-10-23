'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { normalizeOntology, useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  WorldMapData,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
} from '@/lib/types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getOrInitializeWorldMapData,
  ensureLocationCoordinates,
} from '@/lib/engines/world/cartographerEngine';
import { CartographerHeader, CartographerTool } from '@/components/cartographer/CartographerHeader';
import { CartographerToolbar } from '@/components/cartographer/CartographerToolbar';
import { PixiCartographerCanvas } from '@/components/cartographer/PixiCartographerCanvas';
import { CartographerLayerPanel } from '@/components/cartographer/CartographerLayerPanel';
import { CartographerEntityPalette } from '@/components/cartographer/CartographerEntityPalette';
import { CartographerElementsPanel } from '@/components/cartographer/CartographerElementsPanel';
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
  const {
    story,
    setSelectedStoryId,
    storiesList,
    selectedWorldId,
    worldsList,
    updateWorldBible,
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
  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z * 0.8));
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
      removeFromSelection([{ kind: 'location', id }]);
    });
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
        };
      });
      removeFromSelection([{ kind: 'placement', id }]);
    });
  };

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
        : null;
    if (!point) return;

    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    setPan({ x: screenW / 2 - point.x * zoom, y: screenH / 2 - point.y * zoom });
  }, [mapData.terrainFeatures, setSelection, zoom]);


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
          onUpdateTerrain={handleUpdateTerrain}
          onAddTerrain={handleAddTerrain}
          onReplaceTerrain={handleReplaceTerrain}
          onAddLocation={handleAddLocation}
          onAddPlacement={handleAddPlacement}
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
            onToggleTerrainVisibility={handleToggleTerrainVisibility}
            onToggleTerrainLock={handleToggleTerrainLock}
            onTogglePlacementVisibility={handleTogglePlacementVisibility}
            onTogglePlacementLock={handleTogglePlacementLock}
            npcs={story.worldBible.npcs || []}
            factions={story.worldBible.factions || []}
            locations={story.worldBible.locations || []}
            placeCategories={placeCategories}
            terrainFeatures={mapData.terrainFeatures}
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
