/**
 * mapSemantics.ts
 *
 * Plan 24 — integrity checks between the story graph and the map.
 *
 * The map is allowed to contain decorative terrain that no story ever
 * references. What it must not contain is a broken reference that the author
 * cannot see: a beat pointing at a deleted town, a pin pointing at a deleted
 * NPC, or a river place that has no drawn geometry.
 *
 * Pure module: no React, no Pixi, no DOM.
 */

import type {
  MapEntityPlacementType,
  MapTerrainFeature,
  StoryBeat,
  WorldBible,
  WorldLocation,
  WorldMapData,
} from '@/lib/types/world';
import { resolvePlaceCategoryMeta } from './placeCategories';

export type MapSemanticIssueCode =
  | 'beat_location_missing'
  | 'pin_entity_missing'
  | 'route_endpoint_missing'
  | 'terrain_place_missing'
  | 'unlinked_non_point_place'
  | 'duplicate_place_name'
  | 'duplicate_terrain_name';

export type MapSemanticSeverity = 'warning' | 'error';

export interface MapSemanticIssue {
  code: MapSemanticIssueCode;
  severity: MapSemanticSeverity;
  entityId: string;
  message: string;
}

export interface MapSemanticAuditOptions {
  mapData?: WorldMapData | null;
  /** The story's beats, including initialStoryBeats and chapter scenes. */
  beats?: StoryBeat[];
}

const normalizeName = (name: string): string =>
  (name || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[«»""''،,.:;!؟?\-_/\\()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function duplicateNames<T extends { id: string; name: string }>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

/**
 * Audits every cross-reference that the Cartographer and the story graph rely
 * on. Warnings are non-blocking; errors indicate a reference that cannot
 * resolve and should be fixed before publish.
 */
export function auditMapSemantics(
  worldBible: WorldBible,
  options: MapSemanticAuditOptions = {}
): MapSemanticIssue[] {
  const locations = worldBible.locations ?? [];
  const routes = worldBible.tradeRoutes ?? [];
  const mapData = options.mapData ?? worldBible.mapData ?? worldBible.ontology?.mapData ?? null;
  const terrain: MapTerrainFeature[] = mapData?.terrainFeatures ?? [];
  const placements = mapData?.placements ?? [];
  const beats = options.beats ?? [];
  const placeCategories = worldBible.ontology?.placeCategories ?? [];

  const locationIds = new Set(locations.map((location) => location.id));
  const linkedLocationIds = new Set(
    terrain.map((feature) => feature.locationId).filter((id): id is string => Boolean(id))
  );
  const issues: MapSemanticIssue[] = [];

  const entityIdsByType: Record<MapEntityPlacementType, Set<string>> = {
    location: locationIds,
    npc: new Set((worldBible.npcs ?? []).map((npc) => npc.id)),
    bestiary: new Set((worldBible.bestiary ?? []).map((creature) => creature.id)),
    artifact: new Set((worldBible.artifacts ?? []).map((artifact) => artifact.id)),
    deity: new Set((worldBible.religions ?? []).map((deity) => deity.id)),
    timeline: new Set((worldBible.timeline ?? []).map((event) => event.id)),
    faction_outpost: new Set((worldBible.factions ?? []).map((faction) => faction.id)),
  };

  for (const location of locations) {
    const meta = resolvePlaceCategoryMeta(location.category, placeCategories);
    if (meta.renderAs !== 'settlement' && !linkedLocationIds.has(location.id)) {
      issues.push({
        code: 'unlinked_non_point_place',
        severity: 'warning',
        entityId: location.id,
        message: `Place "${location.name}" (${location.category || 'uncategorized'}) is drawn as ${meta.geometryKind} but has no linked terrain feature.`,
      });
    }
  }

  for (const group of duplicateNames(locations)) {
    issues.push({
      code: 'duplicate_place_name',
      severity: 'warning',
      entityId: group[0].id,
      message: `Duplicate place name "${group[0].name}" on ${group
        .map((location) => location.id)
        .join(', ')}.`,
    });
  }

  for (const group of duplicateNames(terrain)) {
    issues.push({
      code: 'duplicate_terrain_name',
      severity: 'warning',
      entityId: group[0].id,
      message: `Duplicate terrain name "${group[0].name}" on ${group
        .map((feature) => feature.id)
        .join(', ')}.`,
    });
  }

  for (const feature of terrain) {
    if (feature.locationId && !locationIds.has(feature.locationId)) {
      issues.push({
        code: 'terrain_place_missing',
        severity: 'error',
        entityId: feature.id,
        message: `Terrain "${feature.name}" links to missing place "${feature.locationId}".`,
      });
    }
  }

  for (const pin of placements) {
    const targetIds = entityIdsByType[pin.entityType];
    if (targetIds && !targetIds.has(pin.entityId)) {
      issues.push({
        code: 'pin_entity_missing',
        severity: 'error',
        entityId: pin.id,
        message: `Pin "${pin.customLabel || pin.id}" points at missing ${pin.entityType} "${pin.entityId}".`,
      });
    }
  }

  for (const route of routes) {
    const stops = [
      route.originLocationId,
      ...(route.intermediateLocationIds ?? []),
      route.destinationLocationId,
    ];
    for (const stop of stops) {
      if (stop && !locationIds.has(stop)) {
        issues.push({
          code: 'route_endpoint_missing',
          severity: 'error',
          entityId: route.id,
          message: `Trade route "${route.name}" references missing place "${stop}".`,
        });
      }
    }
  }

  for (const beat of beats) {
    if (beat.locationId && !locationIds.has(beat.locationId)) {
      issues.push({
        code: 'beat_location_missing',
        severity: 'error',
        entityId: beat.sceneId,
        message: `Scene "${beat.sceneId}" is anchored to missing place "${beat.locationId}".`,
      });
    }
  }

  return issues.sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      a.entityId.localeCompare(b.entityId) ||
      a.message.localeCompare(b.message)
  );
}

/**
 * A convenience view for a reconciliation panel: non-point places that still
 * need a drawn feature, and terrain whose place link is broken.
 */
export function getMapSemanticReconciliation(
  worldBible: WorldBible,
  mapData?: WorldMapData | null
): {
  unlinkedPlaces: WorldLocation[];
  missingPlaceLinks: MapTerrainFeature[];
} {
  const locations = worldBible.locations ?? [];
  const data = mapData ?? worldBible.mapData ?? worldBible.ontology?.mapData ?? null;
  const terrain = data?.terrainFeatures ?? [];
  const categories = worldBible.ontology?.placeCategories ?? [];
  const linked = new Set(
    terrain.map((feature) => feature.locationId).filter((id): id is string => Boolean(id))
  );
  return {
    unlinkedPlaces: locations.filter(
      (location) =>
        resolvePlaceCategoryMeta(location.category, categories).renderAs !== 'settlement' &&
        !linked.has(location.id)
    ),
    missingPlaceLinks: terrain.filter(
      (feature) => feature.locationId && !locations.some((location) => location.id === feature.locationId)
    ),
  };
}