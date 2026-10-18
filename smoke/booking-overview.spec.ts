import { test,expect,Page } from '@playwright/test';
const bookingId='507f1f77bcf86cd799439494',clientId='507f1f77bcf86cd799439495',retreatId='507f1f77bcf86cd799439496';
const client={_id:clientId,firstName:'Overview',lastName:'Fixture',email:'overview@example.invalid',phone:'+420 777 123 456',country:'Czech Republic',display_id:1494,source:'Friend'};
const retreat={_id:retreatId,name:'Overview test retreat',code:'F494',retreatCode:'F494',startDate:'2027-06-01',endDate:'2027-06-08',startTime:'18:00',endTime:'10:00',capacity:12,location_town:'Mistrovice',address:'Fixture address'};
const payment={_id:'507f1f77bcf86cd799439497',display_id:1080,bookingId,clientId,retreatId,amount:2250,currency:'PLN',usd_amount:585,status:'completed',paymentDate:'2026-10-01',paymentMethod:'bank_transfer',paymentType:'deposit_non_refundable',isRefundable:false};
async function fixture(page:Page,baseURL:string,mode='normal'){
 const writes:any[]=[];
 const booking={_id:bookingId,bookingNumber:1186,bookingHash:'overview-fixture-hash',clientId:client,retreatId:retreat,bookingType:mode==='booster'?'booster':'regular',boosterStartDate:'2027-06-03',boosterEndDate:'2027-06-04',totalAmount:7500,currency:'PLN',roomType:'private',roomNumber:'Garden',status:'confirmed',registrationDate:'2026-09-01',checkInDate:'2027-06-01',checkOutDate:'2027-06-08'};
 const payments=mode==='overpaid'?[{...payment,amount:2050,currency:'USD',usd_amount:2050}]:[payment];
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-overview-fixture');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin===new URL(baseURL).origin && !url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
  if(!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push({path,method:request.method()});
  if(path==='/environment/status')data={production:true};
  if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
  if(path==='/submission-notifications/unread-count')data={count:0};
  if(path===`/bookings/${bookingId}`)data=booking;
  if(path.startsWith('/bookings/retreat/'))data=[booking];
  if(path===`/clients/${clientId}`)data=client;
  if(path==='/clients')data=[client];
  if(path==='/retreats')data=[retreat];
  if(path===`/retreats/${retreatId}`)data=retreat;
  if(path===`/payments/by-booking/${bookingId}`||path==='/payments/by-booking-hash/overview-fixture-hash')data=payments;
  if(path==='/payments/convert-to-usd')data={amount:Number(url.searchParams.get('amount')),currency:url.searchParams.get('currency'),usd_amount:Number(url.searchParams.get('amount'))*0.26};
  if(path===`/payments/plan-settings/booking/${bookingId}`)data=null;
  if(path.endsWith(`/bookings/${bookingId}/requirements`))data={items:[],artifacts:[],documents:[],documentCandidates:[],reviews:[],requirements:[],templates:[],libraryTemplates:[],actionLogs:[]};
  if(path.endsWith(`/bookings/${bookingId}/workflow-snapshot`))data={items:[],templates:[],actionLogs:[]};
  return route.fulfill({json:data});
 });
 return writes;
}
for(const viewport of [{width:1440,height:1050},{width:390,height:844}])test(`payment-first overview and working navigation at ${viewport.width}px`,async({page,baseURL})=>{
 await page.setViewportSize(viewport);const writes=await fixture(page,baseURL!);
 await page.goto(`/admin/bookings/${bookingId}`);
 const overview=page.locator('.booking-overview-layout');await expect(overview.getByRole('heading',{name:'Payments',exact:true})).toBeVisible();
 await expect(overview.locator('.booking-balance-metric.received')).toContainText('$585.00');
 await expect(overview.locator('.booking-balance-metric.outstanding')).toContainText('$1,365.00');
 await expect(overview.getByRole('table')).toContainText('1080');
 await page.screenshot({path:`test-results/ppvc494-${viewport.width}-overview.png`});
 for(const name of ['Requirements next up','Retreat information','Booking dates'])await expect(overview.locator('details').filter({has:page.getByText(name,{exact:true})})).not.toHaveAttribute('open','');
 await overview.getByText('Retreat information',{exact:true}).click();
 await expect(overview.locator('.booking-overview-disclosure[open]')).toContainText('F494');
 await overview.getByText('Retreat information',{exact:true}).click();
 await overview.locator('summary').filter({hasText:'Booking dates'}).focus();await page.keyboard.press('Enter');await expect(overview.locator('.booking-overview-disclosure[open]')).toContainText('Jun 1, 2027');await overview.getByText('Booking dates',{exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(writes).toHaveLength(0);
 await page.getByRole('tab',{name:'Payments',exact:true}).click();await expect(page.locator('.booking-balance-metric.outstanding')).toContainText('$1,365.00');
 await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await overview.getByText('Requirements next up',{exact:true}).click();await overview.getByRole('button',{name:'Open all requirements'}).click();await expect(page.getByRole('tab',{name:/^Requirements(?:\s|$)/})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await overview.getByRole('button',{name:'Record a payment',exact:true}).click();
 await expect(page).toHaveURL(new RegExp(`/admin/payments/new\\?bookingId=${bookingId}&clientId=${clientId}`));expect(writes).toHaveLength(0);
});

test('overpayment remains a client credit after reload',async({page,baseURL})=>{
 await fixture(page,baseURL!,'overpaid');await page.goto(`/admin/bookings/${bookingId}`);
 const overview=page.locator('.booking-overview-layout');await expect(overview.locator('.booking-balance-metric.outstanding')).toContainText('Overpaid');await expect(overview.locator('.booking-balance-metric.outstanding')).toContainText('$100.00');
 await page.reload();await expect(page.locator('.booking-balance-metric.outstanding')).toContainText('$100.00');
});

test('booster summary and booking-date disclosure show the actual overnight stay',async({page,baseURL})=>{
 await fixture(page,baseURL!,'booster');await page.goto(`/admin/bookings/${bookingId}`);const overview=page.locator('.booking-overview-layout');
 await overview.getByText('Booking dates',{exact:true}).click();const dates=overview.locator('details[open]');
 await expect(dates).toContainText('Jun 3, 2027');await expect(dates).toContainText('Jun 4, 2027');await expect(dates).not.toContainText('Jun 8, 2027');
});
