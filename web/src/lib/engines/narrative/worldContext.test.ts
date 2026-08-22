import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldContextBlocks } from './worldContext';
import { WorldBible } from '../../types/world';

const worldBible: WorldBible = {
  worldId: 'world_test',
  worldName: 'Test World',
  summary: 'A summary of the realm.',
  themeNotes: 'Bleak and poetic.',
  aiSystemPrompt: 'Always write in a doomed, elegiac tone.',
  laws: [],
  factions: [
    {
      id: 'fac_1',
      name: 'The Ashen Order',
      description: '',
      alignment: 'Lawful Authoritarian',
      territoryIds: [],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Suppress heresy',
      secretAgendas: 'Hoard relic',
    },
  ],
  locations: [],
  timeline: [
    {
      id: 'ev_1',
      yearOrEra: 'Age of Ash',
      title: 'The Sundering',
      summary: 'The old empire fell.',
      significance: 'Catalyst',
      knownByPublic: true,
      eraCategory: 'ancient',
    },
    {
      id: 'ev_2',
      yearOrEra: 'Present',
      title: 'The Siege',
      summary: 'The capital is besieged.',
      significance: 'Ongoing',
      knownByPublic: true,
      eraCategory: 'present',
    },
  ],
  npcs: [
    {
      id: 'npc_a',
      name: 'Aria',
      title: 'Spy',
      currentLocationId: 'loc_1',
      personalityTraits: [],
      speechStyle: 'Whispers',
      goals: [],
      secrets: [],
      initialTrust: 0,
    },
    {
      id: 'npc_b',
      name: 'Borin',
      title: 'Smith',
      currentLocationId: 'loc_2',
      personalityTraits: [],
      speechStyle: 'Gruff',
      goals: [],
      secrets: [],
      initialTrust: 0,
    },
  ],
  dramaBonds: [
    {
      id: 'bond_1',
      sourceNpcId: 'npc_a',
      targetNpcId: 'npc_b',
      relationTypeId: 'rival',
      affinity: -40,
      secretTension: '',
      isPublic: true,
    },
  ],
  artifacts: [
    {
      id: 'art_1',
      name: 'Ember Blade',
      title: 'Blade of Ash',
      originEra: 'Age of Ash',
      rarity: 'legendary',
      description: '',
      powers: ['burning edge'],
      currentHolderType: 'npc',
      currentHolderId: 'npc_b',
    },
  ],
  bestiary: [
    {
      id: 'cr_1',
      name: 'Gloom Hound',
      speciesCategory: 'beast',
      dangerLevel: 3,
      habitatLocationIds: ['loc_1'],
      behavioralTactics: '',
      weaknesses: ['light'],
      resistances: [],
      harvestableLoot: [],
      loreDescription: '',
    },
  ],
  religions: [
    {
      id: 'god_1',
      name: 'Mourn',
      title: 'The Weeping Veil',
      domain: 'death',
      sacredSymbol: '',
      coreDogma: 'Grief is holy.',
      taboos: ['laughter'],
      divineBlessings: [],
      affiliatedFactionIds: [],
      holyLocationIds: [],
    },
  ],
  ontology: {
    relationTypes: [{ id: 'rt_1', name: 'blood debt', description: '', sourceCategory: 'npc', targetCategory: 'npc', color: '#fff', isDirected: true }],
    placeCategories: [],
    lawCategories: [],
    npcRoles: [],
  },
};

describe('buildWorldContextBlocks', () => {
  it('compresses the world bible into bounded one-liner blocks', () => {
    const blocks = buildWorldContextBlocks({ worldBible });
    assert.equal(blocks.factions.length, 1);
    assert.ok(blocks.factions[0].includes('The Ashen Order'));
    assert.ok(blocks.factions[0].includes('Hoard relic'));
    assert.equal(blocks.artifacts.length, 1);
    assert.ok(blocks.artifacts[0].includes('Ember Blade'));
    assert.equal(blocks.bestiary.length, 1);
    assert.ok(blocks.bestiary[0].includes('Gloom Hound'));
    assert.equal(blocks.religions.length, 1);
    assert.ok(blocks.religions[0].includes('Mourn'));
    assert.equal(blocks.dramaBonds.length, 1);
    assert.ok(blocks.dramaBonds[0].includes('Aria'));
    assert.ok(blocks.dramaBonds[0].includes('Borin'));
    assert.ok(blocks.ontologySummary?.includes('blood debt'));
    assert.equal(blocks.worldSummary, 'A summary of the realm.');
    assert.equal(blocks.themeNotes, 'Bleak and poetic.');
    assert.equal(blocks.authoredSystemPrompt, 'Always write in a doomed, elegiac tone.');
  });

  it('prioritizes recent/present timeline events first', () => {
    const blocks = buildWorldContextBlocks({ worldBible });
    assert.equal(blocks.timeline[0], 'Present: The Siege — The capital is besieged. (Ongoing)');
  });

  it('returns empty blocks when there is no world bible', () => {
    const blocks = buildWorldContextBlocks({});
    assert.deepEqual(blocks.factions, []);
    assert.equal(blocks.authoredSystemPrompt, undefined);
  });
});
