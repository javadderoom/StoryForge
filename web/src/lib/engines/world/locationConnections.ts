import type { LocationConnectionDirection, WorldLocation } from '@/lib/types/world';

export type EffectiveConnectionKind = 'two_way' | 'one_way_out' | 'one_way_in';

export interface EffectiveLocationConnection {
  location: WorldLocation;
  kind: EffectiveConnectionKind;
}

/**
 * Returns the direction of an authored link from `location` to `targetId`.
 * Legacy/omitted entries always default to `'two_way'`.
 */
export function getConnectionDirection(
  location: Pick<WorldLocation, 'connectionDirections'> | undefined | null,
  targetId: string
): LocationConnectionDirection {
  return location?.connectionDirections?.[targetId] === 'one_way' ? 'one_way' : 'two_way';
}

/**
 * Normalizes `connectionDirections` so every target in `connectedLocationIds`
 * has an explicit `'two_way' | 'one_way'` entry and stale keys are pruned.
 */
export function normalizeConnectionDirections(
  connectedLocationIds: string[] = [],
  connectionDirections?: Record<string, LocationConnectionDirection>
): Record<string, LocationConnectionDirection> {
  const result: Record<string, LocationConnectionDirection> = {};
  for (const id of connectedLocationIds) {
    result[id] = connectionDirections?.[id] === 'one_way' ? 'one_way' : 'two_way';
  }
  return result;
}

/**
 * Returns all locations reachable FROM `locationId`, honoring `'two_way'` vs
 * `'one_way'` semantics:
 * - Any outgoing target in `loc.connectedLocationIds` is reachable.
 * - Any incoming link `other -> locationId` is reachable iff `other`'s link
 *   is `'two_way'` (default).
 */
export function getReachableNeighborIds(
  locationId: string,
  locations: WorldLocation[] = []
): string[] {
  const loc = locations.find((l) => l.id === locationId);
  if (!loc) return [];
  const reachable = new Set<string>(
    (loc.connectedLocationIds ?? []).filter((id) => id !== locationId)
  );
  for (const other of locations) {
    if (other.id === locationId) continue;
    if (
      (other.connectedLocationIds ?? []).includes(locationId) &&
      getConnectionDirection(other, locationId) === 'two_way'
    ) {
      reachable.add(other.id);
    }
  }
  return Array.from(reachable);
}

/** True when `locationId` participates in at least one outgoing or incoming link. */
export function hasAnyLocationLink(
  locationId: string,
  locations: WorldLocation[] = []
): boolean {
  const loc = locations.find((l) => l.id === locationId);
  if (loc && (loc.connectedLocationIds ?? []).length > 0) return true;
  return locations.some(
    (other) => other.id !== locationId && (other.connectedLocationIds ?? []).includes(locationId)
  );
}

/**
 * Computes every connection touching `locationId` for UI display so that any
 * link (two-way or one-way) is visible on BOTH endpoints.
 */
export function getEffectiveConnectionsForLocation(
  locationId: string,
  locations: WorldLocation[] = []
): EffectiveLocationConnection[] {
  const byId = new Map<string, WorldLocation>(locations.map((l) => [l.id, l]));
  const self = byId.get(locationId);
  if (!self) return [];

  const result = new Map<string, EffectiveLocationConnection>();

  for (const targetId of self.connectedLocationIds ?? []) {
    if (targetId === locationId) continue;
    const target = byId.get(targetId);
    if (!target) continue;
    const dir = getConnectionDirection(self, targetId);
    result.set(targetId, {
      location: target,
      kind: dir === 'one_way' ? 'one_way_out' : 'two_way',
    });
  }

  for (const other of locations) {
    if (other.id === locationId) continue;
    if (!(other.connectedLocationIds ?? []).includes(locationId)) continue;
    if (result.has(other.id)) continue;
    const dir = getConnectionDirection(other, locationId);
    result.set(other.id, {
      location: other,
      kind: dir === 'one_way' ? 'one_way_in' : 'two_way',
    });
  }

  return Array.from(result.values());
}

