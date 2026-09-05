import { z } from 'zod';

// ----------------------------------------------------------------------------
// Plan 01: Seed-to-Cosmos Genesis Generator schemas
// ----------------------------------------------------------------------------

export const GenesisLocationSchema = z.object({
  id: z.string().default(() => `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
  name: z.string().min(1).default('Unnamed Location'),
  region: z.string().default(''),
  description: z.string().default(''),
  atmosphere: z.string().default(''),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  specialRules: z.array(z.string()).default([]),
  connectedLocationIds: z.array(z.string()).default([]),
});


export const GenesisFactionRelationSchema = z.object({
  sourceFactionId: z.string().default(''),
  targetFactionId: z.string().default(''),
  value: z.enum(['allied', 'favorable', 'neutral', 'rival', 'hostile']).default('neutral'),
  note: z.string().default(''),
});

export const GenesisFactionSchema = z.object({
  id: z.string().default(() => `fac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
  name: z.string().min(1).default('Unnamed Faction'),
  description: z.string().default(''),
  alignment: z.string().default('neutral'),
  publicGoals: z.string().default(''),
  secretAgendas: z.string().default(''),
  scope: z.enum(['street', 'regional', 'continental', 'mythic']).optional(),
  rivalFactionIds: z.array(z.string()).default([]),
  alliedFactionIds: z.array(z.string()).default([]),
  territoryIds: z.array(z.string()).default([]),
});

export const GenesisLawSchema = z.object({
  id: z.string().default(() => `law_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
  rule: z.string().min(1).default('Immutable World Law'),
  description: z.string().default(''),
  category: z.string().default('magic'),
  isImmutable: z.boolean().default(true),
});

export const GenesisReligionSchema = z.object({
  id: z.string().default(() => `deity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
  name: z.string().min(1).default('Unnamed Deity'),
  title: z.string().default(''),
  domain: z.string().default('light'),
  sacredSymbol: z.string().default(''),
  coreDogma: z.string().default(''),
  taboos: z.array(z.string()).default([]),
  divineBlessings: z.array(z.string()).default([]),
});

export const GenesisWorldSchema = z.object({
  worldName: z.string().min(1).default('New World'),
  tagline: z.string().default(''),
  summary: z.string().default(''),
  themeNotes: z.string().default(''),
  aiSystemPrompt: z.string().default(''),
  laws: z.array(GenesisLawSchema).default([]),
  factions: z.array(GenesisFactionSchema).default([]),
  factionRelations: z.array(GenesisFactionRelationSchema).optional().default([]),
  locations: z.array(GenesisLocationSchema).default([]),
  religions: z.array(GenesisReligionSchema).default([]),
  coreCampaignMystery: z.string().default(''),
});

export type GenesisWorldData = z.infer<typeof GenesisWorldSchema>;

export const GENESIS_EXPECTED_COUNTS = {
  laws: 4,
  factions: 3,
  locations: 4,
  religions: 2,
} as const;

const PLACEHOLDER_NAMES = new Set(
  ['world law', 'faction', 'location', 'deity', 'unnamed location', 'unnamed faction', 'unnamed deity', 'immutable world law', 'new world', 'new realm'].map((s) =>
    s.toLowerCase()
  )
);

const PLACEHOLDER_ID_PATTERN = /^(law|fac|loc|deity)_00\d+$/;

/**
 * Detects low-quality placeholder entities that normalizeGenesisData fills in
 * when the model under-generates (e.g. name "Faction", id "fac_001").
 * Returns human-readable issue strings; empty = clean.
 */
export function hasPlaceholders(data: GenesisWorldData): string[] {
  const issues: string[] = [];
  if (!data) return ['empty genesis payload'];
  const checkCount = (label: string, arr: unknown[], expected: number) => {
    if (!Array.isArray(arr) || arr.length !== expected) {
      issues.push(`${label}: expected ${expected}, got ${Array.isArray(arr) ? arr.length : 0}`);
    }
  };
  checkCount('laws', data.laws as unknown[], GENESIS_EXPECTED_COUNTS.laws);
  checkCount('factions', data.factions as unknown[], GENESIS_EXPECTED_COUNTS.factions);
  checkCount('locations', data.locations as unknown[], GENESIS_EXPECTED_COUNTS.locations);
  checkCount('religions', data.religions as unknown[], GENESIS_EXPECTED_COUNTS.religions);

  for (const l of data.laws || []) {
    if (!l.rule || l.rule.trim().length < 8 || PLACEHOLDER_NAMES.has(l.rule.trim().toLowerCase())) {
      issues.push(`law "${l.id}": placeholder rule`);
    }
    if (PLACEHOLDER_ID_PATTERN.test(l.id || '')) issues.push(`law "${l.id}": auto id (model did not assign stable id)`);
    if (!l.description || l.description.trim().length < 10) issues.push(`law "${l.id}": thin description`);
  }
  for (const f of data.factions || []) {
    if (!f.name || PLACEHOLDER_NAMES.has(f.name.trim().toLowerCase())) {
      issues.push(`faction "${f.id}": placeholder name`);
    }
    if (PLACEHOLDER_ID_PATTERN.test(f.id || '')) issues.push(`faction "${f.id}": auto id`);
  }
  for (const l of data.locations || []) {
    if (!l.name || PLACEHOLDER_NAMES.has(l.name.trim().toLowerCase())) {
      issues.push(`location "${l.id}": placeholder name`);
    }
    if (PLACEHOLDER_ID_PATTERN.test(l.id || '')) issues.push(`location "${l.id}": auto id`);
    if (!l.description || l.description.trim().length < 10) issues.push(`location "${l.id}": thin description`);
  }
  for (const r of data.religions || []) {
    if (!r.name || PLACEHOLDER_NAMES.has(r.name.trim().toLowerCase())) {
      issues.push(`religion "${r.id}": placeholder name`);
    }
    if (PLACEHOLDER_ID_PATTERN.test(r.id || '')) issues.push(`religion "${r.id}": auto id`);
  }
  if (!data.worldName || PLACEHOLDER_NAMES.has(data.worldName.trim().toLowerCase())) {
    issues.push('worldName: placeholder');
  }
  return issues;
}

/**
 * Normalizes raw AI output into a strictly valid GenesisWorldData structure,
 * handling variations like nested "meta" objects, "deities" instead of "religions",
 * and missing defaults.
 */
export function normalizeGenesisData(raw: any): GenesisWorldData {
  if (!raw || typeof raw !== 'object') {
    return GenesisWorldSchema.parse({});
  }

  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const worldName = raw.worldName || meta.worldName || raw.name || meta.name || 'New Realm';
  const tagline = raw.tagline || meta.tagline || '';
  const summary = raw.summary || meta.summary || raw.description || meta.description || '';
  const themeNotes = raw.themeNotes || meta.themeNotes || '';
  const aiSystemPrompt = raw.aiSystemPrompt || meta.aiSystemPrompt || '';

  const rawLaws = Array.isArray(raw.laws) ? raw.laws : [];
  const laws = rawLaws.map((l: any, idx: number) => ({
    id: l?.id || `law_00${idx + 1}`,
    rule: l?.rule || l?.name || l?.title || 'World Law',
    description: l?.description || (l?.consequence ? `${l.description || ''} Consequence: ${l.consequence}`.trim() : ''),
    category: l?.category || 'magic',
    isImmutable: true,
  }));

  const rawFactions = Array.isArray(raw.factions) ? raw.factions : [];
  const factions = rawFactions.map((f: any, idx: number) => ({
    id: f?.id || `fac_00${idx + 1}`,
    name: f?.name || 'Faction',
    description: f?.description || (f?.motto ? `${f.description || ''} Motto: ${f.motto}`.trim() : ''),
    alignment: f?.alignment || 'neutral',
    publicGoals: f?.publicGoals || f?.motto || '',
    secretAgendas: f?.secretAgendas || '',
    scope: ['street', 'regional', 'continental', 'mythic'].includes(f?.scope) ? f.scope : undefined,
    rivalFactionIds: Array.isArray(f?.rivalFactionIds) ? f.rivalFactionIds : [],
    alliedFactionIds: Array.isArray(f?.alliedFactionIds) ? f.alliedFactionIds : [],
    territoryIds: Array.isArray(f?.territoryIds) ? f.territoryIds : [],
  }));

  const rawLocations = Array.isArray(raw.locations) ? raw.locations : [];
  const locations = rawLocations.map((loc: any, idx: number) => {
    const rawDanger = Number(loc?.dangerLevel);
    const dangerLevel: 1 | 2 | 3 | 4 | 5 =
      rawDanger === 1 || rawDanger === 2 || rawDanger === 3 || rawDanger === 4 || rawDanger === 5
        ? rawDanger
        : 3;
    return {
      id: loc?.id || `loc_00${idx + 1}`,
      name: loc?.name || 'Location',
      region: loc?.region || '',
      description: loc?.description || '',
      atmosphere: loc?.atmosphere || '',
      dangerLevel,
      specialRules: Array.isArray(loc?.specialRules) ? loc.specialRules : [],
      connectedLocationIds: Array.isArray(loc?.connectedLocationIds) ? loc.connectedLocationIds : [],
    };
  });


  const rawReligions = Array.isArray(raw.religions)
    ? raw.religions
    : Array.isArray(raw.deities)
    ? raw.deities
    : [];
  const religions = rawReligions.map((r: any, idx: number) => ({
    id: r?.id || `deity_00${idx + 1}`,
    name: r?.name || 'Deity',
    title: r?.title || '',
    domain: r?.domain || 'light',
    sacredSymbol: r?.sacredSymbol || '',
    coreDogma: r?.coreDogma || (Array.isArray(r?.tenets) ? r.tenets.join('; ') : r?.description || ''),
    taboos: Array.isArray(r?.taboos) ? r.taboos : [],
    divineBlessings: Array.isArray(r?.divineBlessings) ? r.divineBlessings : [],
  }));

  const coreCampaignMystery = raw.coreCampaignMystery || raw.mystery || raw.campaignMystery || '';

  const rawRelations = Array.isArray(raw.factionRelations)
    ? raw.factionRelations
    : Array.isArray(raw.relations)
    ? raw.relations
    : [];
  const factionRelations = rawRelations.map((r: any) => ({
    sourceFactionId: r?.sourceFactionId || '',
    targetFactionId: r?.targetFactionId || '',
    value: ['allied', 'favorable', 'neutral', 'rival', 'hostile'].includes(r?.value) ? r.value : 'neutral',
    note: r?.note || '',
  }));

  return GenesisWorldSchema.parse({
    worldName,
    tagline,
    summary,
    themeNotes,
    aiSystemPrompt,
    laws,
    factions,
    factionRelations,
    locations,
    religions,
    coreCampaignMystery,
  });
}


// ----------------------------------------------------------------------------
// Plan 01: Contradiction Radar (Lore Consistency Auditor) schemas
// ----------------------------------------------------------------------------

export const ContradictionFindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['error', 'warning', 'suggestion']),
  category: z.enum([
    'law_conflict',
    'timeline_paradox',
    'faction_rivalry',
    'magic_violation',
    'missing_link',
  ]),
  title: z.string().min(2),
  description: z.string().min(5),
  involvedEntities: z
    .array(
      z.object({
        entityType: z.string(),
        name: z.string(),
      })
    )
    .default([]),
  suggestedFix: z.string().default(''),
});

