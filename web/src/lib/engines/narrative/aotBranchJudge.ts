import {
  SubQAdapter,
  type SubQDecisionRequest,
  type SubQDecisionResponse,
} from '@/lib/providers/SubQAdapter';
import type { CheckResolution, ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import type { StoryNpcOverride } from '@/lib/types/story';
import type { WorldBible, WorldStateLedger } from '@/lib/types/world';
import {
  computeAotVerdict,
  type AotAuditCategory,
  type AotAuditFinding,
  type AotAuditSeverity,
  type AotBranchAudit,
} from '@/lib/engines/narrative/aotBranchAudit';
import { resolveAccompanyingIds } from '@/lib/engines/narrative/worldContext';

/**
 * Plan 15 §2.3 tier 4 / §7.6G — SubQ LLM judge over shadow AOT branches.
 *
 * The §7.6E audit is deterministic: schema shape, canon regexes, id/substring
 * secret echoes, language, dice integrity, choice hygiene. The mistakes that
 * actually burn a reader are semantic — prose that contradicts the ledger,
 * narrates a different outcome than the resolved dice, breaks character voice,
 * leaks a secret in paraphrase, or offers choices that do not follow the scene.
 * This module adds one SubQ call per dwell that critiques the FINAL (post-
 * repair) branch against the bounded world state and turns each failed
 * question into an `AotAuditFinding` (`source: 'judge'`).
 *
 * Contract:
 *   - opt-in `SNAP_AOT_JUDGE=true` (default off) — one extra SubQ call per dwell,
 *     flippable independently of `ENABLE_SNAP_AOT` so calibration does not
 *     re-spend writer calls;
 *   - the judge ADDS findings and can only escalate the verdict (error →
 *     `rejected`, warning → `warned`); it never throws into the dwell task;
 *   - timeout / unconfigured / HTTP failure / unparseable answers skip the
 *     pass and record `judgeSkipped` — absence of judge findings is never
 *     silently a clean bill;
 *   - the request reuses the envelope PROVEN live by `snapPredictor` (§7.6C) —
 *     object state + typed questions — never the momentum guardrail's shape,
 *     which currently 422s;
 *   - no schema change: judge telemetry lands inside the existing `audit` JSON
 *     column (`stats.judge*`).
 *
 * Pure apart from the injected adapter: no DB, no Next.js imports.
 */

/** Opt-in env flag: the judge costs one extra SubQ call per dwell. */
export const SNAP_AOT_JUDGE_ENV = 'SNAP_AOT_JUDGE';
/** Same model family the prediction + eval judges already use. */
export const SNAP_AOT_JUDGE_MODEL = 'subq-snap-preview';
/** Dwell-time budget: the judge must fit inside the reader's reading window. */
export const SNAP_AOT_JUDGE_TIMEOUT_MS = 4000;

export function isSnapAotJudgeEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return String(env[SNAP_AOT_JUDGE_ENV] ?? '').toLowerCase() === 'true';
}

/**
 * Bounds for the dwell-time judgment. SubQ fits 384K tokens, but the critique
 * needs the decisive state, not the campaign — a bounded payload keeps cost
 * and latency predictable on every dwell.
 */
const MAX_CURRENT_SCENE_CHARS = 1600;
const MAX_BRANCH_PROSE_CHARS = 3200;
const MAX_CHOICE_TEXT_CHARS = 400;
const MAX_CONSEQUENCE_CHARS = 600;
const MAX_PRESENT_NPCS = 8;
const MAX_STATUS_ENTRIES = 12;
const MAX_THREAT_CLOCKS = 6;
const MAX_PLOT_THREADS = 6;
const MAX_SECRETS = 12;
const MAX_SECRET_CHARS = 160;
const MAX_INVENTORY_NAMES = 20;
const MAX_REASON_CHARS = 240;
/** Mirrors the §7.6E secret-scan precision: shorter descriptions are too generic to judge. */
const MIN_SECRET_DESCRIPTION = 12;

export type AotJudgeQuestionKey =
  | 'state_consistent'
  | 'outcome_consistent'
  | 'coherent'
  | 'in_character'
  | 'choices_follow'
  | 'no_leak'
  | 'no_meta';

