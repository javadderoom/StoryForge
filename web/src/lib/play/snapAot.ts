import type { Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/db/client';
import { SessionRepository } from '@/lib/db/repositories/sessionRepository';
import {
  preGenerateAotBranch,
  type AotBranchResult,
} from '@/lib/engines/narrative/aotBranchEngine';
import type {
  SceneSessionMemory,
  SceneSessionTurn,
} from '@/lib/engines/narrative/narrativeTurn';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import { WorldStateLedger } from '@/lib/types/world';
import type { StoryManifest } from '@/lib/types/story';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { getNarrativeAdapter } from '@/lib/providers/narrativeAdapterFactory';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import { StoryRepository } from '@/lib/db/repositories/storyRepository';
import {
  runAotBranchJudge,
  mergeAotJudgeIntoAudit,
  type AotJudgeInput,
  SNAP_AOT_JUDGE_TIMEOUT_MS,
} from '@/lib/engines/narrative/aotBranchJudge';
import type { CheckResolution } from '@/lib/types/gameplay';
import type { AotBranchAudit } from '@/lib/engines/narrative/aotBranchAudit';

/**
 * Plan 15 §2.3 tier 4 (shadow phase): Snap-gated AOT branch pre-generation
 * orchestration + persistence.
 *
 * Sequencing (all inside the reader's dwell, after the turn response is on the
 * wire): Snap predicts the tap → the predicted choice's check is pre-rolled and
 * its branch pre-written by `aotBranchEngine` → the candidate is stored in
 * `snap_aot_branches` for analysis, carrying its audit verdict + findings
 * (§7.6E: what the writer got wrong, what was repaired, what survived). Serving
 * a stored branch on a predicted tap remains GATED on the measured hit rate
 * over `snap_decision_logs`; nothing in this module renders to the reader.
 *
 * Guards, cheapest first:
 *   - `ENABLE_SNAP_AOT=true` opt-in (generation doubles writer spend per dwell),
 *   - authored choices are skipped (their branches are served verbatim with
 *     zero model calls, so pre-writing them buys nothing),
 *   - the session is refetched AFTER the turn was persisted, so the branch sees
 *     the full history including the scene on screen,
 *   - if any turn beyond the dwell turn already exists the reader acted while
 *     we worked — the branch is stale and is abandoned (belt-and-braces on top
 *     of the abort registry),
 *   - an aborted signal (reader acted) skips both generation and the store.
 *
 * Failures never throw: a failed engine writes a `failed` row (the report
 * tracks reliability), and orchestration errors only log.
 */

/** Opt-in env flag: AOT pre-generation costs one extra writer call per dwell. */
export const SNAP_AOT_ENABLE_ENV = 'ENABLE_SNAP_AOT';

export function isSnapAotEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return String(env[SNAP_AOT_ENABLE_ENV] ?? '').toLowerCase() === 'true';
}

/** Opt-in env flag: serve stored branches on matching predicted taps (default true when ENABLE_SNAP_AOT is true). */
export const SNAP_AOT_SERVE_ENV = 'ENABLE_SNAP_AOT_SERVING';

export function isSnapAotServingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const explicit = env[SNAP_AOT_SERVE_ENV];
  if (explicit !== undefined && explicit !== '') {
    return String(explicit).toLowerCase() === 'true';
  }
  return isSnapAotEnabled(env);
}

export interface ServableAotBranchQuery {
  sessionId: string;
  storyId: string;
  turnNumber: number;
  predictedChoiceId: string;
}

