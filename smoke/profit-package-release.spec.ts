import {test,expect} from '@playwright/test';
for(const width of [1440,390]) {
 test(`financial metrics cards and links ${width}`,async({page,baseURL})=>{
  await page.setViewportSize({width,height:1000});let writes=0;const id='507f1f77bcf86cd799439477';
  const retreat={_id:id,code:'F477',name:'Finance fixture',type:'regular',startDate:'2027-06-01',endDate:'2027-06-08',capacity:12};
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-release');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin'}));});
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===new URL(baseURL!).origin&&!u.pathname.startsWith('/api/'))return route.continue();if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes++;
   const p=u.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
   if(p==='/retreats')data=[retreat];if(p===`/retreats/${id}`)data=retreat;
   if(p===`/retreat-expenses/retreat/${id}/summary`)data={plannedExpensesUSD:1000,actualExpensesUSD:250,expensesByCategory:{}};
   if(p.includes('/payments/retreat-summary/'))data={paymentsByMethod:{}};if(p==='/environment/status')data={production:true};if(p==='/config-summary'||p==='/users/navigation-permissions')data={};
   return route.fulfill({json:data});});
  await page.goto(`/admin/retreats/${id}`);await page.getByRole('button',{name:'Metrics',exact:true}).click();const dialog=page.getByRole('dialog');
  for(const name of ['Bottom line','Revenue in','Expenses out','Occupancy'])await expect(dialog.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(dialog).toContainText('25% of budget spent');await expect(dialog).toContainText('$250.00');await expect(dialog).toContainText('F477');
  await expect.poll(async()=> (await dialog.boundingBox())?.width||0).toBeGreaterThan(Math.min(width-50,900));
  await expect(dialog).not.toHaveClass(/ant-zoom-appear/);
  await page.screenshot({fullPage:true,path:`../profit-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await dialog.getByRole('button',{name:'Budget',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page).toHaveURL(/\/expenses$/);
  await page.getByRole('button',{name:'Metrics',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Payments',exact:true}).click();await expect(page).toHaveURL(/\/payments$/);expect(writes).toBe(0);
 });
 test(`commission package survives reload and scopes to partner ${width}`,async({page,baseURL})=>{
  await page.setViewportSize({width,height:1000});let writes=0;
  const rows=[['one','Alice','p1','Alpha'],['two','Betty','p1','Beta'],['three','Carla','p2','Gamma']].map(([bookingId,clientName,referralId,packageName])=>({bookingId,clientName,clientId:bookingId,referralId,referralName:referralId,retreatId:'r1',retreatCode:'F867',packageName,amountOwed:100,owedCurrency:'USD',commissionPercentage:10,usdEquivalent:100,paid:false}));
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-release');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin'}));});
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===new URL(baseURL!).origin&&!u.pathname.startsWith('/api/'))return route.continue();if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes++;
   const p=u.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
   if(p==='/referrals')data=[{_id:'p1',name:'Partner One'},{_id:'p2',name:'Partner Two'}];
   if(p==='/referrals/report/pages'){await new Promise(r=>setTimeout(r,200));data={rows,nextCursor:null,asOf:'507f1f77bcf86cd799439999'};}
   if(p.includes('/payments/retreat-summary/'))data={paymentsByMethod:{}};if(p==='/environment/status')data={production:true};if(p==='/config-summary'||p==='/users/navigation-permissions')data={};return route.fulfill({json:data});});
  await page.goto('/admin/referrals/commissions?referralId=p1&packageName=Alpha');const table=page.getByRole('table');
  await expect(page.getByLabel('Filter by commission package')).toHaveValue('Alpha');await expect(table).toContainText('Alice');await expect(table).not.toContainText('Betty');
  await page.reload();await expect(page.getByLabel('Filter by commission package')).toHaveValue('Alpha');await expect(table).toContainText('Alice');
  await page.getByLabel('Filter by commission package').selectOption('Beta');await expect(table).toContainText('Betty');await expect(table).not.toContainText('Alice');
  await page.getByLabel('Filter by commission package').selectOption('');await page.getByPlaceholder('Search client, referred-by or package').fill('alpha');await expect(table).toContainText('Alice');await expect(table).not.toContainText('Betty');
  await page.getByPlaceholder('Search client, referred-by or package').fill('');await page.getByLabel('Filter by commission package').selectOption('Alpha');await page.getByLabel('Filter by referral').selectOption('p2');
  await expect(page.getByLabel('Filter by commission package')).toHaveValue('');await expect(table).toContainText('Carla');await expect(page).not.toHaveURL(/packageName=/);
  await page.screenshot({path:`../packages-${width}.png`,fullPage:true});expect(writes).toBe(0);
 });
}
