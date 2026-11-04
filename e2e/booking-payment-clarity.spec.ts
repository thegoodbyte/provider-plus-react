import { test, expect, Page } from '@playwright/test';
const id = '507f1f77bcf86cd799439011';
async function fixture(page: Page) {
 const writes: string[] = [];
 const client = {_id:'c1',display_id:1351,firstName:'Synthetic',lastName:'Guest',email:'guest@example.invalid'};
 const retreat = {_id:'r1',code:'JNO-01-16-27',name:'Synthetic retreat',startDate:'2099-01-16',endDate:'2099-01-23'};
 const booking = {_id:id,bookingNumber:1337,status:'confirmed',bookingType:'regular',clientId:client,retreatId:retreat,currency:'PLN',totalAmount:9500,roomType:'shared'};
 const payment = {_id:'p1216',display_id:1216,bookingId:id,clientId:client,amount:3800,currency:'PLN',usd_amount:962.03,paymentDate:'2026-10-29',paymentMethod:'bank_transfer',paymentType:'regular_payment',status:'completed',isRefundable:true,paymentRequestId:{_id:'q1417',invoiceNumber:'1417'}};
 const request = {_id:'q1417',invoiceNumber:'1417',bookingId:id,clientId:client,requestedAmount:3800,currency:'PLN',usd_amount:967.88,status:'paid',paymentId:payment,dueDate:'2026-10-27'};
 const items = [{_id:'ekg',key:'ekg_received',title:'Entry EKG received',description:'Entry EKG document has been received from the client.',status:'received',category:'medical',isBlocking:true,bookingId:id,metadata:{isRequirement:true,requiredFromClient:true,reviewRequired:true}}];
 await page.route('**/*', async route => {
  const r=route.request(); if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();
  const p=new URL(r.url()).pathname.replace(/^\/api(?=\/)/,'');
  if(r.method()!=='GET'){writes.push(r.method()+' '+p);return route.fulfill({status:500,json:{message:'Unexpected write in read-only journey'}});}
  let data:any=[];
  if(p==='/environment/status')data={environment:'local',production:false,enabledJobs:[]};
  else if(p===`/bookings/${id}`)data=booking;
  else if(p.includes('/bookings/retreat/'))data=[booking];
  else if(p.endsWith('/financial-summary'))data={currency:'PLN',price:9500,grossReceived:3800,refunded:0,netPaid:3800,balance:5700,overpayment:0,paidInFull:false,sourceState:'verified_ledger',calculated:{netPaid:3800}};
  else if(p.endsWith('/requirements'))data={items,artifacts:[],documents:[],reviews:[],requirements:[{itemId:'ekg',key:'ekg_received',state:'expired',requiredFromClient:true,reviewRequired:true}]};
  else if(p.endsWith('/workflow-snapshot'))data={items,documents:[],actionLogs:[]};
  else if(p.endsWith('/requirement-projection/ekg'))data={version:1,bookingId:id,state:'expired',required:true,applicable:true,satisfied:false};
  else if(p.startsWith('/payments/plan-settings/'))data=null;
  else if(p.includes('/payments/by-booking/'))data=[payment];
  else if(p==='/payments/types')data=[];
  else if(p==='/payments/p1216')data=payment;
  else if(p==='/payment-requests/q1417')data=request;
  else if(p.startsWith('/payment-requests'))data=[request];
  else if(p==='/clients/c1')data=client;
  else if(p==='/retreats/r1')data=retreat;
  else if(p==='/retreats')data=[retreat];
  else if(p.includes('config-summary'))data={};
  return route.fulfill({json:data});
 });
 return {writes};
}
for(const width of [1440,1024,390])test(`request and payment are distinct and navigable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000}); const f=await fixture(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/admin/bookings/${id}`);
 const next=page.getByRole('region',{name:'Booking readiness'});
 await expect(next.getByRole('heading',{name:'Booking readiness'})).toBeVisible();
 await expect(next.getByText('Client requirement to follow up')).toBeVisible();
 await expect(next.getByText('Entry EKG document has been received from the client.')).toHaveCount(0);
 await page.screenshot({path:`${process.env.BOOKING_DESIGN_ARTIFACT_DIR||'test-results'}/readiness-${width}.png`});
 await page.getByRole('tab',{name:'Payments',exact:true}).click();
 const requested=page.getByRole('region',{name:'Payment requests — money requested'});
 const transactions=page.getByRole('region',{name:'Payments — recorded transactions'});
 await expect(requested.getByRole('link',{name:'Payment #1216'})).toBeVisible();
 await expect(requested.getByRole('link',{name:'Payment #1216'})).toHaveAttribute('href','/admin/payments/p1216');
 await expect(transactions.getByRole('button',{name:'Request #1417'})).toBeVisible();
 await expect(page.getByText(/same money, counted once/)).toBeVisible();
 await expect(page.locator('.booking-balance-metric.received')).toContainText('3,800.00');
 await expect(page.locator('.booking-balance-metric.outstanding')).toContainText('5,700.00');
 await expect(requested).not.toContainText('967.88');await expect(transactions).not.toContainText('962.03');
 await expect(transactions.getByRole('button',{name:'Delete',exact:true})).not.toBeVisible();
 await transactions.getByLabel('More actions for payment 1216').click();
 for(const name of ['Refund','Edit','Delete']){const button=transactions.getByRole('button',{name,exact:true});await expect(button).toBeVisible();await button.click({trial:true});}
 await page.screenshot({path:`${process.env.BOOKING_DESIGN_ARTIFACT_DIR||'test-results'}/payment-actions-${width}.png`});
 const del=await transactions.getByRole('button',{name:'Delete',exact:true}).boundingBox();expect(del!.x).toBeGreaterThanOrEqual(0);expect(del!.x+del!.width).toBeLessThanOrEqual(width);
 await transactions.getByLabel('More actions for payment 1216').click();
 await requested.scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.BOOKING_DESIGN_ARTIFACT_DIR||'test-results'}/payments-${width}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.payments-table-container').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
 await transactions.getByRole('button',{name:'Request #1417'}).click();await expect(page).toHaveURL(/\/admin\/payment-requests\/q1417$/);
 expect(f.writes).toEqual([]);expect(errors).toEqual([]);
});
