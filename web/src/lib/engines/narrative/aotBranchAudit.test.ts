import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditAotBranch,
  buildRejectedAudit,
  type AotBranchAuditInput,
} from './aotBranchAudit';
import type { CheckResolution, ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import type { WorldBible } from '@/lib/types/world';

/**
 * Plan 15 §7.6E — shadow AOT branch audit contract.
 * The audit turns a pre-written branch into mistake telemetry (first-draft
 * mistakes, repair spend, surviving findings) plus one serving verdict.
 */

const LONG_EN_PROSE = [
  'The salt market breathes around you in slow tides of lantern light and gossip.',
  'A spice peddler argues with a caravan hand over the weight of a burlap sack,',
  'while somewhere behind the stalls a bell rings twice and then falls silent.',
  'You step past the last awning and the crowd thins into a narrow alley mouth,',
  'where the wind carries the mineral sting of the flats and the promise of trouble.',
].join(' ');

function makeChoices(): ChoiceOption[] {
  return [
    { id: 'next_a', text: 'Follow the alley to the flats', style: 'tactical', riskLevel: 'medium' },
    { id: 'next_b', text: 'Ask the spice peddler about the bell', style: 'diplomatic', riskLevel: 'low' },
    { id: 'next_c', text: 'Double back toward the caravan gate', style: 'stealth', riskLevel: 'high' },
  ] as ChoiceOption[];
}

function makeResolution(overrides: Partial<CheckResolution> = {}): CheckResolution {
  return {
    actionDescription: 'Follow the alley',
    statModifier: 2,
    diceRoll: 12,
    diceType: 'd20',
    environmentalModifier: 0,
    totalScore: 14,
    difficultyClass: 12,
    outcome: 'success',
    stateDiff: {},
    ...overrides,
  } as unknown as CheckResolution;
}

function makeInput(overrides: Partial<AotBranchAuditInput> = {}): AotBranchAuditInput {
  return {
    storyTitle: 'The Salt Road',
    language: 'en',
    narrative: LONG_EN_PROSE,
    choices: makeChoices(),
    resolution: makeResolution(),
    isDiceless: false,
    playerActionText: 'Follow the alley',
    playerState: { characterName: 'Rakhshan', relationships: {} } as unknown as PlayerState,
    worldBible: { npcs: [] } as unknown as WorldBible,
    priorTurns: [],
    firstPassFindings: [],
    finalFindings: [],
    proseRepaired: false,
    repairAttempts: 0,
    ...overrides,
  };
}

describe('Plan 15 §7.6E — shadow AOT branch audit', () => {
  it('a first-draft-passed branch with no surviving findings is clean', () => {
    const audit = auditAotBranch(makeInput());

    assert.equal(audit.verdict, 'clean');
    assert.deepEqual(audit.findings, []);
    assert.equal(audit.stats.repairAttempts, 0);
    assert.equal(audit.stats.firstPassErrors, 0);
    assert.equal(audit.stats.choiceCount, 3);
    assert.equal(audit.stats.narrativeChars, LONG_EN_PROSE.length);
  });

  it('a repaired first draft is `repaired` and keeps the mistake as info telemetry', () => {
    const audit = auditAotBranch(
      makeInput({
        firstPassFindings: [
          { severity: 'error', category: 'outcome_mismatch', detail: 'Outcome is success but prose reads disastrous.' },
        ],
        proseRepaired: true,
        repairAttempts: 1,
      })
    );

    assert.equal(audit.verdict, 'repaired');
    assert.equal(audit.stats.firstPassErrors, 1);
    assert.equal(audit.stats.repairAttempts, 1);
    const telemetry = audit.findings.find((f) => f.category === 'prose_first_pass');
    assert.ok(telemetry, 'first-draft telemetry must be kept');
    assert.equal(telemetry.severity, 'info');
    assert.match(telemetry.detail, /\[first draft\] \[outcome_mismatch\]/);
  });

  it('a surviving validator warning downgrades the branch to `warned`', () => {
    const audit = auditAotBranch(
      makeInput({
        finalFindings: [
          { severity: 'warning', category: 'new_entity', detail: '3 unknown proper nouns in prose; verify against World Bible.' },
        ],
      })
    );

    assert.equal(audit.verdict, 'warned');
    const leftover = audit.findings.find((f) => f.category === 'prose_final');
    assert.ok(leftover);
    assert.equal(leftover.severity, 'warning');
    assert.equal(audit.stats.leftoverFindings, 1);
  });

  it('rejects a branch whose prose echoes an undiscovered secret (serving would leak it)', () => {
    const audit = auditAotBranch(
      makeInput({
        narrative:
          'Baroness Venn lowers her voice; she smuggles silver along the northern mine road, and the ledger agrees.',
        worldBible: {
          npcs: [
            {
              id: 'npc_venn',
              name: 'Baroness Venn',
              secrets: [
                {
                  id: 'sec_silver',
                  description: 'smuggles silver through the northern mine road',
                  requiredTrustLevel: 3,
                  revealed: false,
                },
              ],
            },
          ],
        } as unknown as WorldBible,
      })
    );

    assert.equal(audit.verdict, 'rejected');
    const leak = audit.findings.find((f) => f.category === 'secret_leak');
    assert.ok(leak, 'secret echo must be flagged');
    assert.equal(leak.severity, 'error');
    assert.match(leak.detail, /Baroness Venn/);
  });

  it('treats a discovered secret as known — no leak finding', () => {
    const audit = auditAotBranch(
      makeInput({
        narrative:
          'Baroness Venn lowers her voice; she smuggles silver along the northern mine road, and the ledger agrees.',
        worldBible: {
          npcs: [
            {
              id: 'npc_venn',
              name: 'Baroness Venn',
              secrets: [
                {
                  id: 'sec_silver',
                  description: 'smuggles silver through the northern mine road',
                  requiredTrustLevel: 3,
                  revealed: false,
                },
              ],
            },
          ],
        } as unknown as WorldBible,
        playerState: {
          characterName: 'Rakhshan',
          relationships: { npc_venn: { trust: 40, knownSecrets: ['sec_silver'], notes: [] } },
        } as unknown as PlayerState,
      })
    );

    assert.equal(audit.findings.some((f) => f.category === 'secret_leak'), false);
  });

  it('flags thin choice sets and sanitizer fallbacks (choice hygiene)', () => {
    const audit = auditAotBranch(
      makeInput({
        choices: [{ id: 'choice_fallback_1', text: 'Wait and watch', style: 'tactical', riskLevel: 'low' }] as ChoiceOption[],
      })
    );

    assert.equal(audit.verdict, 'warned');
    const hygiene = audit.findings.filter((f) => f.category === 'choice_hygiene');
    assert.ok(hygiene.some((f) => f.detail.includes('1 choice(s)')));
    assert.ok(hygiene.some((f) => f.detail.includes('Fallback choice')));
  });

  it('rejects prose written in the wrong language for the story', () => {
    const audit = auditAotBranch(
      makeInput({ language: 'fa', narrative: LONG_EN_PROSE })
    );

    assert.equal(audit.verdict, 'rejected');
    const mismatch = audit.findings.find((f) => f.category === 'language_mismatch');
    assert.ok(mismatch);
    assert.equal(mismatch.severity, 'error');
  });

  it('warns when the branch re-states the previous scene instead of continuing it', () => {
    const previous = `${LONG_EN_PROSE} ${LONG_EN_PROSE}`;
    const audit = auditAotBranch(
      makeInput({
        priorTurns: [{ turnNumber: 1, narrativeProse: previous, playerActionText: 'Study the market.' }],
        narrative: `${LONG_EN_PROSE} ${LONG_EN_PROSE}`,
      })
    );

    assert.equal(audit.verdict, 'warned');
    const repetition = audit.findings.find((f) => f.category === 'scene_repetition');
    assert.ok(repetition);
    assert.match(repetition.detail, /overlaps the previous scene/);
  });

  it('rejects an illegal stored dice value (row integrity)', () => {
    const audit = auditAotBranch(
      makeInput({ resolution: makeResolution({ diceRoll: 99, diceType: 'd20' }) })
    );

    assert.equal(audit.verdict, 'rejected');
    const integrity = audit.findings.find((f) => f.category === 'row_integrity');
    assert.ok(integrity);
    assert.match(integrity.detail, /99.*d20/);
  });

  it('builds a rejected audit for branches that never reached the auditable state', () => {
    const audit = buildRejectedAudit(
      'prose violated canon and was not repairable',
      [{ severity: 'error', category: 'resurrection', detail: 'NPC "Sana" is dead per ledger but appears alive in prose.' }],
      { narrativeChars: 120, repairAttempts: 2 }
    );

    assert.equal(audit.verdict, 'rejected');
    assert.equal(audit.findings[0].detail, 'Branch not usable: prose violated canon and was not repairable.');
    assert.ok(audit.findings.some((f) => f.detail.includes('[resurrection]')));
    assert.equal(audit.stats.repairAttempts, 2);
    assert.equal(audit.stats.firstPassErrors, 1);
  });
});
