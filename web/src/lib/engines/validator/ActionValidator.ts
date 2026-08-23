import { PlayerState } from '@/lib/types/gameplay';
import { WorldBible } from '@/lib/types/world';
import { RPGSystemSchema } from '@/lib/types/rpg';

export interface ValidationResult {
  isValid: boolean;
  rejectionReason?: string;
  suggestedAction?: string;
  normalizedAction: string;
  violatesLawId?: string;
  isGuardrailViolation?: boolean;
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

    // 1. Check for item hallucination (attempting to use specific items not possessed)
    const itemAttemptMatches = lower.match(
      /(?:use|unlock with|open with|drink|consume|equip|wield|read)\s+(?:the|a|my)?\s+([a-z\u0600-\u06FF\s]+)/i
    );
    if (itemAttemptMatches && itemAttemptMatches[1]) {
      const referencedItemName = itemAttemptMatches[1].trim();

      // Only check if it's a substantive item name (length >= 3) and not a generic physical maneuver
      const genericManeuvers = new Set([
        'hands',
        'fists',
        'body',
        'shoulder',
        'force',
        'feet',
        'strength',
        'lockpick',
        'دست',
        'پا',
        'بدن',
        'زور',
      ]);

      if (referencedItemName.length >= 3 && !genericManeuvers.has(referencedItemName)) {
        const hasItem = playerState.inventory.some(
          (item) =>
            item.name.toLowerCase().includes(referencedItemName) ||
            referencedItemName.includes(item.name.toLowerCase()) ||
            item.id.toLowerCase() === referencedItemName
        );

        if (!hasItem) {
          return {
            isValid: false,
            rejectionReason: `You do not have "${referencedItemName}" in your inventory.`,
            suggestedAction: 'Check your inventory or attempt to find another solution.',
            normalizedAction: trimmed,
          };
        }
      }
    }


    // 3. Knowledge-boundary guardrail: block actions that rely on NPC secrets
    //    the player has not yet discovered through play.
    const secretViolation = ActionValidator.detectUndiscoveredSecret(trimmed, playerState, worldBible);
    if (secretViolation) {
      return {
        isValid: false,
        isGuardrailViolation: true,
        rejectionReason: secretViolation,
        suggestedAction: 'You do not yet possess this knowledge. Discover it through play before acting on it.',
        normalizedAction: trimmed,
      };
    }

    // 4. Action is valid and plausible
    return {
      isValid: true,
      normalizedAction: trimmed,
    };
  }

  /**
   * Returns a rejection message when the action text references an NPC secret
   * the player has not yet discovered, otherwise null. Detection is heuristic:
   * it matches an explicit secret id or a substantive overlap (>=2 distinctive
   * terms) with an undiscovered secret's description.
   */
  private static detectUndiscoveredSecret(
    actionText: string,
    playerState: PlayerState,
    worldBible: WorldBible
  ): string | null {
    const lower = actionText.toLowerCase();
    const stopwords = new Set([
      'about',
      'their',
      'that',
      'this',
      'with',
      'from',
      'have',
      'has',
      'the',
      'and',
      'you',
      'your',
      'will',
      'into',
      'they',
      'them',
      'then',
      'than',
      'what',
      'when',
      'know',
      'secret',
      'secrets',
    ]);

    for (const npc of worldBible.npcs ?? []) {
      const rel = playerState.relationships?.[npc.id];
      const knownIds = new Set(rel?.knownSecrets ?? []);
      for (const secret of npc.secrets ?? []) {
        const discovered = secret.revealed || knownIds.has(secret.id);
        if (discovered || secret.description.length < 12) continue;

        if (lower.includes(secret.id.toLowerCase())) {
          return `You cannot act on knowledge of ${npc.name}'s secret you do not yet possess.`;
        }

        const terms = secret.description
          .toLowerCase()
          .split(/[^a-z\u0600-\u06FF]+/i)
          .filter((w) => w.length >= 5 && !stopwords.has(w));
        if (terms.length === 0) continue;

        let hits = 0;
        for (const term of terms) {
          if (lower.includes(term)) {
            hits += 1;
            if (hits >= 2) break;
          }
        }
        if (hits >= 2) {
          return `You cannot act on knowledge of ${npc.name}'s secret you do not yet possess.`;
        }
      }
    }
    return null;
  }
}
