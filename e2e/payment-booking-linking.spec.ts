import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const path=process.env.PPVC920_FIXTURE;
const f=path?JSON.parse(fs.readFileSync(path,'utf8')):{};
test.skip(!path,'Requires local synthetic PPVC-920 API fixture');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])for(const flow of ['edit-create','add-existing'])test(`payment booking ${flow} at ${width}px`,async({page,request})=>{
 const setup=await request.post(f.url+'/fixture/payment-booking',{data:{existing:flow==='add-existing'}});const {paymentId}=await setup.json();const snapshot=async()=>await(await request.get(f.url+'/fixture/snapshot')).json();const before=await snapshot();
 await page.setViewportSize({width,height:980});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'admin@example.invalid'}));},f.tokens.admin);
 const client={_id:f.client,firstName:'Synthetic',lastName:'Client',display_id:1899};const retreat={_id:f.retreat,name:'Synthetic Retreat',code:'SYN902',type:'regular',startDate:'2099-01-01',endDate:'2099-01-07',capacity:10};
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const u=new URL(r.url());
  if(u.pathname.startsWith('/payments')||u.pathname.startsWith('/payment-requests')||u.pathname.startsWith('/bookings')){const response=await route.fetch({url:f.url+u.pathname+u.search});return route.fulfill({response});}
  if(u.pathname.startsWith('/clients'))return route.fulfill({json:[client,{_id:'00000000000000000000000a',firstName:'Other',lastName:'Client'}]});
  if(u.pathname==='/retreats')return route.fulfill({json:[retreat]});
  if(u.pathname.includes('config-summary'))return route.fulfill({json:{}});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});return route.fulfill({json:[]});
 });
 await page.goto(flow==='edit-create'?`/admin/payments/${paymentId}/edit`:`/admin/payments/new?clientId=${f.client}`);
 await expect(page.getByRole('heading',{name:flow==='edit-create'?'Edit Payment':'Add Payment',exact:true})).toBeVisible();
 const picker=page.getByRole('combobox',{name:'Search and select booking'});await picker.click();await expect(page.getByRole('option',{name:/#1999/})).toHaveCount(0);await page.keyboard.press('Escape');
 let targetBooking:string;
 if(flow==='edit-create'){
  await expect(page.getByText('No bookings for this client yet.')).toBeVisible();await expect(page.getByRole('spinbutton',{name:'Amount',exact:true})).toHaveValue('3800');
  await page.getByRole('button',{name:'Create booking for this client',exact:true}).click();let dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Booking client')).toHaveText('Synthetic Client');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(await snapshot()).toEqual(before);
  await page.getByRole('button',{name:'Create booking for this client',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.getByPlaceholder('Search and select a retreat...').fill('Synthetic');await dialog.getByText('Synthetic Retreat (SYN902)',{exact:true}).click();
  const price=dialog.getByText('Agreed price for this booking',{exact:true}).locator('..').locator('input');await price.fill('9500');
  await page.screenshot({path:`../ppvc-920-validation/booking-${width}.png`,fullPage:true});
  await dialog.getByRole('button',{name:'Create and select booking',exact:true}).click();await expect(dialog).toBeHidden();await expect(page.getByText(/created and selected. Save the payment/)).toBeVisible();
  const afterBooking=await snapshot();expect(afterBooking.payments).toEqual(before.payments);expect(afterBooking.receipts).toEqual(before.receipts);targetBooking=afterBooking.bookings.find((b:any)=>b.clientId===f.client)._id;
  await page.getByRole('button',{name:'Update Payment',exact:true}).click();await expect(page).toHaveURL(/\/admin\/payments$/);
 }else{
  await page.getByRole('spinbutton',{name:'Amount',exact:true}).fill('3800');await page.getByLabel('Currency',{exact:false}).selectOption('PLN');
  await picker.fill('1920');await page.getByRole('option',{name:/#1920/}).click();await expect(page.getByRole('spinbutton',{name:'Amount',exact:true})).toHaveValue('3800');
  targetBooking=before.bookings.find((b:any)=>b.bookingNumber===1920)._id;
  await page.getByLabel('Status',{exact:true}).selectOption('completed');await page.getByRole('button',{name:'Add Payment',exact:true}).click();await expect(page).toHaveURL(/\/admin\/payments$/);
 }
 const after=await snapshot();const payment=after.payments.find((p:any)=>flow==='edit-create'?p._id===paymentId:p._id!==paymentId);expect(payment.bookingId).toBe(targetBooking);expect(payment.clientId).toBe(f.client);expect(payment.amount).toBe(3800);expect(payment.currency).toBe('PLN');
 if(flow==='edit-create'){expect(payment.paymentDate).toBe(before.payments[0].paymentDate);expect(payment.receiptId).toBe(before.payments[0].receiptId);expect(after.payments).toHaveLength(1);expect(after.receipts).toHaveLength(1);}
 expect(after.requests).toHaveLength(0);
});
