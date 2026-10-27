import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParagraphs } from './proseParagraphs';

const BLOCK = '\n\n';

const LONG_BLOB =
  'You drive your shoulder into the swollen door and the hinge shrieks once before it gives. ' +
  'Cold air rushes past you, carrying the smell of wet stone and something older beneath it. ' +
  'Somewhere below, a chain drags across the floor and stops. ' +
  'You count three breaths in the dark while your eyes adjust. ' +
  'A pale light leaks from under the next door. ' +
  'It pulses, slow and steady, like something breathing on the other side.';

describe('normalizeParagraphs', () => {
  it('leaves prose under the minimum untouched', () => {
    const short = 'You step into the light. The gate is open.';
    assert.equal(normalizeParagraphs(short), short);
  });

  it('splits an unbroken block into balanced paragraph blocks', () => {
    const blocks = normalizeParagraphs(LONG_BLOB).split(BLOCK);
    assert.equal(blocks.length, 2);
    assert.ok(blocks.every((b) => b.split(/\s+/).filter(Boolean).length >= 3));
    // No content is lost or reordered by the split.
    assert.equal(normalizeParagraphs(LONG_BLOB).replace(/\s+/g, ' '), LONG_BLOB.replace(/\s+/g, ' '));
  });

  it('never splits inside quotation marks', () => {
    const text =
      'The sentry lifts his lantern and the flame gutters against the rain. ' +
      '"Stop. Now." His voice cracks on the second word, and the spear in his other hand trembles. ' +
      'You keep your hands where he can see them and step into the light. ' +
      'The gate behind him stands half open, and beyond it a courtyard full of sleeping men.';
    const result = normalizeParagraphs(text);
    assert.ok(result.includes('"Stop. Now."'), 'quoted dialogue must survive intact');
    assert.equal(result.split(BLOCK).length, 2);
  });

  it('canonicalises existing separators without re-splitting', () => {
    assert.equal(normalizeParagraphs('One beat.\nTwo beat.'), `One beat.${BLOCK}Two beat.`);
    assert.equal(normalizeParagraphs(`One beat.${BLOCK}\n\nTwo beat.`), `One beat.${BLOCK}Two beat.`);
  });

  it('honours a custom minimum', () => {
    const text = 'First line lands hard. Second line follows it. Third line closes the door.';
    assert.equal(normalizeParagraphs(text), text);
    assert.equal(normalizeParagraphs(text, { minWords: 10 }).split(BLOCK).length, 2);
  });
});
