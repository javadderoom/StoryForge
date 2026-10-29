/**
 * symbolScatterRenderer.ts
 *
 * High-performance deterministic symbol scatter generator & GPU sprite instancing renderer.
 * Converts map terrain features (biomes, woodlands, mountain ranges, knolls, stones, landmarks)
 * into sorted, frustum-culled Pixi.js Sprites rendered in 1-2 batched GPU draw calls.
 *
 * Performance Safeguards:
 * - Hard global ceiling on active GPU Sprites (MAX_ACTIVE_SYMBOLS = 1000).
 * - Per-feature instance ceiling (MAX_INSTANCES_PER_FEATURE = 300).
 * - Adaptive grid spacing scaling for large polygon areas to prevent runaway iterations.
 * - Persistent LRU cache by feature ID + geometry hash to eliminate V8 heap allocations during render loops.
 * - Zoom-adaptive LOD thinning at overview zoom levels.
 */

import { Container, Sprite } from 'pixi.js';
import type { GeoScatterInstance, MapPoint, MapTerrainFeature } from '@/lib/types';
import {
  getFamilyById,
  getSymbolById,
  resolveDefaultFamilyForTerrain,
  type GeoSymbolFamily,
} from './symbolPalette';
import type { MapSymbolLibrary } from './MapSymbolLibrary';
import { pointInPolygon } from '../mapHitTest';
import { makeRng } from '../landSculpt/noise';

export const MAX_ACTIVE_SYMBOLS = 1000;
export const MAX_INSTANCES_PER_FEATURE = 300;
const MAX_LRU_CACHE_ENTRIES = 256;

// Module-level persistent LRU cache for deterministic scatter instances
const FEATURE_SCATTER_CACHE = new Map<string, GeoScatterInstance[]>();

