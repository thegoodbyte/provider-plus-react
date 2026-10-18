import assert from 'node:assert/strict';
/** Load the caller's real Vite config and verify its public configuration contract. */
export async function checkViteConfig(loadConfigFromFile) {
  const values = { REACT_APP_API_URL: 'https://api.dev.example.test', INTERNAL_DATABASE_PASSWORD: 'must-not-be-exposed', PUBLIC_URL: '/portal', NODE_ENV: 'production' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
    const config = loaded.config;
    const exposed = JSON.parse(config.define['process.env']);
    assert.equal(exposed.REACT_APP_API_URL, values.REACT_APP_API_URL);
    assert.equal(exposed.NODE_ENV, 'production');
    assert.equal(exposed.PUBLIC_URL, '/portal');
    assert.equal(exposed.INTERNAL_DATABASE_PASSWORD, undefined);
    assert.equal(JSON.stringify(config.define).includes(values.INTERNAL_DATABASE_PASSWORD), false);
    assert.equal(config.base, '/portal/');
    assert.equal(config.build.outDir, 'build');
    console.log('Vite environment, public URL, secret isolation, and output checks passed.');
  } finally {
    for (const [key,value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
