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
  /** Legacy binary links (kept for backwards compat; see factionRelations). */
  rivalFactionIds: string[];
  alliedFactionIds: string[];
  publicGoals: string;
  secretAgendas?: string;
  /**
   * Chapter scope tier at which this faction becomes narratively active.
   * Street/regional chapters prune factions whose scope outranks the chapter
   * (e.g. a mythic cosmic dominion stays hidden until the saga escalates).
   * Omitted = always relevant (backwards compatible).
   */
  scope?: ScopeTier;
}

/**
 * 5-state faction Relation Spectrum (base layer of inter-faction dynamics).
 * Ordered from warmest to coldest: allied > favorable > neutral > rival > hostile.
 */
export const FACTION_RELATION_VALUES = ['allied', 'favorable', 'neutral', 'rival', 'hostile'] as const;
export type FactionRelationValue = (typeof FACTION_RELATION_VALUES)[number];

export const FACTION_RELATION_META: Record<
  FactionRelationValue,
  { rank: number; labelFa: string; labelEn: string; meaning: string }
> = {
  allied: {
    rank: 2,
    labelFa: 'متحد رسمی',
    labelEn: 'Sworn Ally',
    meaning: 'پیمان مشترک، تبادل منابع و نبرد در یک جبهه — shared pact, resource exchange, fighting on one front.',
  },
  favorable: {
    rank: 1,
    labelFa: 'هم‌پیمان پنهان / متمایل',
    labelEn: 'Favorable',
    meaning: 'توافقات غیررسمی، اشتراکات فکری یا هم‌پوشانی اهداف بدون اعلام برادری آشکار — informal accords and overlapping goals, no open brotherhood.',
  },
  neutral: {
    rank: 0,
    labelFa: 'بی‌طرف / عمل‌گرا',
    labelEn: 'Neutral',
    meaning: 'عدم مداخله؛ رابطه صرفاً تجاری، نظاره‌گر یا سرد بر اساس منافع لحظه‌ای — non-intervention, transactional or cold by momentary interest.',
  },
  rival: {
    rank: -1,
    labelFa: 'رقیب / اصطکاک ایدئولوژیک',
    labelEn: 'Rival',
    meaning: 'رقابت بر سر نفوذ و پیروان، تنش کلامی و سیاسی بدون جنگ باز — contest over influence, verbal/political tension short of open war.',
  },
  hostile: {
    rank: -2,
    labelFa: 'دشمن خونی / جنگ علنی',
    labelEn: 'Blood Enemy',
    meaning: 'ارتداد قطعی، فتوای نابودی، نبرد مسلحانه در میدان — definitive rupture, writ of destruction, armed battle in the field.',
  },
};

export interface FactionRelation {
  id: string;
  sourceFactionId: string;
  targetFactionId: string;
  value: FactionRelationValue;
  /** In-world note: treaties, grievances, blood debts behind the stance. */
  note?: string;
  /** Secret relations are hidden from the player compendium but seen by the narrator. */
  isPublic?: boolean;
}

export function factionRelationRank(v: FactionRelationValue | undefined): number {
  if (!v) return 0;
  return FACTION_RELATION_META[v]?.rank ?? 0;
}

/**
 * Resolves the effective relation between two factions.
 * Precedence: explicit factionRelations entry (either direction) >
 * legacy alliedFactionIds/rivalFactionIds > neutral default.
 */
export function getFactionRelation(
  wb: { factions?: Faction[]; factionRelations?: FactionRelation[] },
  aId: string,
  bId: string
): FactionRelationValue {
  for (const r of wb.factionRelations || []) {
    const match =
      (r.sourceFactionId === aId && r.targetFactionId === bId) ||
      (r.sourceFactionId === bId && r.targetFactionId === aId);
    if (match) return r.value;
  }
  const a = (wb.factions || []).find((f) => f.id === aId);
  if (a) {
    if ((a.alliedFactionIds || []).includes(bId)) return 'allied';
    if ((a.rivalFactionIds || []).includes(bId)) return 'rival';
  }
  const b = (wb.factions || []).find((f) => f.id === bId);
  if (b) {
    if ((b.alliedFactionIds || []).includes(aId)) return 'allied';
    if ((b.rivalFactionIds || []).includes(aId)) return 'rival';
  }
  return 'neutral';
}

