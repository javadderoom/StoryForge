import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONDITION_CATALOG,
  CONDITION_PROSE_PATTERNS,
  closeImplied,
  isTreated,
  kindForTag,
  markTreated,
  normalizeConditions,
  promptVisibleConditions,
  resolveKind,
  tagForKind,
  getConditionEffect,
  computeActiveConditionEffects,
  isConditionEffectsEnabled,
  isConditionReconcilerEnabled,
} from './conditionCatalog';

describe('Plan 17 condition catalog', () => {
  it('maps every catalog kind to its canonical tag', () => {
    for (const def of CONDITION_CATALOG) {
      assert.equal(resolveKind(def.kind).tag, def.tag, def.kind);
      assert.equal(tagForKind(def.kind), def.tag, def.kind);
    }
  });

  it('resolves writer aliases to canonical kinds', () => {
    assert.equal(resolveKind('injury').kind, 'wounded');
    assert.equal(resolveKind('Fatigued').kind, 'exhausted');
    assert.equal(resolveKind('blood_loss').kind, 'bleeding');
    assert.equal(resolveKind('healthy').kind, 'baseline');
  });

  it('stores unknown kinds as raw custom tags', () => {
    const def = resolveKind('moon-touched');
    assert.equal(def.kind, 'custom');
    assert.equal(def.tag, 'moon-touched');
    assert.equal(resolveKind('  ').tag, 'حالت ناشناخته');
  });

  it('resolves canonical and treated tags back to their definition', () => {
    assert.equal(kindForTag('زخمی')?.kind, 'wounded');
    assert.equal(kindForTag('زخمی (پانسمان‌شده)')?.kind, 'wounded');
    assert.equal(kindForTag('خونریزی')?.kind, 'bleeding');
    assert.equal(kindForTag('مسموم (پادزهرخورده)')?.kind, 'poisoned');
    assert.equal(kindForTag('یک حالت کاملاً دلخواه'), null);
  });

  it('detects treated markers in both languages', () => {
    assert.equal(isTreated('زخمی (پانسمان‌شده)'), true);
    assert.equal(isTreated('زخمی (درمان‌شده)'), true);
    assert.equal(isTreated('wound (bandaged)'), true);
    assert.equal(isTreated('زخمی'), false);
    assert.equal(isTreated('خونریزی'), false);
  });

  it('markTreated is idempotent and falls back to a generic suffix', () => {
    assert.equal(markTreated('زخمی'), 'زخمی (پانسمان‌شده)');
    assert.equal(markTreated('زخمی (پانسمان‌شده)'), 'زخمی (پانسمان‌شده)');
    assert.equal(markTreated('زخم کهنهٔ پهلو'), 'زخم کهنهٔ پهلو (درمان‌شده)');
  });

  it('closes implication rules and drops the baseline beside body conditions', () => {
    assert.deepEqual(closeImplied(['خونریزی']), ['خونریزی', 'زخمی']);
    assert.deepEqual(closeImplied(['تندرست']), ['تندرست']);
    assert.deepEqual(closeImplied(['تندرست', 'زخمی']), ['زخمی']);
    assert.deepEqual(closeImplied(['خسته', 'خسته']), ['خسته']);
  });

  it('normalizes stored lists: folds aliases, keeps custom tags, de-dupes', () => {
    assert.deepEqual(normalizeConditions(['ووند', 'خسته']), ['ووند', 'خسته']);
    assert.deepEqual(normalizeConditions(['wounded', 'خونریزی']), ['زخمی', 'خونریزی']);
    assert.deepEqual(normalizeConditions(['', '  ', 'گیج']), ['گیج']);
  });

  it('hides prompt-silent baseline conditions from prompt injection', () => {
    assert.deepEqual(promptVisibleConditions(['تندرست', 'زخمی']), ['زخمی']);
    assert.deepEqual(promptVisibleConditions(['تندرست']), []);
    assert.deepEqual(promptVisibleConditions(undefined), []);
  });

  it('prose patterns match representative EN/FA evidence', () => {
    assert.ok(CONDITION_PROSE_PATTERNS.wound.test('A gash opens along your forearm.'));
    assert.ok(CONDITION_PROSE_PATTERNS.wound.test('زخم عمیقی بر بازوی تو می‌نشیند.'));
    assert.ok(CONDITION_PROSE_PATTERNS.bleeding.test('Blood drips between your fingers.'));
    assert.ok(CONDITION_PROSE_PATTERNS.bleeding.test('خون‌ریزی بند نمی‌آید.'));
    assert.ok(CONDITION_PROSE_PATTERNS.treatment.test('You bind the wound with a strip of cloth.'));
    assert.ok(CONDITION_PROSE_PATTERNS.treatment.test('زخم را با باند می‌پوشانی.'));
    assert.ok(CONDITION_PROSE_PATTERNS.healing.test('The gash has healed over.'));
    assert.ok(CONDITION_PROSE_PATTERNS.healing.test('زخم التیام یافته است.'));
    assert.ok(CONDITION_PROSE_PATTERNS.exhaustion.test('You are exhausted, breathless.'));
    assert.ok(CONDITION_PROSE_PATTERNS.thirst.test('Your throat is parched.'));
    assert.ok(CONDITION_PROSE_PATTERNS.negation.test('You are unharmed, without a scratch.'));
    assert.ok(CONDITION_PROSE_PATTERNS.negation.test('بدون زخم از میدان بیرون آمدی.'));
  });

  it('does not fire wound patterns on unrelated prose', () => {
    assert.equal(CONDITION_PROSE_PATTERNS.wound.test('You slice the bread and eat quietly.'), false);
    assert.equal(CONDITION_PROSE_PATTERNS.bleeding.test('The wine is blood-red.'), false);
  });

  it('declares deterministic mechanical effects per Plan 17 table §3.9', () => {
    // Untreated wound: +25% stamina cost
    const woundEffect = getConditionEffect('زخمی');
    assert.equal(woundEffect?.staminaCostMultiplier, 1.25);

    // Treated wound: +10% stamina cost
    const treatedWoundEffect = getConditionEffect('زخمی (پانسمان‌شده)');
    assert.equal(treatedWoundEffect?.staminaCostMultiplier, 1.10);

    // Exhausted: -1 to physical stat checks
    const exhaustedEffect = getConditionEffect('خسته');
    assert.equal(exhaustedEffect?.statModifierDelta, -1);

    // Thirsty: +1 threat clock segment on desert travel
    const thirstyEffect = getConditionEffect('تشنه');
    assert.equal(thirstyEffect?.threatClockExtraTicks, 1);

    // Baseline: no mechanical penalties
    const baselineEffect = getConditionEffect('تندرست');
    assert.equal(baselineEffect, undefined);

    // Aggregated computeActiveConditionEffects
    const active = computeActiveConditionEffects(['زخمی', 'خسته', 'تشنه'], {
      isPhysicalStat: true,
      isDesertOrHarsh: true,
    });
    assert.equal(active.staminaCostMultiplier, 1.25);
    assert.equal(active.statModifierDelta, -1);
    assert.equal(active.threatClockExtraTicks, 1);

    // When stat is non-physical, statModifierDelta is 0
    const mentalCheck = computeActiveConditionEffects(['خسته'], { isPhysicalStat: false });
    assert.equal(mentalCheck.statModifierDelta, 0);

    // Feature flags follow env
    assert.equal(isConditionEffectsEnabled({ ENABLE_CONDITION_EFFECTS: 'false' }), false);
    assert.equal(isConditionEffectsEnabled({ ENABLE_CONDITION_EFFECTS: 'true' }), true);
    assert.equal(isConditionEffectsEnabled({}), true);

    assert.equal(isConditionReconcilerEnabled({ ENABLE_CONDITION_RECONCILER: 'false' }), false);
    assert.equal(isConditionReconcilerEnabled({ ENABLE_CONDITION_RECONCILER: 'true' }), true);
    assert.equal(isConditionReconcilerEnabled({}), true);
  });
});

