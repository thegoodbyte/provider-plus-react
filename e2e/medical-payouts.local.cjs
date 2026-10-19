// Run from the shared workspace after starting the isolated API fixture and built admin preview.
// node ppvc-761-admin/e2e/medical-payouts.local.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const fixture=JSON.parse(fs.readFileSync('ppvc-761-validation/fixture.json'));
(async()=>{const browser=await chromium.launch({headless:true});const results=[];
try{for(const {width,retreat} of fixture.browserRetreats){
 const origin='http://127.0.0.1:43761';const context=await browser.newContext({viewport:{width,height:1100}});const page=await context.newPage();const errors=[],writes=[];let loseResponse=width===1440;
 page.setDefaultTimeout(12000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'fixture-admin',email:'admin@example.test',role:'admin'}));},fixture.tokens.admin);
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(!['fetch','xhr'].includes(req.resourceType()))return url.origin===origin||url.protocol==='data:'?route.continue():route.abort();
  console.log(req.method(),url.pathname);const path=url.pathname.replace(/^\/api(?=\/)/,'');
  if(path.startsWith('/medical-payouts/')||path.startsWith('/retreat-expenses/')){
   const response=await fetch(fixture.base+path+url.search,{method:req.method(),headers:{'Content-Type':'application/json',Authorization:'Bearer '+fixture.tokens.admin},...(!['GET','HEAD'].includes(req.method())?{body:req.postData()}: {})});
   console.log('FINANCIAL RESPONSE',response.status,path);if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(path);
   if(loseResponse&&path.endsWith('/payments')&&response.status===201){loseResponse=false;return route.abort('connectionreset');}
   return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  }
  assert(['GET','HEAD','OPTIONS'].includes(req.method()),'Unexpected nonfinancial write: '+path);
  let data=[];if(path===`/retreats/${retreat._id}`)data=retreat;else if(path==='/retreats')data=[retreat];
  else if(/config-summary|navigation-permissions|plan-settings|environment\/status/.test(path))data={};
  else if(path.includes('unread-count'))data={count:0};else if(path.includes('/auth/profile'))data={id:'fixture-admin',role:'admin',email:'admin@example.test'};
  return route.fulfill({json:data});
 });
 await page.goto(origin+`/admin/retreats/${retreat._id}/expenses`,{waitUntil:'domcontentloaded'});console.log('PAGE LOADED');
 const panel=page.getByRole('region',{name:'Medical fees and payouts'});await panel.getByText('Current estimate',{exact:true}).waitFor({timeout:20000}).catch(async e=>{fs.writeFileSync('ppvc-761-validation/debug.txt',await page.locator('body').innerText());await page.screenshot({path:'ppvc-761-validation/debug.png'});throw e;});
 await panel.getByRole('button',{name:'Review calculation',exact:true}).click();fs.writeFileSync('ppvc-761-validation/review-debug.txt',await panel.innerText());await panel.getByLabel('Payout recipient').selectOption(fixture.recipientId);await panel.getByRole('button',{name:'Approve medical fee',exact:true}).click();
 await panel.getByRole('button',{name:'Record medical payment',exact:true}).click();await panel.getByLabel('Fee amount applied (USD)').fill(width===1440?'50':'200');await panel.getByRole('button',{name:'Confirm recorded payment'}).click();
 if(width===1440){await panel.getByRole('button',{name:'Retry same payment'}).click();}
 await panel.getByText('Payment recorded in Expenses.',{exact:true}).waitFor();
 await page.reload();await panel.getByText('Current estimate',{exact:true}).waitFor();
 assert.equal(await panel.locator('.medical-fee-history article').count(),1);
 if(width===1440){
  assert((await panel.locator('.medical-fee-metrics').innerText()).includes('$150.00'));
  await panel.getByRole('button',{name:'Record medical payment',exact:true}).click();await panel.getByRole('button',{name:'Confirm recorded payment'}).click();await panel.getByText('Payment recorded in Expenses.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Void incorrect payment'}).last().click();await panel.getByLabel('Reason for voiding payment').fill('Correct synthetic payment entry');await panel.getByRole('button',{name:'Confirm void',exact:true}).click();await panel.getByText('Payment voided; original history retained.',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Record medical payment',exact:true}).click();await panel.getByRole('button',{name:'Confirm recorded payment'}).click();await panel.getByText('Payment recorded in Expenses.',{exact:true}).waitFor();
 }
 await page.reload();await panel.getByText('Current estimate',{exact:true}).waitFor();assert((await panel.locator('.medical-fee-metrics').innerText()).includes('$0.00'));
 const boxes=await panel.locator('.medical-fee-metrics > div').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));assert.equal(boxes.length,4);
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert(!(Math.min(boxes[i].right,boxes[j].right)>Math.max(boxes[i].x,boxes[j].x)+1&&Math.min(boxes[i].bottom,boxes[j].bottom)>Math.max(boxes[i].y,boxes[j].y)+1),'Metric cards overlap');
 await page.waitForLoadState('networkidle');await panel.scrollIntoViewIfNeeded();await page.screenshot({path:`ppvc-761-validation/admin-${width}.png`,fullPage:true});fs.writeFileSync(`ppvc-761-validation/browser-${width}.txt`,await page.locator('body').innerText());assert.deepEqual(errors,[]);
 const response=await fetch(fixture.base+`/medical-payouts/retreat/${retreat._id}`,{headers:{Authorization:'Bearer '+fixture.tokens.admin}});const summary=await response.json();assert.equal(summary.paidAmount,200);assert.equal(summary.remainingAmount,0);assert.equal(summary.history.length,width===1440?3:1);
 results.push({width,passed:true,realFinancialApi:true,reload:true,partialPayment:width===1440,lostResponseRetry:width===1440,voidAndReplacement:width===1440,writes});await context.close();
 }fs.writeFileSync('ppvc-761-validation/browser.json',JSON.stringify({passed:true,results,scope:'Built admin with real isolated Mongo/Nest/JWT financial routes; unrelated retreat shell APIs stubbed; no production calls'},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
