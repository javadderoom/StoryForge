/**
 * mapGroups.ts
 *
 * Plan 28 — Universal Map Grouping: Unified Story Entities vs. Folder Groups
 *
 * Implements two distinct grouping semantics:
 * 1. Unified Story Entity (`unified_entity`):
 *    - All member parts represent ONE single canonical World Entity in the Story World.
 *    - Synchronizes the same canonical `locationId` across all constituent geometries.
 *    - The Game Engine and AI Oracle resolve any point inside any member to that location.
 *    - Secondary branches/parts suppress redundant curved text labels.
 * 2. Organizational Folder (`folder`):
 *    - Canvas/layout grouping only.
 *    - Members maintain their own distinct identities and independent `locationId`s.
 *    - The Game Engine treats them as separate entities.
 *
 * Both modes are 100% losslessly reversible: Ungrouping (`ungroupMapGroup`) removes the
 * group container and clears `groupId` without modifying or distorting any member geometry.
 */

import type {
  MapGroup,
  MapGroupMode,
  MapTerrainFeature,
  MapEntityPlacement,
  WorldLocation,
  MapRoute,
} from '@/lib/types/world';
import { type MapObjectRef, mapObjectRefKey, toggleMapObjectRef } from './mapSelection';

export interface MapGroupSource {
  terrainFeatures?: MapTerrainFeature[];
  placements?: MapEntityPlacement[];
  locations?: WorldLocation[];
  routes?: MapRoute[];
  groups?: MapGroup[];
}

export interface CreateMapGroupOptions {
  name: string;
  mode: MapGroupMode;
  locationId?: string;
  primaryRef?: MapObjectRef;
  isPersian?: boolean;
}

/**
 * Generates a unique group ID.
 */
