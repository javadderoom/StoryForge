/**
 * Plan 14 — Tier 5 companion: REAL-WORLD story harness.
 *
 * Plays a seeded story end-to-end through the *live HTTP pipeline*
 * (`POST /api/play/session` + `POST /api/play/action`) and audits the result
 * with the Tier 3 heuristics + trajectory rules. Unlike `eval:narrative`
 * (isolated scenarios) and `eval:simulate` (headless engine), this exercises
 * the production path: real story manifest, real session persistence,
 * server-authoritative PlayerState, real DB, real model.
 *
 * Usage:
 *   npm run eval:story
 *   npm run eval:story -- --storyId=story_mt4ofllt --turns=8 --persona=shadow
 *   npm run eval:story -- --seed=7 --persona=boundary --turns=10
 *   npm run eval:story -- --raw                   # + in-process RAW model probe
 *   npm run eval:story -- --baseUrl=http://localhost:3000
 *   npm run eval:story -- --json --out=report.json
 *
 * Requires: the dev server running (`npm run dev` in web/) and Gemini quota.
 * `--raw` additionally makes ONE in-process model call through the shared
 * `generateValidatedScene` engine to capture the RAW (pre-guardrail) payload,
 * which is the only layer where DC-calibration assertions are meaningful.
 */

import fs from 'node:fs';

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional */
}

import { PERSONAS, PersonaId, pickChoice, makeRng } from '@/lib/evals/simulator';
import { evaluateRawScene, hasHostileActors } from '@/lib/evals/evaluator';
import { isConfrontationalChoiceText } from '@/lib/providers/GeminiAdapter';
import { unexpectedPersianScriptCharacters } from '@/lib/engines/narrative/ProseValidator';
import { EvalFinding } from '@/lib/evals/types';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const BASE_URL = (arg('baseUrl', 'http://localhost:3000') ?? 'http://localhost:3000').replace(/\/+$/, '');
const STORY_ID = arg('storyId', 'story_mt4ofllt') as string;
const TURNS = Math.max(1, Math.min(20, Number(arg('turns', '6')) || 6));
const SEED = Number(arg('seed', '42')) || 42;
const PERSONA = (arg('persona', 'shadow') ?? 'shadow') as PersonaId;
const RAW_PROBE = flag('raw');
const VERBOSE = flag('verbose');
const AS_JSON = flag('json');
const OUT = arg('out');

import { resolveHealthKey } from '@/lib/engines/game/resourcePools';

interface TurnAudit {
  turn: number;
  actionText: string;
  choiceId?: string;
  transport: 'ok' | 'rejected' | 'failed';
  httpStatus: number;
  latencyMs: number;
  outcome?: string;
  roll?: number;
  dc?: number;
  statId?: string;
  hp?: number;
  hpMax?: number;
  clockSummary?: string;
  clockSegments?: number;
  defeat?: boolean;
  defeatCount?: number;
  locationChanged?: boolean;
  proseRepaired?: boolean;
  routeFindings?: string[];
  proseWords?: number;
  choiceCount?: number;
  dicelessCount?: number;
  checkedDcs?: number[];
  warnedStats?: string[];
  heuristic: { errors: string[]; warnings: string[] };
  rejectionReason?: string;
  error?: string;
  narrative?: string;
  choices?: ChoiceOption[];
}

async function postJson(pathname: string, body: unknown): Promise<{ status: number; json: any; latencyMs: number }> {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, latencyMs: Date.now() - started };
}

/** Wide sanity band for real authored stories (they may run low-base or mythic). */
function bandsFor(): { minDc: number; maxDc: number } {
  return { minDc: 6, maxDc: 20 };
}

function wordsOf(text: string): string[] {
  return (text.match(/[\p{L}\p{N}]+/gu) || []).map((w) => w.toLowerCase());
}

/**
 * The *real* production contract, scoped per choice: a confrontational choice
 * (weapon/violence/coercion keywords, or declared `high` risk) must carry a stat
 * and a DC. A peaceful choice in a scene that merely mentions guards is
 * legitimately diceless, so a prose-level proxy would produce false positives.
 */
function confrontationalDiceless(choices: ChoiceOption[]): ChoiceOption[] {
  return (choices ?? []).filter(
    (c) => isConfrontationalChoiceText(c?.text ?? '', c?.riskLevel) && !c?.requiredStatId
  );
}

