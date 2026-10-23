import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.PPVC903_FIXTURE;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable PPVC-903 Mongo/Nest fixture.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390]) for(const flow of ['request','payment']) test(`${flow}-first booking at ${width}px`,async({page,request})=>{
 const apiErrors:string[]=[]; page.on('response', response=>{ if(response.status()>=500 && /\/(bookings|payments|payment-requests)(\/|\?|$)/.test(new URL(response.url()).pathname)) apiErrors.push(response.status()+' '+response.url()); });
 const headers={Authorization:'Bearer '+f.tokens.admin};
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();
 await request.post(f.url+'/fixture/request-first',{data:{}});
 const invoice=await(await request.post(f.url+'/payment-requests',{headers,data:{clientId:f.client,retreatId:f.retreat,requestType:'full_payment',requestedAmount:1000,fullPrice:1000,currency:'PLN',requestDate:'2026-10-20'}})).json();
 const payment=await(await request.post(f.url+'/payments',{headers,data:{clientId:f.client,paymentRequestId:invoice._id,amount:1000,currency:'PLN',status:'completed',paymentMethod:'bank_transfer',paymentDate:'2026-10-20',description:'Synthetic pre-booking receipt'}})).json();
 const before=await snapshot();expect(before.bookings).toHaveLength(0);
 const client={_id:f.client,display_id:1903,firstName:'Synthetic',lastName:'Client',email:'synthetic@example.invalid'};
 const retreat={_id:f.retreat,name:'Synthetic Retreat',code:'SYN903',startDate:'2099-01-01',endDate:'2099-01-07',capacity:10,type:'regular'};
 await page.setViewportSize({width,height:980});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'admin@example.invalid'}));},f.tokens.admin);
 await page.route('**/*',async route=>{
  const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/bookings')||u.pathname.startsWith('/payments')||u.pathname.startsWith('/payment-requests')){const response=await route.fetch({url:f.url+u.pathname+u.search});return route.fulfill({response});}
  if(u.pathname==='/clients/booking-options'||u.pathname==='/clients')return route.fulfill({json:[client]});
  if(u.pathname==='/clients/'+f.client)return route.fulfill({json:client});
  if(u.pathname==='/retreats')return route.fulfill({json:[retreat]});
  if(u.pathname==='/retreats/'+f.retreat)return route.fulfill({json:retreat});
  if(u.pathname==='/audit-logs')return route.fulfill({json:{items:[]}});
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 const dismiss=async()=>{const toast=page.getByRole('button',{name:'Dismiss loading message'});if(await toast.isVisible())await toast.click();};
 let bookingId:string;
 if(flow==='request'){
  await page.goto('/admin/payment-requests/'+invoice._id);await expect(page.getByRole('link',{name:'Create booking',exact:true})).toBeVisible();await page.screenshot({path:`../ppvc-903-validation/create-action-${width}.png`,fullPage:true});await page.getByRole('link',{name:'Create booking',exact:true}).click();await expect(page).toHaveURL(/\/admin\/bookings\/new\?/);
  await expect(page.getByRole('button',{name:'Add Booking',exact:true})).toBeVisible();expect((await snapshot()).bookings).toHaveLength(0);await dismiss();await page.getByRole('button',{name:'Add Booking',exact:true}).click();
  await expect.poll(async()=>(await snapshot()).bookings.length).toBe(1);bookingId=(await snapshot()).bookings[0]._id;
 }else{
  const created=await(await request.post(f.url+'/bookings',{headers,data:{clientId:f.client,retreatId:f.retreat,totalAmount:1000,currency:'PLN',status:'confirmed',registrationDate:'2026-10-20',bookingNumber:1903,paymentPlanEnabled:false}})).json();bookingId=created._id;
  await page.goto('/admin/bookings/'+bookingId);await page.getByRole('tab',{name:'Payments',exact:true}).click();await expect(page.getByText('No payment request yet')).toBeVisible();await dismiss();await page.getByRole('button',{name:'Link existing payment',exact:true}).click();await page.getByLabel('Existing Payment').selectOption(payment._id);await page.getByRole('button',{name:'Link Payment',exact:true}).click();
  await expect(page.locator('.booking-payment-request-row').filter({hasText:'Request #'+invoice.invoiceNumber})).toHaveCount(1);
 }
 let saved=await snapshot();expect(saved.requests[0].bookingId).toBe(bookingId);expect(saved.payments[0].bookingId).toBe(bookingId);expect(saved.bookings[0].amountPaid).toBe(1000);expect(saved.payments).toHaveLength(1);expect(saved.receipts).toHaveLength(1);expect(saved.receipts[0].totalAmount).toBe(before.receipts[0].totalAmount);expect(saved.receipts[0].currency).toBe(before.receipts[0].currency);
 await page.goto('/admin/bookings/'+bookingId);await page.getByRole('tab',{name:'Payments',exact:true}).click();const row=page.locator('.booking-payment-request-row').filter({hasText:'Request #'+invoice.invoiceNumber});await expect(row).toHaveCount(1);await expect(row).toContainText('paid');await expect(page.locator('.payments-list tbody tr').filter({hasText:String(payment.display_id)})).toHaveCount(1);await row.scrollIntoViewIfNeeded();await dismiss();await page.screenshot({path:`../ppvc-903-validation/${flow}-${width}.png`,fullPage:true});
 await page.goto('/admin/payment-requests/'+invoice._id);await expect(page.getByRole('link',{name:'Open booking',exact:true})).toHaveAttribute('href','/admin/bookings/'+bookingId);await expect(page.getByRole('link',{name:'Create booking',exact:true})).toHaveCount(0);
 expect(apiErrors).toEqual([]);
 saved=await snapshot();expect(saved.bookings).toHaveLength(1);expect(saved.payments).toHaveLength(1);expect(saved.receipts).toHaveLength(1);
});
