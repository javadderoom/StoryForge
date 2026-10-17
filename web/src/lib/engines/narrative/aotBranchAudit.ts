import type { CheckResolution, ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import type { StoryNpcOverride } from '@/lib/types/story';
import type { WorldBible } from '@/lib/types/world';
import type { ProseFinding } from '@/lib/engines/narrative/ProseValidator';
import { evaluateMomentumHeuristics } from '@/lib/engines/narrative/momentumGuardrail';
import type { SceneSessionTurn } from '@/lib/engines/narrative/narrativeTurn';

/**
 * Plan 15 §2.3 tier 4 (§7.6E) — shadow AOT branch audit ("mistake telemetry").
 *
 * The shadow branch exists to be ANALYZED: catch what the writer (Gemini) got
 * wrong on the pre-written turn BEFORE any of it could ever reach a reader.
 * The generation pipeline already repairs or rejects canon violations; this
 * audit makes the evidence durable per branch:
 *
 *   - what the first draft got wrong (`firstPassFindings`, repair attempts),
 *   - what survived into the served-shape branch (leftover validator findings,
 *     secret echoes in prose, choice hygiene, language slippage, recycling),
 *   - one serving verdict per branch: `rejected` (must never serve) >
 *     `warned` (needs review) > `repaired` (pipeline caught & fixed) > `clean`.
 *
 * Pure module — no DB/Next imports, deterministic checks only. The semantic
 * layer (SubQ LLM judge, §7.6G) lives in `aotBranchJudge.ts`; its findings are
 * folded into this shape via `mergeAotJudgeIntoAudit` and share one verdict
 * math (`computeAotVerdict`).
 */

export type AotAuditSeverity = 'error' | 'warning' | 'info';

export type AotAuditCategory =
  | 'prose_first_pass'
  | 'prose_final'
  | 'secret_leak'
  | 'choice_hygiene'
  | 'language_mismatch'
  | 'momentum_recycling'
  | 'scene_repetition'
  | 'narrative_length'
  | 'row_integrity'
  | 'judge_state'
  | 'judge_outcome'
  | 'judge_coherence'
  | 'judge_voice'
  | 'judge_choice_fit'
  | 'judge_leak'
  | 'judge_meta';

/** Where the signal came from: the shared validator, the sanitizer, this audit, or the §7.6G SubQ judge. */
export type AotAuditSource = 'validator' | 'sanitizer' | 'audit' | 'judge';

/** Serving classification: `clean`/`repaired` are gate-eligible, `warned` needs review, `rejected` is a blocker. */
export type AotBranchVerdict = 'clean' | 'repaired' | 'warned' | 'rejected';

export interface AotAuditFinding {
  severity: AotAuditSeverity;
  category: AotAuditCategory;
  source: AotAuditSource;
  detail: string;
}

export interface AotBranchAuditStats {
  narrativeChars: number;
  choiceCount: number;
  choicesDroppedBySanitizer: number;
  firstPassErrors: number;
  firstPassWarnings: number;
  repairAttempts: number;
  proseRepaired: boolean;
  /** Validator findings still standing on the final draft. */
  leftoverFindings: number;
  /**
   * §7.6G judge telemetry — present only when the SubQ judge pass was enabled
   * for this branch. `judgeSkipped: true` means the pass did not complete
   * (unconfigured / timeout / parse failure), so absence of judge findings
   * must not be read as a clean bill.
   */
  judgeSkipped?: boolean;
  judgeFindings?: number;
  judgeLatencyMs?: number;
  judgeError?: string;
}

export interface AotBranchAudit {
  verdict: AotBranchVerdict;
  findings: AotAuditFinding[];
  stats: AotBranchAuditStats;
}

export interface AotBranchAuditInput {
  storyTitle: string;
  language?: string;
  narrative: string;
  choices: ChoiceOption[];
  resolution: CheckResolution;
  isDiceless: boolean;
  playerActionText: string;
  /** Player state AFTER the branch's deterministic chain (what a tap would persist). */
  playerState: PlayerState;
  worldBible?: WorldBible | null;
  storyNpcOverrides?: Record<string, StoryNpcOverride> | null;
  /** Completed turns up to and including the dwell turn (N), oldest → newest. */
  priorTurns: SceneSessionTurn[];
  /** From `generateValidatedScene`: findings of the first draft, pre-repair. */
  firstPassFindings: ProseFinding[];
  /** From `generateValidatedScene`: findings still standing on the final draft. */
  finalFindings: ProseFinding[];
  proseRepaired: boolean;
  repairAttempts: number;
  choicesDroppedBySanitizer?: number;
}

/**
 * Stopwords mirrored from `ActionValidator`'s secret sanitizer so the prose
 * scan flags the same term shapes the choice scan does.
 */
const SECRET_STOPWORDS = new Set([
  'about', 'their', 'that', 'this', 'with', 'from', 'have', 'has', 'the',
  'and', 'you', 'your', 'will', 'into', 'they', 'them', 'then', 'than',
  'what', 'when', 'know', 'secret', 'secrets',
]);

interface AuditSecretShape {
  id?: string;
  description?: string;
  revealed?: boolean;
}

interface AuditNpcShape {
  id?: string;
  name?: string;
  secrets?: AuditSecretShape[];
}

/**
 * Prose-level echo of an undiscovered secret — the choice sanitizer only
 * guards choices; a leak in the narrative itself would have reached a reader
 * on tap. Mirrors `ActionValidator`'s precision rule (NPC mention + ≥2
 * distinctive terms) to avoid flagging common world nouns.
 */
function secretLeakFindings(input: AotBranchAuditInput): AotAuditFinding[] {
  const out: AotAuditFinding[] = [];
  const text = (input.narrative || '').toLowerCase();
  if (!text) return out;

  const npcs = (input.worldBible?.npcs ?? []) as unknown as AuditNpcShape[];
  for (const npc of npcs) {
    const rel = input.playerState.relationships?.[npc.id ?? ''];
    const knownIds = new Set(rel?.knownSecrets ?? []);
    const secrets: AuditSecretShape[] = [...(npc.secrets ?? [])];
    const overrideSecret = npc.id ? input.storyNpcOverrides?.[npc.id]?.storySecret : undefined;
    if (typeof overrideSecret === 'string' && overrideSecret.trim().length >= 12) {
      secrets.push({ id: `override_secret_${npc.id}`, description: overrideSecret.trim() });
    }

    for (const secret of secrets) {
      const description = (secret.description ?? '').trim();
      if (secret.revealed || (secret.id && knownIds.has(secret.id))) continue;
      if (description.length < 12) continue;

      if (secret.id && text.includes(secret.id.toLowerCase())) {
        out.push({
          severity: 'error',
          category: 'secret_leak',
          source: 'audit',
          detail: `Undiscovered secret id "${secret.id}" (${npc.name ?? npc.id ?? '?'}) appears verbatim in branch prose.`,
        });
        continue;
      }

      const name = (npc.name ?? '').toLowerCase();
      const nameWords = name.split(/[^a-z\u0600-\u06FF]+/).filter((w) => w.length >= 3);
      if (!nameWords.some((w) => text.includes(w))) continue;

      const terms = description
        .toLowerCase()
        .split(/[^a-z\u0600-\u06FF]+/i)
        .filter((w) => w.length >= 5 && !SECRET_STOPWORDS.has(w));
      if (terms.length === 0) continue;
      let hits = 0;
      for (const term of terms) {
        if (text.includes(term)) {
          hits += 1;
          if (hits >= 2) break;
        }
      }
      if (hits >= 2) {
        out.push({
          severity: 'error',
          category: 'secret_leak',
          source: 'audit',
          detail: `Branch prose echoes ${npc.name ?? npc.id ?? 'an NPC'}'s undiscovered secret ("${description.slice(0, 60)}…") — serving the branch would leak it.`,
        });
      }
    }
  }
  return out;
}

function choiceHygieneFindings(choices: ChoiceOption[], dropped: number): AotAuditFinding[] {
  const out: AotAuditFinding[] = [];
  if (choices.length < 2 || choices.length > 4) {
    out.push({
      severity: 'warning',
      category: 'choice_hygiene',
      source: 'audit',
      detail: `Branch offers ${choices.length} choice(s) — a tap-ready branch expects 2–4.`,
    });
  }

  const seen = new Set<string>();
  let fallbackNoted = false;
  for (const choice of choices) {
    const text = typeof choice?.text === 'string' ? choice.text.trim() : '';
    if (!text) {
      out.push({
        severity: 'warning',
        category: 'choice_hygiene',
        source: 'audit',
        detail: `Choice "${choice?.id ?? '?'}" has empty text.`,
      });
    } else {
      const key = text.toLowerCase();
      if (seen.has(key)) {
        out.push({
          severity: 'warning',
          category: 'choice_hygiene',
          source: 'audit',
          detail: `Duplicate choice text: "${text.slice(0, 40)}".`,
        });
      }
      seen.add(key);
    }
    if (!fallbackNoted && typeof choice?.id === 'string' && choice.id.startsWith('choice_fallback')) {
      fallbackNoted = true;
      out.push({
        severity: 'warning',
        category: 'choice_hygiene',
        source: 'sanitizer',
        detail: `Fallback choice "${choice.id}" was injected — the model returned too few usable choices.`,
      });
    }
  }

  if (dropped > 0) {
    out.push({
      severity: 'info',
      category: 'choice_hygiene',
      source: 'sanitizer',
      detail: `${dropped} model choice(s) dropped by the secret sanitizer.`,
    });
  }
  return out;
}

function languageFindings(language: string | undefined, narrative: string): AotAuditFinding[] {
  const declared = (language ?? '').trim();
  if (!declared) return [];
  const persianChars = (narrative.match(/[\u0600-\u06FF]/g) ?? []).length;
  const isFa = /^(fa|persian|farsi)([-_].*)?$/i.test(declared);

  if (isFa) {
    if (narrative.length >= 50 && persianChars < 20) {
      return [{
        severity: 'error',
        category: 'language_mismatch',
        source: 'audit',
        detail: `Story language is Persian but branch prose holds only ${persianChars} Arabic-script character(s) — the writer slipped language.`,
      }];
    }
    return [];
  }

  const letters = narrative.replace(/[^\p{L}]/gu, '').length;
  if (letters >= 80 && persianChars > letters / 2) {
    return [{
      severity: 'error',
      category: 'language_mismatch',
      source: 'audit',
      detail: `Story language is "${declared}" but branch prose is majority Persian script (${persianChars}/${letters} letters).`,
    }];
  }
  return [];
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4)
  );
}

