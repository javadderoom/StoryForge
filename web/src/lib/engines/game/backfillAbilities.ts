import {
  AbilityDefinition,
  BackgroundOriginDefinition,
  BackgroundTrait,
  RollModifierSpec,
  StatDefinition,
} from '@/lib/types/rpg';
import { parseAbilityModifier } from './passiveAbilities';

/**
 * Result of backfilling an ability or background.
 */
export interface BackfillSummary {
  abilitiesChecked: number;
  abilitiesModified: number;
  backgroundsChecked: number;
  backgroundsModified: number;
}

/**
 * Heuristically infers a structured `RollModifierSpec` from an ability's
 * legacy prose `effectSummary` or `description`.
 *
 * If the ability already has structured mechanics (`rollModifiers` or
 * `activation.effects`), it is left untouched (idempotent).
 */
export function inferRollModifierFromProse(
  ability: AbilityDefinition,
  availableStats: StatDefinition[] = []
): RollModifierSpec | null {
  let modifier = parseAbilityModifier(ability);
  const text = `${ability.name} ${ability.description || ''} ${ability.effectSummary || ''}`.toLowerCase();

  if (modifier === 0) {
    const hasMechanicalKeyword =
      /سپر|shield|heal|bandage|wound|درمان|زخم|مرهم|طبابت|stealth|shadow|مخفی|سایه|نهان|کمین|متقاعد|diploma|persua|نیت|دیوان/.test(
        text
      );
    if (hasMechanicalKeyword) {
      modifier = (ability.tier || 1) * 2;
    } else {
      return null;
    }
  }

  const spec: RollModifierSpec = {
    modifier,
    labelEn: ability.name,
    labelFa: ability.name,
  };

  // 1. Linked stat or stat mentions
  if (ability.linkedStatId) {
    spec.statIds = [ability.linkedStatId];
  } else {
    for (const stat of availableStats) {
      const sId = stat.id.toLowerCase();
      const sName = (stat.name || '').toLowerCase();
      if (text.includes(sId) || (sName && text.includes(sName))) {
        if (!spec.statIds) spec.statIds = [];
        if (!spec.statIds.includes(stat.id)) spec.statIds.push(stat.id);
      }
    }
  }

  // 2. Shield / Defense conditions
  if (/سپر|shield/.test(text) && /دفاع|defend|block|پرتابه|تیر|arrow/.test(text)) {
    spec.requiresEquippedSlot = 'offHand';
    spec.requiresItemType = 'shield';
    spec.actionStyles = ['defensive'];
    spec.triggerKeywords = ['سپر', 'shield', 'دفاع', 'defend', 'تیر', 'arrow'];
    spec.matchMode = 'any';
    spec.labelEn = 'Shield Defense';
    spec.labelFa = 'دفاع با سپر';
    return spec;
  }

  // 3. Stealth / Shadow
  if (/stealth|shadow|مخفی|سایه|کمین|نهان/.test(text)) {
    spec.actionStyles = ['stealthy'];
    spec.triggerKeywords = ['stealth', 'sneak', 'hide', 'مخفی', 'سایه', 'نهان'];
    spec.matchMode = 'any';
    spec.labelEn = 'Stealth & Ambush';
    spec.labelFa = 'پنهان‌کاری و غافلگیری';
    return spec;
  }

  // 4. Healing / Medicine
  if (/heal|first aid|bandage|wound|درمان|زخم|مرهم|طبابت/.test(text)) {
    spec.triggerKeywords = ['heal', 'bandage', 'wound', 'درمان', 'زخم', 'مرهم'];
    spec.matchMode = 'any';
    spec.labelEn = 'Wound Care';
    spec.labelFa = 'مراقبت و درمان زخم';
    return spec;
  }

  // 5. Social / Persuasion / Bureaucracy
  if (/متقاعد|دیوان|کاتبان|مأموران|persua|social|diploma|نیت/.test(text)) {
    spec.actionStyles = ['diplomatic', 'inquisitive'];
    spec.triggerKeywords = ['متقاعد', 'کاتبان', 'مأموران', 'نیت', 'persuade', 'diplomacy'];
    spec.matchMode = 'any';
    spec.labelEn = 'Social & Persuasion';
    spec.labelFa = 'متقاعدسازی و درک نیت';
    return spec;
  }

  // 6. Tactical / Combat
  if (/tactical|maneuver|حمله|مبارزه|ضربه|strike|attack/.test(text)) {
    spec.actionStyles = ['tactical', 'aggressive'];
    return spec;
  }

  return spec;
}

