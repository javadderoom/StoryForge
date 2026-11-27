/**
 * Automated Zero-API Local Story Playtester (Antigravity Local Narrator).
 *
 * Exercises the FULL production gameplay pipeline (`POST /api/play/session` +
 * `POST /api/play/action`: GameEngine dice/stats, ActionValidator,
 * EncounterEvaluator, travelEngine, QuestEngine, WorldContext, ProseValidator)
 * without making ANY external AI API calls (Gemini / AI Prime / Sinox / SubQ).
 *
 * Usage:
 *   npm run playtest:local
 *   npm run playtest:local -- --story=story_mt4ofllt --turns=18 --verbose
 *   npm run playtest:local -- --script=./path/to/custom-scenes.json
 *   npm run playtest:local -- --url=http://localhost:3000 --turns=10
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

// Load .env cleanly before importing server modules
const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) loadEnv?.call(process, envPath);
} catch {
  /* .env optional */
}

// Force local zero-API narrator for this playtest process
process.env.STORYFORGE_LOCAL_PLAYTEST = 'true';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function getArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PersonaMode = 'quest' | 'diplomat' | 'brute' | 'shadow';

function pickBestChoice(
  choices: any[],
  persona: PersonaMode,
  usedTexts: Set<string>,
  rng: () => number
): any {
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const scoreChoice = (c: any) => {
    let score = 0;
    const text = String(c.text || '');
    const style = String(c.style || '').toLowerCase();
    const stat = String(c.requiredStatId || '').toLowerCase();

    if (!usedTexts.has(text)) score += 20;
    if (/حرکت|سفر|کاروان|جاده|ادامه|مسیر|پیشنهاد|مأموریت|برخورد|مهار|پیشقدم|travel|caravan|road|confront|press|follow|head-on/i.test(text)) {
      score += persona === 'quest' ? 8 : 3;
    }
    if (persona === 'diplomat' && (style === 'diplomatic' || stat === 'charisma')) score += 6;
    if (persona === 'brute' && (style === 'aggressive' || stat === 'might')) score += 6;
    if (persona === 'shadow' && (style === 'stealthy' || stat === 'agility')) score += 6;
    if (persona === 'quest' && (style === 'tactical' || style === 'diplomatic')) score += 4;
    // Small tie-breaker jitter for variety across turns
    score += rng() * 1.5;
    return score;
  };

  return [...choices].sort((a, b) => scoreChoice(b) - scoreChoice(a))[0];
}

const BLOCKED_AI_HOST_RE = /(generativelanguage\.googleapis\.com|api\.subq\.ai|aiprime|sinox|openai\.com|anthropic\.com)/i;