/**
 * Derives legacy rival/allied id arrays from the spectrum (compat writer).
 * favorable/neutral dissolve into no legacy link; hostile maps to rival
 * (open war implies rivalry) so legacy readers stay safe.
 */
export function deriveLegacyFactionLinks(relations: FactionRelation[]): Map<string, { rivals: string[]; allies: string[] }> {
  const out = new Map<string, { rivals: string[]; allies: string[] }>();
  const ensure = (id: string) => {
    let e = out.get(id);
    if (!e) {
      e = { rivals: [], allies: [] };
      out.set(id, e);
    }
    return e;
  };
  for (const r of relations) {
    if (r.value === 'allied') {
      ensure(r.sourceFactionId).allies.push(r.targetFactionId);
      ensure(r.targetFactionId).allies.push(r.sourceFactionId);
    } else if (r.value === 'rival' || r.value === 'hostile') {
      ensure(r.sourceFactionId).rivals.push(r.targetFactionId);
      ensure(r.targetFactionId).rivals.push(r.sourceFactionId);
    }
  }
  return out;
}

export interface LocationPointOfInterest {
  name: string;
  description: string;
  skillCheck?: {
    attribute: string;
    dc: number;
    failureConsequence: string;
  };
}

export interface LocationSubZone {
  id: string;
  name: string;
  subType: 'dungeon' | 'sanctuary' | 'ruin' | 'vault' | 'market' | 'hazard_zone' | string;
  dangerLevel: 1 | 2 | 3 | 4 | 5;
  atmosphere: string;
  explorationHooks: string[];
  pointsOfInterest: LocationPointOfInterest[];
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
  subZones?: LocationSubZone[];
  pointsOfInterest?: LocationPointOfInterest[];
}


export interface TimelineRippleRepercussion {
  targetType: 'faction' | 'location' | 'artifact' | 'religion';
  targetName: string;
  effectDescription: string;
}

export interface TimelineRipple {
  sourceEventTitle: string;
  modernRepercussions: TimelineRippleRepercussion[];
}

export interface EpochArcEra {
  eraName: string;
  timeframe: string;
  description: string;
  majorCataclysm: string;
  legacyFactions: string[];
}

export interface EpochArcKeyEvent {
  title: string;
  eraName: string;
  narrativeSummary: string;
  lastingConsequences: string;
}

export interface EpochArc {
  eras: EpochArcEra[];
  keyEvents: EpochArcKeyEvent[];
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
  ripples?: TimelineRippleRepercussion[];
}

export interface NpcSampleDialogue {
  context: 'greeting' | 'bargaining' | 'threatened' | 'dying';
  quote: string;
}

export interface NpcVoiceGuide {
  npcName: string;
  speechQuirks: string[];
  sampleDialogue: NpcSampleDialogue[];
  negotiationVulnerabilities: string[];
  psychologicalBreakingPoint: string;
}

export interface NpcEquippedGear {
  name: string;
  type: string;
  description?: string;
}

export interface NpcStatCalibration {
  npcId?: string;
  npcName: string;
  combatTier: 'civilian' | 'apprentice' | 'veteran' | 'elite' | 'boss' | 'mythic';
  challengeRating: number; // 1 to 20
  statRatings: Record<string, number>;
  signatureAbilities: string[];
  equippedGear: NpcEquippedGear[];
}

export interface NpcRelationshipBond {
  id: string;
  sourceNpcId: string;
  targetNpcId: string;
  targetNpcName: string;
  relationTypeId: string;
  affinity: number; // -100 to 100
  secretTension: string;
  isPublic: boolean;
}