export async function findServableAotBranch(
  query: ServableAotBranchQuery,
  prisma = getPrisma(),
  env: Record<string, string | undefined> = process.env
) {
  if (!prisma || !isSnapAotServingEnabled(env)) return null;

  const branch = await prisma.snapAotBranch.findFirst({
    where: {
      sessionId: query.sessionId,
      storyId: query.storyId,
      turnNumber: query.turnNumber,
      predictedChoiceId: query.predictedChoiceId,
      status: 'generated',
      servedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (
    !branch ||
    !branch.narrative?.trim() ||
    !Array.isArray(branch.choices) ||
    branch.choices.length === 0
  ) {
    return null;
  }

  return branch;
}

export async function markAotBranchServed(branchId: string, prisma = getPrisma()): Promise<void> {
  if (!prisma || !branchId) return;
  try {
    await prisma.snapAotBranch.update({
      where: { id: branchId },
      data: { servedAt: new Date() },
    });
  } catch (error) {
    console.warn('[snapAot] Failed to mark branch as served:', error);
  }
}


export interface SnapAotContext {
  sessionId: string;
  storyId: string;
  /** Turn whose choices are on screen (N). The branch pre-writes turn N+1. */
  turnNumber: number;
  /** Migrated story manifest (same object the route resolved). */
  story: StoryManifest;
  /** The choice Snap predicted the reader will tap. */
  choice: ChoiceOption;
  /** For the post-turn session refetch (ownership-scoped). */
  caller: { id: string; role: string } | null;
  /** Fired the moment the reader acts; checked before generation and store. */
  signal?: AbortSignal;
}

export interface SnapAotBranchRow {
  sessionId: string;
  storyId: string;
  turnNumber: number;
  predictedChoiceId: string;
  choiceText?: string;
  diceRoll?: number;
  isDiceless: boolean;
  outcome?: string;
  status: string;
  model?: string;
  narrative?: string;
  choices: unknown[];
  resolution?: unknown;
  /** §7.6E serving verdict: clean | repaired | warned | rejected. */
  verdict?: string;
  /** §7.6E full audit report (findings + mistake telemetry) for analysis. */
  audit?: unknown;
  latencyMs?: number;
  error?: string;
}

/** Structural view of the post-turn session the engine consumes. */
interface AotLoadedSession {
  turns?: SceneSessionTurn[];
  memories?: SceneSessionMemory[];
  sagaLedger?: unknown;
  currentChapterId?: string | null;
  playerState?: unknown;
}

export interface SnapAotDeps {
  /** Injectable for tests; defaults to the ownership-scoped session lookup. */
  loadSession?: (
    sessionId: string,
    caller: { id: string; role: string } | null
  ) => Promise<AotLoadedSession | null>;
  /** Injectable for tests; defaults to `snap_aot_branches` insert. */
  storeBranch?: (row: SnapAotBranchRow) => Promise<void>;
  geminiAdapter?: GeminiAdapter;
  subqAdapter?: SubQAdapter;
}

/** Cast helper for Prisma Json columns (mirrors sessionRepository). */
const asJson = (value: unknown) => value as Prisma.InputJsonValue;

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

/** Authored beats are served verbatim; pre-writing their branch buys nothing. */
export function shouldPreGenerateBranch(
  choice: ChoiceOption | null | undefined
): { ok: boolean; reason?: 'no_choice' | 'authored_choice' } {
  if (!choice?.id) return { ok: false, reason: 'no_choice' };
  const targetSceneId = (choice as { targetSceneId?: unknown }).targetSceneId;
  if (typeof targetSceneId === 'string' && targetSceneId) {
    return { ok: false, reason: 'authored_choice' };
  }
  return { ok: true };
}

/** True when a turn beyond the dwell turn exists — the reader already acted. */
export function hasReaderActedSince(
  turns: Array<{ turnNumber?: number }> | null | undefined,
  turnNumber: number
): boolean {
  if (!Array.isArray(turns)) return false;
  return turns.some((t) => typeof t.turnNumber === 'number' && t.turnNumber > turnNumber);
}

export function buildSnapAotBranchRow(
  ref: { sessionId: string; storyId: string; turnNumber: number; choice: ChoiceOption },
  result: AotBranchResult
): SnapAotBranchRow {
  return {
    sessionId: ref.sessionId,
    storyId: ref.storyId,
    turnNumber: ref.turnNumber,
    predictedChoiceId: ref.choice.id,
    choiceText: ref.choice.text,
    diceRoll: result.diceRoll,
    isDiceless: result.isDiceless,
    outcome: result.outcome,
    status: result.status,
    model: result.model,
    narrative: result.narrative,
    choices: (toJsonSafe(result.choices ?? []) as unknown[]) ?? [],
    resolution: toJsonSafe(result.resolution),
    verdict: result.audit?.verdict,
    audit: toJsonSafe(result.audit),
    latencyMs: result.latencyMs != null ? Math.round(result.latencyMs) : undefined,
    error: result.error,
  };
}

async function defaultStoreBranch(row: SnapAotBranchRow): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.snapAotBranch.create({
    data: {
      sessionId: row.sessionId,
      storyId: row.storyId,
      turnNumber: row.turnNumber,
      predictedChoiceId: row.predictedChoiceId,
      choiceText: row.choiceText,
      diceRoll: row.diceRoll,
      isDiceless: row.isDiceless,
      outcome: row.outcome,
      status: row.status,
      model: row.model,
      narrative: row.narrative,
      choices: asJson(row.choices),
      resolution: row.resolution === undefined ? undefined : asJson(row.resolution),
      verdict: row.verdict,
      audit: row.audit === undefined ? undefined : asJson(row.audit),
      latencyMs: row.latencyMs,
      error: row.error,
    },
  });
}

/**
 * Pre-generates the Snap-predicted branch for the dwell turn and stores it.
 * Never throws; aborted runs store nothing.
 */
export async function preGenerateSnapAotBranch(
  ctx: SnapAotContext,
  deps: SnapAotDeps = {}
): Promise<void> {
  try {
    const guard = shouldPreGenerateBranch(ctx.choice);
    if (!guard.ok) return;
    if (ctx.signal?.aborted) return;

    const loadSession =
      deps.loadSession ??
      (async (sessionId, caller) =>
        (await SessionRepository.getSessionForUser(sessionId, caller)) as AotLoadedSession | null);

    // Refetch AFTER the turn was persisted: the branch must see the scene the
    // reader is dwelling on (turn N), its choices, and turn N's memories.
    const session = await loadSession(ctx.sessionId, ctx.caller);
    if (!session) return;

    // The reader acted while we worked: the branch can never be served.
    if (hasReaderActedSince(session.turns, ctx.turnNumber)) return;
    if (ctx.signal?.aborted) return;

    const playerState = session.playerState as PlayerState | undefined;
    if (!playerState) return;

    const startedAt = Date.now();
    let result: AotBranchResult;
    try {
      result = await preGenerateAotBranch({
        story: ctx.story,
        playerState,
        choice: ctx.choice,
        turnNumber: ctx.turnNumber,
        sagaLedger: (session.sagaLedger ?? null) as WorldStateLedger | null,
        currentChapterId: session.currentChapterId ?? null,
        sessionTurns: session.turns ?? [],
        sessionMemories: session.memories ?? [],
        geminiAdapter: deps.geminiAdapter ?? (await getNarrativeAdapter(ctx.story.engineTier)),
        subqAdapter: deps.subqAdapter,
        signal: ctx.signal,
      });
    } catch (error) {
      result = {
        status: 'failed',
        isDiceless: ctx.choice.targetDC === undefined && ctx.choice.requiredStatId === undefined,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Aborted mid-generation (reader acted): never store a stale branch.
    if (ctx.signal?.aborted) return;

    const storeBranch = deps.storeBranch ?? defaultStoreBranch;
    await storeBranch(
      buildSnapAotBranchRow(
        {
          sessionId: ctx.sessionId,
          storyId: ctx.storyId,
          turnNumber: ctx.turnNumber,
          choice: ctx.choice,
        },
        result
      )
    );
  } catch (error) {
    console.warn('[snapAot] AOT branch pre-generation failed:', error);
  }
}

export interface RejudgeBranchResult {
  ok: boolean;
  branchId: string;
  sessionId?: string;
  turnNumber?: number;
  previousVerdict?: string | null;
  newVerdict?: string;
  judgeSkipped?: boolean;
  judgeFindings?: number;
  judgeLatencyMs?: number;
  judgeError?: string;
  error?: string;
}

/**
 * Re-evaluates an existing stored branch using the SubQ LLM judge (§7.6F item 4),
 * merges the findings into its audit, and updates its verdict and audit in the database.
 */
export async function rejudgeSnapAotBranch(
  branchId: string,
  options?: {
    prisma?: ReturnType<typeof getPrisma>;
    subqAdapter?: SubQAdapter;
    timeoutMs?: number;
    story?: StoryManifest | null;
    session?: AotLoadedSession | null;
  }
): Promise<RejudgeBranchResult> {
  const prisma = options?.prisma !== undefined ? options.prisma : getPrisma();
  if (!prisma) {
    return { ok: false, branchId, error: 'database_unavailable' };
  }

  const branch = await prisma.snapAotBranch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return { ok: false, branchId, error: 'branch_not_found' };
  }

  if (branch.status !== 'generated' || !branch.narrative?.trim()) {
    return {
      ok: false,
      branchId,
      sessionId: branch.sessionId,
      turnNumber: branch.turnNumber,
      error: `branch_status_${branch.status}`,
    };
  }

  let story: StoryManifest | null | undefined = options?.story;
  if (!story) {
    story = (await StoryRepository.getStoryById(branch.storyId)) as unknown as StoryManifest | null;
  }
  if (!story) {
    return {
      ok: false,
      branchId,
      sessionId: branch.sessionId,
      turnNumber: branch.turnNumber,
      error: 'story_not_found',
    };
  }

  let session: AotLoadedSession | null | undefined = options?.session;
  if (!session) {
    session = (await SessionRepository.getSessionForUser(branch.sessionId, null)) as AotLoadedSession | null;
  }

  const turnOnScreen = (session?.turns ?? []).find((t) => t.turnNumber === branch.turnNumber);
  const currentScene = turnOnScreen?.narrativeProse;

  const resolution: CheckResolution = (branch.resolution as CheckResolution | null) ?? {
    actionDescription: branch.choiceText || '',
    statModifier: 0,
    diceRoll: branch.diceRoll ?? 10,
    diceType: 'd20',
    environmentalModifier: 0,
    totalScore: branch.diceRoll ?? 10,
    difficultyClass: 10,
    outcome: (branch.outcome as any) || 'success',
    consequenceSummary: '',
    stateDiff: {},
  };

  const playerState: PlayerState = (session?.playerState as PlayerState | undefined) ?? {
    stats: {},
    resources: {},
    inventory: [],
    equipment: {},
    discoveredLocationIds: [],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: '',
  };

  const ledger =
    (session?.sagaLedger as WorldStateLedger | undefined) ??
    (story.saga?.ledger as WorldStateLedger | undefined) ??
    null;
  const choices = (branch.choices as ChoiceOption[] | null) ?? [];

  const judgeInput: AotJudgeInput = {
    storyTitle: story.title || '',
    language: story.language,
    currentScene,
    playerActionText: branch.choiceText || '',
    resolution,
    isDiceless: Boolean(branch.isDiceless),
    playerState,
    worldBible: story.worldBible,
    storyNpcOverrides: story.storyNpcOverrides,
    ledger,
    narrative: branch.narrative,
    choices,
  };

  const judgeResult = await runAotBranchJudge(judgeInput, {
    adapter: options?.subqAdapter,
    timeoutMs: options?.timeoutMs ?? SNAP_AOT_JUDGE_TIMEOUT_MS,
  });

  const existingAudit = branch.audit as unknown as AotBranchAudit | null;
  const baseStats = {
    narrativeChars: existingAudit?.stats?.narrativeChars ?? branch.narrative?.length ?? 0,
    choiceCount: existingAudit?.stats?.choiceCount ?? choices.length,
    choicesDroppedBySanitizer: existingAudit?.stats?.choicesDroppedBySanitizer ?? 0,
    firstPassErrors: existingAudit?.stats?.firstPassErrors ?? 0,
    firstPassWarnings: existingAudit?.stats?.firstPassWarnings ?? 0,
    repairAttempts: existingAudit?.stats?.repairAttempts ?? 0,
    proseRepaired: existingAudit?.stats?.proseRepaired ?? false,
    leftoverFindings: existingAudit?.stats?.leftoverFindings ?? 0,
    ...existingAudit?.stats,
  };

  // Strip previous judge findings so fresh judgment does not pile up duplicates
  const strippedFindings = (existingAudit?.findings || []).filter((f) => f.source !== 'judge');
  const baseAudit: AotBranchAudit = {
    verdict: existingAudit?.verdict ?? ((branch.verdict as any) || 'clean'),
    findings: strippedFindings,
    stats: baseStats,
  };

  const updatedAudit = mergeAotJudgeIntoAudit(baseAudit, judgeResult);

  await prisma.snapAotBranch.update({
    where: { id: branch.id },
    data: {
      verdict: updatedAudit.verdict,
      audit: asJson(updatedAudit),
    },
  });

  return {
    ok: true,
    branchId: branch.id,
    sessionId: branch.sessionId,
    turnNumber: branch.turnNumber,
    previousVerdict: branch.verdict,
    newVerdict: updatedAudit.verdict,
    judgeSkipped: judgeResult.stats.judgeSkipped ?? false,
    judgeFindings: judgeResult.findings.length,
    judgeLatencyMs: judgeResult.stats.judgeLatencyMs,
    judgeError: judgeResult.stats.judgeError,
  };
}

/**
 * Batch re-judges stored branches matching the optional session filter up to the limit.
 */
export async function rejudgeSnapAotBranches(options?: {
  sessionId?: string;
  limit?: number;
  prisma?: ReturnType<typeof getPrisma>;
  subqAdapter?: SubQAdapter;
  timeoutMs?: number;
}): Promise<RejudgeBranchResult[]> {
  const prisma = options?.prisma !== undefined ? options.prisma : getPrisma();
  if (!prisma) return [];

  const limit = options?.limit ?? 50;
  const where = {
    status: 'generated',
    ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
  };

  const branches = await prisma.snapAotBranch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const results: RejudgeBranchResult[] = [];
  for (const branch of branches) {
    const res = await rejudgeSnapAotBranch(branch.id, {
      prisma,
      subqAdapter: options?.subqAdapter,
      timeoutMs: options?.timeoutMs,
    });
    results.push(res);
  }

  return results;
}

