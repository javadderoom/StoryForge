import { PlayerState } from '@/lib/types/gameplay';
import { GameItem } from '@/lib/types/rpg';
import { isConsumableItem, isTwoHanded, isOffHandOnly } from './rpgEngine';

export function getItem(playerState: PlayerState, itemId: string): GameItem | undefined {
  return playerState.inventory.find((i) => i.id === itemId);
}

function cloneEquipment(eq: PlayerState['equipment']) {
  return { ...eq };
}

export function equippedIds(eq: PlayerState['equipment']): string[] {
  return [eq.mainHand, eq.offHand, eq.armor, eq.relic].filter((x): x is string => !!x);
}

export function isEquipped(playerState: PlayerState, itemId: string): boolean {
  return equippedIds(playerState.equipment).includes(itemId);
}

export function equipItem(
  playerState: PlayerState,
  itemId: string,
  targetSlot?: 'mainHand' | 'offHand'
): PlayerState {
  const item = getItem(playerState, itemId);
  if (!item) return playerState;
  // Quest/plot tokens (sealed letters, ceremonial arms) can never be equipped,
  // even when their type would otherwise allow a slot.
  if (item.nonEquippable) return playerState;
  const eq = cloneEquipment(playerState.equipment);

  if (isOffHandOnly(item) || item.type === 'shield') {
    const mainItem = eq.mainHand ? getItem(playerState, eq.mainHand) : undefined;
    const clearMain = isTwoHanded(mainItem);
    eq.offHand = itemId;
    if (clearMain) eq.mainHand = undefined;
  } else if (isTwoHanded(item)) {
    eq.mainHand = itemId;
    eq.offHand = undefined;
  } else if (item.grip === 'one_handed' || item.type === 'weapon') {
    const slot = targetSlot ?? 'mainHand';
    const mainItem = eq.mainHand ? getItem(playerState, eq.mainHand) : undefined;
    const was2Handed = isTwoHanded(mainItem);
    if (slot === 'offHand') {
      eq.offHand = itemId;
      if (was2Handed) eq.mainHand = undefined;
    } else {
      eq.mainHand = itemId;
    }
  } else if (item.type === 'armor') {
    eq.armor = itemId;
  } else if (item.type === 'relic') {
    eq.relic = itemId;
  }

  return { ...playerState, equipment: eq };
}

export function unequipItem(playerState: PlayerState, slot: keyof PlayerState['equipment']): PlayerState {
  const eq = cloneEquipment(playerState.equipment);
  (eq as any)[slot] = undefined;
  return { ...playerState, equipment: eq };
}

export interface ItemUseResult {
  success: boolean;
  isFull: boolean;
  previousHp: number;
  newHp: number;
  healedAmount: number;
}

  export function consumeItem(
  playerState: PlayerState,
  itemId: string,
  rpgSystem?: { resources?: Array<{ id: string; max?: number; min?: number }> },
): { playerState: PlayerState; result: ItemUseResult } {
  const item = getItem(playerState, itemId);
  if (!item || !isConsumableItem(item)) {
    return { playerState, result: { success: false, isFull: false, previousHp: 0, newHp: 0, healedAmount: 0 } };
  }
  const maxFor = (id: string, fallback: number) => {
    const scaled = (playerState as any).maxResources?.[id];
    if (typeof scaled === 'number' && Number.isFinite(scaled)) return scaled;
    const def = rpgSystem?.resources?.find((r) => r.id === id);
    if (def && typeof def.max === 'number') return def.max;
    return fallback;
  };
  const resources = { ...playerState.resources };
  const hpMax = maxFor('hp', 100);
  const staminaMax = maxFor('stamina', 50);
  const prevHp = resources['hp'] ?? hpMax;
  const prevStamina = resources['stamina'] ?? staminaMax;

  const isHealingOnly = item.healValue != null && item.healValue > 0 && (!item.staminaValue || item.staminaValue <= 0);
  if (isHealingOnly && prevHp >= hpMax) {
    return {
      playerState,
      result: { success: false, isFull: true, previousHp: prevHp, newHp: prevHp, healedAmount: 0 },
    };
  }

  let newHp = prevHp;
  if (item.healValue != null && item.healValue > 0) {
    newHp = Math.max(0, Math.min(hpMax, prevHp + item.healValue));
    resources['hp'] = newHp;
  }
  if (item.staminaValue != null && item.staminaValue! > 0) {
    resources['stamina'] = Math.max(0, Math.min(staminaMax, prevStamina + item.staminaValue!));
  }
  // Generic resource restoration (e.g. mana potions) respects scaled maximums.
  const restoration = (item as any).resourceRestoration as { targetResourceId?: string; amount?: number } | undefined;
  if (restoration?.targetResourceId && typeof restoration.amount === 'number' && restoration.amount > 0) {
    const targetMax = maxFor(restoration.targetResourceId, 100);
    const prev = resources[restoration.targetResourceId] ?? targetMax;
    resources[restoration.targetResourceId] = Math.max(0, Math.min(targetMax, prev + restoration.amount));
  }

  const newInventory = playerState.inventory
    .map((inv) => {
      if (inv.id === itemId && inv.quantity > 1) {
        return { ...inv, quantity: inv.quantity - 1 };
      }
      return inv;
    })
    .filter((inv) => !(inv.id === itemId && inv.quantity <= 1));

  return {
    playerState: { ...playerState, resources, inventory: newInventory },
    result: { success: true, isFull: false, previousHp: prevHp, newHp, healedAmount: newHp - prevHp },
  };
}
