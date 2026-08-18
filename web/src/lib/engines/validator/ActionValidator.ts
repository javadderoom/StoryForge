import { PlayerState } from '@/lib/types/gameplay';
import { WorldBible } from '@/lib/types/world';
import { RPGSystemSchema } from '@/lib/types/rpg';

export interface ValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  suggestedAction?: string;
  normalizedAction: string;
  violatesLawId?: string;
}

export class ActionValidator {
  /**
   * Performs deterministic guardrail checks against active World Laws,
   * Location constraints, and Player Inventory before sending to AI.
   */
  public static validateAction(
    actionText: string,
    playerState: PlayerState,
    worldBible: WorldBible,
    rpgSystem: RPGSystemSchema
  ): ValidationResult {
    const trimmed = actionText.trim();
    const lower = trimmed.toLowerCase();

    if (trimmed.length < 2) {
      return {
        isValid: false,
        rejectionReason: 'Action is too brief. Please describe what you wish to attempt.',
        normalizedAction: trimmed,
      };
    }

    // 1. Check against immutable World Laws
    for (const law of worldBible.laws) {
      if (law.isImmutable) {
        // Creature extinction check (e.g. Dragons)
        if (
          law.category === 'creatures' &&
          (lower.includes('dragon') || lower.includes('summon dragon') || lower.includes('tame dragon')) &&
          law.rule.toLowerCase().includes('extinct')
        ) {
          return {
            isValid: false,
            violatesLawId: law.id,
            rejectionReason: `Action violates world law: ${law.rule}`,
            suggestedAction: 'Look for another path or utilize the tools and skills at your disposal.',
            normalizedAction: trimmed,
          };
        }

        // Magic restriction check
        if (
          law.category === 'magic' &&
          (lower.includes('cast spell') || lower.includes('fireball') || lower.includes('teleport')) &&
          !rpgSystem.stats.some((s) => s.id === 'arcana' || s.id === 'magic')
        ) {
          return {
            isValid: false,
            violatesLawId: law.id,
            rejectionReason: `Magic cannot be freely cast without the proper arcane discipline.`,
            suggestedAction: 'Rely on your physical abilities, wits, or items in your pack.',
            normalizedAction: trimmed,
          };
        }
      }
    }

    // 2. Check for item hallucination (attempting to use specific key items not possessed)
    const itemAttemptMatches = lower.match(/(?:use|unlock with|open with|drink|consume)\s+(?:the|a|my)?\s+([a-z\s]+)/i);
    if (itemAttemptMatches && itemAttemptMatches[1]) {
      const referencedItemName = itemAttemptMatches[1].trim();

      // If user specifically references rare keys or potions, check inventory
      if (referencedItemName.includes('key') || referencedItemName.includes('potion') || referencedItemName.includes('scroll')) {
        const hasItem = playerState.inventory.some((item) =>
          item.name.toLowerCase().includes(referencedItemName) || referencedItemName.includes(item.name.toLowerCase())
        );

        if (!hasItem && !referencedItemName.includes('lockpick')) {
          return {
            isValid: false,
            rejectionReason: `You do not have "${referencedItemName}" in your inventory.`,
            suggestedAction: 'Check your inventory or attempt to find another solution.',
            normalizedAction: trimmed,
          };
        }
      }
    }

    // 3. Action is valid and plausible
    return {
      isValid: true,
      normalizedAction: trimmed,
    };
  }
}
