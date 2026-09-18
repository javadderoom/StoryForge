const fs = require('fs');
const t = fs.readFileSync('web/src/lib/engines/narrative/narrativeTurn.ts', 'utf8').split(/\r?\n/);
console.log(t.slice(85, 268).map((l, i) => 86 + i + ': ' + l).join('\n'));
