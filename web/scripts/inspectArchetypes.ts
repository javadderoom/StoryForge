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
  if (!story) return;
  const manifest = story.manifest as any;
  console.log('Archetypes in manifest:', manifest?.archetypes?.map((a: any) => ({ id: a.id, name: a.name })));
  console.log('Backgrounds in manifest:', manifest?.backgrounds?.map((b: any) => ({ id: b.id, name: b.name })));
  console.log('WorldBible NPCs:', manifest?.worldBible?.npcs?.map((n: any) => ({ id: n.id, name: n.name })));
  console.log('WorldBible locations:', manifest?.worldBible?.locations?.map((l: any) => ({ id: l.id, name: l.name })));
}

main().catch(console.error).finally(() => process.exit(0));
