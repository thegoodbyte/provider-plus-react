import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`receipt wizard card and read-only navigation at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});
 const ids=['a'.repeat(24),'b'.repeat(24)];let writes=0;
 const rows=ids.map((_id,i)=>({_id,display_id:1052+i,revision:0,receivedDate:'2026-11-20',amount:'4500.00',amountMinor:450000,currency:'PLN',provider:'csob',account:'PLN account',payer:'Synthetic receipt client',phone:'+420 777 123 456',requestNumber:'001052',reference:'Reference'.repeat(12),externalId:'Transaction'.repeat(10),status:'unassigned',reconciliationPending:i===1,history:[{action:'created',actor:'Synthetic admin',at:'2026-11-20T12:00:00Z',after:{notes:'Synthetic receipt history'}}]}));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();
  if(req.method()!=='GET'){writes++;return route.abort();}
  const p=u.pathname;
  if(p==='/payment-scratchpad')return route.fulfill({json:{items:rows,total:2,page:1,limit:25,totals:[],refreshedAt:'2026-11-20T12:00:00Z'}});
  if(p.includes('/payment-scratchpad/')&&p.endsWith('/matches'))return route.fulfill({status:404,json:{message:'Synthetic matching unavailable'}});
  if(p.includes('/payment-scratchpad/')&&p.endsWith('/candidates'))return route.fulfill({json:{payments:[],requests:[]}});
  if(p.startsWith('/payment-scratchpad/'))return route.fulfill({json:rows.find(x=>p.endsWith(x._id))});
  if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/payments/scratchpad/'+ids[0]);
 const card=page.getByRole('region',{name:'Receipt details'}),progress=page.getByRole('list',{name:'Scratchpad progress'});
 await expect(card).toBeVisible();await expect(page.getByText('Receipt 1 of 2',{exact:true})).toBeVisible();
 await expect(progress.locator('[aria-current="step"]')).toContainText('Record receipt');
 for(const step of await progress.getByRole('listitem').all()){
  const box=await step.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
 }
 await page.screenshot({path:info.outputPath(`receipt-header-${width}.png`),fullPage:true,animations:'disabled'});
 for(const name of ['Bank','Date','Phone','Request hint','Reference','Transaction'])await expect(card.getByText(name,{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Previous receipt',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toBeVisible();
 await card.getByText('Receipt history',{exact:true}).click();await expect(card.getByText('Saved Notes: Synthetic receipt history')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`receipt-${width}.png`),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Record payment from SP',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(progress.locator('[aria-current="step"]')).toContainText('Match payment request & confirm');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Next receipt',exact:true}).click();await expect(page).toHaveURL(new RegExp(ids[1]+'$'));
 await expect(page.getByText('Receipt 2 of 2',{exact:true})).toBeVisible();await expect(card.getByText(/Reconciliation is pending/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Record payment from SP',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);expect(writes).toBe(0);
});