/** Heavy token overlap with the scene on screen = the branch re-stated it instead of continuing it. */
function repetitionFindings(narrative: string, priorTurns: SceneSessionTurn[]): AotAuditFinding[] {
  if (narrative.length < 200) return [];
  const previous = [...(priorTurns ?? [])]
    .reverse()
    .find((t) => typeof t?.narrativeProse === 'string' && t.narrativeProse.length >= 200)
    ?.narrativeProse;
  if (!previous) return [];

  const a = tokenSet(previous);
  const b = tokenSet(narrative);
  if (!a.size || !b.size) return [];
  let intersection = 0;
  for (const word of b) if (a.has(word)) intersection += 1;
  const jaccard = intersection / (a.size + b.size - intersection);
  if (jaccard < 0.7) return [];
  return [{
    severity: 'warning',
    category: 'scene_repetition',
    source: 'audit',
    detail: `Branch prose overlaps the previous scene heavily (${Math.round(jaccard * 100)}% token overlap) — possible re-statement stall.`,
  }];
}

/** Re-runs the pure momentum heuristics on the final branch (same rule the repair loop used). */
function momentumFindings(input: AotBranchAuditInput): AotAuditFinding[] {
  const momentum = evaluateMomentumHeuristics({
    storyTitle: input.storyTitle,
    language: input.language,
    priorScenes: (input.priorTurns ?? [])
      .slice(-2)
      .map((t) => t.narrativeProse)
      .filter((p): p is string => typeof p === 'string' && p.length > 0),
    priorActions: (input.priorTurns ?? [])
      .slice(-4)
      .map((t) => t.playerActionText)
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0),
    playerActionText: input.playerActionText,
    resolution: input.resolution,
    candidateNarrative: input.narrative,
    candidateChoices: (input.choices ?? []).map((c) => ({ id: c.id, text: c.text, style: c.style })),
  });
  if (momentum.ok) return [];
  return [{
    severity: 'warning',
    category: 'momentum_recycling',
    source: 'audit',
    detail: `Momentum heuristic still flags ${momentum.stallingType}${momentum.notes ? `: ${momentum.notes}` : ''}`,
  }];
}

