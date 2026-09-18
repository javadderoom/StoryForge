import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, pickChoice, PERSONAS, makeRng } from './simulator';
import { ChoiceOption } from '@/lib/types/gameplay';

const CHOICES: ChoiceOption[] = [
  { id: 'a', text: 'Draw your sword', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 15 },
  { id: 'b', text: 'Slip along the wall', style: 'stealthy', riskLevel: 'medium', requiredStatId: 'agility', targetDC: 12 },
  { id: 'c', text: 'Ask the sentry a question', style: 'diplomatic', riskLevel: 'medium', requiredStatId: 'charisma', targetDC: 12 },
];

describe('Tier 4 — persona selection', () => {
  it('Brute prefers aggressive / might', () => {
    assert.equal(pickChoice(PERSONAS.brute, CHOICES)?.id, 'a');
  });
  it('Shadow prefers stealthy / agility', () => {
    assert.equal(pickChoice(PERSONAS.shadow, CHOICES)?.id, 'b');
  });
  it('Diplomat prefers diplomatic / charisma', () => {
    assert.equal(pickChoice(PERSONAS.diplomat, CHOICES)?.id, 'c');
  });
  it('Boundary-Pusher picks the highest-DC option', () => {
    assert.equal(pickChoice(PERSONAS.boundary, CHOICES)?.id, 'a');
  });
});

describe('Tier 4 — simulation determinism', () => {
  it('produces identical roll sequences for the same seed', () => {
    const a = Array.from({ length: 5 }, () => makeRng(99)());
    const b = Array.from({ length: 5 }, () => makeRng(99)());
    assert.deepEqual(a, b);
  });
});

describe('Tier 4 — trajectory audit', () => {
  it('runs a full multi-turn brute simulation with no trajectory violations', async () => {
    const report = await runSimulation({ persona: 'brute', turns: 6, seed: 7 });
    assert.equal(report.turns.length, 6, JSON.stringify(report.findings));
    assert.equal(report.passed, true, JSON.stringify(report.findings));
    assert.ok(report.turns.every((t) => t.hp >= 0));
  });

  it('is reproducible: same seed yields the same trajectory', async () => {
    const a = await runSimulation({ persona: 'shadow', turns: 5, seed: 42 });
    const b = await runSimulation({ persona: 'shadow', turns: 5, seed: 42 });
    assert.deepEqual(
      a.turns.map((t) => [t.turn, t.diceRoll, t.outcome, t.hp]),
      b.turns.map((t) => [t.turn, t.diceRoll, t.outcome, t.hp])
    );
  });

  it('detects a cyclical prose trap and duplicate memories', async () => {
    // A broken model that repeats the same prose + memory every single turn.
    const stuck = async () => ({
      data: {
        narrative: 'The same corridor, the same cold air, the same silence.',
        choices: [
          { id: 'x', text: 'Advance', style: 'tactical', riskLevel: 'medium', requiredStatId: 'cunning', targetDC: 12 },
          { id: 'y', text: 'Wait', style: 'defensive', riskLevel: 'low', requiredStatId: 'agility', targetDC: 10 },
        ],
        extractedMemories: [{ category: 'story', importance: 6, summary: 'The corridor is cold.' }],
      },
      rawText: '{}',
      modelUsed: 'stuck',
    });
    const report = await runSimulation({ persona: 'brute', turns: 4, seed: 1, modelCall: stuck });
    assert.equal(report.passed, false);
    assert.ok(report.findings.some((f) => f.rule === 'sim.prose_loop'));
    assert.ok(report.findings.some((f) => f.rule === 'sim.memory_duplicate'));
  });
});
