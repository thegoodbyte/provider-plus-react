const {spawn}=require('node:child_process');
(async()=>{let server;try{
 const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})});
 server=await(await import('vite')).createServer({server:{host:'127.0.0.1',port}});await server.listen();
 const child=spawn(process.execPath,[require.resolve('@playwright/test/cli'),'test','e2e/scratchpad-totals-overlay.spec.ts','--project=chromium','--workers=1','--retries=0','--reporter=line'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_SKIP_WEB_SERVER:'1',PLAYWRIGHT_BASE_URL:'http://127.0.0.1:'+server.httpServer.address().port}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(c,s)=>resolve(s?1:c))});if(code)throw Error('Scratchpad totals browser checks failed: '+code);
 }finally{if(server)await server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
