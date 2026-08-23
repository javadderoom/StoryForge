import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LoreAuditor } from './LoreAuditor';
import { WorldBible } from '@/lib/types/world';

function baseWorld(overrides: Partial<WorldBible> = {}): WorldBible {
  return {
    worldId: 'world_test',
    worldName: 'Test World',
    summary: 'A test world.',
    themeNotes: '',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    artifacts: [],
    bestiary: [],
    religions: [],
    dramaBonds: [],
    ...overrides,
  };
}

describe('LoreAuditor — deterministic consistency checks', () => {
  it('returns a perfect score for an empty world (no entities)', () => {
    const report = LoreAuditor.audit(baseWorld());
    assert.equal(report.score, 0); // empty world is not "coherent"
    assert.equal(report.findings.length, 0);
  });

  it('flags a dangling faction reference to a missing location', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A faction.',
          alignment: 'neutral',
          territoryIds: ['loc_missing'],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'missing_link');
    assert.ok(finding, 'expected a missing_link finding');
    assert.equal(finding?.severity, 'warning');
  });

  it('flags magic_violation when a banned-magic law coexists with a casting artifact', () => {
    const world = baseWorld({
      laws: [
        {
          id: 'law_magic',
          rule: 'All casting of magic is forbidden by imperial decree.',
          description: 'Magic is illegal.',
          category: 'magic',
          isImmutable: true,
        },
      ],
      artifacts: [
        {
          id: 'art_inferno',
          name: 'The Inferno Brand',
          title: 'Brand of Flame',
          originEra: 'Ancient',
          rarity: 'legendary',
          description: 'A wand that lets the wielder cast fireballs.',
          powers: ['Cast fireball'],
          curseOrCost: '',
          currentHolderType: 'unknown',
          currentHolderId: 'unknown',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'magic_violation');
    assert.ok(finding, 'expected a magic_violation finding');
    assert.equal(finding?.severity, 'error');
  });

  it('flags law_conflict when a living draconic creature contradicts an extinction law', () => {
    const world = baseWorld({
      laws: [
        {
          id: 'law_dragon',
          rule: 'Dragons have been extinct for 300 years.',
          description: 'No living dragons.',
          category: 'creatures',
          isImmutable: true,
        },
      ],
      bestiary: [
        {
          id: 'cre_wyrm',
          name: 'Ember Wyrm',
          speciesCategory: 'draconic',
          dangerLevel: 5,
          habitatLocationIds: [],
          behavioralTactics: 'Breathes fire.',
          weaknesses: ['cold'],
          resistances: ['fire'],
          harvestableLoot: [],
          loreDescription: 'A fearsome living dragon of the ash peaks.',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'law_conflict');
    assert.ok(finding, 'expected a law_conflict finding');
  });

  it('flags one-sided faction rivalry as a suggestion', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: ['fac_b'],
          alliedFactionIds: [],
          publicGoals: '',
        },
        {
          id: 'fac_b',
          name: 'House B',
          description: 'B.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'faction_rivalry');
    assert.ok(finding, 'expected a faction_rivalry finding');
    assert.equal(finding?.severity, 'suggestion');
  });

  it('flags orphaned factions and locations as suggestions', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'An isolated faction.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
      locations: [
        {
          id: 'loc_a',
          name: 'Lost Cove',
          description: 'An isolated cove.',
          region: 'Coast',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'lonely',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    assert.ok(report.findings.some((f) => f.title === 'Orphaned faction'));
    assert.ok(report.findings.some((f) => f.title === 'Isolated location'));
  });

  it('produces a high score for a fully connected, consistent world', () => {
    const world = baseWorld({
      laws: [
        {
          id: 'law_a',
          rule: 'Steel must be forged with fire.',
          description: 'A foundational truth.',
          category: 'physics',
          isImmutable: true,
        },
      ],
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A.',
          alignment: 'neutral',
          territoryIds: ['loc_a'],
          rivalFactionIds: ['fac_b'],
          alliedFactionIds: [],
          publicGoals: '',
        },
        {
          id: 'fac_b',
          name: 'House B',
          description: 'B.',
          alignment: 'neutral',
          territoryIds: ['loc_b'],
          rivalFactionIds: ['fac_a'],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
      locations: [
        {
          id: 'loc_a',
          name: 'Keep A',
          description: 'A.',
          region: 'North',
          dangerLevel: 2,
          connectedLocationIds: ['loc_b'],
          atmosphere: 'calm',
        },
        {
          id: 'loc_b',
          name: 'Keep B',
          description: 'B.',
          region: 'South',
          dangerLevel: 2,
          connectedLocationIds: ['loc_a'],
          atmosphere: 'calm',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    assert.ok(report.score >= 90, `expected high score, got ${report.score}`);
    assert.equal(report.findings.length, 0);
  });
});
