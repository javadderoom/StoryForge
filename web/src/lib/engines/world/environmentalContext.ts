/**
 * environmentalContext.ts
 *
 * Extracts rich, geographically-grounded environmental context for any (worldX, worldY)
 * coordinate on the StoryForge Cartographer map.
 *
 * Uses geometry tests (point-in-polygon, polyline proximity) against WorldBible terrain features,
 * resolves nearest settlements, calculates distances and cardinal directions, and formats
 * prompt context blocks for context-aware AI entity and encounter generation.
 */

import {
  MapPoint,
  MapTerrainFeature,
  MapTerrainType,
  WorldBible,
  WorldLocation,
} from '@/lib/types/world';
import { pointInPolygon, distanceToPolyline, distanceToRing } from './mapHitTest';

export interface NearestSettlementInfo {
  id: string;
  name: string;
  distanceKm: number;
  distancePx: number;
  cardinalDirection: string; // e.g. "North", "South-East"
}

export interface EnvironmentalContext {
  point: MapPoint;
  biome: string;
  biomeLabel: string;
  biomeEmoji: string;
  featureName?: string;
  matchedFeature?: MapTerrainFeature;
  elevation: number;
  isWater: boolean;
  waterBodyType?: 'ocean' | 'sea' | 'lake' | 'river';
  nearbyFeatures: string[];
  nearestSettlement: NearestSettlementInfo | null;
  badgeText: string;
  promptContext: string;
}

const BIOME_SPECIFICITY_RANK: Record<string, number> = {
  oasis: 5,
  salt_pan: 5,
  arcane_anomaly: 5,
  volcano: 5,
  desert: 4,
  forest: 4,
  jungle: 4,
  swamp: 4,
  tundra: 4,
  wasteland: 4,
  canyon: 4,
  chasm: 4,
  valley: 3,
  highland: 3,
  plateau: 3,
  mountain_range: 3,
  peak: 3,
  lake: 3,
  sea: 2,
  ocean: 2,
  river: 2,
  plains: 1,
  island: 1,
  continent: 0,
};

const BIOME_META: Record<string, { label: string; emoji: string; defaultElevation: number; isWater: boolean }> = {
  desert: { label: 'Arid Desert & Sand Dunes', emoji: '🌵', defaultElevation: 250, isWater: false },
  oasis: { label: 'Fertile Oasis & Springs', emoji: '🌴', defaultElevation: 220, isWater: false },
  salt_pan: { label: 'Crusted Salt Pan & Playa', emoji: '🧂', defaultElevation: 180, isWater: false },
  forest: { label: 'Dense Canopy Woodland', emoji: '🌲', defaultElevation: 300, isWater: false },
  jungle: { label: 'Primeval Tropical Rainforest', emoji: '🌿', defaultElevation: 150, isWater: false },
  mountain_range: { label: 'Rugged Mountain Peaks', emoji: '🏔️', defaultElevation: 2100, isWater: false },
  peak: { label: 'Alpine Summit', emoji: '⛰️', defaultElevation: 3400, isWater: false },
  volcano: { label: 'Smoldering Volcanic Crag', emoji: '🌋', defaultElevation: 2800, isWater: false },
  highland: { label: 'Windswept Highland Steppe', emoji: '🌾', defaultElevation: 950, isWater: false },
  plateau: { label: 'Elevated Tableland', emoji: '🪨', defaultElevation: 1100, isWater: false },
  valley: { label: 'Sheltered River Valley', emoji: '🏞️', defaultElevation: 120, isWater: false },
  canyon: { label: 'Sunken Rocky Gorge', emoji: '🏜️', defaultElevation: 80, isWater: false },
  chasm: { label: 'Abyssal Chasm', emoji: '🕳️', defaultElevation: -100, isWater: false },
  tundra: { label: 'Glacial Tundra & Permafrost', emoji: '❄️', defaultElevation: 400, isWater: false },
  swamp: { label: 'Mist-Veiled Mire & Bog', emoji: '🐊', defaultElevation: 30, isWater: false },
  wasteland: { label: 'Scorched Ash Wasteland', emoji: '💀', defaultElevation: 200, isWater: false },
  arcane_anomaly: { label: 'Aetheric Anomaly & Ley Tear', emoji: '🔮', defaultElevation: 500, isWater: false },
  plains: { label: 'Rolling Grasslands & Savanna', emoji: '🌾', defaultElevation: 150, isWater: false },
  river: { label: 'Freshwater Riverbank', emoji: '💧', defaultElevation: 60, isWater: true },
  lake: { label: 'Freshwater Inland Lake', emoji: '🛶', defaultElevation: 90, isWater: true },
  sea: { label: 'Coastal Sea & Bay', emoji: '🌊', defaultElevation: 0, isWater: true },
  ocean: { label: 'Open Ocean Depths', emoji: '🌊', defaultElevation: -50, isWater: true },
  island: { label: 'Secluded Offshore Islet', emoji: '🏝️', defaultElevation: 80, isWater: false },
  continent: { label: 'Mainland Terrestrial Realm', emoji: '🗺️', defaultElevation: 200, isWater: false },
};

