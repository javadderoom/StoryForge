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

  it('flags mixed_success narrated as cost-free triumph', () => {
    const r = validateProse('You triumph effortlessly, flawless victory over all foes.', {
      resolution: { outcome: 'mixed_success' } as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'outcome_mismatch'));
  });

  it('flags Persian mixed_success with no visible cost', () => {
    const r = validateProse('پیروزی کامل به دست آوردی و بدون هیچ آسیبی دشمن را شکست داد.', {
      resolution: { outcome: 'mixed_success' } as never,
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.category === 'outcome_mismatch'));
  });

  it('passes mixed_success that shows both goal and cost', () => {
    const r = validateProse(
      'You seize the gate, but the blade opens a bleeding wound along your arm and the sentries raise the alarm.',
      { resolution: { outcome: 'mixed_success' } as never }
    );
    assert.equal(r.ok, true);
  });

  it('passes Persian mixed_success with explicit physical price', () => {
    const r = validateProse(
      'دروازه را می‌گشایی، اما خنجر خراشی عمیق بر بازویت می‌نشاند و خون جاری می‌شود؛ نگهبانان با سوءظن به تو خیره می‌شوند.',
      { resolution: { outcome: 'mixed_success' } as never }
    );
    assert.equal(r.ok, true);
  });
});

describe('ProseValidator — Persian script integrity', () => {
  for (const character of ['\u0B3F', '\u09BF', '漢', 'क', 'ก', 'அ']) {
    it(`rejects foreign letter/mark U+${character.codePointAt(0)!.toString(16)}`, () => {
      const result = validateProse(`در سایه ${character} می‌ایستی.`, { language: 'fa' });
      assert.equal(result.ok, false);
      assert.ok(result.findings.some((f) => f.category === 'script_leak'));
    });
  }

  it('accepts Persian letters, vowel marks, joiners, digits and punctuation', () => {
    const result = validateProse('«آرام می‌روی؛ زَروان ۱۲۳ — Rostam…»', { language: 'fa-IR' });
    assert.equal(result.ok, true);
  });

  it('does not impose Persian script rules on other or unspecified languages', () => {
    for (const language of ['en', 'bn', undefined]) {
      assert.equal(validateProse('漢 ক', { language }).ok, true);
    }
  });

  it('includes actionable script repair guidance', () => {
    const result = validateProse('زروان\u0B3F', { language: 'persian' });
    assert.match(result.findings[0].detail, /U\+0B3F/);
    assert.match(result.findings[0].detail, /Rewrite affected words in Persian/);
  });
});

