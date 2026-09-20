import { PlayerState } from '@/lib/types/gameplay';
import {
  AbilityDefinition,
  AbilityResourceCost,
  BackgroundTrait,
  RPGSystemSchema,
  RollModifierSpec,
} from '@/lib/types/rpg';

/**
 * Structured ability / trait mechanics.
 *
 * Before this module, an ability's "effect" was prose: `passiveAbilities.ts`
 * regex-scraped a number out of `effectSummary` and applied it behind five
 * hardcoded keyword heuristics, and active abilities were never invoked at all
 * (`options.skillId` was only ever set by unit tests). This module replaces both
 * with a single deterministic evaluator driven by authored `RollModifierSpec`s:
 *
 *   • passive abilities  → `ability.rollModifiers` apply on every matching check
 *   • active abilities   → `ability.activation.effects` apply only when invoked
 *                          this turn (cost paid, cooldown started)
 *   • background traits  → `background.traits[].rollModifiers` are always-on
 *
 * It is pure: no clock, no randomness, no I/O — so the eval harness, the server
 * and the two clients can all agree on the same number.
 */

export interface RollModifierContribution {
  source: 'passive' | 'active' | 'trait';
  id: string;
  name: string;
  modifier: number;
  /** Human-readable reason for the dice breakdown (English). */
  reasonEn: string;
  /** Human-readable reason for the dice breakdown (Persian). */
  reasonFa: string;
}

export interface AbilityInvocation {
  abilityId: string;
  abilityName: string;
  /** Resource actually spent (activation override, else the ability's own cost). */
  cost?: AbilityResourceCost;
  cooldownTurns: number;
}

export type AbilityInvocationBlockCode =
  | 'unknown'
  | 'not_learned'
  | 'not_active'
  | 'insufficient'
  | 'cooldown';

export interface AbilityInvocationValidation {
  ok: boolean;
  ability?: AbilityDefinition;
  code?: AbilityInvocationBlockCode;
  reasonEn?: string;
  reasonFa?: string;
}

export interface AbilityEffectContext {
  actionText: string;
  playerState?: PlayerState;
  rpgSystem?: Pick<RPGSystemSchema, 'abilities'> & { backgrounds?: any[] };
  /** The stat this check resolves against (post-canonicalisation). */
  effectiveStatId?: string;
  actionStyle?: string;
  riskLevel?: string;
  /** Current turn number — required for cooldown bookkeeping. */
  turnNumber?: number;
  /** Ability explicitly invoked by the client this turn. */
  invokedAbilityId?: string;
}

