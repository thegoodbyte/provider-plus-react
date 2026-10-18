import { test, expect } from '@playwright/test';
const requestId='507f1f77bcf86cd799439866',clientId='507f1f77bcf86cd799439126',advisorId='507f1f77bcf86cd799439127';
for(const width of [1440,390])test(`WhatsApp overlay opens before mutation, saves and retries at ${width}px`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-whatsapp-fixture');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));});
 let request:any={_id:requestId,display_id:1400,status:'pending',reviewChannel:'internal',clientId,assignedToUserId:advisorId,requestType:'ekg_review'};
 const writes:any[]=[];let failNext=false;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===new URL(baseURL!).origin&&!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push({path,body:req.postDataJSON()});
  if(path==='/medical-review-requests')data=[request];
  if(path===`/medical-review-requests/${requestId}`&&req.method()==='PATCH'){
   if(failNext){failNext=false;return route.fulfill({status:500,json:{message:'Could not save WhatsApp details. Please retry.'}});}
   request={...request,...req.postDataJSON()};data=request;
  }
  if(path==='/clients')data=[{_id:clientId,display_id:1264,firstName:'WhatsApp',lastName:'Fixture',email:'fixture@example.invalid'}];
  if(path==='/users')data=[{_id:advisorId,role:'medical_advisor',firstName:'Test',lastName:'Advisor',isActive:true}];
  if(path==='/environment/status')data={production:true};
  if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
  if(path==='/submission-notifications/unread-count')data={count:0};
  return route.fulfill({json:data});
 });
 await page.goto('/admin/medical-review-requests');await page.getByRole('button',{name:'All',exact:true}).click();
 const open=()=>page.getByRole('button',{name:'Handle via WhatsApp',exact:true}).click();
 await open();let dialog=page.getByRole('dialog',{name:'WhatsApp · MRR #1400'});
 await expect(dialog).toBeVisible();await expect(dialog).toContainText('#1264 WhatsApp Fixture');
 await expect(dialog.getByLabel('Medical advisor')).toHaveValue(advisorId);expect(writes).toHaveLength(0);
 await dialog.getByLabel('Date sent').fill('2026-10-15');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();expect(writes).toHaveLength(0);
 await open();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();expect(writes).toHaveLength(0);
 await open();await dialog.getByRole('button',{name:'Close modal'}).click();await expect(dialog).not.toBeVisible();expect(writes).toHaveLength(0);
 await open();await dialog.getByLabel('Medical advisor').focus();await expect(dialog.getByLabel('Medical advisor')).toBeFocused();
 await dialog.getByRole('button',{name:'Save and return to list'}).focus();await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Close modal'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Save and return to list'})).toBeFocused();
 await dialog.getByLabel('Date sent').fill('2026-10-15');
 await page.screenshot({path:`test-results/ppvc866-${width}-overlay.png`,animations:'disabled'});
 await dialog.getByRole('button',{name:'Save and return to list'}).click();await expect(dialog).not.toBeVisible();
 expect(writes).toHaveLength(1);expect(writes[0].body).toMatchObject({reviewChannel:'whatsapp',whatsappAdvisorUserId:advisorId,whatsappSentAt:'2026-10-15',whatsappStatus:'awaiting_response',status:'awaiting_whatsapp'});
 expect(writes[0].body).not.toHaveProperty('advisorDeliveryStatus');
 await page.getByRole('button',{name:'WhatsApp: awaiting answer',exact:true}).click();
 await expect(dialog.getByLabel('Date sent')).toHaveValue('2026-10-15');
 await dialog.getByLabel('WhatsApp status').selectOption('responded');await dialog.getByLabel('Date answered').fill('2026-10-16');await dialog.getByLabel('Advisor result').selectOption('OK');await dialog.getByLabel('What did the advisor say?').fill('Synthetic advisor reply');
 failNext=true;await dialog.getByRole('button',{name:'Save and return to list'}).click();
 await expect(dialog.getByRole('alert')).toContainText('Could not save the WhatsApp status.');
 await expect(dialog.getByLabel('What did the advisor say?')).toHaveValue('Synthetic advisor reply');
 await dialog.getByRole('button',{name:'Save and return to list'}).click();await expect(dialog).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Handled via WhatsApp',exact:true})).toBeVisible();
 expect(writes).toHaveLength(3);expect(writes[2].body).toMatchObject({whatsappStatus:'responded',whatsappDecision:'OK',status:'approved',reviewNotes:'Synthetic advisor reply'});
 expect(writes.every(write=>write.path===`/medical-review-requests/${requestId}`)).toBe(true);
 await page.reload();await page.getByRole('button',{name:'All',exact:true}).click();await page.getByRole('button',{name:'Handled via WhatsApp',exact:true}).click();
 await expect(dialog.getByLabel('What did the advisor say?')).toHaveValue('Synthetic advisor reply');
});
