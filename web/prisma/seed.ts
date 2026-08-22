import 'dotenv/config';
import { prisma } from '../src/lib/db/client';

/**
 * StoryForge no longer ships with built-in ("canonical") sample stories.
 * Authors create their own stories; the player-facing Library only lists
 * stories explicitly marked `published`. This seed script is intentionally
 * a no-op so a fresh database starts empty.
 */
async function main() {
  console.log('🌱 StoryForge database seed: no built-in stories to seed (starts empty).');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
