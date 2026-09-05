import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProse } from './ProseValidator';

describe('ProseValidator — canon guardrails', () => {
  it('flags resurrected NPCs as errors', () => {
    const r = validateProse('Kael strides into the hall, sword raised, ready to fight.', {
      ledger: {
        factionReputations: [],
        npcStatuses: [{ npcId: 'npc_kael', npcName: 'Kael', status: 'dead' }],
        keyItems: [],
        chapterSummaries: [],
        openPlotThreads: [],
      },
      resolution: { outcome: 'success' } as never,
      worldBible: null,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'resurrection'));
  });

  it('passes memorial mentions of the dead', () => {
    const r = validateProse('You pause at the grave of Kael, slain at the breach, and say a prayer.', {
      ledger: {
        factionReputations: [],
        npcStatuses: [{ npcId: 'npc_kael', npcName: 'Kael', status: 'dead' }],
        keyItems: [],
        chapterSummaries: [],
        openPlotThreads: [],
      },
      resolution: { outcome: 'success' } as never,
      worldBible: null,
    });
    assert.equal(r.ok, true);
  });

  it('flags outcome mismatch (failure narrated as triumph)', () => {
    const r = validateProse('You triumph effortlessly, flawless victory over all foes.', {
      resolution: { outcome: 'critical_failure' } as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'outcome_mismatch'));
  });

  it('passes clean prose', () => {
    const r = validateProse('Rain drums on the shutters as you count your coins and wait.', {
      resolution: { outcome: 'success' } as never,
    });
    assert.equal(r.ok, true);
  });
});
