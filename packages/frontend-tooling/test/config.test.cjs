const {test}=require('node:test');const assert=require('node:assert/strict');
test('public environment contract excludes secrets and keeps deployed legacy variables',async()=>{
 const {frontendConfig}=await import('../config.mjs');
 const plugin={name:'react-fixture'};
 const config=frontendConfig({PUBLIC_URL:'/portal',REACT_APP_API_URL:'https://api.example.test',INTERNAL_DATABASE_PASSWORD:'private',PORT:'4321',CHOKIDAR_USEPOLLING:'true',GENERATE_SOURCEMAP:'true'},plugin,'production');
 assert.deepEqual(JSON.parse(config.define['process.env']),{REACT_APP_API_URL:'https://api.example.test',NODE_ENV:'production',PUBLIC_URL:'/portal'});
 assert.deepEqual(config.plugins,[plugin]);assert.equal(config.base,'/portal/');assert.equal(config.server.port,4321);assert.equal(config.server.watch.usePolling,true);assert.equal(config.build.sourcemap,true);assert.equal(config.build.outDir,'build');assert.equal(config.build.manifest,true);
 assert.deepEqual(config.build.target,['chrome107','edge107','firefox104','safari16']);
});
test('default and slash-terminated public bases preserve the existing app contract',async()=>{
 const {frontendConfig}=await import('../config.mjs');
 assert.equal(frontendConfig({},null,'development').base,'/');assert.equal(JSON.parse(frontendConfig({},null,'development').define['process.env']).PUBLIC_URL,'');
 assert.equal(frontendConfig({PUBLIC_URL:'/portal/'},null).base,'/portal/');assert.equal(frontendConfig({},null).server.port,3000);assert.equal(frontendConfig({},null).build.sourcemap,false);
});
test('configuration checker restores environment even when a consuming config is broken',async()=>{
 const {checkViteConfig}=await import('../check-config.mjs');const before={...process.env};
 await assert.rejects(()=>checkViteConfig(async()=>{throw new Error('broken config');}),/broken config/);
 assert.deepEqual({...process.env},before);
});
test('configuration checker rejects an accidentally exposed server secret',async()=>{
 const {checkViteConfig}=await import('../check-config.mjs');const {frontendConfig}=await import('../config.mjs');
 await assert.rejects(()=>checkViteConfig(async()=>{const config=frontendConfig({...process.env},null);config.define['process.env']=JSON.stringify(process.env);return{config};}));
});
