import { PlayerState, RiskLevel, DiceOutcome } from '@/lib/types/gameplay';
import {
  ProgressionConfig,
  DEFAULT_PROGRESSION_CONFIG,
  RPGSystemSchema,
  AbilityDefinition,
} from '@/lib/types/rpg';
import { computeMaxResources, resolveStatBase, isDefinedStat, isDefinedAbility } from './vitalScaling';

export interface ActionXpContext {
  riskLevel?: RiskLevel;
  outcome: DiceOutcome;
  diceRoll?: number;
  creatureDangerLevel?: 1 | 2 | 3 | 4 | 5;
}

export interface XpAwardResult {
  amount: number;
  reasonEn: string;
  reasonFa: string;
}

export interface ProgressionAdvanceResult {
  updatedPlayerState: PlayerState;
  levelUpOccurred: boolean;
  previousLevel: number;
  newLevel: number;
  statPointsGained: number;
  abilityPicksGained: number;
  xpAward: XpAwardResult;
}

/**
 * Returns the threshold of XP required to advance from the given level to the next.
 */
export function getXpThresholdForLevel(
  level: number,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG
): number {
  const current = Math.max(1, level);

  if (config.curveType === 'custom' && Array.isArray(config.customThresholds)) {
    if (config.customThresholds[current - 1] !== undefined) {
      return config.customThresholds[current - 1];
    }
  }

  if (config.curveType === 'linear') {
    return current * 100;
  }

  if (config.curveType === 'fast') {
    return Math.round(50 + current * 40);
  }

  // Standard RPG Curve: 100, 150, 200, 250, 300... (Level 1 requires 100, Level 2 requires 150...)
  return 50 * (current + 1);
}

/**
 * Calculates XP earned from a turn action check, scaling with risk level,
 * check outcome, critical dice roll, and creature danger rating.
 */
export function calculateActionXp(
  context: ActionXpContext,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG
): XpAwardResult {
  const cfg = config.actionXp || DEFAULT_PROGRESSION_CONFIG.actionXp;
  const risk = context.riskLevel || 'medium';

  let base = cfg.mediumRisk;
  if (risk === 'low') base = cfg.lowRisk;
  if (risk === 'high') base = cfg.highRisk;

  let multiplier = 1.0;
  let outcomeLabelEn = 'Action Success';
  let outcomeLabelFa = 'موفقیت در اقدام';

  if (context.outcome === 'mixed_success') {
    multiplier = cfg.partialSuccessMultiplier;
    outcomeLabelEn = 'Partial Success';
    outcomeLabelFa = 'موفقیت نسبی با پیامد';
  } else if (context.outcome === 'failure' || context.outcome === 'critical_failure') {
    multiplier = cfg.failureMultiplier;
    outcomeLabelEn = 'Learning from Adversity';
    outcomeLabelFa = 'کسب تجربه از شکست';
  } else if (context.outcome === 'critical_success') {
    multiplier = 1.0;
    outcomeLabelEn = 'Critical Triumph';
    outcomeLabelFa = 'پیروزی درخشان و بحرانی';
  }

  let xp = Math.round(base * multiplier);
  const reasonsEn: string[] = [`+${xp} XP (${risk} risk ${outcomeLabelEn})`];
  const reasonsFa: string[] = [`+${xp} تجربه (${outcomeLabelFa} - ریسک ${risk === 'high' ? 'بالا' : risk === 'low' ? 'پایین' : 'متوسط'})`];

  // Nat 20 Critical Bonus
  if (context.diceRoll === 20 && cfg.criticalBonus > 0) {
    xp += cfg.criticalBonus;
    reasonsEn.push(`+${cfg.criticalBonus} Natural 20 Bonus`);
    reasonsFa.push(`+${cfg.criticalBonus} پاداش تاس ۲۰ طبیعی`);
  }

  // Defeating or surviving creature encounters
  if (context.creatureDangerLevel && context.outcome !== 'failure') {
    const creatureXp = context.creatureDangerLevel * cfg.creaturePerDangerLevel;
    xp += creatureXp;
    reasonsEn.push(`+${creatureXp} Threat CR${context.creatureDangerLevel}`);
    reasonsFa.push(`+${creatureXp} پاداش مهار موجود خطرناک (سطح ${context.creatureDangerLevel})`);
  }

  return {
    amount: Math.max(1, xp),
    reasonEn: reasonsEn.join(', '),
    reasonFa: reasonsFa.join('، '),
  };
}

