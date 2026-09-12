import {
  PlayerState,
  CheckResolution,
  DiceOutcome,
  RiskLevel,
  StateMutationDiff,
  ChoiceOption,
  TensionClock,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, GameItem } from '@/lib/types/rpg';
import { WorldBible, WorldStateLedger, NPCDossier, SecretRevealMethod, WorldQuest, QuestObjective } from '@/lib/types/world';
import { resolveResourceMax, resolveResourceMin } from './resourcePools';
import { computeMaxResources } from './vitalScaling';
import {
  tickTensionClock,
  ensureClockForLocation,
  resolveDisplacement,
  clockIdForLocation,
} from './threatClock';
import { STAT_CANONICAL_ALIASES } from '@/lib/engines/world/ActionNormalizer';

export interface RevealCheckContext {
  trust?: number;
  /** Inventory item ids + names (any case) for `item` methods. */
  inventoryTerms?: string[];
  currentLocationId?: string;
  completedQuestIds?: string[];
}

/**
 * Context for strict, method-only secret discovery (item / location / ritual /
 * custom). Only secrets whose STATED `revealMethods` are satisfied may enter
 * `knownSecrets` — no other path exists in the engine.
 */
export interface ContextualRevealContext extends RevealCheckContext {
  knownSecretIds?: string[];
  /** The current turn's raw action text (for ritual/custom keyword triggers). */
  actionText?: string;
  /** True when the turn resolved with a successful outcome. */
  isSuccessful?: boolean;
}

export interface PressureOutcome {
  revealedSecretId?: string;
  revealedSecretDescription?: string;
  trustDelta: number;
  /** Sentence appended to the check consequence so the narrator can play the crack. */
  note: string;
}

/** Keywords marking an action as coercion/interrogation (EN + FA). */
const PRESSURE_KEYWORDS =
  /threaten|intimidat|coerc|blackmail|interrogat|pressur|press him|press her|press them|squeeze|lean on|talk or else|or else|tell me or|reveal or|expose you|break him|break her|تهدید|ارعاب|باج|بازجویی|فشار|افشا|وادار|مجبور/;

/** Trust thresholds at/above this mark unbreakable core secrets (critical success only). */
const UNBREAKABLE_TRUST_THRESHOLD = 90;

/**
 * Threats naming loved ones or lethal harm cut deeper — threatening the
 * children is not the same as leaning on a merchant over debts (EN + FA).
 */
const SEVERE_PRESSURE_KEYWORDS =
  /children|child\b|son\b|daughter|wife|husband|family|families|loved ones|kill you|kill him|kill her|murder|die\b|death of|burn it|فرزند|فرزندان|بچه|پسر|دختر|همسر|خانواده|کشتن|بکش|مرگ|نابود/;

/** Common words in NPC titles / names that shouldn't trigger spurious matches */
const NAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'van', 'von', 'del', 'der', 'den', 'des', 'with', 'from', 'about',
]);

export interface RollOptions {
  statId?: string;
  skillId?: string;
  targetDC?: number;
  riskLevel?: RiskLevel;
  environmentalModifier?: number;
  forcedDiceRoll?: number; // Useful for deterministic testing
  /** Plan 13: world context for hazard displacement + threat clock ticking. */
  worldBible?: WorldBible;
  currentLocationId?: string;
  activeClocks?: TensionClock[];
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
   * Computes standard stat modifier dynamically relative to authored baseline.
   * Formula: floor((Stat - baseValue) / 2).
   * For standard D20 (baseValue = 10): 14 -> +2, 10 -> 0, 8 -> -1.
   * For custom systems (e.g. baseValue = 3): 3 -> 0, 5 -> +1, 1 -> -1.
   */
  public static getStatModifier(statValue: number, baseValue: number = 10): number {
    return Math.floor((statValue - baseValue) / 2);
  }

  /**
   * Dynamically infers the most relevant Stat ID from action text and active RPG system.
   */
  public static inferStatId(
    actionText: string,
    rpgSystem: RPGSystemSchema,
    riskLevel?: string
  ): string {
    const lower = actionText.toLowerCase();

    // 1. Direct match: check if any stat ID, stat Name, or skill is mentioned
    for (const stat of rpgSystem.stats) {
      if (
        lower.includes(stat.id.toLowerCase()) ||
        (stat.name && lower.includes(stat.name.toLowerCase()))
      ) {
        return stat.id;
      }
    }

    for (const skill of rpgSystem.skills || []) {
      if (
        lower.includes(skill.id.toLowerCase()) ||
        (skill.name && lower.includes(skill.name.toLowerCase()))
      ) {
        if (rpgSystem.stats.some((s) => s.id === skill.linkedStatId)) {
          return skill.linkedStatId;
        }
      }
    }

    for (const ability of rpgSystem.abilities || []) {
      if (
        lower.includes(ability.id.toLowerCase()) ||
        (ability.name && lower.includes(ability.name.toLowerCase()))
      ) {
        if (ability.linkedStatId && rpgSystem.stats.some((s) => s.id === ability.linkedStatId)) {
          return ability.linkedStatId;
        }
      }
    }

    // 2. Genre-agnostic keyword clusters matched strictly against active stats
    const availableStatIds = rpgSystem.stats.map((s) => s.id.toLowerCase());

    const keywordMappings: { keywords: RegExp; targetIds: string[] }[] = [
      // Physical force / melee / violence
      {
        keywords: /حمله|خنجر|شمشیر|مشت|زور|ضرب|strike|hit|attack|force|slash|might|break|fight|shoot|punch/,
        targetIds: ['might', 'strength', 'power', 'combat', 'athletics', 'force'],
      },
      // Speed / stealth / finesse / evasion
      {
        keywords: /پنهان|مخفی|فرار|چابک|sneak|hide|dodge|jump|run|agility|slip|flee|escape|acrobatics|stealth/,
        targetIds: ['agility', 'dexterity', 'speed', 'stealth', 'reflexes', 'finesse'],
      },
      // Wit / perception / investigation / mechanics / tech / lockpicking
      {
        keywords: /قفل|تله|کلید|lock|pick|trap|cunning|معما|دقت|examine|investigate|mechanism|hack|code|analyze|wit|search/,
        targetIds: ['cunning', 'wit', 'intellect', 'perception', 'hacking', 'tech', 'investigation', 'logic'],
      },
      // Magic / occult / essence / arcane / science
      {
        keywords: /افسون|جادو|ورد|طلسم|magic|spell|arcana|relic|curse|occult|channel|ritual|cyberware/,
        targetIds: ['arcana', 'magic', 'occult', 'spirit', 'sorcery', 'cyberware', 'mysticism'],
      },
      // Social / charm / empathy / deception / romance / diplomacy
      {
        keywords: /عشق|نگاه|همدلی|فریب|مذاکره|صحبت|لبخند|charm|persuade|talk|romance|empathy|deceive|lie|intimidate|diplomacy|passion|kiss|hug|confess/,
        targetIds: ['charm', 'empathy', 'passion', 'presence', 'charisma', 'persuasion', 'diplomacy', 'wit'],
      },
    ];

    for (const mapping of keywordMappings) {
      if (mapping.keywords.test(lower)) {
        const matchedStatId = mapping.targetIds.find((id) => availableStatIds.includes(id));
        if (matchedStatId) return matchedStatId;
      }
    }

    // 3. Fallback to available stats in this story
    if (rpgSystem.stats.length > 0) {
      if (riskLevel === 'high' && rpgSystem.stats.length > 1) {
        return rpgSystem.stats[0].id;
      }
      return rpgSystem.stats[rpgSystem.stats.length > 1 ? 1 : 0].id;
    }

    return 'might';
  }

