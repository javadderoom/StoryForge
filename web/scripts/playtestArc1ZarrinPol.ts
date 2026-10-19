// @ts-nocheck
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_PLAY_URL || 'https://afsanehsaz.ir';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZjJmMmFhYi1kNzQyLTRjYWEtYjA1My1jMTg0YmY5ZGU4ZTEiLCJwaG9uZU51bWJlciI6Iis5ODkyMTEzNTEzMzAiLCJlbWFpbCI6bnVsbCwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzkyMDc2NTM0LCJleHAiOjE3OTQ2Njg1MzR9.lW5Y2isAdawAhYHZ_kN7QzlFmQBMLd-pia59qDF_tYY';
const STORY_ID = 'story_mt4ofllt'; // طلا و لجن
const TARGET_LOCATION_ID = 'loc_mtr1h3jy_8dv6'; // زرین پل
const TARGET_LOCATION_NAME = 'زرین پل';

const LOG_FILE = path.join(process.cwd(), 'playtest_arc1_run.log');
fs.writeFileSync(LOG_FILE, `=== PLAYTEST LOG: طلا و لجن -> زرین پل ===\nStarted at: ${new Date().toISOString()}\n\n`);

function logOutput(...args: any[]) {
  console.log(...args);
  const text = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, text + '\n');
}

