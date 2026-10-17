import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';
process.env.ENABLE_SNAP_AOT = 'true';

import type { ChoiceOption } from '../src/lib/types/gameplay';

async function main() {
  const { getPrisma } = await import('../src/lib/db/client');
  const { StoryRepository } = await import('../src/lib/db/repositories/storyRepository');
  const { migrateStoryManifestToUnifiedGraph } = await import('../src/lib/engines/world/graphMigration');
  const { GeminiAdapter } = await import('../src/lib/providers/GeminiAdapter');
  const { SubQAdapter } = await import('../src/lib/providers/SubQAdapter');
  const { preGenerateSnapAotBranch } = await import('../src/lib/play/snapAot');

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database connection failed.');
  }

  const STORY_ID = 'story_mt4ofllt'; // Real story: "طلا و لجن"
  console.log(`\n=== StoryForge AOT Test via Native Gemini ===`);
  console.log(`Fetching story ${STORY_ID}...`);

  const rawStory = await StoryRepository.getStoryById(STORY_ID);
  if (!rawStory) {
    throw new Error(`Story ${STORY_ID} not found in database.`);
  }

  const story = migrateStoryManifestToUnifiedGraph(rawStory);
  console.log(`Story loaded: "${story.title}" (${story.language || 'fa'})`);

  // Find latest active play session
  const session = await prisma.playthroughSession.findFirst({
    where: { storyId: STORY_ID },
    orderBy: { updatedAt: 'desc' },
    include: {
      turns: {
        orderBy: { turnNumber: 'desc' },
        take: 3,
      },
    },
  });

  if (!session) {
    throw new Error(`No play sessions found for story ${STORY_ID}.`);
  }

  console.log(`Found session ${session.sessionId} with ${session.turns.length} recent turn(s).`);
  const lastTurn = session.turns[0];
  if (!lastTurn) {
    throw new Error(`Session ${session.sessionId} has no turns.`);
  }

  console.log(`Current Turn #${lastTurn.turnNumber}:`);
  console.log(`Action: "${lastTurn.playerActionText}"`);
  console.log(`Prose snippet: "${lastTurn.narrativeProse?.slice(0, 120)}..."`);

  const presentedChoices = (lastTurn.presentedChoices as unknown as ChoiceOption[]) || [];
  console.log(`Presented choices (${presentedChoices.length}):`);
  presentedChoices.forEach((c, idx) => console.log(`  [${idx + 1}] (${c.id}) ${c.text}`));

  if (presentedChoices.length === 0) {
    throw new Error('Last turn has no presented choices to predict or pre-generate.');
  }

  // Predict the first choice for our AOT dwell test
  const targetChoice = presentedChoices[0];
  console.log(`\nSimulating AOT pre-generation for choice: "${targetChoice.text}" (${targetChoice.id})`);

  // Native Gemini Adapter using our configured Gemini environment
  const geminiAdapter = new GeminiAdapter();

  const startTime = Date.now();
  await preGenerateSnapAotBranch(
    {
      sessionId: session.sessionId,
      storyId: STORY_ID,
      turnNumber: lastTurn.turnNumber ?? 1,
      story,
      choice: targetChoice,
      caller: { id: session.userId || 'guest_user', role: 'USER' },
    },
    {
      geminiAdapter,
      subqAdapter: new SubQAdapter(),
    }
  );
  const totalElapsedMs = Date.now() - startTime;

  console.log(`\nAOT dwell pre-generation finished in ${totalElapsedMs}ms.`);

  // Query stored snap_aot_branches row
  const branchRow = await prisma.snapAotBranch.findFirst({
    where: {
      sessionId: session.sessionId,
      turnNumber: lastTurn.turnNumber ?? 1,
      predictedChoiceId: targetChoice.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!branchRow) {
    console.error('No branch row found in snap_aot_branches table!');
    return;
  }

  console.log('\n=============================================');
  console.log('           AOT SNAP BRANCH RESULT            ');
  console.log('=============================================');
  console.log(`ID:             ${branchRow.id}`);
  console.log(`Status:         ${branchRow.status}`);
  console.log(`Model:          ${branchRow.model}`);
  console.log(`Verdict:        ${branchRow.verdict}`);
  console.log(`Dice Pre-Roll:  ${branchRow.diceRoll} (Diceless: ${branchRow.isDiceless})`);
  console.log(`Outcome:        ${branchRow.outcome}`);
  console.log(`Latency:        ${branchRow.latencyMs}ms`);

  if (branchRow.narrative) {
    const words = branchRow.narrative.trim().split(/\s+/).filter(Boolean).length;
    const paragraphs = branchRow.narrative.split(/\n\n+/).filter(Boolean).length;
    console.log(`\nWord Count:     ${words} words (Target: 450 - 700)`);
    console.log(`Paragraphs:     ${paragraphs} paragraphs (Target: 4 - 5)`);
    console.log('\n--- Narrative Prose ---');
    console.log(branchRow.narrative);
  }

  if (branchRow.choices) {
    console.log('\n--- Next Generated Choices ---');
    console.log(JSON.stringify(branchRow.choices, null, 2));
  }

  if (branchRow.audit) {
    console.log('\n--- Audit & Findings ---');
    console.log(JSON.stringify(branchRow.audit, null, 2));
  }
  console.log('=============================================\n');
}

main()
  .catch((err) => {
    console.error('Fatal error in main:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
