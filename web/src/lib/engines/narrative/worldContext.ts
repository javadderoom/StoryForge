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

  const ontologySummary =
    wb.ontology && wb.ontology.relationTypes.length > 0
      ? `Relation types in this world: ${wb.ontology.relationTypes.map((r) => r.name).join(', ')}.`
      : undefined;

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
    ontologySummary,
  };
}
