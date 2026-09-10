import { RPGSystemSchema, ArchetypeDefinition, BackgroundOriginDefinition } from '@/lib/types/rpg';

export interface VitalScalingOptions {
  archetype?: ArchetypeDefinition;
  background?: BackgroundOriginDefinition;
  equippedArtifacts?: Array<{ resourceModifiers?: Record<string, number> }>;
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

  // Guard: all maximums must be integers >= 1
  for (const resId of Object.keys(maxResources)) {
    maxResources[resId] = Math.max(1, Math.round(maxResources[resId]));
  }

  return maxResources;
}