export const AOT_JUDGE_QUESTION_KEYS: AotJudgeQuestionKey[] = [
  'state_consistent',
  'outcome_consistent',
  'coherent',
  'in_character',
  'choices_follow',
  'no_leak',
  'no_meta',
];

interface AotJudgeQuestionMeta {
  category: AotAuditCategory;
  severity: AotAuditSeverity;
  instructions: string;
}

/**
 * The question set → finding mapping. Failed state/outcome/leak checks are
 * serving blockers (`error` → `rejected`); the rest are review flags
 * (`warning` → `warned`). Precedence is unchanged from §7.6E.
 */
export const AOT_JUDGE_QUESTIONS: Record<AotJudgeQuestionKey, AotJudgeQuestionMeta> = {
  state_consistent: {
    category: 'judge_state',
    severity: 'error',
    instructions:
      'Answer TRUE if the branch prose is consistent with the known world state (`ledger`, `player`, `present_npcs`): nobody marked dead/missing/imprisoned/transformed acts as present and healthy, the protagonist does not use items or abilities they do not carry, and the location/sub-zone does not contradict `scene_on_screen`. Answer FALSE with a short reason if any such contradiction appears.'
  },
  outcome_consistent: {
    category: 'judge_outcome',
    severity: 'error',
    instructions:
      'Answer TRUE if the narration matches `resolved_outcome` and honours `resolved_consequence`: a mixed success keeps its named cost, a failure stays a failure, a critical outcome lands as decisive. Answer FALSE with a short reason if the prose contradicts the outcome or silently drops the consequence.',
  },
  coherent: {
    category: 'judge_coherence',
    severity: 'warning',
    instructions:
      'Answer TRUE if the branch prose is coherent and causally sound — events follow from `player_action` and from each other, with no abrupt non-sequiturs or unexplained reversals. Answer FALSE with a short reason otherwise.',
  },
  in_character: {
    category: 'judge_voice',
    severity: 'warning',
    instructions:
      'Answer TRUE if every speaking NPC matches their dossier voice (`speech_style` in `present_npcs`) and the protagonist stays in a consistent voice. Answer FALSE with a short reason if an NPC sounds out of character or the tone breaks.',
  },
  choices_follow: {
    category: 'judge_choice_fit',
    severity: 'warning',
    instructions:
      'Answer TRUE if the branch choices follow naturally from the scene, do not re-offer an obstacle the scene just resolved, and do not presume outcomes that did not happen. Answer FALSE with a short reason otherwise.',
  },
  no_leak: {
    category: 'judge_leak',
    severity: 'error',
    instructions:
      'Answer TRUE if no secret from `undiscovered_secrets` is revealed, paraphrased, or unmistakably implied in the prose or the choices — the list is a strict do-not-repeat list. Answer FALSE with a short reason naming the leaked secret otherwise.',
  },
  no_meta: {
    category: 'judge_meta',
    severity: 'warning',
    instructions:
      'Answer TRUE if the prose is free of AI tells, prompt/schema artefacts (field names, JSON fragments), and fourth-wall breaks that address the player/user instead of narrating the protagonist. Answer FALSE with a short reason otherwise.',
  },
};

export interface AotJudgeInput {
  storyTitle?: string;
  language?: string;
  /** Prose of the scene the reader is on (turn N), for continuity comparison. */
  currentScene?: string;
  playerActionText: string;
  resolution: CheckResolution;
  isDiceless: boolean;
  /** Player state AFTER the branch's deterministic chain (what a tap would persist). */
  playerState: PlayerState;
  worldBible?: WorldBible | null;
  storyNpcOverrides?: Record<string, StoryNpcOverride> | null;
  ledger?: WorldStateLedger | null;
  /** The pre-written branch under judgement (final, post-repair prose). */
  narrative: string;
  choices: ChoiceOption[];
}

