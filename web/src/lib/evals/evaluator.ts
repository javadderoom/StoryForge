import { RawSceneData } from '@/lib/engines/narrative/modelCall';
import { normalizeChoices } from '@/lib/providers/GeminiAdapter';
import { EvalExpectations, EvalFinding, HeuristicReport, HeuristicStats } from './types';

/**
 * Plan 14 — Tier 3 Layer A: deterministic heuristic rule checker.
 *
 * CRITICAL: every assertion is evaluated against the RAW model payload
 * (`raw.choices` / `raw.narrative`), NOT the normalized `ChoiceOption[]`.
 * `normalizeChoices` coerces and rescues output, so asserting on normalized
 * choices would pass even when the model produced garbage. Repairs the
 * normalizer had to make are reported separately as `rescuedChoices`.
 */

const SUCCESS_WORDS = /triumph|victor|effortless|flawless|prevail|easily overcame|پیروزی|ظفر|آسان|بی‌نقص/i;
const FAILURE_WORDS = /fail|fumble|disaster|collapse|overwhelm|defeat|شکست|نافرجام|فاجعه|مغلوب/i;
const MEMORIAL_PATTERN = /in memory|slain|fallen|grave|once |late |memory of|یاد|مزار|کشته|فقید|مرحوم/i;
const HOSTILE_PROSE =
  /weapon|sword|blade|spear|shield|crossbow|longbow|rifle|musket|pistol|drawn|drew|leveled|raised|hostile|sentry|guard|standoff|سلاح|شمشیر|تیغ|نیزه|سپر|گزمه|نگهبان|پاسبان|کمان|تفنگ|خنجر/i;

/**
 * True when prose depicts drawn weapons or hostile actors — the precondition for
 * the "no diceless choices" invariant. Exported so real-story harnesses apply
 * the identical detector instead of duplicating the pattern.
 */
export function hasHostileActors(prose: string): boolean {
  return HOSTILE_PROSE.test(prose ?? '');
}
const PREBAKED_OUTCOME =
  /\b(in order to|so that|to find|to escape|you escape|you safely|you succeed|manage to|successfully)\b|تا اینکه|تا بتوانی|موفق می‌شوی|فرار می‌کنی|سالم می‌رسی/i;

/** Extract the stat field from a raw choice in any supported key shape. */
export function rawStatValue(c: unknown): string | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const r = c as Record<string, unknown>;
  const check = r.check && typeof r.check === 'object' ? (r.check as Record<string, unknown>) : undefined;
  const v =
    (r.requiredStatId as string) ||
    (r.required_stat_id as string) ||
    (r.statId as string) ||
    (r.stat_id as string) ||
    (typeof r.stat === 'string' ? (r.stat as string) : '') ||
    (typeof check?.stat === 'string' ? (check.stat as string) : '');
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Extract a raw DC if the model stated one (numeric only). */
export function rawDcValue(c: unknown): number | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const r = c as Record<string, unknown>;
  if (typeof r.targetDC === 'number') return r.targetDC;
  if (typeof r.target_dc === 'number') return r.target_dc;
  return undefined;
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).length;
}

/** A raw choice is diceless when the model declared neither a stat nor a DC. */
function isRawDiceless(c: unknown): boolean {
  if (!c || typeof c !== 'object') return true;
  const r = c as Record<string, unknown>;
  if (rawStatValue(c) || rawDcValue(c) !== undefined) return false;
  return r.riskLevel !== 'high';
}

export interface EvaluateOptions {
  expectations: EvalExpectations;
  validStatIds: string[];
  isEnglish: boolean;
  isLowBase?: boolean;
}

/**
 * Runs the deterministic Layer-A rules over a raw model payload.
 * Returns a pass/fail report plus the stats shown in the CLI/Studio bench.
 */
