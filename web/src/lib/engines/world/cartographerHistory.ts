import type { WorldLocation, WorldMapData, WorldTradeRoute } from '@/lib/types/world';

/**
 * Cartographer undo/redo history.
 *
 * The Cartographer mutates the World Bible through the Studio context, so the
 * only safe way to undo an authoring action is to restore a snapshot of the
 * slices the map owns. This module is deliberately pure (no React, no context,
 * no DOM): the page captures a snapshot before every mutating action and hands
 * it here; the module decides what can be undone and what state comes back.
 *
 * Design notes:
 *  - `past` holds the PRE-state of each action, plus the post-state once that
 *    action has been undone (so redo can put it back).
 *  - `future` holds undone actions, newest first.
 *  - The stack is bounded: a world with hundreds of locations would otherwise
 *    grow the history without limit.
 *  - Restoring MERGES the fields the Cartographer owns instead of replacing
 *    whole objects, so a lore field edited elsewhere (threat clock, parent
 *    link, special rules…) survives an undo of a pin move.
 *  - Pure functions keep the behaviour unit-testable without a browser.
 */

/** The location fields the Cartographer is allowed to own. */
export const CARTOGRAPHER_LOCATION_FIELDS = [
  'coordinates',
  'coordinatesSource',
  'name',
  'region',
  'dangerLevel',
  'category',
  'atmosphere',
  'description',
] as const;

/** The trade-route fields the Cartographer is allowed to own. */
export const CARTOGRAPHER_ROUTE_FIELDS = [
  'name',
  'status',
  'dangerLevel',
  'smugglingRiskDC',
  'controllingFactionId',
  'description',
  'waypoints',
] as const;

export interface NpcStation {
  id: string;
  currentLocationId?: string;
}

export interface CartographerSnapshot {
  locations: WorldLocation[];
  tradeRoutes: WorldTradeRoute[];
  /** Only WHERE an NPC stands — the map owns nothing else about an NPC. */
  npcStations: NpcStation[];
  mapData: WorldMapData | undefined;
}

export interface CartographerHistoryEntry {
  /** Human-readable action name, shown in the undo/redo tooltip and toast. */
  label: string;
  /** State before the action ran. */
  before: CartographerSnapshot;
  /** State after the action ran — filled in when the action is undone. */
  after?: CartographerSnapshot;
  /** Timestamp of the last push — used to coalesce a burst of the same action. */
  at: number;
}

export interface CartographerHistory {
  past: CartographerHistoryEntry[];
  future: CartographerHistoryEntry[];
}

/** Maximum number of undoable actions kept in memory. */
export const CARTOGRAPHER_HISTORY_LIMIT = 50;

/**
 * Two edits with the same label inside this window are treated as ONE action
 * (a burst of typing in the inspector), so undo reverts the whole burst
 * instead of one character.
 */
export const CARTOGRAPHER_COALESCE_MS = 800;

export function createCartographerHistory(): CartographerHistory {
  return { past: [], future: [] };
}

/**
 * Records a new action. The snapshot is the state BEFORE the action ran, so
 * undo restores exactly that. A new action invalidates the redo stack.
 *
 * When `coalesceMs` is set and the previous entry carries the same label, the
 * new action is folded into it — the earliest pre-state is kept, so one undo
 * reverts the entire burst.
 */
export function pushCartographerHistory(
  history: CartographerHistory,
  label: string,
  before: CartographerSnapshot,
  options?: { coalesceMs?: number; now?: number }
): CartographerHistory {
  const now = options?.now ?? Date.now();
  const coalesceMs = options?.coalesceMs ?? 0;
  const last = history.past[history.past.length - 1];

  if (
    coalesceMs > 0 &&
    last &&
    last.label === label &&
    history.future.length === 0 &&
    now - last.at <= coalesceMs
  ) {
    const past = [...history.past];
    past[past.length - 1] = { ...last, at: now };
    return { past, future: [] };
  }

  const entry: CartographerHistoryEntry = { label, before, at: now };
  const past = [...history.past, entry];
  return {
    past:
      past.length > CARTOGRAPHER_HISTORY_LIMIT
        ? past.slice(past.length - CARTOGRAPHER_HISTORY_LIMIT)
        : past,
    future: [],
  };
}

