import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.SCRATCHPAD_FIXTURE_PATH;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable scratchpad API fixture.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390]) for(const flow of ['link','convert']) test(`scratchpad ${flow} and date correction at ${width}px`,async({page,request})=>{
 await request.post(f.url+'/fixture/reset');const headers={Authorization:'Bearer '+f.token};
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();
 await page.setViewportSize({width,height:980});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'scratchpad@example.invalid'}));},f.token);
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const url=new URL(r.url());
  if(url.pathname.startsWith('/payment-scratchpad')||['/clients','/bookings','/payment-requests'].includes(url.pathname)){const response=await route.fetch({url:f.url+url.pathname+url.search});return route.fulfill({response});}
  if(url.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});if(url.pathname.includes('config-summary'))return route.fulfill({json:{}});return route.fulfill({json:[]});
 });
 const dismiss=async()=>{const button=page.getByRole('button',{name:'Dismiss loading message'});if(await button.isVisible())await button.click();};
 let id:string;
 if(flow==='link'){
  await page.goto('/admin/payments/scratchpad/new?status=all');await page.getByLabel('Amount received').fill('5100.00');await page.getByLabel('Payer name (optional)').fill('Synthetic exact match');await page.getByLabel('Payment request number (optional)').fill('001243');await page.getByLabel('Phone number (optional)').fill('+420 777 123 456');await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page).toHaveURL(/scratchpad\/[a-f0-9]{24}\?/);id=page.url().match(/scratchpad\/([a-f0-9]{24})/)![1];
  const before=await snapshot();await dismiss();await page.getByRole('button',{name:'Payment from SP',exact:true}).click();const dialog=page.getByRole('dialog');await expect(page.getByRole('dialog',{name:'Link to an existing payment'})).toBeVisible();await dialog.getByRole('button',{name:'Clear payment filters',exact:true}).click();await dialog.getByRole('checkbox',{name:'Select payment #1904',exact:true}).check();await expect(dialog.getByRole('link',{name:'View linked request',exact:true})).toHaveAttribute('href','/admin/payment-requests/'+f.requestId);
  const approve=dialog.getByRole('button',{name:'Confirm link to existing payment',exact:true});await expect(approve).toBeDisabled();expect((await snapshot()).scratchpad.find((row:any)=>row._id===id).status).toBe('unassigned');expect((await snapshot()).payments).toHaveLength(before.payments.length);
  await dialog.getByRole('checkbox',{name:/I checked the original transaction/}).check();await approve.click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit received date',exact:true})).toBeVisible();const after=await snapshot();expect(after.payments).toHaveLength(before.payments.length);expect(after.receipts).toHaveLength(before.receipts.length);expect(after.scratchpad.find((row:any)=>row._id===id).status).toBe('converted');await page.getByRole('button',{name:'Edit received date',exact:true}).click();
 }else{
  const captured=await(await request.post(f.url+'/payment-scratchpad',{headers,data:{captureKey:crypto.randomUUID(),receivedDate:'2026-10-16',amount:'25.00',currency:'PLN',provider:'csob',payer:'Synthetic converted'}})).json();id=captured._id;
  const result=await request.post(f.url+'/payment-scratchpad/'+id+'/reconcile',{headers,data:{revision:captured.revision,action:'convert',clientId:f.clientId,confirm:true}});expect(result.status()).toBe(201);await page.goto('/admin/payments/scratchpad/'+id+'/edit?status=all');
 }
 const before=await snapshot();const row=before.scratchpad.find((r:any)=>r._id===id);const payment=before.payments.find((p:any)=>p._id===row.paymentId);
 await expect(page.getByRole('heading',{name:'Correct received date',exact:true})).toBeVisible();await expect(page.getByLabel('Amount received')).toHaveCount(0);await page.getByLabel('Correct received date',{exact:true}).fill('2026-10-17');await page.getByLabel('Reason for date correction').fill('Verified against original bank statement');await dismiss();await page.getByRole('button',{name:'Save date correction',exact:true}).click();await expect(page.getByText(/Received date corrected on the scratchpad/)).toBeVisible();
 const after=await snapshot();const changed=after.payments.find((p:any)=>p._id===payment._id);expect(after.payments).toHaveLength(before.payments.length);expect(after.receipts).toHaveLength(before.receipts.length);expect(after.scratchpad.find((r:any)=>r._id===id).receivedDate).toBe('2026-10-17');expect(changed.paymentDate.slice(0,10)).toBe('2026-10-17');expect(after.receipts.find((r:any)=>r._id===payment.receiptId).receivedDate.slice(0,10)).toBe('2026-10-17');for(const field of ['amount','currency','clientId','bookingId','paymentRequestId','sourceScratchpadId','receivingAccount'])expect(changed[field]).toEqual(payment[field]);
 await page.reload();await expect(page.getByRole('button',{name:'Edit received date',exact:true})).toBeVisible();await page.screenshot({path:`../ppvc-904-905-validation/${flow}-${width}.png`,fullPage:true});
});
