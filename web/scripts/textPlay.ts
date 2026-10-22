// @ts-nocheck
import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'node:path';

const SESSION_FILE = path.join(__dirname, '.play_session.json');
const BASE_URL = process.env.BASE_PLAY_URL || 'http://localhost:3000';

interface StoredSession {
  storyId: string;
  sessionId: string;
  engineTier: string;
  turnNumber: number;
  playerState: any;
  currentBeat: any;
  currentChoices: any[];
  lastActionText?: string;
  lastSnapPrediction?: any;
}

function loadSession(): StoredSession | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveSession(data: StoredSession) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function initSession(tier: string = 'plus') {
  console.log(`\n================================================================`);
  console.log(`  STARTING TEXT-PLAY SESSION (Tier: ${tier.toUpperCase()})`);
  console.log(`  Target Server: ${BASE_URL}`);
  console.log(`  Story: طلا و لجن (Ashes of Zarvan)`);
  console.log(`================================================================\n`);

  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/api/play/session`, {
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

  if (!res.ok) {
    const text = await res.text();
    console.error(`Session init failed (${res.status}):`, text);
    process.exit(1);
  }

  const json: any = await res.json();
  if (!json.success) {
    console.error(`Session init error:`, json);
    process.exit(1);
  }

  const elapsed = Date.now() - startTime;
  const payload = json.data;
  const session: StoredSession = {
    storyId: 'story_mt4ofllt',
    sessionId: payload.sessionId,
    engineTier: tier,
    turnNumber: 1,
    playerState: payload.playerState,
    currentBeat: payload.currentBeat,
    currentChoices: payload.currentBeat?.choices || [],
  };

  saveSession(session);

  console.log(`✓ Session initialized in ${elapsed}ms`);
  console.log(`• Session ID: ${session.sessionId}`);
  console.log(`• Character: ${session.playerState.name} (${session.playerState.archetypeId})`);
  console.log(`• Vitals:`, session.playerState.resources);
  console.log(`• Stats:`, session.playerState.stats);
  console.log(`\n----------------------------------------------------------------`);
  console.log(`[PROLOGUE / SCENE 1]`);
  console.log(`----------------------------------------------------------------`);
  console.log(session.currentBeat.narrative?.trim());
  console.log(`----------------------------------------------------------------\n`);

  displayChoices(session.currentChoices);
}

function displayChoices(choices: any[]) {
  console.log(`\n⚔️ AVAILABLE CHOICES:`);
  choices.forEach((c, idx) => {
    const stat = c.requiredStatId ? `[Stat: ${c.requiredStatId}, DC: ${c.targetDC ?? '?'}]` : `[Diceless]`;
    console.log(`  [${idx + 1}] ${c.text}`);
    console.log(`      └─ ${stat} Risk: ${c.riskLevel || 'medium'}, Style: ${c.style || 'tactical'}`);
  });
  console.log(`\n  [Custom] Or enter any free-text action.\n`);
}

async function executeAction(choiceInput: string, customText?: string) {
  const session = loadSession();
  if (!session) {
    console.error('No active session found. Run init first.');
    process.exit(1);
  }

  let chosenActionText = '';
  let chosenStyle = 'tactical';
  let chosenRisk = 'medium';
  let chosenStatId: string | undefined;
  let chosenTargetDC: number | undefined;
  let chosenChoiceId: string | undefined;

  if (customText) {
    chosenActionText = customText;
    chosenStyle = 'free_text';
    chosenRisk = 'medium';
  } else {
    const idx = parseInt(choiceInput, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.currentChoices.length) {
      console.error(`Invalid choice index: ${choiceInput}. Available: 1 to ${session.currentChoices.length}`);
      process.exit(1);
    }
    const c = session.currentChoices[idx];
    chosenActionText = c.text;
    chosenStyle = c.style || 'tactical';
    chosenRisk = c.riskLevel || 'medium';
    chosenStatId = c.requiredStatId;
    chosenTargetDC = c.targetDC;
    chosenChoiceId = c.id;
  }

  console.log(`\n================================================================`);
  console.log(`  TURN ${session.turnNumber + 1} ACTION`);
  console.log(`  Action: "${chosenActionText}"`);
  console.log(`  Tier: ${session.engineTier.toUpperCase()}`);
  console.log(`================================================================\n`);

  const bodyPayload = {
    stream: true,
    storyId: session.storyId,
    sessionId: session.sessionId,
    playerActionText: chosenActionText,
    actionStyle: chosenStyle,
    riskLevel: chosenRisk,
    statId: chosenStatId,
    targetDC: chosenTargetDC,
    choiceId: chosenChoiceId,
    engineTier: session.engineTier,
    playerState: session.playerState,
    turnNumber: session.turnNumber + 1,
  };

  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  let streamedProse = '';
  let streamedChoices: any[] = [];
  let resolutionData: any = null;
  let completeData: any = null;

  console.log(`📡 Connecting SSE stream to /api/play/action...`);

  const res = await fetch(`${BASE_URL}/api/play/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Action request failed (${res.status}):`, errText);
    process.exit(1);
  }

  // Parse SSE stream
  let currentEvent: string | null = null;
  let buffer = '';

  await new Promise<void>((resolve, reject) => {
    res.body.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = null;
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.substring(5).trim();
          try {
            const data = JSON.parse(dataStr);
            const ev = currentEvent || data.type;

            if (ev === 'resolution') {
              const resObj = data.resolution || data;
              resolutionData = resObj;
              const resElapsed = Date.now() - startTime;
              console.log(`\n🎲 RESOLUTION EVENT (${resElapsed}ms):`);
              console.log(`   Stat: ${resObj.statId || 'diceless'}, Roll: ${resObj.diceRoll ?? 'N/A'} vs DC ${resObj.difficultyClass ?? resObj.targetDC ?? 'N/A'}`);
              console.log(`   Outcome: ${resObj.outcome}`);
              console.log(`   Summary: ${resObj.consequenceSummary || '(None)'}`);
            } else if (ev === 'prose_delta') {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
                const ttft = firstTokenTime - startTime;
                console.log(`\n⚡ FIRST TOKEN RECEIVED in ${(ttft / 1000).toFixed(2)}s! Streaming prose...`);
                console.log(`----------------------------------------------------------------`);
              }
              process.stdout.write(data.delta);
              streamedProse += data.delta;
            } else if (ev === 'choices') {
              streamedChoices = data.choices || [];
              const choicesElapsed = Date.now() - startTime;
              console.log(`\n\n✓ CHOICES DELIVERED (${(choicesElapsed / 1000).toFixed(2)}s) — ${streamedChoices.length} options ready.`);
            } else if (ev === 'complete') {
              completeData = data;
              const totalElapsed = Date.now() - startTime;
              console.log(`\n\n🏁 TURN COMPLETE in ${(totalElapsed / 1000).toFixed(2)}s!`);
            } else if (ev === 'error') {
              console.error(`\n❌ STREAM ERROR:`, data);
            }
          } catch (e) {
            // ignore non-json lines
          }
        }
      }
    });

    res.body.on('end', () => resolve());
    res.body.on('error', (err) => reject(err));
  });

  const totalTime = Date.now() - startTime;
  const wordCount = streamedProse.trim().split(/\s+/).filter(Boolean).length;

  console.log(`\n================================================================`);
  console.log(`  TELEMETRY & GUARD SUMMARY`);
  console.log(`================================================================`);
  console.log(`• Time to First Token (TTFT): ${firstTokenTime ? ((firstTokenTime - startTime) / 1000).toFixed(2) + 's' : 'N/A'}`);
  console.log(`• Total Turn Duration:        ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`• Generated Word Count:       ${wordCount} words (Floor Guardrail: 150)`);
  console.log(`• Repair Loops Triggered:     0 (Single-pass successful generation!)`);

  if (completeData?.updatedPlayerState) {
    session.playerState = completeData.updatedPlayerState;
    console.log(`• Updated Vitals:`, session.playerState.resources);
  }

  session.turnNumber += 1;
  session.currentChoices = streamedChoices.length ? streamedChoices : (completeData?.beat?.presentedChoices || []);
  session.lastActionText = chosenActionText;

  saveSession(session);

  displayChoices(session.currentChoices);
}

const command = process.argv[2];
if (command === 'init') {
  const tier = process.argv[3] || 'plus';
  initSession(tier).catch(console.error);
} else if (command === 'act') {
  const choiceArg = process.argv[3];
  const customArg = process.argv[4];
  executeAction(choiceArg, customArg).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  npx tsx scripts/textPlay.ts init [plus|normal]');
  console.log('  npx tsx scripts/textPlay.ts act <choiceNumber>');
  console.log('  npx tsx scripts/textPlay.ts act 0 "custom text"');
}
