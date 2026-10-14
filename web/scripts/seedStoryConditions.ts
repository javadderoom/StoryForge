import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database not configured');
  }

  const storyId = 'story_mt4ofllt';
  const story = await prisma.story.findUnique({
    where: { id: storyId },
  });

  if (!story) {
    throw new Error(`Story ${storyId} not found`);
  }

  const manifest = (story.manifest as any) || {};
  manifest.startingConditions = ['ناآشنا', 'هوشیار'];

  await prisma.story.update({
    where: { id: storyId },
    data: { manifest },
  });

  console.log(`✅ Updated story ${storyId} manifest with startingConditions: ['ناآشنا', 'هوشیار']`);

  // Update existing sessions if they lack conditions
  const sessions = await prisma.playthroughSession.findMany({
    where: { storyId },
  });

  let updatedSessions = 0;
  for (const session of sessions) {
    const playerState = (session.playerState as any) || {};
    if (!Array.isArray(playerState.conditions) || playerState.conditions.length === 0) {
      playerState.conditions = ['ناآشنا', 'هوشیار'];
      await prisma.playthroughSession.update({
        where: { sessionId: session.sessionId },
        data: { playerState },
      });
      updatedSessions++;
    }
  }

  console.log(`✅ Updated ${updatedSessions} of ${sessions.length} sessions with initial conditions.`);
}

main()
  .catch((err) => {
    console.error('Error seeding story conditions:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
