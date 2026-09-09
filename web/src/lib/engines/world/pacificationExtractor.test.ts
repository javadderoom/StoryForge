import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPacificationEntities,
  isVerbPhrase,
  resolveSuggestedCategory,
} from './pacificationExtractor';

describe('Pacification Entity Extractor — ghost-species false positives', () => {
  it('rejects the reported verb phrase "برای سرگرم کردن"', () => {
    const results = extractPacificationEntities('تعارف گوشت تازه برای سرگرم کردن جانور');
    const names = results.map((r) => r.name);
    assert.ok(!names.includes('برای سرگرم کردن'), `leaked verb phrase: ${names.join(', ')}`);
    assert.ok(!names.includes('سرگرم کردن'), `leaked verb phrase: ${names.join(', ')}`);
  });

  it('rejects trapping / calming verb phrases', () => {
    assert.deepEqual(extractPacificationEntities('به دام انداختن با تور'), []);
    assert.deepEqual(extractPacificationEntities('آرام شدن در برابر دود'), []);
  });

  it('still extracts legitimate flora and mineral entities', () => {
    const flora = extractPacificationEntities('پاشیدن پودر «نیلوفر مردابی» بر روی زمین');
    assert.ok(
      flora.some((r) => r.name === 'نیلوفر مردابی' && r.category === 'flora'),
      `missing flora: ${JSON.stringify(flora)}`
    );
    const mineral = extractPacificationEntities('استخراج نمک معدنی از غار');
    assert.ok(
      mineral.some((r) => r.name === 'نمک معدنی' && r.category === 'mineral'),
      `missing mineral: ${JSON.stringify(mineral)}`
    );
  });

  it('classifies verb phrases vs entity names', () => {
    assert.equal(isVerbPhrase('سرگرم کردن'), true);
    assert.equal(isVerbPhrase('به دام انداختن'), true);
    assert.equal(isVerbPhrase('آرام شدن'), true);
    assert.equal(isVerbPhrase('نیلوفر مردابی'), false);
    assert.equal(isVerbPhrase('نمک معدنی'), false);
    // ZWNJ-joined reagent nouns must survive (single token, not a verb)
    assert.equal(isVerbPhrase('دم‌کرده'), false);
  });

  it('resolves suggested categories', () => {
    assert.equal(resolveSuggestedCategory('نمک معدنی'), 'mineral');
    assert.equal(resolveSuggestedCategory('گون کوهی'), 'flora');
    assert.equal(resolveSuggestedCategory('شاهین تیزپرواز'), 'beast');
  });
});
