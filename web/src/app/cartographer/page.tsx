'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { CartographerSelectionBar } from '@/components/cartographer/CartographerSelectionBar';
import { CartographerAiOracleModal } from '@/components/cartographer/CartographerAiOracleModal';
import { notify } from '@/lib/notify';
import { auditWorldMapLayout } from '@/lib/engines/world/mapLayoutAuditor';
import { solveMapLayout, stableSeedFromString } from '@/lib/engines/world/mapLayoutSolver';
import { reorderPlacementByZ, reorderTerrainByZ, terrainCenter } from '@/lib/engines/world/mapObjectOrder';
import {
  buildMapClipboard,
  clipboardSize,
  cloneMapClipboard,
  collectSelectableRefs,
  mapObjectRefKey,
  translateMapObjects,
  type MapClipboard,
  type MapObjectRef,
} from '@/lib/engines/world/mapSelection';
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
  //
  // Plan 23: a selection is a list of *references*, never a list of object
  // copies. The objects are resolved from the current world on every render,
  // so an Inspector edit, an undo or a delete can never leave a stale snapshot
  // selected — a ref whose object disappeared simply stops resolving.
  const [activeTool, setActiveTool] = useState<CartographerTool>('select');
  const [selection, setSelection] = useState<MapObjectRef[]>([]);

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
    (label: string, apply: () => void, options?: { coalesceMs?: number }) => {
      const before = captureSnapshot();
      // The inspector writes on every keystroke: a burst of the same action is
      // folded into one entry so a single undo reverts the whole edit. Arrow
      // nudges opt into the same treatment explicitly.
      const coalesceMs =
        options?.coalesceMs ??
        (label.startsWith('Edit ') ? CARTOGRAPHER_COALESCE_MS : 0);
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

  /** Resolves selection refs against the live world (never against a copy). */
  const selectedItems = useMemo<NonNullable<SelectedMapItem>[]>(() => {
    const locations = story.worldBible.locations ?? [];
    const routes = story.worldBible.tradeRoutes ?? [];
    const items: NonNullable<SelectedMapItem>[] = [];

    for (const ref of selection) {
      if (ref.kind === 'location') {
        const data = locations.find((l) => l.id === ref.id);
        if (data) items.push({ type: 'location', data });
      } else if (ref.kind === 'trade_route') {
        const data = routes.find((r) => r.id === ref.id);
        if (data) items.push({ type: 'trade_route', data });
      } else if (ref.kind === 'terrain') {
        const data = mapData.terrainFeatures.find((f) => f.id === ref.id);
        if (data) items.push({ type: 'terrain', data });
      } else {
        const data = mapData.placements.find((p) => p.id === ref.id);
        if (data) items.push({ type: 'placement', data });
      }
    }
    return items;
  }, [selection, mapData, story.worldBible.locations, story.worldBible.tradeRoutes]);

  /**
   * Drops refs whose objects vanished (delete, undo, a world switch). We keep
   * the array identity when everything resolves so this cannot loop.
   */
  useEffect(() => {
    if (selection.length === 0 || selectedItems.length === selection.length) return;
    setSelection(selectedItems.map((item) => ({ kind: item.type, id: item.data.id })));
  }, [selection.length, selectedItems]);

  /** The Inspector only opens for a single object, exactly as before. */
  const selectedItem: SelectedMapItem =
    selectedItems.length === 1 ? selectedItems[0] : null;

  /** Removes refs that a singular handler just deleted. */
  const removeFromSelection = useCallback((refs: MapObjectRef[]) => {
    if (refs.length === 0) return;
    const keys = new Set(refs.map(mapObjectRefKey));
    setSelection((prev) => prev.filter((ref) => !keys.has(mapObjectRefKey(ref))));
  }, []);

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
        : item.type === 'placement'
        ? { x: item.data.x, y: item.data.y }
        : null;
    if (!point) return;

    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    setPan({ x: screenW / 2 - point.x * zoom, y: screenH / 2 - point.y * zoom });
  }, [zoom]);

  // -----------------------------------------------------------------------
  // Plan 23 — multi-selection clipboard, duplicate, select-all and bulk delete
  // -----------------------------------------------------------------------
  const clipboardRef = useRef<MapClipboard | null>(null);
  const pasteStepRef = useRef(0);

  /** Everything the map can currently select, in one shape. */
  const selectionSource = useMemo(
    () => ({
      locations: story.worldBible.locations,
      tradeRoutes: story.worldBible.tradeRoutes,
      terrainFeatures: mapData.terrainFeatures,
      placements: mapData.placements,
    }),
    [story.worldBible.locations, story.worldBible.tradeRoutes, mapData]
  );

  /**
   * Deletes a whole selection after ONE confirmation and as ONE undo step.
   *
   * Routes whose endpoints disappear are removed too: a route with a dangling
   * end is not drawn and can never be picked again, so leaving it behind would
   * create invisible debris. Child locations lose their parent instead of
   * pointing at a location that no longer exists.
   */
  const handleDeleteSelection = useCallback(
    async (refs: MapObjectRef[]) => {
      const unique = Array.from(new Map(refs.map((ref) => [mapObjectRefKey(ref), ref])).values());
      if (unique.length === 0) return;

      const terrainIds = new Set(unique.filter((r) => r.kind === 'terrain').map((r) => r.id));
      const placementIds = new Set(unique.filter((r) => r.kind === 'placement').map((r) => r.id));
      const locationIds = new Set(unique.filter((r) => r.kind === 'location').map((r) => r.id));
      const routeIds = new Set(unique.filter((r) => r.kind === 'trade_route').map((r) => r.id));

      const parts: string[] = [];
      const addPart = (count: number, en: string, fa: string) => {
        if (count === 0) return;
        parts.push(isPersian ? `${count} ${fa}` : `${count} ${en}${count === 1 ? '' : 's'}`);
      };
      addPart(terrainIds.size, 'terrain feature', 'عارضه طبیعی');
      addPart(placementIds.size, 'pin', 'سنجاق');
      addPart(locationIds.size, 'location', 'مکان');
      addPart(routeIds.size, 'trade route', 'مسیر کاروان');

      const only = unique.length === 1 ? selectedItems[0] : undefined;
      const namedObject =
        only && 'name' in only.data
          ? only.data.name
          : only && only.type === 'placement'
          ? only.data.customLabel
          : undefined;

      const ok = await notify.confirm({
        title: isPersian ? 'حذف انتخاب' : 'Delete selection',
        message: isPersian
          ? unique.length === 1 && namedObject
            ? `آیا «${namedObject}» حذف شود؟ این عمل با Ctrl+Z قابل بازگردانی است.`
            : `آیا ${unique.length} شیء (${parts.join('، ')}) حذف شوند؟ این عمل با Ctrl+Z قابل بازگردانی است.`
          : unique.length === 1 && namedObject
          ? `Delete "${namedObject}"? You can undo this with Ctrl+Z.`
          : `Delete ${unique.length} objects (${parts.join(', ')})? You can undo this with Ctrl+Z.`,
      });
      if (!ok) return;

      commit('Delete selection', () => {
        updateWorldBible((prev) => {
          const prevMap = prev.mapData ?? prev.ontology?.mapData;
          const locations = (prev.locations ?? [])
            .filter((l) => !locationIds.has(l.id))
            .map((l) =>
              l.parentLocationId && locationIds.has(l.parentLocationId)
                ? { ...l, parentLocationId: undefined }
                : l
            );
          const tradeRoutes = (prev.tradeRoutes ?? []).filter(
            (route) =>
              !routeIds.has(route.id) &&
              !locationIds.has(route.originLocationId) &&
              !locationIds.has(route.destinationLocationId)
          );
          const nextMap = prevMap
            ? {
                ...prevMap,
                terrainFeatures: prevMap.terrainFeatures.filter((f) => !terrainIds.has(f.id)),
                placements: prevMap.placements.filter((p) => !placementIds.has(p.id)),
              }
            : prevMap;
          return {
            ...prev,
            locations,
            tradeRoutes,
            mapData: nextMap,
            ontology: { ...(prev.ontology || getDefaultOntology(isPersian)), mapData: nextMap },
          };
        });
      });

      setSelection([]);
      notify.info(
        isPersian
          ? `${unique.length} شیء حذف شد`
          : `${unique.length} object${unique.length === 1 ? '' : 's'} deleted`
      );
    },
    [commit, isPersian, selectedItems, updateWorldBible]
  );

  /**
   * Plan 23 — moves every selected object by the same world-space delta.
   * One commit, so a drag or an arrow nudge is a single undo step. Only the
   * slices that actually changed are rewritten.
   */
  const handleMoveSelection = useCallback(
    (refs: MapObjectRef[], dx: number, dy: number, coalesce = false) => {
      if (refs.length === 0 || (dx === 0 && dy === 0)) return;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;

      const moved = translateMapObjects(selectionSource, refs, dx, dy);
      const touchesMapData = refs.some((r) => r.kind === 'terrain' || r.kind === 'placement');
      const touchesLocations = refs.some((r) => r.kind === 'location');
      const touchesRoutes = refs.some((r) => r.kind === 'trade_route');

      commit(
        coalesce ? 'Nudge selection' : 'Move selection',
        () => {
          if (touchesMapData) {
            updateMapData((prev) => {
              const current = prev || mapData;
              return {
                ...current,
                terrainFeatures: moved.terrainFeatures,
                placements: moved.placements,
              };
            });
          }
          if (touchesLocations || touchesRoutes) {
            updateWorldBible((prev) => ({
              ...prev,
              locations: touchesLocations ? moved.locations : prev.locations,
              tradeRoutes: touchesRoutes ? moved.tradeRoutes : prev.tradeRoutes,
            }));
          }
        },
        // Holding an arrow key fires a burst of nudges; fold the burst into one
        // undo entry instead of filling the history with one entry per pixel.
        coalesce ? { coalesceMs: CARTOGRAPHER_COALESCE_MS } : undefined
      );
    },
    [commit, mapData, selectionSource, updateMapData, updateWorldBible]
  );

  const handleNudgeSelection = useCallback(
    (dx: number, dy: number) => {
      handleMoveSelection(selection, dx, dy, true);
    },
    [handleMoveSelection, selection]
  );

  /**
   * The pasted batch is applied as one undo step and becomes the selection.
   * Terrain/pins and locations/routes live in two different slices of the
   * bible, so both updates are queued inside the same commit.
   */
  const pasteClipboard = useCallback(
    (payload: MapClipboard, offsetX: number, offsetY: number): number => {
      // Unique even when two pastes land in the same millisecond (key repeat,
      // scripted tests): the random tag prevents id collisions between batches.
      const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      let counter = 0;
      const clones = cloneMapClipboard(payload, {
        offsetX,
        offsetY,
        copySuffix: isPersian ? ' (رونوشت)' : ' (copy)',
        makeId: (kind) => {
          const prefix =
            kind === 'terrain'
              ? 'terr'
              : kind === 'placement'
              ? 'pin'
              : kind === 'location'
              ? 'loc'
              : 'tr';
          return `${prefix}_${stamp}_${counter++}`;
        },
      });
      if (clones.refs.length === 0) return 0;

      commit('Paste', () => {
        updateMapData((prev) => {
          const current = prev || mapData;
          return {
            ...current,
            terrainFeatures: [...current.terrainFeatures, ...clones.terrainFeatures],
            placements: [...current.placements, ...clones.placements],
          };
        });
        if (clones.locations.length > 0 || clones.tradeRoutes.length > 0) {
          updateWorldBible((prev) => ({
            ...prev,
            locations: [...(prev.locations ?? []), ...clones.locations],
            tradeRoutes: [...(prev.tradeRoutes ?? []), ...clones.tradeRoutes],
          }));
        }
      });

      setSelection(clones.refs);
      return clones.refs.length;
    },
    [commit, isPersian, mapData, updateMapData, updateWorldBible]
  );

  const handleCopy = useCallback(() => {
    if (selection.length === 0) return;
    const payload = buildMapClipboard(selectionSource, selection);
    const size = clipboardSize(payload);
    if (size === 0) return;
    // Snapshot: editing or deleting an object after copying must not change
    // what the next paste produces.
    clipboardRef.current = structuredClone(payload);
    pasteStepRef.current = 1;
    notify.info(isPersian ? `${size} شیء کپی شد` : `${size} object${size === 1 ? '' : 's'} copied`);
  }, [isPersian, selection, selectionSource]);

  const handlePaste = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload) return;
    // Each consecutive paste steps further away, so repeated Ctrl+V produces a
    // readable row of copies instead of a stack.
    const step = pasteStepRef.current;
    pasteStepRef.current += 1;
    const count = pasteClipboard(payload, 24 * step, 24 * step);
    if (count > 0) {
      notify.success(
        isPersian
          ? `${count} شیء چسبانده شد`
          : `${count} object${count === 1 ? '' : 's'} pasted`
      );
    }
  }, [isPersian, pasteClipboard]);

  const handleDuplicateSelection = useCallback(() => {
    if (selection.length === 0) return;
    const payload = buildMapClipboard(selectionSource, selection);
    const count = pasteClipboard(payload, 24, 24);
    if (count > 0) {
      notify.success(
        isPersian
          ? `${count} شیء تکثیر شد`
          : `${count} object${count === 1 ? '' : 's'} duplicated`
      );
    }
  }, [isPersian, pasteClipboard, selection, selectionSource]);

  const handleSelectAll = useCallback(() => {
    const refs = collectSelectableRefs(selectionSource, mapSettings);
    // Selecting while a drawing tool is armed is almost always a mistake the
    // author has to undo by hand; Ctrl+A means "select", so arm the select tool.
    setActiveTool('select');
    setSelection(refs);
    if (refs.length === 0) {
      notify.info(isPersian ? 'شیء قابل انتخابی روی نقشه نیست.' : 'Nothing on the map can be selected.');
    }
  }, [isPersian, mapSettings, selectionSource]);

  // Plan 23 authoring shortcuts — ignored while typing in a field.
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

      if (e.key === 'Delete' && selection.length > 0) {
        e.preventDefault();
        void handleDeleteSelection(selection);
        return;
      }
      if (e.key === 'Escape' && selection.length > 0) {
        setSelection([]);
        return;
      }

      // Plan 23 — arrow-key nudge. 1 world unit, 10 with Shift. Ctrl/Alt are
      // left alone so browser gestures (zoom, history) still work.
      if (
        selection.length > 0 &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
      ) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        handleNudgeSelection(dx, dy);
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;

      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (key === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (key === 'd') {
        e.preventDefault();
        handleDuplicateSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selection,
    handleDeleteSelection,
    handleSelectAll,
    handleCopy,
    handlePaste,
    handleDuplicateSelection,
    handleNudgeSelection,
  ]);

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
