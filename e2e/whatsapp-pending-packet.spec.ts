import {test,expect} from '@playwright/test';
for(const width of [1440,390])test('WhatsApp handoff removes pending badge and survives reload '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});let writes=0;
 let requests:any[]=[{_id:'r1',display_id:7981,status:'pending',reviewChannel:'internal',assignedToUserId:'advisor',retreatId:'retreat',requestType:'ekg_review'},{_id:'r2',display_id:7982,status:'pending',reviewChannel:'internal',whatsappSentAt:'2026-10-10',whatsappStatus:'awaiting_response',retreatId:'retreat',requestType:'liver_panel_review'}];
 await page.route('**/*',async route=>{
  const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const path=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
  if(path==='/medical-review-requests/r1'&&req.method()==='PATCH'){const body=req.postDataJSON();expect(body).toMatchObject({status:'awaiting_whatsapp',reviewChannel:'whatsapp',whatsappStatus:'awaiting_response'});expect(body).not.toHaveProperty('advisorDeliveryStatus');requests[0]={...requests[0],...body};writes++;return json(requests[0]);}
  if(path==='/medical-review-requests')return json(requests);
  if(path==='/medical-review-groups'||path==='/medical-review-requests/groups')return json([{_id:'group',title:'Synthetic WhatsApp Packet',reviewRequestIds:['r1','r2'],retreatId:'retreat',endDate:'2026-12-31',pendingCount:2}]);
  if(path==='/retreats')return json([{_id:'retreat',retreatCode:'TEST-798'}]);
  if(path==='/users')return json([{_id:'advisor',role:'medical_advisor',firstName:'Test',lastName:'Advisor'}]);
  if(path==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto('/admin/medical-review-requests');
 await page.getByRole('button',{name:'Grouped',exact:true}).click();
 await expect(page.getByTitle('1 pending medical review request',{exact:true})).toBeVisible();
 await page.getByText('Synthetic WhatsApp Packet',{exact:true}).click();
 await page.locator('.mrr-list-row').filter({has:page.getByRole('button',{name:'#7981',exact:true})}).getByRole('button',{name:'Handle via WhatsApp',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(writes).toBe(0);
 await page.getByRole('button',{name:'Save and return to list',exact:true}).click();
 await expect.poll(()=>writes).toBe(1);
 await expect(page.locator('[title="1 pending medical review request"]')).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'Grouped',exact:true}).click();await expect(page.getByText('Synthetic WhatsApp Packet',{exact:true})).toBeVisible();await expect(page.locator('[title="1 pending medical review request"]')).toHaveCount(0);
 expect(writes).toBe(1);
});
