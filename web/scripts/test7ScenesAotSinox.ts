import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';
process.env.ENABLE_SNAP_AOT = 'true';

import { extractJsonPayload } from '../src/lib/ai/geminiClient';
import type { SceneModelCall, RawSceneData, RawSceneResult } from '../src/lib/engines/narrative/modelCall';
import type { ChoiceOption, PlayerState, CheckResolution, DiceOutcome } from '../src/lib/types/gameplay';
import type { WorldStateLedger } from '../src/lib/types/world';

const SINOX_API_KEY = process.env.SINOX_API_KEY || '';
const SINOX_MODEL = 't-gemini-4-argon';
const SINOX_ENDPOINT = 'https://sinoxapi.com/v1/chat/completions';

/**
 * Custom SceneModelCall seam routing narrative generation to Sinox t-gemini-4-argon
 * with lowered reasoning effort / thinking budget for speed.
 */
const sinoxModelCall: SceneModelCall = async (prompt, options = {}): Promise<RawSceneResult | null> => {
  const t0 = Date.now();
  const messages = [
    { role: 'system', content: prompt.systemPrompt },
    { role: 'user', content: prompt.userPrompt },
  ];

  const payload: any = {
    model: SINOX_MODEL,
    messages,
    temperature: options.temperature ?? 0.75,
    response_format: { type: 'json_object' },
    reasoning_effort: 'low',
    thinking: { type: 'enabled', budget_tokens: 512 },
  };

  const res = await fetch(SINOX_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SINOX_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const durationMs = Date.now() - t0;
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error(`[SinoxAdapter] HTTP ${res.status} in ${durationMs}ms: ${errorText}`);
    return null;
  }

  const json = (await res.json()) as any;
  const rawText = json?.choices?.[0]?.message?.content || '';
  if (!rawText) return null;

  const cleaned = extractJsonPayload(rawText);
  try {
    const parsed = JSON.parse(cleaned) as RawSceneData;
    return {
      data: parsed,
      rawText,
      modelUsed: `sinox/${SINOX_MODEL}`,
    };
  } catch (err) {
    console.error('[SinoxAdapter] JSON parse error:', err, 'Preview:', cleaned.slice(0, 200));
    return null;
  }
};