function truncate(text: string | undefined, max: number): string {
  const trimmed = (text ?? '').trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/** Structural view of World Bible NPCs — only the fields the judge state reads. */
interface JudgeNpcShape {
  id?: string;
  name?: string;
  role?: string;
  currentLocationId?: string;
  applicableLocationIds?: string[];
  speechStyle?: string;
  secrets?: Array<{ id?: string; description?: string; revealed?: boolean }>;
}

function npcList(input: AotJudgeInput): JudgeNpcShape[] {
  return (input.worldBible?.npcs ?? []) as unknown as JudgeNpcShape[];
}

/**
 * Undiscovered secrets as a strict do-not-repeat list. Mirrors the §7.6E
 * secret-scan precision rule (revealed/known skipped, short descriptions
 * skipped) so the judge is asked about exactly the secrets serving would leak.
 */
export function collectUndiscoveredSecrets(
  input: AotJudgeInput
): Array<{ npc: string; secret: string }> {
  const out: Array<{ npc: string; secret: string }> = [];
  for (const npc of npcList(input)) {
    const knownIds = new Set(input.playerState.relationships?.[npc.id ?? '']?.knownSecrets ?? []);
    const secrets = [...(npc.secrets ?? [])];
    const overrideSecret = npc.id ? input.storyNpcOverrides?.[npc.id]?.storySecret : undefined;
    if (typeof overrideSecret === 'string' && overrideSecret.trim().length >= MIN_SECRET_DESCRIPTION) {
      secrets.push({ id: `override_secret_${npc.id}`, description: overrideSecret.trim() });
    }

    for (const secret of secrets) {
      const description = (secret.description ?? '').trim();
      if (secret.revealed || (secret.id && knownIds.has(secret.id))) continue;
      if (description.length < MIN_SECRET_DESCRIPTION) continue;
      out.push({
        npc: npc.name ?? npc.id ?? '?',
        secret: truncate(description, MAX_SECRET_CHARS),
      });
      if (out.length >= MAX_SECRETS) return out;
    }
  }
  return out;
}

/**
 * NPCs the scene plausibly contains: the effective party roster (explicit
 * `accompanyingNpcIds`, else ledger companions) plus NPCs based at the current
 * location. Carries `speech_style` so the judge can check voice.
 */
export function collectPresentNpcs(
  input: AotJudgeInput
): Array<{ name: string; role?: string; speech_style?: string }> {
  const roster = new Set(resolveAccompanyingIds(input.playerState, input.ledger ?? null));
  const out: Array<{ name: string; role?: string; speech_style?: string }> = [];
  for (const npc of npcList(input)) {
    if (!npc.id) continue;
    const atLocation =
      npc.currentLocationId === input.playerState.currentLocationId ||
      (npc.applicableLocationIds ?? []).includes(input.playerState.currentLocationId);
    if (!roster.has(npc.id) && !atLocation) continue;
    out.push({
      name: npc.name ?? npc.id,
      role: npc.role,
      speech_style: npc.speechStyle ? truncate(npc.speechStyle, 200) : undefined,
    });
    if (out.length >= MAX_PRESENT_NPCS) break;
  }
  return out;
}

function itemName(item: unknown): string | undefined {
  const candidate = item as { name?: unknown; id?: unknown } | null;
  if (typeof candidate?.name === 'string' && candidate.name) return candidate.name;
  if (typeof candidate?.id === 'string' && candidate.id) return candidate.id;
  return undefined;
}

function playerBlock(input: AotJudgeInput) {
  const player = input.playerState;
  const carried: string[] = [];
  for (const item of player.inventory ?? []) {
    const name = itemName(item);
    if (name) carried.push(name);
    if (carried.length >= MAX_INVENTORY_NAMES) break;
  }
  return {
    name: player.characterName || 'Protagonist',
    level: player.level ?? 1,
    conditions: player.conditions?.slice(0, 8),
    resources: player.resources,
    carried_items: carried,
    abilities: (player.abilities ?? []).slice(0, MAX_INVENTORY_NAMES),
    location_id: player.currentLocationId,
    sub_zone_id: player.currentSubZoneId,
  };
}

function ledgerBlock(input: AotJudgeInput) {
  const ledger = input.ledger;
  return {
    npc_statuses: (ledger?.npcStatuses ?? [])
      .filter((s) => s.status !== 'alive')
      .slice(0, MAX_STATUS_ENTRIES)
      .map((s) => ({
        npc: s.npcName || s.npcId,
        status: s.status,
        note: s.note ? truncate(s.note, 120) : undefined,
      })),
    threat_clocks: (input.playerState.activeTensionClocks ?? [])
      .slice(0, MAX_THREAT_CLOCKS)
      .map((clock) => ({
        name: clock.name || clock.id,
        segments: `${clock.currentSegments}/${clock.maxSegments}`,
        crisis: clock.crisisDescription ? truncate(clock.crisisDescription, 120) : undefined,
        triggered: clock.isTriggered || undefined,
      })),
    key_items: (ledger?.keyItems ?? []).slice(0, 8).map((item) => item.name),
    open_plot_threads: (ledger?.openPlotThreads ?? [])
      .slice(0, MAX_PLOT_THREADS)
      .map((thread) => truncate(thread, 160)),
  };
}

/**
 * Builds the single SubQ request. The shape is the one `snapPredictor` proved
 * live: `state` object + typed questions keyed by question id. Each question
 * is `noul` (boolean) — one judge call covers the whole question set.
 */
export function buildAotJudgeRequest(
  input: AotJudgeInput,
  modelId = SNAP_AOT_JUDGE_MODEL
): SubQDecisionRequest {
  const resolutionLine = input.isDiceless
    ? `${input.resolution.outcome} (diceless — no roll)`
    : `${input.resolution.outcome} (rolled ${input.resolution.diceRoll ?? '—'} on ${
        input.resolution.diceType ?? 'd20'
      }, total ${input.resolution.totalScore ?? '—'} vs DC ${input.resolution.difficultyClass ?? '—'})`;

  const state = {
    task: 'critique_shadow_branch',
    story: { title: input.storyTitle, language: input.language },
    player_action: truncate(input.playerActionText, MAX_CHOICE_TEXT_CHARS),
    resolved_outcome: resolutionLine,
    resolved_consequence: truncate(input.resolution.consequenceSummary, MAX_CONSEQUENCE_CHARS),
    scene_on_screen: truncate(input.currentScene, MAX_CURRENT_SCENE_CHARS),
    player: playerBlock(input),
    present_npcs: collectPresentNpcs(input),
    ledger: ledgerBlock(input),
    undiscovered_secrets: collectUndiscoveredSecrets(input),
    branch_prose: truncate(input.narrative, MAX_BRANCH_PROSE_CHARS),
    branch_choices: (input.choices ?? []).map((choice) => ({
      text: truncate(choice.text, MAX_CHOICE_TEXT_CHARS),
      style: choice.style,
      risk_level: choice.riskLevel,
    })),
  };

  const questions: SubQDecisionRequest['questions'] = {};
  for (const key of AOT_JUDGE_QUESTION_KEYS) {
    questions[key] = {
      type: 'noul',
      instructions: AOT_JUDGE_QUESTIONS[key].instructions,
    };
  }

  return { model: modelId, state, questions };
}

/**
 * Tolerant boolean reader for `noul` answers. Returns undefined when the
 * answer cannot be read — an unreadable answer is NOT a pass (the run is
 * treated as skipped when nothing parses).
 */
export function extractSubQBoolean(rawAnswer: unknown): boolean | undefined {
  if (rawAnswer === null || rawAnswer === undefined) return undefined;
  if (typeof rawAnswer === 'boolean') return rawAnswer;

  const answer = rawAnswer as Record<string, unknown> & { noul?: { answer?: unknown } };
  if (typeof answer.noul === 'boolean') return answer.noul;
  if (typeof answer.answer === 'boolean') return answer.answer;
  if (typeof answer.value === 'boolean') return answer.value;
  if (typeof answer.noul?.answer === 'boolean') return answer.noul.answer;
  if (typeof answer.index === 'number' && Number.isInteger(answer.index)) {
    if (answer.index === 0) return false;
    if (answer.index === 1) return true;
  }

  const str =
    typeof answer.answer === 'string'
      ? answer.answer
      : typeof answer.value === 'string'
        ? answer.value
        : undefined;
  if (str) {
    const normalized = str.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'no') return false;
  }
  return undefined;
}

