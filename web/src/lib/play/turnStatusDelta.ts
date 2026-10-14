import { PlayerState } from '@/lib/types/gameplay';

export interface StatusDeltaItem {
  id: string;
  type:
    | 'healthLoss'
    | 'healthGain'
    | 'resourceLoss'
    | 'resourceGain'
    | 'currencyGain'
    | 'currencyLoss'
    | 'itemAcquired'
    | 'itemLost';
  label: string;
  delta?: number;
  subtitle?: string;
  isNegative: boolean;
  colorClass: string;
}

export function computeTurnStatusDelta(
  oldState: PlayerState | null | undefined,
  newState: PlayerState | null | undefined,
  options: {
    isPersian?: boolean;
    rpgResources?: any[];
    currencyDenominations?: any[];
  } = {}
): StatusDeltaItem[] {
  if (!oldState || !newState) return [];

  const { isPersian = false, rpgResources = [], currencyDenominations = [] } = options;
  const changes: StatusDeltaItem[] = [];

  // 1. Health & Resources (HP, Stamina, Mana, etc.)
  const oldResources = oldState.resources || {};
  const newResources = newState.resources || {};
  const allResourceKeys = Array.from(new Set([...Object.keys(oldResources), ...Object.keys(newResources)]));

  for (const key of allResourceKeys) {
    const oldVal = oldResources[key] ?? 0;
    const newVal = newResources[key] ?? 0;
    const diff = newVal - oldVal;
    if (diff === 0) continue;

    const lowerKey = key.toLowerCase();
    const isHp = lowerKey === 'hp' || lowerKey === 'health' || lowerKey === 'جان' || lowerKey === 'سلامت';

    const def = rpgResources.find((r: any) => r.id?.toLowerCase() === lowerKey);
    let name = def?.name || key;
    if (isHp) {
      name = isPersian ? 'جان' : 'Health';
    }

    if (isHp) {
      if (diff < 0) {
        changes.push({
          id: `res_${key}_${diff}`,
          type: 'healthLoss',
          label: name,
          delta: diff,
          isNegative: true,
          colorClass: 'border-rose-500/60 bg-rose-950/90 text-rose-200 shadow-rose-950/50',
        });
      } else {
        changes.push({
          id: `res_${key}_${diff}`,
          type: 'healthGain',
          label: name,
          delta: diff,
          isNegative: false,
          colorClass: 'border-emerald-500/60 bg-emerald-950/90 text-emerald-200 shadow-emerald-950/50',
        });
      }
    } else {
      if (diff < 0) {
        changes.push({
          id: `res_${key}_${diff}`,
          type: 'resourceLoss',
          label: name,
          delta: diff,
          isNegative: true,
          colorClass: 'border-amber-600/60 bg-amber-950/90 text-amber-200 shadow-amber-950/50',
        });
      } else {
        changes.push({
          id: `res_${key}_${diff}`,
          type: 'resourceGain',
          label: name,
          delta: diff,
          isNegative: false,
          colorClass: 'border-cyan-500/60 bg-cyan-950/90 text-cyan-200 shadow-cyan-950/50',
        });
      }
    }
  }

  // 2. Purse (Multi-denomination Currency)
  const oldPurse = oldState.purse || {};
  const newPurse = newState.purse || {};
  const allPurseKeys = Array.from(new Set([...Object.keys(oldPurse), ...Object.keys(newPurse)]));

  for (const key of allPurseKeys) {
    const oldVal = oldPurse[key] ?? 0;
    const newVal = newPurse[key] ?? 0;
    const diff = newVal - oldVal;
    if (diff === 0) continue;

    const denom = currencyDenominations.find((d: any) => d.id?.toLowerCase() === key.toLowerCase());
    const coinName = denom ? (isPersian ? denom.nameFa || denom.id : denom.nameEn || denom.id) : key;

    if (diff > 0) {
      changes.push({
        id: `purse_${key}_${diff}`,
        type: 'currencyGain',
        label: coinName,
        delta: diff,
        isNegative: false,
        colorClass: 'border-amber-400/60 bg-amber-950/90 text-amber-300 shadow-amber-950/50',
      });
    } else {
      changes.push({
        id: `purse_${key}_${diff}`,
        type: 'currencyLoss',
        label: coinName,
        delta: diff,
        isNegative: true,
        colorClass: 'border-zinc-700 bg-zinc-900/90 text-zinc-300 shadow-black/50',
      });
    }
  }

  // 3. Inventory Items Added / Removed
  const oldInventory = oldState.inventory || [];
  const newInventory = newState.inventory || [];

  const oldMap = new Map<string, { qty: number; name: string }>();
  for (const item of oldInventory) {
    oldMap.set(item.id, {
      qty: (oldMap.get(item.id)?.qty || 0) + (item.quantity || 1),
      name: item.name || item.id,
    });
  }

  const newMap = new Map<string, { qty: number; name: string }>();
  for (const item of newInventory) {
    newMap.set(item.id, {
      qty: (newMap.get(item.id)?.qty || 0) + (item.quantity || 1),
      name: item.name || item.id,
    });
  }

  for (const [id, info] of newMap.entries()) {
    const oldQty = oldMap.get(id)?.qty || 0;
    if (info.qty > oldQty) {
      const diff = info.qty - oldQty;
      changes.push({
        id: `item_add_${id}`,
        type: 'itemAcquired',
        label: info.name,
        delta: diff > 1 ? diff : undefined,
        subtitle: isPersian ? 'دریافت شد' : 'Acquired',
        isNegative: false,
        colorClass: 'border-purple-500/60 bg-purple-950/90 text-purple-200 shadow-purple-950/50',
      });
    }
  }

  for (const [id, info] of oldMap.entries()) {
    const newQty = newMap.get(id)?.qty || 0;
    if (newQty < info.qty) {
      const diff = info.qty - newQty;
      changes.push({
        id: `item_rem_${id}`,
        type: 'itemLost',
        label: info.name,
        delta: diff > 1 ? -diff : undefined,
        subtitle: isPersian ? 'مصرف / از دست رفت' : 'Used / Lost',
        isNegative: true,
        colorClass: 'border-zinc-700 bg-zinc-900/90 text-zinc-400 shadow-black/50',
      });
    }
  }

  return changes;
}