export interface NpcRelationshipWeb {
  sourceNpcId: string;
  sourceNpcName: string;
  bonds: NpcRelationshipBond[];
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
  voiceGuide?: NpcVoiceGuide;
  statCalibration?: NpcStatCalibration;
}

export interface ArtifactVaultLore {
  creator: string;
  currentVaultLocation: string;
  unsealingRitual: string;
  rivalSeekers: string[];
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
  vaultLore?: ArtifactVaultLore;
}

export interface CreatureAlchemicalYield {
  reagentName: string;
  rarity: string;
  craftingUse: string;
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
  predatorPreyNiche?: string;
  nonCombatPacificationMethod?: string;
  alchemicalYields?: CreatureAlchemicalYield[];
}

export interface SectarianSchism {
  cultName: string;
  heresyDoctrine: string;
  headquartersLocation?: string;
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
  divineOmensForViolation?: string;
  sectarianSchisms?: SectarianSchism[];
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
  /** Canon version, bumped on every publish. Sessions pin to it. */
  worldBibleVersion?: number;
  laws: WorldLaw[];
  factions: Faction[];
  locations: WorldLocation[];
  timeline: TimelineEvent[];
  npcs: NPCDossier[];
  artifacts?: WorldArtifact[];
  bestiary?: WorldCreature[];
  religions?: WorldDeity[];
  dramaBonds?: NPCDramaBond[];
  /** 5-state inter-faction relation spectrum (new) + legacy rival/allied arrays. */
  factionRelations?: FactionRelation[];
  ontology?: WorldOntology;
  customRelations?: CustomLoreRelation[];
  oracleDirectives?: OracleMemoryDirective[];
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

export const TimelineRippleRepercussionSchema = z.object({
  targetType: z.enum(['faction', 'location', 'artifact', 'religion']),
  targetName: z.string(),
  effectDescription: z.string(),
});

export const TimelineRippleSchema = z.object({
  sourceEventTitle: z.string(),
  modernRepercussions: z.array(TimelineRippleRepercussionSchema).min(2),
});

export const EpochArcEraSchema = z.object({
  eraName: z.string(),
  timeframe: z.string(),
  description: z.string(),
  majorCataclysm: z.string(),
  legacyFactions: z.array(z.string()).default([]),
});

export const EpochArcKeyEventSchema = z.object({
  title: z.string(),
  eraName: z.string(),
  narrativeSummary: z.string(),
  lastingConsequences: z.string(),
});

export const EpochArcSchema = z.object({
  eras: z.array(EpochArcEraSchema).length(3),
  keyEvents: z.array(EpochArcKeyEventSchema).min(4),
});

export const ArtifactVaultLoreSchema = z.object({
  creator: z.string(),
  currentVaultLocation: z.string(),
  unsealingRitual: z.string(),
  rivalSeekers: z.array(z.string()).default([]),
});

export const EnhancedArtifactSchema = z.object({
  name: z.string(),
  rarity: z.enum(['uncommon', 'rare', 'epic', 'legendary', 'mythic']),
  attunementCost: z.string().default(''),
  activePower: z.string(),
  doubleEdgedCurse: z.string().default(''),
  vaultLore: ArtifactVaultLoreSchema,
});

export const CreatureAlchemicalYieldSchema = z.object({
  reagentName: z.string(),
  rarity: z.string().default('uncommon'),
  craftingUse: z.string(),
});

export const EnhancedCreatureSchema = z.object({
  name: z.string(),
  speciesCategory: z.enum(['beast', 'monstrosity', 'undead', 'elemental', 'flora', 'draconic', 'humanoid']),
  habitatLocationName: z.string(),
  predatorPreyNiche: z.string(),
  nonCombatPacificationMethod: z.string(),
  alchemicalYields: z.array(CreatureAlchemicalYieldSchema).min(1).max(3),
});

export const SectarianSchismSchema = z.object({
  cultName: z.string(),
  heresyDoctrine: z.string(),
  headquartersLocation: z.string().optional(),
});

export const EnhancedReligionSchema = z.object({
  name: z.string(),
  domain: z.string(),
  sacredTaboos: z.array(z.string()),
  divineOmensForViolation: z.string(),
  divineBlessing: z.string(),
  sectarianSchisms: z.array(SectarianSchismSchema).default([]),
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
  divineOmensForViolation: z.string().optional(),
  sectarianSchisms: z.array(SectarianSchismSchema).optional(),
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
  predatorPreyNiche: z.string().optional(),
  nonCombatPacificationMethod: z.string().optional(),
  alchemicalYields: z.array(CreatureAlchemicalYieldSchema).optional(),
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
  vaultLore: ArtifactVaultLoreSchema.optional(),
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
  scope: z.enum(['street', 'regional', 'continental', 'mythic']).optional(),
});

export const FactionRelationValueSchema = z.enum(['allied', 'favorable', 'neutral', 'rival', 'hostile']);

export const FactionRelationSchema = z.object({
  id: z.string().min(1),
  sourceFactionId: z.string().min(1),
  targetFactionId: z.string().min(1),
  value: FactionRelationValueSchema,
  note: z.string().default(''),
  isPublic: z.boolean().default(true),
});

export const LocationPointOfInterestSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  skillCheck: z.object({
    attribute: z.string(),
    dc: z.number().min(5).max(30),
    failureConsequence: z.string(),
  }).optional(),
});

