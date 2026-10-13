import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) return;
  const story = await prisma.story.findUnique({
    where: { id: 'story_mt4ofllt' },
  });
  if (!story) {
    console.error('Story not found');
    return;
  }
  const manifest = story.manifest as any;
  console.log('Title:', story.title);
  console.log('Initial beat count:', manifest?.initialStoryBeats?.length);
  if (manifest?.initialStoryBeats?.length) {
    console.log('Opening beat:', JSON.stringify(manifest.initialStoryBeats[0], null, 2));
  }
  console.log('Archetypes:', JSON.stringify(manifest?.archetypes, null, 2));
  console.log('RPG System stats:', JSON.stringify(manifest?.rpgSystem?.stats, null, 2));
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
