import { PlayerState } from '@/lib/types/gameplay';
import { PowerSchool } from '@/lib/types/world';

/**
 * Attempts a point/resource-driven breakthrough to the next rank in a power school.
 * Checks mastery points, required resources, and reagents.
 * If fulfilled, advances the rank, consumes costs, unlocks abilities, and applies stat bonuses.
 */
export function attemptPowerBreakthrough(
  currentState: PlayerState,
  school: PowerSchool
): { success: boolean; updatedState: PlayerState; reason?: string } {
  const currentRank = currentState.powerRanks?.[school.id] || 0;
  const nextRankNum = currentRank + 1;
  const targetRank = school.ranks.find((r) => r.rank === nextRankNum);

  if (!targetRank) {
    return {
      success: false,
      updatedState: currentState,
      reason: `Max rank already reached or next rank ${nextRankNum} not defined.`,
    };
  }

  const updated: PlayerState = JSON.parse(JSON.stringify(currentState));
  if (!updated.powerRanks) updated.powerRanks = {};
  if (!updated.powerSchoolMastery) updated.powerSchoolMastery = {};

  const cost = targetRank.advancementCost;
  if (cost) {
    // 1. Mastery Points check
    const currentMastery = updated.powerSchoolMastery[school.id] || 0;
    const reqMastery = cost.masteryPointsRequired || 0;
    if (currentMastery < reqMastery) {
      return {
        success: false,
        updatedState: currentState,
        reason: `Insufficient mastery points. Required: ${reqMastery}, Current: ${currentMastery}.`,
      };
    }

    // 2. Resource check
    if (cost.resourceCosts) {
      for (const [resId, reqAmount] of Object.entries(cost.resourceCosts)) {
        const curRes = updated.resources[resId] || 0;
        if (curRes < reqAmount) {
          return {
            success: false,
            updatedState: currentState,
            reason: `Insufficient ${resId}. Required: ${reqAmount}, Current: ${curRes}.`,
          };
        }
      }
    }

    // 3. Required items check
    if (cost.requiredItemIds && cost.requiredItemIds.length > 0) {
      for (const itemId of cost.requiredItemIds) {
        const hasItem = updated.inventory.some((i) => i.id === itemId && i.quantity > 0);
        if (!hasItem) {
          return {
            success: false,
            updatedState: currentState,
            reason: `Missing required breakthrough reagent: ${itemId}.`,
          };
        }
      }
    }

    // Consume resources
    if (cost.resourceCosts) {
      for (const [resId, reqAmount] of Object.entries(cost.resourceCosts)) {
        updated.resources[resId] = Math.max(0, (updated.resources[resId] || 0) - reqAmount);
      }
    }
    // Consume items (1 of each required item)
    if (cost.requiredItemIds) {
      for (const itemId of cost.requiredItemIds) {
        const idx = updated.inventory.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
          if (updated.inventory[idx].quantity > 1) {
            updated.inventory[idx].quantity -= 1;
          } else {
            updated.inventory.splice(idx, 1);
          }
        }
      }
    }
  }

  // Advance Rank
  updated.powerRanks[school.id] = nextRankNum;

  // Apply Passive Stat Bonuses
  if (targetRank.statBonuses) {
    for (const [statId, bonus] of Object.entries(targetRank.statBonuses)) {
      updated.stats[statId] = (updated.stats[statId] || 10) + bonus;
    }
  }

  // Apply Passive Resource Bonuses
  if (targetRank.resourceBonuses) {
    for (const [resId, bonus] of Object.entries(targetRank.resourceBonuses)) {
      updated.resources[resId] = (updated.resources[resId] || 0) + bonus;
      if (updated.maxResources && updated.maxResources[resId] !== undefined) {
        updated.maxResources[resId] += bonus;
      }
    }
  }

  // Unlock Rank Abilities
  if (targetRank.unlockedAbilityIds && targetRank.unlockedAbilityIds.length > 0) {
    if (!updated.abilities) updated.abilities = [];
    for (const abId of targetRank.unlockedAbilityIds) {
      if (!updated.abilities.includes(abId)) {
        updated.abilities.push(abId);
      }
    }
  }

  return { success: true, updatedState: updated };
}
