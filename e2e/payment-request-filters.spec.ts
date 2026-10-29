import { test, expect } from '@playwright/test';
for (const [width, timezoneId] of [[1440, 'America/Los_Angeles'], [390, 'Pacific/Kiritimati']] as const) {
 test.describe(`${width}px ${timezoneId}`, () => {
 test.use({ timezoneId });
 test('conjunctive payment-request filters and reset without writes', async ({page}) => {
  await page.setViewportSize({width,height:980});
  const base={clientId:{_id:'client',firstName:'Ewa',lastName:'Franus'},requestedAmount:2500.25,currency:'PLN',status:'sent',paymentDate:'2026-10-29'};
  const records=[
   {...base,_id:'match',invoiceNumber:'MATCH'},
   {...base,_id:'paid',invoiceNumber:'PAID',status:'paid'},
   {...base,_id:'other-name',invoiceNumber:'OTHER-NAME',clientId:{firstName:'Samuel'}},
   {...base,_id:'other-currency',invoiceNumber:'OTHER-CURRENCY',currency:'EUR'},
   {...base,_id:'other-amount',invoiceNumber:'OTHER-AMOUNT',requestedAmount:2500.26},
   {...base,_id:'next-day',invoiceNumber:'NEXT-DAY',paymentDate:'2026-10-30'},
   {...base,_id:'missing',invoiceNumber:'MISSING-DATE',paymentDate:null},
  ];
  const writes:string[]=[];
  await page.route('**/*',async route=>{
   const r=route.request(); if(!['xhr','fetch'].includes(r.resourceType())) return route.continue();
   if(!['GET','HEAD'].includes(r.method())) writes.push(r.method()+' '+r.url());
   const path=new URL(r.url()).pathname;
   if(path==='/payment-requests') return route.fulfill({json:records});
   if(path==='/environment/status') return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
   if(path.includes('config-summary')) return route.fulfill({json:{}});
   return route.fulfill({json:[]});
  });
  await page.goto('/admin/payment-requests');
  await expect(page.getByRole('button',{name:'MATCH',exact:true})).toBeVisible();
  await page.getByLabel('Client name',{exact:true}).fill('franus');
  await page.getByLabel('Requested amount from',{exact:true}).fill('2500.25');
  await page.getByLabel('Requested amount to',{exact:true}).fill('2500.25');
  await page.getByLabel('Currency',{exact:true}).selectOption('PLN');
  await page.getByLabel('Request date from',{exact:true}).fill('2026-10-29');
  await page.getByLabel('Request date to',{exact:true}).fill('2026-10-29');
  await page.getByLabel('Payment status',{exact:true}).selectOption('unpaid');
  await expect(page.getByRole('button',{name:'MATCH',exact:true})).toBeVisible();
  await expect(page.getByText('1 of 7 requests',{exact:true})).toBeVisible();
  await page.getByRole('group',{name:'Detailed filters'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${process.env.FILTER_ARTIFACT_DIR || 'test-results'}/filters-${width}.png`,fullPage:true});
  await page.getByLabel('Search payment requests').fill('PAID');
  await expect(page.getByText(/No payment requests match your filters/)).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await expect(page.getByText('7 of 7 requests',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Client name',{exact:true})).toHaveValue('');
  await page.getByLabel('Request date from',{exact:true}).fill('2026-10-30');
  await page.getByLabel('Request date to',{exact:true}).fill('2026-10-29');
  await expect(page.getByRole('group',{name:'Detailed filters'}).getByRole('alert')).toContainText('must not be after');
  expect(writes).toEqual([]);
  const bounds=await page.getByRole('group',{name:'Detailed filters'}).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
 });
 });
}
