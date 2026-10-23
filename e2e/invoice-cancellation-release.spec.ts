import {test,expect} from '@playwright/test';
const request:any={_id:'req-1',invoiceNumber:'INV-1086',requestedAmount:450,currency:'EUR',status:'pending',clientId:{_id:'client',firstName:'Synthetic',lastName:'Guest'},publicHash:'cancelled-hash'};
for(const width of [1440,390]){
 test(`staff cancels invoice with a reason at ${width}`,async({page})=>{
  page.on('pageerror', error => console.log('BROWSER ERROR',error.message));
  await page.setViewportSize({width,height:1000});let cancelled=false;let writes=0;
  await page.route('**/*',async route=>{if(!['xhr','fetch'].includes(route.request().resourceType()))return route.continue();const url=new URL(route.request().url());const json=(data:any)=>route.fulfill({json:data});
   if(url.pathname==='/payment-requests/req-1/cancel'){expect(route.request().postDataJSON()).toMatchObject({reason:'Client did not pay'});cancelled=true;writes++;return json({...request,status:'cancelled',cancellationReason:'Client did not pay',cancelledAt:'2026-10-14',cancelledBy:'staff@example.test'});}
   if(url.pathname==='/payment-requests/req-1/settlement')return json({requestId:request._id,requestedAmount:450,currency:'EUR',amountReceived:0,amountOutstanding:450,amountOverpaid:0,settlementStatus:'unpaid',payments:[]});
   if(url.pathname==='/payment-requests/req-1')return json(request);
   if(url.pathname==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
  });
  await page.goto('/admin/payment-requests/req-1');await page.getByRole('button',{name:'Cancel Invoice (Storno)',exact:true}).click();expect(writes).toBe(0);
  await page.getByRole('button',{name:'Confirm Cancellation',exact:true}).click();
  await expect(page.getByText('Cancelled (Storno)',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Add Payment',exact:true})).toHaveCount(0);expect(cancelled).toBe(true);expect(writes).toBe(1);
  await page.screenshot({path:`../storno-admin-${width}.png`,fullPage:true});
 });
 for(const [language,title]of [['en','Invoice cancelled'],['cz','Faktura stornována'],['pl','Faktura anulowana']])test(`cancelled portal ${language}/${width} offers contact instead of payments`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.route('**/*',async route=>{if(!['xhr','fetch'].includes(route.request().resourceType()))return route.continue();expect(route.request().method()).toBe('GET');return route.fulfill({json:{booking:{currency:'EUR'},paymentRequests:[{...request,status:'cancelled',cancellationReason:'Client did not pay'}]}});});
  await page.goto(`http://localhost:4400/e2e/fixtures/cancelled-payment.html?lang=${language}`);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();await expect(page.locator('.portal-payment-methods')).toHaveCount(0);await expect(page.getByRole('link',{name:'info@ibogaspirit.cz',exact:true})).toBeVisible();await page.screenshot({path:`../storno-portal-${language}-${width}.png`,fullPage:true});
 });
}