/**
 * Calculates XP earned from milestone events (quests, chapters, discoveries).
 */
export function calculateMilestoneXp(
  type: 'quest' | 'chapter' | 'discovery',
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG
): XpAwardResult {
  const cfg = config.milestoneXp || DEFAULT_PROGRESSION_CONFIG.milestoneXp;

  if (type === 'chapter') {
    return {
      amount: cfg.chapterCompleted,
      reasonEn: `+${cfg.chapterCompleted} XP Chapter Climax Milestone`,
      reasonFa: `+${cfg.chapterCompleted} تجربه تکمیل فصل و عطف داستانی`,
    };
  }

  if (type === 'discovery') {
    return {
      amount: cfg.discovery,
      reasonEn: `+${cfg.discovery} XP Major Lore Discovery`,
      reasonFa: `+${cfg.discovery} تجربه کشف حقیقت یا راز مهم`,
    };
  }

  // Default: quest completion
  return {
    amount: cfg.questCompleted,
    reasonEn: `+${cfg.questCompleted} XP Quest Objective Completed`,
    reasonFa: `+${cfg.questCompleted} تجربه تکمیل هدف و ماموریت`,
  };
}

/**
 * Applies XP gain to playerState, handling single and multi-level overflows,
 * stat point rewards, ability pick slots, and optional heroic surge healing.
 */
export function applyXpGain(
  playerState: PlayerState,
  xpEarned: number,
  config: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
  rpgSystem?: RPGSystemSchema
): ProgressionAdvanceResult {
  const updated: PlayerState = JSON.parse(JSON.stringify(playerState));

  let currentLevel = updated.level || 1;
  let currentXP = updated.currentXP || 0;
  let totalEarned = (updated.totalEarnedXP || 0) + xpEarned;
  let unspentStats = updated.unspentStatPoints || 0;
  let unspentAbilities = updated.unspentAbilityPicks || 0;

  const previousLevel = currentLevel;
  const maxLevel = config.maxLevel || 10;
  let statPointsGained = 0;
  let abilityPicksGained = 0;
  let levelUpOccurred = false;

  currentXP += xpEarned;

  if (config.enabled !== false) {
    while (currentLevel < maxLevel) {
      const needed = getXpThresholdForLevel(currentLevel, config);
      if (currentXP >= needed) {
        currentXP -= needed;
        currentLevel += 1;
        levelUpOccurred = true;

        const statGrant = config.statPointsPerLevel ?? 1;
        statPointsGained += statGrant;
        unspentStats += statGrant;

        // Ability cadence
        if (config.abilityUnlockCadence === 'every_level') {
          abilityPicksGained += 1;
          unspentAbilities += 1;
        } else if (
          config.abilityUnlockCadence === 'every_n_levels' ||
          config.abilityUnlockCadence === 'every_two_levels'
        ) {
          const interval = Math.max(1, config.abilityUnlockInterval ?? 2);
          if (currentLevel % interval === 0) {
            abilityPicksGained += 1;
            unspentAbilities += 1;
          }
        }
      } else {
        break;
      }
    }
  }

  // If capped at max level, cap currentXP to needed threshold
  if (currentLevel >= maxLevel) {
    currentXP = Math.min(currentXP, getXpThresholdForLevel(maxLevel, config));
  }

  updated.level = currentLevel;
  updated.currentXP = currentXP;
  updated.nextLevelXP = getXpThresholdForLevel(currentLevel, config);
  updated.totalEarnedXP = totalEarned;
  updated.unspentStatPoints = unspentStats;
  updated.unspentAbilityPicks = unspentAbilities;

  // Heroic surge: heal all resources to their maximum on level up if configured
  if (levelUpOccurred && config.healOnLevelUp !== false && rpgSystem) {
    try {
      const nextMax = computeMaxResources(updated.stats, rpgSystem);
      updated.maxResources = nextMax;
      for (const [resId, maxVal] of Object.entries(nextMax)) {
        updated.resources[resId] = maxVal;
      }
    } catch {
      /* non-fatal: retain previous resources */
    }
  }

  return {
    updatedPlayerState: updated,
    levelUpOccurred,
    previousLevel,
    newLevel: currentLevel,
    statPointsGained,
    abilityPicksGained,
    xpAward: {
      amount: xpEarned,
      reasonEn: `+${xpEarned} XP`,
      reasonFa: `+${xpEarned} تجربه`,
    },
  };
}

