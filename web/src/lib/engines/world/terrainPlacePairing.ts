/**
 * terrainPlacePairing.ts
 *
 * Plan 24 pairing helpers for the two halves of a map place:
 *  - `WorldLocation` is the story-facing place.
 *  - `MapTerrainFeature` is the drawing that realizes it.
 *
 * The only bridge is `MapTerrainFeature.locationId`. This module answers the
 * authoring question "which existing drawings can I attach to this place?"
 * without writing anything: the Inspector decides after the author picks one.
 */

import type {
  CustomPlaceCategory,
  MapTerrainFeature,
  MapTerrainType,
  WorldLocation,
} from '@/lib/types/world';
import { resolvePlaceCategoryMeta } from './placeCategories';
import { terrainCenter } from './mapObjectOrder';

export type TerrainNameMatch = 'exact' | 'contains' | 'none';

export interface TerrainPlaceCandidate {
  feature: MapTerrainFeature;
  /** Why this feature is being suggested, shown in the Inspector. */
  nameMatch: TerrainNameMatch;
  /** Distance from the place pin to the drawing centre, when both exist. */
  distance: number | null;
  /** Higher is a better suggestion. */
  score: number;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

/**
 * True when a place category can be drawn by this terrain type.
 *
 * Point places deliberately return false: Plan 24 says their position comes
 * from `WorldLocation.coordinates`, not from a linked terrain feature.
 */
export function placeAcceptsTerrainType(
  place: Pick<WorldLocation, 'category'>,
  terrainType: MapTerrainType,
  categories?: ReadonlyArray<CustomPlaceCategory> | null
): boolean {
  const meta = resolvePlaceCategoryMeta(place.category, categories);
  return meta.renderAs !== 'settlement' && meta.mapTerrainTypes.includes(terrainType);
}

/**
 * Lists unlinked, compatible terrain features for a place, best candidate
 * first. It never mutates the inputs and never auto-links.
 *
 * Ranking, in order:
 *  1. Exact name match.
 *  2. Partial name match.
 *  3. Category's preferred terrain order (river before lake for a waterway).
 *  4. Proximity to the place pin, when it has coordinates.
 */
export function findTerrainCandidatesForPlace(
  place: WorldLocation,
  terrainFeatures: readonly MapTerrainFeature[],
  categories?: ReadonlyArray<CustomPlaceCategory> | null
): TerrainPlaceCandidate[] {
  const meta = resolvePlaceCategoryMeta(place.category, categories);
  if (meta.renderAs === 'settlement' || meta.mapTerrainTypes.length === 0) return [];

  const allowed = new Set(meta.mapTerrainTypes);
  const placeName = normalizeName(place.name);
  const placePoint =
    place.coordinates &&
    Number.isFinite(place.coordinates.x) &&
    Number.isFinite(place.coordinates.y)
      ? place.coordinates
      : null;

  const candidates: TerrainPlaceCandidate[] = [];

  for (const feature of terrainFeatures) {
    // A feature belongs to at most one place. Already-linked drawings are
    // shown in the location's linked list, not in the candidate picker.
    if (feature.locationId) continue;
    if (!allowed.has(feature.type)) continue;

    const featureName = normalizeName(feature.name);
    let nameMatch: TerrainNameMatch = 'none';
    if (placeName && featureName === placeName) {
      nameMatch = 'exact';
    } else if (
      placeName &&
      featureName &&
      (featureName.includes(placeName) || placeName.includes(featureName))
    ) {
      nameMatch = 'contains';
    }

    const center = terrainCenter(feature);
    const distance = placePoint && center
      ? Math.hypot(center.x - placePoint.x, center.y - placePoint.y)
      : null;

    const typeIndex = meta.mapTerrainTypes.indexOf(feature.type);
    const typeScore = (meta.mapTerrainTypes.length - Math.max(typeIndex, 0)) * 50;
    const nameScore = nameMatch === 'exact' ? 100_000 : nameMatch === 'contains' ? 10_000 : 0;
    const distanceScore = distance === null ? 0 : Math.max(0, 1_000 - distance / 10);

    candidates.push({
      feature,
      nameMatch,
      distance,
      score: nameScore + typeScore + distanceScore,
    });
  }

  return candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.feature.name.localeCompare(b.feature.name) ||
      a.feature.id.localeCompare(b.feature.id)
  );
}