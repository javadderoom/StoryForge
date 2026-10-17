import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapAotBranchRow,
  hasReaderActedSince,
  isSnapAotEnabled,
  preGenerateSnapAotBranch,
  shouldPreGenerateBranch,
  SNAP_AOT_ENABLE_ENV,
  type SnapAotBranchRow,
  type SnapAotDeps,
} from './snapAot';
import type { AotBranchResult } from '@/lib/engines/narrative/aotBranchEngine';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { SubQAdapter } from '@/lib/providers/SubQAdapter';
import { ChoiceOption, CheckResolution, PlayerState } from '@/lib/types/gameplay';
import type { StoryManifest } from '@/lib/types/story';

/**
 * Plan 15 §2.3 tier 4 (shadow): AOT pre-generation orchestration contract —
 * guards (flag, authored choice, staleness, abort), refetch sequencing, and
 * row building. The engine itself is covered by `aotBranchEngine.test.ts`.
 */

const NARRATIVE =
  'The lanterns of the salt market bob as the watchman studies you, then waves you through with a grunt.';

const DICELESS_CHOICE: ChoiceOption = {
  id: 'c_greet',
  text: 'Greet the watchman',
  style: 'diplomatic',
  riskLevel: 'low',
};

const AUTHORED_CHOICE = {
  id: 'c_beat',
  text: 'Follow the authored path',
  style: 'tactical',
  riskLevel: 'medium',
  targetSceneId: 'scene_authored_1',
} as ChoiceOption;

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
      locations: [{ id: 'loc_gate', name: 'Salt Gate' }],
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

function makeSession(turnNumbers: number[] = [3]) {
  return {
    playerState: makePlayerState(),
    turns: turnNumbers.map((turnNumber) => ({
      turnNumber,
      narrativeProse: `Scene prose for turn ${turnNumber}.`,
      playerActionText: 'Wait.',
      actionStyle: 'tactical',
    })),
    memories: [{ category: 'player', summary: 'Waited at the gate.', turnNumber: 3 }],
    sagaLedger: {},
    currentChapterId: null,
  };
}

function makeGeminiStub(behavior: { throwError?: string; isMock?: boolean } = {}) {
  return {
    generateSceneWithRaw: async () => {
      if (behavior.throwError) throw new Error(behavior.throwError);
      return {
        response: {
          narrative: NARRATIVE,
          choices: [
            { id: 'next_a', text: 'Move on', style: 'tactical', riskLevel: 'low' },
          ],
          extractedMemories: [],
          isMock: behavior.isMock ?? false,
        },
        raw: behavior.isMock ? null : { data: {}, rawText: 'raw', modelUsed: 'gemini-test' },
      };
    },
  } as unknown as GeminiAdapter;
}

function makeSubqStub(): SubQAdapter {
  return {
    isConfigured: () => false,
    evaluate: async () => ({ success: false, error: 'unconfigured' }),
  } as unknown as SubQAdapter;
}

async function withTestEnv(run: () => Promise<void>): Promise<void> {
  const previousSubq = process.env.SUBQ_API_KEY;
  delete process.env.SUBQ_API_KEY;
  try {
    await run();
  } finally {
    if (previousSubq !== undefined) process.env.SUBQ_API_KEY = previousSubq;
  }
}