export const ContradictionAuditReportSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().min(5),
  findings: z.array(ContradictionFindingSchema).default([]),
});

export type ContradictionAuditReport = z.infer<typeof ContradictionAuditReportSchema>;
export type ContradictionFinding = z.infer<typeof ContradictionFindingSchema>;

// ----------------------------------------------------------------------------
// Prompt builders
// ----------------------------------------------------------------------------

export const GENESIS_SYSTEM_DIRECTIVES = `You are the Master World-Building Co-Pilot for AfsanehSaz. You will output a single, fully self-consistent starter world package as a JSON object.

STRICT REQUIREMENTS:
- Generate EXACTLY 4 immutable World Laws, 3 Factions, 4 Locations, and 2 Deities/Religions.
- MEANINGFUL WORLD LAWS: Every World Law must establish a high-stakes, dramatic rule of engagement that directly impacts the story, narrative choices, and player actions (e.g. strict costs/scars of magic, environmental/physical hazards, sacred covenants, or forbidden societal edicts). NEVER generate shallow filler or arbitrary creature extinction trivia (e.g. "creatures X are extinct"). Every law must have real meaning and consequence in the world.
- You MUST assign stable, unique snake_case string ids to EVERY entity (e.g. "law_001", "fac_iron_inquisition", "loc_obsidian_citadel", "deity_sovereign_fire"). Use the SAME id when one entity references another (faction.territoryIds must list location ids you created; location.connectedLocationIds must list other location ids you created; faction.rivalFactionIds / alliedFactionIds must list other faction ids you created).
- Every entity must be anchored to the others: factions hold territories you created, locations connect to each other, deities have clear thematic ties to the laws and factions.
- Output literary, atmospheric prose. Avoid generic AI tropes ("tapestry of fate", "whispers of the forgotten", "ancient evil awakens").
- Output ONLY valid JSON matching the requested schema. No markdown fences.`;


