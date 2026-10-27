import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRtlText, reshapePersianWord, prepareSplineGlyphs } from './persianReshaper';

describe('persianReshaper', () => {
  it('detects Persian / Arabic RTL text correctly', () => {
    assert.equal(isRtlText('رودخانه کارون'), true);
    assert.equal(isRtlText('Hiram Plains'), false);
    assert.equal(isRtlText('River 1'), false);
    assert.equal(isRtlText('صحرای هیرام (Desert)'), true);
  });

  it('correctly shapes Persian cursive letters', () => {
    // "زرین": ز (isolated), ر (isolated), ی (initial), ن (final)
    const shaped = reshapePersianWord('زرین');
    assert.equal(shaped.length, 4);
    // ز isolated: 0xfeaf
    assert.equal(shaped[0].charCodeAt(0), 0xfeaf);
    // ر isolated: 0xfead
    assert.equal(shaped[1].charCodeAt(0), 0xfead);
    // ی initial (Persian): 0xfbfe
    assert.equal(shaped[2].charCodeAt(0), 0xfbfe);
    // ن final: 0xfee6
    assert.equal(shaped[3].charCodeAt(0), 0xfee6);
  });

  it('correctly prepares glyphs for spline march in natural RTL order', () => {
    const res = prepareSplineGlyphs('زرین');
    assert.equal(res.isRtl, true);
    assert.equal(res.glyphs.length, 4);
    // Since glyphs are reversed for LTR march, the last letter of the word (ن_final) comes first in the array
    assert.equal(res.glyphs[0].charCodeAt(0), 0xfee6); // ن final
    assert.equal(res.glyphs[1].charCodeAt(0), 0xfbfe); // ی initial
    assert.equal(res.glyphs[2].charCodeAt(0), 0xfead); // ر isolated
    assert.equal(res.glyphs[3].charCodeAt(0), 0xfeaf); // ز isolated
  });

  it('leaves Latin text in normal order without reshaping', () => {
    const res = prepareSplineGlyphs('River');
    assert.equal(res.isRtl, false);
    assert.deepEqual(res.glyphs, ['R', 'i', 'v', 'e', 'r']);
  });
});
