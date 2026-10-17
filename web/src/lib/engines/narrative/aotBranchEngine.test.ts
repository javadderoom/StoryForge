import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { preGenerateAotBranch, type AotBranchContext } from './aotBranchEngine';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { SubQAdapter, type SubQDecisionRequest } from '@/lib/providers/SubQAdapter';
import { ChoiceOption, PlayerState } from '@/lib/types/gameplay';
import type { StoryManifest } from '@/lib/types/story';

/**
 * Plan 15 §2.3 tier 4 (shadow): AOT branch engine contract.
 * The engine mirrors the action route's deterministic block — pre-rolled dice,
 * pressure/social/party/sub-zone/secrets, state mutation, clocks, quests,
 * defeat, ledger, then the shared narrative core.
 */

const NARRATIVE =
  'The gate shudders and swings wide; a thin line of blood tracks across your knuckles as cold air rushes past you into the dark.';

const CHECK_CHOICE: ChoiceOption = {
  id: 'c_gate',
  text: 'Force the gate',
  style: 'aggressive',
  riskLevel: 'medium',
  targetDC: 12,
  requiredStatId: 'might',
};

const DICELESS_CHOICE: ChoiceOption = {
  id: 'c_greet',
  text: 'Greet the watchman',
  style: 'diplomatic',
  riskLevel: 'low',
};

function makeStory(): StoryManifest {
  // Minimal structural fixture: only the fields the branch engine reads.
  return {
    title: 'The Salt Road',
    language: 'en',
    rpgSystem: {
      hasCombat: false,
      diceType: 'd20',
      skills: [],
      startingInventory: [],
      inventoryCapacity: 10,
      stats: [{ id: 'might', name: 'Might', description: 'Strength', baseValue: 10 }],
      resources: [{ id: 'hp', name: 'Health', min: 0, max: 100, current: 50 }],
    },
    worldBible: {
      locations: [
        { id: 'loc_gate', name: 'Salt Gate' },
        { id: 'loc_alley', name: 'Alley' },
      ],
      npcs: [],
      factions: [],
      artifacts: [],
      religions: [],
      bestiary: [],
      laws: [],
    },
    saga: { chapters: [] },
    initialStoryBeats: [],
  } as unknown as StoryManifest;
}