export function buildGenesisUserPrompt(opts: {
  prompt: string;
  isPersian: boolean;
  themeContext?: string;
}): string {
  const langNote = opts.isPersian
    ? 'تمام متون روایی، نام‌ها و توصیفات را به فارسی ادبی و با وقار بنویس. رشته‌های id را انگلیسی (snake_case) نگه دار.'
    : 'Write all narrative text, names, and descriptions in literary English. Keep id strings in English snake_case.';
  return `World premise / guidance from the author:
"${opts.prompt || 'A dark, atmospheric world with deep political tension and forbidden arcane secrets.'}"

${opts.themeContext ? `Theme context: ${opts.themeContext}\n\n` : ''}${langNote}

Strict JSON Schema to return:
{
  "worldName": "Name of the World",
  "tagline": "A compelling atmospheric tagline",
  "summary": "Rich narrative summary of the world",
  "themeNotes": "Tone, themes, and aesthetic notes",
  "aiSystemPrompt": "System storytelling persona instructions",
  "laws": [
    { "id": "law_001", "rule": "High-stakes immutable rule", "description": "Details & consequences", "category": "magic|physics|society|divine", "isImmutable": true }
  ],
  "factions": [
    { "id": "fac_001", "name": "Faction Name", "description": "Lore description", "alignment": "Lawful/Neutral/Rebel", "publicGoals": "...", "secretAgendas": "...", "territoryIds": ["loc_001"], "rivalFactionIds": [], "alliedFactionIds": [] }
  ],
  "locations": [
    { "id": "loc_001", "name": "Location Name", "region": "...", "description": "Atmospheric description", "atmosphere": "...", "dangerLevel": 3, "specialRules": [], "connectedLocationIds": ["loc_002"] }
  ],
  "religions": [
    { "id": "deity_001", "name": "Deity/Faith Name", "title": "Honorific", "domain": "light|death|war|secrets|nature|chaos|forge", "sacredSymbol": "...", "coreDogma": "...", "taboos": ["..."], "divineBlessings": ["..."] }
  ],
  "coreCampaignMystery": "The overarching central mystery driving the story"
}

Generate the complete Genesis world package matching this schema now. Output valid JSON only.`;
}


