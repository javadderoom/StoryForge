import {
  PlayerState,
  PlayerConditionChanges,
  StateMutationDiff,
} from '@/lib/types/gameplay';
import { RPGSystemSchema } from '@/lib/types/rpg';
import {
  CONDITION_PROSE_PATTERNS,
  closeImplied,
  kindForTag,
  markTreated,
  resolveKind,
  tagForKind,
} from './conditionCatalog';
import { resolveHealthKey, resolveStaminaKey, resolveResourceMax } from './resourcePools';

/**
 * Plan 17 §3.4 — deterministic condition reconciler.
 *
 * Prose is king, state is authoritative: this module reads the scene the
 * writer just produced (plus its declared condition changes) and derives the
 * minimal PlayerState diff that makes the status bar agree with the story.
 * It never calls a model, never invents mechanical values, and every added
 * tag is grounded in explicit prose evidence or an explicit writer
 * declaration that the prose supports.
 */

export type ConditionFindingType =
  | 'declared_unsupported'
  | 'undeclared_wound'
  | 'removal_unsupported'
  | 'treated'
  | 'healed'
  | 'seeded_baseline'
  | 'conflict';

export interface ConditionFinding {
  type: ConditionFindingType;
  kind: string;
  detail: string;
}

export interface ConditionReconciliation {
  /** Diff to apply via applyStateMutation. Empty object when nothing changed. */
  diff: Pick<StateMutationDiff, 'conditionsAdded' | 'conditionsRemoved' | 'conditions'>;
  /** Final normalized list after reconciliation (for response transparency). */
  conditions: string[];
  /** Telemetry: dropped declarations, inferred wounds, treatments, conflicts. */
  findings: ConditionFinding[];
}

export interface ConditionReconcileInput {
  prose: string;
  declared?: PlayerConditionChanges | null;
  /** Conditions BEFORE this turn's mechanical mutation (wound-history check). */
  previousConditions?: string[];
  /** Player state AFTER this turn's mechanical mutation (authoritative canvas). */
  playerState: PlayerState;
  resolution?: {
    outcome?: string;
    resourceChanges?: Record<string, number> | null;
    /** From actionCheckEngine.isBodilyRiskAction for this turn's action. */
    bodilyRisk?: boolean;
  };
  rpgSystem?: RPGSystemSchema | any;
  /** Reserved for future language-specific heuristics; patterns are bilingual. */
  language?: string;
}

const BODY_KINDS = new Set(['wounded', 'bleeding', 'exhausted', 'thirsty', 'poisoned']);

function isBodyTag(tag: string): boolean {
  const def = kindForTag(tag);
  if (def) return BODY_KINDS.has(def.kind);
  // Unknown tags never count as body conditions — they are custom/situational.
  return false;
}

