import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.PPVC903_FIXTURE;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable real Mongo/Nest fixture.');
for(const width of [1440,390])for(const flow of ['create','similar','partial'])test(`${flow} request workflow at ${width}px`,async({page,request})=>{
 const headers={Authorization:'Bearer '+f.tokens.admin};
 const post=async(path:string,data:any)=>{const r=await request.post(f.url+path,{headers,data});expect(r.ok()).toBeTruthy();return r.json();};
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();
 await post('/fixture/request-first',{});
 const invoice=await post('/payment-requests',{clientId:f.client,retreatId:f.retreat,requestType:'full_payment',requestedAmount:flow==='partial'?3800:1000,fullPrice:flow==='partial'?3800:1000,currency:'PLN',requestDate:'2026-10-20'});
 if(flow!=='partial')await post('/payments',{clientId:f.client,paymentRequestId:invoice._id,amount:1000,currency:'PLN',status:'completed',paymentMethod:'bank_transfer',paymentDate:'2026-10-20'});
 if(flow==='similar')await post('/fixture/second-booking',{});
 const before=await snapshot();
 const client={_id:f.client,display_id:1903,firstName:'Synthetic',lastName:'Client',email:'synthetic@example.invalid'};
 const retreat={_id:f.retreat,name:'Synthetic Retreat',code:'SYN903',startDate:'2099-01-01',endDate:'2099-01-07',capacity:10,type:'regular'};
 await page.setViewportSize({width,height:980});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'admin@example.invalid'}));},f.tokens.admin);
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/bookings')||u.pathname.startsWith('/payments')||u.pathname.startsWith('/payment-requests'))return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});
  if(u.pathname==='/clients/booking-options'||u.pathname==='/clients')return route.fulfill({json:[client]});
  if(u.pathname==='/clients/'+f.client)return route.fulfill({json:client});
  if(u.pathname==='/retreats')return route.fulfill({json:[retreat]});
  if(u.pathname==='/retreats/'+f.retreat)return route.fulfill({json:retreat});
  if(u.pathname==='/audit-logs')return route.fulfill({json:{items:[]}});
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});return route.fulfill({json:[]});
 });
 if(flow!=='partial'){
  await page.goto('/admin/payment-requests');await page.getByRole('combobox',{name:'Payment status'}).selectOption('paid-unbooked');
  await page.getByRole('link',{name:'Create booking',exact:true}).click();
  if(flow==='similar'){
   await expect(page.getByText('A booking already exists for this client and retreat. Review it before creating another.',{exact:true})).toBeVisible();
   await expect(page.getByRole('link',{name:'Review and link existing booking'})).toHaveAttribute('href',`/admin/payment-requests/booking-review?requestId=${invoice._id}`);
   expect(await snapshot()).toEqual(before);
  }else{
   await expect(page).toHaveURL(/bookings\/new\?/);await expect(page.getByPlaceholder('Search and select a client...')).toHaveValue(/Synthetic Client/);
   expect((await snapshot()).bookings).toHaveLength(0);
   await page.getByRole('button',{name:'Add Booking',exact:true}).click();await expect.poll(async()=>(await snapshot()).bookings.length).toBe(1);
   const after=await snapshot();expect(after.requests[0].bookingId).toBe(after.bookings[0]._id);expect(after.payments[0].bookingId).toBe(after.bookings[0]._id);expect(after.receipts).toEqual(before.receipts);
  }
 }else{
  await page.goto('/admin/payment-requests/'+invoice._id);
  for(const [amount,date] of [['1500','2026-10-20'],['2500','2026-10-21']]){
   await page.getByRole('button',{name:'Record payment',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Amount',exact:true})).toBeVisible();
   await page.getByRole('spinbutton',{name:'Amount',exact:true}).fill(amount);await page.getByLabel('Payment date',{exact:true}).fill(date);
   await page.getByRole('button',{name:'Add Payment',exact:true}).click();await expect(page).toHaveURL(new RegExp('/payment-requests/'+invoice._id+'$'));
   if(amount==='1500'){await expect(page.getByText('2,300.00 PLN',{exact:true})).toBeVisible();await expect(page.getByText(/Partially paid/)).toBeVisible();}
  }
  const section=page.getByRole('region',{name:'Request payment settlement'});
  await expect(section.getByText(/Overpayment: 200.00 PLN/)).toBeVisible();await expect(section.getByText('3,800.00 PLN',{exact:true})).toBeVisible();await expect(section.getByText('4,000.00 PLN',{exact:true})).toBeVisible();
  const after=await snapshot();expect(after.payments).toHaveLength(2);expect(after.receipts).toHaveLength(2);expect(after.bookings).toHaveLength(0);expect(after.requests[0].requestedAmount).toBe(3800);
  expect(after.payments.map((p:any)=>[p.amount,p.paymentDate.slice(0,10)])).toEqual([[1500,'2026-10-20'],[2500,'2026-10-21']]);
  await section.scrollIntoViewIfNeeded();
 }
 await page.screenshot({path:`../ppvc-910-911-validation/${flow}-${width}.png`,fullPage:true});
});
