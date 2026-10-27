import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(process.env.SCRATCHPAD_FIXTURE_PATH || '/tmp/ppvc830-fixture.json','utf8'));
const headers={Authorization:`Bearer ${fixture.token}`};
for(const device of ['desktop','mobile']) test.describe(`Receipt CRUD ${device}`,()=>{
 test.setTimeout(45000);
 test.use({viewport:device==='mobile'?{width:390,height:844}:{width:1365,height:1000},timezoneId:'America/New_York'});
 test.beforeEach(async({page,baseURL})=>{
  page.on('pageerror',e=>console.log('PAGE ERROR',e.stack)); page.on('console',m=>{if(m.type()==='error')console.log('BROWSER ERROR',m.text());});
  await page.addInitScript(({token})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'synthetic-admin',email:'scratchpad@example.invalid',role:'admin',firstName:'Synthetic',lastName:'Admin'}));},{token:fixture.token});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===new URL(baseURL!).origin)return route.continue();
   const p=u.pathname.replace(/^\/api/,'');
   if(p.startsWith('/payment-scratchpad')||['/clients','/bookings','/payments/requests','/payment-requests'].includes(p)){
    const r=await route.fetch({url:`${fixture.url}${p==='/payment-requests'?'/payments/requests':p}${u.search}`});return route.fulfill({response:r});
   }
   if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:true,enabledJobs:[],testMode:true,allowedEmailDomains:[],allowedRecipients:[],blockedActions:[],warnings:[]}});
   if(p==='/auth/verify')return route.fulfill({json:{id:'synthetic-admin',role:'admin'}});
   if(p==='/launcher-config')return route.fulfill({json:{assignments:[]}});
   if(p==='/assistant/tasks-for-today')return route.fulfill({json:{tasks:[],retreats:[]}});
   return route.fulfill({json:[]});
  });
 });
 const payload=(payer:string,extra:any={})=>({captureKey:crypto.randomUUID(),receivedDate:'2026-10-16',amount:'20.15',currency:'USD',provider:'revolut',account:'Synthetic USD wallet',payer,...extra});
 test('separate create/view/edit, reload, failed edit retry, unsaved guard and audited removal',async({page})=>{
  const name=`CRUD-${device}-${Date.now()}`;
  await page.goto('/admin/payments/scratchpad');await expect(page.getByRole('table')).toBeVisible();await expect(page.getByLabel('Amount received')).toHaveCount(0);
  await page.getByRole('button',{name:'New receipt',exact:true}).click();await expect(page).toHaveURL(/scratchpad\/new/);await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('Amount received').fill('123.45');await page.getByLabel('Payer name (optional)').fill(name);
  await page.screenshot({path:`test-results/ppvc846-${device}-create.png`,fullPage:true});
  await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page.getByRole('region',{name:'Receipt details'})).toBeVisible();await expect(page).toHaveURL(/scratchpad\/[a-f0-9]{24}/);
  await page.reload();await expect(page.getByText(name,{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Edit receipt',exact:true}).click();await expect(page).toHaveURL(/\/edit/);
  await page.getByLabel('Notes (optional)').fill('Synthetic retained edit');await page.screenshot({path:`test-results/ppvc846-${device}-edit.png`,fullPage:true});
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Notes (optional)')).toHaveValue('Synthetic retained edit');
  let fail=true;await page.route('**/payment-scratchpad/*',async route=>{if(route.request().method()==='PATCH'&&fail){fail=false;return route.fulfill({status:503,json:{message:'Synthetic retry edit'}});}return route.fallback();});
  await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Synthetic retry edit'}).first()).toBeVisible();await expect(page.getByLabel('Notes (optional)')).toHaveValue('Synthetic retained edit');
  await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toBeVisible();await page.reload();await page.getByText(/Receipt history/).click();await expect(page.getByText('Saved Notes: Synthetic retained edit')).toBeVisible();
  await page.screenshot({path:`test-results/ppvc846-${device}-view.png`,fullPage:true});
  await page.getByLabel('Reason for exclusion / restore').fill('Synthetic duplicate');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Exclude receipt',exact:true}).click();await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toBeVisible();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Exclude receipt',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Search payer, phone, transaction or request number').fill(name);await page.getByLabel('Receipt status').selectOption('excluded');await page.getByRole('link',{name:`View receipt ${name}`,exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toHaveCount(0);await page.getByLabel('Reason for exclusion / restore').fill('Verified receipt');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Restore receipt',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 });
 test('filter/sort and previous-next cross pages, reload and restore index state',async({page,request})=>{
  const marker=`Navigate-${device}-${Date.now()}`;
  for(let i=0;i<27;i++){const r=await request.post(`${fixture.url}/payment-scratchpad`,{headers,data:payload(`${marker}-${String(i).padStart(2,'0')}`,{amount:String(i+1)+'.00'})});expect(r.status()).toBe(201);}
  await page.goto(`/admin/payments/scratchpad?search=${marker}&currency=USD&sort=amount-asc&page=1`);await expect(page.getByText('27 matching receipts',{exact:false})).toBeVisible();
  await page.screenshot({path:`test-results/ppvc846-${device}-index.png`,fullPage:true});
  await page.getByRole('link',{name:`View receipt ${marker}-24`,exact:true}).click();await expect(page.getByText('Receipt 25 of 27')).toBeVisible();await page.getByRole('button',{name:'Next receipt',exact:true}).click();await expect(page.getByText('Receipt 26 of 27')).toBeVisible();await page.reload();await expect(page.getByText('Receipt 26 of 27')).toBeVisible();
  await page.getByRole('button',{name:'Next receipt',exact:true}).click();await expect(page.getByText('Receipt 27 of 27')).toBeVisible();await expect(page.getByRole('button',{name:'Next receipt',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Previous receipt',exact:true}).click();await expect(page.getByText('Receipt 26 of 27')).toBeVisible();await page.getByRole('button',{name:'← Back to list',exact:true}).click();
  await expect(page.getByLabel('Filter currency')).toHaveValue('USD');await expect(page.getByLabel('Sort receipts')).toHaveValue('amount-asc');await expect(page.getByLabel('Search payer, phone, transaction or request number')).toHaveValue(marker);await expect(page).toHaveURL(/page=1/);
 });
 test('matching popup from grid/view, explicit linking, cancel/focus, linked locks and filtered-out state',async({page,request})=>{
  const marker=`Match-${device}-${Date.now()}`;
  // Each device gets distinct real existing payments with the same candidate amount.
  // The fixture seeds two unlinked transactions per device below.
  for(const [i,amount] of [device==='mobile'?['c','44.25']:['a','42.25'],device==='mobile'?['d','45.25']:['b','43.25']]){
   const r=await request.post(`${fixture.url}/payment-scratchpad`,{headers,data:payload(`${marker}-${i}`,{amount,externalId:`ppvc846-existing-${i}`})});expect(r.status()).toBe(201);
  }
  await page.goto(`/admin/payments/scratchpad?search=${marker}`);const trigger=page.getByRole('button',{name:`Payment from SP for receipt ${marker}-${device==='mobile'?'c':'a'}`,exact:true});await trigger.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Have an existing payment for this already? Link it instead →',exact:true}).click();await expect(page.getByRole('button',{name:'Select existing payment',exact:true}).first()).toBeVisible();await expect.poll(async()=>(await page.getByRole('dialog').boundingBox())?.width || 0).toBeGreaterThan(device==='mobile'?300:600);await expect(page.getByRole('dialog')).not.toHaveClass(/zoom-(enter|appear)/);await expect(page.getByRole('dialog')).toHaveCSS('transform','none');await page.getByRole('dialog').screenshot({path:`test-results/ppvc846-${device}-match.png`});await page.getByRole('checkbox',{name:/^Select payment #/}).first().check();await page.getByLabel(/I checked the original transaction/).check();
  await page.getByRole('button',{name:'Confirm link to existing payment',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:`Payment from SP for receipt ${marker}-${device==='mobile'?'c':'a'}`,exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:`View receipt ${marker}-${device==='mobile'?'d':'b'}`,exact:true}).click();await page.getByRole('button',{name:'Payment from SP',exact:true}).click();await page.getByRole('button',{name:'Have an existing payment for this already? Link it instead →',exact:true}).click();await page.getByRole('checkbox',{name:/^Select payment #/}).first().check();await page.getByLabel(/I checked the original transaction/).check();await page.getByRole('button',{name:'Confirm link to existing payment',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('Receipt status').selectOption('converted');await page.getByRole('link',{name:`View receipt ${marker}-${device==='mobile'?'c':'a'}`,exact:true}).click();await expect(page.getByText('Reconciled receipt. Financial fields are locked.')).toBeVisible();await expect(page.getByRole('button',{name:'Edit receipt',exact:true})).toHaveCount(0);await page.reload();await expect(page.getByText('Reconciled receipt. Financial fields are locked.')).toBeVisible();
 });
 test('convert once through the real API and retain selection on a retryable failure',async({page,request})=>{
  const marker=`Convert-${device}-${Date.now()}`;const r=await request.post(`${fixture.url}/payment-scratchpad`,{headers,data:payload(marker,{amount:'5.00'})});expect(r.status()).toBe(201);
  await page.goto(`/admin/payments/scratchpad/${(await r.json())._id}?status=all`);await page.getByRole('button',{name:'Payment from SP',exact:true}).click();await page.getByLabel('Reconciliation client').fill('Synthetic');await page.getByLabel('Reconciliation client').press('Enter');await expect(page.getByRole('button',{name:'Create payment',exact:true})).toBeEnabled();
  let fail=true;await page.route('**/payment-scratchpad/*/reconcile',async route=>{if(fail){fail=false;return route.fulfill({status:503,json:{message:'Synthetic retry reconciliation'}});}return route.fallback();});
  await page.getByRole('button',{name:'Create payment',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Synthetic retry reconciliation');await expect(page.getByLabel('Reconciliation client')).toHaveValue(/Synthetic/);
  await page.getByRole('button',{name:'Create payment',exact:true}).click();await expect(page.getByText('Reconciled receipt. Financial fields are locked.')).toBeVisible();await page.reload();await expect(page.getByText('Reconciled receipt. Financial fields are locked.')).toBeVisible();
 });
});
