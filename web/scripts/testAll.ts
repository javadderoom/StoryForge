import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Explicit discovery avoids shell-dependent ** expansion and stale test lists.
function discover(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? discover(path) : entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

const tests = discover(resolve('src')).sort();
if (!tests.length) throw new Error('No test files discovered under src.');
console.log(`Discovered ${tests.length} test files.`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
