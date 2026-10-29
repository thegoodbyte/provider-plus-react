import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const file=process.env.GUIDED_SCRATCHPAD_FIXTURE;
test.skip(!file,'Requires disposable real API/MongoDB guided fixture');
for(const width of [1440,390])test(`edit receipt saves client and PR before payment ${width}px`,async({page,request,baseURL})=>{
 const f=JSON.parse(fs.readFileSync(file!,'utf8'));const reset=await request.post(f.url+'/fixture/guided-reset');const {ids}=await reset.json();const headers={Authorization:'Bearer '+f.tokens.admin};
 const detail=async()=>(await request.get(f.url+'/payment-scratchpad/'+ids.receipts[0],{headers})).json();
 const snapshot=async()=>(await request.get(f.url+'/fixture/edit-snapshot')).json();const before=await snapshot();
 await page.setViewportSize({width,height:980});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin'}));},f.tokens.admin);
 let moneyWrites=0;let rejectSave=false;
 await page.route('**/*',async route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const u=new URL(req.url()),p=u.pathname.replace(/^\/api(?=\/)/,'');
 if(/^\/(payment-scratchpad|payments|payment-requests|clients|bookings|retreats)(\/|$)/.test(p)){
  if(req.method()==='POST'&&/match-payment|reconcile/.test(p))moneyWrites++;
  if(rejectSave&&req.method()==='PATCH'&&p==='/payment-scratchpad/'+ids.receipts[0]){rejectSave=false;return route.fulfill({status:503,json:{message:'Synthetic edit retry'}})}
  return route.fulfill({response:await route.fetch({url:f.url+p+u.search,headers:{...req.headers(),authorization:'Bearer '+f.tokens.admin}})});
 }
 return route.fulfill({json:p==='/environment/status'?{production:true}:p==='/config-summary'||p==='/users/navigation-permissions'?{}:[]});});
 await page.goto('/admin/payments/scratchpad?status=all');const row=page.getByRole('row').filter({has:page.getByRole('link',{name:'SP-'+(await detail()).display_id,exact:true})});await row.getByRole('button',{name:/Edit receipt/}).click();await expect(page).toHaveURL(/\/edit\?/);
 const pr=page.getByRole('combobox',{name:'Payment request (optional)',exact:true});await pr.selectOption(ids.requests[0]);await expect(page.getByLabel('Receipt client (optional)')).toHaveValue('#330 Anna Synthetic');await expect(page.getByRole('status').filter({hasText:'Unpaid amount:'})).toHaveText('Unpaid amount: 600 PLN');
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await detail()).matchedPaymentRequestId).toBeUndefined();expect(moneyWrites).toBe(0);
 await page.getByRole('button',{name:'Edit receipt',exact:true}).click();await pr.selectOption(ids.requests[0]);await page.getByLabel('Notes (optional)').fill('Reviewed matching context');rejectSave=true;await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page.getByRole('alert').first()).toContainText('Synthetic edit retry');await expect(pr).toHaveValue(ids.requests[0]);await expect(page.getByLabel('Notes (optional)')).toHaveValue('Reviewed matching context');expect((await detail()).matchedPaymentRequestId).toBeUndefined();
 await page.screenshot({path:`../ppvc-950-validation/edit-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Save receipt',exact:true}).click();await expect(page).not.toHaveURL(/\/edit/);await expect(page.getByRole('region',{name:'Saved matching details'})).toBeVisible();await page.reload();await expect(page.getByRole('region',{name:'Saved matching details'})).toContainText('Anna Synthetic');const saved=await detail();expect(saved.matchedPaymentRequestId).toBe(ids.requests[0]);expect(saved.notes).toBe('Reviewed matching context');expect(saved.status).toBe('unassigned');expect(moneyWrites).toBe(0);expect(await snapshot()).toEqual(before);
 await page.getByRole('button',{name:'Edit receipt',exact:true}).click();await expect(pr).toHaveValue(ids.requests[0]);await expect(page.getByLabel('Receipt client (optional)')).toHaveValue('#330 Anna Synthetic');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Payment from SP',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Select PR #3100'})).toBeChecked();expect(moneyWrites).toBe(0);await page.getByRole('button',{name:'Confirm payment from scratchpad',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(moneyWrites).toBe(1);const paid=await detail();expect(paid.status).toBe('converted');expect(paid.payment.clientId).toBe(ids.clients[0]);expect(paid.payment.paymentRequestId).toBe(ids.requests[0]);
});