function extractJudgeReason(rawAnswer: unknown): string | undefined {
  if (!rawAnswer || typeof rawAnswer !== 'object') return undefined;
  const answer = rawAnswer as Record<string, unknown> & { noul?: { reason?: unknown } };
  const candidate = answer.reason ?? answer.explanation ?? answer.notes ?? answer.detail ?? answer.noul?.reason;
  if (typeof candidate !== 'string') return undefined;
  const trimmed = candidate.trim();
  return trimmed ? truncate(trimmed, MAX_REASON_CHARS) : undefined;
}

export interface AotJudgeAnswer {
  question: AotJudgeQuestionKey;
  passed: boolean;
  reason?: string;
}

/** Reads the seven boolean answers; unparseable questions are skipped. */
export function parseAotJudgeAnswers(response: SubQDecisionResponse): AotJudgeAnswer[] {
  if (!response?.success || !response.answers) return [];
  const out: AotJudgeAnswer[] = [];
  for (const question of AOT_JUDGE_QUESTION_KEYS) {
    const raw = response.answers[question];
    const passed = extractSubQBoolean(raw);
    if (passed === undefined) continue;
    out.push({ question, passed, reason: extractJudgeReason(raw) });
  }
  return out;
}

/** Each failed question becomes one finding (`source: 'judge'`). */
export function judgeAnswersToFindings(answers: AotJudgeAnswer[]): AotAuditFinding[] {
  const out: AotAuditFinding[] = [];
  for (const answer of answers) {
    if (answer.passed) continue;
    const meta = AOT_JUDGE_QUESTIONS[answer.question];
    out.push({
      severity: meta.severity,
      category: meta.category,
      source: 'judge',
      detail: `Judge "${answer.question}" failed${answer.reason ? `: ${answer.reason}` : '.'}`,
    });
  }
  return out;
}

