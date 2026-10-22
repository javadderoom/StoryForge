import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StreamingJsonNarrativeExtractor } from './streamingExtractor';

describe('StreamingJsonNarrativeExtractor', () => {
  it('extracts Persian narrative tokens seamlessly as they arrive', () => {
    const extractor = new StreamingJsonNarrativeExtractor();
    const deltas: string[] = [];

    const chunks = [
      '{\n  ',
      '"narrative": "کاروان ',
      'در میان ',
      'غبار سرخ ',
      'هیرام پیش می‌رود.\\n\\nباد سرد ',
      'بر چهره‌ات تازیانه می‌زند."',
      ',\n  "extractedMemories": []\n}',
    ];

    for (const chunk of chunks) {
      extractor.pushChunk(chunk, (delta) => deltas.push(delta));
    }

    assert.equal(extractor.isNarrativeComplete(), true);
    assert.equal(
      extractor.getNarrativeText(),
      'کاروان در میان غبار سرخ هیرام پیش می‌رود.\n\nباد سرد بر چهره‌ات تازیانه می‌زند.'
    );
    assert.equal(deltas.join(''), extractor.getNarrativeText());
  });

  it('handles chunk boundary directly splitting an escape sequence', () => {
    const extractor = new StreamingJsonNarrativeExtractor();
    const deltas: string[] = [];

    // Split right on '\' and 'n'
    const chunks = [
      '{"narrative": "خط اول\\',
      'nخط دوم با علامت \\"',
      'نقل‌قول\\""}',
    ];

    for (const chunk of chunks) {
      extractor.pushChunk(chunk, (delta) => deltas.push(delta));
    }

    assert.equal(extractor.isNarrativeComplete(), true);
    assert.equal(extractor.getNarrativeText(), 'خط اول\nخط دوم با علامت "نقل‌قول"');
  });

  it('preserves full raw stream for JSON parsing at completion', () => {
    const extractor = new StreamingJsonNarrativeExtractor();
    const jsonStr = '{"narrative": "Test prose", "extractedMemories": [{"summary": "Saw caravan"}]}';

    extractor.pushChunk(jsonStr, () => {});

    assert.equal(extractor.getFullRawText(), jsonStr);
    assert.equal(extractor.getNarrativeText(), 'Test prose');
  });
});
