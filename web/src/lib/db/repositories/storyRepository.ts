import { prisma } from '../client';
import { StoryManifest, Genre } from '@/lib/types';
import { ghaleSiahsangStory } from '@/content/stories/ghale_siahsang';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';

const isDatabaseActive = process.env.ENABLE_DB === 'true';

export class StoryRepository {
  /**
   * Fetches all stories for library catalog
   */
  static async getAllStories() {
    if (!isDatabaseActive) {
      return [
        {
          id: ghaleSiahsangStory.id,
          title: ghaleSiahsangStory.title,
          tagline: ghaleSiahsangStory.tagline,
          synopsis: ghaleSiahsangStory.synopsis,
          genres: ghaleSiahsangStory.genres,
          language: ghaleSiahsangStory.language,
          coverImageUrl: ghaleSiahsangStory.coverImageUrl,
          author: ghaleSiahsangStory.author,
          statsPreview: ghaleSiahsangStory.rpgSystem.stats.map((s) => s.name),
        },
        {
          id: obsidianCitadelStory.id,
          title: obsidianCitadelStory.title,
          tagline: obsidianCitadelStory.tagline,
          synopsis: obsidianCitadelStory.synopsis,
          genres: obsidianCitadelStory.genres,
          language: obsidianCitadelStory.language,
          coverImageUrl: obsidianCitadelStory.coverImageUrl,
          author: obsidianCitadelStory.author,
          statsPreview: obsidianCitadelStory.rpgSystem.stats.map((s) => s.name),
        },
      ];
    }
    try {
      const stories = await prisma.story.findMany({
        include: {
          rpgSystem: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!stories || stories.length === 0) {
        return [
          {
            id: ghaleSiahsangStory.id,
            title: ghaleSiahsangStory.title,
            tagline: ghaleSiahsangStory.tagline,
            synopsis: ghaleSiahsangStory.synopsis,
            genres: ghaleSiahsangStory.genres,
            language: ghaleSiahsangStory.language,
            coverImageUrl: ghaleSiahsangStory.coverImageUrl,
            author: ghaleSiahsangStory.author,
            statsPreview: ghaleSiahsangStory.rpgSystem.stats.map((s) => s.name),
          },
          {
            id: obsidianCitadelStory.id,
            title: obsidianCitadelStory.title,
            tagline: obsidianCitadelStory.tagline,
            synopsis: obsidianCitadelStory.synopsis,
            genres: obsidianCitadelStory.genres,
            language: obsidianCitadelStory.language,
            coverImageUrl: obsidianCitadelStory.coverImageUrl,
            author: obsidianCitadelStory.author,
            statsPreview: obsidianCitadelStory.rpgSystem.stats.map((s) => s.name),
          },
        ];
      }

      return stories.map((s) => ({
        id: s.id,
        title: s.title,
        tagline: s.tagline,
        synopsis: s.synopsis,
        genres: s.genres,
        language: s.language,
        coverImageUrl: s.coverImageUrl || undefined,
        author: s.author,
        statsPreview: ((s.rpgSystem?.stats as any[]) || []).map((stat) => stat.name || stat.id),
      }));
    } catch (e) {
      console.warn('Database error in getAllStories, falling back to static manifests:', e);
      return [
        {
          id: ghaleSiahsangStory.id,
          title: ghaleSiahsangStory.title,
          tagline: ghaleSiahsangStory.tagline,
          synopsis: ghaleSiahsangStory.synopsis,
          genres: ghaleSiahsangStory.genres,
          language: ghaleSiahsangStory.language,
          coverImageUrl: ghaleSiahsangStory.coverImageUrl,
          author: ghaleSiahsangStory.author,
          statsPreview: ghaleSiahsangStory.rpgSystem.stats.map((s) => s.name),
        },
        {
          id: obsidianCitadelStory.id,
          title: obsidianCitadelStory.title,
          tagline: obsidianCitadelStory.tagline,
          synopsis: obsidianCitadelStory.synopsis,
          genres: obsidianCitadelStory.genres,
          language: obsidianCitadelStory.language,
          coverImageUrl: obsidianCitadelStory.coverImageUrl,
          author: obsidianCitadelStory.author,
          statsPreview: obsidianCitadelStory.rpgSystem.stats.map((s) => s.name),
        },
      ];
    }
  }

  /**
   * Fetches full StoryManifest by ID with fallback
   */
  static async getStoryById(storyId: string): Promise<StoryManifest> {
    if (!isDatabaseActive) {
      return storyId === obsidianCitadelStory.id ? obsidianCitadelStory : ghaleSiahsangStory;
    }
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          worldBible: true,
          rpgSystem: true,
        },
      });

      if (!story || !story.worldBible || !story.rpgSystem) {
        return storyId === obsidianCitadelStory.id ? obsidianCitadelStory : ghaleSiahsangStory;
      }

      const initialStoryBeats =
        story.id === obsidianCitadelStory.id
          ? obsidianCitadelStory.initialStoryBeats
          : ghaleSiahsangStory.initialStoryBeats;

      // Reconstruct StoryManifest from DB
      const manifest: StoryManifest = {
        id: story.id,
        title: story.title,
        tagline: story.tagline,
        synopsis: story.synopsis,
        genres: story.genres as Genre[],
        language: story.language as 'en' | 'fa',
        coverImageUrl: story.coverImageUrl || '',
        author: story.author,
        version: '1.0.0',
        initialSceneId: initialStoryBeats[0]?.sceneId || 'scene_start',
        worldBible: {
          worldId: story.worldBible.id,
          worldName: story.worldBible.worldName,
          summary: story.worldBible.summary,
          themeNotes: story.worldBible.themeNotes,
          laws: story.worldBible.laws as any,
          factions: story.worldBible.factions as any,
          locations: story.worldBible.locations as any,
          npcs: story.worldBible.npcs as any,
          timeline: [],
        },
        rpgSystem: {
          hasCombat: story.rpgSystem.hasCombat,
          diceType: story.rpgSystem.diceType as 'd20',
          inventoryCapacity: story.rpgSystem.inventoryCapacity,
          stats: story.rpgSystem.stats as any,
          resources: story.rpgSystem.resources as any,
          skills: story.rpgSystem.skills as any,
          startingInventory: story.rpgSystem.startingInventory as any,
        },
        initialStoryBeats,
      };

      return manifest;
    } catch (e) {
      console.warn(`Database fetch error for story ${storyId}, falling back to static:`, e);
      return storyId === obsidianCitadelStory.id ? obsidianCitadelStory : ghaleSiahsangStory;
    }
  }

  /**
   * Saves or updates a StoryManifest in the database
   */
  static async saveStory(manifest: StoryManifest) {
    return prisma.$transaction(async (tx) => {
      const story = await tx.story.upsert({
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

      await tx.worldBible.upsert({
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

      await tx.rpgSystem.upsert({
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

      return story;
    });
  }
}
