import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorldContextBlocks,
  pruneWorldBibleToScope,
  formatLivingWorldLedger,
  buildChapterContextString,
} from './worldContext';
import { WorldBible } from '../../types/world';

const worldBible: WorldBible = {
  worldId: 'world_saga',
  worldName: 'Saga Test Realm',
  summary: 'A realm built for long-form testing.',
  themeNotes: 'Grim, poetic.',
  laws: [
    { id: 'law_1', rule: 'Magic requires a blood tithe.', description: 'Casting wounds the caster.', category: 'magic', isImmutable: true },
    { id: 'law_2', rule: 'Iron burns spirits.', description: 'Spirits avoid forged iron.', category: 'physics', isImmutable: true },
    { id: 'law_3', rule: 'Dragons are extinct.', description: 'None have been seen in 300 years.', category: 'creatures', isImmutable: true },
  ],
  factions: [
    {
      id: 'fac_local_guild',
      name: 'Iron Guild',
      description: '',
      alignment: 'Lawful',
      territoryIds: ['loc_guild_hall'],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Control the metal trade',
    },
    {
      id: 'fac_far_empire',
      name: 'Far Empire',
      description: '',
      alignment: 'Imperial',
      territoryIds: ['loc_distant_capital'],
      rivalFactionIds: [],
      alliedFactionIds: [],
      publicGoals: 'Conquer everything',
    },
  ],
  locations: [
    {
      id: 'loc_alley',
      name: 'Rat Alley',
      region: 'Guild Quarter',
      description: 'Narrow and damp.',
      dangerLevel: 2,
      connectedLocationIds: ['loc_guild_hall'],
      atmosphere: 'Wet stone',
    },
    {
      id: 'loc_guild_hall',
      name: 'Iron Guild Hall',
      region: 'Guild Quarter',
      description: 'Fortified trade hall.',
      dangerLevel: 3,
      connectedLocationIds: ['loc_alley', 'loc_distant_capital'],
      atmosphere: 'Smoky forges',
    },
    {
      id: 'loc_dungeon_depths',
      name: 'Flooded Depths',
      region: 'Undercity',
      description: 'Drowned catacombs.',
      dangerLevel: 5,
      connectedLocationIds: [],
      atmosphere: 'Black water',
    },
    {
      id: 'loc_distant_capital',
      name: 'Imperial Capital',
      region: 'Far Reaches',
      description: 'Seat of the empire.',
      dangerLevel: 4,
      connectedLocationIds: ['loc_guild_hall'],
      atmosphere: 'Marble and ash',
    },
  ],
  timeline: [
    { id: 'ev_old', yearOrEra: 'Ancient', title: 'The Sundering', summary: 'Old empire fell.', significance: '', knownByPublic: true, eraCategory: 'ancient' },
    { id: 'ev_now', yearOrEra: 'Present', title: 'The Guild War', summary: 'Trade war rages.', significance: '', knownByPublic: true, eraCategory: 'present' },
  ],
  npcs: [
    {
      id: 'npc_quartermaster',
      name: 'Quartermaster Bren',
      title: '',
      role: 'smuggler',
      factionId: 'fac_local_guild',
      currentLocationId: 'loc_guild_hall',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 0,
    },
    {
      id: 'npc_emperor',
      name: 'Emperor Kaldros',
      title: '',
      role: 'ruler',
      currentLocationId: 'loc_distant_capital',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: -50,
    },
    {
      id: 'npc_sewer_rat',
      name: 'Pip the Ratcatcher',
      title: '',
      role: 'guard',
      currentLocationId: 'loc_dungeon_depths',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 10,
    },
  ],
  artifacts: [
    {
      id: 'art_ledger',
      name: 'Sealed Ledger',
      title: '',
      originEra: '',
      rarity: 'rare',
      description: '',
      powers: [],
      currentHolderType: 'location',
      currentHolderId: 'loc_guild_hall',
    },
    {
      id: 'art_crown',
      name: 'Crown of Kaldros',
      title: '',
      originEra: '',
      rarity: 'legendary',
      description: '',
      powers: [],
      currentHolderType: 'npc',
      currentHolderId: 'npc_emperor',
    },
  ],
  bestiary: [
    {
      id: 'cre_ash_hound',
      name: 'Ash Hound',
      speciesCategory: 'monstrosity',
      dangerLevel: 3,
      habitatLocationIds: ['loc_alley'],
      behavioralTactics: '',
      weaknesses: ['water'],
      resistances: ['fire'],
      harvestableLoot: [],
      loreDescription: '',
    },
    {
      id: 'cre_deep_leviathan',
      name: 'Deep Leviathan',
      speciesCategory: 'draconic',
      dangerLevel: 5,
      habitatLocationIds: ['loc_dungeon_depths'],
      behavioralTactics: '',
      weaknesses: [],
      resistances: [],
      harvestableLoot: [],
      loreDescription: '',
    },
  ],
  religions: [
    {
      id: 'deity_forge',
      name: 'The Crucible Mother',
      title: '',
      domain: 'forge',
      sacredSymbol: '',
      coreDogma: '',
      taboos: [],
      divineBlessings: [],
      affiliatedFactionIds: ['fac_local_guild'],
      holyLocationIds: ['loc_guild_hall'],
    },
    {
      id: 'deity_far_sun',
      name: 'The Distant Sun',
      title: '',
      domain: 'light',
      sacredSymbol: '',
      coreDogma: '',
      taboos: [],
      divineBlessings: [],
      affiliatedFactionIds: ['fac_far_empire'],
      holyLocationIds: ['loc_distant_capital'],
    },
  ],
  dramaBonds: [
    {
      id: 'bond_1',
      sourceNpcId: 'npc_quartermaster',
      targetNpcId: 'npc_emperor',
      relationTypeId: 'rival',
      affinity: -40,
      secretTension: '',
      isPublic: true,
    },
  ],
};

