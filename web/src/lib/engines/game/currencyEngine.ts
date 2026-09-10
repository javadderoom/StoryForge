import { CurrencySystem, CurrencyDenomination, DEFAULT_CURRENCY_PRESETS } from '@/lib/types/rpg';

/**
 * Ensures a valid CurrencySystem exists, falling back to Fantasy Coinage.
 */
export function normalizeCurrencySystem(system?: CurrencySystem): CurrencySystem {
  if (system && system.denominations && system.denominations.length > 0) {
    // Sort denominations descending by valueInBase (highest to lowest, e.g. Gold -> Silver -> Copper)
    const sorted = [...system.denominations].sort((a, b) => b.valueInBase - a.valueInBase);
    return {
      enabled: system.enabled ?? true,
      baseUnitNameFa: system.baseUnitNameFa || 'پشیز مسی',
      baseUnitNameEn: system.baseUnitNameEn || 'Copper Fals',
      denominations: sorted,
    };
  }
  return DEFAULT_CURRENCY_PRESETS.fantasy;
}

/**
 * Converts a player's purse into the total value of smallest base units (copper/pashiz).
 */
export function toBaseValue(
  purse: Record<string, number> = {},
  system: CurrencySystem = DEFAULT_CURRENCY_PRESETS.fantasy
): number {
  const normalized = normalizeCurrencySystem(system);
  let total = 0;
  for (const denom of normalized.denominations) {
    const count = purse[denom.id] || 0;
    if (count > 0) {
      total += count * denom.valueInBase;
    }
  }
  return Math.max(0, Math.floor(total));
}

/**
 * Breaks down a raw total value in base units into optimal coin denominations (highest to lowest).
 */
export function toPurseBreakdown(
  totalBase: number,
  system: CurrencySystem = DEFAULT_CURRENCY_PRESETS.fantasy
): Record<string, number> {
  const normalized = normalizeCurrencySystem(system);
  let remaining = Math.max(0, Math.floor(totalBase));
  const result: Record<string, number> = {};

  for (const denom of normalized.denominations) {
    if (denom.valueInBase <= 0) continue;
    const count = Math.floor(remaining / denom.valueInBase);
    result[denom.id] = count;
    remaining %= denom.valueInBase;
  }

  return result;
}

export interface DeductionResult {
  success: boolean;
  newPurse: Record<string, number>;
  totalBaseRemaining: number;
  changeGiven?: Record<string, number>;
  error?: string;
}

/**
 * Deducts cost in base units from the purse, automatically breaking larger coins and giving change.
 * e.g., Player has { gold: 1 } (100 base), buys a 15-base item -> newPurse: { silver: 8, copper: 5 }
 */
export function deductFromPurse(
  purse: Record<string, number> = {},
  costInBase: number,
  system: CurrencySystem = DEFAULT_CURRENCY_PRESETS.fantasy
): DeductionResult {
  const normalized = normalizeCurrencySystem(system);
  const currentTotal = toBaseValue(purse, normalized);

  if (costInBase < 0) {
    return {
      success: false,
      newPurse: { ...purse },
      totalBaseRemaining: currentTotal,
      error: 'Cost cannot be negative',
    };
  }

  if (currentTotal < costInBase) {
    return {
      success: false,
      newPurse: { ...purse },
      totalBaseRemaining: currentTotal,
      error: 'Insufficient funds in purse',
    };
  }

  const remainingBase = currentTotal - costInBase;
  const optimalBreakdown = toPurseBreakdown(remainingBase, normalized);

  return {
    success: true,
    newPurse: optimalBreakdown,
    totalBaseRemaining: remainingBase,
  };
}

/**
 * Adds coins or base units directly into a purse.
 */
export function addToPurse(
  purse: Record<string, number> = {},
  addition: Record<string, number> = {}
): Record<string, number> {
  const result: Record<string, number> = { ...purse };
  for (const [denomId, amount] of Object.entries(addition)) {
    if (typeof amount === 'number' && amount > 0) {
      result[denomId] = (result[denomId] || 0) + Math.floor(amount);
    }
  }
  return result;
}

/**
 * Formats a purse into a human-readable localized string.
 * e.g., "🪙 2 دینار طلا، 🥈 5 درهم نقره، 🥉 12 پشیز مسی"
 */
export function formatPurse(
  purse: Record<string, number> = {},
  system: CurrencySystem = DEFAULT_CURRENCY_PRESETS.fantasy,
  isPersian: boolean = true
): string {
  const normalized = normalizeCurrencySystem(system);
  const parts: string[] = [];

  for (const denom of normalized.denominations) {
    const amount = purse[denom.id] || 0;
    if (amount > 0) {
      const name = isPersian ? denom.nameFa : denom.nameEn;
      parts.push(`${denom.symbol} ${amount} ${name}`);
    }
  }

  if (parts.length === 0) {
    return isPersian ? 'کیسه خالی (۰ سکه)' : 'Empty Purse (0 coins)';
  }

  return parts.join(isPersian ? '، ' : ', ');
}
