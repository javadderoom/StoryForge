import { z } from 'zod';

export interface StatVitalEffect {
  targetResourceId: string; // e.g. "hp", "stamina", "resolve"
  bonusPerPointAboveBase: number; // e.g. +2 Max HP for each point above baseValue
}

export interface StatDefinition {
  id: string;
  name: string;
  description: string;
  baseValue: number;
  minValue?: number;
  maxValue?: number;
  vitalEffect?: StatVitalEffect;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  current: number;
  max: number;
  min: number;
  color?: string; // UI accent color (e.g. #ef4444 for HP, #3b82f6 for Mana)
}

export type AbilityType = 'active_spell' | 'active_technique' | 'passive_skill' | 'passive_feat';

export interface AbilityResourceCost {
  targetResourceId: string; // e.g. "mana", "stamina", "hp"
  amount: number; // e.g. 15
}

/**
 * When two or more `triggerKeywords` are authored, decides whether every
 * keyword must appear in the action text (`all`) or just one of them (`any`).
 */
export type RollMatchMode = 'any' | 'all';

/**
 * A structured, deterministic d20 roll modifier.
 *
 * This is the *mechanical* half of an ability / trait: the Game Engine reads it
 * directly instead of parsing prose. Every condition is optional — an
 * unconditioned spec applies to every check the owner rolls.
 *
 * Evaluation order (all authored conditions must hold):
 *   statIds → actionStyles → riskLevels → requiresEquippedSlot →
 *   requiresItemType → triggerKeywords
 */
export interface RollModifierSpec {
  /** Flat bonus/penalty added to the d20 total. Negative = penalty. */
  modifier: number;
  /** Restrict to these stat ids (e.g. ["might", "agility"]). Empty = any stat. */
  statIds?: string[];
  /** Restrict to these action styles (ActionStyle values: defensive, agile, tactical…). Empty = any. */
  actionStyles?: string[];
  /** Restrict to these risk levels (low | medium | high). Empty = any. */
  riskLevels?: string[];
  /**
   * Case-insensitive keywords (EN or FA) that must appear in the player's
   * action text. Empty = the spec is not keyword-gated.
   */
  triggerKeywords?: string[];
  /** `all` = every keyword required, `any` = one suffices. Defaults to `any`. */
  matchMode?: RollMatchMode;
  /** Requires the named equipment slot to be filled (mainHand/offHand/armor/relic). */
  requiresEquippedSlot?: 'mainHand' | 'offHand' | 'armor' | 'relic';
  /** Requires an equipped item of this type (weapon, armor, shield, tool, relic…). */
  requiresItemType?: string;
  /** Short label for the dice-breakdown UI (English). */
  labelEn?: string;
  /** Short label for the dice-breakdown UI (Persian). */
  labelFa?: string;
}

/**
 * Active-ability invocation payload. Present only on abilities of type
 * `active_spell` / `active_technique`: the player must spend the turn invoking
 * it, which pays the resource cost, starts the cooldown, and applies `effects`.
 */