  /**
   * True when the action text reads as coercion, intimidation, or interrogation.
   */
  public static isPressureAction(actionText: string): boolean {
    return PRESSURE_KEYWORDS.test(actionText.toLowerCase());
  }

  /**
   * Human label for one reveal method (never includes the secret itself).
   * Used for hints, narrator context, and studio display.
   */
  public static describeRevealMethod(
    method: SecretRevealMethod,
    secretThreshold: number
  ): string {
    switch (method.kind) {
      case 'trust':
        return `trust ${method.trustThreshold ?? secretThreshold}`;
      case 'pressure':
        return 'pressure';
      case 'item':
        return `item: ${method.itemName || method.itemId || '?'}`;
      case 'ritual':
        return `${method.ritual || 'ritual'}${method.detail ? ` (${method.detail})` : ''}`;
      case 'location':
        return `at ${method.locationId || '?'}${method.detail ? ` (${method.detail})` : ''}`;
      case 'quest':
        return `quest: ${method.questId || '?'}`;
      case 'custom':
        return method.detail || 'special condition';
      default:
        return 'trust';
    }
  }

  /**
   * Whether pressure can ever crack this secret: legacy secrets (no
   * methods) always can; method-bound secrets only with a `pressure` entry.
   */
  public static isPressureCrackable(secret: {
    revealMethods?: SecretRevealMethod[];
  }): boolean {
    const methods = secret.revealMethods;
    if (!methods || methods.length === 0) return true;
    return methods.some((m) => m.kind === 'pressure');
  }

  /**
   * Checks the engine-observable methods (trust / item / location / quest).
   * `pressure` resolves via applyPressureOutcome; `ritual` and `custom`
   * need narrator adjudication and never auto-satisfy here.
   */
  public static isRevealMethodSatisfied(
    method: SecretRevealMethod,
    secretThreshold: number,
    ctx: RevealCheckContext = {}
  ): boolean {
    switch (method.kind) {
      case 'trust':
        return (ctx.trust ?? -100) >= (method.trustThreshold ?? secretThreshold);
      case 'item': {
        const want = [method.itemId, method.itemName]
          .filter((s): s is string => !!s)
          .map((s) => s.toLowerCase());
        if (want.length === 0) return false;
        const have = (ctx.inventoryTerms ?? []).map((t) => t.toLowerCase());
        return want.some((w) => have.some((t) => t === w || t.includes(w) || w.includes(t)));
      }
      case 'location':
        return !!method.locationId && ctx.currentLocationId === method.locationId;
      case 'quest':
        return !!method.questId && (ctx.completedQuestIds ?? []).includes(method.questId);
      case 'pressure':
      case 'ritual':
      case 'custom':
      default:
        return false;
    }
  }

  /**
   * Compact hidden-secret summary for narrator context: counts and ways
   * in, NEVER descriptions. (`3 hidden (ways in: trust 40, pressure, surgery)`)
   */
  public static describeHiddenSecrets(npc: NPCDossier): string {
    const hidden = (npc.secrets ?? []).filter(
      (s) => !s.revealed && s.description && s.description.length >= 12
    );
    if (hidden.length === 0) return '';
    const ways = Array.from(
      new Set(
        hidden.flatMap((s) => {
          const methods = s.revealMethods;
          if (!methods || methods.length === 0) return [`trust ${s.requiredTrustLevel}`];
          return methods.map((m) => GameEngine.describeRevealMethod(m, s.requiredTrustLevel));
        })
      )
    );
    return `${hidden.length} hidden (ways in: ${ways.join(', ')})`;
  }

  /**
   * Finds the next secret that unlocks passively: trust-satisfied or
   * quest-completed (one per NPC per turn, lowest threshold first).
   * Pressure/item/ritual/location/custom need triggers or the narrator.
   */
  public static findTrustUnlockedSecret(
    npc: NPCDossier,
    trust: number,
    knownSecretIds: string[] = [],
    completedQuestIds: string[] = []
  ): { id: string; description: string } | null {
    const known = new Set(knownSecretIds);
    const candidates = (npc.secrets ?? []).filter((s) => {
      if (s.revealed || known.has(s.id) || !s.description || s.description.length < 12) return false;
      const methods = s.revealMethods;
      if (!methods || methods.length === 0) return trust >= s.requiredTrustLevel;
      return methods.some(
        (m) =>
          (m.kind === 'trust' &&
            trust >= (m.trustThreshold ?? s.requiredTrustLevel)) ||
          (m.kind === 'quest' &&
            !!m.questId &&
            completedQuestIds.includes(m.questId))
      );
    });
        candidates.sort((a, b) => a.requiredTrustLevel - b.requiredTrustLevel);
    const first = candidates[0];
    return first ? { id: first.id, description: first.description } : null;
  }

  /**
   * Strict, method-sourced passive secret discovery for a turn.
   *
   * A secret enters `knownSecrets` ONLY through a method the NPC's own
   * `revealMethods` declare — trust threshold, possessed item, being at a
   * location, or a completed quest. `pressure` is resolved separately by
   * `applyPressureOutcome`; `ritual` and `custom` require narrator adjudication
   * and therefore never auto-satisfy here.
   *
   * - One secret per NPC per turn (lowest requiredTrustLevel first).
   * - Skips NPCs already granted a secret this turn (e.g. via pressure),
   *   preserving any pending trust delta on the relationship change.
   * - Uses the post-mutation trust (pre-turn trust + this turn's delta) so a
   *   successful social check that raised trust this turn can unlock a secret.
   *
   * @returns a map of npcId -> { newSecretId, newSecretDescription, revealMethod }
   */
  public static discoverSecretsForTurn(
    npcs: NPCDossier[],
    playerState: {
      relationships?: Record<string, { knownSecrets?: string[]; trust?: number }>;
      completedQuestIds?: string[];
      inventory?: Array<{ id: string; name: string }>;
      currentLocationId?: string;
    },
    opts: {
      /** Quest ids completed this turn (overrides playerState.completedQuestIds). */
      completedQuestIds?: string[];
      /** Relationship changes already produced this turn (e.g. from pressure/social checks). */
      existingRelationshipChanges?: Record<string, { newSecret?: string; trustDelta?: number }>;
    } = {}
  ): Record<string, { newSecretId: string; newSecretDescription: string; revealMethod: string }> {
    const grants: Record<string, { newSecretId: string; newSecretDescription: string; revealMethod: string }> = {};
    const completedIds =
      opts.completedQuestIds ?? (playerState.completedQuestIds as string[] | undefined) ?? [];
    const inventoryTerms = (playerState.inventory ?? []).map((i) => i.name).filter(Boolean);
    const currentLocationId = playerState.currentLocationId;
    const existing = opts.existingRelationshipChanges ?? {};

    for (const npc of npcs) {
      // Pressure/social resolution already revealed something this turn — do not double-grant.
      if (existing[npc.id]?.newSecret) continue;

      const rel = playerState.relationships?.[npc.id];
      const knownIds = new Set(rel?.knownSecrets ?? []);
      const pendingDelta = existing[npc.id]?.trustDelta ?? 0;
      const effectiveTrust = (rel?.trust ?? npc.initialTrust ?? 0) + pendingDelta;

      const candidates = (npc.secrets ?? []).filter(
        (s) => !s.revealed && s.description && s.description.length >= 12 && !knownIds.has(s.id)
      );
      if (candidates.length === 0) continue;

      // Legacy secret (no revealMethods): trust threshold only.
      const isLegacySatisfied = (s: { revealMethods?: SecretRevealMethod[]; requiredTrustLevel: number }) =>
        (!s.revealMethods || s.revealMethods.length === 0) && effectiveTrust >= s.requiredTrustLevel;

      const unlocked = candidates.filter((s) => {
        if (isLegacySatisfied(s)) return true;
        const methods = s.revealMethods;
        if (!methods || methods.length === 0) return false;
        return methods.some((m) =>
          GameEngine.isRevealMethodSatisfied(m, s.requiredTrustLevel, {
            trust: effectiveTrust,
            inventoryTerms,
            currentLocationId,
            completedQuestIds: completedIds,
          })
        );
      });
      if (unlocked.length === 0) continue;

      unlocked.sort((a, b) => a.requiredTrustLevel - b.requiredTrustLevel);
      const next = unlocked[0];
      let revealMethod = 'earned understanding';
      if (next.revealMethods && next.revealMethods.length > 0) {
        revealMethod = next.revealMethods
          .map((m) => GameEngine.describeRevealMethod(m, next.requiredTrustLevel))
          .join(' / ');
      }
      grants[npc.id] = {
        newSecretId: next.id,
        newSecretDescription: next.description,
        revealMethod,
      };
    }
    return grants;
  }

