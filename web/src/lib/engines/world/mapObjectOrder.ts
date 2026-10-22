/**
 * mapObjectOrder.ts
 *
 * Plan 21 — the Cartographer's map-object layer model.
 *
 * Two independent concerns live here:
 *
 *  1. DRAW BANDS. A hand-drawn map stacks in a fixed order: the ocean base,
 *     then land, then biomes, then standing water, then ink lines (rivers,
 *     valleys), then the relief (ranges and peaks). The renderer used to hard
 *     code that order as five separate loops; now it is one z-ordered pass,
 *     and every object gets a band-derived default z so the *default look is
 *     unchanged* while any object can still be raised above the coastline.
 *
 *  2. OBJECT GROUPS. What the author sees in the object list. Grouping is by
 *     what a thing IS (a landmass, a water, a range, a valley, a biome) and is
 *     deliberately independent of the draw band — a river and a lake are both
 *     "water" to the author even though one is a filled body and the other an
 *     ink line.
 *
 * Everything here is pure: no React, no Pixi, no DOM. The renderer, the object
 * list and the hit test all read from this one source of truth, so a type can
 * never be visible in one place and invisible in another.
 */

import type { MapPoint, MapTerrainType } from '@/lib/types/world';

/**
 * Draw bands, lowest first. The spacing (1000) leaves room for an author to
 * slot an object between two bands without renumbering anything.
 */
export const MAP_OBJECT_BAND_BASE = {
  /** Open ocean / seas — the base sheet everything else sits on. */
  ocean: -1000,
  /** Continents and islands. */
  land: 0,
  /** Forests, deserts, swamps — translucent washes over the land. */
  biome: 1000,
  /** Standing water: lakes and inland seas. */
  water: 2000,
  /** Ink lines: rivers, valleys, canyons, anomalies. */
  line: 3000,
  /** Relief: mountain ranges, peaks, volcanoes. */
  range: 4000,
} as const;

export type MapObjectBand = keyof typeof MAP_OBJECT_BAND_BASE;

/** The band a terrain type belongs to. */
const BAND_BY_TYPE: Record<MapTerrainType, MapObjectBand> = {
  ocean: 'ocean',
  sea: 'ocean',
  continent: 'land',
  island: 'land',
  forest: 'biome',
  desert: 'biome',
  tundra: 'biome',
  swamp: 'biome',
  wasteland: 'biome',
  plains: 'biome',
  oasis: 'biome',
  lake: 'water',
  river: 'line',
  valley: 'line',
  canyon: 'line',
  chasm: 'line',
  arcane_anomaly: 'line',
  mountain_range: 'range',
  peak: 'range',
  volcano: 'range',
};

/** The draw band of a terrain type. */
export function terrainBand(type: MapTerrainType): MapObjectBand {
  return BAND_BY_TYPE[type] ?? 'line';
}

/** The numeric base of a terrain type's draw band. */
export function terrainBandBase(type: MapTerrainType): number {
  return MAP_OBJECT_BAND_BASE[terrainBand(type)];
}

// ---------------------------------------------------------------------------
// Object groups (what the author sees in the object list)
// ---------------------------------------------------------------------------

export type MapObjectGroupKey = 'landmass' | 'water' | 'range' | 'valley' | 'biome';

const GROUP_BY_TYPE: Record<MapTerrainType, MapObjectGroupKey> = {
  continent: 'landmass',
  island: 'landmass',
  ocean: 'water',
  sea: 'water',
  lake: 'water',
  river: 'water',
  mountain_range: 'range',
  peak: 'range',
  volcano: 'range',
  valley: 'valley',
  canyon: 'valley',
  chasm: 'valley',
  forest: 'biome',
  desert: 'biome',
  tundra: 'biome',
  swamp: 'biome',
  wasteland: 'biome',
  plains: 'biome',
  oasis: 'biome',
  arcane_anomaly: 'biome',
};

/** The object-list group a terrain type belongs to. */
export function terrainGroup(type: MapTerrainType): MapObjectGroupKey {
  return GROUP_BY_TYPE[type] ?? 'biome';
}

/** The order the object groups are listed in. */
export const MAP_OBJECT_GROUP_ORDER: MapObjectGroupKey[] = [
  'landmass',
  'water',
  'range',
  'valley',
  'biome',
];

// ---------------------------------------------------------------------------
// Centering
// ---------------------------------------------------------------------------

/**
 * A representative point of a terrain feature — used to centre the camera on
 * an object picked from the object list. The bounding-box centre is used for
 * polygons (robust for concave coastlines); a polyline uses its middle vertex.
 */
