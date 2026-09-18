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

/** Stock filler and cliché phrases that degrade literary quality. */
export const STOCK_CLICHE_PATTERNS = [
  // English
  /\b(the\s+choice\s+is\s+yours|a\s+choice\s+(lies|stands)\s+before\s+you|what\s+will\s+you\s+do\??)\b/i,
  /\b(little\s+did\s+(you|he|she)\s+know)\b/i,
  /\b(a\s+chill\s+ran\s+down\s+(your|his|her)\s+spine)\b/i,
  /\b(the\s+air\s+(grew|turned|was)\s+thick\s+with\s+tension)\b/i,
  /\b(an\s+eerie\s+silence\s+(fell|hung|settled))\b/i,
  /\b(shadows\s+danced\s+across\s+the\s+walls?)\b/i,
  // Persian
  /(تصمیم|انتخاب)\s+با\s+(تو|شما)ست/i,
  /چه\s+(خواهی\s+کرد|تصمیمی\s+می‌گیری)\??/i,
  /سکوت\s+(سنگین|مرگبار)ی\s+(حاکم|حکمفرما)\s+شد/i,
  /گویی\s+زمان\s+متوقف\s+شده\s+بود/i,
  /لرزه‌ای\s+بر\s+اندامت\s+افتاد/i,
];

/** Sensory grounding patterns (smell, sound, tactile texture, lighting). */
export const SENSORY_PATTERNS = [
  /\b(smell|odor|scent|reek|perfume|resin|stench|fragrance|brine)\b|بوی|رایحه|عطر|تعفن|بوی نم/i,
  /\b(sound|echo|groan|screech|whisper|crunch|splash|clang|creak|rasp|scrape)\b|صدای|پژواک|غرش|خش‌خش|فریاد|طنین/i,
  /\b(cold|frost|ice|damp|sweat|grit|rough|slick|sharp|burning|chill|freeze|warmth)\b|گرم|سرد|یخ|رطوبت|عرق|زبر|تیز|خنک/i,
  /\b(flicker|shadow|gleam|glint|murk|glow|dim|blinding|pallor)\b|درخشش|سایه|کم‌سو|تاریک|روشنایی|تلألو/i,
];

/** Calculate pairwise token Jaccard similarity to detect semantic clone choices. */
export function choiceTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/[\s,.;:!?«»"']+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/[\s,.;:!?«»"']+/).filter((w) => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  const union = wordsA.size + wordsB.size - matches;
  return union > 0 ? matches / union : 0;
}

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

  // --- Choice Semantic & Tactical Diversity -------------------------------
  const styles = new Set<string>();
  const choiceTexts: string[] = [];
  for (const rc of rawChoices.slice(0, maxChoices)) {
    if (rc && typeof rc === 'object') {
      const r = rc as Record<string, unknown>;
      if (typeof r.style === 'string' && r.style.trim()) styles.add(r.style.trim().toLowerCase());
      if (typeof r.text === 'string' && r.text.trim()) choiceTexts.push(r.text.trim());
    }
  }

  if (rawChoices.length >= 3 && styles.size === 1) {
    findings.push({
      severity: exp.requireDivergentChoices ? 'error' : 'warning',
      rule: 'choices.style_monopoly',
      detail: `All ${rawChoices.length} choices share the single style "${[...styles][0]}"; choices should span distinct tactical philosophies.`,
    });
  }

  for (let i = 0; i < choiceTexts.length; i++) {
    for (let j = i + 1; j < choiceTexts.length; j++) {
      const sim = choiceTextSimilarity(choiceTexts[i], choiceTexts[j]);
      if (sim >= 0.7) {
        findings.push({
          severity: exp.requireDivergentChoices ? 'error' : 'warning',
          rule: 'choices.near_duplicate',
          detail: `Choice ${i + 1} and Choice ${j + 1} have high text overlap (${Math.round(sim * 100)}%): "${choiceTexts[i]}" vs "${choiceTexts[j]}".`,
        });
      }
    }
  }

  // --- Cliché & Filler Detection ------------------------------------------
  for (const pattern of STOCK_CLICHE_PATTERNS) {
    const match = prose.match(pattern);
    if (match) {
      findings.push({
        severity: exp.banCliches ? 'error' : 'warning',
        rule: 'prose.stock_cliche',
        detail: `Prose contains generic stock cliché: "${match[0]}".`,
      });
    }
  }

  // --- Sensory Grounding --------------------------------------------------
  let sensoryAnchorCount = 0;
  for (const sp of SENSORY_PATTERNS) {
    if (sp.test(prose)) sensoryAnchorCount++;
  }
  if (exp.requireSensoryDetail && sensoryAnchorCount === 0) {
    findings.push({
      severity: 'warning',
      rule: 'prose.lacks_sensory_detail',
      detail: 'Prose lacks sensory immersion anchors (smell, sound, tactile texture, or visual lighting).',
    });
  }

  const stats: HeuristicStats = {
    choiceCount: normalized.length,
    dicelessCount,
    wordCount,
    checkedDcs,
    rescuedChoices,
    sensoryAnchorCount,
  };

  return { passed: !findings.some((f) => f.severity === 'error'), findings, stats };
}


