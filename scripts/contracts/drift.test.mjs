import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync}from 'node:child_process';import {fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('checks are reproducible, fail on generated or upstream drift and never rewrite files',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'contract-drift-test-'));
 try{
  fs.cpSync(path.join(root,'contracts'),path.join(temp,'contracts'),{recursive:true});fs.cpSync(path.join(root,'src/generated/contracts'),path.join(temp,'src/generated/contracts'),{recursive:true});
  const run=(...args)=>spawnSync(process.execPath,[path.join(root,'scripts/contracts/generate.mjs'),'--check',...args],{env:{...process.env,CONTRACTS_PROJECT_ROOT:temp},encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stdout+first.stderr);
  const generated=path.join(temp,'src/generated/contracts/shared/domain.ts'),original=fs.readFileSync(generated,'utf8');fs.writeFileSync(generated,original+'\n// drift\n');let result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/drift/);assert(fs.readFileSync(generated,'utf8').endsWith('// drift\n'),'check must not repair drift silently');fs.writeFileSync(generated,original);
  const upstream=path.join(temp,'upstream');fs.cpSync(path.join(temp,'contracts'),path.join(upstream,'contracts'),{recursive:true});const manifestFile=path.join(upstream,'contracts/manifest.json');const manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.release='different';fs.writeFileSync(manifestFile,JSON.stringify(manifest));result=run('--api',upstream);assert.notEqual(result.status,0);assert.match(result.stderr,/API\/admin contract drift/);
  const vendor=path.join(temp,'contracts/shared/domain.ts');fs.appendFileSync(vendor,'\n// tampered\n');result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/checksum mismatch/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
