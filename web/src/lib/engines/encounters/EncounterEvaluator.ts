import { StoryEncounter, PlayerState } from '@/lib/types';
import type { WorldBible } from '@/lib/types/world';
import type { CheckResolution, StateMutationDiff } from '@/lib/types/gameplay';

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

export interface ResolveTurnEncounterParams {
  authoredEncounters: StoryEncounter[];
  playerState: PlayerState;
  worldBible: WorldBible;
  preTurnLocationId: string;
  travelArrived?: boolean;
  advanceMovedToId?: string;
  clockUpdate?: CheckResolution['clockUpdate'];
  locationChange?: string;
  authoredMoveTargetId?: string;
  /** When set, the turn just resolved an encounter hold; only local/chained follow-ups can fire immediately. */
  justResolvedEncounterId?: string;
}

/**
 * Evaluates candidate dynamic encounters for the current turn, honoring
 * intermediate waypoint `on_enter` arrivals during caravan travel as well as
 * tension clock escalation thresholds (`minTensionClock`).
 */
export function resolveTurnEncounter(
  params: ResolveTurnEncounterParams
): StoryEncounter | null {
  const {
    authoredEncounters,
    playerState,
    worldBible,
    preTurnLocationId,
    travelArrived,
    advanceMovedToId,
    clockUpdate,
    locationChange,
    authoredMoveTargetId,
    justResolvedEncounterId,
  } = params;

  if (!authoredEncounters.length) return null;

  const lastCompletedEventId = justResolvedEncounterId ?? playerState.completedEncounterIds?.at(-1);
  const highestActiveClock = Math.max(
    0,
    clockUpdate?.newSegments ?? 0,
    ...(playerState.activeTensionClocks ?? []).map((c) => c.currentSegments || 0)
  );
  const clockEscalated = Boolean(clockUpdate?.isCrisis || highestActiveClock >= 2);

  if (playerState.travel) {
    const enteredWaypointThisTurn = Boolean(
      advanceMovedToId && (playerState.travel.waypointIds ?? []).includes(advanceMovedToId)
    );
    if (enteredWaypointThisTurn) {
      const stopLoc = worldBible.locations?.find((l) => l.id === playerState.currentLocationId);
      const stopTags = [stopLoc?.category, stopLoc?.region].filter(Boolean) as string[];
      const waypointEnter = evaluateCandidateEncounters({
        encounters: authoredEncounters,
        playerState,
        currentLocationId: playerState.currentLocationId,
        locationTags: stopTags,
        lastCompletedEventId,
        triggerContext: 'on_enter',
      });
      if (waypointEnter) return waypointEnter;
    }

    const originLoc = worldBible.locations?.find(
      (l) => l.id === playerState.travel?.originLocationId
    );
    const route = playerState.travel.routeId
      ? (worldBible.tradeRoutes ?? []).find((r) => r.id === playerState.travel?.routeId)
      : undefined;
    // When finishing a paused encounter at the current stop, restrict immediate follow-up
    // to the current location itself so downstream road events wait until the caravan moves onto the road.
    const roadLocIds = justResolvedEncounterId
      ? [playerState.currentLocationId]
      : Array.from(
          new Set(
            [
              playerState.currentLocationId,
              originLoc?.parentLocationId,
              ...(route?.intermediateLocationIds ?? []),
            ].filter((id): id is string => Boolean(id))
          )
        );
    const roadPool = authoredEncounters.filter(
      (e) => e?.triggerConditions?.triggerType !== 'on_enter'
    );
    for (const locId of roadLocIds) {
      if (clockEscalated) {
        const escalated = evaluateCandidateEncounters({
          encounters: roadPool,
          playerState,
          currentLocationId: locId,
          lastCompletedEventId,
          triggerContext: 'threat_escalation',
        });
        if (escalated) return escalated;
      }
      const explore = evaluateCandidateEncounters({
        encounters: roadPool,
        playerState,
        currentLocationId: locId,
        lastCompletedEventId,
        triggerContext: 'on_explore',
      });
      if (explore && (!justResolvedEncounterId || explore.triggerConditions?.triggerAfterEventId === justResolvedEncounterId || explore.locationId === playerState.currentLocationId)) {
        return explore;
      }
    }
    return null;
  }

  const enteredNewLocation = Boolean(
    travelArrived ||
      locationChange ||
      authoredMoveTargetId ||
      playerState.currentLocationId !== preTurnLocationId
  );
  const locObj = worldBible.locations?.find((l) => l.id === playerState.currentLocationId);
  const locTags = [locObj?.category, locObj?.region].filter(Boolean) as string[];

  if (enteredNewLocation) {
    const enterEnc = evaluateCandidateEncounters({
      encounters: authoredEncounters,
      playerState,
      currentLocationId: playerState.currentLocationId,
      locationTags: locTags,
      lastCompletedEventId,
      triggerContext: 'on_enter',
    });
    if (enterEnc) return enterEnc;
  }
  if (clockEscalated) {
    const escalated = evaluateCandidateEncounters({
      encounters: authoredEncounters,
      playerState,
      currentLocationId: playerState.currentLocationId,
      locationTags: locTags,
      lastCompletedEventId,
      triggerContext: 'threat_escalation',
    });
    if (escalated) return escalated;
  }
  if (!enteredNewLocation) {
    return evaluateCandidateEncounters({
      encounters: authoredEncounters,
      playerState,
      currentLocationId: playerState.currentLocationId,
      locationTags: locTags,
      lastCompletedEventId,
      triggerContext: 'on_explore',
    });
  }
  return null;
}

/**
 * Grants pending encounter rewards after the player engages and resolves
 * the prior turn's encounter without catastrophic failure.
 */
export function settlePendingEncounterRewards(
  playerState: PlayerState,
  worldBible: WorldBible,
  outcome: CheckResolution['outcome']
): StateMutationDiff | null {
  const pending = playerState.pendingEncounterRewards ?? [];
  if (pending.length === 0) return null;
  if (outcome === 'failure' || outcome === 'critical_failure') return null;

  const itemsAdded: NonNullable<StateMutationDiff['itemsAdded']> = [];
  const questUpdates: NonNullable<StateMutationDiff['questUpdates']> = [];

  for (const reward of pending) {
    for (const itemId of reward.rewardItemIds ?? []) {
      const art = (worldBible.artifacts ?? []).find((a) => a.id === itemId);
      if (!art) continue;
      itemsAdded.push({
        id: art.id,
        name: art.name,
        type: art.nonEquippable ? 'quest_item' : 'relic',
        description: art.description || art.title || '',
        quantity: 1,
        nonEquippable: art.nonEquippable,
        startsQuestId: art.startsQuestId,
        ...(art.imageUrl ? { imageUrl: art.imageUrl } : {}),
      });
    }
    if (
      reward.advanceQuestId &&
      !(playerState.activeQuestIds ?? []).includes(reward.advanceQuestId) &&
      !(playerState.completedQuestIds ?? []).includes(reward.advanceQuestId)
    ) {
      questUpdates.push({ questId: reward.advanceQuestId, status: 'active' });
    }
  }

  return {
    pendingEncounterRewards: [],
    ...(itemsAdded.length > 0 ? { itemsAdded } : {}),
    ...(questUpdates.length > 0 ? { questUpdates } : {}),
  };
}

