import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.PPVC918_FIXTURE;
const f=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable standalone PPVC-918 fixture');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])test(`existing receipt reviewed and split without duplicate cash at ${width}px`,async({page,request})=>{
 await request.post(f.url+'/fixture/reset');await page.setViewportSize({width,height:980});
 const snapshot=async()=>await(await request.get(f.url+'/fixture/snapshot')).json();const before=await snapshot();
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'staff@example.invalid'}));},f.token);
 await page.route('**/*',async route=>{
  const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/payments')||u.pathname.startsWith('/payment-requests')||u.pathname==='/bookings'||u.pathname==='/clients/booking-options'){const response=await route.fetch({url:f.url+u.pathname+u.search});return route.fulfill({response});}
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/payments/joint/new?receiptId='+f.ids.receipt);
 await expect(page.getByText('Receipt #1142',{exact:false})).toBeVisible();
 await expect(page.getByLabel('Total received *')).toBeDisabled();await expect(page.getByLabel('Total received *')).toHaveValue('7600');
 const submit=page.getByRole('button',{name:'Confirm receipt split'});await expect(submit).toBeDisabled();
 for(const [index,number] of [[1,'1333'],[2,'1334']] as const){const picker=page.getByRole('combobox',{name:`Booking ${index}`,exact:true});await picker.fill(number);await page.locator('#'+await picker.getAttribute('aria-controls')).getByRole('option',{name:new RegExp('#'+number)}).click();}
 expect(await snapshot()).toEqual(before);
 await expect(page.getByText('Difference: 0.00 PLN')).toBeVisible();await page.getByRole('checkbox').check();
 await page.screenshot({path:`../ppvc-918-validation/review-${width}.png`,fullPage:true});
 await submit.click();await expect(page).toHaveURL(/\/admin\/payments$/);
 const after=await snapshot();expect(after.receipts).toHaveLength(1);expect(after.receipts[0].totalAmount).toBe(7600);expect(after.payments.map((p:any)=>p.amount)).toEqual([3800,3800]);expect(after.bookings.every((b:any)=>b.amountPaid===3800&&b.totalAmount===9500)).toBeTruthy();expect(after.requests[0].amountReceived).toBe(7600);expect(after.requests[0].participantBookings).toHaveLength(2);
});

test('booking shortcut preloads the participant and price and returns to the saved split draft',async({page,request})=>{
 await request.post(f.url+'/fixture/unbooked');
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'staff@example.invalid'}));},f.token);
 let bookingCreates=0;
 await page.route('**/*',async route=>{
  const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/bookings/next-booking-number'))return route.fulfill({json:2000});
  if(u.pathname==='/bookings'&&r.method()==='POST'){bookingCreates++;const body=r.postDataJSON();expect(body.clientId).toBe(f.ids.a);expect(body.retreatId).toBe(f.ids.retreat);expect(body.totalAmount).toBe(9500);expect(body.paymentRequestId).toBeUndefined();expect(body.paymentPlanEnabled).toBe(false);}
  if(u.pathname.startsWith('/payments')||u.pathname.startsWith('/payment-requests')||u.pathname.startsWith('/bookings')||u.pathname==='/clients/booking-options'){const response=await route.fetch({url:f.url+u.pathname+u.search});return route.fulfill({response});}
  if(u.pathname==='/retreats'){const response=await route.fetch({url:f.url+'/retreat'});return route.fulfill({response});}
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/payments/joint/new?receiptId='+f.ids.receipt);
 const client=page.getByRole('combobox',{name:'Participant 1',exact:true});await client.fill('1333');await page.getByRole('option',{name:/#1333/}).click();
 await expect(page.getByLabel('Booking price 1')).toHaveValue('9500.00');await page.getByRole('button',{name:'Create booking for participant 1'}).click();
 await expect(page).toHaveURL(/\/admin\/bookings\/new\?/);expect(bookingCreates).toBe(0);
 await page.screenshot({path:'../ppvc-918-validation/booking-prefill.png',fullPage:true});
 await page.getByRole('button',{name:'Add Booking',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/payments\/joint\/new\?.*createdBookingId=/);expect(bookingCreates).toBe(1);
 await expect(page.locator('#joint-payment-booking-select-0').locator('..')).toContainText('#2000');
 const snapshot=await(await request.get(f.url+'/fixture/snapshot')).json();expect(snapshot.payments).toHaveLength(1);expect(snapshot.payments[0].amount).toBe(7600);expect(snapshot.bookings).toHaveLength(1);
});
