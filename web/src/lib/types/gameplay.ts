import { z } from 'zod';
import { GameItem } from './rpg';

export type ActionStyle =
  | 'defensive'
  | 'agile'
  | 'aggressive'
  | 'diplomatic'
  | 'inquisitive'
  | 'tactical'
  | 'stealthy'
  | 'free_text';

export type RiskLevel = 'low' | 'medium' | 'high';

export type DiceOutcome =
  | 'critical_failure'
  | 'failure'
  | 'mixed_success'
  | 'success'
  | 'critical_success';

export interface ChoiceOption {
  id: string;
  text: string;
  style: ActionStyle;
  riskLevel: RiskLevel;
  requiredStatId?: string;
  targetDC?: number; // Difficulty Class (if mechanical check is needed)
}

export interface PlayerEquipment {
  mainHand?: string; // 1H or 2H Weapon
  offHand?: string;  // 1H Weapon or Shield (null if mainHand is 2H)
  armor?: string;    // Body Armor / Robes
  relic?: string;    // Amulet / Talisman / Ring
}

export interface PlayerState {
  characterName?: string;
  archetypeId?: string;
  archetypeName?: string;
  backgroundId?: string;
  backgroundName?: string;
  traits?: string[];
  stats: Record<string, number>; // e.g. { might: 14, agility: 12 }
  resources: Record<string, number>; // e.g. { hp: 85, stamina: 40, gold: 120 }
  inventory: GameItem[];
  equipment: PlayerEquipment;
  equippedWeaponId?: string;
  equippedArmorId?: string;
  discoveredLocationIds: string[];
  relationships: Record<
    string,
    {
      trust: number; // -100 to 100
      knownSecrets: string[];
      notes: string[];
    }
  >;
  activeQuestIds: string[];
  completedQuestIds: string[];
  currentLocationId: string;
}

export interface StateMutationDiff {
  statChanges?: Record<string, number>; // e.g. { might: +1 }
  resourceChanges?: Record<string, number>; // e.g. { hp: -15, gold: +50 }
  itemsAdded?: GameItem[];
  itemsRemovedIds?: string[];
  locationChange?: string;
  relationshipChanges?: Record<string, { trustDelta: number; newSecret?: string }>;
  questUpdates?: { questId: string; status: 'active' | 'completed' | 'failed' }[];
}

export interface CheckResolution {
  actionDescription: string;
  statId?: string;
  statModifier: number;
  diceRoll: number;
  diceType: string;
  environmentalModifier: number;
  totalScore: number;
  difficultyClass: number;
  outcome: DiceOutcome;
  consequenceSummary: string;
  stateDiff: StateMutationDiff;
}

export interface TurnBeat {
  turnNumber: number;
  sceneId: string;
  playerActionText: string;
  actionStyle: ActionStyle;
  resolution?: CheckResolution;
  narrativeProse: string;
  presentedChoices: ChoiceOption[];
  timestamp: number;
}

export interface PlaythroughSession {
  sessionId: string;
  userId: string;
  storyId: string;
  currentSceneId: string;
  turnCount: number;
  playerState: PlayerState;
  history: TurnBeat[];
  createdAt: number;
  updatedAt: number;
}

export const ChoiceOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  style: z.enum([
    'defensive',
    'agile',
    'aggressive',
    'diplomatic',
    'inquisitive',
    'tactical',
    'stealthy',
    'free_text',
  ]),
  riskLevel: z.enum(['low', 'medium', 'high']),
  requiredStatId: z.string().optional(),
  targetDC: z.number().int().optional(),
});
