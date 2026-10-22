import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

// ============================================================================
// DETERMINISTIC PRNG & SIMPLEX NOISE CACHE
// ============================================================================

/**
 * Fast 32-bit Mulberry32 deterministic pseudo-random number generator.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level noise cache for zero allocation overhead during 60 FPS painting
export const MAX_NOISE_CACHE_SIZE = 64;
const noiseCache = new Map<number, NoiseFunction2D>();
const defaultNoise: NoiseFunction2D = createNoise2D();

/**
 * Returns current size of noiseCache (for testing & diagnostics).
 */
export function getNoiseCacheSize(): number {
  return noiseCache.size;
}

/**
 * Retrieves a cached NoiseFunction2D instance for the given seed.
 * Implements LRU eviction capped at MAX_NOISE_CACHE_SIZE (64).
 */
export function getNoiseFunction(seed?: number): NoiseFunction2D {
  if (seed === undefined) return defaultNoise;
  let noise = noiseCache.get(seed);
  if (noise) {
    // Refresh for LRU ordering
    noiseCache.delete(seed);
    noiseCache.set(seed, noise);
    return noise;
  }
  if (noiseCache.size >= MAX_NOISE_CACHE_SIZE) {
    const oldestKey = noiseCache.keys().next().value;
    if (oldestKey !== undefined) {
      noiseCache.delete(oldestKey);
    }
  }
  noise = createNoise2D(makeRng(seed));
  noiseCache.set(seed, noise);
  return noise;
}
