import {test,expect} from '@playwright/test';
import path from 'node:path';
for(const width of [1440,390])for(const screen of ['booking','retreat'])test(`refund persists original and linked refund from ${screen} at ${width}px`,async({page})=>{
 const f=await require(path.resolve(process.env.TEST_API_CHECKOUT||'../api','test/gbp-currency.fixture.cjs')).createFixture();
 try {
  const {ReceiptAllocationService}=require(path.resolve(process.env.TEST_API_CHECKOUT||'../api','dist/payments/receipt-allocation.service'));f.paymentService.receiptAllocations=new ReceiptAllocationService(f.models.Payment,f.models.PaymentReceipt,f.models.PaymentRequest,f.models.RetreatClient,f.paymentService.sequenceCounterService);await f.app.listen(0,'127.0.0.1');const url=await f.app.getUrl();
  const original=await f.paymentService.create({clientId:f.ids.clients[0],retreatId:f.ids.retreat,bookingId:f.ids.bookings[0],paymentRequestId:f.ids.requests[0],amount:100,currency:'GBP',status:'completed',paymentMethod:'bank_transfer',paymentType:'regular_payment',isRefundable:true,paymentDate:new Date('2026-11-20')},{role:'admin'});
  const writes:string[]=[];
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({role:'admin',email:'admin@example.invalid'}))},f.tokens.admin);
  await page.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();
   const p=u.pathname.replace(/^\/api(?=\/)/,'');
   if(/^\/(payments|payment-requests|bookings|clients|retreats)(\/|$)/.test(p)){
    if(q.method()!=='GET'){writes.push(q.method()+' '+p);expect(q.method()).toBe('PUT');expect(p).toBe('/payments/'+original._id+'/refund');expect(q.postDataJSON().refundAmount).toBe(screen==='booking'?100:25)}
    return route.fulfill({response:await route.fetch({url:url+p+u.search})});
   }
   if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
   return route.fulfill({json:[]});
  });
  const dialogs=async(dialog:any)=>{if(dialog.type()==='confirm')return dialog.accept();await dialog.accept(dialog.message().includes('amount')?'25':'Duplicate transfer')};page.on('dialog',dialogs);
  await page.goto(screen==='booking'?'/admin/bookings/'+f.ids.bookings[0]:'/admin/retreats/'+f.ids.retreat+'/payments');
  if(screen==='booking'){
   await page.getByRole('tab',{name:'Payments',exact:true}).click();
   const region=page.getByRole('region',{name:'Payments — recorded transactions'});
   await region.getByLabel('More actions for payment '+original.display_id).click();await region.getByRole('button',{name:'Refund',exact:true}).click();
  }else await page.getByTitle('Process Refund').first().click();
  await expect.poll(()=>f.models.Payment.countDocuments({originalPaymentId:original._id})).toBe(1);
  const refund=await f.models.Payment.findOne({originalPaymentId:original._id}).lean();expect(refund.amount).toBe(screen==='booking'?-100:-25);expect(refund.notes).toContain(screen==='booking'?'Manual refund':'Duplicate transfer');
  const retained=await f.models.Payment.findById(original._id).lean();expect(retained.amount).toBe(100);expect(retained.status).toBe('completed');expect(writes).toHaveLength(1);
  await page.reload();await page.waitForLoadState('networkidle');expect(await f.models.Payment.countDocuments({originalPaymentId:original._id})).toBe(1);expect(writes).toHaveLength(1);
  await page.screenshot({path:test.info().outputPath('refund-'+screen+'-'+width+'.png'),fullPage:true});
 }finally{await page.waitForLoadState('networkidle').catch(()=>{});await page.unrouteAll({behavior:'wait'});await page.close();f.app.getHttpServer().closeIdleConnections?.();await f.close()}
});
