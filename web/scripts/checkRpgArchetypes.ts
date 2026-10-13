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
  console.log('rpgSystem keys:', Object.keys(manifest?.rpgSystem || {}));
  console.log('Archetypes:', manifest?.rpgSystem?.archetypes?.map((a: any) => ({ id: a.id, name: a.name })));
  console.log('Backgrounds:', manifest?.rpgSystem?.backgrounds?.map((b: any) => ({ id: b.id, name: b.name })));
}

main().catch(console.error).finally(() => process.exit(0));
