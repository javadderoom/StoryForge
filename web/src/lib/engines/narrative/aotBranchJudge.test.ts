import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AOT_JUDGE_QUESTION_KEYS,
  buildAotJudgeRequest,
  collectUndiscoveredSecrets,
  extractSubQBoolean,
  judgeAnswersToFindings,
  mergeAotJudgeIntoAudit,
  parseAotJudgeAnswers,
  runAotBranchJudge,
  SNAP_AOT_JUDGE_TIMEOUT_MS,
  type AotJudgeInput,
} from './aotBranchJudge';
import { auditAotBranch, type AotBranchAudit } from './aotBranchAudit';
import type { SubQAdapter, SubQDecisionRequest, SubQDecisionResponse } from '@/lib/providers/SubQAdapter';
import type { ChoiceOption, PlayerState, CheckResolution } from '@/lib/types/gameplay';
import type { WorldBible, WorldStateLedger } from '@/lib/types/world';

const LONG_PROSE = 'The watchman lifts the iron bar and the gate opens onto the salt road. '.repeat(8);
const choices: ChoiceOption[] = [
  { id: 'next_a', text: 'Walk through the gate', style: 'tactical', riskLevel: 'low' },
  { id: 'next_b', text: 'Ask the watchman about the caravan', style: 'diplomatic', riskLevel: 'low' },
];
const allPass = () => Object.fromEntries(AOT_JUDGE_QUESTION_KEYS.map((key) => [key, { answer: true }]));

function makeInput(overrides: Partial<AotJudgeInput> = {}): AotJudgeInput {
  return {
    storyTitle: 'The Salt Road',
    language: 'en',
    currentScene: 'The iron gate blocks the road.',
    playerActionText: 'Open the gate',
    resolution: {
      actionDescription: 'Open the gate',
      statModifier: 0,
      diceRoll: 14,
      diceType: 'd20',
      environmentalModifier: 0,
      totalScore: 14,
      difficultyClass: 12,
      outcome: 'mixed_success',
      consequenceSummary: 'The gate opens, but the watchman takes your seal.',
      stateDiff: {},
    } as CheckResolution,
    isDiceless: false,
    playerState: {
      characterName: 'Rakhshan',
      level: 2,
      stats: { might: 12 },
      resources: { hp: 8 },
      inventory: [{ id: 'iron_key', name: 'Iron key' }],
      abilities: ['shadow_step'],
      equipment: {},
      discoveredLocationIds: ['salt_gate'],
      relationships: {},
      activeQuestIds: [],
      completedQuestIds: [],
      currentLocationId: 'salt_gate',
      currentSubZoneId: 'outer_gate',
    } as unknown as PlayerState,
    worldBible: {
      locations: [{ id: 'salt_gate', name: 'Salt Gate' }],
      npcs: [{ id: 'watchman', name: 'Watchman', role: 'guard', currentLocationId: 'salt_gate', speechStyle: 'Curt, formal.', secrets: [
        { id: 'secret_1', description: 'He secretly smuggles silver through the northern mines.', revealed: false },
        { id: 'secret_2', description: 'He once fought at dawn.', revealed: true },
      ] }],
    } as unknown as WorldBible,
    ledger: { npcStatuses: [{ npcId: 'dead_npc', npcName: 'Sana', status: 'dead', note: 'Fell at the bridge.' }], keyItems: [], openPlotThreads: [] } as unknown as WorldStateLedger,
    narrative: LONG_PROSE,
    choices,
    ...overrides,
  };
}

function makeAudit(): AotBranchAudit {
  return auditAotBranch({
    storyTitle: 'The Salt Road', language: 'en', narrative: LONG_PROSE, choices,
    resolution: makeInput().resolution, isDiceless: false, playerActionText: 'Open the gate',
    playerState: makeInput().playerState, worldBible: { npcs: [] } as unknown as WorldBible,
    priorTurns: [], firstPassFindings: [], finalFindings: [], proseRepaired: false, repairAttempts: 0,
  });
}

