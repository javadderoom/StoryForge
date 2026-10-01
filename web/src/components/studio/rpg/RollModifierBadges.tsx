'use client';

import React from 'react';
import { RollModifierSpec, StatDefinition } from '@/lib/types/rpg';
import { ActionCategory } from '@/lib/types/actionCategory';

export interface RollModifierBadgesProps {
  spec: RollModifierSpec;
  isPersian?: boolean;
  categories?: ActionCategory[];
  stats?: StatDefinition[];
  className?: string;
}

export interface ConditionBadge {
  id: string;
  icon?: string;
  label: string;
  type: 'slot' | 'item' | 'category' | 'style' | 'risk' | 'stat' | 'keyword';
}

const SLOT_LABELS: Record<string, { fa: string; en: string; icon: string }> = {
  mainHand: { fa: 'دست اصلی', en: 'Main Hand', icon: '🗡️' },
  offHand: { fa: 'دست دوم', en: 'Off-Hand', icon: '✋' },
  armor: { fa: 'زره', en: 'Armor', icon: '🛡️' },
  relic: { fa: 'عتیقه', en: 'Relic', icon: '💍' },
};

const ITEM_TYPE_LABELS: Record<string, { fa: string; en: string; icon: string }> = {
  shield: { fa: 'سپر', en: 'Shield', icon: '🛡️' },
  weapon: { fa: 'سلاح', en: 'Weapon', icon: '⚔️' },
  armor: { fa: 'زره / جوشن', en: 'Armor', icon: '🦺' },
  potion: { fa: 'معجون', en: 'Potion', icon: '🧪' },
  tool: { fa: 'ابزار', en: 'Tool', icon: '🔧' },
  relic: { fa: 'عتیقه / نشان', en: 'Relic', icon: '💍' },
};

const STYLE_LABELS: Record<string, { fa: string; en: string; icon: string }> = {
  defensive: { fa: 'تدافعی', en: 'Defensive', icon: '🛡️' },
  agile: { fa: 'چابک', en: 'Agile', icon: '🏃' },
  aggressive: { fa: 'تهاجمی', en: 'Aggressive', icon: '⚔️' },
  diplomatic: { fa: 'دیپلماتیک', en: 'Diplomatic', icon: '🗣️' },
  inquisitive: { fa: 'کنجکاو', en: 'Inquisitive', icon: '🔍' },
  tactical: { fa: 'تاکتیکی', en: 'Tactical', icon: '🧠' },
  stealthy: { fa: 'پنهان‌کارانه', en: 'Stealthy', icon: '👤' },
};

const RISK_LABELS: Record<string, { fa: string; en: string; icon: string }> = {
  low: { fa: 'کم‌خطر', en: 'Low Risk', icon: '🟢' },
  medium: { fa: 'خطر متوسط', en: 'Medium Risk', icon: '🟡' },
  high: { fa: 'پرخطر', en: 'High Risk', icon: '🔴' },
};

/** Known canonical category labels as fallbacks if database categories are not loaded yet */
const CANONICAL_CATEGORIES: Record<string, { fa: string; en: string; icon: string }> = {
  incoming_light_projectile: { fa: 'پرتابه‌های سبک (تیر/سنگ)', en: 'Light Projectiles', icon: '🎯' },
  incoming_heavy_projectile: { fa: 'پرتابه‌های سنگین (منجنیق)', en: 'Heavy Projectiles', icon: '💥' },
  incoming_melee_slash_blunt: { fa: 'حملات تن‌به‌تن تیغه/گرز', en: 'Melee Attacks', icon: '⚔️' },
  incoming_predator_natural: { fa: 'حملهٔ درندگان', en: 'Predator Attack', icon: '🐺' },
  defensive_stance_idle: { fa: 'موضع دفاعی آماده‌باش', en: 'Defensive Stance', icon: '🛡️' },
  acrobatic_dodge: { fa: 'جاخالی آکروباتیک', en: 'Acrobatic Dodge', icon: '🤸' },
  stealth_crawl: { fa: 'خزیدن بی‌صدا', en: 'Stealth Crawl', icon: '👣' },
  persuasion_diplomacy: { fa: 'متقاعدسازی و چانه‌زنی', en: 'Diplomacy & Bargain', icon: '📜' },
  potion_brewing: { fa: 'داروسازی و کیمیاگری', en: 'Alchemy', icon: '⚗️' },
  wilderness_caravan_handling: { fa: 'تیمار و هدایت ستور بارکش', en: 'Caravan Animal Handling', icon: '🐪' },
  wilderness_celestial_navigation: { fa: 'جهت‌یابی با ستارگان دشت', en: 'Celestial Navigation', icon: '🧭' },
  social_bureaucratic_official: { fa: 'تعامل با کاتبان و مأموران اداری', en: 'Bureaucratic & Official Dealing', icon: '📜' },
  survival_desert_heat_thirst: { fa: 'تاب‌آوری در برابر گرما و عطش', en: 'Desert Heat & Thirst Survival', icon: '☀️' },
  melee_heavy_strike: { fa: 'فرود ضربهٔ سنگین و خردکننده', en: 'Heavy Melee Cleave', icon: '🪓' },
  melee_precision_thrust: { fa: 'ضربهٔ دقیق و نفوذی', en: 'Precision Thrust', icon: '🗡️' },
  shield_bash_counter: { fa: 'ضدحمله و کوبیدن سپر', en: 'Shield Bash Counter', icon: '🛡️' },
  social_commercial_haggling: { fa: 'چانه‌زنی تجاری و معامله', en: 'Commercial Bargaining', icon: '🪙' },
  social_intimidation_menace: { fa: 'ارعاب و تهدید کلامی', en: 'Intimidation & Menace', icon: '💢' },
  social_deception_bluff: { fa: 'فریب و بلوف‌زنی', en: 'Deception & Bluff', icon: '🎭' },
};