async function main() {
  const { getPrisma } = await import('../src/lib/db/client');
  const { StoryRepository } = await import('../src/lib/db/repositories/storyRepository');
  const { migrateStoryManifestToUnifiedGraph } = await import('../src/lib/engines/world/graphMigration');
  const { GeminiAdapter } = await import('../src/lib/providers/GeminiAdapter');
  const { SubQAdapter } = await import('../src/lib/providers/SubQAdapter');
  const { predictSnapChoice, buildNpcIdToName } = await import('../src/lib/engines/narrative/snapPredictor');
  const { preGenerateAotBranch } = await import('../src/lib/engines/narrative/aotBranchEngine');
  const { generateValidatedScene } = await import('../src/lib/engines/narrative/narrativeTurn');
  const { GameEngine } = await import('../src/lib/engines/game/GameEngine');
  const { ActionValidator } = await import('../src/lib/engines/validator/ActionValidator');

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database connection failed.');
  }

  const STORY_ID = 'story_mt4ofllt'; // "طلا و لجن"
  console.log(`\n=============================================================`);
  console.log(`=== StoryForge 7-Scene Playthrough Test: t-gemini-4-argon ===`);
  console.log(`=============================================================`);

  const rawStory = await StoryRepository.getStoryById(STORY_ID);
  if (!rawStory) {
    throw new Error(`Story ${STORY_ID} not found in database.`);
  }

  const story = migrateStoryManifestToUnifiedGraph(rawStory);
  console.log(`Story loaded: "${story.title}" (${story.language || 'fa'})`);

  // Load latest active session as base
  const baseSession = await prisma.playthroughSession.findFirst({
    where: { storyId: STORY_ID },
    orderBy: { updatedAt: 'desc' },
    include: {
      turns: {
        orderBy: { turnNumber: 'asc' },
      },
    },
  });

  if (!baseSession) {
    throw new Error(`No play sessions found for story ${STORY_ID}.`);
  }

  console.log(`Found base session ${baseSession.sessionId} with ${baseSession.turns.length} turn(s).`);

  // Create an isolated test session so we don't mess up the user's manual playthrough
  const testSessionId = `test_sim_7scenes_${Date.now()}`;
  console.log(`Creating isolated test session: ${testSessionId}...`);

  const initialPlayerState = JSON.parse(JSON.stringify(baseSession.playerState)) as PlayerState;
  const initialSagaLedger = JSON.parse(JSON.stringify(baseSession.sagaLedger || null)) as WorldStateLedger | null;

  const testSession = await prisma.playthroughSession.create({
    data: {
      sessionId: testSessionId,
      storyId: STORY_ID,
      userId: baseSession.userId,
      playerState: initialPlayerState as any,
      sagaLedger: initialSagaLedger as any,
      currentSceneId: baseSession.currentSceneId,
      currentChapterId: baseSession.currentChapterId,
      turnCount: baseSession.turns.length,
    },
  });

  // Copy previous turns into test session
  for (const t of baseSession.turns) {
    await prisma.turnHistory.create({
      data: {
        sessionId: testSessionId,
        turnNumber: t.turnNumber,
        sceneId: t.sceneId,
        playerActionText: t.playerActionText,
        actionStyle: t.actionStyle,
        narrativeProse: t.narrativeProse,
        presentedChoices: t.presentedChoices as any,
        resolution: (t.resolution as any) || {},
      },
    });
  }

  const sinoxGeminiAdapter = new GeminiAdapter(undefined, SINOX_MODEL, {
    modelCall: sinoxModelCall,
  });
  const subqAdapter = new SubQAdapter();

  let currentPlayerState = initialPlayerState;
  let currentSagaLedger = initialSagaLedger;
  let currentTurnNumber = baseSession.turns.length; // usually 2
  const lastTurn = baseSession.turns[baseSession.turns.length - 1];
  let currentProse = lastTurn.narrativeProse || '';
  let currentChoices = (lastTurn.presentedChoices as unknown as ChoiceOption[]) || [];

  const statsResults: Array<{
    sceneIndex: number;
    turnNumber: number;
    actionTaken: string;
    predictedChoice: string;
    predictedConfidence: number;
    hit: boolean;
    wordCount: number;
    paragraphCount: number;
    latencyMs: number;
  }> = [];

  const TOTAL_SCENES = 7;

  for (let sceneIdx = 1; sceneIdx <= TOTAL_SCENES; sceneIdx++) {
    console.log(`\n-------------------------------------------------------------`);
    console.log(`>>> PROCESSING SCENE ${sceneIdx} / ${TOTAL_SCENES} (Advancing to Turn #${currentTurnNumber + 1}) <<<`);
    console.log(`-------------------------------------------------------------`);

    // Fetch existing turns for context
    const currentSessionTurns = await prisma.turnHistory.findMany({
      where: { sessionId: testSessionId },
      orderBy: { turnNumber: 'asc' },
    });

    console.log(`\n[Scene ${sceneIdx}] Current choices on screen (${currentChoices.length}):`);
    currentChoices.forEach((c, idx) => console.log(`  [${idx + 1}] (${c.id}) ${c.text}`));

    // 1. SubQ Dwell Prediction
    const dwellT0 = Date.now();
    console.log(`\n[SubQ] Predicting reader choice during dwell...`);
    const historyTurns = currentSessionTurns.map((t: any) => ({
      turnNumber: t.turnNumber,
      playerActionText: t.playerActionText,
      narrativeProse: t.narrativeProse,
    }));

    const predictionResult = await predictSnapChoice(
      {
        storyTitle: story.title,
        storyLanguage: story.language,
        npcIdToName: buildNpcIdToName(story.worldBible?.npcs),
        currentProse,
        choices: currentChoices,
        playerState: currentPlayerState,
        history: historyTurns,
      },
      subqAdapter
    );

    const prediction = predictionResult.prediction;
    const predictedChoiceId = prediction?.predictedChoiceId || currentChoices[0].id;
    const predictedConfidence = prediction?.confidence ?? 0.5;
    const predictedChoice = currentChoices.find((c) => c.id === predictedChoiceId) || currentChoices[0];

    console.log(`[SubQ] Prediction: "${predictedChoice.text}" (${predictedChoice.id})`);
    console.log(`[SubQ] Confidence: ${(predictedConfidence * 100).toFixed(1)}% | Latency: ${Date.now() - dwellT0}ms`);
    if (prediction?.probabilities) {
      console.log(`[SubQ] Probabilities:`, JSON.stringify(prediction.probabilities));
    }

    // 2. AOT Pre-Generation for the predicted choice
    console.log(`\n[AOT] Pre-generating branch for predicted choice: "${predictedChoice.text}"...`);
    const aotT0 = Date.now();
    let aotResult: any = null;
    try {
      aotResult = await preGenerateAotBranch({
        story,
        playerState: currentPlayerState,
        choice: predictedChoice,
        turnNumber: currentTurnNumber,
        sagaLedger: currentSagaLedger,
        currentChapterId: testSession.currentChapterId ?? null,
        sessionTurns: currentSessionTurns.map((t: any) => ({
          turnNumber: t.turnNumber,
          narrativeProse: t.narrativeProse,
          playerActionText: t.playerActionText,
          presentedChoices: t.presentedChoices as any,
        })),
        sessionMemories: [],
        geminiAdapter: sinoxGeminiAdapter,
        subqAdapter,
      });
      console.log(`[AOT] Pre-generation completed in ${Date.now() - aotT0}ms | Status: ${aotResult.status} | Verdict: ${aotResult.audit?.verdict}`);
    } catch (err: any) {
      console.error('[AOT] Pre-generation failed:', err.message);
    }

    // 3. Reader Decision Simulation
    // To realistically evaluate prediction hit rate, reader decides:
    // If probabilities exist, use weighted choice sampling; otherwise pick top choice.
    let selectedChoice: ChoiceOption = currentChoices[0];
    if (prediction?.probabilities && Object.keys(prediction.probabilities).length > 0) {
      const rand = Math.random();
      let cumulative = 0;
      for (const choice of currentChoices) {
        const prob = prediction.probabilities[choice.id] ?? (1 / currentChoices.length);
        cumulative += prob;
        if (rand <= cumulative) {
          selectedChoice = choice;
          break;
        }
      }
    } else {
      selectedChoice = currentChoices[Math.floor(Math.random() * currentChoices.length)];
    }

    const isHit = selectedChoice.id === predictedChoice.id;
    console.log(`\n======================================================`);
    console.log(`[Decision] Reader chose: "${selectedChoice.text}" (${selectedChoice.id})`);
    console.log(`[Decision] Predicted:    "${predictedChoice.text}" (${predictedChoice.id})`);
    console.log(`[Result]   >>> ${isHit ? '⚡ SNAP HIT! ⚡' : '❌ SNAP MISS ❌'} <<<`);
    console.log(`======================================================`);

    // 4. Resolve Turn & Generate Scene
    const nextTurnNumber = currentTurnNumber + 1;
    let nextProse = '';
    let nextChoices: ChoiceOption[] = [];
    let stateDiff: any = {};
    let turnLatencyMs = 0;

    if (isHit && aotResult && aotResult.status === 'generated' && aotResult.narrative) {
      // HIT PATH: Serve AOT branch!
      console.log(`[Engine] Serving pre-generated AOT branch...`);
      const serveT0 = Date.now();
      // Enforce 2000ms minimum delay floor for pacing
      const MIN_DELAY_MS = 2000;
      await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));
      turnLatencyMs = Date.now() - serveT0;

      nextProse = aotResult.narrative;
      nextChoices = (aotResult.choices as ChoiceOption[]) || [];
      stateDiff = aotResult.resolution?.stateDiff || {};
      if (aotResult.resolution) {
        currentPlayerState = GameEngine.applyStateMutation(
          currentPlayerState,
          aotResult.resolution.stateDiff,
          story.rpgSystem
        );
      }
    } else {
      // MISS PATH: Generate on-demand with t-gemini-4-argon
      console.log(`[Engine] Generating turn on-demand via Sinox ${SINOX_MODEL}...`);
      const genT0 = Date.now();

      // Deterministic check resolution
      const isDiceless = selectedChoice.targetDC === undefined && selectedChoice.requiredStatId === undefined;
      let checkOutcome: DiceOutcome = 'success';
      let diceRoll = 10;
      if (!isDiceless) {
        diceRoll = Math.floor(Math.random() * 20) + 1;
        const dc = selectedChoice.targetDC || 10;
        checkOutcome = diceRoll >= dc ? 'success' : 'failure';
      }

      const resolution: CheckResolution = {
        actionDescription: selectedChoice.text,
        outcome: checkOutcome,
        diceRoll,
        diceType: 'd20',
        difficultyClass: selectedChoice.targetDC || 10,
        statId: selectedChoice.requiredStatId,
        statModifier: 0,
        environmentalModifier: 0,
        totalScore: diceRoll,
        consequenceSummary: `اقدام انتخاب شد: ${selectedChoice.text}`,
        stateDiff: {},
      };

      currentPlayerState = GameEngine.applyStateMutation(
        currentPlayerState,
        resolution.stateDiff,
        story.rpgSystem
      );

      const ledgerPatch = GameEngine.deriveLedgerPatch(resolution.stateDiff, story.worldBible);
      currentSagaLedger = GameEngine.mergeLedgerPatch(currentSagaLedger, ledgerPatch);

      const secretSanitizer = (choices: any[]) => {
        const priorSnippets = currentSessionTurns
          .slice(-3)
          .map((t: any) => t.narrativeProse)
          .filter(Boolean);
        return ActionValidator.sanitizeChoices(
          choices,
          currentPlayerState,
          story.worldBible,
          story.storyNpcOverrides,
          priorSnippets
        );
      };

      const sceneOutcome = await generateValidatedScene(
        {
          story,
          playerState: currentPlayerState,
          resolution,
          playerActionText: selectedChoice.text,
          ledger: currentSagaLedger,
          sessionTurns: currentSessionTurns.map((t: any) => ({
            turnNumber: t.turnNumber,
            narrativeProse: t.narrativeProse,
            playerActionText: t.playerActionText,
            presentedChoices: t.presentedChoices as any,
          })),
          sessionMemories: [],
          activeChapter: null,
        },
        sinoxGeminiAdapter,
        secretSanitizer,
        subqAdapter
      );

      turnLatencyMs = Date.now() - genT0;
      nextProse = sceneOutcome.aiResponse.narrative;
      nextChoices = sceneOutcome.aiResponse.choices as ChoiceOption[];
      stateDiff = resolution.stateDiff;
    }

    const wordCount = nextProse.trim().split(/\s+/).filter(Boolean).length;
    const paragraphCount = nextProse.split(/\n\n+/).filter(Boolean).length;

    // Persist new turn in DB
    await prisma.turnHistory.create({
      data: {
        sessionId: testSessionId,
        turnNumber: nextTurnNumber,
        sceneId: `scene_${nextTurnNumber}`,
        playerActionText: selectedChoice.text,
        actionStyle: selectedChoice.style || 'free_text',
        narrativeProse: nextProse,
        presentedChoices: nextChoices as any,
        resolution: (stateDiff as any) || {},
      },
    });

    await prisma.playthroughSession.update({
      where: { sessionId: testSessionId },
      data: {
        turnCount: nextTurnNumber,
        playerState: currentPlayerState as any,
        sagaLedger: currentSagaLedger as any,
      },
    });

    // Record stats
    statsResults.push({
      sceneIndex: sceneIdx,
      turnNumber: nextTurnNumber,
      actionTaken: selectedChoice.text,
      predictedChoice: predictedChoice.text,
      predictedConfidence: predictedConfidence,
      hit: isHit,
      wordCount,
      paragraphCount,
      latencyMs: turnLatencyMs,
    });

    // Output scene narrative & choices
    console.log(`\n======================================================`);
    console.log(`=== SCENE ${sceneIdx} / ${TOTAL_SCENES} OUTPUT (Turn #${nextTurnNumber}) ===`);
    console.log(`======================================================`);
    console.log(`Word Count:      ${wordCount} words (Target: 450 - 700)`);
    console.log(`Paragraphs:      ${paragraphCount} paragraphs`);
    console.log(`Latency:         ${turnLatencyMs}ms (${isHit ? 'Snap AOT Cached Serving' : 'On-Demand Generation'})`);
    console.log(`\n--- Narrative Prose ---`);
    console.log(nextProse);
    console.log(`\n--- Next Choices ---`);
    nextChoices.forEach((nc, idx) => console.log(`  [${idx + 1}] (${nc.id}) ${nc.text}`));
    console.log(`======================================================\n`);

    // Advance pointers
    currentTurnNumber = nextTurnNumber;
    currentProse = nextProse;
    currentChoices = nextChoices;
  }

  // 5. Final Report & Analytics
  console.log(`\n\n=============================================================`);
  console.log(`                     FINAL TEST REPORT                      `);
  console.log(`=============================================================`);
  console.log(`Model:             ${SINOX_MODEL} (Sinox API)`);
  console.log(`Reasoning Effort:  low`);
  console.log(`Total Scenes:      ${TOTAL_SCENES}`);

  const totalHits = statsResults.filter((r) => r.hit).length;
  const totalMisses = TOTAL_SCENES - totalHits;
  const hitRate = ((totalHits / TOTAL_SCENES) * 100).toFixed(1);

  console.log(`Hits:              ${totalHits} / ${TOTAL_SCENES} (${hitRate}%)`);
  console.log(`Misses:            ${totalMisses} / ${TOTAL_SCENES}`);

  console.log(`\nScene Breakdown:`);
  console.log(`---------------------------------------------------------------------------------------------------------`);
  console.log(`| # | Turn | Hit? | Words | Paras | Latency | Confidence | Chosen Action`);
  console.log(`---------------------------------------------------------------------------------------------------------`);
  for (const r of statsResults) {
    const hitBadge = r.hit ? 'HIT ' : 'MISS';
    console.log(
      `| ${r.sceneIndex} | #${r.turnNumber.toString().padEnd(3)} | ${hitBadge} | ${r.wordCount.toString().padStart(5)} | ${r.paragraphCount.toString().padStart(5)} | ${r.latencyMs.toString().padStart(6)}ms | ${(r.predictedConfidence * 100).toFixed(0).padStart(3)}%        | "${r.actionTaken.slice(0, 35)}..."`
    );
  }
  console.log(`---------------------------------------------------------------------------------------------------------`);

  const avgWords = Math.round(statsResults.reduce((acc, r) => acc + r.wordCount, 0) / TOTAL_SCENES);
  console.log(`Average Word Count: ${avgWords} words/scene`);
  console.log(`=============================================================\n`);
}

main()
  .catch((err) => {
    console.error('Fatal error in simulation:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
