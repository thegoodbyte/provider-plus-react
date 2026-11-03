import {test,expect,Page} from '@playwright/test';
const id='507f1f77bcf86cd799439011';
async function fixture(page:Page, failed=false) {
 let fail=failed; const writes:string[]=[];
 const client={_id:'c1',display_id:1084,firstName:'Synthetic',lastName:'Guest',email:'guest@example.invalid',phone:'+48123456789',country:'PL'};
 const retreat={_id:'r1',code:'JNO-11-17-26',name:'JNO-11-17-26',startDate:'2099-11-17',endDate:'2099-11-24',address:'Synthetic venue'};
 const booking={_id:id,bookingNumber:1331,status:'confirmed',bookingType:'booster',clientId:client,retreatId:retreat,boosterStartDate:'2099-11-18',boosterEndDate:'2099-11-20',roomType:'shared',currency:'PLN',totalAmount:3750,bookingConfirmationHistory:[]};
 const items=[{_id:'step-call',key:'call_client',title:'Call client',category:'task',status:'pending',assignedTo:'Reception',isBlocking:true,bookingId:id,order:1}, { _id:'step-contract',key:'contract_received',title:'Contract received',category:'document',status:'pending',isBlocking:true,metadata:{requiredFromClient:true,isRequirement:true},bookingId:id },{_id:'step-confirm',key:'booking_confirmation_sent',title:'Confirmation',category:'message',status:'completed',bookingId:id,emailSentAt:'2026-10-30'}];
 await page.route('**/*',async route=>{
  const r=route.request(); if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();
  const p=new URL(r.url()).pathname.replace(/^\/api(?=\/)/,'');
  if(r.method()!=='GET'){writes.push(r.method()+' '+p);return route.fulfill({status:500,json:{message:'Unexpected write in read-only design journey'}});}
  if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(p===`/bookings/${id}`)return route.fulfill({json:booking});
  if(p.includes('/bookings/retreat/'))return route.fulfill({json:[booking]});
  if(p.endsWith('/financial-summary'))return fail?route.fulfill({status:503,json:{message:'Unavailable'}}):route.fulfill({json:{currency:'PLN',price:3750,netPaid:1500,balance:2250,overpayment:0,sourceState:'verified_ledger',paidInFull:false}});
  if(p.endsWith('/requirement-projection/ekg'))return route.fulfill({json:{version:1,bookingId:id,state:'not_applicable',label:'Not applicable',applicable:false,required:false,satisfied:true,nextAction:'none'}});
  if(p.endsWith('/requirements'))return fail?route.fulfill({status:503,json:{message:'Requirements unavailable'}}):route.fulfill({json:{items,artifacts:[],documents:[],reviews:[],requirements:[{itemId:'step-contract',key:'contract_received',state:'missing',requiredFromClient:true,reviewRequired:false}]}});
  if(p.endsWith('/workflow-snapshot'))return route.fulfill({json:{items,documents:[],actionLogs:[]}});
  if(p.includes('/payments/booking/'))return route.fulfill({json:[]});
  if(p==='/retreats')return route.fulfill({json:[retreat]});
  return route.fulfill({json:[]});
 });
 return {writes,recover:()=>{fail=false;}};
}
for(const width of [1440,1024,390]) test(`booking overview hierarchy and navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});const f=await fixture(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/admin/bookings/${id}`);
 const tabs=page.getByRole('tablist',{name:'Booking sections'});const next=page.getByRole('region',{name:'Next step from me'});const overview=page.getByRole('region',{name:'Booking overview'});
 await expect(next.getByRole('status')).toHaveText('Blocked');await expect(overview.getByText('40% paid')).toBeVisible();
 const bounds=await tabs.boundingBox(); const nextBounds=await next.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(nextBounds!.y+1);const workspaceBounds=await page.locator('.booking-workspace').boundingBox();expect(bounds!.y-workspaceBounds!.y).toBeLessThan(width<700?260:200);
 expect(await page.locator('.detail-header').evaluate(e=>getComputedStyle(e).position)).toBe('static');
 const waiting=next.locator('details').filter({has:page.locator('summary').filter({hasText:'Waiting for others'})});await expect(waiting).not.toHaveAttribute('open','');await waiting.locator('summary').click();await expect(waiting.getByText('Waiting on client')).toBeVisible();await waiting.locator('summary').click();
 await expect(overview.getByText('Check-in').locator('..')).toContainText('Nov 18, 2099');await expect(overview.getByText('Check-out').locator('..')).toContainText('Nov 20, 2099');await expect(overview.getByText('Shared room')).toBeVisible();
 await expect(overview.getByRole('link',{name:'guest@example.invalid'})).toHaveAttribute('href','mailto:guest@example.invalid');await expect(overview.getByRole('link',{name:'+48123456789'})).toHaveAttribute('href','tel:+48123456789');
 await expect(overview.getByText('Synthetic venue')).not.toBeVisible();await overview.getByText('Location & booking details').click();await expect(overview.getByText('Synthetic venue')).toBeVisible();await overview.getByText('Location & booking details').click();
 await page.getByLabel('More booking actions').click();const language=page.getByRole('combobox',{name:'Confirmation language'});await language.selectOption('en');await expect(page.getByLabel('Review email with PDF attachment')).toContainText('EN');await expect(page.getByRole('button',{name:'Preview PDF',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeVisible();await page.getByRole('button',{name:'Send email with PDF attachment'}).click();const sendDialog=page.getByRole('dialog',{name:'Send booking confirmation?'});await expect(sendDialog).toContainText('guest@example.invalid');await expect(sendDialog).toContainText('English');await sendDialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByLabel('More booking actions').click();
 await page.getByRole('tab',{name:'Activity',exact:true}).click();await expect(next).toHaveCount(0);await page.getByRole('tab',{name:'Overview',exact:true}).click();await expect(next).toBeVisible();
 await page.locator('.workspace-content').evaluate(e=>e.scrollTo(0,0));await page.screenshot({path:`${process.env.BOOKING_DESIGN_ARTIFACT_DIR||'test-results'}/overview-${width}.png`});
 for(const name of ['Edit booking','Review email with PDF attachment','More booking actions']){const b=await page.getByLabel(name,{exact:true}).boundingBox();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);}
 await overview.getByRole('link',{name:'guest@example.invalid'}).scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.BOOKING_DESIGN_ARTIFACT_DIR||'test-results'}/contact-${width}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(f.writes).toEqual([]);expect(errors).toEqual([]);
});
test('unavailable financial and readiness sources stay explicit and recover',async({page})=>{
 await page.setViewportSize({width:390,height:1000});const f=await fixture(page,true);await page.goto(`/admin/bookings/${id}`);
 const next=page.getByRole('region',{name:'Next step from me'});await expect(next.getByRole('status')).toHaveText('Readiness unknown');await expect(page.getByRole('region',{name:'Payment summary'})).toContainText('Financial summary unavailable');expect(await page.getByRole('progressbar').count()).toBe(0);
 f.recover();await page.getByRole('button',{name:'Retry payment summary'}).click();await next.getByRole('button',{name:'Retry readiness'}).click();await expect(next.getByRole('status')).toHaveText('Blocked');await expect(page.getByText('40% paid')).toBeVisible();expect(f.writes).toEqual([]);
});
