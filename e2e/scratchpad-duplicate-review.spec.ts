import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.SCRATCHPAD_FIXTURE_PATH;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable scratchpad API fixture.');
for(const width of [1440,390])test(`read-only duplicate review at ${width}px`,async({page,request})=>{
 await request.post(f.url+'/fixture/reset');
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();
 const before=await snapshot();
 await page.setViewportSize({width,height:980});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'scratchpad@example.invalid'}));},f.token);
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const url=new URL(r.url());
  if(url.pathname.startsWith('/payment-scratchpad')){expect(r.method()).toBe('GET');return route.fulfill({response:await route.fetch({url:f.url+url.pathname+url.search})});}
  if(url.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(url.pathname.includes('config-summary'))return route.fulfill({json:{}});return route.fulfill({json:[]});
 });
 await page.goto('/admin/payments/scratchpad');await page.getByRole('button',{name:'Duplicate review',exact:true}).click();
 await expect(page.getByText('Reconciled receipts that now look wrong',{exact:false})).toBeVisible();
 const duplicateRow=page.getByRole('row').filter({hasText:'Duplicate review 913'});
 await expect(duplicateRow).toBeVisible();
 await expect(duplicateRow).toContainText('Possible duplicate');
 await expect(duplicateRow.getByRole('link',{name:/payment #1913/})).toHaveAttribute('href',/\/admin\/payments\//);
 const missingRow=page.getByRole('row').filter({hasText:'Missing payment 913'});
 await expect(missingRow).toContainText('Linked payment removed');
 // Only the two genuinely suspicious rows appear -- a converted receipt
 // with a real, non-duplicated payment (seeded elsewhere in the fixture
 // for the booking-review tab) must never show up here.
 await expect(page.getByRole('row').filter({hasText:'Booking candidate 907'})).toHaveCount(0);
 await expect(page.getByRole('row').filter({hasText:'Existing candidate 907'})).toHaveCount(0);
 const search=page.getByRole('textbox',{name:'Search payer, phone, transaction or request number'});
 await search.fill('Duplicate review 913');await expect(missingRow).toHaveCount(0);await expect(duplicateRow).toBeVisible();
 await search.fill('');await expect(missingRow).toBeVisible();
 await page.reload();await expect(page.getByText('Reconciled receipts that now look wrong',{exact:false})).toBeVisible();
 expect(await snapshot()).toEqual(before);
 await duplicateRow.scrollIntoViewIfNeeded();
 await page.screenshot({path:`../ppvc-913-validation/duplicate-review-${width}.png`,fullPage:true});
});