export function terrainCenter(feature: {
  polygon?: MapPoint[];
  points?: MapPoint[];
  x?: number;
  y?: number;
}): MapPoint | null {
  if (feature.polygon && feature.polygon.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of feature.polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  if (feature.points && feature.points.length > 0) {
    return feature.points[Math.floor((feature.points.length - 1) / 2)];
  }
  if (typeof feature.x === 'number' && typeof feature.y === 'number') {
    return { x: feature.x, y: feature.y };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-object layer state
// ---------------------------------------------------------------------------

/** Hidden objects are not drawn and cannot be picked on the canvas. */
export function isObjectVisible(obj: { visible?: boolean }): boolean {
  return obj.visible !== false;
}

/** Locked objects cannot be picked or edited on the canvas. */
export function isObjectLocked(obj: { locked?: boolean }): boolean {
  return obj.locked === true;
}

/**
 * The effective z of a terrain feature.
 *
 * An explicit `zIndex` always wins. Otherwise the feature sits in its band,
 * ordered by its position in the array — which reproduces the historical
 * draw order exactly, so a world that never touches the layer controls looks
 * the same as it always did.
 */
export function effectiveTerrainZIndex(feature: { type: MapTerrainType; zIndex?: number }, index: number): number {
  if (typeof feature.zIndex === 'number' && Number.isFinite(feature.zIndex)) {
    return feature.zIndex;
  }
  return terrainBandBase(feature.type) + index;
}

/**
 * Orders terrain features for drawing: ascending z, stable within equal z so
 * the array order is preserved (and the default look does not change).
 */
export function orderTerrainForRender<T extends { type: MapTerrainType; zIndex?: number }>(
  features: T[]
): T[] {
  return features
    .map((feature, index) => ({ feature, index, z: effectiveTerrainZIndex(feature, index) }))
    .sort((a, b) => (a.z !== b.z ? a.z - b.z : a.index - b.index))
    .map((entry) => entry.feature);
}

/** Sorts terrain features for the object list: by group, then by draw order. */
export function sortTerrainForList<T extends { type: MapTerrainType; zIndex?: number }>(
  features: T[]
): T[] {
  return features
    .map((feature, index) => ({ feature, index, z: effectiveTerrainZIndex(feature, index) }))
    .sort((a, b) => {
      const ga = MAP_OBJECT_GROUP_ORDER.indexOf(terrainGroup(a.feature.type));
      const gb = MAP_OBJECT_GROUP_ORDER.indexOf(terrainGroup(b.feature.type));
      if (ga !== gb) return ga - gb;
      if (a.z !== b.z) return a.z - b.z;
      return a.index - b.index;
    })
    .map((entry) => entry.feature);
}

// ---------------------------------------------------------------------------
// Draw order of lore pins
// ---------------------------------------------------------------------------

/** The effective z of a lore pin. */
export function effectivePlacementZIndex(placement: { zIndex?: number }, index: number): number {
  if (typeof placement.zIndex === 'number' && Number.isFinite(placement.zIndex)) {
    return placement.zIndex;
  }
  return index;
}

/** Orders lore pins for drawing: ascending z, stable within equal z. */
export function orderPlacementsForRender<T extends { id: string; zIndex?: number }>(
  placements: T[]
): T[] {
  return placements
    .map((placement, index) => ({ placement, index, z: effectivePlacementZIndex(placement, index) }))
    .sort((a, b) => (a.z !== b.z ? a.z - b.z : a.index - b.index))
    .map((entry) => entry.placement);
}

// ---------------------------------------------------------------------------
// Reordering
// ---------------------------------------------------------------------------

/**
 * Moves an object one step along the draw order.
 *
 * The two objects involved exchange their effective z, and both end up with
 * an explicit `zIndex` so the swap sticks. Objects that were never touched
 * keep deriving their order from the array, so a world that only nudges one
 * feature does not end up littered with z-index noise.
 */
export function reorderByZ<T extends { id: string; zIndex?: number }>(
  items: T[],
  id: string,
  direction: 'forward' | 'backward',
  zOf: (item: T, index: number) => number
): T[] {
  const ordered = [...items].sort((a, b) => {
    const az = zOf(a, items.indexOf(a));
    const bz = zOf(b, items.indexOf(b));
    return az !== bz ? az - bz : items.indexOf(a) - items.indexOf(b);
  });

  const idx = ordered.findIndex((item) => item.id === id);
  if (idx < 0) return items;

  const neighbourIdx = direction === 'forward' ? idx + 1 : idx - 1;
  if (neighbourIdx < 0 || neighbourIdx >= ordered.length) return items;

  const target = ordered[idx];
  const neighbour = ordered[neighbourIdx];
  const targetZ = zOf(target, items.indexOf(target));
  const neighbourZ = zOf(neighbour, items.indexOf(neighbour));
  if (targetZ === neighbourZ) return items;

  return items.map((item) => {
    if (item.id === target.id) return { ...item, zIndex: neighbourZ };
    if (item.id === neighbour.id) return { ...item, zIndex: targetZ };
    return item;
  });
}

/** Moves a terrain feature one step forward (up) or backward (down) in the draw order. */
export function reorderTerrainByZ<T extends { id: string; type: MapTerrainType; zIndex?: number }>(
  features: T[],
  id: string,
  direction: 'forward' | 'backward'
): T[] {
  return reorderByZ(features, id, direction, (item, index) => effectiveTerrainZIndex(item, index));
}

/** Moves a lore pin one step forward (up) or backward (down) in the draw order. */
export function reorderPlacementByZ<T extends { id: string; zIndex?: number }>(
  placements: T[],
  id: string,
  direction: 'forward' | 'backward'
): T[] {
  return reorderByZ(placements, id, direction, (item, index) => effectivePlacementZIndex(item, index));
}
