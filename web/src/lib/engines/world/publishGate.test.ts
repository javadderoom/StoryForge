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

  it('allows publishing a world with arbitrary entity counts (2 laws, 10 factions, 0 locations, 8 religions)', () => {
    const m = getEmptyStoryManifest('en');
    m.worldBible.worldName = 'Chronicles of Elyria';
    m.worldBible.summary = 'A rich sprawling world with intricate political factions and diverse deities.';
    m.worldBible.laws = [
      { id: 'law_iron', rule: 'Iron binds blood', description: 'Any oath sworn upon cold iron cannot be broken without instant death.', category: 'magic', isImmutable: true },
      { id: 'law_veil', rule: 'The Veil thins at dusk', description: 'Between dusk and midnight, spirits wander freely into mortal realms.', category: 'magic', isImmutable: true },
    ];
    m.worldBible.factions = Array.from({ length: 10 }, (_, i) => ({
      id: `fac_guild_${i + 1}`,
      name: `Guild of ${i + 1}`,
      description: `A powerful merchant house number ${i + 1} operating across borders.`,
      alignment: 'neutral' as const,
      publicGoals: 'Trade dominance',
      secretAgendas: 'Monopoly',
      territoryIds: [],
      rivalFactionIds: [],
      alliedFactionIds: [],
    }));
    m.worldBible.locations = [];
    m.worldBible.religions = Array.from({ length: 8 }, (_, i) => ({
      id: `deity_pantheon_${i + 1}`,
      name: `Deity of ${i + 1}`,
      title: `The Patron ${i + 1}`,
      domain: 'light' as const,
      sacredSymbol: 'Sun disc',
      coreDogma: 'Honor the dawn and protect the weak.',
      taboos: [],
      divineBlessings: [],
      affiliatedFactionIds: [],
      holyLocationIds: [],
    }));

    // Link factions in spectrum so they aren't marked as orphaned suggestions
    m.worldBible.factionRelations = [
      { id: 'rel_1_2', sourceFactionId: 'fac_guild_1', targetFactionId: 'fac_guild_2', value: 'allied', note: '' },
      { id: 'rel_3_4', sourceFactionId: 'fac_guild_3', targetFactionId: 'fac_guild_4', value: 'favorable', note: '' },
      { id: 'rel_5_6', sourceFactionId: 'fac_guild_5', targetFactionId: 'fac_guild_6', value: 'rival', note: '' },
      { id: 'rel_7_8', sourceFactionId: 'fac_guild_7', targetFactionId: 'fac_guild_8', value: 'hostile', note: '' },
      { id: 'rel_9_10', sourceFactionId: 'fac_guild_9', targetFactionId: 'fac_guild_10', value: 'neutral', note: '' },
    ];

    const gate = canPublish(m.worldBible, null, []);
    assert.equal(gate.ok, true);
    assert.equal(gate.errors.length, 0);
    assert.ok(gate.score >= 85);
  });
});