describe('Plan 07 — Dynamic Context-Aware Lore Retrieval (scope pruning)', () => {
  it('street scope injects only scene-relevant lore (1-hop locations, resident NPCs)', () => {
    const blocks = buildWorldContextBlocks(
      { worldBible },
      { scopeTier: 'street', locationIds: ['loc_alley'] }
    );

    // Locations: active + 1-hop neighbors only (alley + guild hall)
    assert.ok(blocks.locations.some((l) => l.includes('Rat Alley')));
    assert.ok(blocks.locations.some((l) => l.includes('Iron Guild Hall')));
    assert.ok(!blocks.locations.some((l) => l.includes('Flooded Depths')));

    // NPCs: only those stationed at kept locations
    assert.ok(blocks.npcs.length > 0);
    assert.ok(!blocks.npcs.some((n) => n.includes('Pip the Ratcatcher')));
    assert.ok(!blocks.npcs.some((n) => n.includes('Emperor Kaldros')));

    // Bestiary filtered by habitat
    assert.ok(blocks.bestiary.some((c) => c.includes('Ash Hound')));
    assert.ok(!blocks.bestiary.some((c) => c.includes('Deep Leviathan')));

    // Artifacts: ledger held at guild hall is kept; crown held by far emperor is not
    assert.ok(!blocks.artifacts.some((a) => a.includes('Crown of Kaldros')));

    // Immutable world laws are ALWAYS preserved (ground truth)
    assert.equal(blocks.laws.length, 3);
  });

  it('continental/mythic scopes widen the aperture to empire-level politics', () => {
    const blocks = buildWorldContextBlocks(
      { worldBible },
      { scopeTier: 'mythic', locationIds: ['loc_alley'] }
    );

    assert.ok(blocks.factions.some((f) => f.includes('Far Empire')));
    assert.ok(blocks.artifacts.some((a) => a.includes('Crown of Kaldros')));
    assert.ok(blocks.religions.some((r) => r.includes('The Distant Sun')));
  });

  it('prunes to a strict minority of the total universe for street-level play', () => {
    const pruned = pruneWorldBibleToScope(worldBible, {
      scopeTier: 'street',
      locationIds: ['loc_alley'],
    });

    const totalEntities =
      worldBible.locations!.length +
      worldBible.npcs!.length +
      worldBible.factions!.length +
      worldBible.bestiary!.length;
    const prunedEntities =
      pruned.locations.length +
      pruned.npcs.length +
      pruned.factions.length +
      (pruned.bestiary?.length ?? 0);

    assert.ok(prunedEntities < totalEntities, 'street scope must prune most of the universe');
    // ~5-10% target: with this small fixture, expect well under half.
    assert.ok(prunedEntities <= Math.ceil(totalEntities / 2));
  });

  it('unscoped calls retain full-bible compression behavior', () => {
    const blocks = buildWorldContextBlocks({ worldBible });
    assert.equal(blocks.locations.length, 4);
    assert.equal(blocks.npcs.length, 3);
    assert.equal(blocks.factions.length, 2);
  });
});

