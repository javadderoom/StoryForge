import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonPayload } from './geminiClient';

describe('extractJsonPayload', () => {
  it('passes clean JSON through untouched', () => {
    assert.equal(extractJsonPayload('{"a":1}'), '{"a":1}');
  });

  it('strips fenced blocks with or without the json tag', () => {
    assert.equal(extractJsonPayload('```json\n{"a":1}\n```'), '{"a":1}');
    assert.equal(extractJsonPayload('```\n{"a":1}\n```\n'), '{"a":1}');
  });

  it('tolerates leading prose and trailing junk', () => {
    assert.equal(
      extractJsonPayload('Sure thing!\n{"a":1}\nHope this helps.'),
      '{"a":1}'
    );
    assert.equal(
      extractJsonPayload('```json\n{"a":1}\n```\nGenerated with care.'),
      '{"a":1}'
    );
  });

  it('returns input unchanged when no brackets exist', () => {
    assert.equal(extractJsonPayload('no json here'), 'no json here');
  });
});
