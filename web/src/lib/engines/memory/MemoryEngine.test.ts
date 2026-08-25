import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryEngine } from './MemoryEngine';

describe('MemoryEngine - Hierarchical 0-10 Importance & Retrieval', () => {
  it('discards ephemeral memories with importance < 3', () => {
    const engine = new MemoryEngine();
    engine.recordMemory(
      { category: 'recent', importance: 2, summary: 'A rat scurried past the iron grate' },
      'scene_1',
      1
    );

    assert.equal(engine.getAllMemories().length, 0);
  });

  it('persists significant memories with importance >= 3', () => {
    const engine = new MemoryEngine();
    engine.recordMemory(
      { category: 'character', importance: 7, summary: 'Discovered Captain Rolan secretly doubts the Chancellor', entityIds: ['npc_captain_rolan'] },
      'scene_1',
      1
    );

    assert.equal(engine.getAllMemories().length, 1);
    assert.equal(engine.getAllMemories()[0].importance, 7);
  });

  it('boosts memories related to active NPCs in scene retrieval', () => {
    const engine = new MemoryEngine();
    engine.recordMemory(
      { category: 'world', importance: 5, summary: 'The citadel walls were built in 450' },
      'scene_1',
      1
    );
    engine.recordMemory(
      { category: 'character', importance: 6, summary: 'Lady Maeve owes 50 gold to the guard', entityIds: ['npc_lady_maeve'] },
      'scene_1',
      1
    );
    engine.recordMemory(
      { category: 'character', importance: 7, summary: 'Captain Rolan hates blood magic', entityIds: ['npc_captain_rolan'] },
      'scene_1',
      1
    );

    // Querying with active NPC 'npc_captain_rolan'
    const relevant = engine.getRelevantMemories('loc_hallway', ['npc_captain_rolan'], 2);

    assert.equal(relevant.length, 2);
    // Rolan's memory should rank highest due to NPC boost + higher base importance
    assert.equal(relevant[0].entityIds?.[0], 'npc_captain_rolan');
  });
});

describe('Plan 07 - Hierarchical 3-Tier Saga Memory', () => {
  const seedTurns = (engine: MemoryEngine) => {
    for (let turn = 1; turn <= 6; turn++) {
      engine.recordMemory(
        { category: 'recent', importance: 5, summary: `Turn ${turn} verbatim room state` },
        `scene_${turn}`,
        turn
      );
    }
  };

  it('Tier 1 working memory returns only the most recent N turns in reverse order', () => {
    const engine = new MemoryEngine();
    seedTurns(engine);

    const working = engine.getWorkingMemory(3);
    assert.equal(working.length, 3);
    assert.equal(working[0].summary, 'Turn 6 verbatim room state');
    assert.equal(working[2].summary, 'Turn 4 verbatim room state');
  });

  it('Tier 2 episodic rollup renders chronological chapter milestones with irreversible flags', () => {
    const engine = new MemoryEngine();

    // Out-of-order input on purpose; rollup must re-sort chronologically.
    const rollup = engine.buildEpisodicRollup([
      {
        chapterNumber: 2,
        title: 'The Web of Factions',
        summary: 'Bought the Smuggler Guild debt and burned the ledger copy.',
        irreversibleChoices: ['ledger_burned'],
      },
      {
        chapterNumber: 1,
        title: 'The Inciting Breach',
        summary: 'Poisoned Commander Vael and lost the heirloom.',
        irreversibleChoices: ['vael_poisoned'],
      },
    ]);

    assert.equal(rollup.length, 2);
    assert.ok(rollup[0].startsWith('Chapter 1'));
    assert.ok(rollup[0].includes('vael_poisoned'));
    assert.ok(rollup[1].startsWith('Chapter 2'));
    assert.ok(rollup[1].includes('Irreversible: ledger_burned'));
  });

  it('buildThreeTierEnvelope assembles all three tiers from a saga ledger', () => {
    const engine = new MemoryEngine();
    seedTurns(engine);

    const envelope = engine.buildThreeTierEnvelope({
      factionReputations: [
        { factionId: 'fac_syn', factionName: 'Syndicate', score: 25, stance: 'allied' },
      ],
      npcStatuses: [{ npcId: 'npc_vael', npcName: 'Vael', status: 'dead' }],
      keyItems: [],
      chapterSummaries: [
        { chapterNumber: 1, title: 'The Inciting Breach', summary: 'Vael was poisoned at the gate.', irreversibleChoices: [] },
      ],
      openPlotThreads: ['The sealed ledger is missing'],
    });

    assert.equal(envelope.workingMemory.length, 3);
    assert.equal(envelope.episodicRollup.length, 1);
    assert.equal(envelope.livingWorldLedger.length, 3);
    assert.ok(envelope.livingWorldLedger.some((l) => l.includes('Syndicate') && l.includes('+25')));
    assert.ok(envelope.livingWorldLedger.some((l) => l.includes('Vael: dead')));
  });

  it('buildThreeTierEnvelope tolerates an empty/missing ledger', () => {
    const engine = new MemoryEngine();
    const envelope = engine.buildThreeTierEnvelope(null);

    assert.equal(envelope.workingMemory.length, 0);
    assert.deepEqual(envelope.episodicRollup, []);
    assert.deepEqual(envelope.livingWorldLedger, []);
  });
});
