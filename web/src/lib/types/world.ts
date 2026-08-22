import { z } from 'zod';

export interface WorldLaw {
  id: string;
  rule: string;
  description: string;
  category: string; // e.g. 'magic' | 'physics' | 'society' | 'creatures' | 'technology' or custom
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
  category?: string; // e.g. 'stronghold', 'dungeon', 'ruins', 'settlement', 'wilderness'
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
  eraCategory?: 'ancient' | 'war' | 'cataclysm' | 'reign' | 'recent' | 'present' | string;
  linkedFactionIds?: string[];
  linkedLocationIds?: string[];
  secretDetails?: string;
}

export interface NPCDossier {
  id: string;
  name: string;
  title: string;
  role?: string; // e.g. 'ruler', 'alchemist', 'smuggler', 'guard', 'scholar'
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

export interface WorldArtifact {
  id: string;
  name: string;
  title: string;
  originEra: string;
  rarity: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  description: string;
  powers: string[];
  curseOrCost?: string;
  attunementRules?: string;
  currentHolderType: 'npc' | 'location' | 'faction' | 'vault' | 'unknown';
  currentHolderId: string;
  secretLore?: string;
}

export interface WorldCreature {
  id: string;
  name: string;
  speciesCategory: 'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic' | 'humanoid';
  dangerLevel: 1 | 2 | 3 | 4 | 5;
  habitatLocationIds: string[];
  behavioralTactics: string;
  weaknesses: string[];
  resistances: string[];
  harvestableLoot: Array<{ itemId: string; name: string; dropRate: string }>;
  loreDescription: string;
}

export interface WorldDeity {
  id: string;
  name: string;
  title: string;
  domain: 'light' | 'death' | 'war' | 'secrets' | 'nature' | 'chaos' | 'forge' | string;
  sacredSymbol: string;
  coreDogma: string;
  taboos: string[];
  divineBlessings: string[];
  affiliatedFactionIds: string[];
  holyLocationIds: string[];
}

export interface NPCDramaBond {
  id: string;
  sourceNpcId: string;
  targetNpcId: string;
  relationTypeId: string;
  affinity: number; // -100 to +100
  secretTension: string;
  isPublic: boolean;
}

// ----------------------------------------------------
// Ontology & Custom Taxonomy Registry Types
// ----------------------------------------------------

export interface CustomRelationType {
  id: string; // e.g. "blood_debt", "mentor_apprentice", "smuggling_corridor"
  name: string; // e.g. "بدهکار خونی", "شاگرد و استاد"
  description: string;
  sourceCategory: 'location' | 'npc' | 'faction' | 'law' | 'any';
  targetCategory: 'location' | 'npc' | 'faction' | 'law' | 'any';
  color: string; // Hex color for SVG lines and UI badges
  isDirected: boolean;
  isDefault?: boolean;
}

export interface CustomPlaceCategory {
  id: string; // e.g. "stronghold", "dungeon", "settlement", "ruins", "wilderness"
  name: string;
  description: string;
  color: string;
  defaultDangerLevel?: 1 | 2 | 3 | 4 | 5;
  isDefault?: boolean;
}

export interface CustomLawCategory {
  id: string; // e.g. "magic", "physics", "society", "creatures", "technology"
  name: string;
  description: string;
  color: string;
  isDefault?: boolean;
}

export interface CustomNPCRole {
  id: string; // e.g. "ruler", "smuggler", "scholar", "guard", "alchemist"
  name: string;
  description: string;
  color: string;
  isDefault?: boolean;
}

export interface CustomDomain {
  id: string; // e.g. "light", "war", "death" — matches WorldDeity.domain
  name: string; // e.g. "Light & Order", "War & Conquest"
  description: string;
  color: string; // Hex color for badges and UI
  isDefault?: boolean;
}

export interface CustomLoreRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationTypeId: string;
  customLabel?: string;
}

export interface WorldOntology {
  relationTypes: CustomRelationType[];
  placeCategories: CustomPlaceCategory[];
  lawCategories: CustomLawCategory[];
  npcRoles: CustomNPCRole[];
  domains: CustomDomain[];
}

export interface WorldBible {
  worldId: string;
  worldName: string;
  summary: string;
  themeNotes: string; // Overarching artistic guidelines for the AI
  aiSystemPrompt?: string; // Master AI System Prompt editable by author
  laws: WorldLaw[];
  factions: Faction[];
  locations: WorldLocation[];
  timeline: TimelineEvent[];
  npcs: NPCDossier[];
  artifacts?: WorldArtifact[];
  bestiary?: WorldCreature[];
  religions?: WorldDeity[];
  dramaBonds?: NPCDramaBond[];
  ontology?: WorldOntology;
  customRelations?: CustomLoreRelation[];
}

// ----------------------------------------------------
// Zod Runtime Validation Schemas
// ----------------------------------------------------

export const NPCDramaBondSchema = z.object({
  id: z.string().min(1),
  sourceNpcId: z.string().min(1),
  targetNpcId: z.string().min(1),
  relationTypeId: z.string().default('ally'),
  affinity: z.number().min(-100).max(100).default(0),
  secretTension: z.string().default(''),
  isPublic: z.boolean().default(true),
});

