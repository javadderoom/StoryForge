import { PlayerState, StateMutationDiff } from '@/lib/types/gameplay';
import { RPGSystemSchema } from '@/lib/types/rpg';

/**
 * Determines if the player has been defeated (HP ≤ 0) and returns the
 * penalties and narrative context for the hybrid defeat resolution.
 *
 * Rules:
 * - 1st defeat: Lose 50% gold, wake at last safe location, -5 trust
 *   from all NPCs present, narrative scar (consequence text).
 * - 2nd defeat: Lose a random non-quest inventory item + above.
 * - 3rd+ defeat: Permanent stat penalty (-1 to a relevant stat) + above.
 *
 * This method returns a StateMutationDiff that should be applied on top
 * of the existing state, plus narrative context for the AI.
 *
 * Pure function of (currentState, defeatCount, rpgSystem, checkedStatId).
 */
export function resolveDefeat(
  currentState: PlayerState,
  rpgSystem: RPGSystemSchema,
  checkedStatId?: string
): {
  diff: StateMutationDiff;
  defeatCount: number;
  narrativeHint: string;
} {
  const count = (currentState.defeatCount ?? 0) + 1;
  const diff: StateMutationDiff = { resourceChanges: {} };

  // --- Gold Penalty (always): lose 50% of current gold ---
  const goldResource = rpgSystem.resources.find((r) => r.id === 'gold');
  const currentGold = currentState.resources?.gold ?? currentState.resources?.['gold'] ?? 0;
  if (goldResource && currentGold > 0) {
    const goldLoss = -Math.floor(currentGold * 0.5);
    diff.resourceChanges!['gold'] = goldLoss;
  }

  // --- HP: restore to 25% of max to allow play to continue ---
  const healthResource =
    rpgSystem.resources.find((r) => /^(health|hp|سلامت|تندرستی)$/i.test(r.id)) ||
    rpgSystem.resources.find((r) => /health|hp|vital/i.test(r.id)) ||
    rpgSystem.resources[0];
  const healthKey = healthResource?.id || 'health';
  const hpMax = healthResource?.max ?? 100;
  const currentHp = currentState.resources?.[healthKey] ?? 0;
  const reviveHp = Math.max(1, Math.floor(hpMax * 0.25));
  diff.resourceChanges![healthKey] = reviveHp - currentHp;

  // --- Trust penalty: -5 to all known relationships ---
  const relChanges: Record<string, { trustDelta: number }> = {};
  for (const npcId of Object.keys(currentState.relationships ?? {})) {
    relChanges[npcId] = { trustDelta: -5 };
  }
  diff.relationshipChanges = relChanges;

  // --- 2nd+ defeat: lose a random non-quest item ---
  if (count >= 2) {
    const lossableItems = currentState.inventory.filter(
      (i) => i.type !== 'quest_item' && !/quest|relic|key/i.test(i.id)
    );
    if (lossableItems.length > 0) {
      const idx = Math.floor(Math.random() * lossableItems.length);
      diff.itemsRemovedIds = [lossableItems[idx].id];
    }
  }

  // --- 3rd+ defeat: permanent stat penalty ---
  if (count >= 3) {
    const statId = checkedStatId || rpgSystem.stats[0]?.id;
    if (statId) {
      diff.statChanges = { [statId]: -1 };
    }
  }

  // --- Location: return to first discovered location (safe haven) ---
  const safeLocId = currentState.discoveredLocationIds[0] ?? currentState.currentLocationId;
  diff.locationChange = safeLocId;

  // --- Build narrative hint for the AI ---
  const ordinal = count === 1 ? '1st' : count === 2 ? '2nd' : `${count}th`;
  let hint = `DEFEAT (${ordinal} time): The player has fallen in battle. `;
  hint += `They lost half their gold and wake at ${safeLocId} with ${reviveHp} HP. `;
  hint += `All NPC trust decreased by 5. `;
  if (count >= 2 && diff.itemsRemovedIds?.length) {
    const lostItem = currentState.inventory.find((i) => i.id === diff.itemsRemovedIds![0]);
    hint += `They lost their ${lostItem?.name ?? 'equipment'} in the fall. `;
  }
  if (count >= 3 && diff.statChanges) {
    const [sid, delta] = Object.entries(diff.statChanges)[0];
    hint += `Permanent scar: ${sid} ${delta}. `;
  }
  hint += `Narrate the defeat, unconsciousness, and grim awakening with escalating consequences. DO NOT kill the character.`;

  return { diff, defeatCount: count, narrativeHint: hint };
}
