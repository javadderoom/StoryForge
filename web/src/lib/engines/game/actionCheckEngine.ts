import {
  PlayerState,
  CheckResolution,
  DiceOutcome,
  RiskLevel,
  StateMutationDiff,
  TensionClock,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import { WorldBible } from '@/lib/types/world';
import {
  tickTensionClock,
  ensureClockForLocation,
  resolveDisplacement,
  clockIdForLocation,
} from './threatClock';
import { STAT_CANONICAL_ALIASES } from '@/lib/engines/world/ActionNormalizer';
import { evaluatePassiveAbilities } from './passiveAbilities';
import {
  evaluateAbilityEffects,
  validateAbilityInvocation as validateAbilityInvocationInternal,
  detectInvokedAbility,
} from './abilityEffects';
import { calculateActionXp, applyXpGain } from './progressionEngine';

export interface RollOptions {
  statId?: string;
  skillId?: string;
  targetDC?: number;
  riskLevel?: RiskLevel;
  environmentalModifier?: number;
  forcedDiceRoll?: number; // Useful for deterministic testing
  isPersian?: boolean;
  /** Plan 13: world context for hazard displacement + threat clock ticking. */
  worldBible?: WorldBible;
  currentLocationId?: string;
  activeClocks?: TensionClock[];
  /** The action style the player chose (gates style-restricted ability specs). */
  actionStyle?: string;
  /** Current turn number — required for ability cooldown bookkeeping. */
  turnNumber?: number;
  /** Active ability explicitly invoked this turn (id or authored name). */
  invokedAbilityId?: string;
  /** Active action or threat categories for this check (e.g. ['incoming_light_projectile']). */
  actionCategories?: string[];
}

/**
 * Rolls dice deterministically or via standard pseudo-random number generation.
 */
export function rollDice(
  diceType: 'd20' | '2d6' | 'd100' = 'd20',
  forcedRoll?: number
): { roll: number; isNatMax: boolean; isNatMin: boolean } {
  if (forcedRoll !== undefined) {
    const max = diceType === 'd20' ? 20 : diceType === '2d6' ? 12 : 100;
    const min = diceType === '2d6' ? 2 : 1;
    return {
      roll: forcedRoll,
      isNatMax: forcedRoll >= max,
      isNatMin: forcedRoll <= min,
    };
  }

  switch (diceType) {
    case '2d6': {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      return {
        roll: total,
        isNatMax: total === 12,
        isNatMin: total === 2,
      };
    }
    case 'd100': {
      const roll = Math.floor(Math.random() * 100) + 1;
      return {
        roll,
        isNatMax: roll === 100,
        isNatMin: roll === 1,
      };
    }
    case 'd20':
    default: {
      const roll = Math.floor(Math.random() * 20) + 1;
      return {
        roll,
        isNatMax: roll === 20,
        isNatMin: roll === 1,
      };
    }
  }
}

/**
 * Computes standard stat modifier dynamically relative to authored baseline.
 * Formula: floor((Stat - baseValue) / 2).
 * For standard D20 (baseValue = 10): 14 -> +2, 10 -> 0, 8 -> -1.
 * For custom systems (e.g. baseValue = 3): 3 -> 0, 5 -> +1, 1 -> -1.
 */
export function getStatModifier(statValue: number, baseValue: number = 10): number {
  return Math.floor((statValue - baseValue) / 2);
}

/**
 * Dynamically infers the most relevant Stat ID from action text and active RPG system.
 */
export function inferStatId(
  actionText: string,
  rpgSystem: RPGSystemSchema,
  riskLevel?: string
): string {
  const lower = actionText.toLowerCase();

  // 1. Direct match: check if any stat ID, stat Name, or skill is mentioned
  for (const stat of rpgSystem.stats) {
    if (
      lower.includes(stat.id.toLowerCase()) ||
      (stat.name && lower.includes(stat.name.toLowerCase()))
    ) {
      return stat.id;
    }
  }

  for (const skill of rpgSystem.skills || []) {
    if (
      lower.includes(skill.id.toLowerCase()) ||
      (skill.name && lower.includes(skill.name.toLowerCase()))
    ) {
      if (rpgSystem.stats.some((s) => s.id === skill.linkedStatId)) {
        return skill.linkedStatId;
      }
    }
  }

  for (const ability of rpgSystem.abilities || []) {
    if (
      lower.includes(ability.id.toLowerCase()) ||
      (ability.name && lower.includes(ability.name.toLowerCase()))
    ) {
      if (ability.linkedStatId && rpgSystem.stats.some((s) => s.id === ability.linkedStatId)) {
        return ability.linkedStatId;
      }
    }
  }

  // 2. Genre-agnostic keyword clusters matched strictly against active stats
  const availableStatIds = rpgSystem.stats.map((s) => s.id.toLowerCase());

  const keywordMappings: { keywords: RegExp; targetIds: string[] }[] = [
    // Physical force / melee / violence
    {
      keywords: /حمله|خنجر|شمشیر|مشت|زور|ضرب|strike|hit|attack|force|slash|might|break|fight|shoot|punch/,
      targetIds: ['might', 'strength', 'power', 'combat', 'athletics', 'force'],
    },
    // Speed / stealth / finesse / evasion
    {
      keywords: /پنهان|مخفی|فرار|چابک|sneak|hide|dodge|jump|run|agility|slip|flee|escape|acrobatics|stealth/,
      targetIds: ['agility', 'dexterity', 'speed', 'stealth', 'reflexes', 'finesse'],
    },
    // Wit / perception / investigation / mechanics / tech / lockpicking
    {
      keywords: /قفل|تله|کلید|lock|pick|trap|cunning|معما|دقت|examine|investigate|mechanism|hack|code|analyze|wit|search/,
      targetIds: ['cunning', 'wit', 'intellect', 'perception', 'hacking', 'tech', 'investigation', 'logic'],
    },
    // Magic / occult / essence / arcane / science
    {
      keywords: /افسون|جادو|ورد|طلسم|magic|spell|arcana|relic|curse|occult|channel|ritual|cyberware/,
      targetIds: ['arcana', 'magic', 'occult', 'spirit', 'sorcery', 'cyberware', 'mysticism'],
    },
    // Social / charm / empathy / deception / romance / diplomacy
    {
      keywords: /عشق|نگاه|همدلی|فریب|مذاکره|صحبت|لبخند|charm|persuade|talk|romance|empathy|deceive|lie|intimidate|diplomacy|passion|kiss|hug|confess/,
      targetIds: ['charm', 'empathy', 'passion', 'presence', 'charisma', 'persuasion', 'diplomacy', 'wit'],
    },
  ];

  for (const mapping of keywordMappings) {
    if (mapping.keywords.test(lower)) {
      const matchedStatId = mapping.targetIds.find((id) => availableStatIds.includes(id));
      if (matchedStatId) return matchedStatId;
    }
  }

  // 3. Fallback to available stats in this story
  if (rpgSystem.stats.length > 0) {
    if (riskLevel === 'high' && rpgSystem.stats.length > 1) {
      return rpgSystem.stats[0].id;
    }
    return rpgSystem.stats[rpgSystem.stats.length > 1 ? 1 : 0].id;
  }

  return 'might';
}

/**
 * True when an ability declares authored mechanics (`rollModifiers` for a
 * passive, `activation.effects` for an active). Such abilities are scored from
 * their declaration alone and are never given a legacy `tier * 2` bonus.
 */
export function hasStructuredMechanics(ability: {
  rollModifiers?: unknown[];
  activation?: { effects?: unknown[] };
}): boolean {
  return (
    (ability.rollModifiers?.length ?? 0) > 0 ||
    (ability.activation?.effects?.length ?? 0) > 0
  );
}

/**
 * Public passthrough so the play route can reject an unaffordable or
 * on-cooldown ability *before* rolling dice or spending model tokens.
 */
export function validateAbilityInvocation(
  playerState: PlayerState,
  rpgSystem: RPGSystemSchema,
  abilityId: string,
  turnNumber?: number
) {
  return validateAbilityInvocationInternal(playerState, rpgSystem, abilityId, turnNumber);
}

/**
 * Resolves a skill / stat check with deterministic outcome calculations.
 */
export function resolveActionCheck(
  actionText: string,
  playerState: PlayerState,
  rpgSystem: RPGSystemSchema,
  options: RollOptions = {}
): CheckResolution {
  const diceType = rpgSystem.diceType || 'd20';
  const { roll, isNatMax, isNatMin } = rollDice(diceType, options.forcedDiceRoll);

  // Determine effective stat ID (dynamically infer from actionText and rpgSystem if omitted)
  const effectiveStatId = options.statId || inferStatId(actionText, rpgSystem, options.riskLevel);
  const rawStatId = (effectiveStatId || '').trim();
  const canonicalStatId = STAT_CANONICAL_ALIASES[rawStatId.toLowerCase()] || STAT_CANONICAL_ALIASES[rawStatId] || rawStatId;

  // Look up universalBaseValue for the system (falls back to authored stat baseValue or 10)
  const targetStat = rpgSystem.stats?.find(
    (s) => s.id?.toLowerCase() === canonicalStatId.toLowerCase() || s.id?.toLowerCase() === rawStatId.toLowerCase()
  );
  const systemBaseValue = rpgSystem.universalBaseValue ?? targetStat?.baseValue ?? 10;

  // Equipment & Inventory Tool modifier (equipped gear + relevant tools like lockpick_set)
  let equipmentModifier = 0;
  if (effectiveStatId) {
    const equippedIds = playerState.equipment
      ? [
          playerState.equipment.mainHand,
          playerState.equipment.offHand,
          playerState.equipment.armor,
          playerState.equipment.relic,
        ].filter(Boolean)
      : [];

    for (const item of playerState.inventory) {
      // Apply if item is actively equipped OR is a relevant tool (like lockpick_set for cunning)
      const isEquipped = equippedIds.includes(item.id);
      const isRelevantTool = item.type === 'quest_item';

      if ((isEquipped || isRelevantTool) && item.statModifiers) {
        const modVal =
          item.statModifiers[effectiveStatId] ??
          item.statModifiers[canonicalStatId] ??
          item.statModifiers[rawStatId];
        if (typeof modVal === 'number') {
          equipmentModifier += modVal;
        }
      }
    }
  }

  // Calculate effective stat value (base stat + equipment stat bonuses)
  const currentStatVal = playerState.stats[canonicalStatId] ?? playerState.stats[effectiveStatId];
  const baseStatVal = currentStatVal !== undefined ? currentStatVal : systemBaseValue;
  const effectiveStatVal = baseStatVal + equipmentModifier;
  const statModifier = getStatModifier(effectiveStatVal, systemBaseValue);

  // Calculate skill / ability bonus
  let skillBonus = 0;
  if (options.skillId) {
    const skill = rpgSystem.skills?.find((s) => s.id === options.skillId);
    if (skill) {
      skillBonus = skill.bonusModifier;
    } else {
      const ability = rpgSystem.abilities?.find((a) => a.id === options.skillId);
      // Legacy fallback: an ability with no authored mechanics is worth its
      // tier. An ability that declares structured effects is worth exactly
      // what it declares — never tier * 2 on top of them.
      if (ability && !hasStructuredMechanics(ability)) {
        skillBonus = (ability.tier || 1) * 2;
      }
    }
  }

  // Structured ability / trait mechanics (active invocation, passive specs,
  // background traits). Deterministic and authored — see `abilityEffects.ts`.
  const invokedAbilityId =
    options.invokedAbilityId ??
    detectInvokedAbility(actionText, playerState, rpgSystem, options.turnNumber)?.id;

  const abilityResult = evaluateAbilityEffects({
    actionText,
    playerState,
    rpgSystem,
    effectiveStatId,
    actionStyle: options.actionStyle,
    riskLevel: options.riskLevel,
    turnNumber: options.turnNumber,
    invokedAbilityId,
    actionCategories: options.actionCategories,
  });
  const abilityBonus = abilityResult.totalModifier;

  // Evaluate passive abilities & feats (automated parsing of shield defense, social friction, etc.)
  const passiveResult = evaluatePassiveAbilities(actionText, playerState, rpgSystem, {
    effectiveStatId,
    riskLevel: options.riskLevel,
    actionCategories: options.actionCategories,
  });
  const passiveBonus = passiveResult.totalModifier;
  const passiveModifier = skillBonus + passiveBonus + abilityBonus;

  // Check for tactical consumable or potion triggers in actionText
  let itemTacticalEnvMod = 0;
  const lowerAction = actionText.toLowerCase();
  const itemsRemovedIds: string[] = [];
  const initialResourceChanges: Record<string, number> = {};

  // Smoke pellet / distraction trigger
  if (/smoke|pellet|دود|مه|استتار/.test(lowerAction)) {
    const smokeItem = playerState.inventory.find(
      (i) => i.id === 'smoke_pellet' || i.name.toLowerCase().includes('smoke') || i.name.includes('دود')
    );
    if (smokeItem && smokeItem.quantity > 0) {
      itemTacticalEnvMod += 4; // Grant +4 environmental tactical advantage
      itemsRemovedIds.push(smokeItem.id);
    }
  }

  // Dynamically resolve primary health resource key (e.g. 'health', 'hp', 'سلامت', 'تندرستی')
  const healthRes = rpgSystem.resources?.find((r) =>
    ['health', 'hp', 'سلامت', 'تندرستی', 'life', 'vitality'].includes(r.id.toLowerCase())
  ) || rpgSystem.resources?.[0];
  const healthKey = healthRes ? healthRes.id : 'hp';

  // Dynamically resolve primary stamina/energy resource key if defined in this RPG system
  const staminaRes = rpgSystem.resources?.find((r) =>
    ['stamina', 'energy', 'استقامت', 'انرژی', 'fatigue', 'endurance'].includes(r.id.toLowerCase())
  );
  const staminaKey = staminaRes ? staminaRes.id : undefined;

  // Healing potion / tincture trigger
  if (/drink|potion|tincture|معجون|نوشیدن|درمان/.test(lowerAction)) {
    const potionItem = playerState.inventory.find(
      (i) => (i.healValue && i.healValue > 0) || i.id.includes('potion') || i.id.includes('tincture') || i.name.includes('معجون')
    );
    if (potionItem && potionItem.quantity > 0) {
      const healAmt = potionItem.healValue || 30;
      initialResourceChanges[healthKey] = (initialResourceChanges[healthKey] || 0) + healAmt;
      itemsRemovedIds.push(potionItem.id);
    }
  }

  const envMod = (options.environmentalModifier || 0) + itemTacticalEnvMod;
  const totalScore = roll + statModifier + passiveModifier + envMod;

  // Default DC based on risk level if not explicitly provided
  const isLowBase = systemBaseValue < 8;
  const baseDC =
    options.targetDC !== undefined
      ? options.targetDC
      : isLowBase
      ? options.riskLevel === 'high'
        ? 11
        : options.riskLevel === 'medium'
        ? 9
        : 7
      : options.riskLevel === 'high'
      ? 15
      : options.riskLevel === 'medium'
      ? 12
      : 9;

  let outcome: DiceOutcome;
  let consequenceSummary: string;
  const stateDiff: StateMutationDiff = {
    itemsRemovedIds: itemsRemovedIds.length > 0 ? itemsRemovedIds : undefined,
  };
  if (Object.keys(initialResourceChanges).length > 0) {
    stateDiff.resourceChanges = { ...initialResourceChanges };
  }

  const isPersian =
    options.isPersian ??
    (/[\u0600-\u06FF]/.test(actionText) ||
      /[\u0600-\u06FF]/.test(playerState.characterName || '') ||
      /[\u0600-\u06FF]/.test(playerState.backgroundName || '') ||
      (rpgSystem.stats && rpgSystem.stats.some((s) => /[\u0600-\u06FF]/.test(s.name))));

  if (isNatMin) {
    outcome = 'critical_failure';
    consequenceSummary = isPersian
      ? 'فاجعه رخ داد: شکست کامل همراه با آسیب سنگین یا عواقب ناگوار.'
      : 'Disaster strikes: complete failure with severe complications or damage.';
    stateDiff.resourceChanges = {
      ...(stateDiff.resourceChanges || {}),
      [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - 15,
    };
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
    const hpPenalty = options.riskLevel === 'low' ? 0 : -5;
    stateDiff.resourceChanges = {
      ...(stateDiff.resourceChanges || {}),
      ...(hpPenalty < 0 ? { [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) + hpPenalty } : {}),
      ...(staminaKey
        ? { [staminaKey]: (stateDiff.resourceChanges?.[staminaKey] || 0) - 10 }
        : {}),
    };
  } else {
    outcome = 'failure';
    consequenceSummary = isPersian
      ? 'تلاش ناموفق بود: مانعی غیرمنتظره پدیدار شد یا فرصت از دست رفت.'
      : 'The attempt failed: unexpected obstacle arose or opportunity lost.';
    stateDiff.resourceChanges = {
      ...(stateDiff.resourceChanges || {}),
      [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - 10,
    };
  }

  // Bulletproof safeguard: Success and Critical Success NEVER take bodily health damage
  if ((outcome === 'success' || outcome === 'critical_success') && stateDiff.resourceChanges?.[healthKey]) {
    if (stateDiff.resourceChanges[healthKey] < 0) {
      delete stateDiff.resourceChanges[healthKey];
    }
  }

  // ------------------------------------------------------------------
  // Plan 13: Threat clock ticking + hazard displacement (deterministic).
  // ------------------------------------------------------------------
  let displacedLocationId: string | undefined;
  let clockUpdate: CheckResolution['clockUpdate'];
  try {
    const locId = options.currentLocationId || playerState.currentLocationId;
    const bible = options.worldBible;
    const location = bible?.locations?.find((l) => l.id === locId);
    const activeClock =
      (options.activeClocks ?? playerState.activeTensionClocks ?? []).find(
        (c) => c.id === clockIdForLocation(locId)
      ) || ensureClockForLocation(options.activeClocks ?? playerState.activeTensionClocks, location);

    if (activeClock) {
      const { newSegments, isCrisis } = tickTensionClock(activeClock, outcome);
      clockUpdate = {
        clockId: activeClock.id,
        newSegments,
        maxSegments: Math.max(2, activeClock.maxSegments || 4),
        isCrisis,
      };
      stateDiff.clockUpdates = [{ id: activeClock.id, delta: newSegments - (activeClock.currentSegments || 0), isCrisis }];
      if (isCrisis) {
        consequenceSummary += isPersian
          ? ` اوج‌گیری خطر — ساعت "${activeClock.name}" فعال شد: ${activeClock.crisisDescription || 'بحران آغاز گردید!'}`
          : ` Danger peaks — ${activeClock.name} triggers: ${activeClock.crisisDescription || 'crisis erupts!'}`;
      }
    }

    displacedLocationId = bible ? resolveDisplacement(bible, locId, options.riskLevel, outcome) : undefined;
    if (displacedLocationId) {
      stateDiff.displacedLocationId = displacedLocationId;
      // Mirror into locationChange so applyStateMutation moves + discovers.
      stateDiff.locationChange = displacedLocationId;
      const fallDamage = outcome === 'critical_failure' ? 15 : 10;
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - fallDamage,
      };
      consequenceSummary += isPersian
        ? ` سقوط یا جابجایی ناخواسته: قهرمان به منطقه‌ای پرخطر پرتاب شد.`
        : ` Catastrophic failure hurls the player into a hazard zone.`;
    }
  } catch {
    /* non-fatal: clock/displacement must never break the core roll */
  }

  if (passiveResult.appliedPassives.length > 0) {
    const tag = passiveResult.appliedPassives
      .map((p) => (isPersian ? p.reasonFa : p.reason))
      .join('; ');
    consequenceSummary += ` [${tag}]`;
  }

  // ------------------------------------------------------------------
  // Structured ability invocation: pay the cost, start the cooldown, and
  // narrate the modifier breakdown. All deterministic — the narrator only
  // gets to dramatise what already happened.
  // ------------------------------------------------------------------
  if (abilityResult.invocation) {
    const { abilityId, abilityName, cost } = abilityResult.invocation;
    if (cost && cost.amount > 0) {
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        [cost.targetResourceId]:
          (stateDiff.resourceChanges?.[cost.targetResourceId] || 0) - cost.amount,
      };
    }
    if (typeof options.turnNumber === 'number') {
      stateDiff.abilityCooldownSet = { [abilityId]: options.turnNumber };
    }
    consequenceSummary += isPersian
      ? ` [اجرای «${abilityName}»]`
      : ` [Invoked "${abilityName}"]`;
  }

  if (abilityResult.contributions.length > 0) {
    const tag = abilityResult.contributions
      .map((c) => (isPersian ? c.reasonFa : c.reasonEn))
      .join('; ');
    consequenceSummary += ` [${tag}]`;
  }

  // ------------------------------------------------------------------
  // Progression & Action XP Calculation
  // ------------------------------------------------------------------
  let progressionResult: CheckResolution['progression'] | undefined;
  const progConfig = rpgSystem?.progression ?? DEFAULT_PROGRESSION_CONFIG;
  if (progConfig.enabled !== false) {
    const xpAward = calculateActionXp(
      {
        riskLevel: options.riskLevel || 'medium',
        outcome,
        diceRoll: roll,
      },
      progConfig
    );

    stateDiff.xpGained = xpAward.amount;

    // Predict level advancement for client celebration
    const advance = applyXpGain(playerState, xpAward.amount, progConfig, rpgSystem);
    progressionResult = {
      xpAwarded: xpAward.amount,
      xpGained: xpAward.amount,
      reasonEn: xpAward.reasonEn,
      reasonFa: xpAward.reasonFa,
      levelUpOccurred: advance.levelUpOccurred,
      previousLevel: advance.previousLevel,
      newLevel: advance.newLevel,
      unspentStatPoints: advance.updatedPlayerState.unspentStatPoints || 0,
      unspentAbilityPicks: advance.updatedPlayerState.unspentAbilityPicks || 0,
    };
  }

  return {
    actionDescription: actionText,
    statId: effectiveStatId,
    statModifier,
    equipmentModifier: 0,
    passiveModifier,
    diceRoll: roll,
    diceType,
    environmentalModifier: envMod,
    totalScore,
    difficultyClass: baseDC,
    outcome,
    consequenceSummary,
    stateDiff,
    ...(abilityResult.invocation ? { abilityInvocation: abilityResult.invocation } : {}),
    ...(abilityResult.contributions.length > 0
      ? { abilityContributions: abilityResult.contributions }
      : {}),
    ...(displacedLocationId ? { displacedLocationId } : {}),
    ...(clockUpdate ? { clockUpdate } : {}),
    ...(progressionResult ? { progression: progressionResult } : {}),
  };
}
