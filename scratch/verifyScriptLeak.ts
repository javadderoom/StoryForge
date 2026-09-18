import assert from 'node:assert/strict';
import { validateProse } from '../web/src/lib/engines/narrative/ProseValidator';

for (const glyph of ['\u09BE', '\u0B3F']) {
  const result = validateProse(`در تاریکی ${glyph} قدم می‌زنی.`, { language: 'fa' });
  const codePoint = `U+${glyph.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
  assert.equal(result.ok, false, `${codePoint} must be rejected`);
  assert.ok(result.findings.some((finding) =>
    finding.category === 'script_leak' && finding.severity === 'error'
  ), `${codePoint} must produce a script_leak error`);
  console.log(`PASS: ${codePoint} rejected with script_leak`);
}
assert.equal(validateProse('در تاریکی قدم می‌زنی؛ «آرام باش!»', { language: 'fa' }).ok, true);
console.log('PASS: valid Persian punctuation and joiners accepted');
