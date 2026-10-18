import { ambientFromLocation, AMBIENT_PATHS, AmbientTrack } from './audioService';

/**
 * Plan 15 §2.3 tier 1 — Reader dwell-time asset prefetching.
 *
 * During the 30-60s a player spends reading scene prose and contemplating choices,
 * the client prefetches likely next assets (location art, NPC portraits, ambient soundscapes)
 * so that choice selection and scene transitions render instantly from cache.
 *
 * Zero model cost, non-blocking, browser HTTP cache friendly.
 */

export interface DwellPrefetchInput {
  currentNarrative?: string;
  choices?: Array<{ id?: string; text?: string; targetSceneId?: string }>;
  discoveredNpcs?: Array<{ id?: string; name?: string; imageUrl?: string }>;
  discoveredCreature?: { id?: string; name?: string; imageUrl?: string };
  currentLocationId?: string;
  lore?: {
    locations?: Array<{
      id: string;
      name: string;
      imageUrl?: string;
      atmosphere?: string;
      subZones?: Array<{ id: string; name: string }>;
      pointsOfInterest?: Array<{ id: string; name: string }>;
    }>;
    npcs?: Array<{ id: string; name: string; imageUrl?: string }>;
    bestiary?: Array<{ id: string; name: string; imageUrl?: string }>;
  };
}

export interface DwellPrefetchPlan {
  imageUrls: string[];
  audioUrls: string[];
}

const prefetchedCache = new Set<string>();

/**
 * Extracts candidate URLs for location art, character/creature portraits, and ambient audio
 * based on the choices on screen, current narrative mentions, and active lore entities.
 */
export function deriveDwellPrefetchAssets(input: DwellPrefetchInput): DwellPrefetchPlan {
  const images = new Set<string>();
  const audioTracks = new Set<string>();

  const choiceTexts = (input.choices || []).map((c) => (c.text || '').toLowerCase());
  const narrative = (input.currentNarrative || '').toLowerCase();
  const fullText = `${narrative} ${choiceTexts.join(' ')}`;

  // 1. Location Art & Ambience
  if (input.lore?.locations) {
    for (const loc of input.lore.locations) {
      const locIdLower = loc.id.toLowerCase();
      const locNameLower = loc.name.toLowerCase();

      // Check if location is referenced in current choices or prose
      const isMentioned =
        (locNameLower.length > 2 && fullText.includes(locNameLower)) ||
        (locIdLower.length > 2 && fullText.includes(locIdLower));

      const isCurrent = input.currentLocationId && input.currentLocationId === loc.id;

      if (isMentioned || isCurrent) {
        if (loc.imageUrl && loc.imageUrl.trim()) {
          images.add(loc.imageUrl.trim());
        }

        const trackKey = ambientFromLocation(loc.id);
        if (trackKey !== 'none' && AMBIENT_PATHS[trackKey as Exclude<AmbientTrack, 'none'>]) {
          audioTracks.add(AMBIENT_PATHS[trackKey as Exclude<AmbientTrack, 'none'>]);
        }
      }

      // Check sub-zones
      if (loc.subZones) {
        for (const sz of loc.subZones) {
          const szNameLower = sz.name.toLowerCase();
          if (szNameLower.length > 2 && fullText.includes(szNameLower)) {
            if (loc.imageUrl && loc.imageUrl.trim()) {
              images.add(loc.imageUrl.trim());
            }
          }
        }
      }
    }
  }

  // 2. NPC Portraits
  if (input.discoveredNpcs) {
    for (const npc of input.discoveredNpcs) {
      if (npc.imageUrl && npc.imageUrl.trim()) {
        images.add(npc.imageUrl.trim());
      }
    }
  }

  if (input.lore?.npcs) {
    for (const npc of input.lore.npcs) {
      const nameLower = npc.name.toLowerCase();
      if (nameLower.length > 2 && fullText.includes(nameLower)) {
        if (npc.imageUrl && npc.imageUrl.trim()) {
          images.add(npc.imageUrl.trim());
        }
      }
    }
  }

  // 3. Bestiary / Creature Portraits
  if (input.discoveredCreature?.imageUrl?.trim()) {
    images.add(input.discoveredCreature.imageUrl.trim());
  }

  if (input.lore?.bestiary) {
    for (const creature of input.lore.bestiary) {
      const nameLower = creature.name.toLowerCase();
      if (nameLower.length > 2 && fullText.includes(nameLower)) {
        if (creature.imageUrl && creature.imageUrl.trim()) {
          images.add(creature.imageUrl.trim());
        }
      }
    }
  }

  return {
    imageUrls: Array.from(images),
    audioUrls: Array.from(audioTracks),
  };
}

/**
 * Fires non-blocking browser prefetch requests for the given plan, caching URLs to avoid repeated fetches.
 */
export function prefetchDwellAssets(plan: DwellPrefetchPlan): void {
  if (typeof window === 'undefined') return;

  for (const url of plan.imageUrls) {
    if (!url || prefetchedCache.has(url)) continue;
    prefetchedCache.add(url);
    try {
      const img = new Image();
      img.src = url;
    } catch {
      /* ignore browser prefetch failure */
    }
  }

  for (const audioUrl of plan.audioUrls) {
    if (!audioUrl || prefetchedCache.has(audioUrl)) continue;
    prefetchedCache.add(audioUrl);
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = audioUrl;
    } catch {
      /* ignore audio prefetch failure */
    }
  }
}

/** Testing helper to inspect prefetched URLs. */
export function getPrefetchedUrlsForTesting(): string[] {
  return Array.from(prefetchedCache);
}

/** Testing helper to clear prefetch cache. */
export function clearPrefetchCacheForTesting(): void {
  prefetchedCache.clear();
}
