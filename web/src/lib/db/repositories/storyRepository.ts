import { prisma } from '../client';
import { StoryManifest } from '@/lib/types';
import {
  WorldBible,
  WorldCreature,
  WorldArtifact,
  TimelineEvent,
  NPCDossier,
  WorldDeity,
  WorldLocation,
  Faction,
  WorldLaw,
  NPCDramaBond,
  WorldOntology,
} from '@/lib/types/world';

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
   * Fetches the relational WorldBible projection without loading full story manifest.
   */
  static async getWorldBible(storyId: string): Promise<WorldBible | null> {
    if (!isDatabaseActive) return null;
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
      });
      if (!wb) return null;
      return {
        worldId: wb.id,
        worldName: wb.worldName,
        summary: wb.summary,
        themeNotes: wb.themeNotes,
        laws: (wb.laws as unknown as WorldLaw[]) || [],
        factions: (wb.factions as unknown as Faction[]) || [],
        locations: (wb.locations as unknown as WorldLocation[]) || [],
        npcs: (wb.npcs as unknown as NPCDossier[]) || [],
        timeline: (wb.timeline as unknown as TimelineEvent[]) || [],
        artifacts: (wb.artifacts as unknown as WorldArtifact[]) || [],
        bestiary: (wb.bestiary as unknown as WorldCreature[]) || [],
        religions: (wb.religions as unknown as WorldDeity[]) || [],
        dramaBonds: (wb.dramaBonds as unknown as NPCDramaBond[]) || [],
        ontology: (wb.ontology as unknown as WorldOntology) || undefined,
        customRelations: [],
      };
    } catch (e) {
      console.warn(`Database fetch error for worldBible ${storyId}:`, e);
      return null;
    }
  }

  /**
   * Selectively fetches only the Bestiary collection for a story.
   */
  static async getBestiary(storyId: string): Promise<WorldCreature[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { bestiary: true },
      });
      return (wb?.bestiary as unknown as WorldCreature[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for bestiary ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the Artifacts collection for a story.
   */
  static async getArtifacts(storyId: string): Promise<WorldArtifact[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { artifacts: true },
      });
      return (wb?.artifacts as unknown as WorldArtifact[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for artifacts ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the Timeline collection for a story.
   */
  static async getTimeline(storyId: string): Promise<TimelineEvent[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { timeline: true },
      });
      return (wb?.timeline as unknown as TimelineEvent[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for timeline ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the NPCs collection for a story.
   */
  static async getNpcs(storyId: string): Promise<NPCDossier[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { npcs: true },
      });
      return (wb?.npcs as unknown as NPCDossier[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for npcs ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the Religions collection for a story.
   */
  static async getReligions(storyId: string): Promise<WorldDeity[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { religions: true },
      });
      return (wb?.religions as unknown as WorldDeity[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for religions ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the Locations collection for a story.
   */
  static async getLocations(storyId: string): Promise<WorldLocation[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { locations: true },
      });
      return (wb?.locations as unknown as WorldLocation[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for locations ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the Factions collection for a story.
   */
  static async getFactions(storyId: string): Promise<Faction[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { factions: true },
      });
      return (wb?.factions as unknown as Faction[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for factions ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the World Laws collection for a story.
   */
  static async getLaws(storyId: string): Promise<WorldLaw[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { laws: true },
      });
      return (wb?.laws as unknown as WorldLaw[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for laws ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the NPC Drama Bonds collection for a story.
   */
  static async getDramaBonds(storyId: string): Promise<NPCDramaBond[]> {
    if (!isDatabaseActive) return [];
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { dramaBonds: true },
      });
      return (wb?.dramaBonds as unknown as NPCDramaBond[]) || [];
    } catch (e) {
      console.warn(`Database fetch error for dramaBonds ${storyId}:`, e);
      return [];
    }
  }

  /**
   * Selectively fetches only the World Ontology for a story.
   */
  static async getOntology(storyId: string): Promise<WorldOntology | null> {
    if (!isDatabaseActive) return null;
    try {
      const wb = await prisma.worldBible.findUnique({
        where: { storyId },
        select: { ontology: true },
      });
      return (wb?.ontology as unknown as WorldOntology) || null;
    } catch (e) {
      console.warn(`Database fetch error for ontology ${storyId}:`, e);
      return null;
    }
  }

  /**
   * Performs an atomic partial update on a specific lore collection,
   * keeping both the PostgreSQL column and Story.manifest in 100% sync.
   */
  static async updateLoreCollection(
    storyId: string,
    collection:
      | 'laws'
      | 'factions'
      | 'locations'
      | 'npcs'
      | 'timeline'
      | 'artifacts'
      | 'bestiary'
      | 'religions'
      | 'dramaBonds'
      | 'ontology',
    data: any
  ) {
    if (!isDatabaseActive) {
      return { success: true, isMock: true, collection };
    }
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Update the dedicated relational column on world_bibles
        const updatedWb = await tx.worldBible.update({
          where: { storyId },
          data: { [collection]: data as any },
        });

        // 2. Patch the story.manifest JSON document to maintain dual-layer parity
        const story = await tx.story.findUnique({
          where: { id: storyId },
          select: { manifest: true },
        });

        if (story && story.manifest) {
          const manifest = story.manifest as any;
          if (!manifest.worldBible) {
            manifest.worldBible = {};
          }
          manifest.worldBible[collection] = data;

          await tx.story.update({
            where: { id: storyId },
            data: { manifest },
          });
        }

        return { success: true, collection, updatedWb };
      });
    } catch (e) {
      console.warn(`Database partial update failed for ${collection} on story ${storyId}:`, e);
      return { success: false, error: String(e) };
    }
  }

  /**
   * Saves or updates a full StoryManifest in the database
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
            timeline: (manifest.worldBible.timeline || []) as any,
            artifacts: (manifest.worldBible.artifacts || []) as any,
            bestiary: (manifest.worldBible.bestiary || []) as any,
            religions: (manifest.worldBible.religions || []) as any,
            dramaBonds: (manifest.worldBible.dramaBonds || []) as any,
            ontology: (manifest.worldBible.ontology || {}) as any,
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
            timeline: (manifest.worldBible.timeline || []) as any,
            artifacts: (manifest.worldBible.artifacts || []) as any,
            bestiary: (manifest.worldBible.bestiary || []) as any,
            religions: (manifest.worldBible.religions || []) as any,
            dramaBonds: (manifest.worldBible.dramaBonds || []) as any,
            ontology: (manifest.worldBible.ontology || {}) as any,
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
