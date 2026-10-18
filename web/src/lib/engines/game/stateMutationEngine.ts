import {
  PlayerState,
  StateMutationDiff,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import { resolveResourceMax, resolveResourceMin, resolveHealthKey, resolveStaminaKey } from './resourcePools';
import { computeMaxResources, resolveScalingOptions } from './vitalScaling';
import { applyXpGain } from './progressionEngine';

/**
 * Applies state mutations cleanly to the PlayerState and returns an immutable updated state.
 *
 * Plan 17: `options.previousState` is the pre-turn snapshot used by the
 * condition auto-derivation crossing guard — a wound is only auto-removed
 * when the vitals crossed from the danger zone back to recovery in this
 * turn, never because a heal landed on an already-healthy character.
 */
export function applyStateMutation(
  currentState: PlayerState,
  diff: StateMutationDiff,
  rpgSystem?: RPGSystemSchema,
  options?: { previousState?: PlayerState }
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
    // Plan 15 (Pillar 4): a macro move invalidates the micro-location of the
    // previous place — a stale sub-zone pointer would render an old ravine
    // next to a new city in the vitality bar. An explicit diff-provided
    // sub-zone (applied at §below) still wins over this reset.
    if (diff.currentSubZoneId === undefined) {
      updated.currentSubZoneId = undefined;
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

  // 5c. Character Conditions & Status System (سیستم وضعیت و حالت‌های کاراکتر)
  let activeConditions = Array.isArray(updated.conditions) ? [...updated.conditions] : [];

  // Direct overwrite if provided
  const hasConditionOverwrite = Array.isArray(diff.conditions);
  if (hasConditionOverwrite) {
    activeConditions = [...diff.conditions!];
  }

  // Apply explicit removals
  const explicitlyRemoved = new Set<string>((diff.conditionsRemoved ?? []).map((c) => c.trim()));
  if (explicitlyRemoved.size > 0) {
    activeConditions = activeConditions.filter((c) => !explicitlyRemoved.has(c.trim()));
  }

  // Apply explicit additions
  if (Array.isArray(diff.conditionsAdded) && diff.conditionsAdded.length > 0) {
    for (const c of diff.conditionsAdded) {
      const clean = c.trim();
      if (clean && !activeConditions.includes(clean)) {
        activeConditions.push(clean);
      }
    }
  }

  // Plan 17: auto-derivation now reads the story's real pools and never
  // fights an explicit removal/overwrite from the same turn.
  const prevForRatios = options?.previousState ?? currentState;
  const healthKey = resolveHealthKey(rpgSystem);
  const staminaKey = resolveStaminaKey(rpgSystem);

  const hasTag = (tag: string) => activeConditions.some((c) => c.trim() === tag || c.trim().startsWith(`${tag} `));
  const wounds = () => activeConditions.filter((c) => c.trim().startsWith('زخمی'));
  /** Auto-add is suppressed when this turn explicitly removed the kind or
   * wrote a condition overwrite that no longer contains it. */
  const autoAddSuppressed = (tag: string) =>
    explicitlyRemoved.has(tag) || (hasConditionOverwrite && !activeConditions.includes(tag));

  const resourceRatio = (state: PlayerState, key: string): number => {
    const current = state.resources?.[key];
    const max = state.maxResources?.[key] ?? resolveResourceMax(key, rpgSystem, state);
    return typeof current === 'number' && max > 0 ? current / max : 1;
  };

  const hpRatio = resourceRatio(updated, healthKey);
  const prevHpRatio = resourceRatio(prevForRatios, healthKey);

  if (hpRatio <= 0.35 && !hasTag('زخمی') && !autoAddSuppressed('زخمی')) {
    activeConditions.push('زخمی');
  } else if (
    wounds().length > 0 &&
    !autoAddSuppressed('زخمی') &&
    // Crossing guard: only auto-clear when the vitals actually recovered
    // from the danger zone this turn. A generic heal on an already-stable
    // character never erases a narrated wound (Plan 17 §3.5).
    prevHpRatio <= 0.35 &&
    hpRatio >= 0.70
  ) {
    activeConditions = activeConditions.filter((c) => !c.trim().startsWith('زخمی'));
  }

  const staminaRatio = resourceRatio(updated, staminaKey);
  const prevStaminaRatio = resourceRatio(prevForRatios, staminaKey);

  if (staminaRatio <= 0.20 && !hasTag('خسته') && !autoAddSuppressed('خسته')) {
    activeConditions.push('خسته');
  } else if (
    hasTag('خسته') &&
    !autoAddSuppressed('خسته') &&
    prevStaminaRatio <= 0.20 &&
    staminaRatio >= 0.75
  ) {
    activeConditions = activeConditions.filter((c) => c.trim() !== 'خسته');
  }

  // Desert water tension clock derivation (Plan 17: identify by metadata,
  // not the magic session id the old check hardcoded).
  const waterClock = (updated.activeTensionClocks || []).find(
    (c) =>
      /آب|عطش|تشنه|water|thirst/i.test(c.name || '') ||
      /water|thirst|عطش/i.test(c.id || '')
  );
  if (waterClock) {
    if (waterClock.currentSegments >= 2 && !hasTag('تشنه') && !autoAddSuppressed('تشنه')) {
      activeConditions.push('تشنه');
    } else if (
      waterClock.currentSegments === 0 &&
      hasTag('تشنه') &&
      !autoAddSuppressed('تشنه')
    ) {
      activeConditions = activeConditions.filter((c) => c.trim() !== 'تشنه');
    }
  }

  // Plan 17 invariant: the baseline "healthy" tag never coexists with any
  // body condition (the reconciler re-seeds it when the body zone is clear).
  const BODY_TAGS = ['زخمی', 'خونریزی', 'خسته', 'تشنه', 'مسموم'];
  if (activeConditions.some((c) => BODY_TAGS.some((t) => c.trim().startsWith(t)))) {
    activeConditions = activeConditions.filter((c) => c.trim() !== 'تندرست');
  }

  updated.conditions = activeConditions;

  // 5d. Plan 17: journey lifecycle (start / replace / cancel). `null` clears;
  // `undefined` leaves the current journey untouched.
  if (diff.travel !== undefined) {
    updated.travel = diff.travel === null
      ? null
      : {
          ...diff.travel,
          waypointIds: [...(diff.travel.waypointIds ?? [])],
          caravanNpcIds: [...(diff.travel.caravanNpcIds ?? [])],
        };
  }

  // Plan 15 (Bug 3): explicit roster overwrite (set when present, incl. []).
  if (Array.isArray(diff.accompanyingNpcIds)) {
    updated.accompanyingNpcIds = [...diff.accompanyingNpcIds];
  }

  // Plan 15 (Pillar 4): micro-location / sub-zone updates
  if (diff.currentSubZoneId !== undefined) {
    updated.currentSubZoneId = diff.currentSubZoneId || undefined;
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
      const scalingOptions = resolveScalingOptions(updated, rpgSystem);
      const nextMax = computeMaxResources(updated.stats ?? {}, rpgSystem, scalingOptions);
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
