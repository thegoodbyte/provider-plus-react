import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath = process.env.PARTIAL_RECEIPT_FIXTURE;
const fixture = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')) : null;
test.skip(!fixture, 'Requires the real-Mongo fixture. See docs/partial-receipt-tests.md; a skipped run does not satisfy the persistence gate.');
for (const width of [1440, 390]) test(`partial receipt, payment tracking and later allocation ${width}px`, async ({page,request,baseURL}, testInfo) => {
  await request.post(fixture.url+'/fixture/partial-reset');
  const writes: string[]=[];
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(({token})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin'}));},{token:fixture.tokens.admin});
  try {
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===new URL(baseURL!).origin&&!url.pathname.startsWith('/api/'))return route.continue();
    const path=url.pathname.replace(/^\/api(?=\/)/,'');
    if(/^\/(payments|payment-requests|clients|bookings|retreats)(\/|$)/.test(path)){
      if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push(path);
      const response=await request.fetch(fixture.url+path+url.search,{method:req.method(),headers:{...req.headers(),Authorization:'Bearer '+fixture.tokens.admin},data:req.postData()||undefined});
      return route.fulfill({response});
    }
    return route.fulfill({json:path==='/environment/status'?{production:false}:path==='/users/navigation-permissions'||path==='/config-summary'?{}:[]});
  });
  const choose=async(number:number)=>{const box=page.getByRole('combobox',{name:'Booking 1',exact:true});await box.fill(String(number));await page.getByRole('option',{name:new RegExp('#'+number+' ')}).click();};
  await page.goto('/admin/payments/joint/new?receiptId='+fixture.ids.receipt);
  await expect(page.getByRole('button',{name:'Confirm receipt split'})).toBeVisible();
  await choose(9461);await page.getByTitle('Remove allocation').nth(1).click();
  await page.getByLabel('Allocated amount').fill('7600.01');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm receipt split'}).click();
  await expect(page.getByText(/Allocations exceed the available funds/)).toBeVisible();expect(writes).toHaveLength(0);
  await page.getByLabel('Allocated amount').fill('3800');await page.getByRole('button',{name:'Confirm receipt split'}).click();
  await expect(page).toHaveURL(/receipts\?receiptId=/);
  let summary=page.getByRole('region',{name:'Shared payment allocation'});
  await expect(summary).toContainText('Unused 3,800.00 PLN');
  let data=await (await request.get(fixture.url+'/fixture/snapshot')).json();
  expect(data.PaymentReceipt).toHaveLength(1);expect(data.Payment.filter((p:any)=>p.receiptUnallocated)[0].amount).toBe(3800);expect(data.RetreatClient.find((b:any)=>b._id===fixture.ids.ba).amountPaid).toBe(3800);expect(data.RetreatClient.find((b:any)=>b._id===fixture.ids.bb).amountPaid||0).toBe(0);
  await page.goto('/admin/payments/'+fixture.ids.source);summary=page.getByRole('region',{name:'Shared payment allocation'});await expect(summary).toContainText('Received 7,600.00 PLN');await expect(summary).toContainText('Unused 3,800.00 PLN');
  await page.reload();await expect(summary).toContainText('Allocated 3,800.00 PLN');
  await summary.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('partial-payment.png'),fullPage:true});
  expect((await summary.boundingBox())!.width).toBeLessThan(width);
  await summary.getByRole('link',{name:'Allocate unused funds'}).click();
  await expect(page.getByLabel(/Total received/)).toHaveValue('3800');
  await choose(9462);await page.getByTitle('Remove allocation').nth(1).click();await page.getByLabel('Allocated amount').fill('3800');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm receipt split'}).click();
  await expect(page).toHaveURL(/receipts\?receiptId=/);summary=page.getByRole('region',{name:'Shared payment allocation'});await expect(summary).toContainText('Allocated 7,600.00 PLN');await expect(summary).toContainText('Unused 0.00 PLN');await expect(summary.getByRole('link',{name:'Allocate unused funds'})).toHaveCount(0);
  await page.reload();await expect(summary).toContainText('Unused 0.00 PLN');await summary.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('fully-allocated.png'),fullPage:true});
  data=await (await request.get(fixture.url+'/fixture/snapshot')).json();expect(data.PaymentReceipt).toHaveLength(1);expect(data.Payment.filter((p:any)=>p.receiptId===fixture.ids.receipt).reduce((sum:number,p:any)=>sum+p.amount,0)).toBe(7600);for(const id of [fixture.ids.ba,fixture.ids.bb])expect(data.RetreatClient.find((b:any)=>b._id===id).amountPaid).toBe(3800);expect(writes).toHaveLength(2);expect(writes.every(path=>path.endsWith('/allocations'))).toBe(true);
  } finally {
    await page.unrouteAll({behavior:'wait'});
  }
});
