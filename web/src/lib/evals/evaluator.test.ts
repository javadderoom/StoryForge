import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRawScene } from './evaluator';

const STATS = ['might', 'agility', 'cunning', 'charisma'];

function raw(narrative: string, choices: unknown[]) {
  return { narrative, choices };
}

describe('Tier 3 Layer A — evaluateRawScene', () => {
  it('FAILS a standoff whose raw choices are diceless (the sentry bug)', () => {
    const report = evaluateRawScene(
      raw('The sentry levels his spear at your chest, blocking the bridge.', [
        { id: 'a', text: 'Talk your way past', style: 'diplomatic', riskLevel: 'medium' },
        { id: 'b', text: 'Step aside', style: 'defensive', riskLevel: 'low' },
      ]),
      { expectations: { requireNoDiceless: true, minDc: 12 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'standoff.diceless'));
    assert.equal(report.stats.dicelessCount, 2);
  });

  it('PASSES a standoff where the model declared stat + DC on every choice', () => {
    const report = evaluateRawScene(
      raw('The sentry levels his spear at your chest, blocking the bridge.', [
        { id: 'a', text: 'Draw your sword', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 15 },
        { id: 'b', text: 'Slip past the guard', style: 'stealthy', riskLevel: 'high', requiredStatId: 'agility', targetDC: 14 },
      ]),
      { expectations: { requireNoDiceless: true, minDc: 12, maxDc: 19 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, true, JSON.stringify(report.findings));
    assert.equal(report.stats.dicelessCount, 0);
    assert.deepEqual(report.stats.checkedDcs, [15, 14]);
  });

  it('FAILS a barricade assigned a too-low DC', () => {
    const report = evaluateRawScene(
      raw('The timber barricade blocks the gate, soldiers watching.', [
        { id: 'a', text: 'Smash through the barricade', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 10 },
      ]),
      { expectations: { minDc: 14 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'dc.too_low'));
  });

  it('reports a rescue when the model omitted a DC entirely (warning, not silent pass)', () => {
    const report = evaluateRawScene(
      raw('The sentry blocks the bridge with a lowered spear.', [
        { id: 'a', text: 'Level your crossbow at the bandit', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might' },
        { id: 'b', text: 'Slip into the reeds', style: 'stealthy', riskLevel: 'medium', requiredStatId: 'agility', targetDC: 13 },
      ]),
      { expectations: { requireNoDiceless: true }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, true);
    assert.ok(report.findings.some((f) => f.rule === 'dc.missing_from_model'));
  });

  it('FAILS triumphant prose on a critical failure', () => {
    const report = evaluateRawScene(
      raw('You triumph effortlessly, flawless in every motion.', [
        { id: 'a', text: 'Press on', style: 'tactical', riskLevel: 'low' },
        { id: 'b', text: 'Look around', style: 'inquisitive', riskLevel: 'low' },
      ]),
      { expectations: { outcome: 'critical_failure' }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'outcome.mismatch'));
  });

  it('FAILS a resurrected companion and PASSES a memorial mention', () => {
    const exp = { forbiddenAliveNames: ['Rostam'], minWords: 1 };
    const alive = evaluateRawScene(
      raw('Rostam grins and claps your shoulder, glad to be alive.', [
        { id: 'a', text: 'Embrace him', style: 'diplomatic', riskLevel: 'low' },
        { id: 'b', text: 'Say nothing', style: 'defensive', riskLevel: 'low' },
      ]),
      { expectations: exp, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(alive.passed, false);
    assert.ok(alive.findings.some((f) => f.rule === 'canon.resurrection'));

    const memorial = evaluateRawScene(
      raw('You kneel at the grave of Rostam, slain at the breach.', [
        { id: 'a', text: 'Say a prayer', style: 'diplomatic', riskLevel: 'low' },
        { id: 'b', text: 'Rise quietly', style: 'defensive', riskLevel: 'low' },
      ]),
      { expectations: exp, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(memorial.passed, true);
  });

  it('flags pre-baked outcomes as a warning without failing the run', () => {
    const report = evaluateRawScene(
      raw('The corridor stretches on into darkness.', [
        { id: 'a', text: 'You escape safely through the tunnel', style: 'agile', riskLevel: 'medium' },
        { id: 'b', text: 'Advance slowly', style: 'defensive', riskLevel: 'low' },
      ]),
      { expectations: {}, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, true);
    assert.ok(report.findings.some((f) => f.rule === 'choices.prebaked_outcome'));
  });

  it('enforces choice-count bounds', () => {
    const report = evaluateRawScene(
      raw('A lone figure waits in the rain.', [
        { id: 'a', text: 'Approach', style: 'defensive', riskLevel: 'low' },
      ]),
      { expectations: { minChoices: 2 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'choices.count'));
  });

  it('FAILS schema integrity when choices or narrative are missing', () => {
    const report = evaluateRawScene({ narrative: '', choices: undefined } as never, {
      expectations: {},
      validStatIds: STATS,
      isEnglish: true,
    });
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'schema.choices'));
    assert.ok(report.findings.some((f) => f.rule === 'schema.narrative'));
  });

  it('accepts absolute canonical DC bounds and flags out-of-band DCs', () => {
    const ok = evaluateRawScene(
      raw('The sentry levels his spear at your chest, blocking the bridge.', [
        { id: 'a', text: 'Draw your sword', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 15 },
        { id: 'b', text: 'Slip past the guard', style: 'stealthy', riskLevel: 'high', requiredStatId: 'agility', targetDC: 14 },
      ]),
      { expectations: { requireNoDiceless: true, minDc: 12, maxDc: 19 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(ok.passed, true, JSON.stringify(ok.findings));

    const bad = evaluateRawScene(
      raw('The sentry levels his spear at your chest, blocking the bridge.', [
        { id: 'a', text: 'Draw your sword', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 20 },
      ]),
      { expectations: { requireNoDiceless: true, minDc: 12, maxDc: 19 }, validStatIds: STATS, isEnglish: true }
    );
    assert.equal(bad.passed, false);
    assert.ok(bad.findings.some((f) => f.rule === 'dc.too_high'));
  });

  it('applies low-base-relative DC bands independently of canonical bounds', () => {
    const inBand = evaluateRawScene(
      raw('The watch blocks the narrow bridge.', [
        { id: 'a', text: 'Push through the line', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 12 },
      ]),
      {
        expectations: { minChoices: 1, lowBaseDcBand: { low: [7, 8], medium: [9, 10], high: [11, 12] } },
        validStatIds: STATS,
        isEnglish: true,
        isLowBase: true,
      }
    );
    assert.equal(inBand.passed, true, JSON.stringify(inBand.findings));

    const outOfBand = evaluateRawScene(
      raw('The watch blocks the narrow bridge.', [
        { id: 'a', text: 'Push through the line', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 15 },
      ]),
      {
        expectations: { minChoices: 1, lowBaseDcBand: { low: [7, 8], medium: [9, 10], high: [11, 12] } },
        validStatIds: STATS,
        isEnglish: true,
        isLowBase: true,
      }
    );
    assert.equal(outOfBand.passed, false);
    assert.ok(outOfBand.findings.some((f) => f.rule === 'choices.dc_range'));
  });
});
