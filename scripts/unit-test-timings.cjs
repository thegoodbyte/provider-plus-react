const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results', 'unit-timings.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
const result = spawnSync(process.execPath, [
  require.resolve('jest/bin/jest'),
  '--runInBand', '--no-cache', '--json', `--outputFile=${output}`,
  ...process.argv.slice(2),
], { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
