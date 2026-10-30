import {test,expect} from '@playwright/test';
import path from 'node:path';
for(const width of [1440,390])test(`scratchpad totals stay on demand without writes or filter changes at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});let writes=0,reads=0;
 const totals=['CZK','EUR','PLN','USD'].flatMap((currency,i)=>['logged','unassigned','converted','excluded'].map((status,j)=>({currency,status,amount:j===3?'0.00':`${(i+1)*1000}.00`,count:j===3?0:i+1})));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();if(r.method()!=='GET'){writes++;return route.abort();}
 if(u.pathname==='/payment-scratchpad'){reads++;return route.fulfill({json:{items:[{_id:'receipt',display_id:970,revision:0,receivedDate:'2026-10-30',amount:'3000.00',currency:'PLN',provider:'csob',payer:'Synthetic receipt',account:'Test account',status:'unassigned'}],total:1,page:1,limit:25,refreshedAt:'2026-10-30T12:00:00Z',totals:totals.filter(t=>!u.searchParams.get('currency')||t.currency===u.searchParams.get('currency'))}});}
 return route.fulfill({json:u.pathname==='/users/navigation-permissions'||u.pathname.includes('config-summary')?{}:u.pathname==='/environment/status'?{production:true}:[]});});
 await page.goto('/admin/payments/scratchpad?status=all');await expect(page.getByRole('table',{name:'Receipts',exact:true})).toBeVisible();await expect(page.getByRole('table',{name:'Totals by currency and status'})).toHaveCount(0);
 const trigger=page.getByRole('button',{name:'View totals',exact:true});await expect(trigger).toBeEnabled();const url=page.url(),beforeReads=reads;
 await trigger.click();const dialog=page.getByRole('dialog',{name:'Scratchpad totals'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('table',{name:'Totals by currency and status'})).toBeVisible();await expect(dialog.getByRole('row',{name:'PLN',exact:true})).toContainText('3,000.00');
 await dialog.getByText('How totals work',{exact:true}).click();await expect(dialog.getByText(/Currencies are never combined/)).toBeVisible();expect(page.url()).toBe(url);expect(reads).toBe(beforeReads);expect(writes).toBe(0);
 if(process.env.SCRATCHPAD_TOTALS_ARTIFACT_DIR)await dialog.screenshot({path:path.join(process.env.SCRATCHPAD_TOTALS_ARTIFACT_DIR,`totals-${width}.png`)});
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
 await page.getByLabel('Filter currency').selectOption('PLN');await expect.poll(()=>reads).toBeGreaterThan(beforeReads);const filteredUrl=page.url();await trigger.click();await expect(dialog.getByRole('row',{name:'PLN',exact:true})).toBeVisible();await expect(dialog.getByRole('row',{name:'EUR',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Close totals',exact:true}).click();await expect(dialog).toBeHidden();expect(page.url()).toBe(filteredUrl);await expect(page.getByLabel('Filter currency')).toHaveValue('PLN');
 await trigger.click();await expect(dialog).toBeVisible();await page.locator('.ant-modal-wrap').click({position:{x:5,y:150}});await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();expect(writes).toBe(0);
 if(process.env.SCRATCHPAD_TOTALS_ARTIFACT_DIR)await page.locator('.scratchpad-overview').screenshot({path:path.join(process.env.SCRATCHPAD_TOTALS_ARTIFACT_DIR,`compact-${width}.png`)});
});
