const fs = require('fs');
const p = 'src/lib/evals/evaluator.ts';
const t = fs.readFileSync(p, 'utf8').split('\n');
t.splice(179, 0, '  // --- Outcome adherence --------------------------------------------------', "  const outcome = exp.outcome;");
fs.writeFileSync(p, t.join('\n'));
console.log('restored outcome header');
