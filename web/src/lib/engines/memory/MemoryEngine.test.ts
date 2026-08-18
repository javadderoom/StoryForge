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
