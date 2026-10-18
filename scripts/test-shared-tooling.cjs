const { dirname } = require('node:path');
const { spawnSync } = require('node:child_process');
// Node's test discovery skips paths beneath node_modules; run from the package cwd.
const result = spawnSync(process.execPath, ['--test', 'test/config.test.cjs', 'test/serve.test.cjs'], {
  cwd: dirname(require.resolve('@ibogaspirit/frontend-tooling/package.json')), stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
