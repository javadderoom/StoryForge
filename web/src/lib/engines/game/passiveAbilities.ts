import { PlayerState } from '@/lib/types/gameplay';
import { AbilityDefinition, RPGSystemSchema } from '@/lib/types/rpg';
import { buildEquippedItemProfiles } from './itemInteractions';

export interface AppliedPassiveAbility {
  id: string;
  name: string;
  modifier: number;
  reason: string;
  reasonFa: string;
}

export interface PassiveEvaluationResult {
  totalModifier: number;
  appliedPassives: AppliedPassiveAbility[];
}

/**
 * Extracts a numeric modifier (e.g. +3, -3, +2, -1) from an ability's
 * effectSummary or description. Handles Persian digits (۰-۹) and ASCII digits.
 */
export function parseAbilityModifier(ability: Partial<AbilityDefinition>): number {
  const text = `${ability.effectSummary || ''} ${ability.description || ''}`;
  if (!text.trim()) return 0;

  // Convert Persian numbers (۰-۹) to ASCII digits
  const normalized = text.replace(/[۰-۹]/g, (d) =>
    String(d.charCodeAt(0) - 1776)
  );

  // 1. Explicit sign before number: (+3, -3, + 3, - 2)
  const signBeforeMatch = normalized.match(/([+-])\s*(\d+)/);
  if (signBeforeMatch) {
    const sign = signBeforeMatch[1] === '-' ? -1 : 1;
    const val = parseInt(signBeforeMatch[2], 10);
    if (!isNaN(val) && val > 0 && val <= 20) {
      return sign * val;
    }
  }

  // 2. Explicit sign after number (common in RTL / Persian text like "3+" or "3-"):
  const signAfterMatch = normalized.match(/(\d+)\s*([+-])/);
  if (signAfterMatch) {
    const sign = signAfterMatch[2] === '-' ? -1 : 1;
    const val = parseInt(signAfterMatch[1], 10);
    if (!isNaN(val) && val > 0 && val <= 20) {
      return sign * val;
    }
  }

  // 3. Persian/English words for bonus/increase
  const wordBonusMatch = normalized.match(
    /(?:پاداش|bonus|افزایش|advantage)\s*(?:به)?\s*(\d+)/i
  );
  if (wordBonusMatch) {
    const val = parseInt(wordBonusMatch[1], 10);
    if (!isNaN(val) && val > 0 && val <= 20) return val;
  }

  // 4. Persian/English words for penalty/decrease
  const wordPenaltyMatch = normalized.match(
    /(?:جریمه|penalty|کاهش|disadvantage|کاسته)\s*(?:از|به|در)?\s*(\d+)/i
  );
  if (wordPenaltyMatch) {
    const val = parseInt(wordPenaltyMatch[1], 10);
    if (!isNaN(val) && val > 0 && val <= 20) return -val;
  }

  return 0;
}

/**
 * Checks whether the player currently has a shield equipped in their offHand slot.
 */
export function isShieldEquipped(playerState?: PlayerState): boolean {
  if (!playerState || !playerState.equipment) return false;
  const offHandId = playerState.equipment.offHand;
  if (!offHandId) return false;

  const item = playerState.inventory?.find((i) => i.id === offHandId);
  if (!item) return false;

  const isShieldType = item.type === 'shield' || (item as any).slot === 'shield';
  const isOffHandGrip = item.grip === 'off_hand_only';
  const nameMatch =
    /shield|buckler|سپر/i.test(item.name || '') ||
    /shield|سپر/i.test(item.id || '');
  const tagMatch =
    Array.isArray((item as any).tags) &&
    (item as any).tags.some((t: any) => /shield|سپر/i.test(String(t)));

  return Boolean(isShieldType || isOffHandGrip || nameMatch || tagMatch);
}

/**
 * Legacy compatibility: prose-only passives keep their old heuristic path.
 * Structured specs (rollModifiers) are evaluated in `evaluateAbilityEffects`.
 * This intentionally does NOT overlap — legacy only.
 */
