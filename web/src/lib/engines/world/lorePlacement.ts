/**
 * lorePlacement.ts
 *
 * Plan 27 — Civilization & Lore stamping.
 *
 * The Cartographer's lore tools (NPC, beast den, relic, shrine, timeline event)
 * all mean the same gesture: drop a pin that *references* an entity already in
 * the world bible. Nothing here invents content — the world bible is the canon,
 * the map is a view of it.
 *
 * The mapping, the candidate list and the pin construction live here rather
 * than in the React components so they can be tested without a canvas.
 */

import type {
  MapEntityPlacement,
  MapEntityPlacementType,
  MapPoint,
  WorldBible,
} from '@/lib/types';

/** The pin kinds the lore tools can stamp. */
export type LorePinKind = Extract<
  MapEntityPlacementType,
  'npc' | 'bestiary' | 'artifact' | 'deity' | 'timeline'
>;

/** Toolbar tool id -> the kind of entity it places. */
export const LORE_TOOL_KINDS: Record<string, LorePinKind> = {
  place_npc: 'npc',
  place_creature: 'bestiary',
  place_relic: 'artifact',
  place_deity: 'deity',
  place_timeline: 'timeline',
};

/** Returns the pin kind for a toolbar tool, or null when the tool is not a lore tool. */
export function loreKindForTool(tool: string | null | undefined): LorePinKind | null {
  if (!tool) return null;
  return LORE_TOOL_KINDS[tool] ?? null;
}

export interface LorePinCandidate {
  id: string;
  name: string;
  /** A one-line hint under the name: role, species, domain, era. */
  subtitle: string;
  /** True when this entity already has a pin somewhere on this map. */
  pinned: boolean;
}

const KIND_LABELS: Record<LorePinKind, { en: string; fa: string }> = {
  npc: { en: 'NPC', fa: 'شخصیت' },
  bestiary: { en: 'Beast', fa: 'جانور' },
  artifact: { en: 'Relic', fa: 'عتیقه' },
  deity: { en: 'Deity', fa: 'ایزد' },
  timeline: { en: 'Event', fa: 'رویداد' },
};

export function loreKindLabel(kind: LorePinKind, isPersian: boolean): string {
  return isPersian ? KIND_LABELS[kind].fa : KIND_LABELS[kind].en;
}

const SPECIES_LABELS: Record<string, { en: string; fa: string }> = {
  beast: { en: 'Beast', fa: 'درنده' },
  monstrosity: { en: 'Monstrosity', fa: 'هیولا' },
  undead: { en: 'Undead', fa: 'مرده‌زی' },
  elemental: { en: 'Elemental', fa: 'عنصری' },
  flora: { en: 'Flora', fa: 'گیاه' },
  mineral: { en: 'Mineral', fa: 'کانیش' },
  draconic: { en: 'Draconic', fa: 'اژدهاسان' },
  humanoid: { en: 'Humanoid', fa: 'انسان‌نما' },
};

/**
 * Everything in the world bible that a pin of this kind could reference,
 * newest-authored order preserved. Missing arrays (older worlds) yield [].
 */
export function listLoreCandidates(
  worldBible: WorldBible | null | undefined,
  kind: LorePinKind,
  placements: MapEntityPlacement[] = [],
  isPersian = false
): LorePinCandidate[] {
  if (!worldBible) return [];
  const pinnedIds = new Set(
    placements.filter((p) => p.entityType === kind).map((p) => p.entityId)
  );

  switch (kind) {
    case 'npc':
      return (worldBible.npcs ?? []).map((npc) => ({
        id: npc.id,
        name: npc.name,
        subtitle: [npc.title, npc.role].filter(Boolean).join(' · '),
        pinned: pinnedIds.has(npc.id),
      }));

    case 'bestiary':
      return (worldBible.bestiary ?? []).map((creature) => {
        const species =
          SPECIES_LABELS[creature.speciesCategory]?.[isPersian ? 'fa' : 'en'] ??
          creature.speciesCategory;
        return {
          id: creature.id,
          name: creature.name,
          subtitle: isPersian
            ? `${species} · خطر ${creature.dangerLevel}`
            : `${species} · danger ${creature.dangerLevel}`,
          pinned: pinnedIds.has(creature.id),
        };
      });

    case 'artifact':
      return (worldBible.artifacts ?? []).map((artifact) => ({
        id: artifact.id,
        name: artifact.name,
        subtitle: [artifact.rarity, artifact.originEra].filter(Boolean).join(' · '),
        pinned: pinnedIds.has(artifact.id),
      }));

    case 'deity':
      return (worldBible.religions ?? []).map((deity) => ({
        id: deity.id,
        name: deity.name,
        subtitle: [deity.title, deity.domain].filter(Boolean).join(' · '),
        pinned: pinnedIds.has(deity.id),
      }));

    case 'timeline':
      return (worldBible.timeline ?? []).map((event) => ({
        id: event.id,
        name: event.title,
        subtitle: [event.yearOrEra, event.eraCategory].filter(Boolean).join(' · '),
        pinned: pinnedIds.has(event.id),
      }));

    default:
      return [];
  }
}

/**
 * Builds the pin. Coordinates are rounded: pins are placed by eye on a
 * manuscript map, and sub-pixel precision only makes the saved JSON noisier.
 *
 * The entity's name becomes `customLabel`, so the pin is legible on the map
 * instead of being an anonymous token.
 */
export function buildLorePlacement(
  id: string,
  kind: LorePinKind,
  entityId: string,
  label: string,
  point: MapPoint
): MapEntityPlacement {
  return {
    id,
    entityId,
    entityType: kind,
    x: Math.round(point.x),
    y: Math.round(point.y),
    customLabel: label,
  };
}

/** `pin_<base36 time>` — the id shape the rest of the Cartographer uses. */
export function makeLorePlacementId(now: number = Date.now()): string {
  return `pin_${now.toString(36)}`;
}