export interface AotJudgeStats {
  judgeSkipped: boolean;
  judgeFindings: number;
  judgeLatencyMs?: number;
  judgeError?: string;
}

export interface AotJudgeResult {
  findings: AotAuditFinding[];
  stats: AotJudgeStats;
}

/**
 * Runs the judge against the adapter. NEVER throws and never blocks: every
 * failure mode returns `judgeSkipped` telemetry instead of an error, so the
 * dwell task stays alive and the #7.6E audit still stores.
 */
export async function runAotBranchJudge(
  input: AotJudgeInput,
  options?: { adapter?: SubQAdapter; timeoutMs?: number; signal?: AbortSignal }
): Promise<AotJudgeResult> {
  const skip = (judgeError: string): AotJudgeResult => ({
    findings: [],
    stats: { judgeSkipped: true, judgeFindings: 0, judgeError },
  });

  try {
    const adapter = options?.adapter ?? new SubQAdapter();
    if (!adapter.isConfigured()) return skip('subq_not_configured');
    if (!input.narrative?.trim()) return skip('no_branch_prose');
    if (options?.signal?.aborted) return skip('aborted');

    const response = await adapter.evaluate(buildAotJudgeRequest(input), {
      timeoutMs: options?.timeoutMs ?? SNAP_AOT_JUDGE_TIMEOUT_MS,
      signal: options?.signal,
    });

    if (!response.success) return skip(response.error ?? 'subq_request_failed');

    const answers = parseAotJudgeAnswers(response);
    // Missing any criterion is an incomplete pass, not a silent clean bill.
    if (answers.length !== AOT_JUDGE_QUESTION_KEYS.length) {
      return skip(answers.length === 0 ? 'unparseable_answers' : 'incomplete_answers');
    }

    const findings = judgeAnswersToFindings(answers);
    return {
      findings,
      stats: {
        judgeSkipped: false,
        judgeFindings: findings.length,
        judgeLatencyMs: typeof response.latencyMs === 'number' ? response.latencyMs : undefined,
      },
    };
  } catch (error) {
    return skip(error instanceof Error ? error.message : 'judge_failed');
  }
}

/**
 * Folds the judge result into a §7.6E audit. The judge can only escalate: its
 * error findings make the branch `rejected`, warnings make it `warned`; with
 * no findings the deterministic verdict stands (recomputed through the same
 * `computeAotVerdict` so there is exactly one verdict math). A skipped pass
 * records `judgeSkipped` in stats — absence of judge findings is never silently
 * a clean bill. Same `audit` JSON column; no migration.
 */
export function mergeAotJudgeIntoAudit(audit: AotBranchAudit, judge: AotJudgeResult): AotBranchAudit {
  const findings =
    judge.findings.length > 0 ? [...audit.findings, ...judge.findings] : audit.findings;
  return {
    verdict: computeAotVerdict({
      findings,
      repairAttempts: audit.stats.repairAttempts,
      proseRepaired: audit.stats.proseRepaired,
    }),
    findings,
    stats: { ...audit.stats, ...judge.stats },
  };
}
