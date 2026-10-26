import {test,expect} from '@playwright/test';
for(const width of [1440,390])test(`compact scratchpad filters and totals ${width}px`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});let writes=0;const queries:URLSearchParams[]=[];
 const row={_id:'507f1f77bcf86cd799439869',revision:0,receivedDate:'2026-10-16',amount:'5100.00',amountMinor:510000,currency:'PLN',provider:'csob',account:'PLN wallet',payer:'Synthetic Payer',requestNumber:'001243',reference:'Transfer',status:'unassigned',history:[]};
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-scratchpad');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin'}));});
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===new URL(baseURL!).origin&&!u.pathname.startsWith('/api/'))return route.continue();const p=u.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes++;
  if(p==='/payment-scratchpad'){
   queries.push(u.searchParams);const status=u.searchParams.get('status');const match=(!u.searchParams.get('account')||row.account.includes(u.searchParams.get('account')!))&&(status==='all'||status==='unassigned'||!status);
   data={items:match?[row]:[],total:match?1:0,page:1,limit:25,refreshedAt:'2026-10-18T12:00:00Z',totals:[{currency:'PLN',status:'logged',count:1,amount:'5100.00'},{currency:'PLN',status:'unassigned',count:1,amount:'5100.00'}]};
  }
  if(p==='/environment/status')data={production:true};if(p==='/users/navigation-permissions'||p==='/config-summary')data={};return route.fulfill({json:data});});
 await page.goto('/admin/payments/scratchpad');const receipts=page.getByRole('table',{name:'Receipts',exact:true});await expect(receipts).toContainText('Synthetic Payer');
 await expect(page.getByRole('table',{name:'Totals by currency and status'})).toContainText('5,100.00');
 await page.getByRole('button',{name:'7 days',exact:true}).click();await expect.poll(()=>queries.some(q=>Boolean(q.get('from'))&&Boolean(q.get('to')))).toBe(true);
 await page.getByRole('button',{name:'Custom',exact:true}).click();await page.getByLabel('From date',{exact:true}).fill('2026-10-01');await expect.poll(()=>queries.some(q=>q.get('from')==='2026-10-01')).toBe(true);
 await page.getByRole('button',{name:'All time',exact:true}).click();await expect(page.getByLabel('From date',{exact:true})).toHaveCount(0);
 await page.keyboard.press('/');await expect(page.getByLabel('Search payer, phone, transaction or request number',{exact:true})).toBeFocused();
 await page.getByLabel('Filter account',{exact:true}).fill('PLN wallet');await expect.poll(()=>queries.some(q=>q.get('account')==='PLN wallet')).toBe(true);
 await page.getByRole('group',{name:'Receipt status'}).getByRole('button',{name:'Excluded',exact:true}).click();await expect(receipts).not.toContainText('Synthetic Payer');await expect(page).toHaveURL(/status=excluded/);
 await page.getByRole('group',{name:'Receipt status'}).getByRole('button',{name:'Unassigned',exact:true}).click();await expect(receipts).toContainText('Synthetic Payer');
 await page.reload();await expect(page.getByLabel('Filter account',{exact:true})).toHaveValue('PLN wallet');await expect(receipts).toContainText('Synthetic Payer');
 await page.screenshot({path:`../ppvc-939-validation/scratchpad-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByLabel('Filter account',{exact:true})).toHaveValue('');expect(writes).toBe(0);
});
