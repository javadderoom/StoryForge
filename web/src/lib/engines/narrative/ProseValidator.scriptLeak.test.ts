import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProse } from './ProseValidator';

test('actual Persian prose validator rejects Bengali sentinel and accepts Persian control', () => {
  const bengali = '\u09AC\u09BE\u0982\u09B2\u09BE'; // বাংলা
  const rejected = validateProse(bengali, { language: 'fa' });
  assert.ok(rejected.findings.length > 0, 'Bengali must produce findings');
  assert.equal(rejected.ok, false);
  assert.ok(rejected.findings.some((finding) =>
    finding.category === 'script_leak' && finding.severity === 'error'
  ));

  const accepted = validateProse('باد آرام می‌وزد؛ «راه باز است.»', { language: 'fa' });
  assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.findings, []);
});

test('actual Persian prose validator rejects Odia vowel sign U+0B3F', () => {
  const prose = 'به بند کش\u0B3Fده است';
  assert.ok(prose.includes('\u0B3F'), 'fixture must contain the exact Odia code point');
  const result = validateProse(prose, { language: 'fa' });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) =>
    finding.category === 'script_leak' &&
    finding.severity === 'error' &&
    finding.detail.includes('U+0B3F')
  ), 'Odia vowel sign must produce a script_leak finding identifying U+0B3F');
});

