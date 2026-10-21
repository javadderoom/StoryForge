'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStudioStory, getDefaultOntology } from '@/lib/context/StudioStoryContext';
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
import { auditWorldMapLayout } from '@/lib/engines/world/mapLayoutAuditor';
import { solveMapLayout, stableSeedFromString } from '@/lib/engines/world/mapLayoutSolver';
import {
  CARTOGRAPHER_COALESCE_MS,
  createCartographerHistory,
  mergeCartographerSnapshot,
  peekRedoLabel,
  peekUndoLabel,
  pushCartographerHistory,
  redoCartographerHistory,
  undoCartographerHistory,
  type CartographerHistory,
  type CartographerSnapshot,
} from '@/lib/engines/world/cartographerHistory';

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

  // -----------------------------------------------------------------------
  // Undo / redo — every authoring action pushes a pre-state snapshot, so
  // Ctrl+Z / Ctrl+Shift+Z work across terrain, pins, routes, NPC stationing
  // and the Plan 19 refit.
  // -----------------------------------------------------------------------
  const [history, setHistory] = useState<CartographerHistory>(createCartographerHistory());

  const captureSnapshot = useCallback((): CartographerSnapshot => {
    const wb = story.worldBible;
    return {
      locations: structuredClone(wb.locations ?? []),
      tradeRoutes: structuredClone(wb.tradeRoutes ?? []),
      npcStations: (wb.npcs ?? []).map((n) => ({
        id: n.id,
        currentLocationId: n.currentLocationId,
      })),
      mapData: wb.mapData ? structuredClone(wb.mapData) : undefined,
    };
  }, [story.worldBible]);

  const restoreSnapshot = useCallback(
    (snapshot: CartographerSnapshot) => {
      const merged = mergeCartographerSnapshot(captureSnapshot(), snapshot);
      updateWorldBible((prev) => ({
        ...prev,
        locations: merged.locations,
        tradeRoutes: merged.tradeRoutes,
        npcs: (prev.npcs ?? []).map((n) => {
          const station = merged.npcStations.find((s) => s.id === n.id);
          if (!station) return n;
          if (station.currentLocationId === undefined) {
            const { currentLocationId: _dropped, ...rest } = n as any;
            return rest;
          }
          return { ...n, currentLocationId: station.currentLocationId } as typeof n;
        }),
        mapData: merged.mapData,
        ontology: { ...(prev.ontology || getDefaultOntology(isPersian)), mapData: merged.mapData },
      }));
    },
    [captureSnapshot, updateWorldBible, isPersian]
  );

  /** Records an authoring action so it can be undone. */
  const commit = useCallback(
    (label: string, apply: () => void) => {
      const before = captureSnapshot();
      // The inspector writes on every keystroke: a burst of the same action is
      // folded into one entry so a single undo reverts the whole edit.
      const coalesceMs = label.startsWith('Edit ') ? CARTOGRAPHER_COALESCE_MS : 0;
      setHistory((h) => pushCartographerHistory(h, label, before, { coalesceMs }));
      apply();
    },
    [captureSnapshot]
  );

  const handleUndo = useCallback(() => {
    const result = undoCartographerHistory(history, captureSnapshot());
    if (!result) {
      notify.info(isPersian ? 'عملی برای بازگردانی وجود ندارد.' : 'Nothing to undo.');
      return;
    }
    restoreSnapshot(result.restored);
    setHistory(result.history);
    notify.info(isPersian ? `بازگردانی: ${result.label}` : `Undone: ${result.label}`);
  }, [history, captureSnapshot, restoreSnapshot, isPersian]);

  const handleRedo = useCallback(() => {
    const result = redoCartographerHistory(history);
    if (!result) {
      notify.info(isPersian ? 'عملی برای تکرار وجود ندارد.' : 'Nothing to redo.');
      return;
    }
    restoreSnapshot(result.restored);
    setHistory(result.history);
    notify.info(isPersian ? `تکرار: ${result.label}` : `Redone: ${result.label}`);
  }, [history, restoreSnapshot, isPersian]);

  // Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) — ignored while typing in a field.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

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
      if (selectedItem?.type === 'terrain' && selectedItem.data.id === id) {
        setSelectedItem(null);
      }
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
      setSelectedItem((prev) =>
        prev?.type === 'location' && prev.data.id === id
          ? { type: 'location', data: { ...prev.data, ...updated } }
          : prev
      );
    });
  };

  const handleDeleteLocation = (id: string) => {
    commit('Delete location', () => {
      deleteLocation(id);
      if (selectedItem?.type === 'location' && selectedItem.data.id === id) {
        setSelectedItem(null);
      }
    });
  };

  // -----------------------------------------------------------------------
  // Plan 19: coordinate auto-fit — derive legacy/missing pins from lore &
  // topology. Manual pins are hard anchors; the apply path is undoable until
  // the user saves (a save makes the refit canon).
  // -----------------------------------------------------------------------
  interface AutoFitSnapshotEntry {
    locationId: string;
    coordinates: { x: number; y: number } | undefined;
    coordinatesSource: WorldLocation['coordinatesSource'];
  }

  const [autoFitSnapshot, setAutoFitSnapshot] = useState<AutoFitSnapshotEntry[] | null>(null);

  const handleAutoFit = async () => {
    const wb = story.worldBible;
    const mapData =
      wb.mapData ?? (wb.ontology as { mapData?: WorldMapData } | undefined)?.mapData ?? null;
    const audit = auditWorldMapLayout(wb, mapData);
    if (audit.counts.legacy_auto === 0 && audit.counts.unplaced === 0) {
      notify.info(
        isPersian
          ? 'همهٔ مکان‌ها مختصات معتبر دارند؛ بازماندهٔ قدیمی برای بازچینی نیست.'
          : 'All locations already carry coordinates; no legacy remnants to refit.'
      );
      return;
    }

    const issueLines = audit.issues
      .slice(0, 4)
      .map((i) => (isPersian ? `• ${i.fa}` : `• ${i.en}`))
      .join('\n');
    const issueBlock = issueLines ? `\n${issueLines}` : '';
    const ok = await notify.confirm({
      title: isPersian ? 'چیدمان خودکار مختصات' : 'Auto-fit coordinates',
      message:
        (isPersian
          ? `${audit.counts.legacy_auto} بازماندهٔ قدیمی و ${audit.counts.unplaced} مکان فاقد مختصات شناسایی شد؛ ${audit.counts.manual} نشان دستی دست‌نخورده می‌ماند.\nموقعیت‌ها از گراف جهان، مسیرهای تجاری، متن روایت و زمینِ نقشه استخراج می‌شود و پس از اعمال قابل بازگردانی است.`
          : `${audit.counts.legacy_auto} legacy remnant(s) and ${audit.counts.unplaced} unplaced location(s) detected; ${audit.counts.manual} manual pin(s) will stay untouched.\nPositions derive from the world graph, trade routes, lore text and terrain, and can be undone after apply.`) +
        issueBlock,
      confirmText: isPersian ? 'بازچینی' : 'Refit',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
    });
    if (!ok) return;

    const seed = stableSeedFromString(
      selectedWorldId || story.worldId || story.worldBible.worldName || 'storyforge-world'
    );
    const result = solveMapLayout({
      locations: wb.locations,
      tradeRoutes: wb.tradeRoutes,
      mapData,
      mode: 'legacy',
      seed,
    });
    if (!result.placements.length) {
      notify.info(isPersian ? 'چیزی برای جابجایی نبود.' : 'Nothing to move.');
      return;
    }

    const touchedIds = new Set(result.diffs.map((d) => d.locationId));
    setAutoFitSnapshot(
      wb.locations
        .filter((l) => touchedIds.has(l.id))
        .map((l) => ({
          locationId: l.id,
          coordinates: l.coordinates,
          coordinatesSource: l.coordinatesSource,
        }))
    );

    commit('Auto-fit coordinates', () => {
      updateWorldBible((prev) => ({
        ...prev,
        locations: (prev.locations || []).map((l) => {
          const placement = result.placements.find((p) => p.locationId === l.id);
          if (!placement) return l;
          return { ...l, coordinates: placement.position, coordinatesSource: 'solver' as const };
        }),
      }));
    });
    notify.success(
      isPersian
        ? `${result.summaryText} — برای ذخیرهٔ نهایی روی ذخیره بزنید.`
        : `${result.summaryText} — hit Save to persist.`
    );
  };

  const handleUndoAutoFit = () => {
    const snapshot = autoFitSnapshot;
    if (!snapshot || snapshot.length === 0) return;
    updateWorldBible((prev) => ({
      ...prev,
      locations: (prev.locations || []).map((l) => {
        const entry = snapshot.find((s) => s.locationId === l.id);
        if (!entry) return l;
        const restored: WorldLocation = { ...l, coordinates: entry.coordinates, coordinatesSource: entry.coordinatesSource };
        if (!entry.coordinates) delete restored.coordinates;
        if (!entry.coordinatesSource) delete restored.coordinatesSource;
        return restored;
      }),
    }));
    setAutoFitSnapshot(null);
    notify.info(isPersian ? 'مختصات قبلی بازگردانی شد.' : 'Previous coordinates restored.');
  };

  // Trade Route Handlers
  const handleAddTradeRoute = (route: WorldTradeRoute) => {
    commit('Add trade route', () => addTradeRoute(route));
  };

  const handleUpdateTradeRoute = (id: string, updated: Partial<WorldTradeRoute>) => {
    commit(updated.waypoints ? 'Move waypoint' : 'Edit trade route', () => {
      editTradeRoute(id, updated);
      setSelectedItem((prev) =>
        prev?.type === 'trade_route' && prev.data.id === id
          ? { type: 'trade_route', data: { ...prev.data, ...updated } }
          : prev
      );
    });
  };

  const handleDeleteTradeRoute = (id: string) => {
    commit('Delete trade route', () => {
      deleteTradeRoute(id);
      if (selectedItem?.type === 'trade_route' && selectedItem.data.id === id) {
        setSelectedItem(null);
      }
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
      if (selectedItem?.type === 'placement' && selectedItem.data.id === id) {
        setSelectedItem(null);
      }
    });
  };

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
