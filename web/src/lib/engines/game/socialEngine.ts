import { DiceOutcome } from '@/lib/types/gameplay';
import { NPCDossier, SecretRevealMethod } from '@/lib/types/world';

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
export const PRESSURE_KEYWORDS =
  /threaten|intimidat|coerc|blackmail|interrogat|pressur|press him|press her|press them|squeeze|lean on|talk or else|or else|tell me or|reveal or|expose you|break him|break her|تهدید|ارعاب|باج|بازجویی|فشار|افشا|وادار|مجبور/;

/** Trust thresholds at/above this mark unbreakable core secrets (critical success only). */
export const UNBREAKABLE_TRUST_THRESHOLD = 90;

/**
 * Threats naming loved ones or lethal harm cut deeper — threatening the
 * children is not the same as leaning on a merchant over debts (EN + FA).
 */
export const SEVERE_PRESSURE_KEYWORDS =
  /children|child\b|son\b|daughter|wife|husband|family|families|loved ones|kill you|kill him|kill her|murder|die\b|death of|burn it|فرزند|فرزندان|بچه|پسر|دختر|همسر|خانواده|کشتن|بکش|مرگ|نابود/;

/** Common words in NPC titles / names that shouldn't trigger spurious matches */
export const NAME_STOPWORDS = new Set([
  'the', 'and', 'for', 'van', 'von', 'del', 'der', 'den', 'des', 'with', 'from', 'about',
]);

/** Keywords marking an action as a positive social interaction (EN + FA). */
export const SOCIAL_KEYWORDS =
  /greet|thank|compliment|praise|help|assist|gift|offer|share|comfort|encourage|befriend|ally|barter|trade|negotiate|persuade|charm|flatter|sing|play.*for|treat|heal|defend|protect|rescue|accompany|apologise|apologize|سلام|تشکر|تعریف|کمک|هدیه|پیشنهاد|تسلی|دلگرم|دوست|همراه|مداوا|حمایت|معامله|مذاکره/;

/**
 * True when the action text reads as coercion, intimidation, or interrogation.
 */
export function isPressureAction(actionText: string): boolean {
  return PRESSURE_KEYWORDS.test(actionText.toLowerCase());
}

/**
 * Human label for one reveal method (never includes the secret itself).
 * Used for hints, narrator context, and studio display.
 */
