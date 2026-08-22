import { prisma } from '../client';
import { StoryManifest } from '@/lib/types';

const isDatabaseActive = process.env.ENABLE_DB === 'true';

export class StoryRepository {
  /**
   * Fetches stories for the library catalog.
   * `publishedOnly` restricts to stories marked published (used by the player-facing Library).
   */
  static async getAllStories(publishedOnly = false) {
    if (!isDatabaseActive) {
      return [];
    }
    try {
      const stories = await prisma.story.findMany({
        where: publishedOnly ? { published: true } : {},
        include: {
          rpgSystem: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return stories.map((s) => ({
        id: s.id,
        title: s.title,
        tagline: s.tagline,
        synopsis: s.synopsis,
        genres: s.genres,
        language: s.language,
        coverImageUrl: s.coverImageUrl || undefined,
        author: s.author,
        published: s.published,
        statsPreview: ((s.rpgSystem?.stats as any[]) || []).map((stat) => stat.name || stat.id),
        stats: s.rpgSystem?.stats || [],
        archetypes: s.rpgSystem?.archetypes || [],
        backgrounds: s.rpgSystem?.backgrounds || [],
      }));
    } catch (e) {
      console.warn('Database error in getAllStories:', e);
      return [];
    }
  }

  /**
   * Fetches the full StoryManifest by ID. Returns null when not found.
   */
  static async getStoryById(storyId: string): Promise<StoryManifest | null> {
    if (!isDatabaseActive) {
      return null;
    }
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          worldBible: true,
          rpgSystem: true,
        },
      });

      if (!story || !story.manifest) {
        return null;
      }

      const manifest = story.manifest as unknown as StoryManifest;
      if (!manifest.worldBible) {
        manifest.worldBible = {} as any;
      }
      if (!manifest.worldBible.ontology) {
        manifest.worldBible.ontology = {
          entityTypes: [],
          relationTypes: [],
          customRelationTypes: [],
        } as any;
      }
      return manifest;
    } catch (e) {
      console.warn(`Database fetch error for story ${storyId}:`, e);
      return null;
    }
  }

  /**
   * Saves or updates a StoryManifest in the database
   */
  static async saveStory(manifest: StoryManifest) {
    if (!isDatabaseActive) {
      return { id: manifest.id, title: manifest.title, isMock: true };
    }

    try {
      return await prisma.$transaction(async (tx) => {
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
            published: manifest.published ?? false,
            manifest: manifest as any,
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
            published: manifest.published ?? false,
            manifest: manifest as any,
          },
        });

        await tx.worldBible.upsert({
          where: { storyId: manifest.id },
          update: {
            worldName: manifest.worldBible.worldName,
            summary: manifest.worldBible.summary,
            themeNotes: manifest.worldBible.themeNotes,
            laws: (manifest.worldBible.laws || []) as any,
            factions: (manifest.worldBible.factions || []) as any,
            locations: (manifest.worldBible.locations || []) as any,
            npcs: (manifest.worldBible.npcs || []) as any,
          },
          create: {
            storyId: manifest.id,
            worldName: manifest.worldBible.worldName,
            summary: manifest.worldBible.summary,
            themeNotes: manifest.worldBible.themeNotes,
            laws: (manifest.worldBible.laws || []) as any,
            factions: (manifest.worldBible.factions || []) as any,
            locations: (manifest.worldBible.locations || []) as any,
            npcs: (manifest.worldBible.npcs || []) as any,
          },
        });

        await tx.rpgSystem.upsert({
          where: { storyId: manifest.id },
          update: {
            hasCombat: manifest.rpgSystem.hasCombat,
            diceType: manifest.rpgSystem.diceType,
            inventoryCapacity: manifest.rpgSystem.inventoryCapacity,
            stats: (manifest.rpgSystem.stats || []) as any,
            resources: (manifest.rpgSystem.resources || []) as any,
            skills: (manifest.rpgSystem.skills || []) as any,
            startingInventory: (manifest.rpgSystem.startingInventory || []) as any,
            archetypes: (manifest.rpgSystem.archetypes || []) as any,
            backgrounds: (manifest.rpgSystem.backgrounds || []) as any,
          },
          create: {
            storyId: manifest.id,
            hasCombat: manifest.rpgSystem.hasCombat,
            diceType: manifest.rpgSystem.diceType,
            inventoryCapacity: manifest.rpgSystem.inventoryCapacity,
            stats: (manifest.rpgSystem.stats || []) as any,
            resources: (manifest.rpgSystem.resources || []) as any,
            skills: (manifest.rpgSystem.skills || []) as any,
            startingInventory: (manifest.rpgSystem.startingInventory || []) as any,
            archetypes: (manifest.rpgSystem.archetypes || []) as any,
            backgrounds: (manifest.rpgSystem.backgrounds || []) as any,
          },
        });

        return story;
      });
    } catch (e) {
      console.warn('Database save encountered an issue, story preserved in memory & local storage:', e);
      return { id: manifest.id, title: manifest.title, error: String(e) };
    }
  }

  /**
   * Deletes a story (and its related rows via cascade) from the database.
   */
  static async deleteStory(storyId: string) {
    if (!isDatabaseActive) {
      return { success: false, isMock: true };
    }
    try {
      await prisma.story.delete({
        where: { id: storyId },
      });
      return { success: true };
    } catch (e) {
      console.warn('Database delete encountered an issue:', e);
      return { success: false, error: String(e) };
    }
  }
}
