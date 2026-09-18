import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateProse } from '@/lib/engines/narrative/ProseValidator';

function ledgerWith(npcStatuses: Array<{ npcId: string; npcName: string; status: string }>) {
  return {
    factionReputations: [],
    npcStatuses,
    keyItems: [],
    chapterSummaries: [],
    openPlotThreads: [],
  } as never;
}

const DEAD = [
  { npcId: 'npc_rostam', npcName: 'Rostam', status: 'dead' },
  { npcId: 'npc_kael', npcName: 'Kael', status: 'dead' },
  { npcId: 'npc_marta', npcName: 'Marta', status: 'transformed' },
  { npcId: 'npc_ilya', npcName: 'Ilya', status: 'missing' },
  { npcId: 'npc_brann', npcName: 'Brann', status: 'dead' },
];

describe('Tier 1 — ProseValidator: resurrection catch rate', () => {
  it('flags 100% of ledger-dead NPCs that act alive', () => {
    for (const npc of DEAD) {
      const prose = `${npc.npcName} strides into the hall, sword raised, ready to fight beside you.`;
      const r = validateProse(prose, { ledger: ledgerWith([npc]), resolution: { outcome: 'success' } as never });
      assert.equal(r.ok, false, `failed to flag resurrection of ${npc.npcName}`);
      assert.ok(r.findings.some((f) => f.category === 'resurrection' && f.severity === 'error'));
    }
  });

  it('permits memorial mentions of the dead', () => {
    for (const npc of DEAD) {
      const prose = `You pause at the grave of ${npc.npcName}, slain at the breach, and say a prayer.`;
      const r = validateProse(prose, { ledger: ledgerWith([npc]), resolution: { outcome: 'success' } as never });
      assert.equal(r.ok, true, `memorial mention of ${npc.npcName} was wrongly rejected`);
    }
  });
});

describe('Tier 1 — ProseValidator: outcome adherence', () => {
  it('flags triumphant prose on a failed roll (EN)', () => {
    const r = validateProse('You triumph effortlessly, flawless victory over all foes.', {
      resolution: { outcome: 'critical_failure' } as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'outcome_mismatch'));
  });

  it('flags disastrous prose on a successful roll (FA)', () => {
    const r = validateProse('شکست سنگین و فاجعه‌بار بود؛ همه‌چیز از دست رفت.', {
      resolution: { outcome: 'success' } as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'outcome_mismatch'));
  });

  it('accepts a complication narrated on failure', () => {
    const r = validateProse('You fumble the lockpick; the guard turns, alerted by the scrape.', {
      resolution: { outcome: 'failure' } as never,
    });
    assert.equal(r.ok, true);
  });
});

describe('Tier 1 — ProseValidator: immutable-law lore violations', () => {
  const worldBible = {
    laws: [
      {
        id: 'law_1',
        rule: 'Ashen Dragons are extinct',
        description: 'No Ashen Dragon has been seen for an age.',
        category: 'creatures',
        isImmutable: true,
      },
    ],
    bestiary: [{ name: 'Ashen Dragon' }],
  } as never;

  it('flags an extinct creature appearing against immutable law', () => {
    const r = validateProse('An Ashen Dragon descends upon the valley, wings blotting the sun.', {
      resolution: { outcome: 'success' } as never,
      worldBible,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'lore_violation'));
  });

  it('accepts prose that does not invoke the extinct creature', () => {
    const r = validateProse('Rain drums on the shutters as you count your coins and wait.', {
      resolution: { outcome: 'success' } as never,
      worldBible,
    });
    assert.equal(r.ok, true);
  });
});
