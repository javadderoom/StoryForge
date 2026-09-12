import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { segmentProse } from './dialogueSegments';

describe('segmentProse: narrative vs dialogue', () => {
  it('splits Persian guillemet dialogue from narration', () => {
    const segs = segmentProse('باد زوزه می‌کشید. او گفت: «فرار کن!» و دوید.');
    assert.equal(segs.length, 3);
    assert.equal(segs[0].type, 'narrative');
    assert.equal(segs[1].type, 'dialogue');
    assert.equal(segs[1].text, 'فرار کن!');
    assert.equal(segs[2].type, 'narrative');
  });

  it('handles English double-quoted speech', () => {
    const segs = segmentProse('She whispered, "Run now," and vanished.');
    assert.deepEqual(
      segs.map((s) => s.type),
      ['narrative', 'dialogue', 'narrative']
    );
    assert.equal(segs[1].text, 'Run now,');
  });

  it('treats dash-led lines as dialogue', () => {
    const segs = segmentProse('سکوت شد.\n— کی آنجاست؟\nهیچ‌کس جواب نداد.');
    assert.deepEqual(
      segs.map((s) => s.type),
      ['narrative', 'dialogue', 'narrative']
    );
  });

  it('styles unterminated quotes as dialogue', () => {
    const segs = segmentProse('او فریاد زد: «به عقب برگردید');
    assert.equal(segs[segs.length - 1].type, 'dialogue');
  });

  it('returns pure narrative untouched', () => {
    const segs = segmentProse('شبی تاریک و طوفانی بود.');
    assert.equal(segs.length, 1);
    assert.equal(segs[0].type, 'narrative');
  });
});
