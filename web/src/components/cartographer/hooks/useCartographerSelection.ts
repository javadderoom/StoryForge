'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  CustomPlaceCategory,
  WorldBible,
  WorldMapData,
  WorldMapSettings,
  MapGroup,
  MapGroupMode,
} from '@/lib/types';
import { getDefaultOntology } from '@/lib/context/StudioStoryContext';
import { notify } from '@/lib/notify';
import { CARTOGRAPHER_COALESCE_MS } from '@/lib/engines/world/cartographerHistory';
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
import type { CartographerTool } from '../CartographerHeader';
import type { SelectedMapItem } from '../CartographerInspector';
import { detachRoutesFromRef } from '@/lib/engines/world/mapRoutes';
import {
  createMapGroup,
  ungroupMapGroup,
  setMapGroupMode,
  setMapGroupLocation,
  updateMapGroup,
  findGroupById,
  areRefsInSameGroup,
  type MapGroupSource,
} from '@/lib/engines/world/mapGroups';

type Commit = (
  label: string,
  apply: () => void,
  options?: { coalesceMs?: number }
) => void;
type UpdateMapData = (updater: (previous: WorldMapData | undefined) => WorldMapData) => void;
type UpdateWorldBible = (updater: (previous: WorldBible) => WorldBible) => void;

interface UseCartographerSelectionOptions {
  worldBible: WorldBible;
  mapData: WorldMapData;
  mapSettings: WorldMapSettings;
  placeCategories: CustomPlaceCategory[];
  commit: Commit;
  updateMapData: UpdateMapData;
  updateWorldBible: UpdateWorldBible;
  isPersian: boolean;
  setActiveTool: Dispatch<SetStateAction<CartographerTool>>;
}

/**
 * Plan 23 multi-selection. A selection is a list of *references*, never a list
 * of object copies: objects are resolved from the live world on every render,
 * so an Inspector edit, undo or delete can never leave a stale snapshot
 * selected — a ref whose object disappeared simply stops resolving.
 */
