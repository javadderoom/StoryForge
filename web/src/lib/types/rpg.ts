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
      { id: 'silver', nameFa: 'درهم سیمین', nameEn: 'Silver Dirham', symbol: '🥈', valueInBase: 10 },
      { id: 'copper', nameFa: 'پشیز مسی', nameEn: 'Copper Fals', symbol: '🥉', valueInBase: 1 },
    ],
  },
  dnd: {
    enabled: true,
    baseUnitNameFa: 'سکه مس',
    baseUnitNameEn: 'Copper Piece',
    denominations: [
      { id: 'gold', nameFa: 'سکه طلا', nameEn: 'Gold Piece', symbol: '🪙', valueInBase: 100 },
      { id: 'silver', nameFa: 'سکه نقره', nameEn: 'Silver Piece', symbol: '🥈', valueInBase: 10 },
      { id: 'copper', nameFa: 'سکه مس', nameEn: 'Copper Piece', symbol: '🥉', valueInBase: 1 },
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
}

export interface CharacterSetupPayload {
  archetypeId?: string;
  backgroundId?: string;
  allocatedStats?: Record<string, number>;
  characterName?: string;
}

export interface RPGSystemSchema {
  hasCombat: boolean;
  diceType: 'd20' | '2d6' | 'd100';
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
});

export const RPGSystemSchemaValidator = z.object({
  hasCombat: z.boolean().default(true),
  diceType: z.enum(['d20', '2d6', 'd100']).default('d20'),
  stats: z.array(StatDefinitionSchema).default([]),
  resources: z.array(ResourceDefinitionSchema).default([]),
  abilities: z.array(AbilityDefinitionSchema).default([]),
  skills: z.array(z.any()).default([]),
  startingInventory: z.array(GameItemSchema).default([]),
  inventoryCapacity: z.number().int().default(12),
  currency: CurrencySystemSchema.optional(),
  currencySystem: CurrencySystemSchema.optional(),
});
