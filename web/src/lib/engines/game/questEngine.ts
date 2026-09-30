import { PlayerState, StateMutationDiff, DiceOutcome } from '@/lib/types/gameplay';
import { WorldBible, WorldQuest, QuestObjective } from '@/lib/types/world';

/**
 * Evaluates inventory items that trigger quests (e.g. letters, seals, artifacts).
 * Automatically activates any eligible unstarted quest.
 */
export function evaluateQuestItemTriggers(
  playerState: PlayerState,
  worldBible: WorldBible
): { diff: StateMutationDiff; activatedQuests: WorldQuest[] } | null {
  const quests = worldBible.quests ?? [];
  if (quests.length === 0) return null;

  const activeSet = new Set(playerState.activeQuestIds ?? []);
  const completedSet = new Set(playerState.completedQuestIds ?? []);
  const activated: WorldQuest[] = [];

  for (const item of playerState.inventory ?? []) {
    for (const quest of quests) {
      if (activeSet.has(quest.id) || completedSet.has(quest.id)) continue;

      const isItemTrigger =
        (item.startsQuestId && item.startsQuestId === quest.id) ||
        (quest.triggerItemId && (quest.triggerItemId === item.id || quest.triggerItemId === item.name));

      if (isItemTrigger) {
        activeSet.add(quest.id);
        activated.push(quest);
      }
    }
  }

  if (activated.length === 0) return null;

  return {
    diff: {
      questUpdates: activated.map((q) => ({ questId: q.id, status: 'active' as const })),
    },
    activatedQuests: activated,
  };
}

/**
 * Checks if an unstarted quest's prerequisites are met so an NPC or event can offer it.
 */
export function canOfferQuest(quest: WorldQuest, playerState: PlayerState): boolean {
  const activeSet = new Set(playerState.activeQuestIds ?? []);
  const completedSet = new Set(playerState.completedQuestIds ?? []);
  if (activeSet.has(quest.id) || completedSet.has(quest.id)) return false;

  // 1. Required completed quests
  const reqCompleted = quest.prerequisites?.requiredCompletedQuestIds ?? [];
  if (reqCompleted.some((id) => !completedSet.has(id))) return false;

  // 2. Required trust level with quest giver
  if (quest.giverNpcId && quest.prerequisites?.requiredTrustLevel !== undefined) {
    const currentTrust = playerState.relationships?.[quest.giverNpcId]?.trust ?? 0;
    if (currentTrust < quest.prerequisites.requiredTrustLevel) return false;
  }

  // 3. Required possessed items
  const reqItems = quest.prerequisites?.requiredPossessedItemIds ?? [];
  if (reqItems.length > 0) {
    const heldIds = new Set(playerState.inventory.map((i) => i.id));
    if (reqItems.some((id) => !heldIds.has(id))) return false;
  }

  return true;
}

/**
 * Determines if a single quest objective is fulfilled given current player state and action context.
 */
