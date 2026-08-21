import { z } from 'zod';

export interface StatDefinition {
  id: string;
  name: string;
  description: string;
  baseValue: number;
  minValue?: number;
  maxValue?: number;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  current: number;
  max: number;
  min: number;
  color?: string; // UI accent color (e.g. #ef4444 for HP, #3b82f6 for Mana)
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

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'shield' | 'consumable' | 'quest_item' | 'valuable' | 'document' | 'relic';
  quantity: number;
  rarity?: ItemRarity;
  grip?: WeaponGrip; // For weapons and shields
  statModifiers?: Record<string, number>; // e.g. { might: 2, agility: 1 }
  healValue?: number; // Instant HP restoration
  staminaValue?: number; // Instant Stamina restoration
  valueInGold?: number;
  isConsumable?: boolean;
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconName?: string;
  statBonuses: Record<string, number>; // e.g. { agility: 2, cunning: 1 }
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
  skills: SkillDefinition[];
  startingInventory: GameItem[];
  inventoryCapacity: number; // Max slots
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
});

export const ResourceDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  current: z.number(),
  max: z.number(),
  min: z.number().default(0),
  color: z.string().optional(),
});

export const GameItemSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  type: z.enum(['weapon', 'armor', 'shield', 'consumable', 'quest_item', 'valuable', 'document', 'relic']),
  quantity: z.number().int().min(1).default(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).optional(),
  grip: z.enum(['one_handed', 'two_handed', 'off_hand_only']).optional(),
  statModifiers: z.record(z.string(), z.number()).optional(),
  healValue: z.number().optional(),
  staminaValue: z.number().optional(),
  valueInGold: z.number().optional(),
  isConsumable: z.boolean().optional(),
});

export const RPGSystemSchemaValidator = z.object({
  hasCombat: z.boolean().default(true),
  diceType: z.enum(['d20', '2d6', 'd100']).default('d20'),
  stats: z.array(StatDefinitionSchema).default([]),
  resources: z.array(ResourceDefinitionSchema).default([]),
  skills: z.array(z.any()).default([]),
  startingInventory: z.array(GameItemSchema).default([]),
  inventoryCapacity: z.number().int().default(12),
});