describe('Plan 15 §2.3 tier 4 — AOT pre-generation orchestration', () => {
  it('parses the opt-in flag (unset/false are off)', () => {
    assert.equal(isSnapAotEnabled({}), false);
    assert.equal(isSnapAotEnabled({ [SNAP_AOT_ENABLE_ENV]: 'false' }), false);
    assert.equal(isSnapAotEnabled({ [SNAP_AOT_ENABLE_ENV]: 'true' }), true);
    assert.equal(isSnapAotEnabled({ [SNAP_AOT_ENABLE_ENV]: 'TRUE' }), true);
  });

  it('skips authored choices (their branches are served verbatim with zero model calls)', () => {
    assert.deepEqual(shouldPreGenerateBranch(AUTHORED_CHOICE), {
      ok: false,
      reason: 'authored_choice',
    });
    assert.deepEqual(shouldPreGenerateBranch(DICELESS_CHOICE), { ok: true });
    assert.deepEqual(shouldPreGenerateBranch(null), { ok: false, reason: 'no_choice' });
  });

  it('detects a reader tap that landed while the branch was pending', () => {
    assert.equal(hasReaderActedSince([{ turnNumber: 3 }], 3), false);
    assert.equal(hasReaderActedSince([{ turnNumber: 3 }, { turnNumber: 4 }], 3), true);
    assert.equal(hasReaderActedSince([], 3), false);
    assert.equal(hasReaderActedSince(undefined, 3), false);
  });

  it('builds the branch row exactly as the schema expects', () => {
    const result: AotBranchResult = {
      status: 'generated',
      narrative: 'Prose.',
      choices: [{ id: 'next_a', text: 'Move on', style: 'tactical', riskLevel: 'medium' }],
      diceRoll: 12,
      isDiceless: false,
      outcome: 'success',
      resolution: { diceRoll: 12, outcome: 'success' } as unknown as CheckResolution,
      model: 'gemini-test',
      latencyMs: 123.6,
    };
    const row = buildSnapAotBranchRow(
      { sessionId: 'sess_1', storyId: 'story_1', turnNumber: 3, choice: DICELESS_CHOICE },
      result
    );

    assert.deepEqual(row, {
      sessionId: 'sess_1',
      storyId: 'story_1',
      turnNumber: 3,
      predictedChoiceId: 'c_greet',
      choiceText: 'Greet the watchman',
      diceRoll: 12,
      isDiceless: false,
      outcome: 'success',
      status: 'generated',
      model: 'gemini-test',
      narrative: 'Prose.',
      choices: [{ id: 'next_a', text: 'Move on', style: 'tactical', riskLevel: 'medium' }],
      resolution: { diceRoll: 12, outcome: 'success' },
      verdict: undefined,
      audit: undefined,
      latencyMs: 124,
      error: undefined,
    });
  });

  it('carries the §7.6E audit verdict and report onto the stored row', () => {
    const audit = {
      verdict: 'warned' as const,
      findings: [
        { severity: 'warning' as const, category: 'narrative_length' as const, source: 'audit' as const, detail: 'short' },
      ],
      stats: {
        narrativeChars: 12,
        choiceCount: 1,
        choicesDroppedBySanitizer: 0,
        firstPassErrors: 0,
        firstPassWarnings: 0,
        repairAttempts: 0,
        proseRepaired: false,
        leftoverFindings: 0,
      },
    };
    const result: AotBranchResult = {
      status: 'generated',
      narrative: 'Prose.',
      choices: [{ id: 'next_a', text: 'Move on', style: 'tactical', riskLevel: 'medium' }],
      diceRoll: 12,
      isDiceless: false,
      outcome: 'success',
      resolution: { diceRoll: 12, outcome: 'success' } as unknown as CheckResolution,
      model: 'gemini-test',
      audit,
      latencyMs: 10,
    };
    const row = buildSnapAotBranchRow(
      { sessionId: 'sess_1', storyId: 'story_1', turnNumber: 3, choice: DICELESS_CHOICE },
      result
    );

    assert.equal(row.verdict, 'warned');
    assert.deepEqual(row.audit, audit);
  });

  it('does not even load the session for an authored predicted choice', async () => {
    let loadCalls = 0;
    let storeCalls = 0;
    await preGenerateSnapAotBranch(
      {
        sessionId: 'sess_1',
        storyId: 'story_1',
        turnNumber: 3,
        story: makeStory(),
        choice: AUTHORED_CHOICE,
        caller: null,
      },
      {
        loadSession: async () => {
          loadCalls += 1;
          return makeSession();
        },
        storeBranch: async () => {
          storeCalls += 1;
        },
      }
    );
    assert.equal(loadCalls, 0);
    assert.equal(storeCalls, 0);
  });

  it('pre-writes a diceless branch and stores the row for analysis', async () => {
    await withTestEnv(async () => {
      const stored: SnapAotBranchRow[] = [];
      await preGenerateSnapAotBranch(
        {
          sessionId: 'sess_1',
          storyId: 'story_1',
          turnNumber: 3,
          story: makeStory(),
          choice: DICELESS_CHOICE,
          caller: { id: 'user_1', role: 'USER' },
        },
        {
          loadSession: async (sessionId, caller) => {
            assert.equal(sessionId, 'sess_1');
            assert.deepEqual(caller, { id: 'user_1', role: 'USER' });
            return makeSession();
          },
          storeBranch: async (row) => {
            stored.push(row);
          },
          geminiAdapter: makeGeminiStub(),
          subqAdapter: makeSubqStub(),
        }
      );

      assert.equal(stored.length, 1);
      const row = stored[0];
      assert.equal(row.status, 'generated');
      assert.equal(row.predictedChoiceId, 'c_greet');
      assert.equal(row.isDiceless, true);
      assert.equal(row.diceRoll, undefined);
      assert.equal(row.narrative, NARRATIVE);
      // The validator's sanitizer pads thin choice sets; the model's choice survives.
      assert.ok((row.choices as Array<{ id?: string }>).some((c) => c.id === 'next_a'));
      assert.deepEqual((row.resolution as { outcome?: string }).outcome, 'success');
      assert.equal(typeof row.latencyMs, 'number');
    });
  });

  it('abandons the branch when a turn beyond the dwell turn already exists (raced tap)', async () => {
    await withTestEnv(async () => {
      let storeCalls = 0;
      await preGenerateSnapAotBranch(
        {
          sessionId: 'sess_1',
          storyId: 'story_1',
          turnNumber: 3,
          story: makeStory(),
          choice: DICELESS_CHOICE,
          caller: null,
        },
        {
          loadSession: async () => makeSession([3, 4]),
          storeBranch: async () => {
            storeCalls += 1;
          },
          geminiAdapter: makeGeminiStub(),
          subqAdapter: makeSubqStub(),
        }
      );
      assert.equal(storeCalls, 0);
    });
  });

  it('stores nothing when the signal is already aborted', async () => {
    let loadCalls = 0;
    let storeCalls = 0;
    const controller = new AbortController();
    controller.abort();
    await preGenerateSnapAotBranch(
      {
        sessionId: 'sess_1',
        storyId: 'story_1',
        turnNumber: 3,
        story: makeStory(),
        choice: DICELESS_CHOICE,
        caller: null,
        signal: controller.signal,
      },
      {
        loadSession: async () => {
          loadCalls += 1;
          return makeSession();
        },
        storeBranch: async () => {
          storeCalls += 1;
        },
      }
    );
    assert.equal(loadCalls, 0);
    assert.equal(storeCalls, 0);
  });

  it('records an engine failure as a failed row instead of throwing', async () => {
    await withTestEnv(async () => {
      const stored: SnapAotBranchRow[] = [];
      await preGenerateSnapAotBranch(
        {
          sessionId: 'sess_1',
          storyId: 'story_1',
          turnNumber: 3,
          story: makeStory(),
          choice: DICELESS_CHOICE,
          caller: null,
        },
        {
          loadSession: async () => makeSession(),
          storeBranch: async (row) => {
            stored.push(row);
          },
          geminiAdapter: makeGeminiStub({ throwError: 'boom' }),
          subqAdapter: makeSubqStub(),
        }
      );

      assert.equal(stored.length, 1);
      assert.equal(stored[0].status, 'failed');
      assert.match(String(stored[0].error), /boom/);
      assert.equal(stored[0].narrative, undefined);
    });
  });

  it('stores offline (mock) attempts so reliability is measurable', async () => {
    await withTestEnv(async () => {
      const stored: SnapAotBranchRow[] = [];
      await preGenerateSnapAotBranch(
        {
          sessionId: 'sess_1',
          storyId: 'story_1',
          turnNumber: 3,
          story: makeStory(),
          choice: DICELESS_CHOICE,
          caller: null,
        },
        {
          loadSession: async () => makeSession(),
          storeBranch: async (row) => {
            stored.push(row);
          },
          geminiAdapter: makeGeminiStub({ isMock: true }),
          subqAdapter: makeSubqStub(),
        }
      );

      assert.equal(stored.length, 1);
      assert.equal(stored[0].status, 'mock_unavailable');
      assert.equal(stored[0].error, 'model_unavailable');
    });
  });

  it('skips silently when the session cannot be refetched', async () => {
    let storeCalls = 0;
    await preGenerateSnapAotBranch(
      {
        sessionId: 'sess_missing',
        storyId: 'story_1',
        turnNumber: 3,
        story: makeStory(),
        choice: DICELESS_CHOICE,
        caller: null,
      },
      {
        loadSession: async () => null,
        storeBranch: async () => {
          storeCalls += 1;
        },
      } satisfies SnapAotDeps
    );
    assert.equal(storeCalls, 0);
  });
});