/**
 * Synchronizes peer `connectedLocationIds` and `connectionDirections` when a
 * location is added or edited:
 * - `'two_way'` links are mirrored onto the target location.
 * - `'one_way'` links are kept strictly on the source location and removed from the target.
 * - Removing a `'two_way'` link removes the reverse `'two_way'` entry from the peer,
 *   while preserving any independent `'one_way'` link authored on the peer.
 */
export function syncLocationConnections(
  locations: WorldLocation[],
  savedLocation: WorldLocation
): WorldLocation[] {
  const cleanedIds = Array.from(
    new Set((savedLocation.connectedLocationIds ?? []).filter((id) => id !== savedLocation.id))
  );
  const cleanedDirs = normalizeConnectionDirections(cleanedIds, savedLocation.connectionDirections);
  const normalizedSaved: WorldLocation = {
    ...savedLocation,
    connectedLocationIds: cleanedIds,
    connectionDirections: cleanedDirs,
  };

  const exists = locations.some((l) => l.id === normalizedSaved.id);
  const nextList = exists
    ? locations.map((l) => (l.id === normalizedSaved.id ? normalizedSaved : l))
    : [...locations, normalizedSaved];

  const savedTargets = new Set(cleanedIds);

  return nextList.map((loc) => {
    if (loc.id === normalizedSaved.id) return loc;

    const peerIds = new Set(loc.connectedLocationIds ?? []);
    const peerDirs: Record<string, LocationConnectionDirection> = {
      ...(loc.connectionDirections ?? {}),
    };
    let changed = false;

    if (savedTargets.has(loc.id)) {
      const dir = cleanedDirs[loc.id];
      if (dir === 'two_way') {
        if (!peerIds.has(normalizedSaved.id)) {
          peerIds.add(normalizedSaved.id);
          changed = true;
        }
        if (peerDirs[normalizedSaved.id] !== 'two_way') {
          peerDirs[normalizedSaved.id] = 'two_way';
          changed = true;
        }
      } else {
        // Explicit one_way from saved -> loc: ensure loc does not mirror back
        if (peerIds.has(normalizedSaved.id)) {
          peerIds.delete(normalizedSaved.id);
          changed = true;
        }
        if (peerDirs[normalizedSaved.id] !== undefined) {
          delete peerDirs[normalizedSaved.id];
          changed = true;
        }
      }
    } else if (peerIds.has(normalizedSaved.id)) {
      // saved dropped loc from its list: remove only if peer's link was two_way
      if (getConnectionDirection(loc, normalizedSaved.id) === 'two_way') {
        peerIds.delete(normalizedSaved.id);
        delete peerDirs[normalizedSaved.id];
        changed = true;
      }
    }

    if (!changed) return loc;
    const nextIds = Array.from(peerIds);
    return {
      ...loc,
      connectedLocationIds: nextIds,
      connectionDirections: normalizeConnectionDirections(nextIds, peerDirs),
    };
  });
}

/**
 * Backfills all existing location links to explicit `'two_way'` defaults and
 * mirrors asymmetric legacy links that are not explicitly `'one_way'`.
 */
export function backfillTwoWayConnections(locations: WorldLocation[]): WorldLocation[] {
  const byId = new Map<string, WorldLocation>(
    locations.map((l) => [
      l.id,
      {
        ...l,
        connectedLocationIds: Array.from(new Set((l.connectedLocationIds ?? []).filter((id) => id !== l.id))),
        connectionDirections: { ...(l.connectionDirections ?? {}) },
      },
    ])
  );

  for (const loc of byId.values()) {
    for (const targetId of [...loc.connectedLocationIds]) {
      const target = byId.get(targetId);
      if (!target) continue;
      const dir = getConnectionDirection(loc, targetId);
      loc.connectionDirections![targetId] = dir;
      if (dir === 'two_way') {
        if (!target.connectedLocationIds.includes(loc.id)) {
          target.connectedLocationIds.push(loc.id);
        }
        target.connectionDirections![loc.id] = 'two_way';
      }
    }
  }

  return Array.from(byId.values()).map((loc) => ({
    ...loc,
    connectionDirections: normalizeConnectionDirections(
      loc.connectedLocationIds,
      loc.connectionDirections
    ),
  }));
}
