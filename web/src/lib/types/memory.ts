import { z } from 'zod';

export type MemoryCategory =
  | 'world'      // Static laws, faction goals, fixed history
  | 'character'  // NPC personality, trust, promises, grudges
  | 'story'      // Plot milestones, faction wars, major events
  | 'player'     // Player choices, status, inventory discoveries
  | 'recent';    // Sliding window of the last 2-3 scene beats

export type ImportanceScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  importance: ImportanceScore;
  summary: string;
  detail?: string;
  tags: string[];
  sceneId: string;
  turnNumber: number;
  entityIds?: string[]; // IDs of NPCs, locations, or items involved
  createdAt: number;
  decayRate?: number; // Optional decay multiplier for low-importance memories
}

export interface WorkingContextEnvelope {
  storyTitle: string;
  worldLaws: string[];
  currentLocationName: string;
  currentLocationDescription: string;
  activeNpcDossiers: Array<{
    name: string;
    trust: number;
    knownSecrets: string[];
    speechStyle: string;
  }>;
  relevantMemories: Array<{
    category: MemoryCategory;
    importance: number;
    summary: string;
  }>;
  playerStatus: {
    stats: Record<string, number>;
    resources: Record<string, number>;
    equippedItems: string[];
  };
  resolvedGameOutcome?: {
    actionText: string;
    outcome: string;
    consequence: string;
  };
  recentSceneSnippets: string[];
  languageDirective: 'en' | 'fa';
  // Expanded world grounding (all optional; rendered only when present)
  authoredSystemPrompt?: string;
  worldSummary?: string;
  themeNotes?: string;
  factions?: string[];
  timeline?: string[];
  artifacts?: string[];
  bestiary?: string[];
  religions?: string[];
  dramaBonds?: string[];
  ontologySummary?: string;
}

export const MemoryEntrySchema = z.object({
  id: z.string(),
  category: z.enum(['world', 'character', 'story', 'player', 'recent']),
  importance: z.number().int().min(0).max(10),
  summary: z.string().min(3),
  detail: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sceneId: z.string(),
  turnNumber: z.number().int().min(0),
  entityIds: z.array(z.string()).optional(),
  createdAt: z.number(),
});
