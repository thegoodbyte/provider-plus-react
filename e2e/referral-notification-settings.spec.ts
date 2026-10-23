import {test,expect} from '@playwright/test';
test('notification settings persist global and partner preferences without sending messages',async({page})=>{
 let enabled=false, writes=0;
 let partner:any={_id:'partner',name:'Synthetic Partner',assignmentNotificationsEnabled:false,assignmentNotificationLanguage:'en'};
 await page.route('**/*',async route=>{
  const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const p=new URL(req.url()).pathname;
  const json=(data:any)=>route.fulfill({json:data});
  if(p==='/referrals/notification-settings'){
   if(req.method()==='PATCH'){enabled=req.postDataJSON().assignmentNotificationsEnabled;writes++;}
   return json({assignmentNotificationsEnabled:enabled});
  }
  if(p==='/referrals/partner'&&req.method()==='PATCH'){partner={...partner,...req.postDataJSON()};writes++;return json(partner);}
  if(req.method()!=='GET')throw new Error(`Unexpected write ${req.method()} ${p}`);
  if(p==='/languages/active')return json([{code:'en',name:'English',active:true},{code:'pl',name:'Polish',active:true}]);
  if(p==='/referrals')return json([partner]);
  if(p==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto('/admin/referrals/notification-settings');
 const global=page.getByRole('checkbox',{name:'Send assignment notification emails',exact:true});
 await expect(global).not.toBeChecked();await global.click();await expect(global).toBeChecked();
 const notify=page.getByRole('checkbox',{name:'Notify Synthetic Partner on assignment',exact:true});
 await notify.click();await expect(notify).toBeChecked();
 await page.getByLabel('Notification language for Synthetic Partner').selectOption('pl');
 await expect.poll(()=>writes).toBe(3);
 await page.reload();await expect(global).toBeChecked();await expect(notify).toBeChecked();
 await expect(page.getByLabel('Notification language for Synthetic Partner')).toHaveValue('pl');
});

for (const width of [1440, 390]) test(`lifecycle settings persist independent global and partner switches at ${width}px`, async ({page}) => {
 await page.setViewportSize({width,height:980});
 const flags=['invoiceSentNotificationsEnabled','invoicePaidNotificationsEnabled','bookingIssuedNotificationsEnabled','retreatCompletedNotificationsEnabled'];
 const names=['invoice-sent','invoice-paid','booking-issued','retreat-completed'];
 const columns=['invoice sent','invoice paid','booking issued','retreat completed'];
 let settings:any={assignmentNotificationsEnabled:true};
 let partner:any={_id:'partner',name:'Synthetic Partner',assignmentNotificationsEnabled:true,assignmentNotificationLanguage:'en'};
 let writes=0;
 await page.route('**/*',async route=>{
  const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const p=new URL(req.url()).pathname;
  if(p==='/referrals/notification-settings') {if(req.method()==='PATCH'){const body=req.postDataJSON();expect(Object.keys(body)).toHaveLength(1);settings={...settings,...body};writes++;}return route.fulfill({json:settings});}
  if(p==='/referrals/partner'&&req.method()==='PATCH'){const body=req.postDataJSON();expect(Object.keys(body)).toHaveLength(1);partner={...partner,...body};writes++;return route.fulfill({json:partner});}
  if(req.method()!=='GET')throw Error(`Unexpected write ${req.method()} ${p}`);
  if(p==='/languages/active')return route.fulfill({json:[{code:'en',name:'English',active:true},{code:'pl',name:'Polish',active:true}]});
  if(p==='/referrals')return route.fulfill({json:[partner]});
  if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/referrals/notification-settings');
 for(let i=0;i<flags.length;i++){
  const global=page.getByRole('checkbox',{name:`Send ${names[i]} notification emails`,exact:true});
  const local=page.getByRole('checkbox',{name:`Notify Synthetic Partner on ${columns[i]}`,exact:true});
  await expect(global).not.toBeChecked();await expect(local).not.toBeChecked();
  await global.click();await expect(global).toBeChecked();await local.click();await expect(local).toBeChecked();
 }
 await expect.poll(()=>writes).toBe(8);await page.reload();
 for(let i=0;i<flags.length;i++){await expect(page.getByRole('checkbox',{name:`Send ${names[i]} notification emails`,exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:`Notify Synthetic Partner on ${columns[i]}`,exact:true})).toBeChecked();}
 await expect(page.getByRole('checkbox',{name:'Send assignment notification emails',exact:true})).toBeChecked();
 await page.getByRole('checkbox',{name:'Send invoice-paid notification emails',exact:true}).click();
 await expect.poll(()=>settings.invoicePaidNotificationsEnabled).toBe(false);
 expect(partner.invoicePaidNotificationsEnabled).toBe(true);expect(settings.invoiceSentNotificationsEnabled).toBe(true);
});
