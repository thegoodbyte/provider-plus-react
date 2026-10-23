import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath=process.env.SCRATCHPAD_FIXTURE_PATH;
const f:any=fixturePath?JSON.parse(fs.readFileSync(fixturePath,'utf8')):{};
test.skip(!fixturePath,'Requires disposable scratchpad API fixture.');
test('reopening a receipt whose linked payment was removed returns it to Unassigned',async({page,request})=>{
 await request.post(f.url+'/fixture/reset');
 await page.setViewportSize({width:1440,height:980});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',role:'admin',email:'scratchpad@example.invalid'}));},f.token);
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const url=new URL(r.url());
  if(url.pathname.startsWith('/payment-scratchpad'))return route.fulfill({response:await route.fetch({url:f.url+url.pathname+url.search})});
  if(url.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(url.pathname.includes('config-summary'))return route.fulfill({json:{}});return route.fulfill({json:[]});
 });
 await page.goto(`/admin/payments/scratchpad/${f.missingPaymentRowId}`);
 await expect(page.getByText('The linked payment was removed.',{exact:false})).toBeVisible();
 // Reopening is blocked until a reason is given.
 const reopenButton=page.getByRole('button',{name:'Reopen receipt'});
 await expect(reopenButton).toBeDisabled();
 await page.getByLabel('Reason for reopening').fill('Payment was deleted in error during cleanup');
 await expect(reopenButton).toBeEnabled();
 page.once('dialog',dialog=>dialog.accept());
 await reopenButton.click();
 await page.waitForURL('**/admin/payments/scratchpad');
 // Back on the list, the receipt is a normal Unassigned row again -- no
 // longer flagged, no longer stuck.
 await page.getByRole('button',{name:'Duplicate review',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'Missing payment 913'})).toHaveCount(0);
 await page.getByRole('button',{name:'Unassigned',exact:true}).click();
 const reopenedRow=page.getByRole('row').filter({hasText:'Missing payment 913'});
 await expect(reopenedRow).toContainText('unassigned');
 const snapshot=await (await request.get(f.url+'/fixture/snapshot')).json();
 const record=snapshot.scratchpad.find((row:any)=>row._id===f.missingPaymentRowId);
 expect(record.status).toBe('unassigned');
 expect(record.paymentId).toBeUndefined();
 expect(record.history.some((h:any)=>h.action==='reopened')).toBe(true);
});
