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
  FactionRelation,
} from '@/lib/types/world';

const isDatabaseActive = process.env.ENABLE_DB === 'true';

export interface WorldListItem {
  id: string;
  name: string;
  summary: string;
  storyCount: number;
  worldBibleVersion: number;
  updatedAt: Date;
}

function toWorldBible(wb: any): WorldBible | null {
  if (!wb) return null;
  return {
    worldId: wb.worldId || wb.id,
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
    factionRelations: (wb.factionRelations as unknown as FactionRelation[]) || [],
    ontology: (wb.ontology as unknown as WorldOntology) || undefined,
    customRelations: [],
  };
}

export class StoryRepository {
  // ---------------------------------------------------------------
  // Worlds (shared 1:N container for lore + RPG)
  // ---------------------------------------------------------------

  static async getAllWorlds(): Promise<WorldListItem[]> {
    if (!isDatabaseActive) return [];
    try {
      const worlds = await prisma.world.findMany({
        include: { _count: { select: { stories: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return worlds.map((w) => ({
        id: w.id,
        name: w.name,
        summary: w.summary,
        storyCount: w._count.stories,
        worldBibleVersion: w.worldBibleVersion,
        updatedAt: w.updatedAt,
      }));
    } catch (e) {
      console.warn('Database error in getAllWorlds:', e);
      return [];
    }
  }

  static async getWorldBibleByWorldId(worldId: string): Promise<WorldBible | null> {
    if (!isDatabaseActive) return null;
    try {
      // worldId may be a World.id or a legacy storyId (whose bible carries storyId).
      const wb =
        (await prisma.worldBible.findUnique({ where: { worldId } })) ||
        (await prisma.worldBible.findUnique({ where: { storyId: worldId } }));
      return toWorldBible(wb);
    } catch (e) {
      console.warn(`Database fetch error for worldBible ${worldId}:`, e);
      return null;
    }
  }

  static async resolveWorldIdForStory(storyId: string): Promise<string> {
    if (!isDatabaseActive) return storyId;
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        select: { worldId: true },
      });
      return story?.worldId || storyId;
    } catch {
      return storyId;
    }
  }

  /**
   * Creates a new empty world (lore + RPG shells). Used when starting a
   * fresh universe before any story exists.
   */
  static async createWorld(input: { name: string; summary?: string; themeNotes?: string }) {
    if (!isDatabaseActive) {
      return { id: `world_${Date.now().toString(36)}`, ...input, isMock: true };
    }
    const world = await prisma.world.create({
      data: {
        name: input.name,
        summary: input.summary || '',
        themeNotes: input.themeNotes || '',
      },
    });
    await prisma.worldBible.create({
      data: {
        worldId: world.id,
        worldName: input.name,
        summary: input.summary || '',
        themeNotes: input.themeNotes || '',
      },
    });
    await prisma.rpgSystem.create({ data: { worldId: world.id } });
    return world;
  }

  /**
   * Deep-copies a world (lore + RPG) into a new world for explicit
   * divergence. Stories are NOT moved; pass storyIds to re-link them.
   */
  static async forkWorld(worldId: string, name: string) {
    if (!isDatabaseActive) return { isMock: true };
    const sourceId = await this.resolveWorldIdForStory(worldId);
    const [wb, rpg, world] = await Promise.all([
      prisma.worldBible.findUnique({ where: { worldId: sourceId } }),
      prisma.rpgSystem.findUnique({ where: { worldId: sourceId } }),
      prisma.world.findUnique({ where: { id: sourceId } }),
    ]);
    if (!wb) throw new Error(`World not found: ${worldId}`);
    const created = await prisma.world.create({
      data: {
        name,
        summary: wb.summary,
        themeNotes: wb.themeNotes,
        worldBibleVersion: 1,
        worldBibleHistory: [],
      },
    });
    await prisma.worldBible.create({
      data: {
        worldId: created.id,
        worldName: name,
        summary: wb.summary,
        themeNotes: wb.themeNotes,
        laws: wb.laws as any,
        factions: wb.factions as any,
        locations: wb.locations as any,
        npcs: wb.npcs as any,
        timeline: wb.timeline as any,
        artifacts: wb.artifacts as any,
        bestiary: wb.bestiary as any,
        religions: wb.religions as any,
        dramaBonds: wb.dramaBonds as any,
        factionRelations: wb.factionRelations as any,
        ontology: wb.ontology as any,
      },
    });
    await prisma.rpgSystem.create({
      data: {
        worldId: created.id,
        hasCombat: rpg?.hasCombat ?? true,
        diceType: rpg?.diceType ?? 'd20',
        inventoryCapacity: rpg?.inventoryCapacity ?? 10,
        stats: (rpg?.stats as any) ?? [],
        resources: (rpg?.resources as any) ?? [],
        skills: (rpg?.skills as any) ?? [],
        startingInventory: (rpg?.startingInventory as any) ?? [],
        archetypes: (rpg?.archetypes as any) ?? [],
        backgrounds: (rpg?.backgrounds as any) ?? [],
      },
    });
    void world;
    return created;
  }

  static async deleteWorld(worldId: string) {
    if (!isDatabaseActive) {
      return { success: false, isMock: true };
    }
    try {
      const resolved = await this.resolveWorldIdForStory(worldId);
      await prisma.$transaction(async (tx) => {
        // Stories cannot live without their world's lore — remove them first
        // (their sessions/turns/memories cascade from the story delete).
        await tx.story.deleteMany({ where: { worldId: resolved } });
        await tx.story.deleteMany({
          where: { id: resolved, worldId: null } as any,
        });
        await tx.world.delete({ where: { id: resolved } });
      });
      return { success: true };
    } catch (e) {
      console.warn('Database world delete encountered an issue:', e);
      return { success: false, error: String(e) };
    }
  }

  // ---------------------------------------------------------------
  // Stories (story-specific shell: meta + beats + saga)
  // ---------------------------------------------------------------

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
          world: { include: { rpgSystem: true } },
          rpgSystem: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return stories.map((s) => {
        const rpg = s.world?.rpgSystem || s.rpgSystem;
        return {
          id: s.id,
          title: s.title,
          tagline: s.tagline,
          synopsis: s.synopsis,
          genres: s.genres,
          language: s.language,
          coverImageUrl: s.coverImageUrl || undefined,
          author: s.author,
          published: s.published,
          worldId: s.worldId || undefined,
          worldName: s.world?.name || undefined,
          statsPreview: ((rpg?.stats as any[]) || []).map((stat) => stat.name || stat.id),
          stats: rpg?.stats || [],
          archetypes: rpg?.archetypes || [],
          backgrounds: rpg?.backgrounds || [],
        };
      });
    } catch (e) {
      console.warn('Database error in getAllStories:', e);
      return [];
    }
  }