export interface ScatterOptions {
  familyId?: string;
  spacing?: number;
  scale?: number;
  seed?: number;
  exclusionZones?: Array<{ x: number; y: number; radius?: number }>;
  maxInstances?: number;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Deterministically generates scatter instances for a terrain feature based on its
 * geometry (polygon, polyline, or single point) and designated symbol family.
 * Results are cached in a persistent LRU map to avoid GC overhead during 60 FPS updates.
 */
export function generateScatterInstances(
  feature: MapTerrainFeature,
  options?: ScatterOptions
): GeoScatterInstance[] {
  const familyId =
    options?.familyId ||
    feature.symbolFamily ||
    resolveDefaultFamilyForTerrain(feature.type, feature.hasSnowcaps);

  const family = getFamilyById(familyId);
  if (!family || family.variants.length === 0) {
    return [];
  }

  const rawSeed =
    options?.seed ??
    hashStringToSeed(
      feature.id ||
        `scatter_${feature.type}_${feature.polygon?.[0]?.x ?? feature.points?.[0]?.x ?? feature.x ?? 0}`
    );

  const targetScale = options?.scale ?? feature.symbolScale ?? feature.scale ?? family.defaultScale;
  const targetSpacing = options?.spacing ?? feature.symbolSpacing ?? family.defaultSpacing;
  const maxLimit = options?.maxInstances ?? MAX_INSTANCES_PER_FEATURE;

  // Check persistent LRU cache
  const cacheKey = `${feature.id}_${feature.polygon?.length ?? feature.points?.length ?? 0}_${familyId}_${targetScale}_${targetSpacing}_${rawSeed}_${feature.width ?? 0}_${feature.scale ?? 0}`;
  const cached = FEATURE_SCATTER_CACHE.get(cacheKey);
  if (cached && !options?.exclusionZones?.length) {
    return cached;
  }

  const rng = makeRng(rawSeed);
  const exclusionZones = options?.exclusionZones ?? [];
  const instances: GeoScatterInstance[] = [];

  // Helper: check if a coordinate falls inside an exclusion zone
  const isExcluded = (px: number, py: number): boolean => {
    for (const zone of exclusionZones) {
      const radius = zone.radius ?? 40;
      const dx = px - zone.x;
      const dy = py - zone.y;
      if (dx * dx + dy * dy < radius * radius) {
        return true;
      }
    }
    return false;
  };

  // Helper: create a randomized scatter instance
  const createInstance = (
    baseX: number,
    baseY: number,
    index: number
  ): GeoScatterInstance | null => {
    if (isExcluded(baseX, baseY)) return null;

    // Pick variant pseudo-randomly
    const variantIndex = Math.floor(rng() * family.variants.length);
    const variant = family.variants[variantIndex] || family.variants[0];

    // Compute scale with ±12% jitter
    const baseVisualHeight = variant.baseHeight || 50;
    const baseScaleMultiplier = targetScale / baseVisualHeight;
    const scaleJitter = 0.88 + rng() * 0.24;
    const finalScale = Number((baseScaleMultiplier * scaleJitter).toFixed(3));

    // Compute subtle rotation jitter (±4°), disabled for architectural landmarks
    const isLandmark = family.category === 'landmark';
    const rotationJitter = isLandmark ? 0 : (rng() - 0.5) * (8 * Math.PI / 180);

    return {
      id: `${feature.id}_sym_${index}`,
      symbolId: variant.id,
      x: Math.round(baseX),
      y: Math.round(baseY),
      scale: finalScale,
      rotation: Number(rotationJitter.toFixed(4)),
      zIndex: Math.round(baseY),
    };
  };

  // Case 1: Polygon Area Biome (e.g. Forests, Jungles, Dune fields, Swamps)
  if (feature.polygon && feature.polygon.length >= 3) {
    const poly = feature.polygon;
    const holes = feature.holes || [];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const approxArea = Math.max(1, bboxWidth * bboxHeight);

    // Adaptive spacing safeguard: scale grid spacing up if polygon area is enormous
    // to guarantee iterations stay within safe bounds and avoid runaway allocations
    const adaptiveMinSpacing = Math.round(Math.sqrt(approxArea / maxLimit));
    const s = Math.max(16, targetSpacing, adaptiveMinSpacing);
    let counter = 0;

    for (let y = minY + s * 0.5; y <= maxY && instances.length < maxLimit; y += s) {
      for (let x = minX + s * 0.5; x <= maxX && instances.length < maxLimit; x += s) {
        // Jitter position within cell (±35% spacing)
        const jx = x + (rng() - 0.5) * s * 0.7;
        const jy = y + (rng() - 0.5) * s * 0.7;
        const pt = { x: jx, y: jy };

        // Raycast inside outer polygon
        if (!pointInPolygon(pt, poly)) continue;

        // Ensure not inside water/inland lake holes
        const inHole = holes.some((h) => h.length >= 3 && pointInPolygon(pt, h));
        if (inHole) continue;

        const inst = createInstance(jx, jy, counter++);
        if (inst) instances.push(inst);
      }
    }

    // Save to LRU cache
    if (!options?.exclusionZones?.length) {
      if (FEATURE_SCATTER_CACHE.size >= MAX_LRU_CACHE_ENTRIES) {
        const oldestKey = FEATURE_SCATTER_CACHE.keys().next().value;
        if (oldestKey) FEATURE_SCATTER_CACHE.delete(oldestKey);
      }
      FEATURE_SCATTER_CACHE.set(cacheKey, instances);
    }

    return instances;
  }

  // Case 2: Polyline / Ridge / Belt (e.g. Mountain ranges, Tree belts, Stone rows)
  if (feature.points && feature.points.length >= 2) {
    const points = feature.points;
    const s = Math.max(16, targetSpacing);
    const lateralSpread = feature.width ? Math.max(0, feature.width * 0.45) : (targetScale * 0.3);

    let counter = 0;

    for (let i = 0; i < points.length - 1 && instances.length < maxLimit; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const segDist = Math.hypot(segDx, segDy);
      if (segDist === 0) continue;

      const normX = -segDy / segDist;
      const normY = segDx / segDist;

      const steps = Math.max(1, Math.round(segDist / s));
      for (let step = 0; step < steps && instances.length < maxLimit; step++) {
        const t = (step + rng() * 0.4) / steps;
        const cx = p1.x + segDx * t;
        const cy = p1.y + segDy * t;

        // Lateral jitter perpendicular to spine
        const offset = (rng() - 0.5) * 2 * lateralSpread;
        const sx = cx + normX * offset;
        const sy = cy + normY * offset;

        const inst = createInstance(sx, sy, counter++);
        if (inst) instances.push(inst);
      }
    }

    // Save to LRU cache
    if (!options?.exclusionZones?.length) {
      if (FEATURE_SCATTER_CACHE.size >= MAX_LRU_CACHE_ENTRIES) {
        const oldestKey = FEATURE_SCATTER_CACHE.keys().next().value;
        if (oldestKey) FEATURE_SCATTER_CACHE.delete(oldestKey);
      }
      FEATURE_SCATTER_CACHE.set(cacheKey, instances);
    }

    return instances;
  }

  // Case 3: Single Point / Isolated Peak / Landmark (e.g. Single mountain peak, volcano, solitary tower)
  const singleX = feature.points?.[0]?.x ?? feature.x;
  const singleY = feature.points?.[0]?.y ?? feature.y;
  if (typeof singleX === 'number' && typeof singleY === 'number') {
    const inst = createInstance(singleX, singleY, 0);
    if (inst) instances.push(inst);
  }

  return instances;
}

/**
 * High-speed GPU renderer for map symbol instances.
 * Populates a strictly capped PixiJS Container pool (<= MAX_ACTIVE_SYMBOLS)
 * with depth-sorted, frustum-culled, LOD-thinned Sprites.
 */
export function renderSymbolsToContainer(
  container: Container,
  features: MapTerrainFeature[],
  symbolLibrary: MapSymbolLibrary,
  viewportBounds?: ViewportBounds,
  zoom?: number
): void {
  if (!symbolLibrary.isReady) {
    container.visible = false;
    return;
  }

  container.visible = true;
  container.sortableChildren = true;

  // Zoom LOD thinning: thin out symbols when zoomed out to prevent visual clutter & memory spikes
  const currentZoom = typeof zoom === 'number' && zoom > 0 ? zoom : 1.0;
  const lodStep = currentZoom < 0.35 ? 3 : currentZoom < 0.65 ? 2 : 1;

  // Gather and cache all active instances
  const activeInstances: GeoScatterInstance[] = [];

  for (const feat of features) {
    // Check if feature should have symbols
    const hasFamily = Boolean(feat.symbolFamily);
    const isSymbolEligible =
      hasFamily ||
      feat.type === 'forest' ||
      feat.type === 'jungle' ||
      feat.type === 'tundra' ||
      feat.type === 'swamp' ||
      feat.type === 'mountain_range' ||
      feat.type === 'peak' ||
      feat.type === 'volcano';

    if (!isSymbolEligible) continue;

    // Use cached scatterInstances on feature if present, or generate via LRU cache
    const instances = feat.scatterInstances?.length
      ? feat.scatterInstances
      : generateScatterInstances(feat);

    for (let idx = 0; idx < instances.length; idx += lodStep) {
      const inst = instances[idx];

      // Frustum culling with 100px safety margin
      if (viewportBounds) {
        if (
          inst.x < viewportBounds.minX - 100 ||
          inst.x > viewportBounds.maxX + 100 ||
          inst.y < viewportBounds.minY - 100 ||
          inst.y > viewportBounds.maxY + 100
        ) {
          continue;
        }
      }
      activeInstances.push(inst);

      // Early break if global ceiling reached
      if (activeInstances.length >= MAX_ACTIVE_SYMBOLS) break;
    }

    if (activeInstances.length >= MAX_ACTIVE_SYMBOLS) break;
  }

  // Strict Pool management: never exceed MAX_ACTIVE_SYMBOLS
  const children = container.children as Sprite[];
  const requiredCount = Math.min(activeInstances.length, MAX_ACTIVE_SYMBOLS);

  // Grow pool up to requiredCount (capped at MAX_ACTIVE_SYMBOLS)
  while (children.length < requiredCount) {
    const sprite = new Sprite();
    container.addChild(sprite);
  }

  // Trim pool if it ever exceeds MAX_ACTIVE_SYMBOLS
  while (children.length > MAX_ACTIVE_SYMBOLS) {
    const surplus = container.removeChildAt(children.length - 1);
    surplus.destroy();
  }

  // Update visible sprites
  for (let i = 0; i < requiredCount; i++) {
    const inst = activeInstances[i];
    const sprite = children[i];
    const texture = symbolLibrary.get(inst.symbolId);

    if (!texture) {
      sprite.visible = false;
      continue;
    }

    const symbolDef = getSymbolById(inst.symbolId);
    const anchorX = symbolDef?.anchor.x ?? 0.5;
    const anchorY = symbolDef?.anchor.y ?? 0.95;

    sprite.texture = texture;
    sprite.position.set(inst.x, inst.y);
    sprite.scale.set(inst.scale);
    sprite.rotation = inst.rotation;
    sprite.anchor.set(anchorX, anchorY);
    sprite.zIndex = inst.zIndex;
    sprite.visible = true;
  }

  // Hide surplus pooled sprites
  for (let i = requiredCount; i < children.length; i++) {
    children[i].visible = false;
  }
}

/**
 * Deterministic hash from string identifier to 32-bit unsigned integer seed.
 */
export function hashStringToSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
