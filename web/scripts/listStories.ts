import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    console.error('Prisma client could not be initialized');
    return;
  }
  const stories = await prisma.story.findMany({
    select: {
      id: true,
      title: true,
      published: true,
      createdAt: true,
    },
  });
  console.log('STORIES:', JSON.stringify(stories, null, 2));
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
