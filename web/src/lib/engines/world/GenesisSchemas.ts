import { z } from 'zod';

// ----------------------------------------------------------------------------
// Plan 01: Seed-to-Cosmos Genesis Generator schemas
// ----------------------------------------------------------------------------

export const GenesisLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  region: z.string().default(''),
  description: z.string().min(10),
  atmosphere: z.string().default(''),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(3),
  specialRules: z.array(z.string()).default([]),
  connectedLocationIds: z.array(z.string()).default([]),
});

export const GenesisFactionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  description: z.string().min(10),
  alignment: z.string().default(''),
  publicGoals: z.string().default(''),
  secretAgendas: z.string().default(''),
  rivalFactionIds: z.array(z.string()).default([]),
  alliedFactionIds: z.array(z.string()).default([]),
  territoryIds: z.array(z.string()).default([]),
});

export const GenesisLawSchema = z.object({
  id: z.string().min(1),
  rule: z.string().min(3),
  description: z.string().default(''),
  category: z.enum(['magic', 'physics', 'society', 'divine']).default('magic'),
  isImmutable: z.literal(true),
});

export const GenesisReligionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  title: z.string().default(''),
  domain: z.enum(['light', 'death', 'war', 'secrets', 'nature', 'chaos', 'forge']),
  sacredSymbol: z.string().default(''),
  coreDogma: z.string().default(''),
  taboos: z.array(z.string()).default([]),
  divineBlessings: z.array(z.string()).default([]),
});

export const GenesisWorldSchema = z.object({
  worldName: z.string().min(2),
  tagline: z.string().min(5),
  summary: z.string().min(20),
  themeNotes: z.string().default(''),
  aiSystemPrompt: z.string().default(''),
  laws: z.array(GenesisLawSchema).length(4),
  factions: z.array(GenesisFactionSchema).length(3),
  locations: z.array(GenesisLocationSchema).length(4),
  religions: z.array(GenesisReligionSchema).length(2),
  coreCampaignMystery: z.string().min(20),
});

export type GenesisWorldData = z.infer<typeof GenesisWorldSchema>;

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

export const GENESIS_SYSTEM_DIRECTIVES = `You are the Master World-Building Co-Pilot for StoryForge. You will output a single, fully self-consistent starter world package as a JSON object.

STRICT REQUIREMENTS:
- Generate EXACTLY 4 immutable World Laws, 3 Factions, 4 Locations, and 2 Deities/Religions.
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

Generate the complete Genesis world package now. Remember: EXACTLY 4 laws, 3 factions, 4 locations, 2 deities; stable unique ids; cross-referenced links; valid JSON only.`;
}

export const AUDIT_SYSTEM_DIRECTIVES = `You are the Lore Consistency Auditor for StoryForge. You analyze an entire World Bible and detect continuity breaks, magic-law violations, dangling references, orphaned entities, and timeline paradoxes.

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
