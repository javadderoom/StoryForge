const t = require('fs').readFileSync('g:/Code/StoryForge/scratch/unrun.txt', 'utf8');
const lines = t.split(/\r?\n/);
console.log(lines.filter((l) => /^# (pass|fail|tests|cancelled|skipped)/.test(l)).join('\n'));
console.log('--- not ok ---');
const bad = lines.filter((l) => /^not ok/.test(l));
console.log(bad.length ? bad.slice(0, 25).join('\n') : '(none)');