/**
 * Backfills a single ability if it lacks structured mechanics.
 */
export function backfillAbility(
  ability: AbilityDefinition,
  availableStats: StatDefinition[] = []
): { ability: AbilityDefinition; modified: boolean } {
  const isActive = ability.type === 'active_spell' || ability.type === 'active_technique';

  // If already structured, do nothing
  if (
    (!isActive && (ability.rollModifiers?.length ?? 0) > 0) ||
    (isActive && (ability.activation?.effects?.length ?? 0) > 0)
  ) {
    return { ability, modified: false };
  }

  const inferred = inferRollModifierFromProse(ability, availableStats);
  if (!inferred) {
    return { ability, modified: false };
  }

  if (isActive) {
    return {
      ability: {
        ...ability,
        activation: {
          cost: ability.cost,
          cooldownTurns: ability.cooldownTurns,
          effects: [inferred],
        },
      },
      modified: true,
    };
  } else {
    return {
      ability: {
        ...ability,
        rollModifiers: [inferred],
      },
      modified: true,
    };
  }
}

/**
 * Backfills a background's traits from its legacy `trait` string if `traits`
 * array is not yet structured.
 */
export function backfillBackground(
  background: BackgroundOriginDefinition,
  availableStats: StatDefinition[] = []
): { background: BackgroundOriginDefinition; modified: boolean } {
  if (background.traits && background.traits.length > 0) {
    return { background, modified: false };
  }

  const traitProse = (background.trait || '').trim();
  if (!traitProse) {
    return { background, modified: false };
  }

  const traitNames = traitProse
    .split(/[,،\n؛;]+/)
    .map((s) => s.trim().replace(/^[•\-\*]\s*/, ''))
    .filter(Boolean);

  if (traitNames.length === 0) {
    return { background, modified: false };
  }

  const generatedTraits: BackgroundTrait[] = traitNames.map((name, idx) => {
    const syntheticAbility: AbilityDefinition = {
      id: `trait_${idx}`,
      name,
      description: name,
      type: 'passive_feat',
      effectSummary: name,
    };
    const spec = inferRollModifierFromProse(syntheticAbility, availableStats);

    return {
      id: `trait_${background.id}_${idx}`,
      name,
      rollModifiers: spec ? [spec] : undefined,
    };
  });

  return {
    background: {
      ...background,
      traits: generatedTraits,
    },
    modified: true,
  };
}

/**
 * Backfills an entire RPG system (abilities + backgrounds).
 */
export function backfillRpgSystem(
  rpgSystem: {
    abilities?: AbilityDefinition[];
    backgrounds?: BackgroundOriginDefinition[];
    stats?: StatDefinition[];
  }
): {
  rpgSystem: typeof rpgSystem;
  summary: BackfillSummary;
} {
  const stats = rpgSystem.stats || [];
  let abilitiesModified = 0;
  let backgroundsModified = 0;

  const abilities = (rpgSystem.abilities || []).map((ab) => {
    const res = backfillAbility(ab, stats);
    if (res.modified) abilitiesModified++;
    return res.ability;
  });

  const backgrounds = (rpgSystem.backgrounds || []).map((bg) => {
    const res = backfillBackground(bg, stats);
    if (res.modified) backgroundsModified++;
    return res.background;
  });

  return {
    rpgSystem: {
      ...rpgSystem,
      abilities,
      backgrounds,
    },
    summary: {
      abilitiesChecked: (rpgSystem.abilities || []).length,
      abilitiesModified,
      backgroundsChecked: (rpgSystem.backgrounds || []).length,
      backgroundsModified,
    },
  };
}
