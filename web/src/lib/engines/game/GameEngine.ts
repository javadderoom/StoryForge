/**
 * GameEngine Facade
 *
 * Provides a unified API for the core deterministic RPG and story resolution mechanisms.
 * Internals have been decomposed into dedicated domain modules:
 * - actionCheckEngine: Dice rolling, stat inference, modifier breakdown, action checks
 * - socialEngine: Secret reveal methods, pressure/interrogation, social encounters
 * - defeatEngine: Hybrid defeat penalties, gold loss, wake location, scar progression
 * - questEngine: Quest item triggers, objective evaluation, rewards, line progression
 * - stateMutationEngine: Immutable state diff application, resources, inventory, cooldowns
 * - powerEngine: Occult school rank breakthroughs, mastery checks, reagent consumption
 * - ledgerEngine: Living World state ledger patches, faction reputation, status persistence
 */

export * from './actionCheckEngine';
export * from './socialEngine';
export * from './npcTrustEngine';
export * from './defeatEngine';
export * from './questEngine';
export * from './stateMutationEngine';
export * from './powerEngine';
export * from './ledgerEngine';

import {
  rollDice,
  getStatModifier,
  inferStatId,
  hasStructuredMechanics,
  validateAbilityInvocation,
  resolveActionCheck,
} from './actionCheckEngine';
import {
  assessActionFeasibility,
  evaluateFeasibilityHeuristics,
} from './actionFeasibilityEngine';
import {
  isPressureAction,
  isInformationExtractionAction,
  isTacticalCoercionAction,
  describeRevealMethod,
  isPressureCrackable,
  isRevealMethodSatisfied,
  describeHiddenSecrets,
  findTrustUnlockedSecret,
  discoverSecretsForTurn,
  detectPressureTarget,
  applyPressureOutcome,
  isSocialAction,
  detectSocialTarget,
  resolveUniquePresentNpc,
  applySocialOutcome,
  detectPartyChange,
  applyPartyChange,
} from './socialEngine';
import { detectSubZoneChange } from './movementEngine';
import {
  detectTravelIntent,
  detectTravelAbortIntent,
  detectTravelMode,
  resolveDestinationName,
  isDirectlyReachable,
  routeBetween,
  planJourney,
  estimateTravelTurns,
  startTravel,
  advanceTravel,
  cancelTravel,
  travelProgress,
  travelTimeline,
  formatTravelLine,
  clampJourneyTurns,
  isTravelStateEnabled,
} from './travelEngine';
import {
  isConditionEffectsEnabled,
  isConditionReconcilerEnabled,
} from './conditionCatalog';
import {
  normalizeNpcTrustChanges,
  resolveDeclaredNpcTrustChanges,
  describeTrustChange,
  seedTrustRelationships,
} from './npcTrustEngine';
import { resolveDefeat } from './defeatEngine';
import {
  evaluateQuestItemTriggers,
  canOfferQuest,
  evaluateActiveQuests,
  isObjectiveSatisfied,
  completeQuest,
} from './questEngine';
import { applyStateMutation } from './stateMutationEngine';
import { attemptPowerBreakthrough } from './powerEngine';
import { deriveLedgerPatch, mergeLedgerPatch } from './ledgerEngine';

export class GameEngine {
  // Action Check & Dice mechanics
  public static rollDice = rollDice;
  public static getStatModifier = getStatModifier;
  public static inferStatId = inferStatId;
  public static hasStructuredMechanics = hasStructuredMechanics;
  public static validateAbilityInvocation = validateAbilityInvocation;
  public static resolveActionCheck = resolveActionCheck;
  public static assessActionFeasibility = assessActionFeasibility;
  public static evaluateFeasibilityHeuristics = evaluateFeasibilityHeuristics;

  // Social & Secret mechanics
  public static isPressureAction = isPressureAction;
  public static isInformationExtractionAction = isInformationExtractionAction;
  public static isTacticalCoercionAction = isTacticalCoercionAction;
  public static describeRevealMethod = describeRevealMethod;
  public static isPressureCrackable = isPressureCrackable;
  public static isRevealMethodSatisfied = isRevealMethodSatisfied;
  public static describeHiddenSecrets = describeHiddenSecrets;
  public static findTrustUnlockedSecret = findTrustUnlockedSecret;
  public static discoverSecretsForTurn = discoverSecretsForTurn;
  public static detectPressureTarget = detectPressureTarget;
  public static applyPressureOutcome = applyPressureOutcome;
  public static isSocialAction = isSocialAction;
  public static detectSocialTarget = detectSocialTarget;
  public static resolveUniquePresentNpc = resolveUniquePresentNpc;
  public static applySocialOutcome = applySocialOutcome;
  public static detectPartyChange = detectPartyChange;
  public static applyPartyChange = applyPartyChange;

  // NPC stance authority (Plan 17 follow-up)
  public static normalizeNpcTrustChanges = normalizeNpcTrustChanges;
  public static resolveDeclaredNpcTrustChanges = resolveDeclaredNpcTrustChanges;
  public static seedTrustRelationships = seedTrustRelationships;
  public static describeTrustChange = describeTrustChange;

  /** Plan 15 (Pillar 4): deterministic micro-location (sub-zone) writer. */
  public static detectSubZoneChange = detectSubZoneChange;

  /** Plan 17 (§4): deterministic inter-city travel lifecycle. */
  public static detectTravelIntent = detectTravelIntent;
  public static detectTravelAbortIntent = detectTravelAbortIntent;
  public static detectTravelMode = detectTravelMode;
  public static resolveTravelDestination = resolveDestinationName;
  public static isDirectlyReachable = isDirectlyReachable;
  public static routeBetween = routeBetween;
  public static planJourney = planJourney;
  public static estimateTravelTurns = estimateTravelTurns;
  public static startTravel = startTravel;
  public static advanceTravel = advanceTravel;
  public static cancelTravel = cancelTravel;
  public static travelProgress = travelProgress;
  public static travelTimeline = travelTimeline;
  public static formatTravelLine = formatTravelLine;
  public static clampJourneyTurns = clampJourneyTurns;
  public static isTravelStateEnabled = isTravelStateEnabled;

  /** Plan 17 (Phase 7): deterministic condition effects and reconciler flags. */
  public static isConditionEffectsEnabled = isConditionEffectsEnabled;
  public static isConditionReconcilerEnabled = isConditionReconcilerEnabled;

  // Defeat resolution
  public static resolveDefeat = resolveDefeat;

  // Quests & Objectives
  public static evaluateQuestItemTriggers = evaluateQuestItemTriggers;
  public static canOfferQuest = canOfferQuest;
  public static evaluateActiveQuests = evaluateActiveQuests;
  public static isObjectiveSatisfied = isObjectiveSatisfied;
  public static completeQuest = completeQuest;

  // State mutations
  public static applyStateMutation = applyStateMutation;

  // Power school breakthroughs
  public static attemptPowerBreakthrough = attemptPowerBreakthrough;

  // Living world ledger
  public static deriveLedgerPatch = deriveLedgerPatch;
  public static mergeLedgerPatch = mergeLedgerPatch;
}