export interface AbilityActivation {
  /** Overrides `AbilityDefinition.cost` when present. */
  cost?: AbilityResourceCost;
  /** Roll modifiers applied to the check the invocation rides on. */
  effects: RollModifierSpec[];
  /** Overrides `AbilityDefinition.cooldownTurns` when present. */
  cooldownTurns?: number;
  /** When true the ability may be used outside of a check (pure narrative beat). */
  allowOutOfCombat?: boolean;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  icon?: string; // Emoji or Lucide icon name
  tier?: number; // 1, 2, 3
  linkedStatId?: string; // e.g. "arcana", "might", "agility"
  cost?: AbilityResourceCost; // Resource cost to activate
  cooldownTurns?: number; // Turns before reuse
  effectSummary?: string; // Mechanical/narrative summary
  allowedArchetypeIds?: string[]; // Empty/undefined = Universal (all archetypes)
  tags?: string[];
  /**
   * Structured passive effects. For `passive_*` abilities these are evaluated on
   * every check and apply automatically whenever their conditions match.
   * An ability carrying `rollModifiers` is no longer prose-parsed by the legacy
   * heuristic path (see `engines/game/passiveAbilities.ts`).
   */
  rollModifiers?: RollModifierSpec[];
  /** Structured active-effect payload for `active_*` abilities. */
  activation?: AbilityActivation;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  linkedStatId: string;
  tier: number; // Tier 1, 2, 3
  bonusModifier: number; // +2, +4
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type WeaponGrip = 'one_handed' | 'two_handed' | 'off_hand_only';

export interface CurrencyDenomination {
  id: string; // e.g. "gold", "silver", "copper"
  nameFa: string; // e.g. "دینار طلا", "درهم نقره", "پشیز مسی"
  nameEn: string; // e.g. "Gold Dinar", "Silver Dirham", "Copper Fals"
  symbol: string; // e.g. "🪙", "🥈", "🥉"
  valueInBase: number; // e.g. 100, 10, 1
}

export interface CurrencySystem {
  enabled: boolean;
  baseUnitNameFa: string;
  baseUnitNameEn: string;
  denominations: CurrencyDenomination[];
}

export const DEFAULT_CURRENCY_PRESETS: Record<string, CurrencySystem> = {
  fantasy: {
    enabled: true,
    baseUnitNameFa: 'پشیز مسی',
    baseUnitNameEn: 'Copper Fals',
    denominations: [
      { id: 'gold', nameFa: 'دینار زرین', nameEn: 'Gold Dinar', symbol: '🪙', valueInBase: 100 },
      { id: 'silver', nameFa: 'درهم سیمین', nameEn: 'Silver Dirham', symbol: '🔘', valueInBase: 10 },
      { id: 'copper', nameFa: 'پشیز مسی', nameEn: 'Copper Fals', symbol: '🟤', valueInBase: 1 },
    ],
  },
  dnd: {
    enabled: true,
    baseUnitNameFa: 'سکه مس',
    baseUnitNameEn: 'Copper Piece',
    denominations: [
      { id: 'gold', nameFa: 'سکه طلا', nameEn: 'Gold Piece', symbol: '🪙', valueInBase: 100 },
      { id: 'silver', nameFa: 'سکه نقره', nameEn: 'Silver Piece', symbol: '🔘', valueInBase: 10 },
      { id: 'copper', nameFa: 'سکه مس', nameEn: 'Copper Piece', symbol: '🟤', valueInBase: 1 },
    ],
  },
  scifi: {
    enabled: true,
    baseUnitNameFa: 'نانو‌بیت',
    baseUnitNameEn: 'Nano-Bit',
    denominations: [
      { id: 'high_cred', nameFa: 'کریدیت طلایی', nameEn: 'High-Cred', symbol: '💳', valueInBase: 1000 },
      { id: 'credit', nameFa: 'کریدیت معیار', nameEn: 'Standard Credit', symbol: '₢', valueInBase: 100 },
      { id: 'bit', nameFa: 'میکرو‌بیت', nameEn: 'Micro-Bit', symbol: '⚡', valueInBase: 1 },
    ],
  },
};

export const CURRENCY_PRESETS_LIST = [
  {
    id: 'fantasy',
    nameEn: 'Middle Eastern (Gold Dinar / Silver Dirham / Copper Fals)',
    nameFa: 'خاورمیانه (دینار طلا / درهم نقره / پشیز مسی)',
    system: DEFAULT_CURRENCY_PRESETS.fantasy,
  },
  {
    id: 'dnd',
    nameEn: 'Standard Fantasy (Gold / Silver / Copper)',
    nameFa: 'فانتزی کلاسیک (طلا / نقره / مس)',
    system: DEFAULT_CURRENCY_PRESETS.dnd,
  },
  {
    id: 'scifi',
    nameEn: 'Sci-Fi (High-Cred / Standard Credit / Micro-Bit)',
    nameFa: 'علمی‌تخیلی (کریدیت طلایی / استاندارد / بیت)',
    system: DEFAULT_CURRENCY_PRESETS.scifi,
  },
];

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'shield' | 'consumable' | 'quest_item' | 'valuable' | 'document' | 'relic' | 'tool';
  quantity: number;
  rarity?: ItemRarity;
  grip?: WeaponGrip; // For weapons and shields
  statModifiers?: Record<string, number>; // e.g. { might: 2, agility: 1 }
  resourceModifiers?: Record<string, number>; // e.g. { hp: 10, stamina: 5 } (passive max pool modifier when equipped)
  healValue?: number; // Instant HP restoration
  staminaValue?: number; // Instant Stamina restoration
  resourceRestoration?: { targetResourceId: string; amount: number }; // Target vital restoration when consumed
  valueInGold?: number; // Legacy value
  priceInBase?: number; // Value in base currency unit (copper/pashiz)
  price?: number; // General price
  isConsumable?: boolean;
  startsQuestId?: string; // If possessed or inspected, starts this quest automatically
  nonEquippable?: boolean; // Plot/quest tokens (letters, sealed relics, ceremonial arms) that can never occupy an equipment slot
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconName?: string;
  statBonuses: Record<string, number>; // e.g. { agility: 2, cunning: 1 }
  resourceBonuses?: Record<string, number>; // e.g. { hp: 5, stamina: 3 }
  startingPurse?: Record<string, number>; // e.g. { gold: 2, silver: 10, copper: 15 }
  startingAbilities?: string[]; // IDs of abilities granted upon picking this archetype
  startingEquipment?: {
    mainHand?: string;
    offHand?: string;
    armor?: string;
    relic?: string;
  };
  bonusItems?: GameItem[];
}