export function evaluateRawScene(raw: RawSceneData, opts: EvaluateOptions): HeuristicReport {
  const { expectations: exp, validStatIds, isEnglish, isLowBase = false } = opts;
  const findings: EvalFinding[] = [];

  const prose = typeof raw?.narrative === 'string' ? raw.narrative : '';
  const rawChoices: unknown[] = Array.isArray(raw?.choices) ? (raw.choices as unknown[]) : [];

  // --- Schema integrity ---------------------------------------------------
  if (!Array.isArray(raw?.choices)) {
    findings.push({ severity: 'error', rule: 'schema.choices', detail: 'Raw output has no choices array.' });
  }
  if (!prose.trim()) {
    findings.push({ severity: 'error', rule: 'schema.narrative', detail: 'Raw output has no narrative prose.' });
  }

  const normalized = normalizeChoices(raw?.choices, validStatIds, isEnglish, isLowBase);

  // --- Panel shape --------------------------------------------------------
  const minChoices = exp.minChoices ?? 2;
  const maxChoices = exp.maxChoices ?? 4;
  if (normalized.length < minChoices || normalized.length > maxChoices) {
    findings.push({
      severity: 'error',
      rule: 'choices.count',
      detail: `Panel has ${normalized.length} choices; expected ${minChoices}-${maxChoices}.`,
    });
  }

  // --- Standoff safety net (RAW intent, not normalized) -------------------
  // Shared absolute-bound DC check. Low-base-relative bands are a separate
  // optional contract applied only when the run is low-base and declared.
  const checkDc = (i: number, dc: number, rc: unknown) => {
    const choiceRisk =
      rc && typeof rc === 'object' && typeof (rc as Record<string, unknown>).riskLevel === 'string'
        ? String((rc as Record<string, unknown>).riskLevel)
        : 'medium';
    const lowBand = isLowBase
      ? exp.lowBaseDcBand?.[choiceRisk as 'low' | 'medium' | 'high'] ??
        exp.lowBaseDcBand?.medium
      : undefined;
    if (lowBand && (dc < lowBand[0] || dc > lowBand[1])) {
      findings.push({
        severity: 'error',
        rule: 'choices.dc_range',
        detail: `Choice ${i + 1} DC ${dc} outside low-base ${choiceRisk} band ${lowBand[0]}-${lowBand[1]}.`,
      });
      return;
    }
    if (exp.minDc !== undefined && dc < exp.minDc) {
      findings.push({
        severity: 'error',
        rule: 'dc.too_low',
        detail: `Choice ${i + 1} DC ${dc} is below the calibrated floor of ${exp.minDc}.`,
      });
    }
    if (exp.maxDc !== undefined && dc > exp.maxDc) {
      findings.push({
        severity: 'error',
        rule: 'dc.too_high',
        detail: `Choice ${i + 1} DC ${dc} exceeds the calibrated ceiling of ${exp.maxDc}.`,
      });
    }
  };

  const dicelessCount = rawChoices.filter(isRawDiceless).length;
  const requiresChecks = exp.requireNoDiceless ?? false;
  const hostileScene = HOSTILE_PROSE.test(prose);
  if (requiresChecks && dicelessCount > 0) {
    findings.push({
      severity: 'error',
      rule: 'standoff.diceless',
      detail: `${dicelessCount} raw choice(s) were diceless${hostileScene ? ' in a scene with drawn weapons / hostile actors' : ''}.`,
    });
  }

  // --- Stat whitelist + DC calibration (RAW values) ----------------------
  const allowed = new Set((exp.allowedStatIds ?? validStatIds).map((s) => s.toLowerCase()));
  const checkedDcs: number[] = [];
  let rescuedChoices = 0;

  rawChoices.slice(0, maxChoices).forEach((rc, i) => {
    const stat = rawStatValue(rc);
    const dc = rawDcValue(rc);
    const wasRawDiceless = isRawDiceless(rc);
    const normalizedHasCheck = Boolean(normalized[i]?.requiredStatId);
    if (wasRawDiceless && normalizedHasCheck) rescuedChoices++;

    if (stat && !allowed.has(stat.toLowerCase())) {
      findings.push({
        severity: 'warning',
        rule: 'stat.whitelist',
        detail: `Choice ${i + 1} uses stat "${stat}" outside the active system (${[...allowed].join(', ')}).`,
      });
    }

    if (stat || dc !== undefined) {
      if (dc === undefined) {
        findings.push({
          severity: 'warning',
          rule: 'dc.missing_from_model',
          detail: `Choice ${i + 1} declares a stat but no DC; the deterministic normalizer supplied one.`,
        });
      } else {
        checkedDcs.push(dc);
        checkDc(i, dc, rc);
      }
    }
  });

  const outcome = exp.outcome;
  if (outcome === 'failure' || outcome === 'critical_failure') {
    if (SUCCESS_WORDS.test(prose) && !FAILURE_WORDS.test(prose)) {
      findings.push({
        severity: 'error',
        rule: 'outcome.mismatch',
        detail: `Outcome is ${outcome} but the prose reads triumphant.`,
      });
    }
  } else if (outcome === 'success' || outcome === 'critical_success') {
    if (FAILURE_WORDS.test(prose) && !SUCCESS_WORDS.test(prose)) {
      findings.push({
        severity: 'error',
        rule: 'outcome.mismatch',
        detail: `Outcome is ${outcome} but the prose reads disastrous.`,
      });
    }
  }

  // --- Forbidden words ----------------------------------------------------
  for (const w of exp.forbiddenWords ?? []) {
    if (new RegExp(w, 'i').test(prose)) {
      findings.push({ severity: 'error', rule: 'prose.forbidden_word', detail: `Prose contains banned wording: ${w}` });
    }
  }

  // --- Dead NPCs must not act alive --------------------------------------
  for (const name of exp.forbiddenAliveNames ?? []) {
    if (name.length >= 3 && prose.toLowerCase().includes(name.toLowerCase()) && !MEMORIAL_PATTERN.test(prose)) {
      findings.push({
        severity: 'error',
        rule: 'canon.resurrection',
        detail: `"${name}" is dead/missing per ledger but appears alive in prose.`,
      });
    }
  }

  // --- Consequence echo (opening responsiveness) --------------------------
  if (exp.requireConsequenceEcho && !prose.toLowerCase().includes(exp.requireConsequenceEcho.toLowerCase())) {
    findings.push({
      severity: 'warning',
      rule: 'prose.consequence_echo',
      detail: `Prose does not reference the resolved consequence ("${exp.requireConsequenceEcho}").`,
    });
  }

  // --- Persian dialogue quoting ------------------------------------------
  if (exp.requirePersianQuotes && !(prose.includes('«') && prose.includes('»'))) {
    findings.push({
      severity: 'error',
      rule: 'prose.persian_quotes',
      detail: 'Direct speech was expected to use «...» quoting but none was found.',
    });
  }

  // --- Atomicity / no pre-baked outcomes ---------------------------------
  for (const [i, rc] of rawChoices.slice(0, maxChoices).entries()) {
    const text = rc && typeof rc === 'object' ? String((rc as Record<string, unknown>).text ?? '') : '';
    if (PREBAKED_OUTCOME.test(text)) {
      findings.push({
        severity: 'warning',
        rule: 'choices.prebaked_outcome',
        detail: `Choice ${i + 1} pre-bakes an outcome instead of stating an action: "${text}"`,
      });
    }
  }

  // --- Prose length -------------------------------------------------------
  const wordCount = countWords(prose);
  if (exp.minWords !== undefined && wordCount < exp.minWords) {
    findings.push({ severity: 'warning', rule: 'prose.too_short', detail: `Prose is ${wordCount} words (< ${exp.minWords}).` });
  }
  if (exp.maxWords !== undefined && wordCount > exp.maxWords) {
    findings.push({ severity: 'warning', rule: 'prose.too_long', detail: `Prose is ${wordCount} words (> ${exp.maxWords}).` });
  }

  const stats: HeuristicStats = {
    choiceCount: normalized.length,
    dicelessCount,
    wordCount,
    checkedDcs,
    rescuedChoices,
  };

  return { passed: !findings.some((f) => f.severity === 'error'), findings, stats };
}


