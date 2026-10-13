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
    const combatMight = mightChoices.find(c =>
      /گزمه|سپر|شمشیر|حمله|درگیری|پیشروی|شکستن|نیرو|زور|مهار|دفاع|معبر|یورش|سد|کنار/.test(c.text)
    );
    const sel = combatMight || mightChoices[0];
    console.log(`\n=> Selected Might Choice: "${sel.text}"`);
    return sel;
  }

  // 2. Confrontation keywords
  const confrontKeywords = /گزمه|سرباز|سپر|شمشیر|حمله|درگیری|پیشروی|نیرو|زور|یورش|سد|معبر|کنار/;
  const confrontChoice = choices.find(c => confrontKeywords.test(c.text));
  if (confrontChoice) {
    console.log(`\n=> Selected Confrontation Choice: "${confrontChoice.text}"`);
    return confrontChoice;
  }

  // 3. Fallback to aggressive or first
  const aggressiveChoice = choices.find(c => c.actionStyle === 'aggressive');
  if (aggressiveChoice) {
    console.log(`\n=> Selected Aggressive Choice: "${aggressiveChoice.text}"`);
    return aggressiveChoice;
  }

  console.log(`\n=> Selected Fallback Choice: "${choices[0].text}"`);
  return choices[0];
}

async function runLivePlaytest() {
  console.log('================================================================');
  console.log('   LIVE PLAYTEST AGAINST https://afsanehsaz.ir                  ');
  console.log('   Story: خاکسترِ زروان (Ashes of Zarvan)                      ');
  console.log('   Character: برزین | Archetype: شمشیردار هیرام (Might Focus)  ');
  console.log('================================================================\n');

  console.log('1. Initializing new live playthrough session on afsanehsaz.ir...');
  const initRes = await fetch(`${BASE_URL}/api/play/session`, {
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
  const TOTAL_TURNS = 3;

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

    const actionRes = await fetch(`${BASE_URL}/api/play/action`, {
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
    console.log('\n--- Engine Deterministic Resolution ---');
    console.log(`Roll: ${resolution.diceRoll} + ${resolution.statBonus} (Bonus) + ${resolution.modifierSum} (Mod Sum) = ${resolution.totalScore} vs DC ${resolution.targetDC}`);
    console.log(`Outcome: ${resolution.outcome}`);
    if (resolution.modifiersApplied?.length) {
      console.log(`Modifiers Applied:`, resolution.modifiersApplied.map((m: any) => `${m.name || m.source} (${m.value >= 0 ? '+' : ''}${m.value})`).join(', '));
    }
    console.log(`Consequence: ${resolution.consequenceSummary}`);

    console.log('\n--- Generated Narrative Prose ---');
    console.log(payload.narrativeProse?.trim());

    // Check for stalling or repetition
    if (/بر سر پل|روی پل|سد راه|مانع عبور/.test(payload.narrativeProse) && resolution.outcome === 'success') {
      console.log('\n[Momentum Note]: Checking narrative progression beyond the bridge...');
    }

    playerState = payload.playerState || playerState;
    console.log('\nUpdated Resources:', playerState.resources);

    currentChoices = payload.presentedChoices || [];
    turnNumber++;
  }

  console.log('\n================================================================');
  console.log('   PLAYTEST COMPLETE                                           ');
  console.log('================================================================');
}

runLivePlaytest().catch(console.error);
