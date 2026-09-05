import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canPublish } from './publishGate';
import { hasPlaceholders } from './GenesisSchemas';
import { LoreAuditor } from './LoreAuditor';
import { getEmptyStoryManifest } from '@/lib/storyFactory';

describe('Publish gate + placeholder + saga-stat checks', () => {
  it('detects placeholder genesis entities', () => {
    const issues = hasPlaceholders({
      worldName: 'New World',
      tagline: '',
      summary: 's',
      themeNotes: 't',
      aiSystemPrompt: '',
      laws: [{ id: 'law_001', rule: 'World Law', description: '', category: 'magic', isImmutable: true }],
      factions: [{ id: 'fac_001', name: 'Faction', description: '', alignment: 'neutral', publicGoals: '', secretAgendas: '', rivalFactionIds: [], alliedFactionIds: [], territoryIds: [] }],
      locations: [{ id: 'loc_001', name: 'Location', region: '', description: '', atmosphere: '', dangerLevel: 3, specialRules: [], connectedLocationIds: [] }],
      religions: [{ id: 'deity_001', name: 'Deity', title: '', domain: 'light', sacredSymbol: '', coreDogma: '', taboos: [], divineBlessings: [] }],
      factionRelations: [],
      coreCampaignMystery: '',
    });
    assert.ok(issues.length > 0);
  });

  it('flags duplicate ids as errors', () => {
    const m = getEmptyStoryManifest('en');
    (m.worldBible.locations as unknown[]).push({ id: 'dup_1', name: 'A', region: '', description: 'x'.repeat(20), atmosphere: '', dangerLevel: 1, specialRules: [], connectedLocationIds: [] });
    (m.worldBible.factions as unknown[]).push({ id: 'dup_1', name: 'B', description: 'y'.repeat(20), alignment: 'neutral', publicGoals: '', secretAgendas: '', rivalFactionIds: [], alliedFactionIds: [], territoryIds: [] });
    const audit = LoreAuditor.audit(m.worldBible);
    assert.ok(audit.findings.some((f) => f.title === 'Duplicate entity id' && f.severity === 'error'));
  });

  it('flags saga choices with unknown stats', () => {
    const findings = LoreAuditor.auditSagaStats(
      { chapters: [{ id: 'ch_1', chapterNumber: 1, title: 'T', scopeTier: 'street', narrativeGoal: '', prerequisiteFlags: [], completionSummaryPrompt: '', scenes: [{ sceneId: 's1', locationId: '', narrativeText: '', choices: [{ id: 'c1', text: 'Go', style: 'inquisitive', riskLevel: 'medium', requiredStatId: 'hacking' }] }] }] } as never,
      ['might', 'cunning']
    );
    assert.ok(findings.some((f) => f.severity === 'error'));
  });

  it('blocks publishing a placeholder world', () => {
    const m = getEmptyStoryManifest('en');
    const gate = canPublish(m.worldBible, null, []);
    assert.equal(gate.ok, false);
  });
});
