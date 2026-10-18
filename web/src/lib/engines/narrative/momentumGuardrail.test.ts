import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubQMomentumRequest,
  extractSubQNoul,
  extractSubQChoice,
  buildMomentumRepairInstruction,
  evaluateMomentumHeuristics,
  evaluateNarrativeMomentum,
  MomentumEvaluationInput,
} from './momentumGuardrail';
import { SubQAdapter, SubQDecisionResponse } from '@/lib/providers/SubQAdapter';

describe('MomentumGuardrail — SubQ Snap Anti-Stalling & Story Momentum', () => {
  const sampleInput: MomentumEvaluationInput = {
    storyTitle: 'خاکستر زروان',
    language: 'fa',
    priorScenes: [
      'گزمه‌های ارگ بالادست در برابر ارعاب تو درهم شکستند و به باج‌گیری اعتراف کردند.',
      'دهانه پل برای لحظاتی خالی ماند در حالی که رادمان نگران رسیدن بازرسان بود.',
    ],
    priorActions: [
      'فریاد کشیدن بر سر ساربانان و هدایت شترها با اتکا به مهارت کاروان برای عبور از معبر خالی‌شده',
    ],
    playerActionText: 'بهره‌گیری از سپر چوبی برای گشودن معبر و هدایت شترها از میان دروازه پل',
    resolution: {
      outcome: 'dramatic_success',
      roll: 20,
      targetDC: 9,
      consequenceSummary: 'پیروزی قاطع: عبور کامل کاروان با مهارت استثنایی',
    } as any,
    candidateNarrative: 'فشار سرد باد روی زروان‌رود خیمه زده... صف گزمه‌ها در هم شکسته اما دهانه پل همچنان بسته است.',
    candidateChoices: [
      { id: 'c1', text: 'فریاد کشیدن بر سر ساربانان و هدایت شترها برای عبور از معبر' },
      { id: 'c2', text: 'فریفتن گزمه‌های باقی‌مانده' },
    ],
  };

  it('buildSubQMomentumRequest builds well-formed decision request with state and questions', () => {
    const req = buildSubQMomentumRequest(sampleInput);

    assert.equal(req.model, 'subq-snap-preview');
    assert.equal(typeof req.state, 'object');
    const state = req.state as Record<string, any>;
    assert.equal(state.story.title, 'خاکستر زروان');
    assert.equal(state.resolved_outcome, 'dramatic_success');
    assert.ok(req.questions.story_progressed);
    assert.equal(req.questions.story_progressed.type, 'noul');
    assert.ok(req.questions.has_ignored_success);
    assert.equal(req.questions.has_ignored_success.type, 'noul');
    assert.ok(req.questions.has_choice_recycling);
    assert.equal(req.questions.has_choice_recycling.type, 'noul');
    assert.ok(req.questions.has_repetitive_standoff);
    assert.equal(req.questions.has_repetitive_standoff.type, 'noul');
  });

  it('extractSubQNoul parses various primitive and object answers safely', () => {
    assert.equal(extractSubQNoul(true), true);
    assert.equal(extractSubQNoul(false), false);
    assert.equal(extractSubQNoul({ noul: true }), true);
    assert.equal(extractSubQNoul({ noul: false }), false);
    assert.equal(extractSubQNoul({ answer: 'true' }), true);
    assert.equal(extractSubQNoul({ answer: 'false' }), false);
    assert.equal(extractSubQNoul(undefined, true), true);
  });

  it('extractSubQChoice extracts standard stalling categories', () => {
    assert.equal(extractSubQChoice('none'), 'none');
    assert.equal(extractSubQChoice({ choice: 'ignored_success' }), 'ignored_success');
    assert.equal(extractSubQChoice({ value: 'choice_recycling' }), 'choice_recycling');
    assert.equal(extractSubQChoice({ index: 1 }), 'repetitive_standoff');
    assert.equal(extractSubQChoice(null, 'none'), 'none');
  });

  it('buildMomentumRepairInstruction formats language-aware instructions', () => {
    const faInstruction = buildMomentumRepairInstruction('ignored_success', 'dramatic_success', 'fa');
    assert.ok(faInstruction.includes('پیروزی یا موفقیت قاطع'));
    assert.ok(faInstruction.includes('گذر کامل'));

    const enInstruction = buildMomentumRepairInstruction('ignored_success', 'dramatic_success', 'en');
    assert.ok(enInstruction.includes('decisive outcome'));
    assert.ok(enInstruction.includes('advance the plot'));
  });

  it('evaluateMomentumHeuristics catches choice recycling when candidate choices repeat prior action', () => {
    const recyclingInput: MomentumEvaluationInput = {
      ...sampleInput,
      candidateChoices: [
        { id: 'c1', text: 'فریاد کشیدن بر سر ساربانان و هدایت شترها با اتکا به مهارت کاروان برای عبور از معبر خالی‌شده' },
      ],
    };

    const res = evaluateMomentumHeuristics(recyclingInput);
    assert.equal(res.ok, false);
    assert.equal(res.stallingType, 'choice_recycling');
    assert.ok(res.repairInstruction);
  });

  it('evaluateNarrativeMomentum evaluates clean forward progress via SubQ mock adapter', async () => {
    const mockAdapter = {
      isConfigured: () => true,
      evaluate: async (): Promise<SubQDecisionResponse> => ({
        success: true,
        answers: {
          story_progressed: { noul: true },
          stalling_type: { choice: 'none' },
        },
        model: 'subq-snap-preview',
        latencyMs: 120,
      }),
    } as unknown as SubQAdapter;

    const res = await evaluateNarrativeMomentum(sampleInput, mockAdapter);
    assert.equal(res.ok, true);
    assert.equal(res.stallingType, 'none');
    assert.equal(res.storyProgressed, true);
  });

  it('evaluateNarrativeMomentum evaluates clean forward progress via new SubQ noul questions', async () => {
    const mockAdapter = {
      isConfigured: () => true,
      evaluate: async (): Promise<SubQDecisionResponse> => ({
        success: true,
        answers: {
          story_progressed: { noul: true },
          has_ignored_success: { noul: false },
          has_choice_recycling: { noul: false },
          has_repetitive_standoff: { noul: false },
        },
        model: 'subq-snap-preview',
        latencyMs: 110,
      }),
    } as unknown as SubQAdapter;

    const res = await evaluateNarrativeMomentum(sampleInput, mockAdapter);
    assert.equal(res.ok, true);
    assert.equal(res.stallingType, 'none');
    assert.equal(res.storyProgressed, true);
  });

  it('evaluateNarrativeMomentum flags choice_recycling via noul boolean answer', async () => {
    const mockAdapter = {
      isConfigured: () => true,
      evaluate: async (): Promise<SubQDecisionResponse> => ({
        success: true,
        answers: {
          story_progressed: { noul: false },
          has_ignored_success: { noul: false },
          has_choice_recycling: { noul: true },
          has_repetitive_standoff: { noul: false },
        },
        model: 'subq-snap-preview',
        latencyMs: 95,
      }),
    } as unknown as SubQAdapter;

    const res = await evaluateNarrativeMomentum(sampleInput, mockAdapter);
    assert.equal(res.ok, false);
    assert.equal(res.stallingType, 'choice_recycling');
    assert.equal(res.storyProgressed, false);
    assert.ok(res.repairInstruction?.includes('گزینه‌های پیش‌رو باید کاملاً تازه'));
  });

  it('evaluateNarrativeMomentum flags ignored_success and provides corrective instruction', async () => {
    const mockAdapter = {
      isConfigured: () => true,
      evaluate: async (): Promise<SubQDecisionResponse> => ({
        success: true,
        answers: {
          story_progressed: { noul: false },
          stalling_type: { choice: 'ignored_success' },
        },
        model: 'subq-snap-preview',
        latencyMs: 140,
      }),
    } as unknown as SubQAdapter;

    const res = await evaluateNarrativeMomentum(sampleInput, mockAdapter);
    assert.equal(res.ok, false);
    assert.equal(res.stallingType, 'ignored_success');
    assert.equal(res.storyProgressed, false);
    assert.ok(res.repairInstruction?.includes('پیروزی'));
  });
});
