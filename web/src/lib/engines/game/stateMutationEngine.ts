import {
  PlayerState,
  StateMutationDiff,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import { resolveResourceMax, resolveResourceMin } from './resourcePools';
import { computeMaxResources } from './vitalScaling';
import { applyXpGain } from './progressionEngine';

/**
 * Applies state mutations cleanly to the PlayerState and returns an immutable updated state.
 */
export function applyStateMutation(
  currentState: PlayerState,
  diff: StateMutationDiff,
  rpgSystem?: RPGSystemSchema
): PlayerState {
  const updated: PlayerState = JSON.parse(JSON.stringify(currentState));

  // 1. Apply Stat Changes
  if (diff.statChanges) {
    for (const [statId, delta] of Object.entries(diff.statChanges)) {
      const current = updated.stats[statId] || 10;
      updated.stats[statId] = Math.max(1, current + delta);
    }
  }

  // 2. Apply Resource Changes (HP, Stamina, Mana, Gold)
  // Clamp against the SCALED maximum (playerState.maxResources) so Studio
  // edits to Resource Pools + archetype/background/equipment bonuses hold.
  if (diff.resourceChanges) {
    for (const [resourceId, delta] of Object.entries(diff.resourceChanges)) {
      const current = updated.resources[resourceId] !== undefined ? updated.resources[resourceId] : 0;
      const maxVal = resolveResourceMax(resourceId, rpgSystem, updated);
      const minVal = resolveResourceMin(resourceId, rpgSystem);

      updated.resources[resourceId] = Math.min(maxVal, Math.max(minVal, current + delta));
    }
  }

  // 3. Apply Inventory Additions
  if (diff.itemsAdded && diff.itemsAdded.length > 0) {
    for (const newItem of diff.itemsAdded) {
      const existing = updated.inventory.find((i) => i.id === newItem.id);
      if (existing) {
        existing.quantity += newItem.quantity;
      } else {
        updated.inventory.push({ ...newItem });
      }
    }
  }

  // 4. Apply Inventory Removals (decrement quantity by 1 if stacked)
  if (diff.itemsRemovedIds && diff.itemsRemovedIds.length > 0) {
    for (const removeId of diff.itemsRemovedIds) {
      const itemIndex = updated.inventory.findIndex((i) => i.id === removeId);
      if (itemIndex >= 0) {
        if (updated.inventory[itemIndex].quantity > 1) {
          updated.inventory[itemIndex].quantity -= 1;
        } else {
          updated.inventory.splice(itemIndex, 1);
        }
      }
    }
  }

  // 5. Apply Location Change (Plan 13: displacedLocationId mirrors here)
  const effectiveLocation = diff.displacedLocationId || diff.locationChange;
  if (effectiveLocation) {
    updated.currentLocationId = effectiveLocation;
    if (!updated.discoveredLocationIds.includes(effectiveLocation)) {
      updated.discoveredLocationIds.push(effectiveLocation);
    }
  }

  // 5b. Plan 13: Apply threat clock updates (spawn-or-update by id).
  if (diff.clockUpdates && diff.clockUpdates.length > 0) {
    if (!updated.activeTensionClocks) updated.activeTensionClocks = [];
    for (const cu of diff.clockUpdates) {
      const existing = updated.activeTensionClocks.find((c) => c.id === cu.id);
      if (existing) {
        existing.currentSegments = Math.min(
          Math.max(2, existing.maxSegments || 4),
          Math.max(0, (existing.currentSegments || 0) + cu.delta)
        );
        if (cu.isCrisis) existing.isTriggered = true;
      } else if (cu.delta !== 0 || cu.isCrisis) {
        // Clock metadata unknown here (route seeds full clocks); record minimal entry.
        updated.activeTensionClocks.push({
          id: cu.id,
          name: cu.id,
          currentSegments: Math.max(0, cu.delta),
          maxSegments: 4,
          crisisDescription: '',
          isTriggered: cu.isCrisis || undefined,
        });
      }
    }
  }

  // 6. Apply Relationship Changes
  if (diff.relationshipChanges) {
    for (const [npcId, change] of Object.entries(diff.relationshipChanges)) {
      if (!updated.relationships[npcId]) {
        updated.relationships[npcId] = {
          trust: 0,
          knownSecrets: [],
          notes: [],
        };
      }

      const rel = updated.relationships[npcId];
      rel.trust = Math.min(100, Math.max(-100, rel.trust + change.trustDelta));

      if (change.newSecret && !rel.knownSecrets.includes(change.newSecret)) {
        rel.knownSecrets.push(change.newSecret);
      }
    }
  }

  // 7b. Refresh scaled maximums so stat/equipment shifts move the pools,
  // then clamp currents into range (covers Studio max edits mid-campaign).
  if (rpgSystem?.resources) {
    try {
      const archetype = (rpgSystem.archetypes ?? []).find((a: any) => a.id === updated.archetypeId);
      const background = (rpgSystem.backgrounds ?? []).find((b: any) => b.id === updated.backgroundId);
      const equippedIds = new Set(
        [updated.equipment?.mainHand, updated.equipment?.offHand, updated.equipment?.armor, updated.equipment?.relic].filter(Boolean)
      );
      const equippedArtifacts = (updated.inventory ?? []).filter((i: any) => equippedIds.has(i.id));
      const nextMax = computeMaxResources(updated.stats ?? {}, rpgSystem, { archetype, background, equippedArtifacts });
      updated.maxResources = nextMax;
      for (const res of rpgSystem.resources) {
        const cur = updated.resources?.[res.id];
        if (typeof cur === 'number') {
          updated.resources[res.id] = Math.min(nextMax[res.id] ?? res.max ?? cur, Math.max(res.min ?? 0, cur));
        }
      }
    } catch {
      /* non-fatal: keep previous maximums */
    }
  }

  // 7. Apply Quest Updates
  if (diff.questUpdates && diff.questUpdates.length > 0) {
    if (!updated.activeQuestIds) updated.activeQuestIds = [];
    if (!updated.completedQuestIds) updated.completedQuestIds = [];

    for (const update of diff.questUpdates) {
      if (update.status === 'active') {
        if (!updated.activeQuestIds.includes(update.questId) && !updated.completedQuestIds.includes(update.questId)) {
          updated.activeQuestIds.push(update.questId);
        }
      } else if (update.status === 'completed') {
        updated.activeQuestIds = updated.activeQuestIds.filter((id) => id !== update.questId);
        if (!updated.completedQuestIds.includes(update.questId)) {
          updated.completedQuestIds.push(update.questId);
        }
      } else if (update.status === 'failed') {
        updated.activeQuestIds = updated.activeQuestIds.filter((id) => id !== update.questId);
      }
    }
  }

  // 8. Apply Abilities Added / Removed
  if (diff.abilitiesAdded && diff.abilitiesAdded.length > 0) {
    if (!updated.abilities) updated.abilities = [];
    for (const ab of diff.abilitiesAdded) {
      if (!updated.abilities.includes(ab)) updated.abilities.push(ab);
    }
  }
  if (diff.abilitiesRemoved && diff.abilitiesRemoved.length > 0) {
    if (updated.abilities) {
      updated.abilities = updated.abilities.filter((ab) => !diff.abilitiesRemoved!.includes(ab));
    }
  }

  // 8b. Ability cooldown bookkeeping (ability id -> turn last invoked)
  if (diff.abilityCooldownSet) {
    if (!updated.abilityCooldowns) updated.abilityCooldowns = {};
    for (const [abilityId, turn] of Object.entries(diff.abilityCooldownSet)) {
      if (typeof turn === 'number' && Number.isFinite(turn)) {
        updated.abilityCooldowns[abilityId] = turn;
      }
    }
  }

  // 9. Apply Power School Rank & Mastery Changes
  if (diff.powerRankChanges) {
    if (!updated.powerRanks) updated.powerRanks = {};
    for (const [schoolId, newRank] of Object.entries(diff.powerRankChanges)) {
      updated.powerRanks[schoolId] = Math.max(0, newRank);
    }
  }

  if (diff.powerMasteryChanges) {
    if (!updated.powerSchoolMastery) updated.powerSchoolMastery = {};
    for (const [schoolId, delta] of Object.entries(diff.powerMasteryChanges)) {
      const cur = updated.powerSchoolMastery[schoolId] || 0;
      updated.powerSchoolMastery[schoolId] = Math.max(0, cur + delta);
    }
  }

  // 10. Record triggered modular encounter
  if (diff.triggeredEncounterId) {
    if (!updated.completedEncounterIds) updated.completedEncounterIds = [];
    if (!updated.completedEncounterIds.includes(diff.triggeredEncounterId)) {
      updated.completedEncounterIds.push(diff.triggeredEncounterId);
    }
  }

  // 11. Apply Progression / XP Gain
  if (diff.xpGained && diff.xpGained > 0) {
    const progConfig = rpgSystem?.progression ?? DEFAULT_PROGRESSION_CONFIG;
    const advance = applyXpGain(updated, diff.xpGained, progConfig, rpgSystem);
    updated.level = advance.updatedPlayerState.level;
    updated.currentXP = advance.updatedPlayerState.currentXP;
    updated.nextLevelXP = advance.updatedPlayerState.nextLevelXP;
    updated.totalEarnedXP = advance.updatedPlayerState.totalEarnedXP;
    updated.unspentStatPoints = advance.updatedPlayerState.unspentStatPoints;
    updated.unspentAbilityPicks = advance.updatedPlayerState.unspentAbilityPicks;
    if (advance.levelUpOccurred && advance.updatedPlayerState.maxResources) {
      updated.maxResources = advance.updatedPlayerState.maxResources;
      updated.resources = advance.updatedPlayerState.resources;
    }
  }

  return updated;
}
