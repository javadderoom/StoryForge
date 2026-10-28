'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeOntology, useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  WorldMapData,
  WorldMapSettings,
  MapEntityPlacement,
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
import { CartographerInspector } from '@/components/cartographer/CartographerInspector';
import { CartographerSelectionBar } from '@/components/cartographer/CartographerSelectionBar';
import { CartographerAiOracleModal } from '@/components/cartographer/CartographerAiOracleModal';
import { notify } from '@/lib/notify';
import { resolvePlaceMapAnchor } from '@/lib/engines/world/placeCategories';
import { peekRedoLabel, peekUndoLabel } from '@/lib/engines/world/cartographerHistory';
import { useCartographerHistory } from '@/components/cartographer/hooks/useCartographerHistory';
import { useCartographerAutoFit } from '@/components/cartographer/hooks/useCartographerAutoFit';
import { useCartographerSelection } from '@/components/cartographer/hooks/useCartographerSelection';
import { useCartographerCrud } from '@/components/cartographer/hooks/useCartographerCrud';
import { useCartographerObjectLayers } from '@/components/cartographer/hooks/useCartographerObjectLayers';

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

  const {
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
  } = useCartographerCrud({
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
  });

  const {
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
  } = useCartographerObjectLayers({
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
  });


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
            onToggleLocationVisibility={handleToggleLocationVisibility}
            onToggleLocationLock={handleToggleLocationLock}
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
            religions={story.worldBible.religions || []}
            onUpdateCreature={handleUpdateCreature}
            onDeleteCreature={handleDeleteCreature}
            onUpdateArtifact={handleUpdateArtifact}
            onDeleteArtifact={handleDeleteArtifact}
            onUpdateTimelineEvent={handleUpdateTimelineEvent}
            onDeleteTimelineEvent={handleDeleteTimelineEvent}
            onUpdateNpc={handleUpdateNpc}
            onDeleteNpc={handleDeleteNpc}
            onStationNpc={handleStationNpc}
            onAddTerrain={handleAddTerrain}
            onSelectFeature={(id) => setSelection([{ kind: 'terrain', id }])}
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
