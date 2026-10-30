const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
(async()=>{
 if(!process.env.ITEMIZED_INVOICE_API_CHECKOUT)throw Error('Set ITEMIZED_INVOICE_API_CHECKOUT to a built API checkout; MongoDB is required.');
 process.env.APP_ENV='production';
 const {createFixture}=require(path.resolve(process.env.ITEMIZED_INVOICE_API_CHECKOUT,'test/invoice-drafts.fixture.cjs'));
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'itemized-invoice-'));let f,server;
 try{
 f=await createFixture();await f.app.listen(0,'127.0.0.1');fs.writeFileSync(path.join(folder,'fixture.json'),JSON.stringify({url:'http://127.0.0.1:'+f.app.getHttpServer().address().port,ids:f.ids,tokens:f.tokens}));
 const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 server=await(await import('vite')).createServer({server:{host:'127.0.0.1',port}});await server.listen();
 const child=spawn(process.execPath,[require.resolve('@playwright/test/cli'),'test','e2e/itemized-invoice.spec.ts','--project=chromium','--workers=1','--retries=0','--reporter=line'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_SKIP_WEB_SERVER:'1',PLAYWRIGHT_BASE_URL:'http://127.0.0.1:'+server.httpServer.address().port,ITEMIZED_INVOICE_FIXTURE:path.join(folder,'fixture.json')}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(c,s)=>resolve(s?1:c))});if(code)throw Error('Itemized invoice browser regression failed: '+code);
 }finally{if(server)await server.close();if(f)await f.close();fs.rmSync(folder,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