export function evaluatePassiveAbilities(
  actionText: string,
  playerState?: PlayerState,
  rpgSystem?: RPGSystemSchema | { abilities?: AbilityDefinition[] },
  options?: { effectiveStatId?: string; riskLevel?: string; story?: any }
): PassiveEvaluationResult {
  const result: PassiveEvaluationResult = {
    totalModifier: 0,
    appliedPassives: [],
  };

  const text = (actionText || '').toLowerCase();
  const hasShield = isShieldEquipped(playerState);
  const playerAbilities = playerState?.abilities || [];
  const allAbilities: AbilityDefinition[] = (rpgSystem as any)?.abilities || [];

  for (const playerAbilityId of playerAbilities) {
    const ability = allAbilities.find(
      (a) => a.id === playerAbilityId || a.name === playerAbilityId
    );
    if (!ability) continue;

    // We only evaluate passive skills and passive feats
    const isPassive =
      ability.type === 'passive_skill' || ability.type === 'passive_feat';
    if (!isPassive) continue;

    // Structured abilities are owned by `abilityEffects.evaluateAbilityEffects`,
    // which reads authored `rollModifiers` instead of scraping prose. Skipping
    // them here is what prevents the same bonus from being counted twice.
    if ((ability.rollModifiers ?? []).length > 0) continue;

    const abilityName = ability.name || ability.id;
    const abilityText = `${ability.name} ${ability.description || ''} ${ability.effectSummary || ''}`.toLowerCase();
    let mod = parseAbilityModifier(ability);
    if (mod === 0) {
      // Default tier-based bonus for positive passives if no explicit number is stated
      mod = (ability.tier || 1) * 2;
    }

    let applies = false;
    let reasonEn = '';
    let reasonFa = '';

    // Check 0: Direct explicit mention of the ability name in the player action
    const mentionsAbilityDirectly =
      text.includes(abilityName.toLowerCase()) ||
      (ability.id && text.includes(ability.id.toLowerCase()));

    // Check 1: Shield / Ranged Defense (e.g. "دیوار بارانداز")
    const isShieldDefenseAbility =
      /سپر|shield/.test(abilityText) &&
      /پرتابه|تیر|سنگ|دفاع|حمله|arrow|projectile|ranged|defend|block/.test(
        abilityText
      );

    if (isShieldDefenseAbility) {
      // Must have shield equipped
      if (!hasShield) {
        continue;
      }
      // Action must be defensive, blocking, or facing ranged/melee attacks
      const isDefensiveAction =
        mentionsAbilityDirectly ||
        /(?:سپر|دفاع|مهار|پناه|دفع|جاخالی|سنگر|بلوک|پوشش|تیر|پرتابه|کمان|سنگ‌انداز|shield|defend|defense|block|parry|dodge|cover|arrow|projectile|ranged)/i.test(
          text
        );

      if (isDefensiveAction) {
        applies = true;
        const absVal = Math.abs(mod);
        reasonEn = `+${absVal} Shield Defense Bonus against incoming attacks`;
        reasonFa = `+${absVal} پاداش دفاع با سپر در برابر پرتابه‌ها و حملات`;
      }
    }

    // Check 2: Bureaucratic / Scribe Friction (e.g. "بی‌اعتمادی به مهر و قلم")
    if (!applies) {
      const isScribeFrictionAbility =
        /کاتب|مأمور|اداری|مهر و قلم|دیوان|بوروکراسی|scribe|clerk|official|bureaucrat/.test(
          abilityText
        ) && (mod < 0 || /disadvantage|جریمه|دشواری/.test(abilityText));

      if (isScribeFrictionAbility) {
        const isInteractingWithScribes =
          mentionsAbilityDirectly ||
          /(?:کاتب|مأمور|اداری|دیوان|منشی|سند|قلم|مهر|دفتردار|حساب‌دار|داروغه|نامه|مجوز|scribe|clerk|official|bureaucrat|notary|quill|registry|permit)/i.test(
            text
          );

        if (isInteractingWithScribes) {
          applies = true;
          // Ensure negative penalty
          if (mod > 0) mod = -mod;
          reasonEn = `${mod} Mistrust of Scribes & Bureaucrats penalty`;
          reasonFa = `${mod} جریمهٔ بی‌اعتمادی به مأموران و کاتبان`;
        }
      }
    }

    // Check 3: Caravan & Wilderness Navigation (e.g. "کاروان")
    if (!applies) {
      const isCaravanAbility =
        /کاروان|شتر|قاطر|جهت‌یابی|مهار.*بار|caravan|camel|mule|navigation/.test(
          abilityText
        );

      if (isCaravanAbility) {
        const isCaravanAction =
          mentionsAbilityDirectly ||
          /(?:کاروان|شتر|قاطر|جهت‌یابی|ستاره|ستارگان|باربری|caravan|camel|mule|pack animal|navigation|navigate|stars)/i.test(
            text
          ) ||
          /(?:مهار|هدایت)\s*(?:شتر|قاطر|اسب|حیوان|حیوانات|بار)/i.test(text);

        if (isCaravanAction) {
          applies = true;
          reasonEn = `+${Math.abs(mod)} Caravan & Wilderness Mastery bonus`;
          reasonFa = `+${Math.abs(mod)} پاداش مهارت کاروان و هدایت در دشت`;
        }
      }
    }

    // Check 4: First Aid / Medical Treatment
    if (!applies) {
      const isHealingAbility =
        /درمان|زخم|پانسمان|کمک‌های اولیه|first aid|heal|wound|bandage/.test(
          abilityText
        );

      if (isHealingAbility) {
        const isHealingAction =
          mentionsAbilityDirectly ||
          /(?:درمان|زخم|پانسمان|تیمار|مرهم|بستن زخم|first aid|heal|wound|bandage|dress wound)/i.test(
            text
          );

        if (isHealingAction) {
          applies = true;
          reasonEn = `+${Math.abs(mod)} First Aid & Medical Treatment bonus`;
          reasonFa = `+${Math.abs(mod)} پاداش درمان و رسیدگی به زخم`;
        }
      }
    }

    // Check 5: Direct mention fallback
    if (!applies && mentionsAbilityDirectly) {
      applies = true;
      reasonEn = `${mod >= 0 ? `+${mod}` : mod} Passive ${abilityName} applied`;
      reasonFa = `${mod >= 0 ? `+${mod}` : mod} اثر مهارت غیرفعال «${abilityName}»`;
    }

    if (applies) {
      result.totalModifier += mod;
      result.appliedPassives.push({
        id: ability.id,
        name: abilityName,
        modifier: mod,
        reason: reasonEn,
        reasonFa,
      });
    }
  }

  // Evaluate Equipped Gear & Artifact Profiles
  const itemProfiles = buildEquippedItemProfiles(playerState, options?.story);
  for (const profile of itemProfiles) {
    if (!profile.passiveBonus) continue;

    const { value, triggerKeywords, descriptionEn, descriptionFa } = profile.passiveBonus;

    // Check if the action matches any trigger keywords
    const matchesKeyword = triggerKeywords.some((kw) => text.includes(kw.toLowerCase()));
    const mentionsItemDirectly =
      text.includes(profile.name.toLowerCase()) ||
      (profile.itemId && text.includes(profile.itemId.toLowerCase()));

    if (matchesKeyword || mentionsItemDirectly) {
      // If this is a shield defense bonus, avoid duplicate bonus if a shield ability already applied
      const isShieldProfile =
        profile.slot === 'shield' ||
        profile.slot === 'off_hand' ||
        /سپر|shield|buckler/i.test(`${profile.name} ${profile.slot}`);

      if (
        isShieldProfile &&
        result.appliedPassives.some((p) => /سپر|shield/i.test(`${p.name} ${p.reason} ${p.reasonFa}`))
      ) {
        continue;
      }

      result.totalModifier += value;
      result.appliedPassives.push({
        id: profile.itemId,
        name: profile.name,
        modifier: value,
        reason: descriptionEn,
        reasonFa: descriptionFa,
      });
    }
  }

  return result;
}
