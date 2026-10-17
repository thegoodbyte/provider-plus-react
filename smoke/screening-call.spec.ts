import { test,expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture=JSON.parse(readFileSync('/tmp/ppvc857-fixture.json','utf8'));
const headers={Authorization:`Bearer ${fixture.token}`};
const path=`/admin/clients/${fixture.clientId}?tab=screening`;
for(const viewport of [{width:1365,height:1000},{width:390,height:844}])test(`save/reload and explicitly send before-call email at ${viewport.width}px`,async({page,baseURL,request})=>{
 await page.setViewportSize(viewport);
 await page.addInitScript(({token})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));},{token:fixture.token});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===new URL(baseURL!).origin)return route.continue();
  if(url.pathname==='/images/logo/iscz-logo-500w.png')return route.fulfill({path:'public/images/logo/iscz-logo-500w.png'});
  const endpoint=url.pathname.replace(/^\/api/,'');
  if(endpoint===`/clients/${fixture.clientId}`||['/communications/templates','/communications/preview','/communications/send','/communications/settings'].includes(endpoint)){
   const response=await route.fetch({url:`${fixture.url}${endpoint}${url.search}`});return route.fulfill({response});
  }
  return route.fulfill({json:endpoint==='/environment/status'?{production:true}:[]});
 });
 const history=async()=>await(await request.get(`${fixture.url}/communications/sent-emails?clientId=${fixture.clientId}`,{headers})).json();
 const count=(await history()).length;
 await request.patch(`${fixture.url}/clients/${fixture.clientId}`,{headers,data:{screeningCallAt:null,screeningCallTimeZone:'Europe/Prague'}});
 await page.goto(path);
 await page.getByLabel('Call date and time').fill('2026-10-25T15:30');
 await page.getByLabel('Call timezone').fill('Europe/Prague');
 await expect(page.getByRole('button',{name:'Prepare before-call email'})).toBeDisabled();
 await page.getByRole('button',{name:'Save call details'}).click();await expect(page.getByText('Screening call saved. No email has been sent.')).toBeVisible();
 await page.reload();await expect(page.getByLabel('Call date and time')).toHaveValue('2026-10-25T15:30');
 await page.getByRole('region',{name:'Screening call',exact:true}).screenshot({path:`test-results/ppvc857-${viewport.width}-schedule.png`});
 await page.getByRole('button',{name:'Prepare before-call email'}).click();
 await expect(page.getByRole('heading',{name:'Before our screening call',exact:true})).toBeVisible();
 const frame=page.frameLocator('iframe[title="Booking email HTML preview"]');
 for(const name of ['Overall questionnaire','Medical questionnaire','Medications questionnaire'])await expect(frame.getByRole('link',{name,exact:true})).toBeVisible();
 await expect(frame.getByText(/15:30.*Europe\/Prague/)).toBeVisible();
 await expect(frame.getByRole('img',{name:'IbogaSpirit'})).toHaveAttribute('src','https://retreatengine.com/images/logo/iscz-logo-500w.png');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await history()).length).toBe(count);
 await page.getByRole('button',{name:'Prepare before-call email'}).click();await expect(frame.getByRole('link',{name:'Medications questionnaire',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/ppvc857-${viewport.width}-email.png`,fullPage:true});
 await page.getByRole('button',{name:'Send Email',exact:true}).click();await expect(page.getByText('Message submitted. Review Emails for delivery status.')).toBeVisible();
 const sent=(await history())[0];expect((await history()).length).toBe(count+1);
 expect(sent.bodyText).toContain('/workflow?step=medications');expect(sent.bodyText).toContain('/workflow?step=questionnaire');expect(sent.bodyText).toContain('/workflow?step=screening_questionnaire');
 expect(sent.bodyHtml).toContain('15:30');expect(sent.bodyHtml).toContain('Europe/Prague');expect(sent.attachments).toHaveLength(0);
 const saved=await(await request.get(`${fixture.url}/clients/${fixture.clientId}`,{headers})).json();expect(saved.screeningCallAt).toBe('2026-10-25T14:30:00.000Z');expect(saved.screeningData.mainIntent).toBe('Preserve screening notes');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('failed save retains the draft, clearing persists, and undated preview sends nothing',async({page,baseURL,request})=>{
 await page.addInitScript(({token})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));},{token:fixture.token});
 let fail=true;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===new URL(baseURL!).origin)return route.continue();
  const endpoint=url.pathname.replace(/^\/api/,'');
  if(endpoint===`/clients/${fixture.clientId}`&&route.request().method()==='PATCH'&&fail){fail=false;return route.fulfill({status:503,json:{message:'Synthetic schedule failure'}});}
  if(endpoint===`/clients/${fixture.clientId}`||['/communications/templates','/communications/preview','/communications/settings'].includes(endpoint)){
   const response=await route.fetch({url:`${fixture.url}${endpoint}${url.search}`});return route.fulfill({response});
  }
  return route.fulfill({json:endpoint==='/environment/status'?{production:true}:[]});
 });
 await page.goto(path);await page.getByLabel('Call date and time').fill('2026-11-10T15:00');await page.getByRole('button',{name:'Save call details'}).click();
 await expect(page.getByRole('alert')).toContainText('Could not save the screening call');await expect(page.getByLabel('Call date and time')).toHaveValue('2026-11-10T15:00');
 await page.getByRole('button',{name:'Save call details'}).click();await expect(page.getByText('Screening call saved. No email has been sent.')).toBeVisible();
 await page.getByLabel('Call date and time').fill('');await page.getByRole('button',{name:'Save call details'}).click();await expect(page.getByText('Screening call cleared. No email has been sent.')).toBeVisible();
 await page.reload();await expect(page.getByLabel('Call date and time')).toHaveValue('');
 await page.getByRole('button',{name:'Prepare before-call email'}).click();await expect(page.frameLocator('iframe').getByText('Our call time has not been confirmed yet.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 const client=await(await request.get(`${fixture.url}/clients/${fixture.clientId}`,{headers})).json();expect(client.screeningCallAt).toBeNull();
});
