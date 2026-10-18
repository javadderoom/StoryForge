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

// Plan 17: Inter-city travel state. While present, the protagonist is on the
// road between `originLocationId` and `destinationLocationId`; progress is a
// pure function of (departedTurn, session turn number, totalTurns), so remakes
// and rewinds never need to roll a countdown back.
export type TravelMode = 'foot' | 'mount' | 'caravan' | 'ship';

export interface ActiveTravel {
  originLocationId: string;
  destinationLocationId: string;
  /** Trade route followed when the journey uses one (Plan 10 routes). */
  routeId?: string;
  /** Ordered intermediate location stops (excludes origin + destination). */
  waypointIds?: string[];
  mode: TravelMode;
  /** Absolute session turn number when the journey began. */
  departedTurn: number;
  /** Total legs of the journey; clamped to 2..6 by the pacing rule. */
  totalTurns: number;
  /** Caravan / escort NPC ids travelling with the protagonist on this journey. */
  caravanNpcIds?: string[];
}

// Plan 17: the writer's condition-lifecycle contract. Entries mirror the
// narrative prose one-to-one; the reconciler maps `kind` through the condition
// catalog and enforces evidence rules before anything touches PlayerState.
export interface ConditionChangeEntry {
  /** Writer vocabulary kind (e.g. `wounded`, `bleeding`); mapped via catalog. */
  kind?: string;
  /** Narrative severity only, never mechanical: minor | moderate | severe. */
  severity?: string;
  /** The prose evidence: what in the story caused the condition. */
  source?: string;
  /** For `treat`: how the wound was treated (bandage, splint, healer…). */
  method?: string;
  /** For `remove`: why the condition ended (healing, antidote, rest…). */
  reason?: string;
}

export interface PlayerConditionChanges {
  add?: ConditionChangeEntry[];
  treat?: ConditionChangeEntry[];
  remove?: ConditionChangeEntry[];
}

export interface PlayerState {
  characterName?: string;
  archetypeId?: string;
  archetypeName?: string;
  backgroundId?: string;
  backgroundName?: string;
  traits?: string[];
  /**
   * Structured trait ids possessed by the character (see `BackgroundTrait`).
   * When absent, trait ids are derived from `backgroundId` at roll time, so
   * pre-existing sessions pick up newly authored trait mechanics automatically.
   */
  traitIds?: string[];
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
  /** Plan 15 (Pillar 4): active sub-zone / micro-location within currentLocationId. */
  currentSubZoneId?: string;
  /** Plan 13: active tension/threat clocks travelling with the session. */
  activeTensionClocks?: TensionClock[];
  /** Dynamic physical/mental/situational conditions (e.g. ['تشنه', 'خسته', 'ناآشنا']) */
  conditions?: string[];
  /**
   * Plan 15 (Bug 3): explicit party roster — NPC ids travelling with the
   * protagonist even when their home location is elsewhere. Authoritative
   * when present: non-empty pulls those NPCs into the scene; `[]` means
   * explicitly alone ("I scout ahead alone" writes `[]`). `undefined`
   * (legacy sessions) falls back to ledger companions (see
   * resolveAccompanyingIds in worldContext.ts).
   */
  accompanyingNpcIds?: string[];
  /** Unlocked or learned ability IDs */
  abilities?: string[];
  /**
   * Plan 17: active inter-city journey. Absent/null = grounded at
   * currentLocationId. Present = en route; progress derives from the
   * session turn number (see `travelEngine.getTravelStatus`).
   */
  travel?: ActiveTravel | null;
  /**
   * Cooldown bookkeeping: ability id -> turn number it was last invoked on.
   * Storing the stamp (rather than a countdown) keeps this idempotent and safe
   * for the turn-rewind flow.
   */
  abilityCooldowns?: Record<string, number>;
  /** Number of times the player has been defeated (HP → 0). Used by Hybrid Defeat system. */
  defeatCount?: number;
  /** Active power ranks in schools (schoolId -> rankNumber, e.g. { school_pyromancy: 2 }) */
  powerRanks?: Record<string, number>;
  /** Accumulated mastery/cultivation points per school (schoolId -> points) */
  powerSchoolMastery?: Record<string, number>;
  /** Discovered creature / beast species IDs encountered during playthrough */
  discoveredCreatureIds?: string[];
  /** Modular World Encounter IDs triggered and resolved during this playthrough */
  completedEncounterIds?: string[];
  /** Current progression level (starts at 1) */
  level?: number;
  /** Current XP progress towards next level */
  currentXP?: number;
  /** XP required to reach the next level */
  nextLevelXP?: number;
  /** Total lifetime XP accumulated across all levels */
  totalEarnedXP?: number;
  /** Stat points available to allocate by the player */
  unspentStatPoints?: number;
  /** Ability/feat selection points available */
  unspentAbilityPicks?: number;
}

