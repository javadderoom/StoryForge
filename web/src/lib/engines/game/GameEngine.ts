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
  isPressureAction,
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
  applySocialOutcome,
} from './socialEngine';
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

  // Social & Secret mechanics
  public static isPressureAction = isPressureAction;
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
  public static applySocialOutcome = applySocialOutcome;

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