/**
 * Script purity. Reuses the production Persian script detector so diagnostics
 * and validation apply the identical contract. The production validator retains
 * its language gate; the harness passes Persian prose here.
 */
function foreignGlyphs(text: string): string[] {
  return unexpectedPersianScriptCharacters(text).map(
    (ch) => `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`
  );
}

/** Token-set Jaccard — used to spot cyclical prose traps across turns. */
function jaccard(a: string, b: string): number {
  const sa = new Set(wordsOf(a));
  const sb = new Set(wordsOf(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

function auditScene(params: {
  narrative: string;
  choices: ChoiceOption[];
  validStatIds: string[];
  isEnglish: boolean;
  isLowBase: boolean;
  /** Force the no-diceless invariant on (real-story RAW probe with hostile prose). */
  requireNoDiceless?: boolean;
}): { errors: string[]; warnings: string[]; words: number; diceless: number; dcs: number[]; warnedStats: string[] } {
  const { narrative, choices, validStatIds, isEnglish, isLowBase } = params;
  const { minDc, maxDc } = bandsFor();
  const report = evaluateRawScene(
    { narrative, choices } as never,
    {
      expectations: {
        minDc,
        maxDc,
        minChoices: 2,
        maxChoices: 4,
        minWords: 40,
        maxWords: 900,
        ...(params.requireNoDiceless ? { requireNoDiceless: true } : {}),
      },
      validStatIds,
      isEnglish,
      isLowBase,
    }
  );
  const errors = report.findings.filter((f) => f.severity === 'error');
  const warnings = report.findings.filter((f) => f.severity === 'warning');
  return {
    errors: errors.map((f) => `[${f.rule}] ${f.detail}`),
    warnings: warnings.map((f) => `[${f.rule}] ${f.detail}`),
    words: report.stats.wordCount,
    diceless: report.stats.dicelessCount,
    dcs: report.stats.checkedDcs,
    warnedStats: warnings.filter((f) => f.rule === 'stat.whitelist').map((f) => f.detail),
  };
}

export interface StoryRunReport {
  storyId: string;
  storyTitle: string;
  language: string;
  persona: PersonaId;
  seed: number;
  turnsRequested: number;
  turnsCompleted: number;
  sessionId: string;
  findings: EvalFinding[];
  turns: TurnAudit[];
  rawProbe?: RawProbeReport;
  passed: boolean;
  latencyMs: number;
}

export interface RawProbeReport {
  modelUsed: string | null;
  isMock: boolean;
  narrative: string;
  choiceCount: number;
  diceless: number;
  checkedDcs: number[];
  rescued: number;
  errors: string[];
  warnings: string[];
  memoryCount: number;
  duplicateMemorySummaries: string[];
}

/**
 * Tier-2-grade RAW audit for the real story: calls the shared production engine
 * in-process so the pre-guardrail payload can be inspected. This is the only
 * place DC bands / diceless-on-hostile-prose are asserted on model output.
 */
async function rawProbe(params: {
  storyId: string;
  playerState: PlayerState;
  ledger: any;
  sessionTurns: Array<{ turnNumber?: number; sceneId?: string; narrativeProse?: string }>;
  actionText: string;
  choice: ChoiceOption | undefined;
  diceRoll: number;
  isEnglish: boolean;
  isLowBase: boolean;
  validStatIds: string[];
}): Promise<RawProbeReport | null> {
  try {
    const [{ StoryRepository }, { migrateStoryManifestToUnifiedGraph }, { GameEngine }, { GeminiAdapter }, { generateValidatedScene }] =
      await Promise.all([
        import('@/lib/db/repositories/storyRepository'),
        import('@/lib/engines/world/graphMigration'),
        import('@/lib/engines/game/GameEngine'),
        import('@/lib/providers/GeminiAdapter'),
        import('@/lib/engines/narrative/narrativeTurn'),
      ]);

    const loaded = await StoryRepository.getStoryById(params.storyId);
    if (!loaded) {
      console.log(`  ${YELLOW}!${RESET} raw probe skipped — DB story ${params.storyId} not found`);
      return null;
    }
    const story = migrateStoryManifestToUnifiedGraph(loaded);

    const resolution = GameEngine.resolveActionCheck(params.actionText, params.playerState, story.rpgSystem, {
      statId: params.choice?.requiredStatId,
      targetDC: params.choice?.targetDC,
      riskLevel: params.choice?.riskLevel,
      forcedDiceRoll: params.diceRoll,
      worldBible: story.worldBible,
      currentLocationId: params.playerState.currentLocationId,
    } as never);

    const outcome = await generateValidatedScene(
      {
        story,
        playerState: params.playerState,
        resolution,
        playerActionText: params.actionText,
        ledger: params.ledger,
        sessionTurns: params.sessionTurns,
        sessionMemories: [],
        targetSceneId: undefined,
      },
      new GeminiAdapter()
    );

    const raw = outcome.raw;
    const narrative = typeof raw?.data?.narrative === 'string' ? raw.data.narrative : '';
    const rawChoices = Array.isArray(raw?.data?.choices) ? (raw.data.choices as unknown[]) : [];
    const audit = auditScene({
      narrative,
      choices: rawChoices as never,
      validStatIds: params.validStatIds,
      isEnglish: params.isEnglish,
      isLowBase: params.isLowBase,
      // Only demand checks when the scene actually depicts drawn weapons / hostile
      // actors — the documented invariant, applied identically to the scenarios.
      requireNoDiceless: hasHostileActors(narrative),
    });

    const memories = Array.isArray(raw?.data?.extractedMemories)
      ? (raw!.data!.extractedMemories as Array<{ summary?: string }>)
      : [];
    const summaries = memories.map((m) => (m?.summary ?? '').trim()).filter(Boolean);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const s of summaries) {
      const key = s.toLowerCase();
      if (seen.has(key)) duplicates.add(s);
      seen.add(key);
    }

    return {
      modelUsed: raw?.modelUsed ?? null,
      isMock: Boolean(outcome.aiResponse.isMock),
      narrative,
      choiceCount: rawChoices.length,
      diceless: audit.diceless,
      checkedDcs: audit.dcs,
      rescued: 0,
      errors: audit.errors,
      warnings: audit.warnings,
      memoryCount: memories.length,
      duplicateMemorySummaries: [...duplicates],
    };
  } catch (err) {
    console.log(`  ${YELLOW}!${RESET} raw probe failed: ${String(err).slice(0, 200)}`);
    return null;
  }
}

function firstVital(resources: Record<string, number> | undefined): number | undefined {
  if (!resources) return undefined;
  const value = resources.health ?? resources.hp ?? resources.HP;
  if (typeof value === 'number') return value;
  const first = Object.values(resources).find((v) => typeof v === 'number');
  return typeof first === 'number' ? first : undefined;
}

function clockLine(clocks: any[] | undefined): { summary?: string; segments?: number } {
  if (!Array.isArray(clocks) || !clocks.length) return {};
  return {
    summary: clocks
      .map((c) => `${c.name} ${c.currentSegments}/${c.maxSegments}${c.isTriggered ? '*' : ''}`)
      .join(' · '),
    segments: clocks.reduce((acc, c) => acc + (c.currentSegments ?? 0), 0),
  };
}

async function main(): Promise<number> {
  const started = Date.now();
  const findings: EvalFinding[] = [];
  const add = (severity: EvalFinding['severity'], rule: string, detail: string) =>
    findings.push({ severity, rule, detail });

  if (!PERSONAS[PERSONA]) {
    console.error(`Unknown persona "${PERSONA}". Choose: ${Object.keys(PERSONAS).join(', ')}`);
    return 1;
  }

  console.log(
    `\n${DIM}StoryForge real-world harness — ${STORY_ID} vs ${BASE_URL}${RESET}\n` +
      `${DIM}persona=${PERSONA} turns=${TURNS} seed=${SEED} rawProbe=${RAW_PROBE ? 'on' : 'off'}${RESET}\n`
  );

  const boot = await postJson('/api/play/session', { storyId: STORY_ID, userId: 'story-eval-harness' });
  if (!boot.json?.success || !boot.json?.data?.sessionId) {
    console.log(
      `  ${RED}x boot${RESET} POST /api/play/session -> ${boot.status} ${JSON.stringify(boot.json).slice(0, 300)}`
    );
    console.log(`\n  Is the dev server up (npm run dev in web/)? Is ${STORY_ID} in the app DB?\n`);
    return 1;
  }

  const data = boot.json.data;
  const sessionId = String(data.sessionId);
  const storyTitle: string = data.story?.title ?? STORY_ID;
  const language: string = data.story?.language ?? 'fa';
  const isEnglish = !/^(fa|persian|farsi)$/i.test(language);
  const rpgSystem = data.story?.rpgSystem ?? data.session?.rpgSystem;
  let playerState: PlayerState = (data.session?.playerState ?? data.playerState) as PlayerState;
  let ledger: any = data.session?.sagaLedger ?? data.sagaLedger;
  let choices: ChoiceOption[] = (data.currentBeat?.choices ?? []) as ChoiceOption[];
  const opening: string = String(data.currentBeat?.narrative ?? '');

  const statIds: string[] = [
    ...new Set([
      ...((rpgSystem?.stats ?? []).map((s: any) => s.id) as string[]),
      ...Object.keys(playerState?.stats ?? {}),
    ]),
  ].filter(Boolean);
  const isLowBase = Array.isArray(rpgSystem?.stats)
    ? rpgSystem.stats.length > 0 && rpgSystem.stats.every((s: any) => (s.baseValue ?? 10) <= 8)
    : false;
  const healthKey = resolveHealthKey(rpgSystem);

  console.log(`  ${DIM}session=${sessionId}${RESET}`);
  console.log(`  story: ${storyTitle} (${language})`);
  console.log(`  open : ${opening.replace(/\s+/g, ' ').slice(0, 120)}…`);
  console.log(`  stats: ${statIds.join(', ') || '(none)'}  lowBase=${isLowBase}`);
  console.log(
    `  pools: ${(rpgSystem?.resources ?? []).map((r: any) => r.id).join(', ') || '(none)'}  healthKey=${healthKey}`
  );
  console.log(`  opening choices=${choices.length}  hp=${playerState?.resources?.[healthKey] ?? '?'}\n`);

  if (!choices.length) {
    add('error', 'session.no_opening_choices', 'Session returned no opening choices — the reader would be stranded.');
  }
  if (opening.trim().length < 40) {
    add('warning', 'session.thin_opening', `Opening narrative is only ${opening.trim().length} chars.`);
  }

  const rng = makeRng(SEED);
  const persona = PERSONAS[PERSONA];
  const audits: TurnAudit[] = [];
  const blocked = new Set<string>();
  let rawProbeReport: RawProbeReport | undefined;

  for (let n = 1; n <= TURNS; n++) {
    const pool = choices.filter((c) => !blocked.has(c.id));
    const chosen = pickChoice(persona, pool.length ? pool : choices);
    const diceRoll = 1 + Math.floor(rng() * 20);
    const text = chosen?.text ?? `پیشروی محتاطانه — نوبت ${n}`;

    const body: Record<string, unknown> = {
      storyId: STORY_ID,
      sessionId,
      playerActionText: text,
      actionStyle: chosen?.style ?? 'free_text',
      riskLevel: chosen?.riskLevel ?? 'medium',
      turnNumber: n + 1,
      forcedDiceRoll: diceRoll,
    };
    if (chosen?.id) body.choiceId = chosen.id;
    if (chosen?.requiredStatId) body.statId = chosen.requiredStatId;
    if (typeof chosen?.targetDC === 'number') body.targetDC = chosen.targetDC;

    let res: { status: number; json: any; latencyMs: number };
    try {
      res = await postJson('/api/play/action', body);
    } catch (err) {
      audits.push({
        turn: n,
        actionText: text,
        choiceId: chosen?.id,
        transport: 'failed',
        httpStatus: 0,
        latencyMs: 0,
        heuristic: { errors: [], warnings: [] },
        error: `fetch failed: ${String(err).slice(0, 200)}`,
      });
      add('error', 'transport.fetch_failed', `Turn ${n} could not reach the server: ${String(err).slice(0, 160)}`);
      break;
    }

    const d = res.json?.data ?? {};

    if (!res.json?.success) {
      const reason: string = res.json?.rejectionReason ?? res.json?.error ?? 'unknown';
      audits.push({
        turn: n,
        actionText: text,
        choiceId: chosen?.id,
        transport: 'rejected',
        httpStatus: res.status,
        latencyMs: res.latencyMs,
        heuristic: { errors: [], warnings: [] },
        rejectionReason: reason,
      });
      if (chosen?.id) blocked.add(chosen.id);
      console.log(`  ${YELLOW}!${RESET} turn ${n} rejected (${res.status}) ${reason.slice(0, 110)}`);
      add('warning', 'route.rejected_action', `Turn ${n} action rejected by the guardrail: ${reason.slice(0, 140)}`);
      continue;
    }

    const beat = d.beat ?? {};
    const resolution = d.resolution ?? {};
    const nextState: PlayerState = d.updatedPlayerState ?? playerState;
    const narrative: string = String(beat.narrativeProse ?? '');
    const presented = (beat.presentedChoices ?? []) as ChoiceOption[];
    const clocks = d.activeTensionClocks ?? nextState.activeTensionClocks ?? [];
    const vital = nextState.resources?.[healthKey];
    const maxVital = nextState.maxResources?.[healthKey] ?? playerState?.maxResources?.[healthKey];
    const clock = clockLine(clocks);
    const audit = auditScene({ narrative, choices: presented, validStatIds: statIds, isEnglish, isLowBase });

    const routeFindings: string[] = [];
    for (const f of d.resolution?.proseFindings ?? []) {
      const label = `${f.category ?? 'prose'}${f.severity ? `/${f.severity}` : ''}`;
      routeFindings.push(`${label}: ${String(f.message ?? f.detail ?? '').slice(0, 120)}`);
    }

    audits.push({
      turn: n,
      actionText: text,
      choiceId: chosen?.id,
      transport: 'ok',
      httpStatus: res.status,
      latencyMs: res.latencyMs,
      outcome: resolution.outcome,
      roll: resolution.diceRoll,
      dc: resolution.difficultyClass,
      statId: resolution.statId,
      hp: vital,
      hpMax: maxVital,
      clockSummary: clock.summary,
      clockSegments: clock.segments,
      defeat: Boolean(d.isDefeat),
      defeatCount: typeof d.defeatCount === 'number' ? d.defeatCount : undefined,
      locationChanged: Boolean(d.locationChanged),
      proseRepaired: Boolean(d.proseRepaired),
      routeFindings,
      proseWords: audit.words,
      choiceCount: presented.length,
      dicelessCount: audit.diceless,
      checkedDcs: audit.dcs,
      warnedStats: audit.warnedStats,
      heuristic: { errors: audit.errors, warnings: audit.warnings },
      narrative,
      choices: presented,
    });

    for (const e of audit.errors) add('error', 'turn.heuristic', `Turn ${n}: ${e}`);
    for (const w of audit.warnings) add('warning', 'turn.heuristic', `Turn ${n}: ${w}`);

    // Script purity — stray non-Persian/non-Latin glyphs are a visible defect.
    const foreign = foreignGlyphs(narrative);
    if (foreign.length) {
      add(
        'error',
        'prose.foreign_script',
        `Turn ${n}: prose contains glyphs from a foreign writing system: ${foreign.join(', ')}`
      );
    }
    if (presented.length) {
      const choiceGlyphs = foreignGlyphs(presented.map((c) => c.text ?? '').join(' '));
      if (choiceGlyphs.length) {
        add(
          'error',
          'prose.foreign_script',
          `Turn ${n}: choice text contains foreign-script glyphs: ${choiceGlyphs.join(', ')}`
        );
      }
    }

    // Production-safety invariant, scoped exactly like the guardrail: no
    // confrontational choice may ship diceless.
    const unsafe = confrontationalDiceless(presented);
    if (unsafe.length) {
      add(
        'error',
        'turn.diceless_standoff',
        `Turn ${n}: shipped ${unsafe.length} confrontational diceless choice(s) — the standoff guardrail did not fire: ` +
          unsafe.map((c) => `"${(c.text ?? '').slice(0, 48)}"`).join(', ')
      );
    }
    if (routeFindings.length) {
      add('warning', 'route.prose_findings', `Turn ${n} shipped prose findings: ${routeFindings.join(' | ')}`);
    }
    if (d.proseRepaired) {
      add(
        'warning',
        'route.prose_repaired',
        `Turn ${n}: prose needed the repair pass (first draft broke canon/outcome rules).`
      );
    }

    console.log(
      `  ${DIM}turn ${n}${RESET} roll ${String(audits[audits.length - 1].roll ?? 0).padStart(2)} ` +
        `${String(resolution.outcome ?? '?').padEnd(16)} dc ${String(resolution.difficultyClass ?? '-').padStart(2)} ` +
        `hp ${String(vital ?? '?').padStart(3)} ${DIM}${String(clock.summary ?? '')}${RESET} ` +
        `${DIM}${text.slice(0, 44)}${RESET}`
    );
    for (const e of audit.errors) console.log(`        ${RED}x${RESET} ${e}`);
    if (VERBOSE) {
      console.log(`        ${DIM}prose: ${narrative.replace(/\s+/g, ' ').slice(0, 260)}…${RESET}`);
      for (const c of presented) {
        console.log(
          `        ${DIM}· ${String(c.requiredStatId ?? 'DICELESS').padEnd(10)} ` +
            `dc ${String(c.targetDC ?? '-').padStart(2)} ${String(c.riskLevel ?? '').padEnd(7)} ` +
            `${(c.style ?? '').padEnd(12)} ${(c.text ?? '').slice(0, 56)}${RESET}`
        );
      }
    }

    // Advance with server-authoritative state only.
    playerState = nextState;
    ledger = d.sagaLedger ?? ledger;
    if (presented.length) choices = presented;

    if (RAW_PROBE && !rawProbeReport) {
      rawProbeReport =
        (await rawProbe({
          storyId: STORY_ID,
          playerState,
          ledger,
          sessionTurns: audits
            .filter((a) => a.transport === 'ok' && a.narrative)
            .map((a) => ({ turnNumber: a.turn + 1, narrativeProse: a.narrative })),
          actionText: text,
          choice: chosen,
          diceRoll,
          isEnglish,
          isLowBase,
          validStatIds: statIds,
        })) ?? undefined;
    }
  }

  auditTrajectory(audits, findings, isEnglish);
  return report({
    storyTitle,
    language,
    sessionId,
    audits,
    findings,
    rawProbe: rawProbeReport,
    started,
  });
}

/**
 * Trajectory audit — the cross-turn invariants a single-scene evaluator cannot
 * see: HP/defeat coherence, clock responsiveness, empty choice panels, prose
 * loops, and whether a real story actually advances.
 */
function auditTrajectory(audits: TurnAudit[], findings: EvalFinding[], isEnglish: boolean): void {
  const add = (severity: EvalFinding['severity'], rule: string, detail: string) =>
    findings.push({ severity, rule, detail });
  const ok = audits.filter((a) => a.transport === 'ok');

  if (!ok.length) {
    add('error', 'trajectory.no_completed_turns', 'No turn completed successfully — the story is unplayable live.');
    return;
  }

  const rejected = audits.filter((a) => a.transport === 'rejected');
  if (rejected.length > ok.length) {
    add(
      'warning',
      'trajectory.excessive_rejections',
      `${rejected.length}/${audits.length} turns were rejected by the action guardrail — the presented choices may be implausible for the player's state.`
    );
  }

  // Health coherence: never below zero, and only under a defeat.
  for (const t of ok) {
    if (typeof t.hp === 'number' && t.hp < 0) {
      add('error', 'trajectory.negative_hp', `Turn ${t.turn} ended at HP ${t.hp} with no floor applied.`);
    }
    if (typeof t.hp === 'number' && typeof t.hpMax === 'number' && t.hpMax > 0 && t.hp > t.hpMax) {
      add('error', 'trajectory.hp_over_max', `Turn ${t.turn} HP ${t.hp} exceeds max ${t.hpMax}.`);
    }
    if (typeof t.hp === 'number' && t.hp === 0 && !t.defeat) {
      add('error', 'trajectory.hp_zero_no_defeat', `Turn ${t.turn} hit HP 0 without the defeat flag/event.`);
    }
  }

  // Defeat coherence. The Hybrid Defeat System (Option C) does NOT kill the
  // player: HP 0 applies escalating penalties and resumes play at the last safe
  // location. So a defeat must (a) revive above 0, and (b) increment defeatCount.
  // Continuation after a defeat is by design and is NOT a violation.
  for (const t of ok) {
    if (t.defeat) {
      if (typeof t.hp === 'number' && t.hp <= 0) {
        add(
          'error',
          'trajectory.defeat_not_resolved',
          `Turn ${t.turn} flagged a defeat but HP is still ${t.hp} — the hybrid revival did not restore the player.`
        );
      }
      const prev = ok[ok.indexOf(t) - 1];
      if (prev && typeof prev.defeatCount === 'number' && typeof t.defeatCount === 'number' && t.defeatCount <= prev.defeatCount) {
        add(
          'error',
          'trajectory.defeat_count_static',
          `Turn ${t.turn} triggered a defeat but defeatCount stayed ${t.defeatCount} (penalty not applied).`
        );
      }
    }
  }

  // Defeats must be rare escalations, not the steady state.
  const defeatTurns = ok.filter((t) => t.defeat).length;
  if (defeatTurns > Math.floor(ok.length / 2) && ok.length >= 4) {
    add(
      'warning',
      'trajectory.defeat_loop',
      `${defeatTurns}/${ok.length} turns ended in defeat — damage is outpacing the player's resources.`
    );
  }

  // Clock responsiveness.
  const clocked = ok.filter((t) => typeof t.clockSegments === 'number');
  if (clocked.length >= 2) {
    const first = clocked[0].clockSegments ?? 0;
    const last = clocked[clocked.length - 1].clockSegments ?? 0;
    const moved = clocked.some((t, i) => i > 0 && (t.clockSegments ?? 0) !== (clocked[i - 1].clockSegments ?? 0));
    if (first === 0 && last === 0 && !moved) {
      add('warning', 'trajectory.clock_inert', `Threat clocks never advanced across ${clocked.length} turns (complications may not be ticking them).`);
    }
  }

  // Panel integrity per turn — a stranded reader is a hard failure.
  for (const t of ok) {
    if (!t.choiceCount) {
      add('error', 'trajectory.empty_panel', `Turn ${t.turn} returned an empty decision panel.`);
    } else if (t.choiceCount === 1) {
      add('warning', 'trajectory.single_choice', `Turn ${t.turn} offered only one choice — agency is nominal.`);
    }
  }

  // Outcome variety: an all-success or all-failure run means DCs are miscalibrated.
  const outcomes = ok.map((t) => String(t.outcome ?? ''));
  const successes = outcomes.filter((o) => /success|crit/i.test(o)).length;
  const failures = outcomes.filter((o) => /fail|crit_fail|critical_failure/i.test(o)).length;
  if (ok.length >= 4 && failures === 0) {
    add('warning', 'trajectory.no_failures', `All ${ok.length} turns succeeded — DCs may be too low for a real story.`);
  }
  if (ok.length >= 4 && successes === 0) {
    add('warning', 'trajectory.no_successes', `All ${ok.length} turns failed — DCs may be too high / stats too low.`);
  }

  // Prose loop detection (cyclical traps).
  const prose = ok.filter((t) => t.narrative && (t.proseWords ?? 0) > 40);
  for (let i = 1; i < prose.length; i++) {
    const sim = jaccard(prose[i - 1].narrative!, prose[i].narrative!);
    if (sim > 0.82) {
      add('error', 'trajectory.prose_loop', `Turns ${prose[i - 1].turn}→${prose[i].turn} are ${(sim * 100).toFixed(0)}% identical (cyclical prose trap).`);
    } else if (sim > 0.68) {
      add('warning', 'trajectory.prose_repetition', `Turns ${prose[i - 1].turn}→${prose[i].turn} share ${(sim * 100).toFixed(0)}% of their vocabulary.`);
    }
  }

  // Prose thinness.
  for (const t of ok) {
    if ((t.proseWords ?? 0) > 0 && (t.proseWords ?? 0) < 80) {
      add('warning', 'trajectory.thin_prose', `Turn ${t.turn} prose is only ${t.proseWords} words — below the 150–450 literary target.`);
    }
  }

  // Bilingual leakage: a Persian story must not return English prose.
  if (!isEnglish) {
    for (const t of ok) {
      const text = t.narrative ?? '';
      if (!text.trim()) continue;
      const latin = (text.match(/[A-Za-z]/g) || []).length;
      const ratio = latin / Math.max(1, text.length);
      if (ratio > 0.5) {
        add('error', 'trajectory.language_leak', `Turn ${t.turn} prose is ${(ratio * 100).toFixed(0)}% Latin script in a Persian story.`);
      }
    }
  }
}

/**
 * Renders the run: per-turn audit, violation list, raw-probe section, verdict.
 * Returns the process exit code (0 = pass, 1 = errors present).
 */
function report(params: {
  storyTitle: string;
  language: string;
  sessionId: string;
  audits: TurnAudit[];
  findings: EvalFinding[];
  rawProbe?: RawProbeReport;
  started: number;
}): number {
  const { storyTitle, language, sessionId, audits, findings, rawProbe, started } = params;
  const ok = audits.filter((a) => a.transport === 'ok');
  const rejected = audits.filter((a) => a.transport === 'rejected');
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');

  console.log(`\n${DIM}${'─'.repeat(78)}${RESET}`);
  console.log(`  ${storyTitle} · ${language} · session ${sessionId}`);
  console.log(
    `  turns: ${ok.length} ok, ${rejected.length} rejected, ${audits.length - ok.length - rejected.length} failed`
  );
  console.log(`  model: ${rawProbe?.modelUsed ?? '(route-internal cascade)'}`);
  const latencies = ok.map((t) => t.latencyMs).filter((n) => n > 0);
  if (latencies.length) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    console.log(`  latency: avg ${avg}ms · max ${Math.max(...latencies)}ms`);
  }
  const words = ok.map((t) => t.proseWords ?? 0).filter((n) => n > 0);
  if (words.length) {
    const avg = Math.round(words.reduce((a, b) => a + b, 0) / words.length);
    console.log(`  prose: ${Math.min(...words)}–${Math.max(...words)} words (avg ${avg})`);
  }
  const diceless = ok.reduce((acc, t) => acc + (t.dicelessCount ?? 0), 0);
  const checked = ok.reduce((acc, t) => acc + (t.checkedDcs?.length ?? 0), 0);
  console.log(`  choices: ${checked} checked · ${diceless} diceless (post-guardrail)`);
  const repaired = ok.filter((t) => t.proseRepaired).length;
  if (repaired) console.log(`  prose repaired: ${repaired}/${ok.length} turn(s)`);

  if (rawProbe) {
    console.log(`\n  ${DIM}RAW probe (pre-guardrail, in-process) — informational${RESET}`);
    console.log(
      `    ${DIM}note: diceless here uses the prose-level standoff precondition, which is${RESET}`
    );
    console.log(
      `    ${DIM}      deliberately broader than the per-choice production rule; not scored.${RESET}`
    );
    console.log(`    model      : ${rawProbe.modelUsed ?? '(none)'}${rawProbe.isMock ? ' [MOCK]' : ''}`);
    console.log(`    choices    : ${rawProbe.choiceCount} raw · ${rawProbe.diceless} diceless`);
    console.log(`    dcs        : ${rawProbe.checkedDcs.join(', ') || '(none declared)'}`);
    console.log(`    memories   : ${rawProbe.memoryCount}`);
    if (rawProbe.duplicateMemorySummaries.length) {
      console.log(`    ${YELLOW}duplicate memory summaries${RESET}: ${rawProbe.duplicateMemorySummaries.length}`);
    }
    for (const e of rawProbe.errors) console.log(`    ${DIM}info (unscored error): ${e}${RESET}`);
    for (const w of rawProbe.warnings) console.log(`    ${DIM}info (unscored warning): ${w}${RESET}`);
    if (rawProbe.narrative) {
      console.log(`    ${DIM}prose: ${rawProbe.narrative.replace(/\s+/g, ' ').slice(0, 150)}…${RESET}`);
    }
  }

  if (errors.length) {
    console.log(`\n${RED}Errors${RESET}`);
    for (const f of errors) console.log(`  ${RED}x${RESET} [${f.rule}] ${f.detail}`);
  }
  if (warnings.length) {
    console.log(`\n${YELLOW}Warnings${RESET}`);
    for (const f of warnings) console.log(`  ${YELLOW}!${RESET} [${f.rule}] ${f.detail}`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (AS_JSON) {
    const payload: StoryRunReport = {
      storyId: STORY_ID,
      storyTitle,
      language,
      persona: PERSONA,
      seed: SEED,
      turnsRequested: TURNS,
      turnsCompleted: ok.length,
      sessionId,
      findings,
      turns: audits,
      rawProbe,
      passed: errors.length === 0,
      latencyMs: Date.now() - started,
    };
    const json = JSON.stringify(payload, null, 2);
    if (OUT) {
      fs.writeFileSync(OUT, json);
      console.log(`\n  report written to ${OUT}`);
    } else {
      console.log(json);
    }
  }

  console.log(
    `\n  ${errors.length === 0 ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`} — ` +
      `${errors.length} error(s), ${warnings.length} warning(s)  ${DIM}(${elapsed}s)${RESET}\n`
  );
  return errors.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\n${RED}harness crashed${RESET}: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });