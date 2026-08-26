import { PlayerState } from '@/lib/types/gameplay';
import { GameItem, ItemRarity, WeaponGrip } from '@/lib/types/rpg';

/** D&D-style stat modifier: floor((stat - 10) / 2). */
export function getStatModifier(statValue: number): number {
  return Math.floor((statValue - 10) / 2);
}

/** Resolve an RPG stat id from action text + available stats (bilingual). */
export function inferStatId(
  actionText: string,
  riskLevel?: string,
  playerState?: PlayerState
): string {
  const lower = actionText.toLowerCase();
  const availableStats = playerState ? Object.keys(playerState.stats).map((k) => k.toLowerCase()) : [];

  for (const statKey of availableStats) {
    if (lower.includes(statKey)) return statKey;
  }

  const clusters: Array<[RegExp, string[]]> = [
    [
      /حمله|خنجر|شمشیر|مشت|زور|ضرب|strike|hit|attack|force|slash|might|break|fight|shoot|punch/,
      ['might', 'strength', 'power', 'combat', 'athletics', 'force'],
    ],
    [
      /پنهان|مخفی|فرار|چابک|sneak|hide|dodge|jump|run|agility|slip|flee|escape|acrobatics|stealth/,
      ['agility', 'dexterity', 'speed', 'stealth', 'reflexes', 'finesse'],
    ],
    [
      /قفل|تله|کلید|lock|pick|trap|cunning|معما|دقت|examine|investigate|mechanism|hack|code|analyze|wit|search/,
      ['cunning', 'wit', 'intellect', 'perception', 'hacking', 'tech', 'investigation', 'logic'],
    ],
    [
      /افسون|جادو|ورد|طلسم|magic|spell|arcana|relic|curse|occult|channel|ritual|cyberware/,
      ['arcana', 'magic', 'occult', 'spirit', 'sorcery', 'cyberware', 'mysticism'],
    ],
    [
      /عشق|نگاه|همدلی|فریب|مذاکره|صحبت|لبخند|charm|persuade|talk|romance|empathy|deceive|lie|intimidate|diplomacy|passion|kiss|hug|confess/,
      ['charm', 'empathy', 'passion', 'presence', 'charisma', 'persuasion', 'diplomacy', 'wit'],
    ],
  ];

  for (const [regex, targets] of clusters) {
    if (regex.test(lower)) {
      for (const target of targets) {
        if (availableStats.includes(target)) return target;
      }
    }
  }

  if (availableStats.length) {
    if (riskLevel === 'high' && availableStats.length > 1) return availableStats[0];
    return availableStats[availableStats.length > 1 ? 1 : 0];
  }
  return 'might';
}

function allEquippedIds(equipment: PlayerState['equipment']): string[] {
  return [equipment.mainHand, equipment.offHand, equipment.armor, equipment.relic].filter(
    (x): x is string => !!x
  );
}

/** Flat equipment + passive tool (quest_item) modifier for a given stat. */
export function calculateEquipmentModifier(playerState: PlayerState, effectiveStatId: string): number {
  let modifier = 0;
  const equippedIds = allEquippedIds(playerState.equipment);
  for (const item of playerState.inventory) {
    const isEquipped = equippedIds.includes(item.id);
    const isRelevantTool = item.type === 'quest_item';
    if ((isEquipped || isRelevantTool) && item.statModifiers && item.statModifiers[effectiveStatId] != null) {
      modifier += item.statModifiers[effectiveStatId]!;
    }
  }
  return modifier;
}

/** Detect tactical consumable triggers (smoke pellet) for +4 advantage. */
export function detectTacticalModifier(actionText: string, playerState: PlayerState): number {
  const lower = actionText.toLowerCase();
  if (/smoke|pellet|دود|مه|استتار/.test(lower)) {
    const hasSmokePellet = playerState.inventory.some(
      (i) => (i.id === 'smoke_pellet' || i.name.toLowerCase().includes('smoke') || i.name.includes('دود')) && i.quantity > 0
    );
    if (hasSmokePellet) return 4;
  }
  return 0;
}

export type DiceOutcome =
  | 'critical_failure'
  | 'failure'
  | 'mixed_success'
  | 'success'
  | 'critical_success';

export interface DiceResolution {
  success: boolean;
  outcome: DiceOutcome;
  resultNumber: number;
  d20: number;
  statModifier: number;
  tacticalModifier: number;
  equipmentModifier: number;
  total: number;
  difficultyClass: number;
  requiredStat: string;
  consequenceSummary: string;
  criticalSuccess?: boolean;
  criticalFailure?: boolean;
}

