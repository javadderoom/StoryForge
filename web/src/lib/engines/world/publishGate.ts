import { LoreAuditor } from './LoreAuditor';
import { hasPlaceholders, GenesisWorldData } from './GenesisSchemas';
import type { WorldBible, SagaManifest } from '@/lib/types/world';

export const PUBLISH_MIN_SCORE = 85;

export interface PublishGateResult {
  ok: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  findings: ReturnType<typeof LoreAuditor.audit>['findings'];
}

/**
 * Single blocking publish gate: deterministic audit + saga stats + placeholder
 * scan. Pure and framework-free so it runs in API routes and node:test.
 */
export function canPublish(
  worldBible: WorldBible,
  saga?: SagaManifest | null,
  rpgStatIds: string[] = []
): PublishGateResult {
  const audit = LoreAuditor.audit(worldBible);
  const findings = [...audit.findings];

  if (saga) {
    const sagaAudit = LoreAuditor.auditSaga(saga);
    findings.push(...sagaAudit.findings);
    findings.push(...LoreAuditor.auditSagaStats(saga, rpgStatIds));
  }

  // Genesis-shaped bibles (fresh worlds) also get placeholder scan.
  const placeholders = hasPlaceholders({
    worldName: worldBible.worldName,
    tagline: '',
    summary: worldBible.summary,
    themeNotes: worldBible.themeNotes,
    aiSystemPrompt: worldBible.aiSystemPrompt || '',
    laws: (worldBible.laws || []) as unknown as GenesisWorldData['laws'],
    factions: (worldBible.factions || []) as unknown as GenesisWorldData['factions'],
    locations: (worldBible.locations || []) as unknown as GenesisWorldData['locations'],
    religions: (worldBible.religions || []) as unknown as GenesisWorldData['religions'],
    factionRelations: (worldBible.factionRelations || []) as unknown as GenesisWorldData['factionRelations'],
    coreCampaignMystery: '',
  });

  let score = audit.score;
  if (saga) {
    const errCount = findings.filter((f) => f.severity === 'error').length;
    score = Math.max(0, Math.min(score, 100 - errCount * 10));
  }

  const errors = [
    ...findings.filter((f) => f.severity === 'error').map((f) => `${f.title}: ${f.description}`),
    ...placeholders.map((p) => `Placeholder: ${p}`),
  ];
  const warnings = findings.filter((f) => f.severity !== 'error').map((f) => `${f.title}: ${f.description}`);

  const ok = score >= PUBLISH_MIN_SCORE && errors.length === 0;
  return { ok, score, errors, warnings, findings };
}
