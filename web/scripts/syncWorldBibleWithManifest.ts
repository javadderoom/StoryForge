import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('Database not connected');

  const story = await prisma.story.findUnique({
    where: { id: 'story_mt4ofllt' },
  });

  if (!story) throw new Error('Story not found');
  const manifest = story.manifest as any;
  const wb = manifest.worldBible;

  console.log('Manifest NPCs:', wb.npcs.length);
  console.log('Manifest Locations:', wb.locations.length);
  console.log('Manifest TradeRoutes:', wb.tradeRoutes.length);

  // Update world's worldBible
  if (story.worldId) {
    const worldWb = await prisma.worldBible.findUnique({
      where: { worldId: story.worldId },
    });
    if (worldWb) {
      await prisma.worldBible.update({
        where: { id: worldWb.id },
        data: {
          npcs: wb.npcs as any,
          locations: wb.locations as any,
          tradeRoutes: wb.tradeRoutes as any,
        },
      });
      console.log('✅ Updated World worldBible', worldWb.id);
    }
  }

  // Update story's direct worldBible if present
  const storyWb = await prisma.worldBible.findUnique({
    where: { storyId: story.id },
  });
  if (storyWb) {
    await prisma.worldBible.update({
      where: { id: storyWb.id },
      data: {
        npcs: wb.npcs as any,
        locations: wb.locations as any,
        tradeRoutes: wb.tradeRoutes as any,
      },
    });
    console.log('✅ Updated Story worldBible', storyWb.id);
  }
}

main().catch(console.error).finally(() => process.exit(0));