export interface AbilityEffectResult {
  totalModifier: number;
  contributions: RollModifierContribution[];
  /** Set when the player successfully invoked an active ability this turn. */
  invocation?: AbilityInvocation;
  /** Set when an explicitly requested ability could not be used. */
  blocked?: AbilityInvocationValidation;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function toLowerList(list?: string[]): string[] {
  return (list ?? [])
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function abilityDisplayName(ability: AbilityDefinition): string {
  return ability.name?.trim() || ability.id;
}

function traitDisplayName(trait: BackgroundTrait): string {
  return trait.name?.trim() || trait.id;
}

/** True when the player's action text names the ability or its raw id. */
function isOwnerMentioned(lowerAction: string, id: string, name?: string): boolean {
  const idTerm = (id || '').toLowerCase();
  const nameTerm = (name || '').trim().toLowerCase();
  if (nameTerm.length >= 2 && lowerAction.includes(nameTerm)) return true;
  if (idTerm.length >= 3 && lowerAction.includes(idTerm)) return true;
  return false;
}

/** The single machine-readable line describing a spec (used by Studio & prompts). */
export function describeRollModifier(spec: RollModifierSpec, isFa = false): string {
  const sign = spec.modifier >= 0 ? '+' : '';
  const gates: string[] = [];
  if (spec.statIds?.length) gates.push(`stat: ${spec.statIds.join('/')}`);
  if (spec.actionStyles?.length) gates.push(`style: ${spec.actionStyles.join('/')}`);
  if (spec.riskLevels?.length) gates.push(`risk: ${spec.riskLevels.join('/')}`);
  if (spec.requiresEquippedSlot) gates.push(`slot: ${spec.requiresEquippedSlot}`);
  if (spec.requiresItemType) gates.push(`item: ${spec.requiresItemType}`);
  if (spec.triggerKeywords?.length) {
    const joiner = spec.matchMode === 'all' ? ' AND ' : ' OR ';
    gates.push(`"${spec.triggerKeywords.join(joiner)}"`);
  }
  const label = ((isFa ? spec.labelFa : spec.labelEn) || '').trim();
  const head = label ? `${sign}${spec.modifier} ${label}` : `${sign}${spec.modifier}`;
  return gates.length > 0 ? `${head} (${gates.join(', ')})` : head;
}

// ---------------------------------------------------------------------------
// Spec matching
// ---------------------------------------------------------------------------

export interface RollSpecMatchContext {
  lowerAction: string;
  effectiveStatId?: string;
  actionStyle?: string;
  riskLevel?: string;
  playerState?: PlayerState;
  /** True when the action text names the owning ability/trait directly. */
  ownerMentioned?: boolean;
}

/**
 * Deterministic gate evaluation for one authored spec. Every condition that is
 * present must hold; absent conditions are not gated.
 */
export function matchesRollSpec(spec: RollModifierSpec, ctx: RollSpecMatchContext): boolean {
  if (!spec || typeof spec.modifier !== 'number' || !Number.isFinite(spec.modifier)) return false;

  // 1. Stat gate
  if (spec.statIds?.length) {
    const statId = (ctx.effectiveStatId ?? '').toLowerCase();
    if (!statId || !toLowerList(spec.statIds).includes(statId)) return false;
  }

  // 2. Action style gate (an unspecified style never satisfies a style gate)
  if (spec.actionStyles?.length) {
    const style = (ctx.actionStyle ?? '').toLowerCase();
    if (!style || !toLowerList(spec.actionStyles).includes(style)) return false;
  }

  // 3. Risk level gate
  if (spec.riskLevels?.length) {
    const risk = (ctx.riskLevel ?? '').toLowerCase();
    if (!risk || !toLowerList(spec.riskLevels).includes(risk)) return false;
  }

  // 4. Equipment slot gate
  if (spec.requiresEquippedSlot) {
    const equipped = (ctx.playerState?.equipment ?? {}) as Record<string, string | undefined>;
    if (!equipped[spec.requiresEquippedSlot]) return false;
  }

  // 5. Item type gate — the character must possess (equipped or carried) one.
  if (spec.requiresItemType) {
    const want = spec.requiresItemType.trim().toLowerCase();
    const possessed = ctx.playerState?.inventory ?? [];
    if (!possessed.some((item) => String(item?.type ?? '').toLowerCase() === want)) return false;
  }

  // 6. Keyword gate — a direct mention of the owner always satisfies it.
  const keywords = toLowerList(spec.triggerKeywords);
  if (keywords.length > 0 && !ctx.ownerMentioned) {
    const requireAll = spec.matchMode === 'all';
    const satisfied = requireAll
      ? keywords.every((k) => ctx.lowerAction.includes(k))
      : keywords.some((k) => ctx.lowerAction.includes(k));
    if (!satisfied) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Trait resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the structured trait ids the character owns.
 *
 * Prefers `playerState.traitIds`; falls back to the selected background's
 * `traits[]`. The fallback is what makes this backwards-compatible: sessions
 * created before structured traits existed already store `backgroundId`, so
 * newly authored trait mechanics apply to them without any data migration.
 */
export function resolveTraitIds(
  playerState?: PlayerState,
  rpgSystem?: { backgrounds?: any[] }
): string[] {
  const explicit = (playerState?.traitIds ?? []).filter((id) => typeof id === 'string' && id);
  if (explicit.length > 0) return [...new Set(explicit)];

  const backgroundId = playerState?.backgroundId;
  if (!backgroundId) return [];

  const background = (rpgSystem?.backgrounds ?? []).find(
    (b: any) => b?.id === backgroundId || b?.name === backgroundId
  );
  const traits: BackgroundTrait[] = background?.traits ?? [];
  return [...new Set(traits.map((t) => t?.id).filter((id): id is string => !!id))];
}

/** Finds a background/archetype trait definition by id or display name. */
export function findTraitDefinition(
  traitIdOrName: string,
  rpgSystem?: { backgrounds?: any[] }
): BackgroundTrait | null {
  const want = (traitIdOrName || '').toLowerCase();
  if (!want) return null;
  for (const background of rpgSystem?.backgrounds ?? []) {
    for (const trait of (background?.traits ?? []) as BackgroundTrait[]) {
      if (trait?.id?.toLowerCase() === want || trait?.name?.toLowerCase() === want) return trait;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Active-ability invocation
// ---------------------------------------------------------------------------

/** Effective cost of an activation (activation override wins over the ability's own). */
export function getActivationCost(ability: AbilityDefinition): AbilityResourceCost | undefined {
  const override = ability.activation?.cost;
  if (override && override.targetResourceId && override.amount > 0) {
    return { targetResourceId: override.targetResourceId, amount: override.amount };
  }
  if (ability.cost && ability.cost.targetResourceId && ability.cost.amount > 0) {
    return { targetResourceId: ability.cost.targetResourceId, amount: ability.cost.amount };
  }
  return undefined;
}

/** Effective cooldown length in turns. */
export function getActivationCooldown(ability: AbilityDefinition): number {
  const raw = ability.activation?.cooldownTurns ?? ability.cooldownTurns ?? 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function isActiveAbility(ability?: AbilityDefinition | null): boolean {
  return ability?.type === 'active_spell' || ability?.type === 'active_technique';
}

/**
 * Turns still to wait before the ability may be invoked again.
 * `cooldownTurns = 2` used on turn 5 → blocked on 6, available on 7.
 */
export function getCooldownRemaining(
  playerState: PlayerState | undefined,
  ability: AbilityDefinition,
  turnNumber?: number
): number {
  const cooldown = getActivationCooldown(ability);
  if (cooldown <= 0) return 0;

  const lastUsed = playerState?.abilityCooldowns?.[ability.id];
  if (typeof lastUsed !== 'number' || !Number.isFinite(lastUsed)) return 0;
  if (typeof turnNumber !== 'number' || !Number.isFinite(turnNumber)) return 0;

  const elapsed = turnNumber - lastUsed;
  if (elapsed < 0) return cooldown; // rewind safety: treat future stamps as spent
  return Math.max(0, cooldown - elapsed);
}

export function resolveResourceDisplayName(
  rpgSystem: { resources?: { id: string; name?: string }[] } | undefined,
  resourceId: string,
  isFa = false
): string {
  const def = (rpgSystem?.resources ?? []).find(
    (r) => r?.id?.toLowerCase() === resourceId.toLowerCase()
  );
  const name = (def?.name ?? '').trim();
  if (name) return name;
  // Familiar pools get Persian display names so block messages never leak a
  // raw `snake_case` id into the UI.
  const key = resourceId.trim().toLowerCase();
  if (isFa) {
    if (key === 'mana') return 'مانا';
    if (key === 'stamina') return 'استقامت';
    if (key === 'health' || key === 'hp') return 'سلامتی';
    if (key === 'resolve') return 'عزم';
  }
  return resourceId;
}

/**
 * Deterministic pre-roll validation of an explicit ability invocation.
 * The route uses this to reject unaffordable / on-cooldown requests before any
 * dice are thrown and before any model tokens are spent.
 */
export function validateAbilityInvocation(
  playerState: PlayerState | undefined,
  rpgSystem: { abilities?: AbilityDefinition[]; resources?: { id: string; name?: string }[] } | undefined,
  abilityId: string,
  turnNumber?: number
): AbilityInvocationValidation {
  const ability = (rpgSystem?.abilities ?? []).find(
    (a) => a.id === abilityId || a.name === abilityId
  );

  if (!ability) {
    return {
      ok: false,
      code: 'unknown',
      reasonEn: `Unknown ability "${abilityId}".`,
      reasonFa: `توانایی «${abilityId}» در این سرگذشت تعریف نشده است.`,
    };
  }

  const name = abilityDisplayName(ability);
  const learned = (playerState?.abilities ?? []).some((id) => id === ability.id || id === name);
  if (!learned) {
    return {
      ok: false,
      ability,
      code: 'not_learned',
      reasonEn: `You have not learned "${name}" yet.`,
      reasonFa: `هنوز «${name}» را نیاموخته‌اید.`,
    };
  }

  if (!isActiveAbility(ability)) {
    return {
      ok: false,
      ability,
      code: 'not_active',
      reasonEn: `"${name}" is a passive ability and always applies on its own.`,
      reasonFa: `«${name}» توانایی غیرفعال است و خودبه‌خود اثر می‌گذارد.`,
    };
  }

  const remaining = getCooldownRemaining(playerState, ability, turnNumber);
  if (remaining > 0) {
    return {
      ok: false,
      ability,
      code: 'cooldown',
      reasonEn: `"${name}" is recharging — ${remaining} more turn(s).`,
      reasonFa: `«${name}» در حال بازیابی است — ${remaining} نوبت دیگر.`,
    };
  }

  const cost = getActivationCost(ability);
  if (cost) {
    const current = Number(playerState?.resources?.[cost.targetResourceId] ?? 0);
    if (current < cost.amount) {
      const resourceEn = resolveResourceDisplayName(rpgSystem, cost.targetResourceId, false);
      const resourceFa = resolveResourceDisplayName(rpgSystem, cost.targetResourceId, true);
      return {
        ok: false,
        ability,
        code: 'insufficient',
        reasonEn: `Not enough ${resourceEn} to invoke "${name}" (needs ${cost.amount}, has ${current}).`,
        reasonFa: `${resourceFa} کافی برای اجرای «${name}» ندارید (نیاز ${cost.amount}، موجود ${current}).`,
      };
    }
  }

  return { ok: true, ability };
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates every structured roll modifier the character currently benefits
 * from (or suffers), for the check being resolved.
 *
 * Legacy prose-only abilities are deliberately NOT handled here — they remain
 * the responsibility of `evaluatePassiveAbilities`, which is skipped for any
 * ability carrying `rollModifiers` so nothing is double-counted.
 */
export function evaluateAbilityEffects(ctx: AbilityEffectContext): AbilityEffectResult {
  const result: AbilityEffectResult = { totalModifier: 0, contributions: [] };
  const playerState = ctx.playerState;
  const abilities: AbilityDefinition[] = ctx.rpgSystem?.abilities ?? [];
  const lowerAction = (ctx.actionText || '').toLowerCase();

  const push = (
    source: RollModifierContribution['source'],
    spec: RollModifierSpec,
    ownerId: string,
    ownerName: string
  ) => {
    result.totalModifier += spec.modifier;
    const fallback = `${spec.modifier >= 0 ? '+' : ''}${spec.modifier} ${ownerName}`;
    result.contributions.push({
      source,
      id: ownerId,
      name: ownerName,
      modifier: spec.modifier,
      reasonEn: spec.labelEn?.trim() || fallback,
      reasonFa: spec.labelFa?.trim() || fallback,
    });
  };

  // --- Active ability invoked this turn -----------------------------------
  // When the caller did not name one explicitly, fall back to deterministic
  // free-text detection so the evaluator is usable standalone (tests, evals).
  const effectiveInvokedAbilityId =
    ctx.invokedAbilityId ??
    detectInvokedAbility(ctx.actionText, playerState, ctx.rpgSystem, ctx.turnNumber)?.id;
  if (effectiveInvokedAbilityId) {
    const validation = validateAbilityInvocation(
      playerState,
      ctx.rpgSystem,
      effectiveInvokedAbilityId,
      ctx.turnNumber
    );

    if (!validation.ok) {
      result.blocked = validation;
    } else {
      const ability = validation.ability!;
      result.invocation = {
        abilityId: ability.id,
        abilityName: abilityDisplayName(ability),
        cost: getActivationCost(ability),
        cooldownTurns: getActivationCooldown(ability),
      };

      const ownerName = abilityDisplayName(ability);
      const ownerMentioned = isOwnerMentioned(lowerAction, ability.id, ability.name);
      for (const spec of ability.activation?.effects ?? []) {
        if (matchesRollSpec(spec, { ...ctx, playerState, lowerAction, ownerMentioned })) {
          push('active', spec, ability.id, ownerName);
        }
      }
    }
  }

  // --- Learned passive abilities ------------------------------------------
  for (const ownedId of playerState?.abilities ?? []) {
    const ability = abilities.find((a) => a.id === ownedId || a.name === ownedId);
    if (!ability || isActiveAbility(ability)) continue;

    const specs = ability.rollModifiers ?? [];
    if (specs.length === 0) continue;

    const ownerName = abilityDisplayName(ability);
    const ownerMentioned = isOwnerMentioned(lowerAction, ability.id, ability.name);
    for (const spec of specs) {
      if (matchesRollSpec(spec, { ...ctx, playerState, lowerAction, ownerMentioned })) {
        push('passive', spec, ability.id, ownerName);
      }
    }
  }

  // --- Background traits (always on) --------------------------------------
  for (const traitId of resolveTraitIds(playerState, ctx.rpgSystem)) {
    const trait = findTraitDefinition(traitId, ctx.rpgSystem);
    if (!trait) continue;

    const specs = trait.rollModifiers ?? [];
    if (specs.length === 0) continue;

    const ownerName = traitDisplayName(trait);
    const ownerMentioned = isOwnerMentioned(lowerAction, trait.id, trait.name);
    for (const spec of specs) {
      if (matchesRollSpec(spec, { ...ctx, playerState, lowerAction, ownerMentioned })) {
        push('trait', spec, trait.id, ownerName);
      }
    }
  }

  return result;
}

/**
 * Deterministic auto-detection of an invoked active ability from free-text
 * play, used when the client does not send an explicit `abilityId`.
 *
 * Only abilities the character has learned are considered, and only when the
 * invocation could actually succeed — a player who merely *mentions* a spell
 * they cannot yet afford must not have their action hijacked or rejected.
 *
 * Longest name match wins so "Shadow Step II" is preferred over "Shadow Step".
 */
export function detectInvokedAbility(
  actionText: string,
  playerState?: PlayerState,
  rpgSystem?: { abilities?: AbilityDefinition[] },
  turnNumber?: number
): AbilityDefinition | null {
  const lowerAction = (actionText || '').toLowerCase();
  if (!lowerAction) return null;

  const candidates: AbilityDefinition[] = [];
  for (const ownedId of playerState?.abilities ?? []) {
    const ability = (rpgSystem?.abilities ?? []).find(
      (a) => a.id === ownedId || a.name === ownedId
    );
    if (!ability || !isActiveAbility(ability)) continue;
    if (!isOwnerMentioned(lowerAction, ability.id, ability.name)) continue;
    candidates.push(ability);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => abilityDisplayName(b).length - abilityDisplayName(a).length);

  for (const ability of candidates) {
    const validation = validateAbilityInvocation(playerState, rpgSystem, ability.id, turnNumber);
    if (validation.ok) return ability;
  }
  return null;
}

