import { test, expect } from '@playwright/test';
const clientId='507f1f77bcf86cd799439126';
for (const width of [1440,390]) test(`screening decision save and reopen at ${width}px`, async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{
  localStorage.setItem('token','synthetic-screening-fixture');
  localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));
 });
 let client:any={_id:clientId,display_id:861,firstName:'Screening',lastName:'Fixture',email:'fixture@example.invalid',screeningData:{},workflowStatus:'screening_scheduled'};
 const writes:any[]=[];
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===new URL(baseURL!).origin&&!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
  if(req.method()==='PUT'&&path===`/clients/${clientId}/screening`){
   const body=req.postDataJSON();writes.push(body);client={...client,...body,screeningData:body};data=client;
  }else if(path===`/clients/${clientId}`)data=client;
  else if(path==='/room-inventory/options')data=[{key:'shared',active:true,labels:{en:'Shared'},occupancy:'shared',legacyRoomType:'shared'}];
  else if(path==='/environment/status')data={production:true};
  else if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
  else if(path==='/submission-notifications/unread-count')data={count:0};
  return route.fulfill({json:data});
 });
 const path=`/admin/clients/${clientId}/screening`;
 for(const [outcome,label] of [['accepted','Accepted'],['conditional','Conditional'],['declined','Declined']]){
  await page.goto(path);
  const section=page.getByRole('heading',{name:'Screening Outcome',exact:true}).locator('..');
  await expect(section).toBeVisible();
  await section.getByRole('button',{name:label,exact:true}).click();
  await expect(section).toContainText(`Screened ${outcome}`);
  await section.locator('textarea').fill(`Synthetic ${outcome} notes`);
  await page.getByRole('combobox',{name:/Desired accommodation/}).selectOption('shared');
  const saved=page.waitForResponse(r=>r.url().includes(`/clients/${clientId}/screening`)&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Save Screening',exact:true}).first().click();await saved;
  expect(writes.at(-1)).toMatchObject({desiredAccommodationKey:'shared',screeningOutcome:outcome,screeningOutcomeNotes:`Synthetic ${outcome} notes`});
  await page.goto(path);await expect(section.locator('textarea')).toHaveValue(`Synthetic ${outcome} notes`);
  await expect(section).toContainText(`Screened ${outcome}`);
  await section.scrollIntoViewIfNeeded();await page.screenshot({path:`../screening-artifacts/ppvc861-${width}-${outcome}.png`});
 }
});