export const AUDIT_SYSTEM_DIRECTIVES = `You are the Lore Consistency Auditor for AfsanehSaz. You analyze an entire World Bible and detect continuity breaks, magic-law violations, dangling references, orphaned entities, and timeline paradoxes.

OUTPUT RULES:
- Return a JSON object with: "score" (integer 0-100, where 100 = flawless consistency), "summary" (one or two sentences), and "findings" (array).
- Each finding needs: "id" (unique snake_case), "severity" ("error" | "warning" | "suggestion"), "category" ("law_conflict" | "timeline_paradox" | "faction_rivalry" | "magic_violation" | "missing_link"), "title", "description", "involvedEntities" (array of {entityType, name}), and "suggestedFix".
- Be specific and cite real entity names from the provided World Bible.
- Output ONLY valid JSON. No markdown fences.`;

export function buildAuditUserPrompt(opts: {
  isPersian: boolean;
  worldContext: string;
}): string {
  const langNote = opts.isPersian
    ? 'عنوان‌ها و توصیف‌ها را به فارسی بنویس، اما شناسه‌ها (id) و مقادیر enum را انگلیسی نگه دار.'
    : 'Write titles and descriptions in English; keep ids and enum values in English.';
  return `Audit the following World Bible for lore contradictions and consistency issues.

${langNote}

WORLD BIBLE:
${opts.worldContext}

Return the consistency audit JSON now.`;
}