  /**
   * Fetches the full StoryManifest by ID, composing story-specific fields
   * with the live shared-world lore + RPG. Returns null when not found.
   */
  static async getStoryById(storyId: string): Promise<StoryManifest | null> {
    if (!isDatabaseActive) {
      return null;
    }
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          world: { include: { worldBible: true, rpgSystem: true } },
          worldBible: true,
          rpgSystem: true,
        },
      });

      if (!story || !story.manifest) {
        return null;
      }

      const manifest = story.manifest as unknown as StoryManifest;
      const worldId = story.worldId || manifest.worldId || storyId;
      manifest.worldId = worldId;

      // Live world lore wins over the embedded manifest snapshot.
      const liveBible = toWorldBible(story.world?.worldBible || story.worldBible);
      if (liveBible) {
        // Preserve unsaved Studio-only fields (e.g. aiSystemPrompt, oracleDirectives)
        // that live in JSON columns outside the relational projection.
        const embedded = manifest.worldBible as any;
        manifest.worldBible = {
          ...liveBible,
          aiSystemPrompt: liveBible.aiSystemPrompt || embedded?.aiSystemPrompt,
          worldBibleVersion:
            story.world?.worldBibleVersion || liveBible.worldBibleVersion || embedded?.worldBibleVersion || 1,
          customRelations: liveBible.customRelations || embedded?.customRelations || [],
          oracleDirectives: embedded?.oracleDirectives,
        } as any;
      }
      if (!manifest.worldBible.ontology) {
        manifest.worldBible.ontology = {
          entityTypes: [],
          relationTypes: [],
          customRelationTypes: [],
        } as any;
      }

      const liveRpg = story.world?.rpgSystem || story.rpgSystem;
      if (liveRpg) {
        manifest.rpgSystem = {
          hasCombat: liveRpg.hasCombat,
          diceType: liveRpg.diceType,
          inventoryCapacity: liveRpg.inventoryCapacity,
          stats: (liveRpg.stats as any) || [],
          resources: (liveRpg.resources as any) || [],
          skills: (liveRpg.skills as any) || [],
          startingInventory: (liveRpg.startingInventory as any) || [],
          archetypes: (liveRpg.archetypes as any) || [],
          backgrounds: (liveRpg.backgrounds as any) || [],
        } as any;
      }

      manifest.worldBibleVersion =
        story.world?.worldBibleVersion || manifest.worldBibleVersion || 1;
      manifest.worldBibleHistory =
        ((story.world?.worldBibleHistory as any) || manifest.worldBibleHistory || []) as any;

      return manifest;
    } catch (e) {
      console.warn(`Database fetch error for story ${storyId}:`, e);
      return null;
    }
  }

  /**
   * Fetches the relational WorldBible projection for a story, resolving
   * through the shared world when the story is linked to one.
   */
  static async getWorldBible(storyId: string): Promise<WorldBible | null> {
    if (!isDatabaseActive) return null;
    const worldId = await this.resolveWorldIdForStory(storyId);
    return this.getWorldBibleByWorldId(worldId);
  }

  /**
   * Selectively fetches only the Bestiary collection for a story.
   */
  static async getBestiary(storyId: string): Promise<WorldCreature[]> {
    return (await this.getLoreColumn(storyId, 'bestiary')) as WorldCreature[];
  }

  /**
   * Selectively fetches only the Artifacts collection for a story.
   */
  static async getArtifacts(storyId: string): Promise<WorldArtifact[]> {
    return (await this.getLoreColumn(storyId, 'artifacts')) as WorldArtifact[];
  }

  /**
   * Selectively fetches only the Timeline collection for a story.
   */
  static async getTimeline(storyId: string): Promise<TimelineEvent[]> {
    return (await this.getLoreColumn(storyId, 'timeline')) as TimelineEvent[];
  }

  /**
   * Selectively fetches only the NPCs collection for a story.
   */
  static async getNpcs(storyId: string): Promise<NPCDossier[]> {
    return (await this.getLoreColumn(storyId, 'npcs')) as NPCDossier[];
  }

  /**
   * Selectively fetches only the Religions collection for a story.
   */
  static async getReligions(storyId: string): Promise<WorldDeity[]> {
    return (await this.getLoreColumn(storyId, 'religions')) as WorldDeity[];
  }

  /**
   * Selectively fetches only the Locations collection for a story.
   */
  static async getLocations(storyId: string): Promise<WorldLocation[]> {
    return (await this.getLoreColumn(storyId, 'locations')) as WorldLocation[];
  }

  /**
   * Selectively fetches only the Factions collection for a story.
   */
  static async getFactions(storyId: string): Promise<Faction[]> {
    return (await this.getLoreColumn(storyId, 'factions')) as Faction[];
  }

  /**
   * Selectively fetches only the World Laws collection for a story.
   */
  static async getLaws(storyId: string): Promise<WorldLaw[]> {
    return (await this.getLoreColumn(storyId, 'laws')) as WorldLaw[];
  }

  /**
   * Selectively fetches only the NPC Drama Bonds collection for a story.
   */
  static async getDramaBonds(storyId: string): Promise<NPCDramaBond[]> {
    return (await this.getLoreColumn(storyId, 'dramaBonds')) as NPCDramaBond[];
  }

  /**
   * Selectively fetches only the World Ontology for a story.
   */
  static async getOntology(storyId: string): Promise<WorldOntology | null> {
    return (await this.getLoreColumn(storyId, 'ontology')) as WorldOntology | null;
  }

  /**
   * Selectively fetches only the 5-state Faction Relations for a story.
   */
  static async getFactionRelations(storyId: string): Promise<FactionRelation[]> {
    return (await this.getLoreColumn(storyId, 'factionRelations')) as FactionRelation[];
  }

  private static async getLoreColumn(storyId: string, column: string): Promise<unknown> {
    if (!isDatabaseActive) return column === 'ontology' ? null : [];
    try {
      const worldId = await this.resolveWorldIdForStory(storyId);
      const wb =
        (await prisma.worldBible.findUnique({
          where: { worldId },
          select: { [column]: true } as any,
        }) as any) ||
        (await prisma.worldBible.findUnique({
          where: { storyId },
          select: { [column]: true } as any,
        }) as any);
      return wb?.[column] ?? (column === 'ontology' ? null : []);
    } catch (e) {
      console.warn(`Database fetch error for ${column} ${storyId}:`, e);
      return column === 'ontology' ? null : [];
    }
  }

  /**
   * Performs an atomic partial update on a specific lore collection of the
   * SHARED world (all stories on that world see it) and bumps the world's
   * canon version. Accepts either a worldId or a storyId (resolved to its world).
   */
  static async updateLoreCollection(
    storyOrWorldId: string,
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
      | 'ontology'
      | 'factionRelations',
    data: any
  ) {
    if (!isDatabaseActive) {
      return { success: true, isMock: true, collection };
    }
    try {
      const worldId = await this.resolveWorldIdForStory(storyOrWorldId);
      return await prisma.$transaction(async (tx) => {
        // Prefer the shared-world row; fall back to the legacy storyId-linked row.
        const existing =
          (await tx.worldBible.findUnique({ where: { worldId } })) ||
          (await tx.worldBible.findUnique({ where: { storyId: storyOrWorldId } }));
        if (!existing) {
          throw new Error(`WorldBible not found for ${storyOrWorldId}`);
        }

        const updatedWb = await tx.worldBible.update({
          where: { id: existing.id },
          data: { [collection]: data as any },
        });

        // Bump the shared world's canon version so in-flight sessions stay pinned.
        if (existing.worldId) {
          const world = await tx.world.findUnique({ where: { id: existing.worldId } });
          if (world) {
            const nextVersion = (world.worldBibleVersion || 1) + 1;
            const history = [
              ...(((world.worldBibleHistory as any[]) || []).slice(-4)),
              { version: nextVersion, publishedAt: new Date().toISOString() },
            ];
            await tx.world.update({
              where: { id: world.id },
              data: { worldBibleVersion: nextVersion, worldBibleHistory: history as any },
            });
          }
        }

        return { success: true, collection, updatedWb, worldId: existing.worldId };
      });
    } catch (e) {
      console.warn(`Database partial update failed for ${collection} on ${storyOrWorldId}:`, e);
      return { success: false, error: String(e) };
    }
  }

  /**
   * Saves a full StoryManifest: story-specific fields go to `stories`,
   * shared lore + RPG go to the linked `worlds` row (visible to every
   * story on that world). Creates the world on the fly when missing.
   */
  static async saveStory(input: StoryManifest) {
    if (!isDatabaseActive) {
      return { id: input.id, title: input.title, isMock: true };
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Resolve or create the shared world.
        let worldId = input.worldId;
        if (!worldId) {
          const legacy = await tx.story.findUnique({
            where: { id: input.id },
            select: { worldId: true },
          });
          worldId = legacy?.worldId || undefined;
        }
        let world = worldId ? await tx.world.findUnique({ where: { id: worldId } }) : null;
        if (!world) {
          world = await tx.world.create({
            data: {
              name: input.worldBible.worldName,
              summary: input.worldBible.summary,
              themeNotes: input.worldBible.themeNotes,
              worldBibleVersion: input.worldBibleVersion || 1,
              worldBibleHistory: (input.worldBibleHistory || []) as any,
            },
          });
          worldId = world.id;
        }

        // 2. Version-on-publish: bump the WORLD canon version on false→true transitions.
        let worldBibleVersion = world.worldBibleVersion || 1;
        let worldBibleHistory = ((world.worldBibleHistory as any[]) || []) as Array<{
          version: number;
          publishedAt: string;
          note?: string;
        }>;
        if (input.published === true) {
          const existing = await tx.story.findUnique({ where: { id: input.id } });
          const wasPublished =
            (existing?.manifest as unknown as StoryManifest | null)?.published === true;
          if (!wasPublished) {
            const prevVersion =
              (existing?.manifest as unknown as StoryManifest | null)?.worldBibleVersion ||
              world.worldBibleVersion ||
              0;
            worldBibleVersion = Math.max(prevVersion + 1, input.worldBibleVersion || 1, 1);
            worldBibleHistory = [
              ...worldBibleHistory.slice(-4),
              { version: worldBibleVersion, publishedAt: new Date().toISOString() },
            ];
            await tx.world.update({
              where: { id: worldId },
              data: { worldBibleVersion, worldBibleHistory: worldBibleHistory as any },
            });
          }
        }

        const manifest: StoryManifest = {
          ...input,
          worldId,
          worldBibleVersion,
          worldBibleHistory,
          worldBible: { ...input.worldBible, worldBibleVersion },
        };

        // 3. Story shell (story-specific fields + manifest snapshot).
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
            worldId,
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
            worldId,
            manifest: manifest as any,
          },
        });

        // 4. Shared world lore (one row per world — every linked story reads this).
        const existingWb = await tx.worldBible.findUnique({ where: { worldId } });
        const wbData = {
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
          factionRelations: (manifest.worldBible.factionRelations || []) as any,
          ontology: (manifest.worldBible.ontology || {}) as any,
        };
        if (existingWb) {
          await tx.worldBible.update({ where: { worldId }, data: wbData });
        } else {
          await tx.worldBible.create({ data: { worldId, ...wbData } });
        }
        // Keep the world display fields in sync with the bible meta.
        await tx.world.update({
          where: { id: worldId },
          data: {
            name: manifest.worldBible.worldName,
            summary: manifest.worldBible.summary,
            themeNotes: manifest.worldBible.themeNotes,
          },
        });

        // 5. Shared RPG system (one row per world).
        const rpgData = {
          hasCombat: manifest.rpgSystem.hasCombat,
          diceType: manifest.rpgSystem.diceType,
          inventoryCapacity: manifest.rpgSystem.inventoryCapacity,
          stats: (manifest.rpgSystem.stats || []) as any,
          resources: (manifest.rpgSystem.resources || []) as any,
          skills: (manifest.rpgSystem.skills || []) as any,
          startingInventory: (manifest.rpgSystem.startingInventory || []) as any,
          archetypes: (manifest.rpgSystem.archetypes || []) as any,
          backgrounds: (manifest.rpgSystem.backgrounds || []) as any,
        };
        const existingRpg = await tx.rpgSystem.findUnique({ where: { worldId } });
        if (existingRpg) {
          await tx.rpgSystem.update({ where: { worldId }, data: rpgData });
        } else {
          await tx.rpgSystem.create({ data: { worldId, ...rpgData } });
        }

        return story;
      });
    } catch (e) {
      console.warn('Database save encountered an issue, story preserved in memory & local storage:', e);
      return { id: input.id, title: input.title, error: String(e) };
    }
  }

  /**
   * Deletes a story shell only — the shared world (and sibling stories)
   * survive. Use deleteWorld() to remove a whole universe.
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
