/**
 * syncMapPlacements.ts
 *
 * Pure, deterministic utility that maps unplaced WorldBible entities and
 * StoryEncounters onto non-overlapping golden-angle orbital rings around their
 * anchor locations. Supports multi-habitat placement for bestiary creatures
 * and wider ecological scatter for non-settlement biome/region anchors.
 * Existing placements are preserved untouched.
 *
 * Pure module: no React, no Pixi, no DOM.
 */

import type {
  CustomPlaceCategory,
  MapEntityPlacement,
  MapEntityPlacementType,
  MapPoint,
  StoryEncounter,
  WorldBible,
  WorldLocation,
} from '@/lib/types';
import { resolvePlaceCategoryMeta } from './placeCategories';

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
  /** Minimum pixel spacing between pins around settlements (default 22). */
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

function isValidMapAnchor(
  loc: WorldLocation | undefined,
  width: number,
  height: number
): loc is WorldLocation & { coordinates: MapPoint } {
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
 * spiral that respects all already-occupied points (settlements + existing pins),
 * and pushes out beyond the anchor's central label box when scattering in open regions.
 */
function findOrbitalSlot(
  anchor: MapPoint,
  slotIndex: number,
  baseRadius: number,
  ringStep: number,
  occupied: MapPoint[],
  minSpacing: number,
  width: number,
  height: number,
  minAnchorClearance = 0
): MapPoint {
  const minDistSq = minSpacing * minSpacing;
  const minClearSq = minAnchorClearance * minAnchorClearance;
  for (let attempt = 0; attempt < 64; attempt++) {
    const k = slotIndex + attempt;
    const ring = Math.floor(k / 7);
    const radius = baseRadius + ring * ringStep;
    const angle = k * GOLDEN_ANGLE - Math.PI / 2;
    const candidate = clampPoint(
      {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y + Math.sin(angle) * radius,
      },
      width,
      height
    );
    if (minClearSq > 0 && distSq(anchor, candidate) < minClearSq) {
      continue;
    }
    if (occupied.every((o) => distSq(o, candidate) >= minDistSq)) {
      return candidate;
    }
  }
  const angle = slotIndex * GOLDEN_ANGLE;
  return clampPoint(
    {
      x: anchor.x + Math.cos(angle) * (baseRadius + ringStep * 3),
      y: anchor.y + Math.sin(angle) * (baseRadius + ringStep * 3),
    },
    width,
    height
  );
}

/**
 * Deterministically creates MapEntityPlacement pins for all unplaced entities
 * in `worldBible` and `encounters`.
 *
 * - Creatures (`bestiary`) with multiple `habitatLocationIds` receive a den/territory
 *   pin at EACH valid habitat location (unless a pin for that creature already exists
 *   near that habitat).
 * - Non-settlement biome/wilderness anchors scatter pins widely so creatures do not
 *   pile onto the region's center label plaque.
 * - Never mutates or duplicates existing placements.
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
  const placeCategories: CustomPlaceCategory[] = worldBible.ontology?.placeCategories ?? [];
  const locationById = new Map<string, WorldLocation>();
  const locationByNameLower = new Map<string, WorldLocation>();
  for (const loc of locations) {
    locationById.set(loc.id, loc);
    if (loc.name) {
      locationByNameLower.set(loc.name.trim().toLowerCase(), loc);
    }
  }

  const isRegionLocation = (loc: WorldLocation): boolean => {
    const meta = resolvePlaceCategoryMeta(loc.category, placeCategories);
    return meta.renderAs !== 'settlement';
  };

  const existing = worldBible.mapData?.placements ?? [];
  const existingKeySet = new Set(existing.map((p) => `${p.entityType}::${p.entityId}`));
  const existingPinsByBestiaryId = new Map<string, MapEntityPlacement[]>();
  for (const p of existing) {
    if (p.entityType === 'bestiary') {
      const list = existingPinsByBestiaryId.get(p.entityId) ?? [];
      list.push(p);
      existingPinsByBestiaryId.set(p.entityId, list);
    }
  }

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

  const resolveSingleLoc = (id: string | undefined | null): (WorldLocation & { coordinates: MapPoint }) | null => {
    if (!id) return null;
    const direct = locationById.get(id);
    if (direct && isValidMapAnchor(direct, canvasWidth, canvasHeight)) {
      if (!scopeSet || scopeSet.has(direct.id)) return direct;
    }
    const byName = locationByNameLower.get(id.trim().toLowerCase());
    if (byName && isValidMapAnchor(byName, canvasWidth, canvasHeight)) {
      if (!scopeSet || scopeSet.has(byName.id)) return byName;
    }
    return null;
  };

  const resolveLocationAnchor = (candidateIds: Array<string | undefined | null>): (WorldLocation & { coordinates: MapPoint }) | null => {
    for (const id of candidateIds) {
      const found = resolveSingleLoc(id);
      if (found) return found;
    }
    return null;
  };

  const resolveAllLocationAnchors = (
    candidateIds: Array<string | undefined | null>
  ): Array<WorldLocation & { coordinates: MapPoint }> => {
    const seen = new Set<string>();
    const out: Array<WorldLocation & { coordinates: MapPoint }> = [];
    for (const id of candidateIds) {
      const found = resolveSingleLoc(id);
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        out.push(found);
      }
    }
    return out;
  };

  const added: MapEntityPlacement[] = [];
  const countsByType: Partial<Record<MapEntityPlacementType, number>> = {};
  let skippedCount = 0;

  const tryPlace = (
    entityType: MapEntityPlacementType,
    entityId: string,
    label: string,
    anchor: (WorldLocation & { coordinates: MapPoint }) | null,
    baseRadius: number,
    extra?: Partial<Pick<MapEntityPlacement, 'customIcon' | 'notes'>>
  ) => {
    const key = `${entityType}::${entityId}`;
    if (existingKeySet.has(key)) return;
    if (!anchor) {
      skippedCount++;
      return;
    }

    const region = isRegionLocation(anchor);
    const effectiveRadius = region ? Math.max(baseRadius, 86) : baseRadius;
    const effectiveSpacing = region ? Math.max(minSpacing, 44) : minSpacing;
    const ringStep = region ? 34 : 20;
    const clearance = region ? 64 : 0;

    const slot = nextSlotFor(anchor.id);
    const point = findOrbitalSlot(
      anchor.coordinates,
      slot,
      effectiveRadius,
      ringStep,
      occupied,
      effectiveSpacing,
      canvasWidth,
      canvasHeight,
      clearance
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

  // 4. Bestiary (Tier 3 macro pins — supports MULTI-HABITAT placement per creature!)
  for (const creature of worldBible.bestiary ?? []) {
    const anchors = resolveAllLocationAnchors(creature.habitatLocationIds ?? []);
    if (anchors.length === 0) {
      skippedCount++;
      continue;
    }

    const creaturePins = existingPinsByBestiaryId.get(creature.id) ?? [];
    for (const anchor of anchors) {
      const targetId = `pin_sync_bestiary_${creature.id}_${anchor.id}`;
      // Skip if exact multi-habitat pin exists OR if an existing pin for this creature
      // already sits in/near this habitat's territory radius (220px).
      const alreadyCovered = creaturePins.some(
        (p) =>
          p.id === targetId ||
          p.id === `pin_sync_bestiary_${creature.id}` ||
          distSq(p, anchor.coordinates) <= 220 * 220
      );
      if (alreadyCovered) continue;

      const region = isRegionLocation(anchor);
      const baseRadius = region ? 90 : 48;
      const effectiveSpacing = region ? Math.max(minSpacing, 46) : Math.max(minSpacing, 28);
      const ringStep = region ? 36 : 22;
      const clearance = region ? 68 : 0;

      const slot = nextSlotFor(anchor.id);
      const point = findOrbitalSlot(
        anchor.coordinates,
        slot,
        baseRadius,
        ringStep,
        occupied,
        effectiveSpacing,
        canvasWidth,
        canvasHeight,
        clearance
      );
      occupied.push(point);

      const newPin: MapEntityPlacement = {
        id: targetId,
        entityId: creature.id,
        entityType: 'bestiary',
        x: point.x,
        y: point.y,
        customLabel: creature.name,
        notes: `Habitat: ${anchor.name} · Danger ${creature.dangerLevel}/5`,
      };
      added.push(newPin);
      creaturePins.push(newPin);
      countsByType.bestiary = (countsByType.bestiary ?? 0) + 1;
    }
    existingPinsByBestiaryId.set(creature.id, creaturePins);
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
