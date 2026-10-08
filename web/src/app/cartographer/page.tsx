'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
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
  DEFAULT_MAP_SETTINGS,
  getOrInitializeWorldMapData,
  ensureLocationCoordinates,
} from '@/lib/engines/world/cartographerEngine';
import { CartographerHeader, CartographerTool } from '@/components/cartographer/CartographerHeader';
import { CartographerToolbar } from '@/components/cartographer/CartographerToolbar';
import { PixiCartographerCanvas } from '@/components/cartographer/PixiCartographerCanvas';
import { CartographerLayerPanel } from '@/components/cartographer/CartographerLayerPanel';
import { CartographerEntityPalette } from '@/components/cartographer/CartographerEntityPalette';
import { CartographerInspector, SelectedMapItem } from '@/components/cartographer/CartographerInspector';
import { CartographerAiOracleModal } from '@/components/cartographer/CartographerAiOracleModal';
import { notify } from '@/lib/notify';

export default function CartographerPage() {
  const {
    story,
    selectedStoryId,
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

  // Active Tool & Selection State
  const [activeTool, setActiveTool] = useState<CartographerTool>('select');
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem>(null);

  // Floating Panel Drawer States
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isAiOracleOpen, setIsAiOracleOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Viewport Transform State
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 80, y: 40 });

  // Ensure map data exists
  const mapData: WorldMapData = useMemo(() => {
    return getOrInitializeWorldMapData(story.worldBible, isPersian);
  }, [story.worldBible, isPersian]);

  const mapSettings: WorldMapSettings = mapData.settings;

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
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        terrainFeatures: [...current.terrainFeatures, feature],
      };
    });
    notify.success(isPersian ? 'عارضه طبیعی به نقشه افزوده شد' : 'Terrain feature added');
  };

  const handleUpdateTerrain = (id: string, updated: Partial<MapTerrainFeature>) => {
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        terrainFeatures: current.terrainFeatures.map((f) => (f.id === id ? { ...f, ...updated } : f)),
      };
    });
  };

  const handleDeleteTerrain = (id: string) => {
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        terrainFeatures: current.terrainFeatures.filter((f) => f.id !== id),
      };
    });
    if (selectedItem?.type === 'terrain' && selectedItem.data.id === id) {
      setSelectedItem(null);
    }
    notify.info(isPersian ? 'عارضه طبیعی حذف شد' : 'Terrain feature deleted');
  };

  const handleReplaceTerrain = useCallback((features: MapTerrainFeature[]) => {
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        terrainFeatures: features,
      };
    });
  }, [mapData, updateMapData]);

  // Location Handlers
  const handleAddLocation = (loc: WorldLocation) => {
    addLocation(loc);
  };

  const handleUpdateLocation = (id: string, updated: Partial<WorldLocation>) => {
    editLocation(id, updated);
    setSelectedItem((prev) =>
      prev?.type === 'location' && prev.data.id === id
        ? { type: 'location', data: { ...prev.data, ...updated } }
        : prev
    );
  };

  const handleDeleteLocation = (id: string) => {
    deleteLocation(id);
    if (selectedItem?.type === 'location' && selectedItem.data.id === id) {
      setSelectedItem(null);
    }
  };

  // Trade Route Handlers
  const handleAddTradeRoute = (route: WorldTradeRoute) => {
    addTradeRoute(route);
  };

  const handleUpdateTradeRoute = (id: string, updated: Partial<WorldTradeRoute>) => {
    editTradeRoute(id, updated);
    setSelectedItem((prev) =>
      prev?.type === 'trade_route' && prev.data.id === id
        ? { type: 'trade_route', data: { ...prev.data, ...updated } }
        : prev
    );
  };

  const handleDeleteTradeRoute = (id: string) => {
    deleteTradeRoute(id);
    if (selectedItem?.type === 'trade_route' && selectedItem.data.id === id) {
      setSelectedItem(null);
    }
  };

  // Placements Handlers
  const handleAddPlacement = (placement: MapEntityPlacement) => {
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        placements: [...current.placements, placement],
      };
    });
    notify.success(isPersian ? 'سنجاق روی نقشه ثبت شد' : 'Entity pinned to map');
  };

  const handleDeletePlacement = (id: string) => {
    updateMapData((prev) => {
      const current = prev || mapData;
      return {
        ...current,
        placements: current.placements.filter((p) => p.id !== id),
      };
    });
    if (selectedItem?.type === 'placement' && selectedItem.data.id === id) {
      setSelectedItem(null);
    }
  };

  // Station NPC at location
  const handleStationNpc = (npcId: string, locationId: string) => {
    editNpc(npcId, { currentLocationId: locationId });
    notify.success(isPersian ? 'شخصیت در این شهر مستقر شد' : 'NPC stationed at location');
  };

  // Select Entity from Palette for Placement
  const handleSelectEntityForPlacement = (type: string, id: string) => {
    if (type === 'location') {
      const loc = story.worldBible.locations.find((l) => l.id === id);
      if (loc) {
        setSelectedItem({ type: 'location', data: loc });
        if (loc.coordinates) {
          // Center camera on location
          const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
          setPan({
            x: screenW / 2 - loc.coordinates.x * zoom,
            y: screenH / 2 - loc.coordinates.y * zoom,
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
        entityType: type as any,
        x: centerWorldX,
        y: centerWorldY,
      };
      handleAddPlacement(newPin);
      setSelectedItem({ type: 'placement', data: newPin });
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
          const matchingStory = storiesList.find((s) => (s as any).worldId === id);
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
        onToggleLayerPanel={() => {
          setIsLayerPanelOpen((v) => !v);
          setIsPaletteOpen(false);
        }}
        isLayerPanelOpen={isLayerPanelOpen}
        onTogglePalette={() => {
          setIsPaletteOpen((v) => !v);
          setIsLayerPanelOpen(false);
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
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          onUpdateLocation={handleUpdateLocation}
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

        {/* World Bible Entities Palette (Right) */}
        {isPaletteOpen && (
          <CartographerEntityPalette
            worldBible={story.worldBible}
            onSelectEntityForPlacement={handleSelectEntityForPlacement}
            onClose={() => setIsPaletteOpen(false)}
            isPersian={isPersian}
          />
        )}

        {/* Selected Node Inspector Drawer (Right) */}
        {selectedItem && (
          <CartographerInspector
            selectedItem={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdateLocation={handleUpdateLocation}
            onDeleteLocation={handleDeleteLocation}
            onUpdateTradeRoute={handleUpdateTradeRoute}
            onDeleteTradeRoute={handleDeleteTradeRoute}
            onUpdateTerrain={handleUpdateTerrain}
            onDeleteTerrain={handleDeleteTerrain}
            onDeletePlacement={handleDeletePlacement}
            npcs={story.worldBible.npcs || []}
            factions={story.worldBible.factions || []}
            locations={story.worldBible.locations || []}
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