/**
 * Normalizes one untrusted allocation entry into a non-negative integer, or
 * null if it is not a usable point spend.
 *
 * The budget check and the apply loop MUST agree on what "a point" means. The
 * previous implementation summed a *signed* total but only applied entries
 * where `b > 0`, so `{ might: 100, agility: -99 }` netted to 1 point, cleared
 * the budget, granted +100 might and silently skipped agility.
 */
function normalizeAllocation(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const truncated = Math.trunc(n);
  return truncated > 0 ? truncated : null;
}

/**
 * Commits the player's choices during a Level-Up:
 * Allocates stat points, learns an optional chosen ability, and recomputes vital maximums.
 *
 * `statAllocations` and `chosenAbilityId` are attacker-controlled when this is
 * reached over HTTP, so every entry is validated: only positive integers count
 * toward the budget, only stats/abilities the RPG system actually defines are
 * applied, and new stats are created at the system baseline (not a hardcoded 10).
 */
export function allocateLevelUpRewards(
  playerState: PlayerState,
  statAllocations: Record<string, number>,
  chosenAbilityId?: string,
  rpgSystem?: RPGSystemSchema
): { success: boolean; updatedPlayerState: PlayerState; error?: string } {
  const updated: PlayerState = JSON.parse(JSON.stringify(playerState));
  const availablePoints = updated.unspentStatPoints || 0;

  // Validate every entry first, so a rejected payload cannot partially apply.
  const requested: Array<{ statId: string; bonus: number }> = [];
  const rejected: string[] = [];

  for (const [statId, rawBonus] of Object.entries(statAllocations || {})) {
    const bonus = normalizeAllocation(rawBonus);
    if (bonus === null) {
      // 0, negative, fractional-truncated-to-zero, NaN — none are spends.
      if (Number(rawBonus) > 0 && !Number.isInteger(Number(rawBonus))) {
        rejected.push(`${statId} (points must be whole numbers)`);
      }
      continue;
    }
    if (!isDefinedStat(statId, rpgSystem)) {
      rejected.push(`${statId} (not a stat in this story's RPG system)`);
      continue;
    }
    requested.push({ statId, bonus });
  }

  if (rejected.length > 0) {
    return {
      success: false,
      updatedPlayerState: playerState,
      error: `Invalid stat allocation: ${rejected.join(', ')}.`,
    };
  }

  const totalPointsRequested = requested.reduce((sum, r) => sum + r.bonus, 0);

  if (totalPointsRequested > availablePoints) {
    return {
      success: false,
      updatedPlayerState: playerState,
      error: `Cannot spend ${totalPointsRequested} points; only ${availablePoints} available.`,
    };
  }

  // Apply stat increases at the story's own baseline. A stat the character does
  // not yet have is created at `resolveStatBase` (universalBaseValue ??
  // stat.baseValue ?? 10) — the value at which getStatModifier returns 0.
  if (!updated.stats) updated.stats = {};
  for (const { statId, bonus } of requested) {
    updated.stats[statId] = (updated.stats[statId] ?? resolveStatBase(statId, rpgSystem)) + bonus;
  }
  updated.unspentStatPoints = Math.max(0, availablePoints - totalPointsRequested);

  // Apply chosen ability if requested
  if (chosenAbilityId) {
    if (!isDefinedAbility(chosenAbilityId, rpgSystem)) {
      return {
        success: false,
        updatedPlayerState: playerState,
        error: `Unknown ability "${chosenAbilityId}" for this story's RPG system.`,
      };
    }
    if (!updated.abilities) updated.abilities = [];
    if (!updated.abilities.includes(chosenAbilityId)) {
      updated.abilities.push(chosenAbilityId);
      updated.unspentAbilityPicks = Math.max(0, (updated.unspentAbilityPicks || 1) - 1);
    }
  }

  // Recompute vitals pool with new stats
  if (rpgSystem) {
    try {
      const nextMax = computeMaxResources(updated.stats, rpgSystem);
      updated.maxResources = nextMax;
      // Also scale current resources if appropriate
      for (const [resId, maxVal] of Object.entries(nextMax)) {
        if (updated.resources[resId] !== undefined) {
          updated.resources[resId] = Math.min(updated.resources[resId], maxVal);
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  return {
    success: true,
    updatedPlayerState: updated,
  };
}