export interface LevelUpRewardPayload {
  sessionId: string;
  statAllocations: Record<string, number>;
  chosenAbilityId?: string;
}

export interface StateMutationDiff {
  statChanges?: Record<string, number>; // e.g. { might: +1 }
  resourceChanges?: Record<string, number>; // e.g. { hp: -15 }
  purseChanges?: Record<string, number>; // e.g. { silver: -4, copper: +6 } (handles change breakdown)
  abilitiesAdded?: string[];
  abilitiesRemoved?: string[];
  /**
   * Ability id -> turn number it was invoked on. Merged into
   * `PlayerState.abilityCooldowns` so cooldowns survive session persistence.
   */
  abilityCooldownSet?: Record<string, number>;
  itemsAdded?: GameItem[];
  itemsRemovedIds?: string[];
  locationChange?: string;
  relationshipChanges?: Record<string, { trustDelta: number; newSecret?: string }>;
  questUpdates?: { questId: string; status: 'active' | 'completed' | 'failed' }[];
  npcStatusChanges?: Array<{ npcId: string; status: 'alive' | 'dead' | 'missing' | 'transformed' | 'companion' | 'imprisoned'; note?: string }>;
  /** Plan 13: hazard displacement target (mirrored into locationChange for applyStateMutation). */
  displacedLocationId?: string;
  clockUpdates?: Array<{ id: string; delta: number; isCrisis: boolean }>;
  /** Dynamic character condition updates (added to playerState.conditions) */
  conditionsAdded?: string[];
  /** Conditions removed/cleared from playerState.conditions */
  conditionsRemoved?: string[];
  /** Direct overwrite of playerState.conditions */
  conditions?: string[];
  /** Plan 15 (Bug 3): explicit roster overwrite — set when the deterministic party parser fires (incl. []). */
  accompanyingNpcIds?: string[];
  /** Plan 15 (Pillar 4): micro-location / sub-zone transition within currentLocationId. */
  currentSubZoneId?: string;
  /** Plan 17: journey start/replace; `null` cancels the journey at the current stop. */
  travel?: ActiveTravel | null;
  /** Power system rank updates (schoolId -> newRank) */
  powerRankChanges?: Record<string, number>;
  /** Power mastery point updates (schoolId -> pointsDelta) */
  powerMasteryChanges?: Record<string, number>;
  /** Modular World Encounter triggered in this turn */
  triggeredEncounterId?: string;
  /** Experience points gained during this turn */
  xpGained?: number;
  /** Level delta from this turn */
  levelDelta?: number;
  /** Stat points gained from level up */
  statPointsDelta?: number;
  /** Ability pick points gained from level up */
  abilityPicksDelta?: number;
}


export interface CheckResolution {
  actionDescription: string;
  statId?: string;
  statModifier: number;
  equipmentModifier?: number;
  passiveModifier?: number;
  diceRoll: number;
  diceType: string;
  environmentalModifier: number;
  totalScore: number;
  difficultyClass: number;
  outcome: DiceOutcome;
  consequenceSummary: string;
  stateDiff: StateMutationDiff;
  /** Active ability successfully invoked this turn (cost paid, cooldown started). */
  abilityInvocation?: {
    abilityId: string;
    abilityName: string;
    cost?: { targetResourceId: string; amount: number };
    cooldownTurns: number;
  };
  /** Every structured ability/trait modifier that contributed to this roll. */
  abilityContributions?: Array<{
    source: 'passive' | 'active' | 'trait';
    id: string;
    name: string;
    modifier: number;
    reasonEn: string;
    reasonFa: string;
  }>;
  /** Plan 13: hazard fallback the check displaced the player into. */
  displacedLocationId?: string;
  clockUpdate?: {
    clockId: string;
    newSegments: number;
    maxSegments: number;
    isCrisis: boolean;
  };
  /** Universal Action Feasibility assessment */
  feasibilityTier?: string;
  expectedReaction?: string;
  /** Progression XP and level up metadata for client celebrations */
  progression?: {
    xpAwarded: number;
    xpGained?: number;
    reasonEn?: string;
    reasonFa?: string;
    levelUpOccurred: boolean;
    previousLevel: number;
    newLevel: number;
    unspentStatPoints: number;
    unspentAbilityPicks?: number;
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
  /** Bestiary creature discovered for the first time in this turn (triggers Spotlight Card) */
  discoveredCreature?: any;
  /** NPC introduced for the first time in this turn (triggers NPC Spotlight Card) */
  discoveredNpc?: any;
  /** ALL NPCs introduced for the first time in this turn (supports multi-NPC scenes) */
  discoveredNpcs?: any[];
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