export const WorldDeitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().default(''),
  domain: z.string().default('light'),
  sacredSymbol: z.string().default(''),
  coreDogma: z.string().default(''),
  taboos: z.array(z.string()).default([]),
  divineBlessings: z.array(z.string()).default([]),
  affiliatedFactionIds: z.array(z.string()).default([]),
  holyLocationIds: z.array(z.string()).default([]),
});

export const WorldCreatureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  speciesCategory: z.enum(['beast', 'monstrosity', 'undead', 'elemental', 'flora', 'draconic', 'humanoid']).default('beast'),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  habitatLocationIds: z.array(z.string()).default([]),
  behavioralTactics: z.string().default(''),
  weaknesses: z.array(z.string()).default([]),
  resistances: z.array(z.string()).default([]),
  harvestableLoot: z.array(z.object({
    itemId: z.string(),
    name: z.string(),
    dropRate: z.string(),
  })).default([]),
  loreDescription: z.string().default(''),
});

export const WorldArtifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().default(''),
  originEra: z.string().default(''),
  rarity: z.enum(['uncommon', 'rare', 'epic', 'legendary', 'mythic']).default('rare'),
  description: z.string().default(''),
  powers: z.array(z.string()).default([]),
  curseOrCost: z.string().optional(),
  attunementRules: z.string().optional(),
  currentHolderType: z.enum(['npc', 'location', 'faction', 'vault', 'unknown']).default('unknown'),
  currentHolderId: z.string().default(''),
  secretLore: z.string().optional(),
});

export const CustomRelationTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  sourceCategory: z.enum(['location', 'npc', 'faction', 'law', 'any']).default('any'),
  targetCategory: z.enum(['location', 'npc', 'faction', 'law', 'any']).default('any'),
  color: z.string().default('#38BDF8'),
  isDirected: z.boolean().default(false),
  isDefault: z.boolean().optional(),
});

export const CustomPlaceCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#38BDF8'),
  defaultDangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  isDefault: z.boolean().optional(),
});

export const CustomLawCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#FB7185'),
  isDefault: z.boolean().optional(),
});

export const CustomNPCRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#F59E0B'),
  isDefault: z.boolean().optional(),
});

export const CustomDomainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#F59E0B'),
  isDefault: z.boolean().optional(),
});

export const CustomLoreRelationSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relationTypeId: z.string().min(1),
  customLabel: z.string().optional(),
});

export const WorldOntologySchema = z.object({
  relationTypes: z.array(CustomRelationTypeSchema).default([]),
  placeCategories: z.array(CustomPlaceCategorySchema).default([]),
  lawCategories: z.array(CustomLawCategorySchema).default([]),
  npcRoles: z.array(CustomNPCRoleSchema).default([]),
  domains: z.array(CustomDomainSchema).default([]),
});

export const WorldLawSchema = z.object({
  id: z.string(),
  rule: z.string().min(3),
  description: z.string(),
  category: z.string().default('magic'),
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
  category: z.string().optional(),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  connectedLocationIds: z.array(z.string()).default([]),
  atmosphere: z.string(),
  specialRules: z.array(z.string()).optional(),
});

export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  yearOrEra: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  significance: z.string().default(''),
  knownByPublic: z.boolean().default(true),
  eraCategory: z.enum(['ancient', 'war', 'reign', 'cataclysm', 'present']).default('ancient'),
  linkedFactionIds: z.array(z.string()).optional(),
  linkedLocationIds: z.array(z.string()).optional(),
  secretDetails: z.string().optional(),
});

export const NPCDossierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().default(''),
  factionId: z.string().optional(),
  currentLocationId: z.string(),
  personalityTraits: z.array(z.string()).default([]),
  speechStyle: z.string().default(''),
  goals: z.array(z.string()).default([]),
  secrets: z.array(z.object({
    id: z.string(),
    description: z.string(),
    requiredTrustLevel: z.number(),
    revealed: z.boolean().default(false),
  })).default([]),
  initialTrust: z.number().default(0),
});

export const WorldBibleSchema = z.object({
  worldId: z.string(),
  worldName: z.string().min(2),
  summary: z.string(),
  themeNotes: z.string(),
  aiSystemPrompt: z.string().optional(),
  laws: z.array(WorldLawSchema).default([]),
  factions: z.array(FactionSchema).default([]),
  locations: z.array(WorldLocationSchema).default([]),
  timeline: z.array(TimelineEventSchema).default([]),
  npcs: z.array(NPCDossierSchema).default([]),
  artifacts: z.array(WorldArtifactSchema).default([]),
  bestiary: z.array(WorldCreatureSchema).default([]),
  religions: z.array(WorldDeitySchema).default([]),
  dramaBonds: z.array(NPCDramaBondSchema).default([]),
  ontology: WorldOntologySchema.optional(),
  customRelations: z.array(CustomLoreRelationSchema).default([]),
});