async function main() {
  const storyId = getArg('story') || 'story_mt4ofllt';
  const maxTurns = Number(getArg('turns') || '18');
  const seed = Number(getArg('seed') || '2026');
  const persona = (getArg('persona') || 'quest') as PersonaMode;
  const scriptPath = getArg('script');
  const remoteUrl = getArg('url');
  const verbose = hasFlag('verbose');
  const asJson = hasFlag('json');
  const keepSession = hasFlag('keep-session');

  if (scriptPath) {
    process.env.STORYFORGE_LOCAL_SCRIPT_PATH = path.resolve(process.cwd(), scriptPath);
  }

  let externalAiCallCount = 0;
  const originalFetch = globalThis.fetch;

  if (!remoteUrl) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (BLOCKED_AI_HOST_RE.test(target)) {
        externalAiCallCount += 1;
        throw new Error(`[localPlaytest] Blocked unexpected external AI call to: ${target}`);
      }
      return originalFetch(input as any, init);
    }) as typeof fetch;
  }

  const rng = makeRng(seed);
  const startTime = Date.now();

  const sessionRoute = remoteUrl ? null : await import('@/app/api/play/session/route');
  const actionRoute = remoteUrl ? null : await import('@/app/api/play/action/route');

  async function callApi(routePath: 'session' | 'action', body: unknown) {
    if (remoteUrl) {
      const res = await originalFetch(`${remoteUrl}/api/play/${routePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-storyforge-local-playtest': 'true',
        },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json() };
    }

    const req = new NextRequest(`http://localhost:3000/api/play/${routePath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-storyforge-local-playtest': 'true',
      },
      body: JSON.stringify(body),
    });
    const res =
      routePath === 'session'
        ? await sessionRoute!.POST(req)
        : await actionRoute!.POST(req);
    return { status: res.status, json: await res.json() };
  }

  // 1. Start session
  const initResp = await callApi('session', {
    storyId,
    localPlaytest: true,
    characterSetup: {
      characterName: 'برزین (تست لوکال)',
      archetypeId: 'arch_hiram_bladebearer',
      backgroundId: 'bg_hiram_guard',
    },
  });

  if (!initResp.json?.success) {
    console.error(`${RED}Session init failed (${initResp.status}):${RESET}`, initResp.json);
    process.exitCode = 1;
    return;
  }

  const initData = initResp.json.data;
  const sessionId: string = initData.sessionId;
  let playerState = initData.playerState;
  let turnNumber: number = initData.turnNumber ?? 1;
  let currentChoices: any[] = initData.currentBeat?.choices || [];
  const usedChoiceTexts = new Set<string>();

  const locationsVisited = new Set<string>([playerState.currentLocationId].filter(Boolean));
  const encountersSeen = new Set<string>();
  const creaturesDiscovered = new Set<string>(playerState.discoveredCreatureIds || []);
  const npcsDiscovered = new Set<string>();
  const errors: string[] = [];
  const turnReports: any[] = [];

  if (!asJson) {
    console.log(
      `\n${CYAN}=== StoryForge Local Zero-API Playtest (Antigravity Narrator) ===${RESET}\n` +
        `${DIM}story=${storyId} session=${sessionId} persona=${persona} maxTurns=${maxTurns} mode=${remoteUrl ? `HTTP(${remoteUrl})` : 'IN-PROCESS'}${RESET}\n`
    );
    if (verbose) {
      console.log(`${DIM}[Turn 1 Opening]${RESET}\n${initData.currentBeat?.narrative?.trim()}\n`);
    }
  }

  try {
    for (let i = 0; i < maxTurns; i++) {
      const nextTurn = turnNumber + 1;
      const chosen = pickBestChoice(currentChoices, persona, usedChoiceTexts, rng);
      const actionText = chosen?.text || 'حرکت به سوی مقصد بعدی و بررسی پیرامون';
      if (chosen?.text) usedChoiceTexts.add(chosen.text);

      // Seeded roll mostly playable (6..20) with occasional setback rolls to test failure-forward too
      const roll = Math.floor(rng() * 15) + 6;

      const resp = await callApi('action', {
        storyId,
        sessionId,
        playerActionText: actionText,
        actionStyle: chosen?.style || 'tactical',
        riskLevel: chosen?.riskLevel || 'medium',
        statId: chosen?.requiredStatId,
        targetDC: chosen?.targetDC,
        forcedDiceRoll: roll,
        playerState,
        turnNumber: nextTurn,
        choiceId: chosen?.id,
        localPlaytest: true,
      });

      if (resp.status >= 400 || !resp.json?.success) {
        const extra = resp.json?.proseFindings ? ` findings=${JSON.stringify(resp.json.proseFindings)}` : '';
        errors.push(`Turn ${nextTurn} HTTP ${resp.status}: ${resp.json?.error || 'unknown error'}${extra}`);
        break;
      }

      const d = resp.json.data;
      playerState = d.updatedPlayerState;
      turnNumber = nextTurn;
      currentChoices = d.beat?.presentedChoices || [];

      if (playerState.currentLocationId) locationsVisited.add(playerState.currentLocationId);
      for (const cId of playerState.discoveredCreatureIds || []) creaturesDiscovered.add(cId);
      if (d.beat?.discoveredNpc?.id) npcsDiscovered.add(d.beat.discoveredNpc.id);
      for (const npc of d.beat?.discoveredNpcs || []) {
        if (npc?.id) npcsDiscovered.add(npc.id);
      }
      const encId = d.beat?.activeEncounterId || d.resolution?.activeEncounterId;
      if (encId) encountersSeen.add(encId);

      const proseFindings: any[] = d.resolution?.proseFindings || [];
      const findingErrors = proseFindings.filter((f) => f.severity === 'error');
      for (const fe of findingErrors) {
        errors.push(`Turn ${nextTurn} ProseValidator [${fe.category}]: ${fe.detail}`);
      }

      const travelObj = playerState.travel;
      const travelInfo = travelObj
        ? `${travelObj.routeId || 'travel'}->${travelObj.destinationLocationId || '?'}(idx:${travelObj.currentNodeIndex ?? 0}/${travelObj.totalTurns ?? '?'}${travelObj.pausedTurns ? `,hold:${travelObj.pausedTurns}` : ''})`
        : '-';

      const row = {
        turn: nextTurn,
        roll,
        outcome: d.resolution?.outcome || 'unknown',
        location: playerState.currentLocationId,
        travel: travelInfo,
        silver: playerState.purse?.silver ?? 0,
        items: (playerState.inventory || []).length,
        xp: playerState.xp ?? 0,
        completedQuests: playerState.completedQuestIds || [],
        wordCount: String(d.beat?.narrativeProse || '').trim().split(/\s+/).filter(Boolean).length,
        findings: proseFindings.length,
      };
      turnReports.push(row);

      if (!asJson) {
        console.log(
          `  ${DIM}T${String(nextTurn).padStart(2, '0')}${RESET} roll=${String(roll).padStart(2)} ${row.outcome.padEnd(14)} loc=${String(row.location).padEnd(20)} travel=${travelInfo.padEnd(28)} silver=${String(row.silver).padStart(3)} items=${row.items} words=${row.wordCount}`
        );
        if (verbose) {
          console.log(`${DIM}     Action:${RESET} ${actionText}`);
          console.log(`     ${d.beat?.narrativeProse?.replace(/\n+/g, '\n     ')}\n`);
        }
      }

      if (currentChoices.length === 0) break;
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (!remoteUrl && !keepSession) {
      try {
        const { SessionRepository } = await import('@/lib/db/repositories/sessionRepository');
        await SessionRepository.deleteSession(sessionId);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  const passed = errors.length === 0 && externalAiCallCount === 0 && turnReports.length > 0;

  const summary = {
    passed,
    storyId,
    turnsExecuted: turnReports.length,
    elapsedMs,
    externalAiCallCount,
    locationsVisited: [...locationsVisited],
    encountersSeen: [...encountersSeen],
    creaturesDiscovered: [...creaturesDiscovered],
    npcsDiscovered: [...npcsDiscovered],
    completedQuestIds: playerState.completedQuestIds || [],
    finalSilver: playerState.purse?.silver ?? 0,
    finalItemIds: (playerState.inventory || []).map((i: any) => i.id),
    errors,
    turns: turnReports,
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n${CYAN}=== Playtest Audit Summary ===${RESET}`);
    console.log(`  Turns Run          : ${turnReports.length} (${elapsedMs}ms)`);
    console.log(`  External AI Calls  : ${externalAiCallCount === 0 ? `${GREEN}0${RESET}` : `${RED}${externalAiCallCount}${RESET}`}`);
    console.log(`  Locations Visited  : ${summary.locationsVisited.join(' -> ')}`);
    console.log(`  Creatures Discov.  : ${summary.creaturesDiscovered.join(', ') || 'none'}`);
    console.log(`  NPCs Discovered    : ${summary.npcsDiscovered.join(', ') || 'none'}`);
    console.log(`  Completed Quests   : ${summary.completedQuestIds.join(', ') || 'none'}`);
    console.log(`  Final Silver/Items : ${summary.finalSilver} silver | ${summary.finalItemIds.length} items`);
    if (errors.length) {
      console.log(`\n${RED}Errors:${RESET}`);
      for (const err of errors) console.log(`  ${RED}x${RESET} ${err}`);
    }
    console.log(`\n${passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}\n`);
  }

  process.exitCode = passed ? 0 : 1;
}

main().catch((err) => {
  console.error('Local playtest crashed:', err);
  process.exitCode = 1;
});
