// @ts-nocheck
import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_PLAY_URL || 'https://afsanehsaz.ir';

interface ChoiceOption {
  id?: string;
  text: string;
  actionStyle?: string;
  riskLevel?: string;
  requiredStatId?: string;
  targetDC?: number;
}

function selectMightOrConfrontationChoice(choices: ChoiceOption[]): ChoiceOption {
  console.log('\n--- Available Choices ---');
  choices.forEach((c, i) => {
    console.log(`[${i + 1}] (Stat: ${c.requiredStatId || 'diceless'}, DC: ${c.targetDC ?? 'N/A'}, Risk: ${c.riskLevel || 'medium'}, Style: ${c.actionStyle || 'tactical'})`);
    console.log(`    "${c.text}"`);
  });

  // 1. Explicitly Might
  const mightChoices = choices.filter(c => c.requiredStatId === 'might');
  if (mightChoices.length > 0) {
    const violentMight = mightChoices.find(c =>
      /حمله|یورش|شمشیر|سپر|گزمه|سرباز|درگیری|زور|نیرو|کوبیدن|ارعاب|هجوم|شکستن/.test(c.text)
    );
    const sel = violentMight || mightChoices[0];
    console.log(`\n=> Selected Might Choice: "${sel.text}"`);
    return sel;
  }

  // 2. High-force, violent, combat or intimidation choices
  const violentKeywords = /حمله|یورش|هجوم|درگیری|شمشیر|سپر|ارعاب|زور|کوبیدن|گزمه|سرباز|تهدید/;
  const violentChoices = choices.filter(c => violentKeywords.test(c.text) && !/پرس‌وجو|مذاکره|پنهانی|خزیدن/.test(c.text));
  if (violentChoices.length > 0) {
    console.log(`\n=> Selected Violent/Forceful Choice: "${violentChoices[0].text}"`);
    return violentChoices[0];
  }

  // 3. Any confrontation with guards or enemies
  const confrontChoice = choices.find(c => /گزمه|سرباز|ارعاب|تهدید/.test(c.text));
  if (confrontChoice) {
    console.log(`\n=> Selected Confrontation Choice: "${confrontChoice.text}"`);
    return confrontChoice;
  }

  // 4. Fallback to aggressive or first
  const aggressiveChoice = choices.find(c => c.actionStyle === 'aggressive');
  if (aggressiveChoice) {
    console.log(`\n=> Selected Aggressive Choice: "${aggressiveChoice.text}"`);
    return aggressiveChoice;
  }

  console.log(`\n=> Selected Fallback Choice: "${choices[0].text}"`);
  return choices[0];
}

async function fetchWithRetry(url: string, options: any, maxRetries = 4): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if ((res.status === 503 || res.status === 429) && attempt < maxRetries) {
        console.warn(`[HTTP Retry] Status ${res.status} on attempt ${attempt}. Waiting 15s for Gemini quota cooldown...`);
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      return res;
    } catch (err: any) {
      if (attempt < maxRetries && (err.code === 'ECONNRESET' || err.message?.includes('socket') || err.message?.includes('fetch failed'))) {
        console.warn(`[Network Retry] Attempt ${attempt} failed with ${err.code || err.message}. Retrying in 2.5s...`);
        await new Promise(r => setTimeout(r, 2500));
      } else {
        throw err;
      }
    }
  }
}

