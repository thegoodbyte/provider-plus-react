import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
const bookingId='507f1f77bcf86cd799439011', clientId='507f1f77bcf86cd799439012', retreatId='507f1f77bcf86cd799439013';
async function fixture(page:Page,baseURL:string,options:{overpaid?:boolean;failSummary?:boolean;booster?:boolean}={}) {
 const calls={writes:[] as string[],summary:0};
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-overview-token');localStorage.setItem('user',JSON.stringify({id:'admin-e2e',role:'admin',email:'admin@example.invalid'}));});
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===new URL(baseURL).origin&&!u.pathname.startsWith('/api/'))return route.continue();const p=u.pathname.replace(/^\/api(?=\/)/,'');
  const json=(body:unknown,status=200)=>route.fulfill({json:body,status});
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){calls.writes.push(req.method()+' '+p);return json({message:'Writes forbidden in overview regression'},409);}
  if(p===`/bookings/${bookingId}`)return json({_id:bookingId,bookingNumber:1247,bookingType:options.booster?'booster':'full',status:'confirmed',totalAmount:59900,currency:'CZK',registrationDate:'2026-06-24',bookingConfirmationHistory:[],roomType:'private',bookingHash:'synthetic-hash',checkInDate:'2026-06-24',checkOutDate:'2026-06-24',...(options.booster?{boosterStartDate:'2026-11-08',boosterEndDate:'2026-11-09'}:{}),clientId:{_id:clientId,firstName:'Denis',lastName:'Synthetic',email:'denis@example.invalid',phone:'+420 777 123 456',country:'Poland',display_id:1187,language:'pl'},retreatId:{_id:retreatId,name:'Jablonne nad Orlici',code:'JNO-11-06-26',location_town:'Jablonné nad Orlicí',startDate:'2026-11-06',endDate:'2026-11-13',capacity:8}});
  if(p===`/payments/booking/${bookingId}/financial-summary`){calls.summary++;if(options.failSummary&&calls.summary===1)return json({message:'Synthetic outage'},503);return json({currency:'CZK',price:59900,grossReceived:options.overpaid?60900:24000,refunded:0,paidInFull:!!options.overpaid,sourceState:'verified_ledger',cachedAmountPaid:options.overpaid?60900:24000,calculated:{netPaid:options.overpaid?60900:24000},netPaid:options.overpaid?60900:24000,balance:options.overpaid?0:35900,overpayment:options.overpaid?1000:0});}
  if(p.startsWith('/payments/plan-settings/booking/'))return json(null);
  if(p.endsWith('/requirement-projection/ekg'))return json({required:true,satisfied:false,state:'missing',label:'Entry EKG missing'});
  if(p===`/booking-flow/bookings/${bookingId}/requirements`)return json({items:[],artifacts:[],documents:[],reviews:[],requirements:[]});
  if(p==='/environment/status')return json({production:false});if(p==='/users/navigation-permissions'||p==='/config-summary')return json({});return json([]);
 });
 return calls;
}
for(const width of [1440,768,390])test(`booking overview summary and navigation at ${width}px`,async({page,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const calls=await fixture(page,baseURL!);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/admin/bookings/${bookingId}`);const overview=page.getByRole('region',{name:'Booking overview',exact:true});await expect(overview.getByText('40% paid')).toBeVisible();
 await expect(overview.getByRole('region',{name:'Retreat & dates'})).toContainText('Nov 6, 2026');await expect(overview.getByRole('region',{name:'Client',exact:true})).toContainText('denis@example.invalid');
 await expect(overview.getByRole('region',{name:'Requirements',exact:true})).toContainText('required');
 await overview.getByRole('button',{name:'Refresh payment summary'}).click();await expect.poll(()=>calls.summary).toBe(2);await expect(overview.getByText('40% paid')).toBeVisible();
 const artifact=process.env.BOOKING_OVERVIEW_ARTIFACTS?path.join(process.env.BOOKING_OVERVIEW_ARTIFACTS,`overview-${width}.png`):info.outputPath(`overview-${width}.png`);await page.screenshot({path:artifact,fullPage:true});
 await overview.getByRole('region',{name:'Confirmation',exact:true}).scrollIntoViewIfNeeded();await expect(overview.getByRole('region',{name:'Confirmation',exact:true})).toBeVisible();await page.screenshot({path:process.env.BOOKING_OVERVIEW_ARTIFACTS?path.join(process.env.BOOKING_OVERVIEW_ARTIFACTS,`overview-${width}-details.png`):info.outputPath(`overview-${width}-details.png`),fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await overview.getByRole('button',{name:'Open all requirements'}).click();await expect(overview).toHaveCount(0);await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await page.getByRole('region',{name:'Booking overview'}).getByRole('button',{name:'View payments'}).click();await expect(page.getByRole('region',{name:'Booking overview'})).toHaveCount(0);
 await page.getByRole('button',{name:'Record a payment',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/admin/payments/new\\?bookingId=${bookingId}&clientId=${clientId}`));expect(calls.writes).toEqual([]);expect(errors).toEqual([]);
});
test('summary read failure can retry; overpayment is fully paid credit',async({page,baseURL})=>{
 const calls=await fixture(page,baseURL!,{failSummary:true,overpaid:true});await page.goto(`/admin/bookings/${bookingId}`);const overview=page.getByRole('region',{name:'Booking overview'});
 await overview.getByRole('button',{name:'Retry payment summary'}).click();await expect(overview.getByText('Paid in full · credit available')).toBeVisible();await expect(overview.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');await page.reload();await expect(overview.getByText('Paid in full · credit available')).toBeVisible();expect(calls.writes).toEqual([]);
});
test('booster displays its own dates and opening confirmation does not send',async({page,baseURL})=>{
 const calls=await fixture(page,baseURL!,{booster:true});await page.goto(`/admin/bookings/${bookingId}`);const overview=page.getByRole('region',{name:'Booking overview'});await expect(overview.getByText('40% paid')).toBeVisible();
 const dates=overview.getByRole('region',{name:'Retreat & dates'});await expect(dates).toContainText('Nov 8, 2026');await expect(dates).toContainText('Nov 9, 2026');
 await overview.getByRole('button',{name:'Send confirmation',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(calls.writes).toEqual([]);
});