/**
 * A single background/archetype trait with real mechanical teeth.
 *
 * `trait` (the legacy free-text field) is kept for display and for prompts that
 * predate structured traits; `traits[]` is the authoritative mechanical list.
 */
export interface BackgroundTrait {
  id: string;
  /** Display name, e.g. "شناخت گذرگاه‌های مخفی دژ". */
  name: string;
  description?: string;
  /**
   * Always-on roll modifiers. Evaluated on every check the character makes,
   * applying whenever the spec's conditions match.
   */
  rollModifiers?: RollModifierSpec[];
}

export interface BackgroundOriginDefinition {
  id: string;
  name: string;
  description: string;
  trait: string;
  narrativePromptHook?: string;
  statBonuses?: Record<string, number>;
  resourceBonuses?: Record<string, number>; // e.g. { stamina: 5, resolve: 2 }
  startingPurse?: Record<string, number>; // e.g. { silver: 15, copper: 30 }
  startingAbilities?: string[]; // IDs of abilities/traits granted by origin
  bonusItems?: GameItem[];
  /** Structured traits carrying real roll effects (preferred over `trait`). */
  traits?: BackgroundTrait[];
}

export interface CharacterSetupPayload {
  archetypeId?: string;
  backgroundId?: string;
  allocatedStats?: Record<string, number>;
  characterName?: string;
}

export type ProgressionCurveType = 'standard' | 'linear' | 'fast' | 'custom';
export type AbilityUnlockCadence = 'every_level' | 'every_two_levels' | 'milestones_only';

export interface ActionXpConfig {
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  criticalBonus: number;
  partialSuccessMultiplier: number;
  failureMultiplier: number;
  creaturePerDangerLevel: number;
}

export interface MilestoneXpConfig {
  questCompleted: number;
  chapterCompleted: number;
  discovery: number;
}

export interface ProgressionConfig {
  enabled: boolean;
  maxLevel: number;
  curveType: ProgressionCurveType;
  customThresholds?: number[];
  statPointsPerLevel: number;
  abilityUnlockCadence: AbilityUnlockCadence;
  actionXp: ActionXpConfig;
  milestoneXp: MilestoneXpConfig;
  healOnLevelUp: boolean;
}

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  enabled: true,
  maxLevel: 10,
  curveType: 'standard',
  statPointsPerLevel: 1,
  abilityUnlockCadence: 'every_two_levels',
  actionXp: {
    lowRisk: 10,
    mediumRisk: 25,
    highRisk: 50,
    criticalBonus: 25,
    partialSuccessMultiplier: 0.5,
    failureMultiplier: 0.2,
    creaturePerDangerLevel: 20,
  },
  milestoneXp: {
    questCompleted: 100,
    chapterCompleted: 250,
    discovery: 50,
  },
  healOnLevelUp: true,
};

export interface RPGSystemSchema {
  hasCombat: boolean;
  diceType: 'd20' | '2d6' | 'd100';
  universalBaseValue?: number; // System-wide zero-modifier baseline (e.g. 10 for d20, 5 for 1-10 scale)
  stats: StatDefinition[];
  resources: ResourceDefinition[];
  abilities?: AbilityDefinition[];
  skills: SkillDefinition[];
  startingInventory: GameItem[];
  inventoryCapacity: number; // Max slots
  currency?: CurrencySystem;
  currencySystem?: CurrencySystem;
  archetypes?: ArchetypeDefinition[];
  backgrounds?: BackgroundOriginDefinition[];
  progression?: ProgressionConfig;
}

export const StatDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  baseValue: z.number().default(10),
  minValue: z.number().optional().default(1),
  maxValue: z.number().optional().default(30),
  vitalEffect: z
    .object({
      targetResourceId: z.string(),
      bonusPerPointAboveBase: z.number(),
    })
    .optional(),
});

export const ResourceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  current: z.number(),
  max: z.number(),
  min: z.number().default(0),
  color: z.string().optional(),
});

export const CurrencyDenominationSchema = z.object({
  id: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  symbol: z.string(),
  valueInBase: z.number().positive(),
});

export const CurrencySystemSchema = z.object({
  enabled: z.boolean().default(true),
  baseUnitNameFa: z.string().default('پشیز مسی'),
  baseUnitNameEn: z.string().default('Copper Fals'),
  denominations: z.array(CurrencyDenominationSchema).default([]),
});

