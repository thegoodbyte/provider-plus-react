import {test,expect} from '@playwright/test';
import fs from 'fs';
const fixturePath=process.env.GUIDED_SCRATCHPAD_FIXTURE;
test.skip(!fixturePath,'Requires the real local API/MongoDB fixture');
for(const width of [1440,390])test(`guided matching, metadata persistence and exclusion ${width}px`,async({page,request,baseURL})=>{
 const fixture=JSON.parse(fs.readFileSync(fixturePath!,'utf8'));
 const reset=await request.post(fixture.url+'/fixture/guided-reset');expect(reset.ok()).toBe(true);const {ids}=await reset.json();
 await page.setViewportSize({width,height:1000});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin'}));},fixture.tokens.admin);
 let moneyWrites=0;
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===new URL(baseURL!).origin&&!u.pathname.startsWith('/api/'))return route.continue();const path=u.pathname.replace(/^\/api(?=\/)/,'');
 if(path==='/room-inventory/options')return route.fulfill({json:[{key:'shared',active:true,labels:{en:'Shared'},occupancy:'shared',legacyRoomType:'shared'}]});
 if(/^\/(payment-scratchpad|payments|payment-requests|clients|bookings|retreats)(\/|$)/.test(path)){
  if(req.method()==='POST'&&(/match-payment|reconcile/.test(path)))moneyWrites++;
  return route.fulfill({response:await route.fetch({url:fixture.url+path+u.search,headers:{...req.headers(),authorization:'Bearer '+fixture.tokens.admin}})});
 }
 return route.fulfill({json:path==='/environment/status'?{production:true}:path==='/users/navigation-permissions'||path==='/config-summary'?{}:[]});});
 await page.goto(`/admin/payments/scratchpad/${ids.receipts[0]}?match=1`);
 const exact=page.getByRole('checkbox',{name:'Select PR #3100'});await expect(exact).toBeChecked();expect(moneyWrites).toBe(0);
 await page.getByRole('button',{name:'Save client / PR only',exact:true}).click();await expect(page.getByRole('status')).toContainText('No payment');expect(moneyWrites).toBe(0);
 await page.reload();await expect(exact).toBeChecked();await expect(page.getByText('Saved client', {exact:false}).first()).toBeVisible();
 await page.screenshot({path:`../ppvc-949-validation/guided-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Review / create suggested booking',exact:true}).click();await expect(page.getByRole('heading',{name:'Add New Booking'})).toBeVisible();expect(moneyWrites).toBe(0);await page.getByRole('combobox',{name:/^Accommodation/}).selectOption('shared');await page.getByRole('button',{name:'Add Booking',exact:true}).click();await expect(page).toHaveURL(/\/admin\/bookings\/[a-f0-9]{24}$/);await page.goto(`/admin/payments/scratchpad/${ids.receipts[0]}?match=1`);await expect(exact).toBeChecked();expect(moneyWrites).toBe(0);const persisted=(await(await request.get(fixture.url+'/fixture/edit-snapshot')).json()).bookings;expect(persisted).toHaveLength(1);expect(persisted[0].roomType).toBe('shared');
 await page.getByRole('button',{name:'Confirm payment from scratchpad',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(moneyWrites).toBe(1);await page.goto(`/admin/payments/scratchpad/${ids.receipts[0]}`);await expect(page.getByText('Reconciled receipt. Financial fields are locked.')).toBeVisible();
 await page.goto(`/admin/payments/scratchpad/${ids.receipts[1]}`);await expect(page.getByRole('button',{name:'Exclude receipt',exact:true})).toBeVisible();await expect(page.getByLabel('Reason',{exact:true})).toHaveCount(0);page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Exclude receipt',exact:true}).click();await expect(page).toHaveURL(/scratchpad$/);await page.goto(`/admin/payments/scratchpad/${ids.receipts[1]}`);await expect(page.getByRole('button',{name:'Restore receipt',exact:true})).toBeVisible();await page.getByRole('button',{name:'Restore receipt',exact:true}).click();await expect(page).toHaveURL(/scratchpad$/);await page.goto(`/admin/payments/scratchpad/${ids.receipts[1]}`);await expect(page.getByRole('button',{name:'Exclude receipt',exact:true})).toBeVisible();
});
