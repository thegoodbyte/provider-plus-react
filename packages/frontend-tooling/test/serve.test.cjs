const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const http=require('node:http');
const {createFrontendServer}=require('../serve.cjs');
test('shared static server preserves SPA routing, asset caching, MIME, methods and path boundaries',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'iscz-tooling-'));await fs.mkdir(path.join(root,'assets'));await fs.writeFile(path.join(root,'index.html'),'<main>SPA fixture</main>');await fs.writeFile(path.join(root,'assets','app.js'),'console.log("fixture")');
 const server=createFrontendServer({root});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}`;
 const send=(pathname,method='GET')=>new Promise((resolve,reject)=>{const req=http.request(base,{path:pathname,method},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end();});
 try{
  await t.test('deep links return uncached SPA HTML with nosniff',async()=>{const result=await send('/workflow/ekg');assert.equal(result.status,200);assert.match(result.body,/SPA fixture/);assert.match(result.headers['content-type'],/text\/html/);assert.equal(result.headers['cache-control'],'no-cache');assert.equal(result.headers['x-content-type-options'],'nosniff');});
  await t.test('hashed assets retain immutable caching and JavaScript MIME',async()=>{const result=await send('/assets/app.js');assert.equal(result.status,200);assert.equal(result.headers['cache-control'],'public, max-age=31536000, immutable');assert.equal(result.headers['content-type'],'text/javascript');assert.match(result.body,/fixture/);});
  await t.test('HEAD returns headers without content',async()=>{const result=await send('/assets/app.js','HEAD');assert.equal(result.status,200);assert.equal(result.body,'');});
  await t.test('missing assets are 404 instead of SPA HTML',async()=>assert.equal((await send('/assets/missing.js')).status,404));
  await t.test('POST cannot write to the static server',async()=>assert.equal((await send('/workflow','POST')).status,405));
  await t.test('encoded traversal cannot escape the build directory',async()=>assert.equal((await send('/%2e%2e%2foutside.txt')).status,403));
  await t.test('malformed paths return 404',async()=>assert.equal((await send('/%invalid')).status,404));
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
});
