import 'dotenv/config';
import { prisma } from '../src/lib/db/client';
import { ghaleSiahsangStory } from '../src/content/stories/ghale_siahsang';
import { obsidianCitadelStory } from '../src/content/stories/obsidian_citadel';
import { StoryManifest } from '../src/lib/types';

async function seedStory(manifest: StoryManifest) {
  console.log(`Seeding story: ${manifest.title} (${manifest.id})...`);

  // Upsert Story
  await prisma.story.upsert({
    where: { id: manifest.id },
    update: {
      title: manifest.title,
      tagline: manifest.tagline,
      synopsis: manifest.synopsis,
      genres: manifest.genres,
      language: manifest.language,
      coverImageUrl: manifest.coverImageUrl,
      author: manifest.author,
    },
    create: {
      id: manifest.id,
      title: manifest.title,
      tagline: manifest.tagline,
      synopsis: manifest.synopsis,
      genres: manifest.genres,
      language: manifest.language,
      coverImageUrl: manifest.coverImageUrl,
      author: manifest.author,
    },
  });

  // Upsert WorldBible
  await prisma.worldBible.upsert({
    where: { storyId: manifest.id },
    update: {
      worldName: manifest.worldBible.worldName,
      summary: manifest.worldBible.summary,
      themeNotes: manifest.worldBible.themeNotes,
      laws: manifest.worldBible.laws as any,
      factions: manifest.worldBible.factions as any,
      locations: manifest.worldBible.locations as any,
      npcs: manifest.worldBible.npcs as any,
    },
    create: {
      storyId: manifest.id,
      worldName: manifest.worldBible.worldName,
      summary: manifest.worldBible.summary,
      themeNotes: manifest.worldBible.themeNotes,
      laws: manifest.worldBible.laws as any,
      factions: manifest.worldBible.factions as any,
      locations: manifest.worldBible.locations as any,
      npcs: manifest.worldBible.npcs as any,
    },
  });

  // Upsert RpgSystem
  await prisma.rpgSystem.upsert({
    where: { storyId: manifest.id },
    update: {
      hasCombat: manifest.rpgSystem.hasCombat,
      diceType: manifest.rpgSystem.diceType,
      inventoryCapacity: manifest.rpgSystem.inventoryCapacity,
      stats: manifest.rpgSystem.stats as any,
      resources: manifest.rpgSystem.resources as any,
      skills: manifest.rpgSystem.skills as any,
      startingInventory: manifest.rpgSystem.startingInventory as any,
    },
    create: {
      storyId: manifest.id,
      hasCombat: manifest.rpgSystem.hasCombat,
      diceType: manifest.rpgSystem.diceType,
      inventoryCapacity: manifest.rpgSystem.inventoryCapacity,
      stats: manifest.rpgSystem.stats as any,
      resources: manifest.rpgSystem.resources as any,
      skills: manifest.rpgSystem.skills as any,
      startingInventory: manifest.rpgSystem.startingInventory as any,
    },
  });

  console.log(`✓ Seeded ${manifest.title} successfully.`);
}

async function main() {
  console.log('🌱 Starting StoryForge database seed...');
  await seedStory(ghaleSiahsangStory);
  await seedStory(obsidianCitadelStory);
  console.log('✨ Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