/** The pre-rolled dice is machine-set, but a stored illegal value would corrupt a served tap. */
function integrityFindings(input: AotBranchAuditInput): AotAuditFinding[] {
  if (input.isDiceless) return [];
  const roll = input.resolution?.diceRoll;
  if (typeof roll !== 'number') {
    return [{
      severity: 'error',
      category: 'row_integrity',
      source: 'audit',
      detail: 'Checked branch carries no pre-rolled dice value.',
    }];
  }
  const diceType = input.resolution?.diceType ?? 'd20';
  const [min, max] = diceType === '2d6' ? [2, 12] : diceType === 'd100' ? [1, 100] : [1, 20];
  if (roll < min || roll > max) {
    return [{
      severity: 'error',
      category: 'row_integrity',
      source: 'audit',
      detail: `Pre-rolled ${roll} is out of range for ${diceType} (${min}–${max}).`,
    }];
  }
  return [];
}

/**
 * One verdict math for every audit layer (deterministic §7.6E and the §7.6G
 * judge): an error is a serving blocker, a warning needs review, a spent
 * repair is `repaired`, otherwise `clean`. The judge can only escalate.
 */
export function computeAotVerdict(input: {
  findings: AotAuditFinding[];
  repairAttempts: number;
  proseRepaired: boolean;
}): AotBranchVerdict {
  const hasError = input.findings.some((f) => f.severity === 'error');
  if (hasError) return 'rejected';
  const hasWarning = input.findings.some((f) => f.severity === 'warning');
  if (hasWarning) return 'warned';
  return input.repairAttempts > 0 || input.proseRepaired ? 'repaired' : 'clean';
}