function polygonArea(ring: MapPoint[]): number {
  if (!ring || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  }
  return Math.abs(area / 2);
}

function calculateCardinalDirection(origin: MapPoint, target: MapPoint): string {
  // In canvas coords, y goes down, so target.y > origin.y is South
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;

  if (deg >= -22.5 && deg < 22.5) return 'East';
  if (deg >= 22.5 && deg < 67.5) return 'South-East';
  if (deg >= 67.5 && deg < 112.5) return 'South';
  if (deg >= 112.5 && deg < 157.5) return 'South-West';
  if (deg >= 157.5 || deg < -157.5) return 'West';
  if (deg >= -157.5 && deg < -112.5) return 'North-West';
  if (deg >= -112.5 && deg < -67.5) return 'North';
  return 'North-East';
}

export function extractEnvironmentalContext(
  point: MapPoint,
  worldBible: WorldBible
): EnvironmentalContext {
  const mapData = worldBible.mapData ?? worldBible.ontology?.mapData;
  const terrainFeatures = mapData?.terrainFeatures ?? [];
  const kmPerSpatialUnit = mapData?.settings?.kmPerSpatialUnit ?? 1.0;

  // 1. Check enclosing polygons
  const enclosingMatches: Array<{
    feature: MapTerrainFeature;
    rank: number;
    area: number;
  }> = [];

  for (const feature of terrainFeatures) {
    if (!feature.polygon || feature.polygon.length < 3) continue;

    // Check if inside holes (e.g. inland lake cutouts in landmasses)
    const inHole = (feature.holes ?? []).some(
      (hole) => hole.length >= 3 && pointInPolygon(point, hole)
    );
    if (inHole) continue;

    if (pointInPolygon(point, feature.polygon)) {
      const rank = BIOME_SPECIFICITY_RANK[feature.type] ?? 1;
      const area = polygonArea(feature.polygon);
      enclosingMatches.push({ feature, rank, area });
    }
  }

  // Sort enclosing matches: highest specificity rank first; on tie, smallest area first
  enclosingMatches.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.area - b.area;
  });

  let matchedFeature: MapTerrainFeature | undefined = enclosingMatches[0]?.feature;

  // 2. Check linear or point features within immediate proximity (e.g. riverbanks, mountain ridges)
  const nearbyFeatures: string[] = [];
  const PROXIMITY_THRESHOLD_PX = 45;

  for (const feature of terrainFeatures) {
    if (feature.id === matchedFeature?.id) continue;

    if (feature.points && feature.points.length >= 2) {
      const dist = distanceToPolyline(point, feature.points);
      if (dist <= PROXIMITY_THRESHOLD_PX) {
        const featName = feature.name || feature.type.replace('_', ' ');
        nearbyFeatures.push(`${featName} (~${Math.round(dist * kmPerSpatialUnit)}km)`);
        // If we are right beside a river (<15px) and not already inside a high-priority feature, riverbank context applies
        if (feature.type === 'river' && dist < 18 && (!matchedFeature || (BIOME_SPECIFICITY_RANK[matchedFeature.type] ?? 0) < 3)) {
          matchedFeature = feature;
        }
      }
    } else if (feature.x !== undefined && feature.y !== undefined) {
      // Point features (peaks, volcanoes, oases)
      const dist = Math.hypot(point.x - feature.x, point.y - feature.y);
      const radius = feature.radius ?? 30;
      if (dist <= radius + 15) {
        const featName = feature.name || feature.type;
        nearbyFeatures.push(`${featName} (~${Math.round(dist * kmPerSpatialUnit)}km)`);
        if (!matchedFeature || (BIOME_SPECIFICITY_RANK[feature.type] ?? 0) > (BIOME_SPECIFICITY_RANK[matchedFeature.type] ?? 0)) {
          matchedFeature = feature;
        }
      }
    }
  }

  // 3. Resolve biome metadata
  const biomeKey = matchedFeature?.type ?? 'plains';
  const meta = BIOME_META[biomeKey] ?? {
    label: biomeKey.replace(/_/g, ' '),
    emoji: '🧭',
    defaultElevation: 150,
    isWater: false,
  };

  const elevation = matchedFeature?.elevation ?? meta.defaultElevation;
  const isWater = meta.isWater || ['ocean', 'sea', 'lake', 'river'].includes(biomeKey);
  const waterBodyType = ['ocean', 'sea', 'lake', 'river'].includes(biomeKey)
    ? (biomeKey as 'ocean' | 'sea' | 'lake' | 'river')
    : undefined;

  // 4. Find nearest settlement
  const locations = worldBible.locations ?? [];
  let nearestSettlement: NearestSettlementInfo | null = null;
  let minSettlementDist = Infinity;

  for (const loc of locations) {
    if (!loc.coordinates) continue;
    const distPx = Math.hypot(loc.coordinates.x - point.x, loc.coordinates.y - point.y);
    if (distPx < minSettlementDist) {
      minSettlementDist = distPx;
      const distKm = Math.max(1, Math.round(distPx * kmPerSpatialUnit));
      const direction = calculateCardinalDirection(loc.coordinates, point);
      nearestSettlement = {
        id: loc.id,
        name: loc.name,
        distanceKm: distKm,
        distancePx: Math.round(distPx),
        cardinalDirection: direction,
      };
    }
  }

  // 5. Build UI badge text
  const featureTitle = matchedFeature?.name ? matchedFeature.name : meta.label;
  let badgeText = `${meta.emoji} ${featureTitle}`;
  if (nearestSettlement) {
    badgeText += ` • ${nearestSettlement.distanceKm}km ${nearestSettlement.cardinalDirection} of ${nearestSettlement.name}`;
  } else {
    badgeText += ` • Elevation ${elevation}m`;
  }

  // 6. Build LLM prompt injection context
  const promptParts: string[] = [];
  promptParts.push(`GEOGRAPHIC & ENVIRONMENTAL SETTING:`);
  promptParts.push(`- Map Coordinates: (X: ${Math.round(point.x)}, Y: ${Math.round(point.y)})`);
  promptParts.push(`- Primary Biome: ${meta.label} [Category: ${biomeKey}]`);
  if (matchedFeature?.name) {
    promptParts.push(`- Regional Name: "${matchedFeature.name}"`);
  }
  if (matchedFeature?.description) {
    promptParts.push(`- Terrain Lore: ${matchedFeature.description}`);
  }
  promptParts.push(`- Elevation: ${elevation} meters above sea level`);
  promptParts.push(`- Environment Surface: ${isWater ? 'Aquatic / Submerged' : 'Terrestrial / Land'}`);

  if (nearbyFeatures.length > 0) {
    promptParts.push(`- Adjacent Geographic Features: ${nearbyFeatures.join(', ')}`);
  }
  if (nearestSettlement) {
    promptParts.push(
      `- Proximity to Civilization: Located approximately ${nearestSettlement.distanceKm} kilometers to the ${nearestSettlement.cardinalDirection} of the settlement "${nearestSettlement.name}".`
    );
  } else {
    promptParts.push(`- Proximity to Civilization: Isolated deep wilderness, far from established cities.`);
  }

  const promptContext = promptParts.join('\n');

  return {
    point,
    biome: biomeKey,
    biomeLabel: meta.label,
    biomeEmoji: meta.emoji,
    featureName: matchedFeature?.name,
    matchedFeature,
    elevation,
    isWater,
    waterBodyType,
    nearbyFeatures,
    nearestSettlement,
    badgeText,
    promptContext,
  };
}
