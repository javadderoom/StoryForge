import { WorldBible } from '@/lib/types/world';

export interface WorldContextBlocks {
  worldSummary?: string;
  themeNotes?: string;
  authoredSystemPrompt?: string;
  factions: string[];
  timeline: string[];
  artifacts: string[];
  bestiary: string[];
  religions: string[];
  dramaBonds: string[];
  locations: string[];
  npcs: string[];
  laws: string[];
  ontologySummary?: string;
}

const cap = (arr: string[], max: number): string[] => (arr.length > max ? arr.slice(0, max) : arr);

/**
 * Compresses the full World Bible into dense, token-bounded one-liner blocks
 * suitable for injecting into the play-time narrator context envelope.
 */
export function buildWorldContextBlocks(story: { worldBible?: WorldBible | null }): WorldContextBlocks {
  const wb = story.worldBible;
  if (!wb) {
    return {
      factions: [],
      timeline: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
      locations: [],
      npcs: [],
      laws: [],
    };
  }

  const npcName = new Map<string, string>();
  for (const n of wb.npcs ?? []) npcName.set(n.id, n.name);

  const factions = cap(
    (wb.factions ?? []).map(
      (f) =>
        `${f.name} — ${f.alignment}. Goals: ${f.publicGoals}${
          f.secretAgendas ? ` | Hidden agenda: ${f.secretAgendas}` : ''
        }`
    ),
    10
  );

  const timeline = cap(
    (wb.timeline ?? [])
      .slice()
      .sort((a, b) => {
        const ar = a.eraCategory === 'recent' || a.eraCategory === 'present' ? 0 : 1;
        const br = b.eraCategory === 'recent' || b.eraCategory === 'present' ? 0 : 1;
        return ar - br;
      })
      .map((t) => `${t.yearOrEra}: ${t.title} — ${t.summary}${t.significance ? ` (${t.significance})` : ''}`),
    12
  );

  const artifacts = cap(
    (wb.artifacts ?? []).map(
      (a) =>
        `${a.name} (${a.rarity}) — powers: ${a.powers.join(', ') || 'unknown'}; held by ${a.currentHolderType} ${a.currentHolderId}`
    ),
    12
  );

  const bestiary = cap(
    (wb.bestiary ?? []).map(
      (c) =>
        `${c.name} (danger ${c.dangerLevel}, ${c.speciesCategory}) — habitat: ${
          c.habitatLocationIds.join('/') || 'unknown'
        } | weakness: ${c.weaknesses.join(', ') || 'unknown'}`
    ),
    12
  );

  const religions = cap(
    (wb.religions ?? []).map(
      (d) =>
        `${d.name}, ${d.title} — domain: ${d.domain}. Dogma: ${d.coreDogma}${
          d.taboos?.length ? ` | Taboos: ${d.taboos.join(', ')}` : ''
        }`
    ),
    12
  );

  const dramaBonds = cap(
    (wb.dramaBonds ?? [])
      .filter((b) => b.isPublic)
      .map((b) => {
        const src = npcName.get(b.sourceNpcId) ?? b.sourceNpcId;
        const tgt = npcName.get(b.targetNpcId) ?? b.targetNpcId;
        return `${src} ↔ ${tgt} (affinity ${b.affinity})`;
      }),
    8
  );

  const locations = cap(
    (wb.locations ?? []).map(
      (l) =>
        `${l.name} (${l.region || 'unknown region'}, danger ${l.dangerLevel}${
          l.category ? `, ${l.category}` : ''
        }) — ${l.description}`
    ),
    12
  );

  const npcs = cap(
    (wb.npcs ?? []).map(
      (n) =>
        `${n.name} (${n.role || 'unknown role'}) — ${n.title || ''}; goals: ${
          n.goals.join(', ') || 'unknown'
        }`
    ),
    12
  );

  const laws = cap(
    (wb.laws ?? []).map((law) => `${law.rule} (${law.category}) — ${law.description}`),
    10
  );

  const ontologyLines: string[] = [];
  if (wb.ontology?.relationTypes?.length) {
    ontologyLines.push(`Relation types: ${wb.ontology.relationTypes.map((r) => r.name).join(', ')}.`);
  }
  if (wb.ontology?.domains?.length) {
    ontologyLines.push(`Domains of gods: ${wb.ontology.domains.map((d) => d.name).join(', ')}.`);
  }
  const ontologySummary = ontologyLines.length ? ontologyLines.join(' ') : undefined;

  return {
    worldSummary: wb.summary || undefined,
    themeNotes: wb.themeNotes || undefined,
    authoredSystemPrompt: wb.aiSystemPrompt || undefined,
    factions,
    timeline,
    artifacts,
    bestiary,
    religions,
    dramaBonds,
    locations,
    npcs,
    laws,
    ontologySummary,
  };
}

/**
 * Renders the compressed world-context blocks into a compact, labeled string
 * suitable for injecting into AI generation prompts. Skips empty sections.
 */
export function formatWorldContext(blocks: WorldContextBlocks): string {
  const sections: string[] = [];
  if (blocks.worldSummary) sections.push(`World Summary: ${blocks.worldSummary}`);
  if (blocks.themeNotes) sections.push(`Theme Notes: ${blocks.themeNotes}`);
  if (blocks.authoredSystemPrompt) sections.push(`Author's Directive: ${blocks.authoredSystemPrompt}`);
  if (blocks.factions.length) sections.push(`Factions:\n- ${blocks.factions.join('\n- ')}`);
  if (blocks.timeline.length) sections.push(`Timeline:\n- ${blocks.timeline.join('\n- ')}`);
  if (blocks.artifacts.length) sections.push(`Artifacts:\n- ${blocks.artifacts.join('\n- ')}`);
  if (blocks.bestiary.length) sections.push(`Bestiary:\n- ${blocks.bestiary.join('\n- ')}`);
  if (blocks.religions.length) sections.push(`Religions/Deities:\n- ${blocks.religions.join('\n- ')}`);
  if (blocks.dramaBonds.length) sections.push(`Drama Bonds:\n- ${blocks.dramaBonds.join('\n- ')}`);
  if (blocks.locations.length) sections.push(`Places/Locations:\n- ${blocks.locations.join('\n- ')}`);
  if (blocks.npcs.length) sections.push(`NPCs:\n- ${blocks.npcs.join('\n- ')}`);
  if (blocks.laws.length) sections.push(`World Laws:\n- ${blocks.laws.join('\n- ')}`);
  if (blocks.ontologySummary) sections.push(blocks.ontologySummary);
  return sections.join('\n\n');
}

/** Convenience: build the context blocks and format them in one call. */
export function buildWorldContextString(story: { worldBible?: WorldBible | null }): string {
  return formatWorldContext(buildWorldContextBlocks(story));
}