/** Deterministically resolve a check (client parity twin of backend GameEngine). */
export function resolveActionCheck(opts: {
  actionText: string;
  playerState?: PlayerState;
  requiredStatId?: string;
  targetDC?: number;
  riskLevel?: string;
  forcedDiceRoll?: number;
  isPersian?: boolean;
}): DiceResolution {
  const { actionText, playerState, requiredStatId, targetDC, riskLevel = 'medium', forcedDiceRoll, isPersian = false } = opts;
  const roll = forcedDiceRoll ?? Math.floor(Math.random() * 20) + 1;
  const isNatMax = roll === 20;
  const isNatMin = roll === 1;

  const effectiveStatId = requiredStatId ?? inferStatId(actionText, riskLevel, playerState);
  const baseStatVal = playerState?.stats?.[effectiveStatId] ?? 10;
  const statModifier = getStatModifier(baseStatVal);
  const equipmentModifier = playerState ? calculateEquipmentModifier(playerState, effectiveStatId) : 0;
  const tacticalEnvMod = playerState ? detectTacticalModifier(actionText, playerState) : 0;

  const totalScore = roll + statModifier + equipmentModifier + tacticalEnvMod;

  const baseDC =
    targetDC ??
    (riskLevel === 'high' ? 15 : riskLevel === 'low' ? 9 : 12);

  let outcome: DiceOutcome;
  let consequenceSummary: string;

  if (isNatMin) {
    outcome = 'critical_failure';
    consequenceSummary = isPersian
      ? 'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.'
      : 'Disaster strikes: complete failure with severe complications or damage.';
  } else if (isNatMax) {
    outcome = 'critical_success';
    consequenceSummary = isPersian
      ? 'اجرای بی‌نقص: موفقیت چشمگیر همراه با بینش تاکتیکی و برتری کامل.'
      : 'Flawless execution: effortless success with bonus insight or tactical advantage.';
  } else if (totalScore >= baseDC + 5) {
    outcome = 'critical_success';
    consequenceSummary = isPersian
      ? 'پیروزی قاطع: دستیابی به هدف با مهارت و برتری استثنایی.'
      : 'Decisive victory: achieved the objective with exceptional style and advantage.';
  } else if (totalScore >= baseDC) {
    outcome = 'success';
    consequenceSummary = isPersian
      ? 'موفقیت آشکار: هدف دقیقاً مطابق انتظار محقق شد.'
      : 'Clear success: objective accomplished as intended.';
  } else if (totalScore >= baseDC - 3) {
    outcome = 'mixed_success';
    consequenceSummary = isPersian
      ? 'موفقیت نسبی: هدف حاصل شد، اما با پرداخت بها، جراحت جزئی یا جلب توجه.'
      : 'Mixed success: goal achieved, but with cost, minor injury, or alert raised.';
  } else {
    outcome = 'failure';
    consequenceSummary = isPersian
      ? 'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.'
      : 'The attempt failed: unexpected obstacle arose or opportunity lost.';
  }

  const isCritSuccess = outcome === 'critical_success';
  const isCritFailure = outcome === 'critical_failure';
  const rolledSuccess = outcome === 'success' || outcome === 'critical_success' || outcome === 'mixed_success';

  return {
    success: rolledSuccess,
    outcome,
    resultNumber: roll,
    d20: roll,
    statModifier,
    tacticalModifier: tacticalEnvMod,
    equipmentModifier,
    total: totalScore,
    difficultyClass: baseDC,
    requiredStat: effectiveStatId,
    consequenceSummary,
    criticalSuccess: isCritSuccess,
    criticalFailure: isCritFailure,
  };
}

/** Effective stat = base + all equipped (and passive tool) bonuses. */
export function getEffectiveStatValue(playerState: PlayerState, statId: string): number {
  const base = playerState.stats?.[statId] ?? 10;
  return base + calculateEquipmentModifier(playerState, statId);
}

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#94A3B8',
  uncommon: '#10B981',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export const RARITY_TITLES_FA: Record<ItemRarity, string> = {
  common: 'معمولی (Common)',
  uncommon: 'کمیاب (Uncommon)',
  rare: 'بسیار نایاب (Rare)',
  epic: 'حماسی (Epic)',
  legendary: 'افسانه‌ای (Legendary)',
};

export function isTwoHanded(item?: GameItem): boolean {
  return item?.grip === 'two_handed';
}
export function isOffHandOnly(item?: GameItem): boolean {
  return item?.grip === 'off_hand_only' || item?.type === 'shield';
}
export function isConsumableItem(item?: GameItem): boolean {
  if (!item) return false;
  return (
    item.isConsumable === true ||
    item.healValue != null ||
    item.staminaValue != null
  );
}

export function formatStatName(statId: string, isPersian: boolean): string {
  if (!isPersian) {
    return statId
      .replaceAll('_', ' ')
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }
  switch (statId.toLowerCase().replaceAll(' ', '_')) {
    case 'might':
    case 'strength':
      return 'قدرت';
    case 'agility':
    case 'dexterity':
    case 'speed':
      return 'چابکی';
    case 'cunning':
    case 'wit':
      return 'ذکاوت';
    case 'arcana':
    case 'magic':
    case 'sorcery':
      return 'دانش کهن';
    case 'charm':
    case 'charisma':
      return 'جذابیت';
    case 'empathy':
      return 'همدلی';
    case 'passion':
      return 'شور و اشتیاق';
    case 'deduction':
      return 'استنتاج';
    case 'perception':
    case 'observation':
      return 'دقت و بینش';
    case 'hacking':
    case 'tech':
      return 'نفوذ سایبری';
    case 'cyberware':
      return 'افزونه‌های سایبری';
    default:
      return statId.replaceAll('_', ' ');
  }
}