/**
 * Audits one generated shadow branch: mistake telemetry (first draft mistakes,
 * repair spend, surviving findings) plus deterministic checks and a serving
 * verdict. Pure — same input, same report.
 */
export function auditAotBranch(input: AotBranchAuditInput): AotBranchAudit {
  const narrative = input.narrative ?? '';
  const choices = input.choices ?? [];
  const firstPassFindings = input.firstPassFindings ?? [];
  const finalFindings = input.finalFindings ?? [];
  const findings: AotAuditFinding[] = [];

  const firstPassErrors = firstPassFindings.filter((f) => f.severity === 'error').length;
  const firstPassWarnings = firstPassFindings.length - firstPassErrors;

  if (input.repairAttempts > 0) {
    // The first draft's mistakes, kept only when a repair was spent on them
    // (otherwise first pass === final draft and the findings below suffice).
    const finalDetails = new Set(finalFindings.map((f) => f.detail));
    for (const finding of firstPassFindings) {
      if (finalDetails.has(finding.detail)) continue;
      findings.push({
        severity: 'info',
        category: 'prose_first_pass',
        source: 'validator',
        detail: `[first draft] [${finding.category}] ${finding.detail}`,
      });
    }
  }
  for (const finding of finalFindings) {
    findings.push({
      severity: finding.severity,
      category: 'prose_final',
      source: 'validator',
      detail: `[${finding.category}] ${finding.detail}`,
    });
  }

  findings.push(...secretLeakFindings(input));
  findings.push(...choiceHygieneFindings(choices, input.choicesDroppedBySanitizer ?? 0));
  findings.push(...languageFindings(input.language, narrative));
  findings.push(...repetitionFindings(narrative, input.priorTurns));
  findings.push(...momentumFindings(input));
  findings.push(...integrityFindings(input));

  if (narrative.length > 0 && narrative.length < 200) {
    findings.push({
      severity: 'warning',
      category: 'narrative_length',
      source: 'audit',
      detail: `Branch prose is only ${narrative.length} chars — suspiciously short for a scene.`,
    });
  }

  const stats: AotBranchAuditStats = {
    narrativeChars: narrative.length,
    choiceCount: choices.length,
    choicesDroppedBySanitizer: input.choicesDroppedBySanitizer ?? 0,
    firstPassErrors,
    firstPassWarnings,
    repairAttempts: input.repairAttempts,
    proseRepaired: input.proseRepaired,
    leftoverFindings: finalFindings.length,
  };

  const verdict: AotBranchVerdict = computeAotVerdict({
    findings,
    repairAttempts: input.repairAttempts,
    proseRepaired: input.proseRepaired,
  });

  return { verdict, findings, stats };
}

/**
 * Audit report for a branch that never reached the auditable state
 * (`prose_invalid` / `mock_unavailable`): always `rejected`, carrying the
 * validator findings that explain WHY it could not be served.
 */
export function buildRejectedAudit(
  reason: string,
  findings: ProseFinding[] = [],
  extra?: { narrativeChars?: number; repairAttempts?: number }
): AotBranchAudit {
  const mapped: AotAuditFinding[] = findings.map((finding) => ({
    severity: finding.severity,
    category: 'prose_final',
    source: 'validator',
    detail: `[${finding.category}] ${finding.detail}`,
  }));
  return {
    verdict: 'rejected',
    findings: [
      { severity: 'error', category: 'prose_final', source: 'audit', detail: `Branch not usable: ${reason}.` },
      ...mapped,
    ],
    stats: {
      narrativeChars: extra?.narrativeChars ?? 0,
      choiceCount: 0,
      choicesDroppedBySanitizer: 0,
      firstPassErrors: findings.filter((f) => f.severity === 'error').length,
      firstPassWarnings: findings.filter((f) => f.severity !== 'error').length,
      repairAttempts: extra?.repairAttempts ?? 0,
      proseRepaired: false,
      leftoverFindings: findings.length,
    },
  };
}
