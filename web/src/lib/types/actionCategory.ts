import { z } from 'zod';

export type ActionCategoryDomain =
  | 'combat_defense'
  | 'combat_offense'
  | 'social'
  | 'wilderness'
  | 'stealth'
  | 'occult'
  | 'investigation'
  | 'crafting'
  | 'general';

export interface ActionCategory {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  domain: ActionCategoryDomain | string;
  description?: string | null;
  tags: string[];
  isSystem: boolean;
  worldId?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const ActionCategorySchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  nameFa: z.string().min(1, 'Persian name is required'),
  nameEn: z.string().min(1, 'English name is required'),
  domain: z.enum([
    'combat_defense',
    'combat_offense',
    'social',
    'wilderness',
    'stealth',
    'occult',
    'investigation',
    'crafting',
    'general',
  ]),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  isSystem: z.boolean().optional().default(false),
  worldId: z.string().optional().nullable(),
});

export type ActionCategoryInput = z.input<typeof ActionCategorySchema>;
export type ActionCategoryOutput = z.infer<typeof ActionCategorySchema>;
