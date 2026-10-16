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