export const LocationSubZoneSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  subType: z.enum(['dungeon', 'sanctuary', 'ruin', 'vault', 'market', 'hazard_zone']).or(z.string()),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  atmosphere: z.string(),
  explorationHooks: z.array(z.string()).default([]),
  pointsOfInterest: z.array(LocationPointOfInterestSchema).default([]),
});

export const LocationSubZonesEnvelopeSchema = z.object({
  parentLocationId: z.string().optional(),
  subZones: z.array(LocationSubZoneSchema).min(1),
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
  subZones: z.array(LocationSubZoneSchema).optional(),
  pointsOfInterest: z.array(LocationPointOfInterestSchema).optional(),
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
  ripples: z.array(TimelineRippleRepercussionSchema).optional(),
});

export const NpcRelationshipBondSchema = z.object({
  id: z.string(),
  sourceNpcId: z.string(),
  targetNpcId: z.string(),
  targetNpcName: z.string(),
  relationTypeId: z.string().default('ally'),
  affinity: z.number().min(-100).max(100).default(0),
  secretTension: z.string().default(''),
  isPublic: z.boolean().default(true),
});

export const NpcRelationshipWebSchema = z.object({
  sourceNpcId: z.string(),
  sourceNpcName: z.string(),
  bonds: z.array(NpcRelationshipBondSchema).min(1),
});

export const NpcSampleDialogueSchema = z.object({
  context: z.enum(['greeting', 'bargaining', 'threatened', 'dying']),
  quote: z.string(),
});

export const NpcVoiceGuideSchema = z.object({
  npcName: z.string(),
  speechQuirks: z.array(z.string()).default([]),
  sampleDialogue: z.array(NpcSampleDialogueSchema).min(1),
  negotiationVulnerabilities: z.array(z.string()).default([]),
  psychologicalBreakingPoint: z.string().default(''),
});

export const NpcEquippedGearSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});

export const NpcStatCalibrationSchema = z.object({
  npcId: z.string().optional(),
  npcName: z.string(),
  combatTier: z.enum(['civilian', 'apprentice', 'veteran', 'elite', 'boss', 'mythic']).default('veteran'),
  challengeRating: z.number().min(1).max(20).default(1),
  statRatings: z.record(z.string(), z.number()).default({}),
  signatureAbilities: z.array(z.string()).default([]),
  equippedGear: z.array(NpcEquippedGearSchema).default([]),
});

