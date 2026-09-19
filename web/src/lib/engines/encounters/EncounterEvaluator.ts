import { StoryEncounter, PlayerState } from '@/lib/types';

export interface EvaluateEncountersParams {
  encounters?: StoryEncounter[];
  playerState: PlayerState;
  currentLocationId: string;
  locationTags?: string[];
  lastCompletedEventId?: string;
  triggerContext?: 'on_enter' | 'on_explore' | 'threat_escalation' | 'item_trigger' | 'quest_milestone' | 'event_chain' | 'any';
}

/**
 * Deterministically evaluates candidate World Encounters / Dynamic Events based on:
 * 1. Repeatability and completion history
 * 2. Location scoping and biome tags
 * 3. Item inventory requirements (the player must possess required item(s))
 * 4. Quest status prerequisites (active / completed)
 * 5. Event chaining sequences (immediate chained triggers and required prior events)
 * 6. Tension clock thresholds
 */
export function evaluateCandidateEncounters(
  params: EvaluateEncountersParams
): StoryEncounter | null {
  const {
    encounters = [],
    playerState,
    currentLocationId,
    locationTags = [],
    lastCompletedEventId,
    triggerContext = 'any',
  } = params;

  if (!encounters || encounters.length === 0) return null;

  const completedIds = new Set(playerState.completedEncounterIds || []);
  const inventoryItemIds = new Set((playerState.inventory || []).map((i) => i.id));
  const activeQuestIds = new Set(playerState.activeQuestIds || []);
  const completedQuestIds = new Set(playerState.completedQuestIds || []);

  const eligible: StoryEncounter[] = [];

  for (const encounter of encounters) {
    const cond = encounter.triggerConditions;
    if (!cond) continue;

    // 1. One-shot vs repeatable check
    if (!cond.repeatable && completedIds.has(encounter.id)) {
      continue;
    }

    // 2. Forbidden events check
    if (cond.forbiddenEventIds && cond.forbiddenEventIds.length > 0) {
      const hasForbidden = cond.forbiddenEventIds.some((fId) => completedIds.has(fId));
      if (hasForbidden) continue;
    }

    // 3. Trigger context match
    if (
      triggerContext !== 'any' &&
      cond.triggerType &&
      cond.triggerType !== 'random_weighted' &&
      cond.triggerType !== triggerContext
    ) {
      continue;
    }

    // 4. Location & Biome Tag check
    if (encounter.locationId && encounter.locationId !== currentLocationId) {
      continue;
    }
    if (encounter.locationTags && encounter.locationTags.length > 0) {
      const matchesTag = encounter.locationTags.some((tag) => locationTags.includes(tag));
      if (!matchesTag && !encounter.locationId) {
        continue;
      }
    }

    // 5. Tension / Danger Clock threshold check
    if (typeof cond.minTensionClock === 'number' && cond.minTensionClock > 0) {
      const highestClockProgress = Math.max(
        0,
        ...(playerState.activeTensionClocks || []).map((c) => c.currentSegments)
      );

      if (highestClockProgress < cond.minTensionClock) {
        continue;
      }
    }

    // 6. Item Possession Check (Player must possess the required item in inventory)
    if (cond.requiredItemIds && cond.requiredItemIds.length > 0) {
      const hasAllItems = cond.requiredItemIds.every((itemId) => inventoryItemIds.has(itemId));
      if (!hasAllItems) continue;
    }

    // 7. Quest Status Check (Active or Completed requirement)
    if (cond.requiredQuestId) {
      const reqStatus = cond.requiredQuestStatus || 'active';
      if (reqStatus === 'active' && !activeQuestIds.has(cond.requiredQuestId)) {
        continue;
      }
      if (reqStatus === 'completed' && !completedQuestIds.has(cond.requiredQuestId)) {
        continue;
      }
    }

    // 8. Event Chaining Check (End of one event triggers or unlocks another)
    if (cond.triggerAfterEventId) {
      const isDirectChain = lastCompletedEventId === cond.triggerAfterEventId;
      const isHistoricalChain = completedIds.has(cond.triggerAfterEventId);
      if (!isDirectChain && !isHistoricalChain) {
        continue;
      }
    }

    if (cond.requiredCompletedEventIds && cond.requiredCompletedEventIds.length > 0) {
      const hasAllPrior = cond.requiredCompletedEventIds.every((eId) => completedIds.has(eId));
      if (!hasAllPrior) continue;
    }

    eligible.push(encounter);
  }

  if (eligible.length === 0) return null;

  // Direct sequence chain matches get highest priority
  if (lastCompletedEventId) {
    const directChain = eligible.find(
      (e) => e.triggerConditions.triggerAfterEventId === lastCompletedEventId
    );
    if (directChain) return directChain;
  }

  // Otherwise pick based on weight
  eligible.sort((a, b) => (b.triggerConditions.weight ?? 50) - (a.triggerConditions.weight ?? 50));
  return eligible[0];
}
