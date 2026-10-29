import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.BOOKING_RECONCILIATION_FIXTURE;
test.skip(!fixturePath,'Requires real API/Mongo booking reconciliation fixture');
for(const width of [1440,390]) test(`review existing money and refresh booking balance at ${width}px`,async({page,request})=>{
 const f=JSON.parse(fs.readFileSync(fixturePath!,'utf8'));await request.post(f.url+'/fixture/reconciliation-reset');
 await page.setViewportSize({width,height:980});
 await page.addInitScript(({token})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({role:'admin',email:'admin@example.invalid'}))},{token:f.tokens.admin});
 await page.route('**/*',async route=>{
  const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/payment-requests'))return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});return route.fulfill({json:[]});
 });
 await page.goto('/admin/payment-requests/booking-review?bookingId='+f.ids.booking);
 await expect(page.getByText('Unallocated payment #1213: 6600 PLN · completed')).toBeVisible();
 const before=await (await request.get(f.url+'/fixture/reconciliation-snapshot')).json();expect(before.payments).toHaveLength(2);
 await page.getByRole('button',{name:'Link request #1365 to booking #1311'}).click();
 const dialog=page.getByRole('dialog',{name:'Confirm existing booking link'});await expect(dialog.getByRole('button',{name:'Confirm booking link'})).toBeDisabled();
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm booking link'}).click();
 await expect(page.getByText('Existing payments linked and booking balance refreshed. No new payment or booking was created.')).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Link request #1365 to booking #1311'})).toHaveCount(0);
 const after=await(await request.get(f.url+'/fixture/reconciliation-snapshot')).json();const booking=after.bookings.find((b:any)=>b._id===f.ids.booking);expect(booking.amountPaid).toBe(11000);expect(booking.financialSummary.paidInFull).toBe(true);expect(after.payments).toHaveLength(2);expect(after.payments[1].amount).toBe(6600);expect(after.payments[1].exchangeRate).toBe(4.39);expect(after.payments[0]).toEqual(before.payments[0]);expect(after.emails).toEqual([]);
 await page.screenshot({path:`${process.env.BOOKING_RECONCILIATION_ARTIFACT_DIR||'test-results'}/reconciled-${width}.png`,fullPage:true});
});