describe('Plan 07 — Living World Ledger & Chapter Context Envelope', () => {
  it('formats faction reputations, NPC statuses, key items, and plot threads', () => {
    const lines = formatLivingWorldLedger({
      factionReputations: [
        { factionId: 'fac_syn', factionName: 'Syndicate', score: 25, stance: 'allied' },
        { factionId: 'fac_order', factionName: 'Holy Order', score: -60, stance: 'hostile' },
      ],
      npcStatuses: [
        { npcId: 'npc_vael', npcName: 'Vael', status: 'dead' as const, note: 'Poisoned' },
        { npcId: 'npc_donald', npcName: 'Donald', status: 'imprisoned' as const },
      ],
      keyItems: [
        { itemId: 'item_heirloom', name: 'Heirloom Seal', isStoryCritical: true, acquiredChapterNumber: 1 },
      ],
      chapterSummaries: [],
      openPlotThreads: ['Who forged the seal?'],
    });

    assert.deepEqual(lines[0], 'Faction Syndicate: +25 (allied)');
    assert.deepEqual(lines[1], 'Faction Holy Order: -60 (hostile)');
    assert.deepEqual(lines[2], 'NPC Vael: dead — Poisoned');
    assert.ok(lines[3].includes('Donald'));
    assert.ok(lines[4].includes('[STORY-CRITICAL]'));
    assert.ok(lines[5].startsWith('Open plot threads:'));
  });

  it('buildChapterContextString appends episodic rollup and ledger sections', () => {
    const context = buildChapterContextString(
      { worldBible },
      { scopeTier: 'regional', scenes: [{ sceneId: 's1', locationId: 'loc_alley', narrativeText: '', choices: [] }] },
      {
        factionReputations: [],
        npcStatuses: [{ npcId: 'npc_vael', npcName: 'Vael', status: 'dead' }],
        keyItems: [],
        chapterSummaries: [
          {
            chapterNumber: 1,
            title: 'The Inciting Breach',
            summary: 'Vael was poisoned; the guild debt was bought.',
            irreversibleChoices: ['vael_poisoned'],
          },
        ],
        openPlotThreads: [],
      }
    );

    assert.ok(context.includes('Episodic Milestone Rollup:'));
    assert.ok(context.includes('Ch1 «The Inciting Breach»'));
    assert.ok(context.includes('Irreversible: vael_poisoned'));
    assert.ok(context.includes('Living World Ledger:'));
    assert.ok(context.includes('NPC Vael: dead'));
  });

  it('omits memory sections when no ledger exists', () => {
    const context = buildChapterContextString(
      { worldBible },
      { scopeTier: 'street', scenes: [] }
    );
    assert.ok(!context.includes('Episodic Milestone Rollup:'));
    assert.ok(!context.includes('Living World Ledger:'));
  });
});
