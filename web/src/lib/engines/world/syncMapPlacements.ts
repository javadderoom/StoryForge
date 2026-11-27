/**
 * syncMapPlacements.ts
 *
 * Pure, deterministic utility that maps unplaced WorldBible entities and
 * StoryEncounters onto non-overlapping golden-angle orbital rings around their
 * anchor locations. Existing placements are preserved untouched.
 *
 * Pure module: no React, no Pixi, no DOM.
 */

import type {
  MapEntityPlacement,
  MapEntityPlacementType,
  MapPoint,
  StoryEncounter,
  WorldBible,
  WorldLocation,
} from '@/lib/types';

export interface SyncWorldEntitiesOptions {
  worldBible: WorldBible;
  encounters?: StoryEncounter[];
  /**
   * Optional allow-list of location IDs. When provided, only entities whose
   * resolved anchor belongs to this set are added to the map (useful for
   * scoping a single Act or corridor without flooding the whole continent).
   */
  scopeLocationIds?: Iterable<string>;
  /** Canvas clamp bounds (defaults to 2400x1600 with 40px margin). */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Minimum pixel spacing between pins (default 22). */
  minSpacing?: number;
}

export interface SyncWorldEntitiesResult {
  /** Newly generated placements only (does not include pre-existing ones). */
  added: MapEntityPlacement[];
  /** Combined existing + added placements ready to write to mapData.placements. */
  nextPlacements: MapEntityPlacement[];
  /** Breakdown of newly added pins by entityType. */
  countsByType: Partial<Record<MapEntityPlacementType, number>>;
  /** Number of entities skipped because they had no valid map anchor (or were outside scope). */
  skippedCount: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad

function clampPoint(p: MapPoint, width: number, height: number): MapPoint {
  return {
    x: Math.round(Math.max(40, Math.min(width - 40, p.x))),
    y: Math.round(Math.max(40, Math.min(height - 40, p.y))),
  };
}

function isValidMapAnchor(loc: WorldLocation | undefined, width: number, height: number): loc is WorldLocation & { coordinates: MapPoint } {
  if (!loc?.coordinates) return false;
  const { x, y } = loc.coordinates;
  return Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 && x <= width && y <= height;
}

function distSq(a: MapPoint, b: MapPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Finds the next non-overlapping orbital slot around `anchor` using a golden-angle
 * spiral that respects all already-occupied points (settlements + existing pins).
 */
function findOrbitalSlot(
  anchor: MapPoint,
  slotIndex: number,
  baseRadius: number,
  occupied: MapPoint[],
  minSpacing: number,
  width: number,
  height: number
): MapPoint {
  const minDistSq = minSpacing * minSpacing;
  for (let attempt = 0; attempt < 48; attempt++) {
    const k = slotIndex + attempt;
    const ring = Math.floor(k / 8);
    const radius = baseRadius + ring * 20;
    const angle = k * GOLDEN_ANGLE - Math.PI / 2;
    const candidate = clampPoint(
      {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
      },
      width,
      height
    );
    if (occupied.every((o) => distSq(o, candidate) >= minDistSq)) {
      return candidate;
    }
  }
  // Fallback outer ring
  const angle = slotIndex * GOLDEN_ANGLE;
  return clampPoint(
    {
      x: anchor.x + Math.cos(angle) * (baseRadius + 72),
      y: anchor.y + Math.sin(angle) * (baseRadius + 72),
    },
    width,
    height
  );
}

/**
 * Deterministically creates MapEntityPlacement pins for all unplaced entities
 * in `worldBible` and `encounters`. Never mutates or duplicates existing pins.
 */
export function syncWorldEntitiesToMap(options: SyncWorldEntitiesOptions): SyncWorldEntitiesResult {
  const {
    worldBible,
    encounters = [],
    scopeLocationIds,
    canvasWidth = worldBible.mapData?.settings?.width ?? 2400,
    canvasHeight = worldBible.mapData?.settings?.height ?? 1600,
    minSpacing = 22,
  } = options;

  const scopeSet = scopeLocationIds ? new Set(scopeLocationIds) : null;
  const locations = worldBible.locations ?? [];
  const locationById = new Map<string, WorldLocation>();
  const locationByNameLower = new Map<string, WorldLocation>();
  for (const loc of locations) {
    locationById.set(loc.id, loc);
    if (loc.name) {
      locationByNameLower.set(loc.name.trim().toLowerCase(), loc);
    }
  }

  const existing = worldBible.mapData?.placements ?? [];
  const existingKeySet = new Set(existing.map((p) => `${p.entityType}::${p.entityId}`));

  // Track occupied coordinates (settlement centers + existing pins) so new pins don't overlap
  const occupied: MapPoint[] = [];
  for (const loc of locations) {
    if (isValidMapAnchor(loc, canvasWidth, canvasHeight)) {
      occupied.push({ x: loc.coordinates.x, y: loc.coordinates.y });
    }
  }
  for (const pin of existing) {
    occupied.push({ x: pin.x, y: pin.y });
  }

  const slotCounters = new Map<string, number>();
  const nextSlotFor = (anchorId: string): number => {
    const curr = slotCounters.get(anchorId) ?? 0;
    slotCounters.set(anchorId, curr + 1);
    return curr;
  };

  const resolveLocationAnchor = (candidateIds: Array<string | undefined | null>): WorldLocation | null => {
    for (const id of candidateIds) {
      if (!id) continue;
      const direct = locationById.get(id);
      if (direct && isValidMapAnchor(direct, canvasWidth, canvasHeight)) {
        if (!scopeSet || scopeSet.has(direct.id)) return direct;
      }
      const byName = locationByNameLower.get(id.trim().toLowerCase());
      if (byName && isValidMapAnchor(byName, canvasWidth, canvasHeight)) {
        if (!scopeSet || scopeSet.has(byName.id)) return byName;
      }
    }
    return null;
  };

  const added: MapEntityPlacement[] = [];
  const countsByType: Partial<Record<MapEntityPlacementType, number>> = {};
  let skippedCount = 0;

  const tryPlace = (
    entityType: MapEntityPlacementType,
    entityId: string,
    label: string,
    anchor: WorldLocation | null,
    baseRadius: number,
    extra?: Partial<Pick<MapEntityPlacement, 'customIcon' | 'notes'>>
  ) => {
    const key = `${entityType}::${entityId}`;
    if (existingKeySet.has(key)) return;
    if (!anchor || !anchor.coordinates) {
      skippedCount++;
      return;
    }

    const slot = nextSlotFor(anchor.id);
    const point = findOrbitalSlot(
      anchor.coordinates,
      slot,
      baseRadius,
      occupied,
      minSpacing,
      canvasWidth,
      canvasHeight
    );
    occupied.push(point);
    existingKeySet.add(key);

    added.push({
      id: `pin_sync_${entityType}_${entityId}`,
      entityId,
      entityType,
      x: point.x,
      y: point.y,
      customLabel: label,
      ...(extra?.customIcon ? { customIcon: extra.customIcon } : {}),
      ...(extra?.notes ? { notes: extra.notes } : {}),
    });
    countsByType[entityType] = (countsByType[entityType] ?? 0) + 1;
  };

  // 1. Dynamic Encounters (Tier 3 macro pins — outer ring)
  for (const enc of encounters) {
    const anchor = resolveLocationAnchor([enc.locationId]);
    tryPlace('encounter', enc.id, enc.title, anchor, 38, {
      notes: enc.triggerConditions?.triggerType,
    });
  }

  // 2. Quests (Tier 3 macro pins)
  for (const quest of worldBible.quests ?? []) {
    const giverNpc = quest.giverNpcId
      ? (worldBible.npcs ?? []).find((n) => n.id === quest.giverNpcId)
      : undefined;
    const anchor = resolveLocationAnchor([quest.originLocationId, giverNpc?.currentLocationId]);
    tryPlace('quest', quest.id, quest.title, anchor, 34);
  }

  // 3. Factions (Tier 3 macro pins — territory headquarters)
  for (const faction of worldBible.factions ?? []) {
    const anchor = resolveLocationAnchor(faction.territoryIds ?? []);
    tryPlace('faction_outpost', faction.id, faction.name, anchor, 44);
  }

  // 4. Bestiary (Tier 3 macro pins — habitat anchors)
  for (const creature of worldBible.bestiary ?? []) {
    const anchor = resolveLocationAnchor(creature.habitatLocationIds ?? []);
    tryPlace('bestiary', creature.id, creature.name, anchor, 48, {
      notes: `Danger ${creature.dangerLevel}/5`,
    });
  }

  // 5. Timeline Events (Tier 3 macro pins)
  for (const evt of worldBible.timeline ?? []) {
    const anchor = resolveLocationAnchor(evt.linkedLocationIds ?? []);
    tryPlace('timeline', evt.id, evt.title, anchor, 42);
  }

  // 6. NPCs (Tier 4 tactical pins — inner ring around settlement)
  for (const npc of worldBible.npcs ?? []) {
    const anchor = resolveLocationAnchor([npc.currentLocationId]);
    tryPlace('npc', npc.id, npc.name, anchor, 26, {
      customIcon: npc.kind === 'template' ? 'group' : 'individual',
    });
  }

  // 7. Artifacts (Tier 4 tactical pins)
  for (const artifact of worldBible.artifacts ?? []) {
    const candidateAnchorIds: Array<string | undefined> = [];
    if (artifact.currentHolderType === 'location' || artifact.currentHolderType === 'vault') {
      candidateAnchorIds.push(artifact.currentHolderId);
    } else if (artifact.currentHolderType === 'npc') {
      const holderNpc = (worldBible.npcs ?? []).find((n) => n.id === artifact.currentHolderId);
      candidateAnchorIds.push(holderNpc?.currentLocationId);
    } else if (artifact.currentHolderType === 'faction') {
      const holderFac = (worldBible.factions ?? []).find((f) => f.id === artifact.currentHolderId);
      candidateAnchorIds.push(...(holderFac?.territoryIds ?? []));
    }
    const anchor = resolveLocationAnchor(candidateAnchorIds);
    tryPlace('artifact', artifact.id, artifact.name, anchor, 30);
  }

  // 8. Deities / Shrines (Tier 4 tactical pins)
  for (const deity of worldBible.religions ?? []) {
    const anchor = resolveLocationAnchor(deity.holyLocationIds ?? []);
    tryPlace('deity', deity.id, deity.name, anchor, 32);
  }

  return {
    added,
    nextPlacements: [...existing, ...added],
    countsByType,
    skippedCount,
  };
}