async function runLivePlaytest() {
  console.log('================================================================');
  console.log('   LIVE PLAYTEST AGAINST https://afsanehsaz.ir                  ');
  console.log('   Story: خاکسترِ زروان (Ashes of Zarvan)                      ');
  console.log('   Character: برزین | Archetype: شمشیردار هیرام (Might Focus)  ');
  console.log('================================================================\n');

  console.log('1. Initializing new live playthrough session on afsanehsaz.ir...');
  const initRes = await fetchWithRetry(`${BASE_URL}/api/play/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storyId: 'story_mt4ofllt',
      characterSetup: {
        characterName: 'برزین',
        archetypeId: 'arch_hiram_bladebearer',
        backgroundId: 'bg_hiram_guard',
      },
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Failed to initialize session: ${initRes.status} ${errText}`);
  }

  const initData: any = await initRes.json();
  if (!initData.success) {
    throw new Error(`Session API returned failure: ${JSON.stringify(initData)}`);
  }

  const { sessionId, playerState: initialPlayerState, currentBeat } = initData.data;
  console.log(`✓ Session initialized successfully!`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Initial Stats:`, initialPlayerState.stats);
  console.log(`Initial Resources:`, initialPlayerState.resources);
  console.log(`Equipped Items:`, initialPlayerState.equipment);

  console.log(`\n----------------------------------------------------------------`);
  console.log(`[PROLOGUE / OPENING SCENE]`);
  console.log(currentBeat.narrative?.trim());
  console.log(`----------------------------------------------------------------`);

  let playerState = initialPlayerState;
  let currentChoices: ChoiceOption[] = currentBeat.choices || [];
  let turnNumber = 2;
  const TOTAL_TURNS = 2;

  for (let turn = 1; turn <= TOTAL_TURNS; turn++) {
    console.log(`\n================================================================`);
    console.log(`                   TURN ${turn} (Turn Number: ${turnNumber})`);
    console.log(`================================================================`);

    let chosen: ChoiceOption;
    if (!currentChoices || currentChoices.length === 0) {
      console.log('\n[Opening Action]: Using default aggressive confrontation action...');
      chosen = {
        text: 'با شمشیر و سپر به سمت گزمه‌های روی پل یورش می‌برم و سد معبر را با زور باز می‌کنم.',
        actionStyle: 'aggressive',
        riskLevel: 'high',
        requiredStatId: 'might',
      };
      console.log(`=> Action: "${chosen.text}" (Stat: might, Risk: high)`);
    } else {
      chosen = selectMightOrConfrontationChoice(currentChoices);
    }

    console.log(`\nSubmitting action to ${BASE_URL}/api/play/action...`);
    const actionStartTime = Date.now();

    const actionRes = await fetchWithRetry(`${BASE_URL}/api/play/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: 'story_mt4ofllt',
        sessionId,
        playerActionText: chosen.text,
        actionStyle: chosen.actionStyle || 'aggressive',
        riskLevel: chosen.riskLevel || 'medium',
        statId: chosen.requiredStatId,
        targetDC: chosen.targetDC,
        playerState,
        turnNumber,
      }),
    });

    const elapsedMs = Date.now() - actionStartTime;
    console.log(`✓ Response received in ${(elapsedMs / 1000).toFixed(1)}s (Status: ${actionRes.status})`);

    if (!actionRes.ok) {
      const errText = await actionRes.text();
      console.error(`Action API failed: ${actionRes.status} ${errText}`);
      break;
    }

    const actionData: any = await actionRes.json();
    if (!actionData.success) {
      console.error(`Action API returned failure:`, actionData);
      break;
    }

    const payload = actionData.data;
    const resolution = payload.resolution;
    const beat = payload.beat || {};
    const narrativeProse = beat.narrativeProse || beat.narrative || payload.narrativeProse;
    const nextChoices = beat.presentedChoices || beat.choices || payload.presentedChoices || [];

    console.log('\n--- Engine Deterministic Resolution ---');
    console.log(`Roll: ${resolution.diceRoll} + ${resolution.statModifier ?? 0} (Stat Mod) + ${resolution.environmentalModifier ?? 0} (Env Mod) = ${resolution.totalScore} vs DC ${resolution.difficultyClass}`);
    console.log(`Outcome: ${resolution.outcome}`);
    if (resolution.abilityContributions?.length) {
      console.log(`Ability Contributions:`, resolution.abilityContributions.map((m: any) => `${m.name} (${m.modifier >= 0 ? '+' : ''}${m.modifier})`).join(', '));
    }
    console.log(`Consequence: ${resolution.consequenceSummary}`);

    console.log('\n--- Generated Narrative Prose ---');
    console.log(narrativeProse ? narrativeProse.trim() : '(No prose returned)');

    playerState = payload.updatedPlayerState || payload.playerState || playerState;
    console.log('\nUpdated Resources:', playerState.resources);

    currentChoices = nextChoices;
    turnNumber++;
  }

  console.log('\n================================================================');
  console.log('   PLAYTEST COMPLETE                                           ');
  console.log('================================================================');
}

runLivePlaytest().catch(console.error);
