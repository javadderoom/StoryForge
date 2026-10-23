/**
 * placeCategories.ts
 *
 * Plan 24 — the single source of truth for what a place category means to the
 * map. A place category is semantic (what the story can refer to). A terrain
 * type is visual (how the map draws it). This module maps one to the other.
 *
 * Pure module: no React, no Pixi, no DOM. The Studio category list, the
 * Cartographer inspector, the renderer, the hit test and the selection model
 * all read the same metadata.
 */

import type {
  CustomPlaceCategory,
  MapTerrainType,
  PlaceGeometryKind,
  PlaceRenderAs,
} from '@/lib/types/world';

export interface PlaceCategoryRenderMeta {
  geometryKind: PlaceGeometryKind;
  renderAs: PlaceRenderAs;
  mapTerrainTypes: MapTerrainType[];
}

/**
 * Canonical category behaviour. Custom categories may override any field on
 * their ontology record; missing fields fall back to this table.
 */
export const DEFAULT_PLACE_CATEGORY_META: Record<string, PlaceCategoryRenderMeta> = {
  settlement: {
    geometryKind: 'point',
    renderAs: 'settlement',
    mapTerrainTypes: [],
  },
  stronghold: {
    geometryKind: 'point',
    renderAs: 'settlement',
    mapTerrainTypes: [],
  },
  ruins: {
    geometryKind: 'point',
    renderAs: 'settlement',
    mapTerrainTypes: [],
  },
  dungeon: {
    geometryKind: 'point',
    renderAs: 'settlement',
    mapTerrainTypes: [],
  },
  plains: {
    geometryKind: 'area',
    renderAs: 'label',
    mapTerrainTypes: ['plains', 'forest', 'desert', 'tundra', 'wasteland'],
  },
  wilderness: {
    geometryKind: 'area',
    renderAs: 'label',
    mapTerrainTypes: ['forest', 'desert', 'tundra', 'swamp', 'wasteland'],
  },
  waterway: {
    geometryKind: 'line',
    renderAs: 'line',
    mapTerrainTypes: ['river', 'lake'],
  },
  seas: {
    geometryKind: 'area',
    renderAs: 'water',
    mapTerrainTypes: ['ocean', 'sea', 'lake'],
  },
  anomaly: {
    geometryKind: 'area',
    renderAs: 'anomaly',
    mapTerrainTypes: ['arcane_anomaly'],
  },
};

/**
 * Unknown/custom categories keep the historical behaviour: a point pin. That
 * makes the migration non-destructive — an author-created category never
 * silently disappears from the map.
 */
export const FALLBACK_PLACE_CATEGORY_META: PlaceCategoryRenderMeta = {
  geometryKind: 'point',
  renderAs: 'settlement',
  mapTerrainTypes: [],
};

export function defaultPlaceCategoryMeta(categoryId: string): PlaceCategoryRenderMeta {
  return DEFAULT_PLACE_CATEGORY_META[categoryId] ?? FALLBACK_PLACE_CATEGORY_META;
}

/**
 * Resolves the effective rendering behaviour for a category. Ontology fields
 * win over canonical defaults; missing fields fall back per-field, so a custom
 * category can override only `renderAs` without restating its geometry kind.
 */
export function resolvePlaceCategoryMeta(
  categoryId: string | undefined,
  categories?: ReadonlyArray<Pick<CustomPlaceCategory, 'id' | 'geometryKind' | 'renderAs' | 'mapTerrainTypes'>> | null
): PlaceCategoryRenderMeta {
  const id = categoryId?.trim() || '';
  const fallback = defaultPlaceCategoryMeta(id);
  const category = categories?.find((candidate) => candidate.id === id);
  if (!category) return fallback;
  return {
    geometryKind: category.geometryKind ?? fallback.geometryKind,
    renderAs: category.renderAs ?? fallback.renderAs,
    mapTerrainTypes: category.mapTerrainTypes ?? fallback.mapTerrainTypes,
  };
}

/**
 * True when this category is drawn and picked as a point pin. `renderAs` is
 * authoritative: an author may deliberately pin a region, and a custom
 * category without rendering metadata keeps the historical pin behaviour.
 */
export function isPointPlaceCategory(
  categoryId: string | undefined,
  categories?: ReadonlyArray<Pick<CustomPlaceCategory, 'id' | 'geometryKind' | 'renderAs' | 'mapTerrainTypes'>> | null
): boolean {
  return resolvePlaceCategoryMeta(categoryId, categories).renderAs === 'settlement';
}

/** Adds canonical metadata to a category definition, if one is known. */
export function withPlaceCategoryMeta(category: CustomPlaceCategory): CustomPlaceCategory {
  const meta = DEFAULT_PLACE_CATEGORY_META[category.id];
  return meta ? { ...category, ...meta } : category;
}