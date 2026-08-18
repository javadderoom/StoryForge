import {
  PlayerState,
  CheckResolution,
  DiceOutcome,
  RiskLevel,
  StateMutationDiff,
  ChoiceOption,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, GameItem } from '@/lib/types/rpg';

export interface RollOptions {
  statId?: string;
  skillId?: string;
  targetDC?: number;
  riskLevel?: RiskLevel;
  environmentalModifier?: number;
  forcedDiceRoll?: number; // Useful for deterministic testing
}

export class GameEngine {
  /**
   * Rolls dice deterministically or via standard pseudo-random number generation.
   */
  public static rollDice(
    diceType: 'd20' | '2d6' | 'd100' = 'd20',
    forcedRoll?: number
  ): { roll: number; isNatMax: boolean; isNatMin: boolean } {
    if (forcedRoll !== undefined) {
      const max = diceType === 'd20' ? 20 : diceType === '2d6' ? 12 : 100;
      const min = diceType === '2d6' ? 2 : 1;
      return {
        roll: forcedRoll,
        isNatMax: forcedRoll >= max,
        isNatMin: forcedRoll <= min,
      };
    }

    switch (diceType) {
      case '2d6': {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        return {
          roll: total,
          isNatMax: total === 12,
          isNatMin: total === 2,
        };
      }
      case 'd100': {
        const roll = Math.floor(Math.random() * 100) + 1;
        return {
          roll,
          isNatMax: roll === 100,
          isNatMin: roll === 1,
        };
      }
      case 'd20':
      default: {
        const roll = Math.floor(Math.random() * 20) + 1;
        return {
          roll,
          isNatMax: roll === 20,
          isNatMin: roll === 1,
        };
      }
    }
  }