export function describeRevealMethod(
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
export function isPressureCrackable(secret: {
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
export function isRevealMethodSatisfied(
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
export function describeHiddenSecrets(npc: NPCDossier): string {
  const hidden = (npc.secrets ?? []).filter(
    (s) => !s.revealed && s.description && s.description.length >= 12
  );
  if (hidden.length === 0) return '';
  const ways = Array.from(
    new Set(
      hidden.flatMap((s) => {
        const methods = s.revealMethods;
        if (!methods || methods.length === 0) return [`trust ${s.requiredTrustLevel}`];
        return methods.map((m) => describeRevealMethod(m, s.requiredTrustLevel));
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
export function findTrustUnlockedSecret(
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
export function discoverSecretsForTurn(
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
        isRevealMethodSatisfied(m, s.requiredTrustLevel, {
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
        .map((m) => describeRevealMethod(m, next.requiredTrustLevel))
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
export function detectPressureTarget(
  actionText: string,
  npcs: NPCDossier[]
): NPCDossier | null {
  if (!isPressureAction(actionText)) return null;
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
export function applyPressureOutcome(
  outcome: DiceOutcome,
  npc: NPCDossier,
  knownSecretIds: string[] = [],
  actionText = '',
  isPersian = false
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
  const bpNote = breakingPoint
    ? isPersian
      ? ` نقطه شکست: ${breakingPoint}.`
      : ` Breaking point: ${breakingPoint}.`
    : '';
  const severe = SEVERE_PRESSURE_KEYWORDS.test(actionText.toLowerCase());
  const severeNote = severe
    ? isPersian
      ? ' هرگز این رفتار را فراموش نخواهد کرد.'
      : ' They will never forgive this.'
    : '';
  // Extra -10 when a severe threat lands or blows up; -5 for threatened-but-held.
  const sev = (landed: boolean) => (severe ? (landed ? -10 : -5) : 0);

  if (unrevealed.length === 0) {
    return {
      trustDelta: -10,
      note: isPersian
        ? `${npc.name} رازی برای افشا ندارد، اما با این وجود از اعمال فشار شما دلخور شد (اعتماد ۱۰-).`
        : `${npc.name} has nothing left to squeeze out, but resents the pressure all the same. (Trust -10)`,
    };
  }

  // Method-bound secrets only crack under pressure with a `pressure` entry.
  // Hint at the real way in (the method, never the secret itself).
  const crackable = unrevealed.filter((s) => isPressureCrackable(s));
  if (crackable.length === 0) {
    const ways = Array.from(
      new Set(
        unrevealed.flatMap((s) =>
          (s.revealMethods ?? []).map((m) =>
            describeRevealMethod(m, s.requiredTrustLevel)
          )
        )
      )
    );
    const hint = ways.length > 0 ? ` (requires: ${ways.join(' / ')})` : '';
    return {
      trustDelta: -15,
      note: isPersian
        ? `${npc.name} در برابر تهدید تسلیم نمی‌شود — این حقیقت عمیق‌تر از ترس پنهان است (اعتماد ۱۵-).`
        : `${npc.name} will not break under threats — this truth is buried deeper than fear${hint}. (Trust -15)`,
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
        note: isPersian
          ? `${npc.name} کاملاً در برابر فشار فروپاشید و فاش کرد: «${s.description}» (اعتماد ${delta}).${bpNote}${severeNote}`
          : `${npc.name} breaks utterly under pressure and reveals: "${s.description}" (Trust ${delta}).${bpNote}${severeNote}`,
      };
    }
    case 'success': {
      const s = crackable.find((c) => c.requiredTrustLevel < UNBREAKABLE_TRUST_THRESHOLD);
      if (!s) {
        const delta = -15 + sev(false);
        return {
          trustDelta: delta,
          note: isPersian
            ? `${npc.name} تحت فشار قرار گرفت اما تسلیم نشد — عمیق‌ترین رازهایش پنهان ماندند (اعتماد ${delta}).`
            : `${npc.name} bends but does not break — their deepest secrets hold (threshold ${UNBREAKABLE_TRUST_THRESHOLD}+ only cracks on critical success). (Trust ${delta})`,
        };
      }
      const delta = -30 + sev(true);
      return {
        revealedSecretId: s.id,
        revealedSecretDescription: s.description,
        trustDelta: delta,
        note: isPersian
          ? `${npc.name} تسلیم فشار شد و فاش کرد: «${s.description}» (اعتماد ${delta}).${bpNote}${severeNote}`
          : `${npc.name} cracks under pressure and reveals: "${s.description}" They will resent this bitterly. (Trust ${delta}).${bpNote}${severeNote}`,
      };
    }
    case 'mixed_success': {
      const delta = -15 + sev(false);
      return {
        trustDelta: delta,
        note: isPersian
          ? `${npc.name} در برابر فشار سکوت کرد — رازی فاش نشد و اعتماد کاهش یافت (اعتماد ${delta}).`
          : `${npc.name} clams up under pressure — nothing revealed, and they trust you less for trying. (Trust ${delta})`,
      };
    }
    case 'failure': {
      const delta = -15 + sev(false);
      return {
        trustDelta: delta,
        note: isPersian
          ? `تلاش برای ارعاب ناموفق بود: ${npc.name} سرسختانه مقاومت کرد (اعتماد ${delta}).`
          : `The pressure fails: ${npc.name} holds firm and resents the attempt. (Trust ${delta})`,
      };
    }
    case 'critical_failure':
    default: {
      const delta = -30 + sev(true);
      return {
        trustDelta: delta,
        note: isPersian
          ? `نتیجه فاجعه‌بار: ${npc.name} کاملاً در برابر شما جبهه گرفت (اعتماد ${delta}).${severeNote}`
          : `Disastrous pressure: ${npc.name} shuts down completely and will remember this. (Trust ${delta})${severeNote}`,
      };
    }
  }
}

/**
 * Returns true when the action text contains positive-social keywords
 * and is NOT a pressure/coercion action (those are mutually exclusive).
 */
export function isSocialAction(actionText: string): boolean {
  if (isPressureAction(actionText)) return false;
  return SOCIAL_KEYWORDS.test(actionText.toLowerCase());
}

/**
 * Finds the NPC a social action is aimed at (name match, same word rules
 * as detectPressureTarget). Null when the action is not social or no
 * known NPC is named.
 */
export function detectSocialTarget(
  actionText: string,
  npcs: NPCDossier[]
): NPCDossier | null {
  if (!isSocialAction(actionText)) return null;
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
export function applySocialOutcome(
  outcome: DiceOutcome,
  actionStyle: string,
  isPersian = false
): { trustDelta: number; note: string } {
  // Diplomatic actions get a small bonus to trust awards
  const styleBonus = actionStyle === 'diplomatic' ? 2 : 0;

  if (isPersian) {
    switch (outcome) {
      case 'critical_success':
        return { trustDelta: 15 + styleBonus, note: 'رفتار اجتماعی درخشان — اعتمادی عمیق شکل گرفت.' };
      case 'success':
        return { trustDelta: 8 + styleBonus, note: 'گفت‌وگوی گرم و صمیمانه باعث افزایش اعتماد شد.' };
      case 'mixed_success':
        return { trustDelta: 4 + styleBonus, note: 'حسن نیت شما با وجود برخی کاستی‌ها پذیرفته شد.' };
      case 'failure':
        return { trustDelta: 2, note: 'تلاش شما دیده شد، گرچه دستاورد ملموسی نداشت.' };
      case 'critical_failure':
      default:
        return { trustDelta: -3, note: 'لغزش در گفتار یا رفتار — بازخورد منفی ایجاد کرد.' };
    }
  }

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