/** Sentence-level split used for negation scoping. */
function splitSentences(prose: string): string[] {
  return (prose || '')
    .split(/[.!?؟…\n؛;:،,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EXPLICIT_WOUND_PATTERN =
  /\b(gash(?:ed|es|ing)?|wound(?:ed|s)?|lacerat(?:e|ed|es|ion|ing)|stab(?:bed|s|bing)?|slash(?:ed|es|ing)?|deep cut|fractur(?:e|ed)|broken (?:arm|leg|rib|bone))\b|(زخم|جراحت|شکاف|بریدگ|مجروح|شکستگ)/i;

interface ProseEvidence {
  /** Sentences free of negation markers — the only ones evidence reads from. */
  positiveSentences: string[];
  wound: boolean;
  /** A named/literal injury (or bleeding) rather than a soft marker like limp. */
  explicitWound: boolean;
  bleeding: boolean;
  treatment: boolean;
  healing: boolean;
  poison: boolean;
  exhaustion: boolean;
  thirst: boolean;
  daze: boolean;
  shock: boolean;
  /** A sentence tying a wound word to a healing word (prose-only healing). */
  healedWoundSentence: string | null;
}

function extractEvidence(prose: string): ProseEvidence {
  const sentences = splitSentences(prose);
  const positive = sentences.filter((s) => !CONDITION_PROSE_PATTERNS.negation.test(s));

  const any = (re: RegExp) => positive.some((s) => re.test(s));
  const bleeding = any(CONDITION_PROSE_PATTERNS.bleeding);
  const wound = any(CONDITION_PROSE_PATTERNS.wound);
  // A named/literal wound word or visible bleeding is strong evidence; a bare
  // limp/bruise is weak (narrative-only unless the mechanics hurt the player).
  const explicitWound = bleeding || positive.some((s) => EXPLICIT_WOUND_PATTERN.test(s));

  const healedWoundSentence =
    positive.find(
      (s) =>
        CONDITION_PROSE_PATTERNS.healing.test(s) && CONDITION_PROSE_PATTERNS.wound.test(s)
    ) ?? null;

  return {
    positiveSentences: positive,
    wound,
    explicitWound,
    bleeding,
    treatment: any(CONDITION_PROSE_PATTERNS.treatment),
    healing: any(CONDITION_PROSE_PATTERNS.healing),
    poison: any(CONDITION_PROSE_PATTERNS.poison),
    exhaustion: any(CONDITION_PROSE_PATTERNS.exhaustion),
    thirst: any(CONDITION_PROSE_PATTERNS.thirst),
    daze: any(CONDITION_PROSE_PATTERNS.daze),
    shock: any(CONDITION_PROSE_PATTERNS.shock),
    healedWoundSentence,
  };
}

/** kind → whether this turn's prose supports it. */
function isEvidenced(kind: string, evidence: ProseEvidence): boolean {
  switch (kind) {
    case 'wounded':
      return evidence.wound;
    case 'bleeding':
      return evidence.bleeding;
    case 'poisoned':
      return evidence.poison;
    case 'exhausted':
      return evidence.exhaustion;
    case 'thirsty':
      return evidence.thirst;
    case 'dazed':
      return evidence.daze;
    case 'shaken':
      return evidence.shock;
    case 'baseline':
      return true;
    default:
      // Custom kinds have no pattern vocabulary; the writer's declaration is
      // the only available evidence and is honored verbatim.
      return true;
  }
}

function hasTagLike(tags: string[], kind: string): boolean {
  return tags.some((t) => kindForTag(t)?.kind === kind);
}

function removeKind(tags: string[], kind: string): string[] {
  return tags.filter((t) => kindForTag(t)?.kind !== kind);
}

function ratios(state: PlayerState, rpgSystem?: RPGSystemSchema | any) {
  const healthKey = resolveHealthKey(rpgSystem);
  const staminaKey = resolveStaminaKey(rpgSystem);
  const hp = state.resources?.[healthKey];
  const hpMax = state.maxResources?.[healthKey] ?? resolveResourceMax(healthKey, rpgSystem, state);
  const st = state.resources?.[staminaKey];
  const stMax = state.maxResources?.[staminaKey] ?? resolveResourceMax(staminaKey, rpgSystem, state);
  return {
    hpRatio: typeof hp === 'number' && hpMax > 0 ? hp / hpMax : 1,
    staminaRatio: typeof st === 'number' && stMax > 0 ? st / stMax : 1,
    hasStaminaPool: typeof st === 'number',
  };
}

export function reconcileConditions(input: ConditionReconcileInput): ConditionReconciliation {
  const {
    prose,
    declared,
    previousConditions = [],
    playerState,
    resolution,
    rpgSystem,
  } = input;

  const current = Array.isArray(playerState.conditions) ? [...playerState.conditions] : [];
  let working = [...current];
  const findings: ConditionFinding[] = [];
  const evidence = extractEvidence(prose);

  const declaredAdds = declared?.add ?? [];
  const declaredTreats = declared?.treat ?? [];
  const declaredRemoves = declared?.remove ?? [];

  // -------------------------------------------------------------------------
  // 1. Declared adds — evidence-gated.
  // -------------------------------------------------------------------------
  for (const entry of declaredAdds) {
    const def = resolveKind(entry.kind ?? '');
    if (!isEvidenced(def.kind, evidence)) {
      findings.push({
        type: 'declared_unsupported',
        kind: def.kind,
        detail: `writer declared "${entry.kind}" but the prose shows no supporting evidence`,
      });
      continue;
    }
    if (def.kind === 'baseline') continue; // baseline upkeep owns this tag
    const tag = def.tag;
    if (!working.includes(tag)) working.push(tag);
  }

  // -------------------------------------------------------------------------
  // 2. Undeclared wound inference (mechanical cost or explicit prose).
  // -------------------------------------------------------------------------
  const healthKey = resolveHealthKey(rpgSystem);
  const hpDelta = resolution?.resourceChanges?.[healthKey] ?? 0;
  const mechanicalHarm = hpDelta < 0;
  const bodilyOutcome =
    (resolution?.outcome === 'mixed_success' || resolution?.outcome === 'failure') &&
    resolution?.bodilyRisk === true;

  const declaredWound = declaredAdds.some((e) => resolveKind(e.kind ?? '').kind === 'wounded');
  const declaredBleed = declaredAdds.some((e) => resolveKind(e.kind ?? '').kind === 'bleeding');

  if (!declaredWound && !hasTagLike(working, 'wounded')) {
    if (evidence.wound && (mechanicalHarm || bodilyOutcome)) {
      working.push(tagForKind('wounded'));
      findings.push({
        type: 'undeclared_wound',
        kind: 'wounded',
        detail: mechanicalHarm
          ? `prose shows an injury while the turn cost health (${hpDelta}); wound recorded`
          : 'bodily-risk failure narrated an injury; wound recorded',
      });
    } else if (evidence.wound && evidence.explicitWound) {
      working.push(tagForKind('wounded'));
      findings.push({
        type: 'undeclared_wound',
        kind: 'wounded',
        detail: 'explicit injury in prose with little mechanical cost; wound recorded',
      });
    } else if (evidence.wound) {
      findings.push({
        type: 'undeclared_wound',
        kind: 'wounded',
        detail: 'weak wound wording without mechanical cost; kept as narrative only',
      });
    }
  }
  if (!declaredBleed && evidence.bleeding && !hasTagLike(working, 'bleeding')) {
    working.push(tagForKind('bleeding'));
    findings.push({
      type: 'undeclared_wound',
      kind: 'bleeding',
      detail: 'prose shows active bleeding; bleeding recorded',
    });
  }

  // -------------------------------------------------------------------------
  // 3. Declared treats — convert to treated variants, stop bleeding.
  // -------------------------------------------------------------------------
  for (const entry of declaredTreats) {
    const def = resolveKind(entry.kind ?? '');
    const treatmentEvidence =
      def.kind === 'poisoned' ? evidence.poison || evidence.treatment : evidence.treatment;

    if (!treatmentEvidence) {
      findings.push({
        type: 'declared_unsupported',
        kind: def.kind,
        detail: `writer declared treatment of "${entry.kind}" but the prose shows no treatment`,
      });
      continue;
    }

    if (def.kind === 'bleeding') {
      if (hasTagLike(working, 'bleeding')) {
        working = removeKind(working, 'bleeding');
        findings.push({ type: 'treated', kind: 'bleeding', detail: 'bleeding stopped by treatment' });
      }
      continue;
    }

    // Wounded / poisoned / custom: swap the untreated tag for its treated form.
    const untreated = working.find((t) => {
      const d = kindForTag(t);
      return d?.kind === def.kind && d.treatedTag !== t;
    });
    if (untreated) {
      const treatedTag = markTreated(untreated);
      working = working.map((t) => (t === untreated ? treatedTag : t));
      // A treated wound is no longer bleeding, and bleeding cannot exist
      // without a wound (closure would revive it otherwise).
      working = removeKind(working, 'bleeding');
      findings.push({
        type: 'treated',
        kind: def.kind,
        detail: `"${untreated}" → "${treatedTag}"${entry.method ? ` (${entry.method})` : ''}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. Declared removes — healing-gated.
  // -------------------------------------------------------------------------
  for (const entry of declaredRemoves) {
    const def = resolveKind(entry.kind ?? '');
    const present = hasTagLike(working, def.kind);
    if (!present) continue; // nothing to remove

    const supported =
      def.kind === 'bleeding' ? evidence.healing || evidence.treatment : evidence.healing;
    if (!supported) {
      findings.push({
        type: 'removal_unsupported',
        kind: def.kind,
        detail: `writer removed "${entry.kind}" without healing prose; kept`,
      });
      continue;
    }

    working = removeKind(working, def.kind);
    if (def.kind === 'wounded') working = removeKind(working, 'bleeding');
    findings.push({
      type: 'healed',
      kind: def.kind,
      detail: `"${entry.kind}" removed${entry.reason ? ` (${entry.reason})` : ''}`,
    });
  }

  // -------------------------------------------------------------------------
  // 5. Prose-first conflict repair: the story healed an old wound the writer
  //    forgot to declare.
  // -------------------------------------------------------------------------
  const declaredTouchesWounds = [...declaredAdds, ...declaredTreats, ...declaredRemoves].some(
    (e) => {
      const k = resolveKind(e.kind ?? '').kind;
      return k === 'wounded' || k === 'bleeding';
    }
  );
  const hadOldWound = previousConditions.some((t) => {
    const d = kindForTag(t);
    return d?.kind === 'wounded' && d.treatedTag !== t;
  });
  if (!declaredTouchesWounds && hadOldWound && evidence.healedWoundSentence) {
    working = removeKind(working, 'wounded');
    working = removeKind(working, 'bleeding');
    findings.push({
      type: 'conflict',
      kind: 'wounded',
      detail: `prose healed the wound without a declared change: "${evidence.healedWoundSentence}"`,
    });
  }

  // -------------------------------------------------------------------------
  // 6. Closure + baseline upkeep.
  // -------------------------------------------------------------------------
  working = closeImplied(working);

  const bodyActive = working.some((t) => isBodyTag(t));
  const { hpRatio, staminaRatio, hasStaminaPool } = ratios(playerState, rpgSystem);
  const baselineTag = tagForKind('baseline');
  const baselineHealthy = hpRatio >= 0.7 && (!hasStaminaPool || staminaRatio >= 0.6);

  if (!bodyActive && baselineHealthy) {
    if (!working.includes(baselineTag)) {
      working.push(baselineTag);
      findings.push({
        type: 'seeded_baseline',
        kind: 'baseline',
        detail: `body clear at hp ${(hpRatio * 100).toFixed(0)}%; baseline restored`,
      });
    }
  } else if (bodyActive) {
    working = working.filter((t) => t !== baselineTag);
  }

  // -------------------------------------------------------------------------
  // 7. Minimal diff.
  // -------------------------------------------------------------------------
  const currentSet = new Set(current);
  const workingSet = new Set(working);
  const conditionsAdded = working.filter((t) => !currentSet.has(t));
  const conditionsRemoved = current.filter((t) => !workingSet.has(t));

  const diff: ConditionReconciliation['diff'] = {};
  if (conditionsAdded.length) diff.conditionsAdded = conditionsAdded;
  if (conditionsRemoved.length) {
    diff.conditionsRemoved = conditionsRemoved;
    // Full overwrite whenever we removed anything: the mechanical
    // auto-derivation must not silently re-add a tag the prose ended
    // (e.g. a heal that left HP low would otherwise revive `زخمی`).
    diff.conditions = working;
  }

  return { diff, conditions: working, findings };
}