export const GameItemSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  type: z.enum(['weapon', 'armor', 'shield', 'consumable', 'quest_item', 'valuable', 'document', 'relic', 'tool']),
  quantity: z.number().int().min(1).default(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
  grip: z.enum(['one_handed', 'two_handed', 'off_hand_only']).optional(),
  statModifiers: z.record(z.string(), z.number()).optional(),
  resourceModifiers: z.record(z.string(), z.number()).optional(),
  healValue: z.number().optional(),
  staminaValue: z.number().optional(),
  resourceRestoration: z
    .object({
      targetResourceId: z.string(),
      amount: z.number(),
    })
    .optional(),
  valueInGold: z.number().optional(),
  priceInBase: z.number().optional(),
  price: z.number().optional(),
  isConsumable: z.boolean().optional(),
  startsQuestId: z.string().optional(),
  nonEquippable: z.boolean().optional(),
});

export const AbilityResourceCostSchema = z.object({
  targetResourceId: z.string(),
  amount: z.number(),
});

export const RollModifierSpecSchema = z.object({
  modifier: z.number(),
  statIds: z.array(z.string()).optional(),
  actionStyles: z.array(z.string()).optional(),
  riskLevels: z.array(z.string()).optional(),
  triggerKeywords: z.array(z.string()).optional(),
  matchMode: z.enum(['any', 'all']).optional(),
  requiresEquippedSlot: z.enum(['mainHand', 'offHand', 'armor', 'relic']).optional(),
  requiresItemType: z.string().optional(),
  labelEn: z.string().optional(),
  labelFa: z.string().optional(),
});

export const AbilityActivationSchema = z.object({
  cost: AbilityResourceCostSchema.optional(),
  effects: z.array(RollModifierSpecSchema).default([]),
  cooldownTurns: z.number().int().optional(),
  allowOutOfCombat: z.boolean().optional(),
});

export const AbilityDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  type: z.enum(['active_spell', 'active_technique', 'passive_skill', 'passive_feat']),
  icon: z.string().optional(),
  tier: z.number().int().optional(),
  linkedStatId: z.string().optional(),
  cost: AbilityResourceCostSchema.optional(),
  cooldownTurns: z.number().int().optional(),
  effectSummary: z.string().optional(),
  allowedArchetypeIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  rollModifiers: z.array(RollModifierSpecSchema).optional(),
  activation: AbilityActivationSchema.optional(),
});

export const BackgroundTraitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  rollModifiers: z.array(RollModifierSpecSchema).optional(),
});

export const ProgressionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxLevel: z.number().int().min(1).max(100).default(10),
  curveType: z.enum(['standard', 'linear', 'fast', 'custom']).default('standard'),
  customThresholds: z.array(z.number().int().nonnegative()).optional(),
  statPointsPerLevel: z.number().int().min(0).max(10).default(1),
  abilityUnlockCadence: z.enum(['every_level', 'every_two_levels', 'milestones_only']).default('every_two_levels'),
  actionXp: z
    .object({
      lowRisk: z.number().nonnegative().default(10),
      mediumRisk: z.number().nonnegative().default(25),
      highRisk: z.number().nonnegative().default(50),
      criticalBonus: z.number().nonnegative().default(25),
      partialSuccessMultiplier: z.number().min(0).max(1).default(0.5),
      failureMultiplier: z.number().min(0).max(1).default(0.2),
      creaturePerDangerLevel: z.number().nonnegative().default(20),
    })
    .default({
      lowRisk: 10,
      mediumRisk: 25,
      highRisk: 50,
      criticalBonus: 25,
      partialSuccessMultiplier: 0.5,
      failureMultiplier: 0.2,
      creaturePerDangerLevel: 20,
    }),
  milestoneXp: z
    .object({
      questCompleted: z.number().nonnegative().default(100),
      chapterCompleted: z.number().nonnegative().default(250),
      discovery: z.number().nonnegative().default(50),
    })
    .default({
      questCompleted: 100,
      chapterCompleted: 250,
      discovery: 50,
    }),
  healOnLevelUp: z.boolean().default(true),
});

export const RPGSystemSchemaValidator = z.object({
  hasCombat: z.boolean().default(true),
  diceType: z.enum(['d20', '2d6', 'd100']).default('d20'),
  universalBaseValue: z.number().int().default(10),
  stats: z.array(StatDefinitionSchema).default([]),
  resources: z.array(ResourceDefinitionSchema).default([]),
  abilities: z.array(AbilityDefinitionSchema).default([]),
  skills: z.array(z.any()).default([]),
  startingInventory: z.array(GameItemSchema).default([]),
  inventoryCapacity: z.number().int().default(12),
  currency: CurrencySystemSchema.optional(),
  currencySystem: CurrencySystemSchema.optional(),
  progression: ProgressionConfigSchema.optional(),
});