function makePlayerState(): PlayerState {
  return {
    characterName: 'Rakhshan',
    level: 1,
    stats: { might: 12 },
    resources: { hp: 50 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: ['loc_gate'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_gate',
  };
}

function makeGeminiStub(overrides: { narrative?: string; isMock?: boolean } = {}) {
  const calls: unknown[] = [];
  const adapter = {
    generateSceneWithRaw: async (prompt: unknown) => {
      calls.push(prompt);
      return {
        response: {
          narrative: overrides.narrative ?? NARRATIVE,
          choices: [
            { id: 'next_a', text: 'Advance into the dark', style: 'tactical', riskLevel: 'medium' },
          ],
          extractedMemories: [],
          isMock: overrides.isMock ?? false,
        },
        raw: overrides.isMock ? null : { data: {}, rawText: 'raw', modelUsed: 'gemini-test' },
      };
    },
  } as unknown as GeminiAdapter;
  return { adapter, calls };
}

function makeSubqStub(): SubQAdapter {
  return {
    isConfigured: () => false,
    evaluate: async () => ({ success: false, error: 'unconfigured' }),
  } as unknown as SubQAdapter;
}

async function withTestEnv(run: () => Promise<void>): Promise<void> {
  const previousSubq = process.env.SUBQ_API_KEY;
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousJudge = process.env.SNAP_AOT_JUDGE;
  delete process.env.SUBQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.SNAP_AOT_JUDGE;
  try {
    await run();
  } finally {
    if (previousSubq !== undefined) process.env.SUBQ_API_KEY = previousSubq;
    if (previousGemini !== undefined) process.env.GEMINI_API_KEY = previousGemini;
    if (previousJudge !== undefined) process.env.SNAP_AOT_JUDGE = previousJudge;
  }
}

function makeContext(overrides: Partial<AotBranchContext> = {}): AotBranchContext {
  return {
    story: makeStory(),
    playerState: makePlayerState(),
    choice: CHECK_CHOICE,
    turnNumber: 3,
    sessionTurns: [{ turnNumber: 3, narrativeProse: 'The gate looms.', playerActionText: 'Wait.' }],
    sessionMemories: [],
    geminiAdapter: makeGeminiStub().adapter,
    subqAdapter: makeSubqStub(),
    ...overrides,
  };
}

describe('Plan 15 §2.3 tier 4 — AOT branch engine', () => {
  it('pre-rolls the check, stores the roll on the resolution, and returns the validated branch', async () => {
    await withTestEnv(async () => {
      const { adapter, calls } = makeGeminiStub();
      const result = await preGenerateAotBranch(
        makeContext({ geminiAdapter: adapter, forcedDiceRoll: 20 })
      );

      assert.equal(result.status, 'generated');
      assert.equal(result.isDiceless, false);
      // The pre-rolled dice is the stored, revealed-on-tap value.
      assert.equal(result.diceRoll, 20);
      assert.equal(result.resolution?.diceRoll, 20);
      assert.equal(result.outcome, result.resolution?.outcome);
      assert.ok(
        ['critical_success', 'success', 'mixed_success'].includes(result.outcome as string),
        `expected a non-failure outcome for a forced 20, got ${result.outcome}`
      );
      assert.equal(result.narrative, NARRATIVE);
      // The secret sanitizer keeps the model's choice (and pads the set with
      // deterministic fallbacks if the model returned too few).
      assert.ok((result.choices ?? []).some((c) => c.id === 'next_a'));
      assert.equal(result.model, 'gemini-test');
      assert.equal(typeof result.latencyMs, 'number');
      // §7.6E: generated branches carry their audit (mistake telemetry + verdict).
      assert.ok(result.audit, 'generated branches carry an audit');
      assert.ok(
        ['clean', 'repaired', 'warned', 'rejected'].includes(result.audit!.verdict),
        `unexpected audit verdict ${result.audit!.verdict}`
      );
      assert.equal(result.audit!.stats.repairAttempts, 0);
      // One generation call — the branch is a single writer pass here.
      assert.equal(calls.length, 1);
    });
  });

  it('keeps the deterministic audit unchanged and makes no judge call when disabled', async () => {
    await withTestEnv(async () => {
      let judgeCalls = 0;
      const subqAdapter = {
        isConfigured: () => true,
        evaluate: async (req: SubQDecisionRequest) => {
          const reqState = req?.state as { task?: string } | undefined;
          if (reqState?.task === 'critique_shadow_branch') {
            judgeCalls += 1;
          }
          return { success: true, answers: {}, model: 'subq-test' };
        },
      } as unknown as SubQAdapter;
      const result = await preGenerateAotBranch(makeContext({ subqAdapter, forcedDiceRoll: 20 }));
      assert.equal(judgeCalls, 0);
      assert.equal(result.audit?.stats.judgeSkipped, undefined);
      assert.deepEqual(result.audit?.findings.some((finding) => finding.source === 'judge'), false);
    });
  });

  it('judges the final generated prose and merges judge findings into the audit', async () => {
    await withTestEnv(async () => {
      process.env.SNAP_AOT_JUDGE = 'true';
      const judgeCalls: Array<{ request: SubQDecisionRequest; options?: { timeoutMs?: number; signal?: AbortSignal } }> = [];
      const subqAdapter = {
        isConfigured: () => true,
        evaluate: async (request: SubQDecisionRequest, options?: { timeoutMs?: number; signal?: AbortSignal }) => {
          const reqState = request?.state as { task?: string } | undefined;
          if (reqState?.task === 'critique_shadow_branch') {
            judgeCalls.push({ request, options });
            return {
              success: true,
              model: 'subq-test',
              latencyMs: 17,
              answers: {
                state_consistent: { answer: false, reason: 'NPC contradicts ledger.' },
                outcome_consistent: { answer: true },
                coherent: { answer: true },
                in_character: { answer: true },
                choices_follow: { answer: true },
                no_leak: { answer: true },
                no_meta: { answer: true },
              },
            };
          }
          return {
            success: true,
            model: 'subq-test',
            answers: { stalling_assessment: { choice: 'none' } },
          };
        },
      } as unknown as SubQAdapter;
      const { adapter } = makeGeminiStub();
      const result = await preGenerateAotBranch(makeContext({ geminiAdapter: adapter, subqAdapter, forcedDiceRoll: 20 }));
      assert.equal(result.status, 'generated');
      assert.equal(judgeCalls.length, 1);
      const requestState = judgeCalls[0].request.state as { branch_prose?: string; player?: { location_id?: string } };
      assert.equal(requestState.branch_prose, result.narrative);
      assert.equal(requestState.player?.location_id, 'loc_gate');
      assert.equal(judgeCalls[0].options?.timeoutMs, 4000);
      assert.equal(result.audit?.verdict, 'rejected');
      assert.equal(result.audit?.stats.judgeSkipped, false);
      assert.equal(result.audit?.stats.judgeFindings, 1);
      assert.equal(result.audit?.stats.judgeLatencyMs, 17);
      assert.ok(result.audit?.findings.some((finding) => finding.source === 'judge' && finding.category === 'judge_state'));
    });
  });

  it('a forced critical failure changes the stored outcome (the roll drives the branch)', async () => {
    await withTestEnv(async () => {
      const result = await preGenerateAotBranch(makeContext({ forcedDiceRoll: 1 }));
      assert.equal(result.status, 'generated');
      assert.equal(result.diceRoll, 1);
      assert.equal(result.outcome, 'critical_failure');
    });
  });

  it('diceless choices branch without a roll and award progression XP', async () => {
    await withTestEnv(async () => {
      const result = await preGenerateAotBranch(
        makeContext({ choice: DICELESS_CHOICE, forcedDiceRoll: 7 })
      );

      assert.equal(result.status, 'generated');
      assert.equal(result.isDiceless, true);
      // Diceless choices have no check, so nothing is pre-rolled.
      assert.equal(result.diceRoll, undefined);
      assert.equal(result.outcome, 'success');
      assert.ok((result.resolution?.stateDiff?.xpGained ?? 0) > 0);
    });
  });

  it('mirrors the route: an unrepairable canon violation surfaces as prose_invalid, never canon', async () => {
    await withTestEnv(async () => {
      // Outcome is success-family; prose reads like a disaster → outcome_mismatch.
      const { adapter } = makeGeminiStub({
        narrative: 'The gate is a disaster; it collapses, and the attempt ends in ruin.',
      });
      const result = await preGenerateAotBranch(
        makeContext({ geminiAdapter: adapter, forcedDiceRoll: 20 })
      );

      assert.equal(result.status, 'prose_invalid');
      assert.equal(result.narrative, undefined);
      assert.equal(result.error, 'unrepairable');
      // The rejection itself is audited: verdict rejected + the canon findings.
      assert.equal(result.audit?.verdict, 'rejected');
      assert.ok(result.audit?.findings.some((f) => f.detail.includes('not usable')));
      // The pre-rolled resolution is still retained for analysis.
      assert.equal(result.resolution?.diceRoll, 20);
    });
  });

  it('offline/mock model output is reported as mock_unavailable, not stored as a branch', async () => {
    await withTestEnv(async () => {
      const { adapter } = makeGeminiStub({ isMock: true });
      const result = await preGenerateAotBranch(
        makeContext({ geminiAdapter: adapter, forcedDiceRoll: 20 })
      );

      assert.equal(result.status, 'mock_unavailable');
      assert.equal(result.narrative, undefined);
      assert.equal(result.error, 'model_unavailable');
      assert.equal(result.audit?.verdict, 'rejected');
      assert.equal(result.diceRoll, 20);
    });
  });
});