function makeAdapter(response: SubQDecisionResponse | (() => Promise<SubQDecisionResponse>), configured = true) {
  const calls: Array<{ request: SubQDecisionRequest; options?: { timeoutMs?: number; signal?: AbortSignal } }> = [];
  const adapter = {
    isConfigured: () => configured,
    evaluate: async (request: SubQDecisionRequest, options?: { timeoutMs?: number; signal?: AbortSignal }) => {
      calls.push({ request, options });
      return typeof response === 'function' ? response() : response;
    },
  } as unknown as SubQAdapter;
  return { adapter, calls };
}

function response(answers: Record<string, unknown>, overrides: Partial<SubQDecisionResponse> = {}): SubQDecisionResponse {
  return { success: true, answers: answers as SubQDecisionResponse['answers'], model: 'subq-test', latencyMs: 23, ...overrides };
}

describe('Plan 15 §7.6G — AOT semantic branch judge', () => {
  it('builds the expected bounded question request and authoritative state', () => {
    const request = buildAotJudgeRequest(makeInput({ currentScene: 's'.repeat(2000), narrative: 'p'.repeat(4000) }));
    const state = request.state as {
      scene_on_screen: string;
      branch_prose: string;
      player: { abilities: string[]; location_id: string; sub_zone_id: string };
      present_npcs: Array<{ name: string; role?: string; speech_style?: string }>;
      ledger: { npc_statuses: Array<{ status: string }> };
      resolved_consequence: string;
      undiscovered_secrets: Array<{ secret: string }>;
    };
    assert.deepEqual(Object.keys(request.questions), AOT_JUDGE_QUESTION_KEYS);
    assert.ok(Object.values(request.questions).every((question) => question.type === 'noul'));
    assert.equal(state.scene_on_screen.length, 1601);
    assert.equal(state.branch_prose.length, 3201);
    assert.deepEqual(state.player.abilities, ['shadow_step']);
    assert.equal(state.player.location_id, 'salt_gate');
    assert.equal(state.player.sub_zone_id, 'outer_gate');
    assert.deepEqual(state.present_npcs, [{ name: 'Watchman', role: 'guard', speech_style: 'Curt, formal.' }]);
    assert.equal(state.ledger.npc_statuses[0].status, 'dead');
    assert.match(state.resolved_consequence, /takes your seal/);
    assert.equal(state.undiscovered_secrets.length, 1);
    assert.match(state.undiscovered_secrets[0].secret, /smuggles silver/);
  });

  it('excludes known and revealed secrets from the do-not-repeat list', () => {
    const input = makeInput({
      playerState: { ...makeInput().playerState, relationships: { watchman: { trust: 1, knownSecrets: ['secret_1'], notes: [] } } },
      worldBible: { npcs: [{ id: 'watchman', name: 'Watchman', secrets: [
        { id: 'secret_1', description: 'He secretly smuggles silver through the northern mines.', revealed: false },
        { id: 'secret_2', description: 'A revealed but no longer hidden useful secret.', revealed: true },
      ] }] } as unknown as WorldBible,
    });
    assert.deepEqual(collectUndiscoveredSecrets(input), []);
  });

  it('parses booleans, wrapped answers, strings and zero/one ordinal indexes', () => {
    assert.equal(extractSubQBoolean(true), true);
    assert.equal(extractSubQBoolean({ answer: false }), false);
    assert.equal(extractSubQBoolean({ noul: { answer: true } }), true);
    assert.equal(extractSubQBoolean({ value: 'no' }), false);
    assert.equal(extractSubQBoolean({ index: 0 }), false);
    assert.equal(extractSubQBoolean({ index: 1 }), true);
    assert.equal(extractSubQBoolean({ index: 2 }), undefined);
    assert.equal(extractSubQBoolean({ answer: 'maybe' }), undefined);
  });

  it('requires all seven answers and maps failures to the planned categories and severities', () => {
    const answers = parseAotJudgeAnswers(response({
      ...allPass(), state_consistent: { answer: false, reason: 'Sana is alive in the prose.' },
      coherent: { noul: false }, no_meta: { index: 0 },
    }));
    assert.equal(answers.length, 7);
    const findings = judgeAnswersToFindings(answers);
    assert.deepEqual(findings.map(({ category, severity, source }) => ({ category, severity, source })), [
      { category: 'judge_state', severity: 'error', source: 'judge' },
      { category: 'judge_coherence', severity: 'warning', source: 'judge' },
      { category: 'judge_meta', severity: 'warning', source: 'judge' },
    ]);
    assert.match(findings[0].detail, /Sana is alive/);
  });

  it('escalates merged verdicts while preserving the deterministic audit byte-for-byte when there are no judge findings', () => {
    const base = makeAudit();
    const cleanMerge = mergeAotJudgeIntoAudit(base, { findings: [], stats: { judgeSkipped: false, judgeFindings: 0, judgeLatencyMs: 10 } });
    assert.equal(cleanMerge.verdict, base.verdict);
    assert.deepEqual(cleanMerge.findings, base.findings);
    const warning = mergeAotJudgeIntoAudit(base, {
      findings: [{ severity: 'warning', category: 'judge_voice', source: 'judge', detail: 'NPC voice changed.' }],
      stats: { judgeSkipped: false, judgeFindings: 1 },
    });
    assert.equal(warning.verdict, 'warned');
    const error = mergeAotJudgeIntoAudit(base, {
      findings: [{ severity: 'error', category: 'judge_outcome', source: 'judge', detail: 'Outcome contradicted.' }],
      stats: { judgeSkipped: false, judgeFindings: 1 },
    });
    assert.equal(error.verdict, 'rejected');
  });

  it('passes the 4-second timeout and shared abort signal to the adapter', async () => {
    const controller = new AbortController();
    const mock = makeAdapter(response(allPass()));
    const result = await runAotBranchJudge(makeInput(), { adapter: mock.adapter, signal: controller.signal });
    assert.equal(result.stats.judgeSkipped, false);
    assert.equal(mock.calls[0].options?.timeoutMs, SNAP_AOT_JUDGE_TIMEOUT_MS);
    assert.equal(mock.calls[0].options?.signal, controller.signal);
  });

  it('skips unconfigured, aborted, failed, partial, and thrown requests without findings or throws', async () => {
    const unconfigured = makeAdapter(response(allPass()), false);
    assert.equal((await runAotBranchJudge(makeInput(), { adapter: unconfigured.adapter })).stats.judgeError, 'subq_not_configured');

    const controller = new AbortController();
    controller.abort();
    const aborted = makeAdapter(response(allPass()));
    assert.equal((await runAotBranchJudge(makeInput(), { adapter: aborted.adapter, signal: controller.signal })).stats.judgeError, 'aborted');
    assert.equal(aborted.calls.length, 0);

    const failed = makeAdapter(response({}, { success: false, error: 'HTTP 503' }));
    const failedResult = await runAotBranchJudge(makeInput(), { adapter: failed.adapter });
    assert.deepEqual(failedResult.findings, []);
    assert.equal(failedResult.stats.judgeError, 'HTTP 503');

    const partial = makeAdapter(response({ state_consistent: { answer: true } }));
    assert.equal((await runAotBranchJudge(makeInput(), { adapter: partial.adapter })).stats.judgeError, 'incomplete_answers');

    const throwing = makeAdapter(async () => { throw new Error('timeout'); });
    const thrown = await runAotBranchJudge(makeInput(), { adapter: throwing.adapter });
    assert.deepEqual(thrown.findings, []);
    assert.equal(thrown.stats.judgeSkipped, true);
    assert.match(thrown.stats.judgeError ?? '', /timeout/);
  });

  it('skips empty branch prose without calling SubQ', async () => {
    const mock = makeAdapter(response(allPass()));
    const result = await runAotBranchJudge(makeInput({ narrative: '' }), { adapter: mock.adapter });
    assert.equal(result.stats.judgeError, 'no_branch_prose');
    assert.equal(mock.calls.length, 0);
  });
});
