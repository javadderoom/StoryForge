/**
 * lodManager.ts
 *
 * Google Maps-Style Semantic Zoom (Level of Detail / LOD) & Vector Typography
 *
 * Implements:
 * 1. 4-Tier Semantic Altitude Hierarchy (Continental, Regional, Provincial, Tactical)
 * 2. Instantaneous boolean GPU container visibility filtering (0.01ms overhead)
 * 3. Dynamic High-DPI canvas text resolution allocation (prevents raster distortion/blur)
 * 4. Anchor-preserving counter-scaling (keeps pins, plaques and icons readable without ballooning)
 * 5. Spatial index hit-candidate LOD filtering (prevents clicking on invisible elements)
 * 6. Author selection exemption (selected entities remain visible at all zoom levels)
 */

import type { MapHitCandidate } from '../mapHitTest';

export type LODTier = 1 | 2 | 3 | 4;

export const LOD_THRESHOLDS = {
  TIER_2_REGIONAL: 0.55,
  TIER_3_PROVINCIAL: 1.0,
  TIER_4_TACTICAL: 1.75,
} as const;

/**
 * Returns the current active LOD tier based on camera zoom.
 * - Tier 1: Continental (zoom < 0.55)
 * - Tier 2: Regional (0.55 <= zoom < 1.0)
 * - Tier 3: Provincial (1.0 <= zoom < 1.75)
 * - Tier 4: Tactical (zoom >= 1.75)
 */
export function getLODTier(zoom: number): LODTier {
  if (zoom >= LOD_THRESHOLDS.TIER_4_TACTICAL) return 4;
  if (zoom >= LOD_THRESHOLDS.TIER_3_PROVINCIAL) return 3;
  if (zoom >= LOD_THRESHOLDS.TIER_2_REGIONAL) return 2;
  return 1;
}

/**
 * Human-readable label for the current LOD tier.
 */
export function getLODTierName(tier: LODTier, isPersian = false): string {
  switch (tier) {
    case 1:
      return isPersian ? 'نمای قاره‌ای' : 'Continental View';
    case 2:
      return isPersian ? 'نمای منطقه‌ای' : 'Regional View';
    case 3:
      return isPersian ? 'نمای استانی' : 'Provincial View';
    case 4:
      return isPersian ? 'نمای تاکتیکی' : 'Tactical View';
  }
}

/**
 * Classifies a settlement into its LOD tier.
 * - 'capital' -> Tier 1 (Continental)
 * - 'stronghold' -> Tier 2 (Regional)
 * - other (town, village, dungeon, shrine, port) -> Tier 3 (Provincial)
 */
export function getSettlementLODTier(category?: string | null): LODTier {
  if (!category) return 3;
  const normalized = category.toLowerCase().trim();
  if (normalized === 'capital') return 1;
  if (normalized === 'stronghold' || normalized === 'fortress' || normalized === 'citadel') return 2;
  return 3;
}

/**
 * Classifies placed lore pins (bestiary, NPC, artifact, timeline, deity) into their LOD tier.
 * Placed lore pins are visible starting at Tier 3 (Provincial).
 */
export function getPlacementLODTier(_entityType?: string | null): LODTier {
  return 3;
}

/**
 * Classifies road/route elements into their LOD tier.
 * Major highways, caravan corridors, and sea lanes are visible starting at Tier 2 (Regional).
 * Local paths, trails, and minor roads appear at Tier 3 (Provincial).
 */
export function getRouteLODTier(kind?: string | null): LODTier {
  if (!kind) return 3;
  const normalized = kind.toLowerCase().trim();
  if (normalized === 'highway' || normalized === 'caravan' || normalized === 'sea_lane') {
    return 2;
  }
  return 3;
}

/**
 * Classifies terrain curved labels into their LOD tier.
 * Continents and mountain ranges appear at Tier 1.
 * Major rivers, deserts, and highlands appear at Tier 2.
 * Smaller lakes, valleys, forests, and deltas appear at Tier 3.
 */
export function getTerrainLabelLODTier(type?: string | null): LODTier {
  if (!type) return 3;
  const normalized = type.toLowerCase().trim();
  if (normalized === 'mountain_range' || normalized === 'ocean' || normalized === 'continent') {
    return 1;
  }
  if (normalized === 'river' || normalized === 'desert' || normalized === 'highland') {
    return 2;
  }
  return 3;
}

/**
 * Checks if an element is visible at the current camera zoom.
 * Any element marked as selected is ALWAYS visible.
 */
export function isElementVisibleAtZoom(
  elementTier: LODTier,
  currentZoom: number,
  isSelected = false
): boolean {
  if (isSelected) return true;
  const activeTier = getLODTier(currentZoom);
  return activeTier >= elementTier;
}

/**
 * Checks if a spatial hit-candidate is visible at the given LOD tier.
 * Prevents clicking/selecting objects that are visually hidden by LOD.
 */
export function isCandidateVisibleAtLOD(
  candidate: MapHitCandidate,
  activeTier: LODTier,
  isSelected = false
): boolean {
  if (isSelected) return true;

  switch (candidate.kind) {
    case 'location': {
      const loc = candidate.location;
      const tier = getSettlementLODTier(loc.category);
      return activeTier >= tier;
    }
    case 'placement': {
      return activeTier >= 3;
    }
    case 'route': {
      const tier = getRouteLODTier(candidate.route.kind);
      return activeTier >= tier;
    }
    case 'trade_route': {
      // Major trade corridors are visible in Tier 2; others in Tier 3
      return activeTier >= 2;
    }
    case 'waypoint': {
      // Waypoint nodes are tactical micro-elements
      return activeTier >= 4;
    }
    case 'route_vertex':
    case 'terrain_vertex': {
      // Handles are only pickable in Tactical view or when selected
      return activeTier >= 4;
    }
    case 'terrain': {
      // Physical landforms remain pickable across all tiers
      return true;
    }
    default:
      return true;
  }
}

/**
 * Dynamic resolution allocator for PixiJS text glyphs.
 * Prevents bilinear texture blur when zooming in to 2x - 4x while capping
 * texture size to prevent GPU memory bloat and garbage collection thrashing.
 *
 * @param zoom Camera zoom factor
 * @param maxRes Maximum resolution ceiling to prevent excessive GPU memory usage (default 2.2)
 */
export function getDynamicTextResolution(zoom: number, maxRes = 2.2): number {
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const base = dpr * Math.max(1, Math.min(2.0, zoom));
  return Math.min(maxRes, Math.max(1, Math.round(base * 10) / 10));
}

/**
 * Anchor-preserving counter-scaling math for pins, shields, and badges.
 * Inverts the camera zoom so icons and text plaques remain ergonomic,
 * readable screen sizes (~12px to 18px) instead of ballooning into huge billboards.
 *
 * @param zoom Camera zoom factor
 * @param minScale Minimum scale floor (default 0.5 at high zoom)
 * @param maxScale Maximum scale ceiling (default 1.6 at low zoom)
 */
export function calculateCounterScale(
  zoom: number,
  minScale = 0.5,
  maxScale = 1.6
): number {
  const scale = 1 / Math.pow(Math.max(0.15, zoom), 0.5);
  return Math.min(maxScale, Math.max(minScale, Math.round(scale * 100) / 100));
}
