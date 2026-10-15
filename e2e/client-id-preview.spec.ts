import{test,expect}from'@playwright/test';
for(const width of [1440,390])test('client ID preview remains stable and manual lower ID is saved '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});let previews=0,writes=0;
 await page.route('**/*',async route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const path=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
 if(path==='/clients/next-display-id'){previews++;return json(1050);}
 if(path==='/clients'&&req.method()==='POST'){expect(req.postDataJSON()).toMatchObject({display_id:1012,firstName:'Synthetic',lastName:'Client'});writes++;return json({_id:'synthetic-client',...req.postDataJSON()});}
 if(path==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto('/admin/clients/add');await expect(page.getByLabel('Client ID',{exact:true})).toHaveValue('1050');
 await page.reload();await expect(page.getByLabel('Client ID',{exact:true})).toHaveValue('1050');expect(previews).toBeGreaterThanOrEqual(2);expect(writes).toBe(0);
 await page.getByLabel('Client ID',{exact:true}).fill('1012');await page.getByPlaceholder('Enter first name').fill('Synthetic');await page.getByPlaceholder('Enter last name').fill('Client');await page.getByPlaceholder('Enter full number with country code').fill('+420777123456');
 await page.getByRole('button',{name:'Save Client',exact:true}).first().click();await expect.poll(()=>writes).toBe(1);await expect(page).toHaveURL(/\/clients$/);expect(writes).toBe(1);
});