  /**
   * Computes standard stat modifier.
   * For standard D20: (Stat - 10) / 2 (e.g. 14 -> +2, 8 -> -1)
   */
  public static getStatModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
  }

  /**
   * Resolves a skill / stat check with deterministic outcome calculations.
   */
  public static resolveActionCheck(
    actionText: string,
    playerState: PlayerState,
    rpgSystem: RPGSystemSchema,
    options: RollOptions = {}
  ): CheckResolution {
    const diceType = rpgSystem.diceType || 'd20';
    const { roll, isNatMax, isNatMin } = this.rollDice(diceType, options.forcedDiceRoll);

    // Calculate stat bonus
    let statModifier = 0;
    if (options.statId && playerState.stats[options.statId] !== undefined) {
      statModifier = this.getStatModifier(playerState.stats[options.statId]);
    }

    // Calculate skill bonus
    let skillBonus = 0;
    if (options.skillId) {
      const skill = rpgSystem.skills.find((s) => s.id === options.skillId);
      if (skill) {
        skillBonus = skill.bonusModifier;
      }
    }

    // Equipment modifier (if any equipped items modify this stat)
    let equipmentModifier = 0;
    if (options.statId) {
      for (const item of playerState.inventory) {
        if (item.statModifiers && item.statModifiers[options.statId]) {
          equipmentModifier += item.statModifiers[options.statId];
        }
      }
    }

    const envMod = options.environmentalModifier || 0;
    const totalScore = roll + statModifier + skillBonus + equipmentModifier + envMod;

    // Default DC based on risk level if not explicitly provided
    const baseDC =
      options.targetDC !== undefined
        ? options.targetDC
        : options.riskLevel === 'high'
        ? 15
        : options.riskLevel === 'medium'
        ? 12
        : 9;

    let outcome: DiceOutcome;
    let consequenceSummary: string;
    const stateDiff: StateMutationDiff = {};

    if (isNatMin) {
      outcome = 'critical_failure';
      consequenceSummary = 'Disaster strikes: complete failure with severe complications or damage.';
      stateDiff.resourceChanges = { hp: -15 };
    } else if (isNatMax) {
      outcome = 'critical_success';
      consequenceSummary = 'Flawless execution: effortless success with bonus insight or tactical advantage.';
    } else if (totalScore >= baseDC + 5) {
      outcome = 'critical_success';
      consequenceSummary = 'Decisive victory: achieved the objective with exceptional style and advantage.';
    } else if (totalScore >= baseDC) {
      outcome = 'success';
      consequenceSummary = 'Clear success: objective accomplished as intended.';
    } else if (totalScore >= baseDC - 3) {
      outcome = 'mixed_success';
      consequenceSummary = 'Mixed success: goal achieved, but with cost, minor injury, or alert raised.';
      stateDiff.resourceChanges = { hp: -5, stamina: -10 };
    } else {
      outcome = 'failure';
      consequenceSummary = 'The attempt failed: unexpected obstacle arose or opportunity lost.';
      stateDiff.resourceChanges = { hp: -10 };
    }

    return {
      actionDescription: actionText,
      statId: options.statId,
      statModifier: statModifier + skillBonus + equipmentModifier,
      diceRoll: roll,
      diceType,
      environmentalModifier: envMod,
      totalScore,
      difficultyClass: baseDC,
      outcome,
      consequenceSummary,
      stateDiff,
    };
  }

  /**
   * Applies state mutations cleanly to the PlayerState and returns an immutable updated state.
   */
  public static applyStateMutation(
    currentState: PlayerState,
    diff: StateMutationDiff,
    rpgSystem?: RPGSystemSchema
  ): PlayerState {
    const updated: PlayerState = JSON.parse(JSON.stringify(currentState));

    // 1. Apply Stat Changes
    if (diff.statChanges) {
      for (const [statId, delta] of Object.entries(diff.statChanges)) {
        const current = updated.stats[statId] || 10;
        updated.stats[statId] = Math.max(1, current + delta);
      }
    }

    // 2. Apply Resource Changes (HP, Stamina, Mana, Gold)
    if (diff.resourceChanges) {
      for (const [resourceId, delta] of Object.entries(diff.resourceChanges)) {
        const current = updated.resources[resourceId] !== undefined ? updated.resources[resourceId] : 100;
        let maxVal = 100;
        let minVal = 0;

        if (rpgSystem) {
          const resDef = rpgSystem.resources.find((r) => r.id === resourceId);
          if (resDef) {
            maxVal = resDef.max;
            minVal = resDef.min;
          }
        }

        updated.resources[resourceId] = Math.min(maxVal, Math.max(minVal, current + delta));
      }
    }

    // 3. Apply Inventory Additions
    if (diff.itemsAdded && diff.itemsAdded.length > 0) {
      for (const newItem of diff.itemsAdded) {
        const existing = updated.inventory.find((i) => i.id === newItem.id);
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          updated.inventory.push({ ...newItem });
        }
      }
    }

    // 4. Apply Inventory Removals
    if (diff.itemsRemovedIds && diff.itemsRemovedIds.length > 0) {
      updated.inventory = updated.inventory.filter((item) => !diff.itemsRemovedIds!.includes(item.id));
    }

    // 5. Apply Location Change
    if (diff.locationChange) {
      updated.currentLocationId = diff.locationChange;
      if (!updated.discoveredLocationIds.includes(diff.locationChange)) {
        updated.discoveredLocationIds.push(diff.locationChange);
      }
    }

    // 6. Apply Relationship Changes
    if (diff.relationshipChanges) {
      for (const [npcId, change] of Object.entries(diff.relationshipChanges)) {
        if (!updated.relationships[npcId]) {
          updated.relationships[npcId] = {
            trust: 0,
            knownSecrets: [],
            notes: [],
          };
        }

        const rel = updated.relationships[npcId];
        rel.trust = Math.min(100, Math.max(-100, rel.trust + change.trustDelta));

        if (change.newSecret && !rel.knownSecrets.includes(change.newSecret)) {
          rel.knownSecrets.push(change.newSecret);
        }
      }
    }

    return updated;
  }
}
