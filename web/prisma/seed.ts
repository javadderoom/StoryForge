import 'dotenv/config';
import { prisma } from '../src/lib/db/client';

import { seedActionCategories } from './seedActionCategories';

/**
 * StoryForge database seed.
 * Seeds core Action Categories for deterministic RPG mechanics.
 */
async function main() {
  console.log('🌱 StoryForge database seed starting...');
  await seedActionCategories();
  console.log('🌱 StoryForge database seed finished.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
