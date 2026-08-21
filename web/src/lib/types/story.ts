import { z } from 'zod';
import { WorldBible, WorldBibleSchema } from './world';
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

export interface StoryManifest {
  id: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: Genre[];
  language: 'en' | 'fa';
  coverImageUrl: string;
  author: string;
  version: string;
  rpgSystem: RPGSystemSchema;
  worldBible: WorldBible;
  initialSceneId: string;
  initialStoryBeats: Array<{
    sceneId: string;
    locationId: string;
    narrativeText: string;
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
  title: z.string().min(2),
  tagline: z.string(),
  synopsis: z.string().min(10),
  genres: z.array(z.string()).min(1),
  language: z.enum(['en', 'fa']).default('en'),
  coverImageUrl: z.string(),
  author: z.string().default('StoryForge'),
  version: z.string().default('1.0.0'),
  rpgSystem: RPGSystemSchemaValidator,
  worldBible: WorldBibleSchema,
  initialSceneId: z.string(),
  initialStoryBeats: z.array(z.any()).default([]),
});
