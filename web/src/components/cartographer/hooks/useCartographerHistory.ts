'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorldBible } from '@/lib/types';
import { getDefaultOntology } from '@/lib/context/StudioStoryContext';
import { notify } from '@/lib/notify';
import {
  CARTOGRAPHER_COALESCE_MS,
  createCartographerHistory,
  mergeCartographerSnapshot,
  pushCartographerHistory,
  redoCartographerHistory,
  undoCartographerHistory,
  type CartographerHistory,
  type CartographerSnapshot,
} from '@/lib/engines/world/cartographerHistory';

type UpdateWorldBible = (updater: (previous: WorldBible) => WorldBible) => void;

interface UseCartographerHistoryOptions {
  worldBible: WorldBible;
  updateWorldBible: UpdateWorldBible;
  isPersian: boolean;
}

/**
 * Every authoring action pushes a pre-state snapshot, so Ctrl+Z / Ctrl+Shift+Z
 * work across terrain, pins, routes, NPC stationing and the Plan 19 refit.
 */
export function useCartographerHistory({
  worldBible,
  updateWorldBible,
  isPersian,
}: UseCartographerHistoryOptions) {
  const [history, setHistory] = useState<CartographerHistory>(createCartographerHistory());

  const captureSnapshot = useCallback((): CartographerSnapshot => {
    return {
      locations: structuredClone(worldBible.locations ?? []),
      tradeRoutes: structuredClone(worldBible.tradeRoutes ?? []),
      npcStations: (worldBible.npcs ?? []).map((npc) => ({
        id: npc.id,
        currentLocationId: npc.currentLocationId,
      })),
      mapData: worldBible.mapData ? structuredClone(worldBible.mapData) : undefined,
    };
  }, [worldBible]);

  const restoreSnapshot = useCallback(
    (snapshot: CartographerSnapshot) => {
      const merged = mergeCartographerSnapshot(captureSnapshot(), snapshot);
      updateWorldBible((previous) => ({
        ...previous,
        locations: merged.locations,
        tradeRoutes: merged.tradeRoutes,
        npcs: (previous.npcs ?? []).map((npc) => {
          const station = merged.npcStations.find((entry) => entry.id === npc.id);
          if (!station) return npc;
          if (station.currentLocationId === undefined) {
            const rest = { ...npc } as unknown as Record<string, unknown>;
            delete rest.currentLocationId;
            return rest as unknown as typeof npc;
          }
          return { ...npc, currentLocationId: station.currentLocationId } as typeof npc;
        }),
        mapData: merged.mapData,
        ontology: {
          ...(previous.ontology || getDefaultOntology(isPersian)),
          mapData: merged.mapData,
        },
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
      setHistory((current) => pushCartographerHistory(current, label, before, { coalesceMs }));
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
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    history,
    captureSnapshot,
    restoreSnapshot,
    commit,
    handleUndo,
    handleRedo,
  };
}