  /**
   * Finds the NPC a pressure action is aimed at (name match, same word rules
   * as the anti-leak validator). Null when the action is not pressure or no
   * known NPC is named.
   */
  public static detectPressureTarget(
    actionText: string,
    npcs: NPCDossier[]
  ): NPCDossier | null {
    if (!this.isPressureAction(actionText)) return null;
    const lower = actionText.toLowerCase();
    for (const npc of npcs ?? []) {
      const nameWords = npc.name
        .toLowerCase()
        .split(/[^a-z\u0600-\u06FF]+/)
        .filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w));
      if (nameWords.some((w) => {
        const regex = new RegExp(`(^|[^a-z\u0600-\u06FF])${w}([^a-z\u0600-\u06FF]|$)`, 'i');
        return regex.test(lower);
      })) return npc;
    }
    return null;
  }

  /**
   * Deterministic pressure resolution: coercion vs the NPC's breaking point.
   * Secrets crack below their trust threshold — but pressure always costs
   * trust on a scale that respects the -100..+100 range, and unbreakable
   * core secrets (threshold 90+) only crack on a critical success.
   * Threats aimed at loved ones or lethal harm (see
   * SEVERE_PRESSURE_KEYWORDS) cut an extra -10 when they land. Pure
   * function of (outcome, dossier, known secrets, action text).
   */
  public static applyPressureOutcome(
    outcome: DiceOutcome,
    npc: NPCDossier,
    knownSecretIds: string[] = [],
    actionText = ''
  ): PressureOutcome {
    const known = new Set(knownSecretIds);
    const unrevealed = (npc.secrets ?? []).filter(
      (s) =>
        !s.revealed &&
        !known.has(s.id) &&
        s.description &&
        s.description.length >= 12
    );
    const breakingPoint = npc.voiceGuide?.psychologicalBreakingPoint?.trim();
    const bpNote = breakingPoint ? ` Breaking point: ${breakingPoint}.` : '';
    const severe = SEVERE_PRESSURE_KEYWORDS.test(actionText.toLowerCase());
    const severeNote = severe ? ' They will never forgive this.' : '';
    // Extra -10 when a severe threat lands or blows up; -5 for threatened-but-held.
    const sev = (landed: boolean) => (severe ? (landed ? -10 : -5) : 0);

    if (unrevealed.length === 0) {
      return {
        trustDelta: -10,
        note: `${npc.name} has nothing left to squeeze out, but resents the pressure all the same. (Trust -10)`,
      };
    }

    // Method-bound secrets only crack under pressure with a `pressure` entry.
    // Hint at the real way in (the method, never the secret itself).
    const crackable = unrevealed.filter((s) => this.isPressureCrackable(s));
    if (crackable.length === 0) {
      const ways = Array.from(
        new Set(
          unrevealed.flatMap((s) =>
            (s.revealMethods ?? []).map((m) =>
              GameEngine.describeRevealMethod(m, s.requiredTrustLevel)
            )
          )
        )
      );
      const hint = ways.length > 0 ? ` (requires: ${ways.join(' / ')})` : '';
      return {
        trustDelta: -15,
        note: `${npc.name} will not break under threats — this truth is buried deeper than fear${hint}. (Trust -15)`,
      };
    }
    crackable.sort((a, b) => a.requiredTrustLevel - b.requiredTrustLevel);

    switch (outcome) {
      case 'critical_success': {
        // Total break: cracks anything, even unbreakable core secrets.
        const s = crackable[0];
        const delta = -25 + sev(true);
        return {
          revealedSecretId: s.id,
          revealedSecretDescription: s.description,
          trustDelta: delta,
          note: `${npc.name} breaks utterly under pressure and reveals: "${s.description}" (Trust ${delta}).${bpNote}${severeNote}`,
        };
      }
      case 'success': {
        const s = crackable.find((c) => c.requiredTrustLevel < UNBREAKABLE_TRUST_THRESHOLD);
        if (!s) {
          const delta = -15 + sev(false);
          return {
            trustDelta: delta,
            note: `${npc.name} bends but does not break — their deepest secrets hold (threshold ${UNBREAKABLE_TRUST_THRESHOLD}+ only cracks on critical success). (Trust ${delta})`,
          };
        }
        const delta = -30 + sev(true);
        return {
          revealedSecretId: s.id,
          revealedSecretDescription: s.description,
          trustDelta: delta,
          note: `${npc.name} cracks under pressure and reveals: "${s.description}" They will resent this bitterly. (Trust ${delta}).${bpNote}${severeNote}`,
        };
      }
      case 'mixed_success': {
        const delta = -15 + sev(false);
        return {
          trustDelta: delta,
          note: `${npc.name} clams up under pressure — nothing revealed, and they trust you less for trying. (Trust ${delta})`,
        };
      }
      case 'failure': {
        const delta = -15 + sev(false);
        return {
          trustDelta: delta,
          note: `The pressure fails: ${npc.name} holds firm and resents the attempt. (Trust ${delta})`,
        };
      }
      case 'critical_failure':
      default: {
        const delta = -30 + sev(true);
        return {
          trustDelta: delta,
          note: `Disastrous pressure: ${npc.name} shuts down completely and will remember this. (Trust ${delta})${severeNote}`,
        };
      }
    }
  }

  // ------------------------------------------------------------------
  // Social Action Detection & Positive Trust Awards (Plan 11)
  // ------------------------------------------------------------------

  /** Keywords marking an action as a positive social interaction (EN + FA). */
  private static readonly SOCIAL_KEYWORDS =
    /greet|thank|compliment|praise|help|assist|gift|offer|share|comfort|encourage|befriend|ally|barter|trade|negotiate|persuade|charm|flatter|sing|play.*for|treat|heal|defend|protect|rescue|accompany|apologise|apologize|سلام|تشکر|تعریف|کمک|هدیه|پیشنهاد|تسلی|دلگرم|دوست|همراه|مداوا|حمایت|معامله|مذاکره/;

  /**
   * Returns true when the action text contains positive-social keywords
   * and is NOT a pressure/coercion action (those are mutually exclusive).
   */
  public static isSocialAction(actionText: string): boolean {
    if (this.isPressureAction(actionText)) return false;
    return this.SOCIAL_KEYWORDS.test(actionText.toLowerCase());
  }

  /**
   * Finds the NPC a social action is aimed at (name match, same word rules
   * as detectPressureTarget). Null when the action is not social or no
   * known NPC is named.
   */
  public static detectSocialTarget(
    actionText: string,
    npcs: NPCDossier[]
  ): NPCDossier | null {
    if (!this.isSocialAction(actionText)) return null;
    const lower = actionText.toLowerCase();
    for (const npc of npcs ?? []) {
      const nameWords = npc.name
        .toLowerCase()
        .split(/[^a-z\u0600-\u06FF]+/)
        .filter((w) => w.length >= 3 && !NAME_STOPWORDS.has(w));
      if (nameWords.some((w) => {
        const regex = new RegExp(`(^|[^a-z\u0600-\u06FF])${w}([^a-z\u0600-\u06FF]|$)`, 'i');
        return regex.test(lower);
      })) return npc;
    }
    return null;
  }

  /**
   * Deterministic positive trust award from a successful social interaction.
   * The trust delta scales with the dice outcome; failures still earn small
   * goodwill because the player *tried*.
   *
   * Pure function of (outcome, actionStyle).
   */
  public static applySocialOutcome(
    outcome: DiceOutcome,
    actionStyle: string
  ): { trustDelta: number; note: string } {
    // Diplomatic actions get a small bonus to trust awards
    const styleBonus = actionStyle === 'diplomatic' ? 2 : 0;

    switch (outcome) {
      case 'critical_success':
        return { trustDelta: 15 + styleBonus, note: 'A brilliant social gesture — deep trust earned.' };
      case 'success':
        return { trustDelta: 8 + styleBonus, note: 'A warm social exchange builds trust.' };
      case 'mixed_success':
        return { trustDelta: 4 + styleBonus, note: 'The gesture is appreciated, if clumsy.' };
      case 'failure':
        return { trustDelta: 2, note: 'The effort is noticed, even if it fell flat.' };
      case 'critical_failure':
      default:
        return { trustDelta: -3, note: 'A social blunder — the gesture backfires.' };
    }
  }

  // ------------------------------------------------------------------
  // Option C Hybrid Defeat System
  // ------------------------------------------------------------------

  /**
   * Determines if the player has been defeated (HP ≤ 0) and returns the
   * penalties and narrative context for the hybrid defeat resolution.
   *
   * Rules:
   * - 1st defeat: Lose 50% gold, wake at last safe location, -5 trust
   *   from all NPCs present, narrative scar (consequence text).
   * - 2nd defeat: Lose a random non-quest inventory item + above.
   * - 3rd+ defeat: Permanent stat penalty (-1 to a relevant stat) + above.
   *
   * This method returns a StateMutationDiff that should be applied on top
   * of the existing state, plus narrative context for the AI.
   *
   * Pure function of (currentState, defeatCount, rpgSystem, checkedStatId).
   */
  public static resolveDefeat(
    currentState: PlayerState,
    rpgSystem: RPGSystemSchema,
    checkedStatId?: string
  ): {
    diff: StateMutationDiff;
    defeatCount: number;
    narrativeHint: string;
  } {
    const count = (currentState.defeatCount ?? 0) + 1;
    const diff: StateMutationDiff = { resourceChanges: {} };

    // --- Gold Penalty (always): lose 50% of current gold ---
    const goldResource = rpgSystem.resources.find((r) => r.id === 'gold');
    const currentGold = currentState.resources?.gold ?? currentState.resources?.['gold'] ?? 0;
    if (goldResource && currentGold > 0) {
      const goldLoss = -Math.floor(currentGold * 0.5);
      diff.resourceChanges!['gold'] = goldLoss;
    }

    // --- HP: restore to 25% of max to allow play to continue ---
    const healthResource =
      rpgSystem.resources.find((r) => /^(health|hp|سلامت|تندرستی)$/i.test(r.id)) ||
      rpgSystem.resources.find((r) => /health|hp|vital/i.test(r.id)) ||
      rpgSystem.resources[0];
    const healthKey = healthResource?.id || 'health';
    const hpMax = healthResource?.max ?? 100;
    const currentHp = currentState.resources?.[healthKey] ?? 0;
    const reviveHp = Math.max(1, Math.floor(hpMax * 0.25));
    diff.resourceChanges![healthKey] = reviveHp - currentHp;

    // --- Trust penalty: -5 to all known relationships ---
    const relChanges: Record<string, { trustDelta: number }> = {};
    for (const npcId of Object.keys(currentState.relationships ?? {})) {
      relChanges[npcId] = { trustDelta: -5 };
    }
    diff.relationshipChanges = relChanges;

    // --- 2nd+ defeat: lose a random non-quest item ---
    if (count >= 2) {
      const lossableItems = currentState.inventory.filter(
        (i) => i.type !== 'quest_item' && !/quest|relic|key/i.test(i.id)
      );
      if (lossableItems.length > 0) {
        const idx = Math.floor(Math.random() * lossableItems.length);
        diff.itemsRemovedIds = [lossableItems[idx].id];
      }
    }

    // --- 3rd+ defeat: permanent stat penalty ---
    if (count >= 3) {
      const statId = checkedStatId || rpgSystem.stats[0]?.id;
      if (statId) {
        diff.statChanges = { [statId]: -1 };
      }
    }

    // --- Location: return to first discovered location (safe haven) ---
    const safeLocId = currentState.discoveredLocationIds[0] ?? currentState.currentLocationId;
    diff.locationChange = safeLocId;

    // --- Build narrative hint for the AI ---
    const ordinal = count === 1 ? '1st' : count === 2 ? '2nd' : `${count}th`;
    let hint = `DEFEAT (${ordinal} time): The player has fallen in battle. `;
    hint += `They lost half their gold and wake at ${safeLocId} with ${reviveHp} HP. `;
    hint += `All NPC trust decreased by 5. `;
    if (count >= 2 && diff.itemsRemovedIds?.length) {
      const lostItem = currentState.inventory.find((i) => i.id === diff.itemsRemovedIds![0]);
      hint += `They lost their ${lostItem?.name ?? 'equipment'} in the fall. `;
    }
    if (count >= 3 && diff.statChanges) {
      const [sid, delta] = Object.entries(diff.statChanges)[0];
      hint += `Permanent scar: ${sid} ${delta}. `;
    }
    hint += `Narrate the defeat, unconsciousness, and grim awakening with escalating consequences. DO NOT kill the character.`;

    return { diff, defeatCount: count, narrativeHint: hint };
  }

  // ------------------------------------------------------------------
  // Plan 11 — Quest & Trust Progression Lifecycle
  // ------------------------------------------------------------------

  /**
   * Evaluates inventory items that trigger quests (e.g. letters, seals, artifacts).
   * Automatically activates any eligible unstarted quest.
   */
  public static evaluateQuestItemTriggers(
    playerState: PlayerState,
    worldBible: WorldBible
  ): { diff: StateMutationDiff; activatedQuests: WorldQuest[] } | null {
    const quests = worldBible.quests ?? [];
    if (quests.length === 0) return null;

    const activeSet = new Set(playerState.activeQuestIds ?? []);
    const completedSet = new Set(playerState.completedQuestIds ?? []);
    const activated: WorldQuest[] = [];

    for (const item of playerState.inventory ?? []) {
      for (const quest of quests) {
        if (activeSet.has(quest.id) || completedSet.has(quest.id)) continue;

        const isItemTrigger =
          (item.startsQuestId && item.startsQuestId === quest.id) ||
          (quest.triggerItemId && (quest.triggerItemId === item.id || quest.triggerItemId === item.name));

        if (isItemTrigger) {
          activeSet.add(quest.id);
          activated.push(quest);
        }
      }
    }

    if (activated.length === 0) return null;

    return {
      diff: {
        questUpdates: activated.map((q) => ({ questId: q.id, status: 'active' as const })),
      },
      activatedQuests: activated,
    };
  }

  /**
   * Checks if an unstarted quest's prerequisites are met so an NPC or event can offer it.
   */
  public static canOfferQuest(quest: WorldQuest, playerState: PlayerState): boolean {
    const activeSet = new Set(playerState.activeQuestIds ?? []);
    const completedSet = new Set(playerState.completedQuestIds ?? []);
    if (activeSet.has(quest.id) || completedSet.has(quest.id)) return false;

    // 1. Required completed quests
    const reqCompleted = quest.prerequisites?.requiredCompletedQuestIds ?? [];
    if (reqCompleted.some((id) => !completedSet.has(id))) return false;

    // 2. Required trust level with quest giver
    if (quest.giverNpcId && quest.prerequisites?.requiredTrustLevel !== undefined) {
      const currentTrust = playerState.relationships?.[quest.giverNpcId]?.trust ?? 0;
      if (currentTrust < quest.prerequisites.requiredTrustLevel) return false;
    }

    // 3. Required possessed items
    const reqItems = quest.prerequisites?.requiredPossessedItemIds ?? [];
    if (reqItems.length > 0) {
      const heldIds = new Set(playerState.inventory.map((i) => i.id));
      if (reqItems.some((id) => !heldIds.has(id))) return false;
    }

    return true;
  }

  /**
   * Evaluates active quests and returns any quests whose non-optional objectives are all satisfied.
   */
  public static evaluateActiveQuests(
    playerState: PlayerState,
    worldBible: WorldBible,
    context?: {
      targetNpcId?: string;
      actionText?: string;
      outcome?: DiceOutcome;
    }
  ): { readyToComplete: WorldQuest[] } {
    const quests = worldBible.quests ?? [];
    const activeIds = new Set(playerState.activeQuestIds ?? []);
    const readyToComplete: WorldQuest[] = [];

    for (const quest of quests) {
      if (!activeIds.has(quest.id)) continue;

      const nonOptionalObjectives = quest.objectives.filter((o) => !o.isOptional);
      const allMet = nonOptionalObjectives.every((obj) =>
        this.isObjectiveSatisfied(obj, playerState, context)
      );

      if (allMet && nonOptionalObjectives.length > 0) {
        readyToComplete.push(quest);
      }
    }

    return { readyToComplete };
  }

  /**
   * Determines if a single quest objective is fulfilled given current player state and action context.
   */
  public static isObjectiveSatisfied(
    objective: QuestObjective,
    playerState: PlayerState,
    context?: {
      targetNpcId?: string;
      actionText?: string;
      outcome?: DiceOutcome;
    }
  ): boolean {
    switch (objective.type) {
      case 'fetch':
      case 'deliver': {
        // Must possess required item with sufficient quantity
        if (objective.requiredItemId || objective.requiredItemName) {
          const matchingItem = playerState.inventory.find(
            (i) =>
              (objective.requiredItemId && i.id === objective.requiredItemId) ||
              (objective.requiredItemName && i.name.toLowerCase() === objective.requiredItemName.toLowerCase())
          );
          if (!matchingItem || matchingItem.quantity < (objective.requiredQuantity ?? 1)) {
            return false;
          }
        }
        // If deliver requires reaching a specific NPC or location:
        if (objective.targetNpcId && context?.targetNpcId && objective.targetNpcId !== context.targetNpcId) {
          return false;
        }
        if (objective.targetLocationId && playerState.currentLocationId !== objective.targetLocationId) {
          return false;
        }
        return true;
      }
      case 'discover': {
        if (objective.targetLocationId) {
          return (
            playerState.currentLocationId === objective.targetLocationId ||
            (playerState.discoveredLocationIds ?? []).includes(objective.targetLocationId)
          );
        }
        return false;
      }
      case 'slay':
      case 'infiltrate':
      case 'escort':
      case 'interrogate': {
        // Location check
        if (objective.targetLocationId && playerState.currentLocationId !== objective.targetLocationId) {
          return false;
        }
        // NPC check
        if (objective.targetNpcId && context?.targetNpcId && objective.targetNpcId !== context.targetNpcId) {
          return false;
        }
        // If an action check was resolved, must not be failure
        if (context?.outcome && (context.outcome === 'failure' || context.outcome === 'critical_failure')) {
          return false;
        }
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Completes a quest, consuming hand-in items, granting trust and rewards,
   * unlocking linked secrets, and advancing quest lines.
   */
  public static completeQuest(
    quest: WorldQuest,
    playerState: PlayerState,
    worldBible: WorldBible
  ): { diff: StateMutationDiff; narrativeSummary: string } {
    const diff: StateMutationDiff = {
      questUpdates: [{ questId: quest.id, status: 'completed' }],
      itemsRemovedIds: [],
      itemsAdded: [],
      resourceChanges: {},
      relationshipChanges: {},
    };

    // 1. Consume hand-in items for objectives with consumeItemOnComplete: true
    for (const obj of quest.objectives) {
      if (obj.consumeItemOnComplete && (obj.requiredItemId || obj.requiredItemName)) {
        const item = playerState.inventory.find(
          (i) =>
            (obj.requiredItemId && i.id === obj.requiredItemId) ||
            (obj.requiredItemName && i.name.toLowerCase() === obj.requiredItemName.toLowerCase())
        );
        if (item) {
          diff.itemsRemovedIds!.push(item.id);
        }
      }
    }

    // 2. Grant Trust Rewards
    const trustRewards = quest.rewards?.trustRewards ?? [];
    for (const reward of trustRewards) {
      diff.relationshipChanges![reward.npcId] = {
        trustDelta: reward.trustDelta,
      };
    }

    // Default giver trust if no explicit trust reward was configured
    if (quest.giverNpcId && trustRewards.length === 0) {
      diff.relationshipChanges![quest.giverNpcId] = {
        trustDelta: 25,
      };
    }

    // 3. Grant Gold Reward
    if (quest.rewards?.goldReward && quest.rewards.goldReward > 0) {
      diff.resourceChanges!['gold'] = (diff.resourceChanges!['gold'] || 0) + quest.rewards.goldReward;
    }

    // 4. Grant Item Rewards
    if (quest.rewards?.itemRewards && quest.rewards.itemRewards.length > 0) {
      diff.itemsAdded = quest.rewards.itemRewards.map((reward) => ({
        id: reward.id,
        name: reward.name,
        quantity: reward.quantity ?? 1,
        description: `Awarded for fulfilling "${quest.title}".`,
        type: 'quest_item' as const,
      }));
    }

    // 5. Unlock NPC Secrets (direct unlockedSecretIds + SecretRevealMethodKind='quest')
    const secretIdsToUnlock = new Set(quest.rewards?.unlockedSecretIds ?? []);
    for (const npc of worldBible.npcs ?? []) {
      for (const secret of npc.secrets ?? []) {
        const hasQuestMethod = secret.revealMethods?.some(
          (m) => m.kind === 'quest' && m.questId === quest.id
        );
        if (hasQuestMethod) {
          secretIdsToUnlock.add(secret.id);
        }
      }
    }

    // Attach discovered secrets to relationshipChanges
    for (const secretId of secretIdsToUnlock) {
      const parentNpc = (worldBible.npcs ?? []).find((n) =>
        (n.secrets ?? []).some((s) => s.id === secretId)
      );
      if (parentNpc) {
        const existing = diff.relationshipChanges![parentNpc.id] || { trustDelta: 0 };
        diff.relationshipChanges![parentNpc.id] = {
          ...existing,
          newSecret: secretId,
        };
      }
    }

    // 6. Advance Quest Line (queue nextQuestId if specified)
    if (quest.nextQuestId) {
      const nextQuest = (worldBible.quests ?? []).find((q) => q.id === quest.nextQuestId);
      if (nextQuest) {
        diff.questUpdates!.push({ questId: quest.nextQuestId, status: 'active' });
      }
    }

    // Clean up empty diff containers
    if (diff.itemsRemovedIds!.length === 0) delete diff.itemsRemovedIds;
    if (diff.itemsAdded!.length === 0) delete diff.itemsAdded;
    if (Object.keys(diff.resourceChanges!).length === 0) delete diff.resourceChanges;

    const giver = (worldBible.npcs ?? []).find((n) => n.id === quest.giverNpcId);
    const narrativeSummary =
      quest.rewards?.narrativeResolution ||
      `Deed fulfilled: "${quest.title}". ${giver ? `Trust earned with ${giver.name}.` : 'Objectives accomplished.'}`;

    return { diff, narrativeSummary };
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

    // Determine effective stat ID (dynamically infer from actionText and rpgSystem if omitted)
    const effectiveStatId = options.statId || this.inferStatId(actionText, rpgSystem, options.riskLevel);
    const rawStatId = (effectiveStatId || '').trim();
    const canonicalStatId = STAT_CANONICAL_ALIASES[rawStatId.toLowerCase()] || STAT_CANONICAL_ALIASES[rawStatId] || rawStatId;

    // Look up authored baseValue for the stat from rpgSystem (defaults to 10 if not defined)
    const targetStat = rpgSystem.stats?.find(
      (s) => s.id?.toLowerCase() === canonicalStatId.toLowerCase() || s.id?.toLowerCase() === rawStatId.toLowerCase()
    );
    const baseValue = targetStat?.baseValue ?? 10;

    // Calculate stat bonus
    let statModifier = 0;
    const currentStatVal = playerState.stats[canonicalStatId] ?? playerState.stats[effectiveStatId];
    if (currentStatVal !== undefined) {
      statModifier = this.getStatModifier(currentStatVal, baseValue);
    }

    // Calculate skill / ability bonus
    let skillBonus = 0;
    if (options.skillId) {
      const skill = rpgSystem.skills?.find((s) => s.id === options.skillId);
      if (skill) {
        skillBonus = skill.bonusModifier;
      } else {
        const ability = rpgSystem.abilities?.find((a) => a.id === options.skillId);
        if (ability) {
          skillBonus = (ability.tier || 1) * 2;
        }
      }
    }

    // Equipment & Inventory Tool modifier (equipped gear + relevant tools like lockpick_set)
    let equipmentModifier = 0;
    if (effectiveStatId) {
      const equippedIds = playerState.equipment
        ? [
            playerState.equipment.mainHand,
            playerState.equipment.offHand,
            playerState.equipment.armor,
            playerState.equipment.relic,
          ].filter(Boolean)
        : [];

      for (const item of playerState.inventory) {
        // Apply if item is actively equipped OR is a relevant tool (like lockpick_set for cunning)
        const isEquipped = equippedIds.includes(item.id);
        const isRelevantTool = item.type === 'quest_item';

        if ((isEquipped || isRelevantTool) && item.statModifiers && item.statModifiers[effectiveStatId]) {
          equipmentModifier += item.statModifiers[effectiveStatId];
        }
      }
    }

    // Check for tactical consumable or potion triggers in actionText
    let itemTacticalEnvMod = 0;
    const lowerAction = actionText.toLowerCase();
    const itemsRemovedIds: string[] = [];
    const initialResourceChanges: Record<string, number> = {};

    // Smoke pellet / distraction trigger
    if (/smoke|pellet|دود|مه|استتار/.test(lowerAction)) {
      const smokeItem = playerState.inventory.find(
        (i) => i.id === 'smoke_pellet' || i.name.toLowerCase().includes('smoke') || i.name.includes('دود')
      );
      if (smokeItem && smokeItem.quantity > 0) {
        itemTacticalEnvMod += 4; // Grant +4 environmental tactical advantage
        itemsRemovedIds.push(smokeItem.id);
      }
    }

    // Dynamically resolve primary health resource key (e.g. 'health', 'hp', 'سلامت', 'تندرستی')
    const healthRes = rpgSystem.resources?.find((r) =>
      ['health', 'hp', 'سلامت', 'تندرستی', 'life', 'vitality'].includes(r.id.toLowerCase())
    ) || rpgSystem.resources?.[0];
    const healthKey = healthRes ? healthRes.id : 'hp';

    // Dynamically resolve primary stamina/energy resource key if defined in this RPG system
    const staminaRes = rpgSystem.resources?.find((r) =>
      ['stamina', 'energy', 'استقامت', 'انرژی', 'fatigue', 'endurance'].includes(r.id.toLowerCase())
    );
    const staminaKey = staminaRes ? staminaRes.id : undefined;

    // Healing potion / tincture trigger
    if (/drink|potion|tincture|معجون|نوشیدن|درمان/.test(lowerAction)) {
      const potionItem = playerState.inventory.find(
        (i) => (i.healValue && i.healValue > 0) || i.id.includes('potion') || i.id.includes('tincture') || i.name.includes('معجون')
      );
      if (potionItem && potionItem.quantity > 0) {
        const healAmt = potionItem.healValue || 30;
        initialResourceChanges[healthKey] = (initialResourceChanges[healthKey] || 0) + healAmt;
        itemsRemovedIds.push(potionItem.id);
      }
    }

    const envMod = (options.environmentalModifier || 0) + itemTacticalEnvMod;
    const totalScore = roll + statModifier + skillBonus + equipmentModifier + envMod;

    // Default DC based on risk level if not explicitly provided
    const isLowBase = baseValue < 8;
    const baseDC =
      options.targetDC !== undefined
        ? options.targetDC
        : isLowBase
        ? options.riskLevel === 'high'
          ? 11
          : options.riskLevel === 'medium'
          ? 9
          : 7
        : options.riskLevel === 'high'
        ? 15
        : options.riskLevel === 'medium'
        ? 12
        : 9;

    let outcome: DiceOutcome;
    let consequenceSummary: string;
    const stateDiff: StateMutationDiff = {
      itemsRemovedIds: itemsRemovedIds.length > 0 ? itemsRemovedIds : undefined,
    };
    if (Object.keys(initialResourceChanges).length > 0) {
      stateDiff.resourceChanges = { ...initialResourceChanges };
    }

    if (isNatMin) {
      outcome = 'critical_failure';
      consequenceSummary = 'Disaster strikes: complete failure with severe complications or damage.';
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - 15,
      };
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
      const hpPenalty = options.riskLevel === 'low' ? 0 : -5;
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        ...(hpPenalty < 0 ? { [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) + hpPenalty } : {}),
        ...(staminaKey
          ? { [staminaKey]: (stateDiff.resourceChanges?.[staminaKey] || 0) - 10 }
          : {}),
      };
    } else {
      outcome = 'failure';
      consequenceSummary = 'The attempt failed: unexpected obstacle arose or opportunity lost.';
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - 10,
      };
    }

    // Bulletproof safeguard: Success and Critical Success NEVER take bodily health damage
    if ((outcome === 'success' || outcome === 'critical_success') && stateDiff.resourceChanges?.[healthKey]) {
      if (stateDiff.resourceChanges[healthKey] < 0) {
        delete stateDiff.resourceChanges[healthKey];
      }
    }

    // ------------------------------------------------------------------
    // Plan 13: Threat clock ticking + hazard displacement (deterministic).
    // ------------------------------------------------------------------
    let displacedLocationId: string | undefined;
    let clockUpdate: CheckResolution['clockUpdate'];
    try {
      const locId = options.currentLocationId || playerState.currentLocationId;
      const bible = options.worldBible;
      const location = bible?.locations?.find((l) => l.id === locId);
      const activeClock =
        (options.activeClocks ?? playerState.activeTensionClocks ?? []).find(
          (c) => c.id === clockIdForLocation(locId)
        ) || ensureClockForLocation(options.activeClocks ?? playerState.activeTensionClocks, location);

      if (activeClock) {
        const { newSegments, isCrisis } = tickTensionClock(activeClock, outcome);
        clockUpdate = {
          clockId: activeClock.id,
          newSegments,
          maxSegments: Math.max(2, activeClock.maxSegments || 4),
          isCrisis,
        };
        stateDiff.clockUpdates = [{ id: activeClock.id, delta: newSegments - (activeClock.currentSegments || 0), isCrisis }];
        if (isCrisis) {
          consequenceSummary += ` Danger peaks — ${activeClock.name} triggers: ${activeClock.crisisDescription || 'crisis erupts!'}`;
        }
      }

      displacedLocationId = bible ? resolveDisplacement(bible, locId, options.riskLevel, outcome) : undefined;
      if (displacedLocationId) {
        stateDiff.displacedLocationId = displacedLocationId;
        // Mirror into locationChange so applyStateMutation moves + discovers.
        stateDiff.locationChange = displacedLocationId;
        const fallDamage = outcome === 'critical_failure' ? 15 : 10;
        stateDiff.resourceChanges = {
          ...(stateDiff.resourceChanges || {}),
          [healthKey]: (stateDiff.resourceChanges?.[healthKey] || 0) - fallDamage,
        };
        consequenceSummary += ` Catastrophic failure hurls the player into a hazard zone.`;
      }
    } catch {
      /* non-fatal: clock/displacement must never break the core roll */
    }

    return {
      actionDescription: actionText,
      statId: effectiveStatId,
      statModifier: statModifier + skillBonus + equipmentModifier,
      diceRoll: roll,
      diceType,
      environmentalModifier: envMod,
      totalScore,
      difficultyClass: baseDC,
      outcome,
      consequenceSummary,
      stateDiff,
      ...(displacedLocationId ? { displacedLocationId } : {}),
      ...(clockUpdate ? { clockUpdate } : {}),
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
    // Clamp against the SCALED maximum (playerState.maxResources) so Studio
    // edits to Resource Pools + archetype/background/equipment bonuses hold.
    if (diff.resourceChanges) {
      for (const [resourceId, delta] of Object.entries(diff.resourceChanges)) {
        const current = updated.resources[resourceId] !== undefined ? updated.resources[resourceId] : 0;
        const maxVal = resolveResourceMax(resourceId, rpgSystem, updated);
        const minVal = resolveResourceMin(resourceId, rpgSystem);

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

    // 4. Apply Inventory Removals (decrement quantity by 1 if stacked)
    if (diff.itemsRemovedIds && diff.itemsRemovedIds.length > 0) {
      for (const removeId of diff.itemsRemovedIds) {
        const itemIndex = updated.inventory.findIndex((i) => i.id === removeId);
        if (itemIndex >= 0) {
          if (updated.inventory[itemIndex].quantity > 1) {
            updated.inventory[itemIndex].quantity -= 1;
          } else {
            updated.inventory.splice(itemIndex, 1);
          }
        }
      }
    }

    // 5. Apply Location Change (Plan 13: displacedLocationId mirrors here)
    const effectiveLocation = diff.displacedLocationId || diff.locationChange;
    if (effectiveLocation) {
      updated.currentLocationId = effectiveLocation;
      if (!updated.discoveredLocationIds.includes(effectiveLocation)) {
        updated.discoveredLocationIds.push(effectiveLocation);
      }
    }

    // 5b. Plan 13: Apply threat clock updates (spawn-or-update by id).
    if (diff.clockUpdates && diff.clockUpdates.length > 0) {
      if (!updated.activeTensionClocks) updated.activeTensionClocks = [];
      for (const cu of diff.clockUpdates) {
        const existing = updated.activeTensionClocks.find((c) => c.id === cu.id);
        if (existing) {
          existing.currentSegments = Math.min(
            Math.max(2, existing.maxSegments || 4),
            Math.max(0, (existing.currentSegments || 0) + cu.delta)
          );
          if (cu.isCrisis) existing.isTriggered = true;
        } else if (cu.delta !== 0 || cu.isCrisis) {
          // Clock metadata unknown here (route seeds full clocks); record minimal entry.
          updated.activeTensionClocks.push({
            id: cu.id,
            name: cu.id,
            currentSegments: Math.max(0, cu.delta),
            maxSegments: 4,
            crisisDescription: '',
            isTriggered: cu.isCrisis || undefined,
          });
        }
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

    // 7b. Refresh scaled maximums so stat/equipment shifts move the pools,
    // then clamp currents into range (covers Studio max edits mid-campaign).
    if (rpgSystem?.resources) {
      try {
        const archetype = (rpgSystem.archetypes ?? []).find((a: any) => a.id === updated.archetypeId);
        const background = (rpgSystem.backgrounds ?? []).find((b: any) => b.id === updated.backgroundId);
        const equippedIds = new Set(
          [updated.equipment?.mainHand, updated.equipment?.offHand, updated.equipment?.armor, updated.equipment?.relic].filter(Boolean)
        );
        const equippedArtifacts = (updated.inventory ?? []).filter((i: any) => equippedIds.has(i.id));
        const nextMax = computeMaxResources(updated.stats ?? {}, rpgSystem, { archetype, background, equippedArtifacts });
        updated.maxResources = nextMax;
        for (const res of rpgSystem.resources) {
          const cur = updated.resources?.[res.id];
          if (typeof cur === 'number') {
            updated.resources[res.id] = Math.min(nextMax[res.id] ?? res.max ?? cur, Math.max(res.min ?? 0, cur));
          }
        }
      } catch {
        /* non-fatal: keep previous maximums */
      }
    }

    // 7. Apply Quest Updates
    if (diff.questUpdates && diff.questUpdates.length > 0) {
      if (!updated.activeQuestIds) updated.activeQuestIds = [];
      if (!updated.completedQuestIds) updated.completedQuestIds = [];

      for (const update of diff.questUpdates) {
        if (update.status === 'active') {
          if (!updated.activeQuestIds.includes(update.questId) && !updated.completedQuestIds.includes(update.questId)) {
            updated.activeQuestIds.push(update.questId);
          }
        } else if (update.status === 'completed') {
          updated.activeQuestIds = updated.activeQuestIds.filter((id) => id !== update.questId);
          if (!updated.completedQuestIds.includes(update.questId)) {
            updated.completedQuestIds.push(update.questId);
          }
        } else if (update.status === 'failed') {
          updated.activeQuestIds = updated.activeQuestIds.filter((id) => id !== update.questId);
        }
      }
    }

    return updated;
  }

  // ------------------------------------------------------------------
  // Plan 08 — Living World State Ledger derivation (Tier 3)
  // ------------------------------------------------------------------

  /**
   * Derives a Living World Ledger patch from a deterministic state mutation
   * diff, so NPC relationship shifts and story-critical item gains survive
   * beyond the current turn instead of evaporating.
   *
   * Heuristics (deterministic by design):
   * - `relationshipChanges` on NPCs with a known faction drift that faction's
   *   reputation score by the trust delta.
   * - Every touched NPC gets/updates a status entry (default: alive).
   * - Added items flagged as quest items or high rarity become key items.
   */
  public static deriveLedgerPatch(
    diff: StateMutationDiff,
    worldBible: WorldBible
  ): Partial<WorldStateLedger> {
    const npcById = new Map(worldBible.npcs.map((n) => [n.id, n]));

    const factionDeltas = new Map<string, { name: string; delta: number }>();
    const npcStatuses: WorldStateLedger['npcStatuses'] = [];

    for (const [npcId, change] of Object.entries(diff.relationshipChanges || {})) {
      const npc = npcById.get(npcId);
      const explicit = (diff.npcStatusChanges || []).find((s) => s.npcId === npcId);
      npcStatuses.push({
        npcId,
        npcName: npc?.name || npcId,
        status: explicit?.status || 'alive',
        note: explicit?.note || (change.newSecret ? `Learned secret: ${change.newSecret}` : undefined),
      });
      const factionId = npc?.factionId;
      if (factionId && change.trustDelta !== 0) {
        const entry = factionDeltas.get(factionId) || { name: '', delta: 0 };
        entry.delta += change.trustDelta;
        if (npc?.factionId) {
          entry.name = worldBible.factions.find((f) => f.id === factionId)?.name || factionId;
        }
        factionDeltas.set(factionId, entry);
      }
    }

    const factionReputations: WorldStateLedger['factionReputations'] = [];
    for (const [factionId, { name, delta }] of factionDeltas) {
      const stance =
        delta >= 25 ? 'friendly' : delta <= -25 ? 'hostile' : 'neutral';
      factionReputations.push({ factionId, factionName: name || factionId, score: delta, stance });
    }

    // Status-only changes (death/transform without trust delta) still ledger.
    for (const s of diff.npcStatusChanges || []) {
      if (npcStatuses.some((n) => n.npcId === s.npcId)) continue;
      const npc = npcById.get(s.npcId);
      npcStatuses.push({
        npcId: s.npcId,
        npcName: npc?.name || s.npcId,
        status: s.status,
        note: s.note,
      });
    }

    const keyItems: WorldStateLedger['keyItems'] = (diff.itemsAdded || [])
      .filter((item) => this.isStoryCriticalItem(item))
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        description: item.description || '',
        isStoryCritical: true,
      }));

    const patch: Partial<WorldStateLedger> = {};
    if (factionReputations.length) patch.factionReputations = factionReputations;
    if (npcStatuses.length) patch.npcStatuses = npcStatuses;
    if (keyItems.length) patch.keyItems = keyItems;
    return patch;
  }

  private static isStoryCriticalItem(item: GameItem): boolean {
    return (
      item.type === 'quest_item' ||
      /quest|relic|artifact|seal|heirloom|ledger/i.test(item.id) ||
      /quest|relic|artifact|seal|heirloom|ledger/i.test(item.name)
    );
  }

  /**
   * Merges a derived ledger patch into the session's persisted Living World
   * Ledger. Entries are keyed by id so repeated turns accumulate deltas rather
   * than overwrite history; reputation scores are clamped to [-100, +100].
   */
  public static mergeLedgerPatch(
    base: WorldStateLedger | null | undefined,
    patch: Partial<WorldStateLedger>
  ): WorldStateLedger {
    const merged: WorldStateLedger = base
      ? JSON.parse(JSON.stringify(base))
      : { factionReputations: [], npcStatuses: [], keyItems: [], chapterSummaries: [], openPlotThreads: [] };

    for (const rep of patch.factionReputations || []) {
      const existing = merged.factionReputations.find((r) => r.factionId === rep.factionId);
      if (existing) {
        existing.score = Math.min(100, Math.max(-100, existing.score + rep.score));
        existing.stance = rep.stance;
        if (rep.note) existing.note = rep.note;
      } else {
        merged.factionReputations.push({ ...rep, note: rep.note });
      }
    }

    for (const npc of patch.npcStatuses || []) {
      const existing = merged.npcStatuses.find((n) => n.npcId === npc.npcId);
      if (existing) {
        existing.status = npc.status;
        if (npc.note) existing.note = npc.note;
      } else {
        merged.npcStatuses.push({ ...npc });
      }
    }

    for (const item of patch.keyItems || []) {
      if (!merged.keyItems.some((k) => k.itemId === item.itemId)) {
        merged.keyItems.push({ ...item });
      }
    }

    return merged;
  }
}
