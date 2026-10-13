import { RPGSystemSchema, ArchetypeDefinition, BackgroundOriginDefinition } from '@/lib/types/rpg';
import { STAT_CANONICAL_ALIASES } from '@/lib/engines/world/ActionNormalizer';

export interface VitalScalingOptions {
  archetype?: ArchetypeDefinition;
  background?: BackgroundOriginDefinition;
  equippedArtifacts?: Array<{ resourceModifiers?: Record<string, number> }>;
  powerBonuses?: Record<string, number>;
}

/**
 * Derives full VitalScalingOptions (archetype, background, equipped items, power bonuses)
 * directly from a PlayerState, story RPG system, and optional vault artifacts/power schools.
 */
export function resolveScalingOptions(
  playerState?: {
    archetypeId?: string;
    backgroundId?: string;
    equipment?: { mainHand?: string | null; offHand?: string | null; armor?: string | null; relic?: string | null };
    inventory?: Array<{ id: string; resourceModifiers?: Record<string, number> }>;
    powerRanks?: Record<string, number>;
  },
  rpgSystem?: RPGSystemSchema,
  storyArtifacts?: any[],
  storyPowerSchools?: any[]
): VitalScalingOptions {
  if (!playerState || !rpgSystem) return {};
  const archetype = (rpgSystem.archetypes ?? []).find((a: any) => a.id === playerState.archetypeId);
  const background = (rpgSystem.backgrounds ?? []).find((b: any) => b.id === playerState.backgroundId);
  const equippedIds = new Set(
    [
      playerState.equipment?.mainHand,
      playerState.equipment?.offHand,
      playerState.equipment?.armor,
      playerState.equipment?.relic,
    ].filter(Boolean)
  );
  const byId = new Map<string, any>();
  for (const item of playerState.inventory ?? []) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const art of storyArtifacts ?? []) {
    if (art?.id && !byId.has(art.id)) byId.set(art.id, art);
  }
  const equippedArtifacts = Array.from(equippedIds).map((id) => byId.get(id!)).filter(Boolean);

  const powerBonuses: Record<string, number> = {};
  if (playerState.powerRanks && storyPowerSchools) {
    for (const [schoolId, rankNum] of Object.entries(playerState.powerRanks)) {
      const school = storyPowerSchools.find((s: any) => s.id === schoolId);
      if (school?.ranks) {
        for (const rank of school.ranks) {
          if (rank.rankNumber <= rankNum && rank.resourceBonuses) {
            for (const [resId, b] of Object.entries(rank.resourceBonuses)) {
              powerBonuses[resId] = (powerBonuses[resId] || 0) + (typeof b === 'number' ? b : 0);
            }
          }
        }
      }
    }
  }

  return {
    archetype,
    background,
    equippedArtifacts,
    ...(Object.keys(powerBonuses).length > 0 ? { powerBonuses } : {}),
  };
}

/**
 * Resolves the zero-modifier baseline for a stat — the value at which
 * `GameEngine.getStatModifier` returns 0.
 *
 * Precedence deliberately matches `GameEngine.resolveActionCheck`:
 *   rpgSystem.universalBaseValue  ->  the stat's authored baseValue  ->  10
 *
 * This is NOT the same lookup as the `stat.baseValue` read inside
 * `computeMaxResources`. That one wants the per-stat authored baseline because
 * it measures a *deviation* to apply `bonusPerPointAboveBase` to. This one wants
 * the system-wide baseline because it is the origin a brand-new stat is created
 * at — getting this wrong inflates every allocated point on a low-scale system.
 */
export function resolveStatBase(
  statId: string,
  rpgSystem?: RPGSystemSchema
): number {
  if (!rpgSystem) return 10;
  const raw = (statId || '').trim();
  const canonical =
    STAT_CANONICAL_ALIASES[raw.toLowerCase()] || STAT_CANONICAL_ALIASES[raw] || raw;
  const def = (rpgSystem.stats || []).find(
    (s) =>
      s.id?.toLowerCase() === canonical.toLowerCase() ||
      s.id?.toLowerCase() === raw.toLowerCase()
  );
  return rpgSystem.universalBaseValue ?? def?.baseValue ?? 10;
}