async function fetchWithRetry(url: string, options: any, maxRetries = 5): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 503 || res.status === 429) && attempt < maxRetries) {
        logOutput(`[HTTP Retry] Status ${res.status} on attempt ${attempt}. Waiting 15s for quota cooldown...`);
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      return res;
    } catch (err: any) {
      if (attempt < maxRetries && (err.code === 'ECONNRESET' || err.message?.includes('socket') || err.message?.includes('fetch failed'))) {
        logOutput(`[Network Retry] Attempt ${attempt} failed with ${err.code || err.message}. Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw err;
      }
    }
  }
}

function pickBestChoiceTowardsZarrinPol(choices: any[], playerState: any): any {
  logOutput('\n--- Available Choices ---');
  choices.forEach((c, i) => {
    logOutput(`[${i + 1}] ID: ${c.id || 'N/A'} | Stat: ${c.requiredStatId || 'none'} (DC ${c.targetDC ?? '-'}) | Style: ${c.style || c.actionStyle || 'tactical'}`);
    logOutput(`    "${c.text}"`);
  });

  // 1. Check if any choice mentions Zarrin Pol, bridge, caravan journey forward, or key arc 1 landmarks
  const progressKeywords = /زرین پل|پل|رباط سرخ|حرکت|ادامه مسیر|کاروان|جاده|پیشروی|سفر|به سوی|مقصد|سپیدچال|چاه سنگ/;
  
  // High preference for choices that progress journey or mention Zarrin Pol / bridge
  const journeyChoice = choices.find(c => /زرین پل|پل زرین/.test(c.text));
  if (journeyChoice) {
    logOutput(`\n=> Prioritizing Direct Target Choice: "${journeyChoice.text}"`);
    return journeyChoice;
  }

  const nextStopChoice = choices.find(c => /رباط سرخ|حرکت کاروان|ادامه مسیر|مسیر|جاده|راه افتادن/.test(c.text));
  if (nextStopChoice) {
    logOutput(`\n=> Prioritizing Route Advancement Choice: "${nextStopChoice.text}"`);
    return nextStopChoice;
  }

  // 2. Might-aligned choices (character strength: Might 14, Agility 12)
  const mightOrAgilityChoices = choices.filter(c => c.requiredStatId === 'might' || c.requiredStatId === 'agility');
  if (mightOrAgilityChoices.length > 0) {
    logOutput(`\n=> Selecting Stat-Advantaged Choice: "${mightOrAgilityChoices[0].text}"`);
    return mightOrAgilityChoices[0];
  }

  // 3. Low risk or interesting story choice
  const safeChoice = choices.find(c => c.riskLevel === 'low' || !c.riskLevel);
  if (safeChoice) {
    logOutput(`\n=> Selecting Narrative Choice: "${safeChoice.text}"`);
    return safeChoice;
  }

  return choices[0];
}

async function run() {
  logOutput('================================================================');
  logOutput('   LIVE PLAYTEST: طلا و لجن (Ashes of Zarvan / Gold & Silt)      ');
  logOutput('   Target Destination: زرین پل (Zarrin-Pol)                     ');
  logOutput('   Engine Tier: Plus 2x (gemini-3.8-flash via AI Prime)          ');
  logOutput('   User Role: ADMIN (Authorized Session)                        ');
  logOutput('================================================================\n');

  // Step 1: Start Session
  logOutput('1. Initializing game session on https://afsanehsaz.ir ...');
  const startRes = await fetchWithRetry(`${BASE_URL}/api/play/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      storyId: STORY_ID,
      characterSetup: {
        characterName: 'برزین',
        archetypeId: 'arch_hiram_bladebearer',
        backgroundId: 'bg_hiram_guard',
        allocatedStats: {
          might: 14,
          agility: 12,
          cunning: 10,
          charisma: 8,
          arcana: 6,
        },
      },
    }),
  });

  const startJson = await startRes.json();
  if (!startJson.success) {
    throw new Error(`Failed to initialize session: ${JSON.stringify(startJson)}`);
  }

  const { sessionId, playerState: initialPlayerState, currentBeat, lore } = startJson.data;
  logOutput(`✓ Session created: ${sessionId}`);
  logOutput(`Initial Location ID: ${initialPlayerState.currentLocationId}`);
  const startLoc = lore?.locations?.find((l: any) => l.id === initialPlayerState.currentLocationId);
  logOutput(`Initial Location Name: ${startLoc?.name || initialPlayerState.currentLocationId}`);
  logOutput('Stats:', initialPlayerState.stats);
  logOutput('Resources:', initialPlayerState.resources);
  logOutput('Conditions:', initialPlayerState.conditions);

  logOutput('\n[PROLOGUE / BEAT 1 NARRATIVE]:');
  logOutput(currentBeat.narrative);

  let playerState = initialPlayerState;
  let currentChoices = currentBeat.choices || [];
  let turnNumber = 2;
  const MAX_TURNS = 25; // safety cap for reaching Zarrin Pol

  let reachedTarget = false;

  while (turnNumber <= MAX_TURNS) {
    logOutput(`\n================================================================`);
    logOutput(`                   TURN ${turnNumber - 1} (Turn Number: ${turnNumber})`);
    logOutput(`================================================================`);

    // Check location
    const currLocId = playerState.currentLocationId;
    const currLoc = lore?.locations?.find((l: any) => l.id === currLocId);
    logOutput(`Current Location: ${currLoc?.name || currLocId} (${currLocId})`);

    if (currLocId === TARGET_LOCATION_ID || (currLoc?.name && currLoc.name.includes(TARGET_LOCATION_NAME))) {
      logOutput(`\n🎉 TARGET DESTINATION REACHED: ${currLoc?.name || TARGET_LOCATION_NAME}! Arc 1 Completed!`);
      reachedTarget = true;
      break;
    }

    let selectedChoice = null;
    let customAction = null;

    if (currentChoices && currentChoices.length > 0) {
      selectedChoice = pickBestChoiceTowardsZarrinPol(currentChoices, playerState);
    } else {
      logOutput('\n=> No choices provided. Generating contextual journey action towards Zarrin-Pol...');
      customAction = {
        text: 'همراه با کاروان و محافظان، مسیر سنگلاخی جادهٔ جنوب را به سمت زرین پل پی می‌گیرم و مراقب هرگونه خطر یا شبیخون در طول راه هستم.',
        style: 'tactical',
        riskLevel: 'medium',
        requiredStatId: 'might',
        targetDC: 12,
      };
      logOutput(`=> Custom Action: "${customAction.text}"`);
    }

    const actionPayload: any = {
      storyId: STORY_ID,
      sessionId,
      playerActionText: selectedChoice ? selectedChoice.text : customAction.text,
      actionStyle: selectedChoice ? (selectedChoice.style || selectedChoice.actionStyle || 'tactical') : customAction.style,
      riskLevel: selectedChoice ? (selectedChoice.riskLevel || 'medium') : customAction.riskLevel,
      statId: selectedChoice ? selectedChoice.requiredStatId : customAction.requiredStatId,
      targetDC: selectedChoice ? selectedChoice.targetDC : customAction.targetDC,
      choiceId: selectedChoice ? selectedChoice.id : undefined,
      engineTier: 'plus', // 2x Tier
      playerState,
      turnNumber,
    };

    logOutput(`\nSubmitting Turn ${turnNumber} Action (Engine Tier: plus 2x)...`);
    const actionStartTime = Date.now();
    const actionRes = await fetchWithRetry(`${BASE_URL}/api/play/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(actionPayload),
    });

    const elapsed = ((Date.now() - actionStartTime) / 1000).toFixed(1);
    logOutput(`✓ Action Response in ${elapsed}s (HTTP ${actionRes.status})`);

    const actionJson = await actionRes.json();
    if (!actionJson.success) {
      logOutput(`❌ Action failed:`, actionJson);
      break;
    }

    const data = actionJson.data;
    const resolution = data.resolution;
    const beat = data.beat || {};
    const narrativeProse = beat.narrativeProse || beat.narrative || data.narrativeProse;
    const nextChoices = beat.presentedChoices || beat.choices || data.presentedChoices || [];

    // Log Resolution
    if (resolution) {
      logOutput('\n--- Engine Deterministic Resolution ---');
      logOutput(`Roll: ${resolution.diceRoll} + ${resolution.statModifier ?? 0} (Stat: ${resolution.governingStat || resolution.statId || '-'}) = ${resolution.totalScore} vs DC ${resolution.difficultyClass ?? '-'}`);
      logOutput(`Outcome: ${resolution.outcome}`);
      logOutput(`Consequence Summary: ${resolution.consequenceSummary}`);
    }

    // Log Narrative Prose
    logOutput('\n--- Generated Narrative Prose (2x Tier) ---');
    logOutput(narrativeProse ? narrativeProse.trim() : '(No narrative returned)');

    // Log Interesting Encounters / Events check
    if (narrativeProse) {
      const lowerProse = narrativeProse;
      if (/شبیخون|هیولا|گرگ|راهزن|گزمه|خون|کشته|خطر|مرگ|جادو|پتیاره|وحشت|طوفان/.test(lowerProse)) {
        logOutput('\n🔔 [ENCOUNTER/EVENT DETECTED]: High-intensity narrative event triggered in this beat!');
      }
      if (/زرین پل|پل/.test(lowerProse)) {
        logOutput('🔔 [NARRATIVE MILESTONE]: Zarrin-Pol / Bridge referenced in prose!');
      }
    }

    // State Updates
    playerState = data.updatedPlayerState || data.playerState || playerState;
    logOutput('\n--- Updated State ---');
    logOutput(`Location: ${playerState.currentLocationId}`);
    logOutput('Resources:', playerState.resources);
    logOutput('Conditions:', playerState.conditions);
    if (playerState.inventory) {
      logOutput(`Inventory Count: ${playerState.inventory.length} items`);
    }

    currentChoices = nextChoices;
    turnNumber++;

    // Check if narrative says we arrived at Zarrin Pol or playerState location matches
    if (playerState.currentLocationId === TARGET_LOCATION_ID ||
        (narrativeProse && /رسیدن به زرین پل|وارد زرین پل|دروازهٔ زرین پل|بر روی زرین پل|به زرین پل رسید/.test(narrativeProse))) {
      logOutput(`\n🎉 REACHED ZARRIN POL MILESTONE! Arc 1 Concluded.`);
      reachedTarget = true;
      break;
    }

    // Brief pause between turns to respect rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  logOutput('\n================================================================');
  logOutput(`   PLAYTEST FINISHED | Target Reached: ${reachedTarget ? 'YES' : 'NO'}`);
  logOutput(`   Total Turns Played: ${turnNumber - 1}`);
  logOutput(`   Log written to: ${LOG_FILE}`);
  logOutput('================================================================\n');
}

run().catch(err => {
  logOutput('FATAL PLAYTEST ERROR:', err);
  process.exit(1);
});
