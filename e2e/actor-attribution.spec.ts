import { test, expect } from '@playwright/test';
import path from 'node:path';
for (const width of [1440, 390]) test(`admin filters actual user activity and staff cannot open audit page at ${width}px`, async ({page,request}, info) => {
  const {createFixture}=require(path.join(path.resolve(process.env.TEST_API_CHECKOUT || '../api'),'test/actor-attribution.fixture.cjs'));
  const f=await createFixture();
  try {
    await f.app.listen(0,'127.0.0.1');const url=await f.app.getUrl();
    const headers=(key:string)=>({Authorization:'Bearer '+f.tokens[key]});
    const task=(name:string)=>({name,description:'Synthetic attribution acceptance',type:'generic',urgency:'medium',notifyClient:false,visibleToClient:false});
    const created=await request.post(url+'/tasks',{headers:headers('admin'),data:task('Owner created')});expect(created.status()).toBe(201);const record=await created.json(),id=record.id||record._id;
    expect((await request.post(url+'/tasks',{headers:headers('kasia'),data:task('Kasia created')})).status()).toBe(201);
    expect((await request.patch(url+'/tasks/'+id,{headers:headers('kasia'),data:{name:'Kasia edited'}})).status()).toBe(200);
    await expect.poll(()=>f.models.AuditLog.countDocuments({actorUserId:f.ids.users[1],action:'update'})).toBe(1);
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(({token,id})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id,role:'admin',email:'owner@example.invalid'}));},{token:f.tokens.admin,id:f.ids.users[0]});
    await page.route('**/*',async route=>{
      const q=route.request(),u=new URL(q.url());if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();
      if(u.pathname==='/audit-logs'||u.pathname==='/users'||u.pathname==='/users/profile')return route.fulfill({response:await route.fetch({url:url+u.pathname+u.search})});
      if(q.method()!=='GET')return route.abort();
      if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
      return route.fulfill({json:u.pathname==='/users/navigation-permissions'?{}:[]});
    });
    await page.goto('/admin/audit-logs');const picker=page.getByRole('combobox',{name:'Activity user'});
    await expect(picker.getByRole('option',{name:'Kasia Synthetic'})).toHaveCount(1);
    await expect(page.getByRole('cell',{name:'owner@example.invalid',exact:false}).first()).toBeVisible();
    await picker.selectOption(f.ids.users[1]);
    await expect(page.getByRole('cell',{name:'owner@example.invalid',exact:false})).toHaveCount(0);
    await expect(page.getByRole('cell',{name:'kasia@example.invalid',exact:false}).first()).toBeVisible();
    const filtered=await request.get(url+'/audit-logs?actorUserId='+f.ids.users[1],{headers:headers('admin')});expect((await filtered.json()).items.every((x:any)=>x.actorUserId===f.ids.users[1])).toBe(true);
    await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(picker).toHaveValue('');await expect(page.getByRole('cell',{name:'owner@example.invalid',exact:false}).first()).toBeVisible();
    await page.screenshot({path:info.outputPath(`audit-users-${width}.png`),fullPage:true,animations:'disabled'});
    expect((await request.get(url+'/audit-logs',{headers:headers('kasia')})).status()).toBe(403);
    const nonAdmin=await request.get(url+'/tasks/'+id,{headers:headers('kasia')});expect(nonAdmin.status()).toBe(200);expect(await nonAdmin.json()).not.toHaveProperty('createdByUserId');
    await page.evaluate(({token,id})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id,role:'user'}));},{token:f.tokens.kasia,id:f.ids.users[1]});
    // Keep the denied role through reload; the init script applies to subsequent documents.
    await page.addInitScript(({token,id})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id,role:'user'}));},{token:f.tokens.kasia,id:f.ids.users[1]});
    await page.goto('/user/audit-logs');await expect(page.getByRole('combobox',{name:'Activity user'})).toHaveCount(0);
    expect(f.effects).toEqual([]);
  } finally {await page.unrouteAll({behavior:'wait'});await page.close();f.app.getHttpServer().closeIdleConnections?.();await f.close();}
});
