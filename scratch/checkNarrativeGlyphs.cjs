const fs = require('node:fs');
const p = 'g:/Code/StoryForge/scratch/story-out.txt';
if (!fs.existsSync(p)) {
  console.log('MISSING_ARTIFACT: ' + p);
  console.log('Historical script contamination cannot be re-established from this file.');
  process.exitCode = 2;
} else {
  const text = fs.readFileSync(p, 'utf8');
  const sentinel = '\u09AC\u09BE\u0982\u09B2\u09BE';
  const bengali = [...new Set(text.match(/[\u0980-\u09FF]/gu) || [])];
  const odia = text.includes('\u0B3F');
  console.log(JSON.stringify({
    artifact: p,
    exactBengaliSentinel: text.includes(sentinel),
    bengaliCodepoints: bengali.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase()),
    odiaU0B3F: odia,
  }, null, 2));
  if (!text.includes(sentinel) && !bengali.length && !odia) process.exitCode = 1;
}
