import { z } from 'zod';

export interface WorldLaw {
  id: string;
  rule: string;
  description: string;
  category: 'magic' | 'physics' | 'society' | 'creatures' | 'technology';
  isImmutable: true;
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  alignment: string; // e.g. "Lawful Authoritarian", "Rebel Underground"
  territoryIds: string[];
  rivalFactionIds: string[];
  alliedFactionIds: string[];
  publicGoals: string;
  secretAgendas?: string;
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
  region: string;
  dangerLevel: 1 | 2 | 3 | 4 | 5;
  connectedLocationIds: string[];
  atmosphere: string; // Tone keywords e.g. "Gloomy, fog-drenched, damp stone"
  specialRules?: string[];
}

export interface TimelineEvent {
  id: string;
  yearOrEra: string;
  title: string;
  summary: string;
  significance: string;
  knownByPublic: boolean;
}

export interface NPCDossier {
  id: string;
  name: string;
  title: string;
  factionId?: string;
  currentLocationId: string;
  personalityTraits: string[];
  speechStyle: string; // Directives for AI dialog tone (e.g. "Speaks curtly, rarely makes eye contact")
  goals: string[];
  secrets: Array<{
    id: string;
    description: string;
    requiredTrustLevel: number;
    revealed: boolean;
  }>;
  initialTrust: number; // e.g. 0 (-100 to 100)
}

export interface WorldBible {
  worldId: string;
  worldName: string;
  summary: string;
  themeNotes: string; // Overarching artistic guidelines for the AI
  laws: WorldLaw[];
  factions: Faction[];
  locations: WorldLocation[];
  timeline: TimelineEvent[];
  npcs: NPCDossier[];
}

export const WorldLawSchema = z.object({
  id: z.string(),
  rule: z.string().min(3),
  description: z.string(),
  category: z.enum(['magic', 'physics', 'society', 'creatures', 'technology']),
  isImmutable: z.literal(true),
});

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  alignment: z.string(),
  territoryIds: z.array(z.string()).default([]),
  rivalFactionIds: z.array(z.string()).default([]),
  alliedFactionIds: z.array(z.string()).default([]),
  publicGoals: z.string(),
  secretAgendas: z.string().optional(),
});

export const WorldLocationSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string(),
  region: z.string(),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  connectedLocationIds: z.array(z.string()).default([]),
  atmosphere: z.string(),
  specialRules: z.array(z.string()).optional(),
});

export const WorldBibleSchema = z.object({
  worldId: z.string(),
  worldName: z.string().min(2),
  summary: z.string(),
  themeNotes: z.string(),
  laws: z.array(WorldLawSchema).default([]),
  factions: z.array(FactionSchema).default([]),
  locations: z.array(WorldLocationSchema).default([]),
  timeline: z.array(z.any()).default([]),
  npcs: z.array(z.any()).default([]),
});