export function generateGroupId(): string {
  return `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Finds the MapGroup that contains a given reference.
 */
export function findGroupForRef(groups: MapGroup[] | undefined, ref: MapObjectRef): MapGroup | undefined {
  if (!groups || groups.length === 0) return undefined;
  return groups.find((g) => g.memberRefs.some((m) => m.kind === ref.kind && m.id === ref.id));
}

/**
 * Finds a MapGroup by its unique ID.
 */
export function findGroupById(groups: MapGroup[] | undefined, groupId: string): MapGroup | undefined {
  if (!groups) return undefined;
  return groups.find((g) => g.id === groupId);
}

/**
 * Checks if all selected references belong to the exact same group.
 */
export function areRefsInSameGroup(groups: MapGroup[] | undefined, refs: MapObjectRef[]): MapGroup | null {
  if (!groups || refs.length === 0) return null;
  const firstGroup = findGroupForRef(groups, refs[0]);
  if (!firstGroup) return null;

  for (let i = 1; i < refs.length; i++) {
    const g = findGroupForRef(groups, refs[i]);
    if (!g || g.id !== firstGroup.id) return null;
  }
  return firstGroup;
}

/**
 * Expands a selection so that selecting any member of a group selects all members of that group.
 */
export function expandSelectionToGroups(
  refs: MapObjectRef[],
  groups: MapGroup[] | undefined,
  options: { drillDown?: boolean } = {}
): MapObjectRef[] {
  if (!groups || groups.length === 0 || options.drillDown) return refs;

  const resultSet = new Map<string, MapObjectRef>();
  for (const ref of refs) {
    const group = findGroupForRef(groups, ref);
    if (group) {
      for (const member of group.memberRefs) {
        resultSet.set(`${member.kind}:${member.id}`, member);
      }
    } else {
      resultSet.set(`${ref.kind}:${ref.id}`, ref);
    }
  }

  return Array.from(resultSet.values());
}

/**
 * Toggles a ref with group-level cohesion (Shift/Ctrl click).
 * If the clicked ref belongs to a group and any of its members are currently selected,
 * the entire group is deselected. If none are selected, the entire group is added.
 */
export function toggleMapObjectRefWithGroups(
  refs: MapObjectRef[],
  ref: MapObjectRef,
  groups: MapGroup[] | undefined
): MapObjectRef[] {
  if (!groups || groups.length === 0) {
    return toggleMapObjectRef(refs, ref);
  }
  const group = findGroupForRef(groups, ref);
  if (!group) {
    return toggleMapObjectRef(refs, ref);
  }
  const groupKeys = new Set(group.memberRefs.map(mapObjectRefKey));
  const hasMember = refs.some((r) => groupKeys.has(mapObjectRefKey(r)));
  if (hasMember) {
    return refs.filter((r) => !groupKeys.has(mapObjectRefKey(r)));
  }
  const next = [...refs];
  for (const member of group.memberRefs) {
    if (!next.some((r) => mapObjectRefKey(r) === mapObjectRefKey(member))) {
      next.push(member);
    }
  }
  return next;
}

/**
 * Creates a new MapGroup (Unified Story Entity or Folder Group) from selected references.
 */
export function createMapGroup(
  source: MapGroupSource,
  refs: MapObjectRef[],
  options: CreateMapGroupOptions
): { updatedSource: MapGroupSource; group: MapGroup } {
  const groupId = generateGroupId();
  const existingGroups = source.groups ?? [];

  // Determine primary reference (default to first ref, or main river stem without connectedRiverId)
  let primaryRef = options.primaryRef ?? refs[0];
  if (source.terrainFeatures && refs.some((r) => r.kind === 'terrain')) {
    const mainRiver = source.terrainFeatures.find(
      (f) => refs.some((r) => r.kind === 'terrain' && r.id === f.id) && f.type === 'river' && !f.connectedRiverId
    );
    if (mainRiver) {
      primaryRef = { kind: 'terrain', id: mainRiver.id };
    }
  }

  // Determine authoritative locationId for unified_entity mode
  let effectiveLocationId = options.locationId;
  if (options.mode === 'unified_entity' && !effectiveLocationId) {
    // Check if any member already has a linked locationId
    for (const ref of refs) {
      if (ref.kind === 'terrain') {
        const feat = source.terrainFeatures?.find((f) => f.id === ref.id);
        if (feat?.locationId) {
          effectiveLocationId = feat.locationId;
          break;
        }
      } else if (ref.kind === 'location') {
        effectiveLocationId = ref.id;
        break;
      }
    }
  }

  const group: MapGroup = {
    id: groupId,
    name: options.name,
    mode: options.mode,
    locationId: effectiveLocationId,
    primaryRef,
    memberRefs: [...refs],
    visible: true,
    locked: false,
    collapsed: false,
  };

  const refSet = new Set(refs.map((r) => `${r.kind}:${r.id}`));

  // 1. Update terrain features
  const updatedTerrain = (source.terrainFeatures ?? []).map((feat) => {
    if (!refSet.has(`terrain:${feat.id}`)) return feat;
    const isPrimary = primaryRef?.kind === 'terrain' && primaryRef.id === feat.id;
    return {
      ...feat,
      groupId,
      locationId: options.mode === 'unified_entity' && effectiveLocationId ? effectiveLocationId : feat.locationId,
      // In unified_entity mode, suppress secondary curved labels so only the primary stem displays text
      labelConfig:
        options.mode === 'unified_entity' && !isPrimary
          ? { ...feat.labelConfig, enabled: false }
          : feat.labelConfig,
    };
  });

  // 2. Update entity placements
  const updatedPlacements = (source.placements ?? []).map((pin) => {
    if (!refSet.has(`placement:${pin.id}`)) return pin;
    return {
      ...pin,
      groupId,
    };
  });

  // 3. Update locations
  const updatedLocations = (source.locations ?? []).map((loc) => {
    if (!refSet.has(`location:${loc.id}`)) return loc;
    return {
      ...loc,
      groupId,
    };
  });

  // 4. Update routes
  const updatedRoutes = (source.routes ?? []).map((route) => {
    if (!refSet.has(`route:${route.id}`)) return route;
    return {
      ...route,
      groupId,
    };
  });

  return {
    updatedSource: {
      ...source,
      terrainFeatures: updatedTerrain,
      placements: updatedPlacements,
      locations: updatedLocations,
      routes: updatedRoutes,
      groups: [...existingGroups, group],
    },
    group,
  };
}

/**
 * Ungroups a MapGroup cleanly without data loss.
 * Removes the group container and clears groupId on all constituent members.
 */
export function ungroupMapGroup(
  source: MapGroupSource,
  groupId: string
): { updatedSource: MapGroupSource } {
  const existingGroups = source.groups ?? [];
  const targetGroup = existingGroups.find((g) => g.id === groupId);
  if (!targetGroup) return { updatedSource: source };

  const memberSet = new Set(targetGroup.memberRefs.map((r) => `${r.kind}:${r.id}`));

  // Clear groupId on terrain
  const updatedTerrain = (source.terrainFeatures ?? []).map((feat) => {
    if (feat.groupId === groupId || memberSet.has(`terrain:${feat.id}`)) {
      const next = { ...feat };
      delete next.groupId;
      return next;
    }
    return feat;
  });

  // Clear groupId on placements
  const updatedPlacements = (source.placements ?? []).map((pin) => {
    if (pin.groupId === groupId || memberSet.has(`placement:${pin.id}`)) {
      const next = { ...pin };
      delete next.groupId;
      return next;
    }
    return pin;
  });

  // Clear groupId on locations
  const updatedLocations = (source.locations ?? []).map((loc) => {
    if (loc.groupId === groupId || memberSet.has(`location:${loc.id}`)) {
      const next = { ...loc };
      delete next.groupId;
      return next;
    }
    return loc;
  });

  // Clear groupId on routes
  const updatedRoutes = (source.routes ?? []).map((route) => {
    if (route.groupId === groupId || memberSet.has(`route:${route.id}`)) {
      const next = { ...route };
      delete next.groupId;
      return next;
    }
    return route;
  });

  return {
    updatedSource: {
      ...source,
      terrainFeatures: updatedTerrain,
      placements: updatedPlacements,
      locations: updatedLocations,
      routes: updatedRoutes,
      groups: existingGroups.filter((g) => g.id !== groupId),
    },
  };
}

/**
 * Updates a MapGroup's mode ('unified_entity' vs. 'folder') and synchronizes locationId if needed.
 */
export function setMapGroupMode(
  source: MapGroupSource,
  groupId: string,
  newMode: MapGroupMode
): { updatedSource: MapGroupSource; group: MapGroup | null } {
  const existingGroups = source.groups ?? [];
  const group = existingGroups.find((g) => g.id === groupId);
  if (!group) return { updatedSource: source, group: null };

  const updatedGroup: MapGroup = {
    ...group,
    mode: newMode,
  };

  let updatedTerrain = source.terrainFeatures ?? [];
  if (newMode === 'unified_entity' && group.locationId) {
    const memberSet = new Set(group.memberRefs.map((r) => `${r.kind}:${r.id}`));
    updatedTerrain = updatedTerrain.map((feat) => {
      if (!memberSet.has(`terrain:${feat.id}`)) return feat;
      const isPrimary = group.primaryRef?.kind === 'terrain' && group.primaryRef.id === feat.id;
      return {
        ...feat,
        locationId: group.locationId,
        labelConfig: !isPrimary ? { ...feat.labelConfig, enabled: false } : feat.labelConfig,
      };
    });
  }

  return {
    updatedSource: {
      ...source,
      terrainFeatures: updatedTerrain,
      groups: existingGroups.map((g) => (g.id === groupId ? updatedGroup : g)),
    },
    group: updatedGroup,
  };
}

/**
 * Assigns or updates the canonical WorldLocation for a MapGroup.
 * In 'unified_entity' mode, automatically cascades locationId to all constituent member elements!
 */
export function setMapGroupLocation(
  source: MapGroupSource,
  groupId: string,
  locationId: string | undefined
): { updatedSource: MapGroupSource; group: MapGroup | null } {
  const existingGroups = source.groups ?? [];
  const group = existingGroups.find((g) => g.id === groupId);
  if (!group) return { updatedSource: source, group: null };

  const updatedGroup: MapGroup = {
    ...group,
    locationId,
  };

  let updatedTerrain = source.terrainFeatures ?? [];
  if (group.mode === 'unified_entity') {
    const memberSet = new Set(group.memberRefs.map((r) => `${r.kind}:${r.id}`));
    updatedTerrain = updatedTerrain.map((feat) => {
      if (!memberSet.has(`terrain:${feat.id}`)) return feat;
      return {
        ...feat,
        locationId,
      };
    });
  }

  return {
    updatedSource: {
      ...source,
      terrainFeatures: updatedTerrain,
      groups: existingGroups.map((g) => (g.id === groupId ? updatedGroup : g)),
    },
    group: updatedGroup,
  };
}

/**
 * Updates properties of a MapGroup (e.g. name, visible, locked).
 */
export function updateMapGroup(
  source: MapGroupSource,
  groupId: string,
  patch: Partial<Omit<MapGroup, 'id' | 'memberRefs'>>
): { updatedSource: MapGroupSource; group: MapGroup | null } {
  const existingGroups = source.groups ?? [];
  const group = existingGroups.find((g) => g.id === groupId);
  if (!group) return { updatedSource: source, group: null };

  const updatedGroup: MapGroup = {
    ...group,
    ...patch,
  };

  // If visibility or lock state changed, cascade to member elements
  let updatedTerrain = source.terrainFeatures ?? [];
  let updatedPlacements = source.placements ?? [];
  let updatedLocations = source.locations ?? [];
  let updatedRoutes = source.routes ?? [];

  if (patch.visible !== undefined || patch.locked !== undefined) {
    const memberSet = new Set(group.memberRefs.map((r) => `${r.kind}:${r.id}`));

    if (source.terrainFeatures) {
      updatedTerrain = source.terrainFeatures.map((feat) => {
        if (!memberSet.has(`terrain:${feat.id}`)) return feat;
        return {
          ...feat,
          visible: patch.visible !== undefined ? patch.visible : feat.visible,
          locked: patch.locked !== undefined ? patch.locked : feat.locked,
        };
      });
    }

    if (source.placements) {
      updatedPlacements = source.placements.map((pin) => {
        if (!memberSet.has(`placement:${pin.id}`)) return pin;
        return {
          ...pin,
          visible: patch.visible !== undefined ? patch.visible : pin.visible,
          locked: patch.locked !== undefined ? patch.locked : pin.locked,
        };
      });
    }

    if (source.locations) {
      updatedLocations = source.locations.map((loc) => {
        if (!memberSet.has(`location:${loc.id}`)) return loc;
        return {
          ...loc,
          visible: patch.visible !== undefined ? patch.visible : loc.visible,
          locked: patch.locked !== undefined ? patch.locked : loc.locked,
        };
      });
    }

    if (source.routes) {
      updatedRoutes = source.routes.map((route) => {
        if (!memberSet.has(`route:${route.id}`)) return route;
        return {
          ...route,
          visible: patch.visible !== undefined ? patch.visible : route.visible,
          locked: patch.locked !== undefined ? patch.locked : route.locked,
        };
      });
    }
  }

  return {
    updatedSource: {
      ...source,
      terrainFeatures: updatedTerrain,
      placements: updatedPlacements,
      locations: updatedLocations,
      routes: updatedRoutes,
      groups: existingGroups.map((g) => (g.id === groupId ? updatedGroup : g)),
    },
    group: updatedGroup,
  };
}
