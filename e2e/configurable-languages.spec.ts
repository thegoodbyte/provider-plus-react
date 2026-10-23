import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const fixturePath = process.env.LANGUAGES_FIXTURE_PATH;
test.describe('PPVC-896 real language settings', () => {
 test.skip(!fixturePath, 'Requires the isolated language API fixture');
 for (const width of [1440,390]) test(`add, select, disable and retain language at ${width}px`, async({page,request})=>{
  const fixture=JSON.parse(fs.readFileSync(fixturePath!, 'utf8'));
  const code=width===1440?'de':'es', name=width===1440?'German':'Spanish';
  await page.setViewportSize({width,height:980});
  await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'000000000000000000000001',role:'admin',email:'admin@example.invalid'}));},fixture.tokens.admin);
  const client={_id:'000000000000000000000001',firstName:'Synthetic',lastName:'Client',display_id:1896,email:'synthetic@example.invalid',language:'cs'};
  await page.route('**/*',async route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const url=new URL(req.url());
   if(url.pathname.startsWith('/languages'))return route.fulfill({response:await request.fetch(fixture.url+url.pathname,{method:req.method(),headers:{authorization:`Bearer ${fixture.tokens.admin}`,'content-type':'application/json'},...(req.postData()?{data:req.postData()}:{} )})});
   if(url.pathname==='/clients/'+client._id)return route.fulfill({json:client});
   if(url.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
   if(url.pathname.includes('config-summary'))return route.fulfill({json:{}});
   if(url.pathname.includes('/identity-change'))return route.fulfill({json:null});
   return route.fulfill({json:[]});
  });
  await page.goto('/admin/languages');await expect(page.getByRole('heading',{name:'Languages',exact:true})).toBeVisible();
  await page.getByPlaceholder('code (e.g. de)').fill(code);await page.getByPlaceholder('Display name (e.g. German)').fill(name);await page.getByRole('button',{name:'Add',exact:true}).click();
  await expect(page.getByLabel('Name for '+code,{exact:true})).toHaveValue(name);
  await page.goto('/admin/clients/'+client._id+'/edit');
  // Client language uses the same managed list as settings, including legacy Czech.
  const selector=page.getByRole('button',{name:'Preferred Language',exact:true});await expect(selector).toContainText('Czech');await selector.click();
  await page.getByRole('button',{name,exact:true}).click();await expect(selector).toContainText(name);
  client.language=code;
  await page.goto('/admin/languages');const row=page.getByLabel('Name for '+code,{exact:true}).locator('..');await row.getByRole('checkbox').uncheck();await row.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(async()=>{const r=await request.get(fixture.url+'/languages/active');return (await r.json()).map((l:any)=>l.code)}).not.toContain(code);
  await page.goto('/admin/clients/'+client._id+'/edit');const historical=page.getByRole('button',{name:'Preferred Language',exact:true});await expect(historical).toContainText(code.toUpperCase()+' · current');await historical.click();await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Czech',exact:true})).toBeVisible();
  await page.screenshot({path:`../languages-${width}.png`,fullPage:true});
 });
});
