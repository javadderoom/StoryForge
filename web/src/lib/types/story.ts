import { z } from 'zod';
import { WorldBible, WorldBibleSchema, SagaManifest, SagaManifestSchema } from './world';
import { RPGSystemSchema, RPGSystemSchemaValidator } from './rpg';

export type Genre =
  | 'dark_fantasy'
  | 'sci_fi'
  | 'cyberpunk'
  | 'mystery_noir'
  | 'horror'
  | 'historical'
  | 'folklore'
  | 'romance'
  | 'post_apocalyptic';

export interface StoryNpcOverride {
  npcId: string;
  storyRole?: string;
  relationshipToProtagonist?: string;
  storyGoal?: string;
  storySecret?: string;
  customInitialTrust?: number;
  narrativeImportance?: 'central' | 'supporting' | 'incidental';
}

export const StoryNpcOverrideSchema = z.object({
  npcId: z.string().min(1),
  storyRole: z.string().optional(),
  relationshipToProtagonist: z.string().optional(),
  storyGoal: z.string().optional(),
  storySecret: z.string().optional(),
  customInitialTrust: z.number().int().min(-100).max(100).optional(),
  narrativeImportance: z.enum(['central', 'supporting', 'incidental']).optional().default('supporting'),
});

export interface StoryManifest {
  id: string;
  /** Shared-world link: many stories can live in one world. Absent = legacy solo story. */
  worldId?: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  language: 'en' | 'fa';
  coverImageUrl: string;
  author: string;
  version: string;
  published?: boolean;
  /** Canon version snapshot at publish time. */
  worldBibleVersion?: number;
  worldBibleHistory?: Array<{ version: number; publishedAt: string; note?: string }>;
  rpgSystem: RPGSystemSchema;
  worldBible: WorldBible;
  initialSceneId: string;
  activeMilestoneGoal?: string;
  saga?: SagaManifest;
  /** Optional story-level NPC role overrides (keyed by npcId) */
  storyNpcOverrides?: Record<string, StoryNpcOverride>;
  initialStoryBeats: Array<{
    sceneId: string;
    locationId: string;
    narrativeText: string;
    imageUrl?: string;
    choices: Array<{
      id: string;
      text: string;
      style: 'defensive' | 'agile' | 'aggressive' | 'diplomatic' | 'inquisitive';
      riskLevel: 'low' | 'medium' | 'high';
      targetDC?: number;
      requiredStatId?: string;
      targetSceneId?: string;
    }>;
  }>;
}

export const StoryManifestSchema = z.object({
  id: z.string().min(2),
  worldId: z.string().min(1).optional(),
  title: z.string().min(2),
  tagline: z.string(),
  synopsis: z.string().min(10),
  genres: z.array(z.string()).default([]),
  language: z.enum(['en', 'fa']).default('en'),
  coverImageUrl: z.string(),
  author: z.string().default('AfsanehSaz'),
  version: z.string().default('1.0.0'),
  published: z.boolean().optional().default(false),
  worldBibleVersion: z.number().int().min(1).default(1),
  worldBibleHistory: z.array(z.object({ version: z.number().int().min(1), publishedAt: z.string(), note: z.string().optional() })).default([]),
  rpgSystem: RPGSystemSchemaValidator,
  worldBible: WorldBibleSchema,
  initialSceneId: z.string(),
  activeMilestoneGoal: z.string().optional(),
  saga: SagaManifestSchema.optional(),
  storyNpcOverrides: z.record(z.string(), StoryNpcOverrideSchema).optional().default({}),
  initialStoryBeats: z.array(z.any()).default([]),
});
