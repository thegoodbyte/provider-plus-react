import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.SCRATCHPAD_FIXTURE_PATH;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires isolated real scratchpad API/Mongo fixture');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])test(`correct reconciled amount currency and date with one reason at ${width}px`,async({page,request})=>{
 await request.post(f.url+'/fixture/reset');const headers={Authorization:'Bearer '+f.token};
 const created=await request.post(f.url+'/payment-scratchpad',{headers,data:{captureKey:crypto.randomUUID(),receivedDate:'2026-10-16',amount:'25.00',currency:'PLN',provider:'csob',payer:'Correction 1060'}});expect(created.status()).toBe(201);const row=await created.json();
 expect((await request.post(f.url+'/payment-scratchpad/'+row._id+'/reconcile',{headers,data:{revision:row.revision,action:'convert',clientId:f.clientId,confirm:true}})).status()).toBe(201);
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();const before=await snapshot();
 await page.setViewportSize({width,height:980});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'scratchpad@example.invalid'}));},f.token);
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
 if(u.pathname.startsWith('/payment-scratchpad')||['/clients','/bookings','/payment-requests'].includes(u.pathname)){return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});}
 if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});return route.fulfill({json:[]});});
 await page.goto('/admin/payments/scratchpad/'+row._id+'/edit?status=all');
 await page.getByLabel('Correct amount',{exact:true}).fill('27.50');await page.getByLabel('Correct currency').selectOption('GBP');await page.getByLabel('Correct received date',{exact:true}).fill('2026-10-18');await page.getByLabel('Reason for correction',{exact:true}).fill('Corrected using original statement');
 await page.screenshot({path:`../scratchpad-correction-${width}.png`,fullPage:true});
 const dismiss=page.getByRole('button',{name:'Dismiss loading message'});if(await dismiss.isVisible())await dismiss.click();
 await page.getByRole('button',{name:'Save receipt correction',exact:true}).click();await expect(page.getByText('Receipt corrections saved on the scratchpad and linked payment.')).toBeVisible();
 await page.reload();await expect(page.getByText('Current payment: 27.5 GBP · completed')).toBeVisible();
 const after=await snapshot(),saved=after.scratchpad.find((x:any)=>x._id===row._id),payment=after.payments.find((x:any)=>x._id===saved.paymentId);
 expect(saved.amountMinor).toBe(2750);expect(saved.currency).toBe('GBP');expect(saved.receivedDate).toBe('2026-10-18');expect(payment.amount).toBe(27.5);expect(payment.currency).toBe('GBP');expect(payment.paymentDate.slice(0,10)).toBe('2026-10-18');expect(payment.clientId).toBe(f.clientId);expect(after.payments.length).toBe(before.payments.length);
 for(const original of before.scratchpad.filter((x:any)=>x._id!==row._id))expect(after.scratchpad.find((x:any)=>x._id===original._id)).toEqual(original);
 expect(saved.history.filter((x:any)=>['amount_currency_corrected','date_corrected'].includes(x.action)).map((x:any)=>x.after.reason)).toEqual(['Corrected using original statement','Corrected using original statement']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