/**
 * True when `statId` names a stat this RPG system actually defines.
 * Used to reject phantom stats from untrusted allocation payloads.
 */
export function isDefinedStat(statId: string, rpgSystem?: RPGSystemSchema): boolean {
  if (!rpgSystem) return true; // no system context — cannot reject
  const raw = (statId || '').trim();
  return (rpgSystem.stats || []).some((s) => s?.id === raw);
}

/** True when `abilityId` names an ability this RPG system actually defines. */
export function isDefinedAbility(abilityId: string, rpgSystem?: RPGSystemSchema): boolean {
  if (!rpgSystem) return true;
  const abilities = (rpgSystem as unknown as { abilities?: Array<{ id?: string }> }).abilities;
  if (!Array.isArray(abilities) || abilities.length === 0) return true;
  return abilities.some((a) => a?.id === abilityId);
}

/**
 * Computes authoritative maximum resource pool values incorporating:
 * 1. Base maximums from story RPG definition
 * 2. Selected Archetype vital bonuses (e.g. +5 Max HP for Warrior)
 * 3. Selected Background vital bonuses (e.g. +3 Stamina for Veteran)
 * 4. Dynamic Stat Vital Effects (e.g. Constitution adding +2 HP per point above base)
 * 5. Equipped gear & artifact passive resource modifiers (e.g. +10 HP from Shield)
 */
export function computeMaxResources(
  playerStats: Record<string, number> = {},
  rpgSystem: RPGSystemSchema,
  options?: VitalScalingOptions
): Record<string, number> {
  const maxResources: Record<string, number> = {};

  // 1. Base maximums from story RPG definition
  for (const res of rpgSystem.resources || []) {
    maxResources[res.id] = res.max;
  }

  // 2. Archetype vital bonuses
  if (options?.archetype?.resourceBonuses) {
    for (const [resId, bonus] of Object.entries(options.archetype.resourceBonuses)) {
      if (typeof bonus === 'number' && maxResources[resId] !== undefined) {
        maxResources[resId] += bonus;
      }
    }
  }

  // 3. Background vital bonuses
  if (options?.background?.resourceBonuses) {
    for (const [resId, bonus] of Object.entries(options.background.resourceBonuses)) {
      if (typeof bonus === 'number' && maxResources[resId] !== undefined) {
        maxResources[resId] += bonus;
      }
    }
  }

  // 4. Dynamic Stat-to-Vital Scaling Effects (generic, author-configured)
  for (const stat of rpgSystem.stats || []) {
    if (stat.vitalEffect && stat.vitalEffect.targetResourceId) {
      const targetResId = stat.vitalEffect.targetResourceId;
      if (maxResources[targetResId] !== undefined) {
        const playerScore = playerStats[stat.id] ?? stat.baseValue;
        const diff = playerScore - stat.baseValue;
        if (diff !== 0 && typeof stat.vitalEffect.bonusPerPointAboveBase === 'number') {
          maxResources[targetResId] += diff * stat.vitalEffect.bonusPerPointAboveBase;
        }
      }
    }
  }

  // 5. Equipped artifact & item passive resource modifiers
  if (options?.equippedArtifacts) {
    for (const item of options.equippedArtifacts) {
      if (item.resourceModifiers) {
        for (const [resId, bonus] of Object.entries(item.resourceModifiers)) {
          if (typeof bonus === 'number' && maxResources[resId] !== undefined) {
            maxResources[resId] += bonus;
          }
        }
      }
    }
  }

  // 6. Power rank passive resource bonuses
  if (options?.powerBonuses) {
    for (const [resId, bonus] of Object.entries(options.powerBonuses)) {
      if (typeof bonus === 'number' && maxResources[resId] !== undefined) {
        maxResources[resId] += bonus;
      }
    }
  }

  // Guard: all maximums must be integers >= 1
  for (const resId of Object.keys(maxResources)) {
    maxResources[resId] = Math.max(1, Math.round(maxResources[resId]));
  }

  return maxResources;
}