export function getConditionBadges(
  spec: RollModifierSpec,
  isPersian = false,
  categories: ActionCategory[] = [],
  stats: StatDefinition[] = []
): ConditionBadge[] {
  const badges: ConditionBadge[] = [];

  // 1. Equipped Slot
  if (spec.requiresEquippedSlot) {
    const slotInfo = SLOT_LABELS[spec.requiresEquippedSlot];
    badges.push({
      id: `slot-${spec.requiresEquippedSlot}`,
      icon: slotInfo?.icon || '✋',
      label: slotInfo ? (isPersian ? slotInfo.fa : slotInfo.en) : spec.requiresEquippedSlot,
      type: 'slot',
    });
  }

  // 2. Item Type
  if (spec.requiresItemType) {
    const itemKey = spec.requiresItemType.toLowerCase();
    const itemInfo = ITEM_TYPE_LABELS[itemKey];
    badges.push({
      id: `item-${spec.requiresItemType}`,
      icon: itemInfo?.icon || '📦',
      label: itemInfo ? (isPersian ? itemInfo.fa : itemInfo.en) : spec.requiresItemType,
      type: 'item',
    });
  }

  // 3. Required Action Categories
  if (spec.requiredCategories?.length) {
    for (const catCode of spec.requiredCategories) {
      const dbCat = categories.find((c) => c.code === catCode);
      const fallback = CANONICAL_CATEGORIES[catCode];
      const label = dbCat
        ? (isPersian ? dbCat.nameFa : dbCat.nameEn)
        : fallback
        ? (isPersian ? fallback.fa : fallback.en)
        : catCode;
      badges.push({
        id: `cat-${catCode}`,
        icon: fallback?.icon || '🏷️',
        label,
        type: 'category',
      });
    }
  }

  // 4. Action Styles
  if (spec.actionStyles?.length) {
    for (const style of spec.actionStyles) {
      const info = STYLE_LABELS[style];
      badges.push({
        id: `style-${style}`,
        icon: info?.icon || '⚡',
        label: info ? (isPersian ? info.fa : info.en) : style,
        type: 'style',
      });
    }
  }

  // 5. Risk Levels
  if (spec.riskLevels?.length) {
    for (const risk of spec.riskLevels) {
      const info = RISK_LABELS[risk];
      badges.push({
        id: `risk-${risk}`,
        icon: info?.icon,
        label: info ? (isPersian ? info.fa : info.en) : risk,
        type: 'risk',
      });
    }
  }

  // 6. Linked / Restricted Stats
  if (spec.statIds?.length) {
    for (const statId of spec.statIds) {
      const st = stats.find((s) => s.id === statId);
      badges.push({
        id: `stat-${statId}`,
        icon: '🎲',
        label: st?.name || statId,
        type: 'stat',
      });
    }
  }

  // 7. Trigger Keywords
  if (spec.triggerKeywords?.length) {
    for (const kw of spec.triggerKeywords) {
      badges.push({
        id: `kw-${kw}`,
        icon: '💬',
        label: `"${kw}"`,
        type: 'keyword',
      });
    }
  }

  return badges;
}

/**
 * Returns the clean human-readable label without repeating numeric prefixes.
 */
export function getRollModifierCleanLabel(
  spec: RollModifierSpec,
  isPersian = false,
  withModifierNumber = true
): string {
  let label = ((isPersian ? spec.labelFa : spec.labelEn) || '').trim();
  // Strip any accidental leading modifier prefix (like "+1", "-2", "+ 1")
  label = label.replace(/^[+-]?\s*\d+\s*/, '').trim();

  if (!withModifierNumber) {
    return label;
  }

  const sign = spec.modifier >= 0 ? '+' : '';
  return label ? `${sign}${spec.modifier} ${label}` : `${sign}${spec.modifier}`;
}

export function RollModifierBadges({
  spec,
  isPersian = false,
  categories = [],
  stats = [],
  className = '',
}: RollModifierBadgesProps) {
  const badges = getConditionBadges(spec, isPersian, categories, stats);

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.id}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm"
        >
          {b.icon && <span className="text-[9px]">{b.icon}</span>}
          <span>{b.label}</span>
        </span>
      ))}
    </div>
  );
}
