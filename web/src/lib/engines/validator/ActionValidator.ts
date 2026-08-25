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


    // 3. Plan 08 Check 3 — World Lore guardrails (MASTER_PLAN §5.3):
    //    extinct creatures cannot be summoned, artifacts must be possessed,
    //    and travel must respect the location graph.
    const loreViolation =
      ActionValidator.checkBannedCreatures(trimmed, worldBible) ??
      ActionValidator.checkUnownedArtifact(lower, playerState, worldBible) ??
      ActionValidator.checkMovementPlausibility(lower, playerState, worldBible);
    if (loreViolation) {
      return {
        isValid: false,
        isGuardrailViolation: true,
        rejectionReason: loreViolation,
        suggestedAction: 'This contradicts the laws of the world or your surroundings. Find another way.',
        normalizedAction: trimmed,
      };
    }

    // 4. Knowledge-boundary guardrail: block actions that rely on NPC secrets
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

    // 5. Action is valid and plausible
    return {
      isValid: true,
      normalizedAction: trimmed,
    };
  }

  /**
   * Plan 08: immutable extinction/ban laws that explicitly name a bestiary
   * entry make that creature impossible to summon or interact with.
   * E.g. law "Dragons are extinct" + bestiary "Dragon" → "summon dragon" fails.
   */
  private static checkBannedCreatures(actionText: string, worldBible: WorldBible): string | null {
    const lower = actionText.toLowerCase();
    const extinctionLaw = /(extinct|no longer exist|eradicated|wiped out|cannot be summoned|never return|منقرض|انقراض|دیگر وجود ندارند)/i;

    const bannedNames = new Set<string>();
    for (const law of worldBible.laws ?? []) {
      if (!law.isImmutable) continue;
      const lawText = `${law.rule} ${law.description || ''}`.toLowerCase();
      if (!extinctionLaw.test(lawText)) continue;
      for (const creature of worldBible.bestiary ?? []) {
        const name = creature.name.toLowerCase();
        if (name.length >= 4 && lawText.includes(name)) {
          bannedNames.add(name);
        }
      }
    }

    for (const name of bannedNames) {
      if (lower.includes(name)) {
        return `Impossible: ${name}s are extinct in this world according to its immutable laws.`;
      }
    }
    return null;
  }

  /**
   * Plan 08: naming a known world artifact the player does not possess is an
   * inventory hallucination (e.g. claiming the Sealed Ledger from thin air).
   */
  private static checkUnownedArtifact(
    lowerAction: string,
    playerState: PlayerState,
    worldBible: WorldBible
  ): string | null {
    for (const artifact of worldBible.artifacts ?? []) {
      const name = artifact.name.toLowerCase();
      if (name.length < 4 || !lowerAction.includes(name)) continue;

      const owned = playerState.inventory.some(
        (item) =>
          item.id === artifact.id ||
          item.name.toLowerCase().includes(name) ||
          name.includes(item.name.toLowerCase())
      );
      if (!owned) {
        return `"${artifact.name}" is not in your possession. You must obtain it within the story first.`;
      }
    }
    return null;
  }

  /**
   * Plan 08: travel actions must respect the location graph — the target must
   * be a connected neighbor of the player's current location.
   */
  private static checkMovementPlausibility(
    lowerAction: string,
    playerState: PlayerState,
    worldBible: WorldBible
  ): string | null {
    const travelIntent =
      /\b(go|travel|head|walk|run|sneak|sail|ride|journey|move|return)\s+(to|toward|towards|into|back to)?\b/.test(lowerAction) ||
      /برو(یم|ید)?\s+به|سفر\s+(به|کن)|حرکت\s+به/.test(lowerAction);
    if (!travelIntent) return null;

    const current = worldBible.locations.find((l) => l.id === playerState.currentLocationId);

    for (const loc of worldBible.locations ?? []) {
      const name = loc.name.toLowerCase();
      if (name.length < 4 || !lowerAction.includes(name) || loc.id === playerState.currentLocationId) {
        continue;
      }
      const connected =
        !!current &&
        ((current.connectedLocationIds || []).includes(loc.id) ||
          (loc.connectedLocationIds || []).includes(current.id));
      if (!connected) {
        return `"${loc.name}" is not directly reachable from ${
          current?.name ?? 'your current position'
        }. Travel through connected locations first.`;
      }
      break; // evaluate only the first named destination
    }
    return null;
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

        // Plan 08 precision: term overlap alone produced false positives on
        // common world nouns. Overlapping terms only count as secret leakage
        // when the action also names the NPC in question (any distinctive
        // name word counts, so "the baroness" matches "Baroness Vey").
        const nameWords = npc.name
          .toLowerCase()
          .split(/[^a-z\u0600-\u06FF]+/)
          .filter((w) => w.length >= 3);
        const mentionsNpc = nameWords.some((w) => lower.includes(w));
        if (!mentionsNpc) continue;

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