export function useCartographerSelection({
  worldBible,
  mapData,
  mapSettings,
  placeCategories,
  commit,
  updateMapData,
  updateWorldBible,
  isPersian,
  setActiveTool,
}: UseCartographerSelectionOptions) {
  const [selection, setSelection] = useState<MapObjectRef[]>([]);

  /** Everything the map can currently select, in one shape. */
  const selectionSource = useMemo(
    () => ({
      locations: worldBible.locations,
      tradeRoutes: worldBible.tradeRoutes,
      mapRoutes: mapData.routes,
      terrainFeatures: mapData.terrainFeatures,
      placements: mapData.placements,
      placeCategories,
    }),
    [worldBible.locations, worldBible.tradeRoutes, mapData, placeCategories]
  );

  /** Resolves selection refs against the live world (never against a copy). */
  const selectedItems = useMemo<NonNullable<SelectedMapItem>[]>(() => {
    const locations = worldBible.locations ?? [];
    const routes = worldBible.tradeRoutes ?? [];
    const mapRoutes = mapData.routes ?? [];
    const items: NonNullable<SelectedMapItem>[] = [];

    for (const ref of selection) {
      if (ref.kind === 'location') {
        const data = locations.find((location) => location.id === ref.id);
        if (data) items.push({ type: 'location', data });
      } else if (ref.kind === 'trade_route') {
        const data = routes.find((route) => route.id === ref.id);
        if (data) items.push({ type: 'trade_route', data });
      } else if (ref.kind === 'route') {
        const data = mapRoutes.find((route) => route.id === ref.id);
        if (data) items.push({ type: 'route', data });
      } else if (ref.kind === 'terrain') {
        const data = mapData.terrainFeatures.find((feature) => feature.id === ref.id);
        if (data) items.push({ type: 'terrain', data });
      } else {
        const data = mapData.placements.find((placement) => placement.id === ref.id);
        if (data) items.push({ type: 'placement', data });
      }
    }
    return items;
  }, [selection, mapData, worldBible.locations, worldBible.tradeRoutes]);

  /**
   * Drops refs whose objects vanished (delete, undo, a world switch). We keep
   * the array identity when everything resolves so this cannot loop.
   */
  // A delete/undo/world-switch can invalidate refs. Pruning them here keeps the
  // selection state canonical for every later gesture; deriving a filtered copy
  // would resurrect the stale ref if that object came back via undo.
  useEffect(() => {
    if (selection.length === 0 || selectedItems.length === selection.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(selectedItems.map((item) => ({ kind: item.type, id: item.data.id })));
  }, [selection.length, selectedItems]);

  /** Groups current selection if all selected items belong to the same group */
  const currentGroup = useMemo(() => {
    return areRefsInSameGroup(mapData.groups, selection);
  }, [mapData.groups, selection]);

  /**
   * The Inspector opens for a single object, OR for a group when all selected
   * items belong to that group.
   */
  const selectedItem: SelectedMapItem = useMemo(() => {
    if (selectedItems.length === 1) {
      return selectedItems[0];
    }
    if (currentGroup && selectedItems.length > 1) {
      return {
        type: 'group',
        data: currentGroup,
        members: selectedItems,
      };
    }
    return null;
  }, [selectedItems, currentGroup]);

  /** Removes refs that a singular handler just deleted. */
  const removeFromSelection = useCallback((refs: MapObjectRef[]) => {
    if (refs.length === 0) return;
    const keys = new Set(refs.map(mapObjectRefKey));
    setSelection((previous) => previous.filter((ref) => !keys.has(mapObjectRefKey(ref))));
  }, []);

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

      const terrainIds = new Set(unique.filter((ref) => ref.kind === 'terrain').map((ref) => ref.id));
      const placementIds = new Set(unique.filter((ref) => ref.kind === 'placement').map((ref) => ref.id));
      const locationIds = new Set(unique.filter((ref) => ref.kind === 'location').map((ref) => ref.id));
      const routeIds = new Set(unique.filter((ref) => ref.kind === 'trade_route').map((ref) => ref.id));
      const mapRouteIds = new Set(unique.filter((ref) => ref.kind === 'route').map((ref) => ref.id));

      const parts: string[] = [];
      const addPart = (count: number, en: string, fa: string) => {
        if (count === 0) return;
        parts.push(isPersian ? `${count} ${fa}` : `${count} ${en}${count === 1 ? '' : 's'}`);
      };
      addPart(terrainIds.size, 'terrain feature', 'عارضه طبیعی');
      addPart(placementIds.size, 'pin', 'سنجاق');
      addPart(locationIds.size, 'location', 'مکان');
      addPart(routeIds.size, 'trade route', 'مسیر کاروان');
      addPart(mapRouteIds.size, 'road', 'جاده');

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
        updateWorldBible((previous) => {
          const previousMap = previous.mapData ?? previous.ontology?.mapData;
          const locations = (previous.locations ?? [])
            .filter((location) => !locationIds.has(location.id))
            .map((location) =>
              location.parentLocationId && locationIds.has(location.parentLocationId)
                ? { ...location, parentLocationId: undefined }
                : location
            );
          const tradeRoutes = (previous.tradeRoutes ?? []).filter(
            (route) =>
              !routeIds.has(route.id) &&
              !locationIds.has(route.originLocationId) &&
              !locationIds.has(route.destinationLocationId)
          );
          let nextRoutes = (previousMap?.routes ?? []).filter(
            (route) => !mapRouteIds.has(route.id)
          );
          for (const id of terrainIds) {
            nextRoutes = detachRoutesFromRef(nextRoutes, { kind: 'terrain', id }, selectionSource);
          }
          for (const id of placementIds) {
            nextRoutes = detachRoutesFromRef(nextRoutes, { kind: 'placement', id }, selectionSource);
          }
          for (const id of locationIds) {
            nextRoutes = detachRoutesFromRef(nextRoutes, { kind: 'location', id }, selectionSource);
          }

          const deletedKeys = new Set(unique.map((ref) => `${ref.kind}:${ref.id}`));
          const nextGroups = (previousMap?.groups ?? [])
            .map((g) => ({
              ...g,
              memberRefs: g.memberRefs.filter((m) => !deletedKeys.has(`${m.kind}:${m.id}`)),
            }))
            .filter((g) => g.memberRefs.length > 0);

          const nextMap = previousMap
            ? {
                ...previousMap,
                terrainFeatures: previousMap.terrainFeatures.filter((feature) => !terrainIds.has(feature.id)),
                placements: previousMap.placements.filter((placement) => !placementIds.has(placement.id)),
                routes: nextRoutes,
                groups: nextGroups,
              }
            : previousMap;
          return {
            ...previous,
            locations,
            tradeRoutes,
            mapData: nextMap,
            ontology: { ...(previous.ontology || getDefaultOntology(isPersian)), mapData: nextMap },
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
      const previousTerrain = selectionSource.terrainFeatures ?? [];
      const previousLocations = selectionSource.locations ?? [];
      // A non-point place has no pin: moving it moves its linked terrain, so
      // the map-data slice must be committed even when no terrain ref is in
      // the selection.
      const movesTerrain = moved.terrainFeatures.some(
        (feature, index) => feature !== previousTerrain[index]
      );
      const movesLocations = moved.locations.some(
        (location, index) => location !== previousLocations[index]
      );
      const touchesMapData =
        movesTerrain ||
        refs.some(
          (ref) =>
            ref.kind === 'terrain' || ref.kind === 'placement' || ref.kind === 'route'
        );
      const touchesLocations = movesLocations || refs.some((ref) => ref.kind === 'location');
      const touchesRoutes = refs.some((ref) => ref.kind === 'trade_route');

      commit(
        coalesce ? 'Nudge selection' : 'Move selection',
        () => {
          if (touchesMapData) {
            updateMapData((previous) => {
              const current = previous || mapData;
              return {
                ...current,
                terrainFeatures: moved.terrainFeatures,
                placements: moved.placements,
                routes: moved.mapRoutes,
              };
            });
          }
          if (touchesLocations || touchesRoutes) {
            updateWorldBible((previous) => ({
              ...previous,
              locations: touchesLocations ? moved.locations : previous.locations,
              tradeRoutes: touchesRoutes ? moved.tradeRoutes : previous.tradeRoutes,
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
              : kind === 'route'
              ? 'route'
              : 'tr';
          return `${prefix}_${stamp}_${counter++}`;
        },
      });
      if (clones.refs.length === 0) return 0;

      commit('Paste', () => {
        updateMapData((previous) => {
          const current = previous || mapData;
          return {
            ...current,
            terrainFeatures: [...current.terrainFeatures, ...clones.terrainFeatures],
            placements: [...current.placements, ...clones.placements],
            routes: [...(current.routes ?? []), ...clones.mapRoutes],
          };
        });
        if (clones.locations.length > 0 || clones.tradeRoutes.length > 0) {
          updateWorldBible((previous) => ({
            ...previous,
            locations: [...(previous.locations ?? []), ...clones.locations],
            tradeRoutes: [...(previous.tradeRoutes ?? []), ...clones.tradeRoutes],
          }));
        }
      });

      setSelection(clones.refs);
      return clones.refs.length;
    },
    [commit, isPersian, mapData, updateMapData, updateWorldBible]
  );

  const clipboardRef = useRef<MapClipboard | null>(null);
  const pasteStepRef = useRef(0);

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
  }, [isPersian, mapSettings, selectionSource, setActiveTool]);

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      const group = findGroupById(mapData.groups, groupId);
      if (group && group.memberRefs.length > 0) {
        setSelection(group.memberRefs);
      }
    },
    [mapData.groups]
  );

  const handleGroupSelection = useCallback(
    (mode: MapGroupMode, customName?: string) => {
      if (selection.length < 2) return;

      const defaultName =
        mode === 'unified_entity'
          ? isPersian ? 'انتینتی واحد داستان' : 'Unified Story Entity'
          : isPersian ? 'پوشه جدید' : 'New Group Folder';
      const name = customName?.trim() || defaultName;

      commit(
        `Group objects (${mode === 'unified_entity' ? 'Unified Story Entity' : 'Folder'})`,
        () => {
          const source: MapGroupSource = {
            terrainFeatures: mapData.terrainFeatures,
            placements: mapData.placements,
            locations: worldBible.locations,
            routes: mapData.routes,
            groups: mapData.groups,
          };

          const { updatedSource, group } = createMapGroup(source, selection, {
            name,
            mode,
            isPersian,
          });

          // Update mapData
          updateMapData((prev) => {
            if (!prev) return prev as any;
            return {
              ...prev,
              terrainFeatures: updatedSource.terrainFeatures ?? prev.terrainFeatures,
              placements: updatedSource.placements ?? prev.placements,
              routes: updatedSource.routes ?? prev.routes,
              groups: updatedSource.groups ?? prev.groups,
            };
          });

          // Update worldBible if locations changed
          if (updatedSource.locations) {
            updateWorldBible((prev) => ({
              ...prev,
              locations: updatedSource.locations!,
            }));
          }

          // Reselect the group members
          setSelection(group.memberRefs);

          notify.success(
            mode === 'unified_entity'
              ? isPersian
                ? `گروه‌بندی انتینتی واحد ایجاد شد: ${group.name}`
                : `Created Unified Story Entity: ${group.name}`
              : isPersian
              ? `پوشه سازمانی ایجاد شد: ${group.name}`
              : `Created Folder Group: ${group.name}`
          );
        }
      );
    },
    [selection, isPersian, commit, mapData, worldBible.locations, updateMapData, updateWorldBible]
  );

  const handleUngroup = useCallback(
    (groupId: string) => {
      const group = findGroupById(mapData.groups, groupId);
      if (!group) return;

      commit('Ungroup objects', () => {
        const source: MapGroupSource = {
          terrainFeatures: mapData.terrainFeatures,
          placements: mapData.placements,
          locations: worldBible.locations,
          routes: mapData.routes,
          groups: mapData.groups,
        };

        const updatedSource = ungroupMapGroup(source, groupId);

        updateMapData((prev) => {
          if (!prev) return prev as any;
          return {
            ...prev,
            terrainFeatures: updatedSource.terrainFeatures ?? prev.terrainFeatures,
            placements: updatedSource.placements ?? prev.placements,
            routes: updatedSource.routes ?? prev.routes,
            groups: updatedSource.groups ?? [],
          };
        });

        if (updatedSource.locations) {
          updateWorldBible((prev) => ({
            ...prev,
            locations: updatedSource.locations!,
          }));
        }

        notify.info(
          isPersian ? 'گروه منحل شد و عناصر مستقل شدند.' : 'Group dissolved into independent objects.'
        );
      });
    },
    [mapData, worldBible.locations, commit, updateMapData, updateWorldBible, isPersian]
  );

  const handleSetGroupMode = useCallback(
    (groupId: string, mode: MapGroupMode) => {
      commit('Change group mode', () => {
        const source: MapGroupSource = {
          terrainFeatures: mapData.terrainFeatures,
          placements: mapData.placements,
          locations: worldBible.locations,
          routes: mapData.routes,
          groups: mapData.groups,
        };

        const updatedSource = setMapGroupMode(source, groupId, mode);

        updateMapData((prev) => {
          if (!prev) return prev as any;
          return {
            ...prev,
            terrainFeatures: updatedSource.terrainFeatures ?? prev.terrainFeatures,
            placements: updatedSource.placements ?? prev.placements,
            routes: updatedSource.routes ?? prev.routes,
            groups: updatedSource.groups ?? prev.groups,
          };
        });

        if (updatedSource.locations) {
          updateWorldBible((prev) => ({
            ...prev,
            locations: updatedSource.locations!,
          }));
        }
      });
    },
    [mapData, worldBible.locations, commit, updateMapData, updateWorldBible]
  );

  const handleSetGroupLocation = useCallback(
    (groupId: string, locationId: string | undefined) => {
      commit('Set group location', () => {
        const source: MapGroupSource = {
          terrainFeatures: mapData.terrainFeatures,
          placements: mapData.placements,
          locations: worldBible.locations,
          routes: mapData.routes,
          groups: mapData.groups,
        };

        const updatedSource = setMapGroupLocation(source, groupId, locationId);

        updateMapData((prev) => {
          if (!prev) return prev as any;
          return {
            ...prev,
            terrainFeatures: updatedSource.terrainFeatures ?? prev.terrainFeatures,
            placements: updatedSource.placements ?? prev.placements,
            routes: updatedSource.routes ?? prev.routes,
            groups: updatedSource.groups ?? prev.groups,
          };
        });
      });
    },
    [mapData, worldBible.locations, commit, updateMapData]
  );

  const handleUpdateGroup = useCallback(
    (groupId: string, patch: Partial<MapGroup>) => {
      commit('Update group', () => {
        const source: MapGroupSource = {
          terrainFeatures: mapData.terrainFeatures,
          placements: mapData.placements,
          locations: worldBible.locations,
          routes: mapData.routes,
          groups: mapData.groups,
        };

        const updatedSource = updateMapGroup(source, groupId, patch);

        updateMapData((prev) => {
          if (!prev) return prev as any;
          return {
            ...prev,
            terrainFeatures: updatedSource.terrainFeatures ?? prev.terrainFeatures,
            placements: updatedSource.placements ?? prev.placements,
            routes: updatedSource.routes ?? prev.routes,
            groups: updatedSource.groups ?? prev.groups,
          };
        });

        if (updatedSource.locations) {
          updateWorldBible((prev) => ({
            ...prev,
            locations: updatedSource.locations!,
          }));
        }
      });
    },
    [mapData, worldBible.locations, commit, updateMapData, updateWorldBible]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      const group = findGroupById(mapData.groups, groupId);
      if (!group) return;
      void handleDeleteSelection(group.memberRefs);
    },
    [mapData.groups, handleDeleteSelection]
  );

  // Plan 23 authoring shortcuts — ignored while typing in a field.
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

      if (event.key === 'Delete' && selection.length > 0) {
        event.preventDefault();
        void handleDeleteSelection(selection);
        return;
      }
      if (event.key === 'Escape' && selection.length > 0) {
        setSelection([]);
        return;
      }

      // Plan 23 — arrow-key nudge. 1 world unit, 10 with Shift. Ctrl/Alt are
      // left alone so browser gestures (zoom, history) still work.
      if (
        selection.length > 0 &&
        (event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown')
      ) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        handleNudgeSelection(dx, dy);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === 'a') {
        event.preventDefault();
        handleSelectAll();
      } else if (key === 'c') {
        event.preventDefault();
        handleCopy();
      } else if (key === 'v') {
        event.preventDefault();
        handlePaste();
      } else if (key === 'd') {
        event.preventDefault();
        handleDuplicateSelection();
      } else if (key === 'g') {
        event.preventDefault();
        if (event.shiftKey) {
          if (currentGroup) handleUngroup(currentGroup.id);
        } else {
          if (selection.length >= 2) handleGroupSelection('unified_entity');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selection,
    currentGroup,
    handleDeleteSelection,
    handleSelectAll,
    handleCopy,
    handlePaste,
    handleDuplicateSelection,
    handleNudgeSelection,
    handleGroupSelection,
    handleUngroup,
  ]);

  return {
    selection,
    setSelection,
    selectedItems,
    selectedItem,
    currentGroup,
    handleSelectGroup,
    handleGroupSelection,
    handleUngroup,
    handleSetGroupMode,
    handleSetGroupLocation,
    handleUpdateGroup,
    handleDeleteGroup,
    removeFromSelection,
    handleDeleteSelection,
    handleMoveSelection,
    handleNudgeSelection,
    handleCopy,
    handlePaste,
    handleDuplicateSelection,
    handleSelectAll,
  };
}