export const NPCDossierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  title: z.string().default(''),
  role: z.string().optional(),
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
  voiceGuide: NpcVoiceGuideSchema.optional(),
  statCalibration: NpcStatCalibrationSchema.optional(),
});

export const WorldBibleSchema = z.object({
  worldId: z.string(),
  worldName: z.string().min(2),
  summary: z.string(),
  themeNotes: z.string(),
  aiSystemPrompt: z.string().optional(),
  worldBibleVersion: z.number().int().min(1).default(1),
  laws: z.array(WorldLawSchema).default([]),
  factions: z.array(FactionSchema).default([]),
  locations: z.array(WorldLocationSchema).default([]),
  timeline: z.array(TimelineEventSchema).default([]),
  npcs: z.array(NPCDossierSchema).default([]),
  artifacts: z.array(WorldArtifactSchema).default([]),
  bestiary: z.array(WorldCreatureSchema).default([]),
  religions: z.array(WorldDeitySchema).default([]),
  dramaBonds: z.array(NPCDramaBondSchema).default([]),
  factionRelations: z.array(FactionRelationSchema).default([]),
  ontology: WorldOntologySchema.optional(),
  customRelations: z.array(CustomLoreRelationSchema).default([]),
});

export const PopulateLocationSchema = z.object({
  locationId: z.string().optional(),
  npcs: z.array(NPCDossierSchema).min(1),
  creature: WorldCreatureSchema,
  hiddenRelic: WorldArtifactSchema,
});
export type PopulateLocationPayload = z.infer<typeof PopulateLocationSchema>;
export type LocationSubZonePayload = z.infer<typeof LocationSubZonesEnvelopeSchema>;
export type NpcRelationshipWebPayload = z.infer<typeof NpcRelationshipWebSchema>;
export type NpcVoiceGuidePayload = z.infer<typeof NpcVoiceGuideSchema>;
export type NpcStatCalibrationPayload = z.infer<typeof NpcStatCalibrationSchema>;
export type EpochArcPayload = z.infer<typeof EpochArcSchema>;
export type TimelineRipplePayload = z.infer<typeof TimelineRippleSchema>;
export type EnhancedArtifactPayload = z.infer<typeof EnhancedArtifactSchema>;
export type EnhancedCreaturePayload = z.infer<typeof EnhancedCreatureSchema>;
export type EnhancedReligionPayload = z.infer<typeof EnhancedReligionSchema>;

// --- Plan 06: Theme-to-RPG System Schema ---
export const ThemeRpgStatSchema = z.object({
  id: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  description: z.string(),
  defaultValue: z.number().default(10),
});

export const ThemeRpgResourceSchema = z.object({
  id: z.string(),
  nameFa: z.string(),
  nameEn: z.string(),
  maxValue: z.number(),
  decayRule: z.string().optional(),
});

export const ThemeRpgArchetypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  startingStats: z.record(z.string(), z.number()),
  signaturePerk: z.string(),
  startingInventory: z.array(z.string()),
});

export const ThemeRpgSystemSchema = z.object({
  themeJustification: z.string(),
  stats: z.array(ThemeRpgStatSchema).min(3).max(6),
  resources: z.array(ThemeRpgResourceSchema).min(2).max(4),
  archetypes: z.array(ThemeRpgArchetypeSchema).min(3).max(5),
});
export type ThemeRpgSystemPayload = z.infer<typeof ThemeRpgSystemSchema>;

// --- Plan 06: 3-Act Branching Plot Tree Schema ---
export const BranchingChoiceSchema = z.object({
  style: z.enum(['defensive_diplomatic', 'tactical_agile', 'aggressive_daring']),
  textFa: z.string(),
  textEn: z.string(),
  statCheck: z.object({
    stat: z.string(),
    dc: z.number().min(8).max(25),
  }).optional(),
  leadToSceneId: z.string().optional(),
});