export interface CartographerHistoryResult {
  history: CartographerHistory;
  /** The snapshot to restore into the World Bible. */
  restored: CartographerSnapshot;
  /** Label of the action that was undone / redone. */
  label: string;
}

/**
 * Undoes the last action.
 *
 * `current` is the live state right now — it becomes the "after" state of the
 * undone action, which is what redo puts back. Returns null when there is
 * nothing to undo.
 */
export function undoCartographerHistory(
  history: CartographerHistory,
  current: CartographerSnapshot
): CartographerHistoryResult | null {
  if (history.past.length === 0) return null;
  const entry = history.past[history.past.length - 1];
  const undone: CartographerHistoryEntry = {
    label: entry.label,
    before: entry.before,
    after: current,
    at: Date.now(),
  };
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [undone, ...history.future].slice(0, CARTOGRAPHER_HISTORY_LIMIT),
    },
    restored: entry.before,
    label: entry.label,
  };
}

/**
 * Redoes the most recently undone action. Returns null when there is nothing
 * to redo.
 */
export function redoCartographerHistory(
  history: CartographerHistory
): CartographerHistoryResult | null {
  if (history.future.length === 0) return null;
  const entry = history.future[0];
  const restored = entry.after ?? entry.before;
  const now = Date.now();
  return {
    history: {
      past: [...history.past, { label: entry.label, before: entry.before, after: entry.after, at: now }],
      future: history.future.slice(1),
    },
    restored,
    label: entry.label,
  };
}

/** Label of the action `Ctrl+Z` would undo, if any. */
export function peekUndoLabel(history: CartographerHistory): string | null {
  return history.past.length ? history.past[history.past.length - 1].label : null;
}

/** Label of the action `Ctrl+Shift+Z` would redo, if any. */
export function peekRedoLabel(history: CartographerHistory): string | null {
  return history.future.length ? history.future[0].label : null;
}

// ---------------------------------------------------------------------------
// Restoring
// ---------------------------------------------------------------------------

function mergeOwnedFields<T extends object>(
  target: T,
  source: T,
  fields: readonly (keyof T)[]
): T {
  const out = { ...target } as T;
  for (const field of fields) {
    const value = source[field];
    if (value === undefined) {
      delete out[field];
    } else {
      out[field] = value;
    }
  }
  return out;
}

/**
 * Produces the World Bible slices to write back after an undo/redo.
 *
 * - Locations and routes are rebuilt from the snapshot (so an entity the
 *   Cartographer added disappears again, and one it deleted comes back), but
 *   only the fields the Cartographer owns are overwritten — a lore field
 *   edited elsewhere survives.
 * - NPC stationing is applied by id onto the live NPC list, so NPC records
 *   themselves are never replaced.
 * - The map data (terrain, pins, settings) is Cartographer-owned outright.
 */
export function mergeCartographerSnapshot(
  current: CartographerSnapshot,
  snapshot: CartographerSnapshot
): CartographerSnapshot {
  const currentLocations = new Map(current.locations.map((l) => [l.id, l]));
  const locations = snapshot.locations.map((snapLoc) => {
    const live = currentLocations.get(snapLoc.id);
    return live ? mergeOwnedFields(live, snapLoc, CARTOGRAPHER_LOCATION_FIELDS) : { ...snapLoc };
  });

  const currentRoutes = new Map(current.tradeRoutes.map((r) => [r.id, r]));
  const tradeRoutes = snapshot.tradeRoutes.map((snapRoute) => {
    const live = currentRoutes.get(snapRoute.id);
    return live ? mergeOwnedFields(live, snapRoute, CARTOGRAPHER_ROUTE_FIELDS) : { ...snapRoute };
  });

  return {
    locations,
    tradeRoutes,
    npcStations: snapshot.npcStations.map((s) => ({ ...s })),
    mapData: snapshot.mapData,
  };
}
