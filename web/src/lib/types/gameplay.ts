import { z } from 'zod';
import { GameItem } from './rpg';
import { WorldStateLedger } from './world';

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

// Plan 13: Tension & Threat Clock (Blades in the Dark / D&D)
export interface TensionClock {
  id: string;
  name: string;
  currentSegments: number;
  maxSegments: number; // typically 4 or 6
  crisisDescription: string;
  isTriggered?: boolean;
}

export interface PlayerState {
  characterName?: string;
  archetypeId?: string;
  archetypeName?: string;
  backgroundId?: string;
  backgroundName?: string;
  traits?: string[];
  stats: Record<string, number>; // e.g. { might: 14, agility: 12 }
  resources: Record<string, number>; // Current vital values: { hp: 20, stamina: 15 }
  maxResources?: Record<string, number>; // Scaled vital pool maximums
  purse?: Record<string, number>; // Multi-denomination coin purse: { gold: 2, silver: 15, copper: 30 }
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
  /** Plan 13: active tension/threat clocks travelling with the session. */
  activeTensionClocks?: TensionClock[];
  /** Unlocked or learned ability IDs */
  abilities?: string[];
  /** Number of times the player has been defeated (HP → 0). Used by Hybrid Defeat system. */
  defeatCount?: number;
}

export interface StateMutationDiff {
  statChanges?: Record<string, number>; // e.g. { might: +1 }
  resourceChanges?: Record<string, number>; // e.g. { hp: -15 }
  purseChanges?: Record<string, number>; // e.g. { silver: -4, copper: +6 } (handles change breakdown)
  abilitiesAdded?: string[];
  abilitiesRemoved?: string[];
  itemsAdded?: GameItem[];
  itemsRemovedIds?: string[];
  locationChange?: string;
  relationshipChanges?: Record<string, { trustDelta: number; newSecret?: string }>;
  questUpdates?: { questId: string; status: 'active' | 'completed' | 'failed' }[];
  npcStatusChanges?: Array<{ npcId: string; status: 'alive' | 'dead' | 'missing' | 'transformed' | 'companion' | 'imprisoned'; note?: string }>;
  /** Plan 13: hazard displacement target (mirrored into locationChange for applyStateMutation). */
  displacedLocationId?: string;
  clockUpdates?: Array<{ id: string; delta: number; isCrisis: boolean }>;
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
  /** Plan 13: hazard fallback the check displaced the player into. */
  displacedLocationId?: string;
  clockUpdate?: {
    clockId: string;
    newSegments: number;
    maxSegments: number;
    isCrisis: boolean;
  };
}

export interface TurnBeat {
  turnNumber: number;
  sceneId: string;
  playerActionText: string;
  actionStyle: ActionStyle;
  resolution?: CheckResolution;
  narrativeProse: string;
  presentedChoices: ChoiceOption[];
  // Plan 07: chapter linkage for long-form saga campaigns
  chapterNumber?: number;
  imageUrl?: string;
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
  // Plan 07: long-form saga campaign state
  currentChapterId?: string;
  sagaLedger?: WorldStateLedger;
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