export function isObjectiveSatisfied(
  objective: QuestObjective,
  playerState: PlayerState,
  context?: {
    targetNpcId?: string;
    actionText?: string;
    outcome?: DiceOutcome;
  }
): boolean {
  switch (objective.type) {
    case 'fetch':
    case 'deliver': {
      // Must possess required item with sufficient quantity
      if (objective.requiredItemId || objective.requiredItemName) {
        const matchingItem = playerState.inventory.find(
          (i) =>
            (objective.requiredItemId && i.id === objective.requiredItemId) ||
            (objective.requiredItemName && i.name.toLowerCase() === objective.requiredItemName.toLowerCase())
        );
        if (!matchingItem || matchingItem.quantity < (objective.requiredQuantity ?? 1)) {
          return false;
        }
      }
      // If deliver requires reaching a specific NPC or location:
      if (objective.targetNpcId && context?.targetNpcId && objective.targetNpcId !== context.targetNpcId) {
        return false;
      }
      if (objective.targetLocationId && playerState.currentLocationId !== objective.targetLocationId) {
        return false;
      }
      return true;
    }
    case 'discover': {
      if (objective.targetLocationId) {
        return (
          playerState.currentLocationId === objective.targetLocationId ||
          (playerState.discoveredLocationIds ?? []).includes(objective.targetLocationId)
        );
      }
      return false;
    }
    case 'slay':
    case 'infiltrate':
    case 'escort':
    case 'interrogate': {
      // Location check
      if (objective.targetLocationId && playerState.currentLocationId !== objective.targetLocationId) {
        return false;
      }
      // NPC check
      if (objective.targetNpcId && context?.targetNpcId && objective.targetNpcId !== context.targetNpcId) {
        return false;
      }
      // If an action check was resolved, must not be failure
      if (context?.outcome && (context.outcome === 'failure' || context.outcome === 'critical_failure')) {
        return false;
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Evaluates active quests and returns any quests whose non-optional objectives are all satisfied.
 */
export function evaluateActiveQuests(
  playerState: PlayerState,
  worldBible: WorldBible,
  context?: {
    targetNpcId?: string;
    actionText?: string;
    outcome?: DiceOutcome;
  }
): { readyToComplete: WorldQuest[] } {
  const quests = worldBible.quests ?? [];
  const activeIds = new Set(playerState.activeQuestIds ?? []);
  const readyToComplete: WorldQuest[] = [];

  for (const quest of quests) {
    if (!activeIds.has(quest.id)) continue;

    const nonOptionalObjectives = quest.objectives.filter((o) => !o.isOptional);
    const allMet = nonOptionalObjectives.every((obj) =>
      isObjectiveSatisfied(obj, playerState, context)
    );

    if (allMet && nonOptionalObjectives.length > 0) {
      readyToComplete.push(quest);
    }
  }

  return { readyToComplete };
}

/**
 * Completes a quest, consuming hand-in items, granting trust and rewards,
 * unlocking linked secrets, and advancing quest lines.
 */
export function completeQuest(
  quest: WorldQuest,
  playerState: PlayerState,
  worldBible: WorldBible
): { diff: StateMutationDiff; narrativeSummary: string } {
  const diff: StateMutationDiff = {
    questUpdates: [{ questId: quest.id, status: 'completed' }],
    itemsRemovedIds: [],
    itemsAdded: [],
    resourceChanges: {},
    relationshipChanges: {},
  };

  // 1. Consume hand-in items for objectives with consumeItemOnComplete: true
  for (const obj of quest.objectives) {
    if (obj.consumeItemOnComplete && (obj.requiredItemId || obj.requiredItemName)) {
      const item = playerState.inventory.find(
        (i) =>
          (obj.requiredItemId && i.id === obj.requiredItemId) ||
          (obj.requiredItemName && i.name.toLowerCase() === obj.requiredItemName.toLowerCase())
      );
      if (item) {
        diff.itemsRemovedIds!.push(item.id);
      }
    }
  }

  // 2. Grant Trust Rewards
  const trustRewards = quest.rewards?.trustRewards ?? [];
  for (const reward of trustRewards) {
    diff.relationshipChanges![reward.npcId] = {
      trustDelta: reward.trustDelta,
    };
  }

  // Default giver trust if no explicit trust reward was configured
  if (quest.giverNpcId && trustRewards.length === 0) {
    diff.relationshipChanges![quest.giverNpcId] = {
      trustDelta: 25,
    };
  }

  // 3. Grant Gold Reward
  if (quest.rewards?.goldReward && quest.rewards.goldReward > 0) {
    diff.resourceChanges!['gold'] = (diff.resourceChanges!['gold'] || 0) + quest.rewards.goldReward;
  }

  // 4. Grant Item Rewards
  if (quest.rewards?.itemRewards && quest.rewards.itemRewards.length > 0) {
    diff.itemsAdded = quest.rewards.itemRewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      quantity: reward.quantity ?? 1,
      description: `Awarded for fulfilling "${quest.title}".`,
      type: 'quest_item' as const,
    }));
  }

  // 5. Unlock NPC Secrets (direct unlockedSecretIds + SecretRevealMethodKind='quest')
  const secretIdsToUnlock = new Set(quest.rewards?.unlockedSecretIds ?? []);
  for (const npc of worldBible.npcs ?? []) {
    for (const secret of npc.secrets ?? []) {
      const hasQuestMethod = secret.revealMethods?.some(
        (m) => m.kind === 'quest' && m.questId === quest.id
      );
      if (hasQuestMethod) {
        secretIdsToUnlock.add(secret.id);
      }
    }
  }

  // Attach discovered secrets to relationshipChanges
  for (const secretId of secretIdsToUnlock) {
    const parentNpc = (worldBible.npcs ?? []).find((n) =>
      (n.secrets ?? []).some((s) => s.id === secretId)
    );
    if (parentNpc) {
      const existing = diff.relationshipChanges![parentNpc.id] || { trustDelta: 0 };
      diff.relationshipChanges![parentNpc.id] = {
        ...existing,
        newSecret: secretId,
      };
    }
  }

  // 6. Advance Quest Line (queue nextQuestId if specified)
  if (quest.nextQuestId) {
    const nextQuest = (worldBible.quests ?? []).find((q) => q.id === quest.nextQuestId);
    if (nextQuest) {
      diff.questUpdates!.push({ questId: quest.nextQuestId, status: 'active' });
    }
  }

  // Clean up empty diff containers
  if (diff.itemsRemovedIds!.length === 0) delete diff.itemsRemovedIds;
  if (diff.itemsAdded!.length === 0) delete diff.itemsAdded;
  if (Object.keys(diff.resourceChanges!).length === 0) delete diff.resourceChanges;

  const giver = (worldBible.npcs ?? []).find((n) => n.id === quest.giverNpcId);
  const narrativeSummary =
    quest.rewards?.narrativeResolution ||
    `Deed fulfilled: "${quest.title}". ${giver ? `Trust earned with ${giver.name}.` : 'Objectives accomplished.'}`;

  return { diff, narrativeSummary };
}