export const BranchingSceneSchema = z.object({
  sceneId: z.string(),
  title: z.string(),
  settingLocationName: z.string(),
  primaryConflict: z.string(),
  presentedChoices: z.array(BranchingChoiceSchema).length(3),
});

export const BranchingActSchema = z.object({
  actNumber: z.number().min(1).max(3),
  actTitle: z.string(),
  scenes: z.array(BranchingSceneSchema),
});

export const BranchingStoryTreeSchema = z.object({
  title: z.string(),
  premise: z.string(),
  acts: z.array(BranchingActSchema).length(3),
});
export type BranchingStoryTree = z.infer<typeof BranchingStoryTreeSchema>;

// --- Oracle Memory & Author Directives Schema ---
export const OracleMemoryDirectiveSchema = z.object({
  id: z.string(),
  directive: z.string(),
  category: z.enum(['canon_fact', 'tone_rule', 'character_arc', 'forbidden_trope', 'custom']).default('canon_fact'),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  sourceMessage: z.string().optional(),
});
export type OracleMemoryDirective = z.infer<typeof OracleMemoryDirectiveSchema>;

// ----------------------------------------------------
// Plan 07: Massive Universe Long-Form Saga & Episodic Campaign Engine
// ----------------------------------------------------

export const ScopeTierSchema = z.enum(['street', 'regional', 'continental', 'mythic']);
export type ScopeTier = z.infer<typeof ScopeTierSchema>;

export const StoryBeatChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  style: z
    .enum(['defensive', 'agile', 'aggressive', 'diplomatic', 'inquisitive'])
    .default('inquisitive'),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
  targetDC: z.number().optional(),
  requiredStatId: z.string().optional(),
  targetSceneId: z.string().optional(),
});

export const StoryBeatSchema = z.object({
  sceneId: z.string().min(1),
  locationId: z.string().default(''),
  narrativeText: z.string().default(''),
  imageUrl: z.string().optional(),
  choices: z.array(StoryBeatChoiceSchema).default([]),
});
export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  scopeTier: ScopeTier;
  /** Macro objective for this chapter, e.g. "Infiltrate the Iron Guild and obtain the sealed ledger" */
  narrativeGoal: string;
  /** How the player participates in this act, e.g. "may fight for either side of the war" */
  playerInvolvement?: string;
  /** Story flags that must be set before this chapter can unlock */
  prerequisiteFlags: string[];
  scenes: StoryBeat[];
  /** Directive used by the AI to compress the chapter into an episodic milestone rollup */
  completionSummaryPrompt: string;
}

export interface ChapterSummaryEntry {
  chapterNumber: number;
  title: string;
  summary: string;
  irreversibleChoices: string[];
}

export interface FactionReputationEntry {
  factionId: string;
  factionName: string;
  score: number; // -100 (Hostile) to +100 (Allied)
  stance: 'hostile' | 'wary' | 'neutral' | 'friendly' | 'allied';
  note?: string;
}

export interface NpcLifeStatusEntry {
  npcId: string;
  npcName: string;
  status: 'alive' | 'dead' | 'imprisoned' | 'missing' | 'companion' | 'transformed';
  note?: string;
}

export interface KeyItemLedgerEntry {
  itemId: string;
  name: string;
  description?: string;
  acquiredChapterNumber?: number;
  isStoryCritical: boolean;
}

/** Tier 3 of the saga memory engine: the Living World State Ledger */
export interface WorldStateLedger {
  factionReputations: FactionReputationEntry[];
  npcStatuses: NpcLifeStatusEntry[];
  keyItems: KeyItemLedgerEntry[];
  /** Tier 2 episodic milestone rollups, one per completed chapter */
  chapterSummaries: ChapterSummaryEntry[];
  openPlotThreads: string[];
  /** Canon Bible version this session is pinned to (set at session start). */
  worldBibleVersion?: number;
}

export interface SagaManifest {
  sagaTitle: string;
  premise: string;
  chapters: StoryChapter[];
  ledger?: WorldStateLedger;
}

export const FactionReputationEntrySchema = z.object({
  factionId: z.string().min(1),
  factionName: z.string().default(''),
  score: z.number().min(-100).max(100).default(0),
  stance: z.enum(['hostile', 'wary', 'neutral', 'friendly', 'allied']).default('neutral'),
  note: z.string().optional(),
});

export const NpcLifeStatusEntrySchema = z.object({
  npcId: z.string().min(1),
  npcName: z.string().default(''),
  status: z
    .enum(['alive', 'dead', 'imprisoned', 'missing', 'companion', 'transformed'])
    .default('alive'),
  note: z.string().optional(),
});

export const KeyItemLedgerEntrySchema = z.object({
  itemId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  acquiredChapterNumber: z.number().int().min(1).optional(),
  isStoryCritical: z.boolean().default(false),
});

export const ChapterSummaryEntrySchema = z.object({
  chapterNumber: z.number().int().min(1),
  title: z.string().default(''),
  summary: z.string().min(3),
  irreversibleChoices: z.array(z.string()).default([]),
});

export const WorldStateLedgerSchema = z.object({
  factionReputations: z.array(FactionReputationEntrySchema).default([]),
  npcStatuses: z.array(NpcLifeStatusEntrySchema).default([]),
  keyItems: z.array(KeyItemLedgerEntrySchema).default([]),
  chapterSummaries: z.array(ChapterSummaryEntrySchema).default([]),
  openPlotThreads: z.array(z.string()).default([]),
  worldBibleVersion: z.number().int().min(1).optional(),
});

export const StoryChapterSchema = z.object({
  id: z.string().min(1),
  chapterNumber: z.number().int().min(1),
  title: z.string().min(2),
  scopeTier: ScopeTierSchema.default('street'),
  narrativeGoal: z.string().default(''),
  playerInvolvement: z.string().optional(),
  prerequisiteFlags: z.array(z.string()).default([]),
  scenes: z.array(StoryBeatSchema).default([]),
  completionSummaryPrompt: z.string().default(''),
});

export const SagaManifestSchema = z.object({
  sagaTitle: z.string().min(2),
  premise: z.string().default(''),
  chapters: z.array(StoryChapterSchema).default([]),
  ledger: WorldStateLedgerSchema.optional(),
});

// --- Plan 07: Multi-Arc Saga Synthesizer AI response schema ---
export const SagaSceneDraftChoiceSchema = z.object({
  style: z.enum(['defensive_diplomatic', 'tactical_agile', 'aggressive_daring']),
  textFa: z.string(),
  textEn: z.string(),
  statCheck: z
    .object({
      stat: z.string(),
      dc: z.number().min(8).max(30),
    })
    .optional(),
  leadToSceneId: z.string().optional(),
});

export const SagaSceneDraftSchema = z.object({
  sceneId: z.string(),
  title: z.string(),
  settingLocationName: z.string(),
  primaryConflict: z.string(),
  presentedChoices: z.array(SagaSceneDraftChoiceSchema).min(1),
});

export const SagaChapterDraftSchema = z.object({
  chapterNumber: z.number().int().min(1),
  title: z.string(),
  scopeTier: ScopeTierSchema,
  narrativeGoal: z.string(),
  prerequisiteFlags: z.array(z.string()).default([]),
  completionSummaryPrompt: z.string().default(''),
  scenes: z.array(SagaSceneDraftSchema).min(1),
});

export const EpicSagaSynthesisSchema = z.object({
  sagaTitle: z.string().min(2),
  premise: z.string(),
  chapters: z.array(SagaChapterDraftSchema).min(3),
});
export type EpicSagaSynthesis = z.infer<typeof EpicSagaSynthesisSchema>;



