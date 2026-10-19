import { test, expect } from '@playwright/test';
for (const width of [1440,390]) test(`occupancy packs sequential boosters and separates overlaps at ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{localStorage.setItem('token','fixture');localStorage.setItem('user',JSON.stringify({id:'admin-fixture',role:'admin'}));});
 const id='507f1f77bcf86cd799439704'; const writes:string[]=[];
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin===new URL(baseURL!).origin)return route.continue();
  if(!['GET','OPTIONS'].includes(route.request().method()))writes.push(u.pathname);
  if(u.pathname===`/retreats/${id}`)return route.fulfill({json:{_id:id,name:'Occupancy fixture',startDate:'2026-12-01',endDate:'2026-12-08',status:'upcoming',capacity:6}});
  if(u.pathname===`/room-inventory/retreat/${id}`)return route.fulfill({json:{startDate:'2026-12-01',endDate:'2026-12-08',rooms:[
   {roomId:'r1',name:'Room I',occupants:[{_id:'b1',name:'Booster I',roomStayStart:'2026-12-01',roomStayEnd:'2026-12-04'},{_id:'b2',name:'Booster II',roomStayStart:'2026-12-04',roomStayEnd:'2026-12-08'}]},
   {roomId:'r2',name:'Room II',occupants:[{_id:'a',name:'Anna',roomStayStart:'2026-12-01',roomStayEnd:'2026-12-08'},{_id:'m',name:'Marhola',roomStayStart:'2026-12-02',roomStayEnd:'2026-12-07'}]},
   {roomId:'r3',name:'Room III',occupants:[]}]}});
  return route.fulfill({json:u.pathname.includes('summary')?{}:[]});
 });
 await page.goto(`/admin/retreats/${id}/occupancy`);
 const section=page.getByRole('region',{name:'Room occupancy overview'});await expect(section).toBeVisible();
 const first=section.getByText('Booster I',{exact:true}),second=section.getByText('Booster II',{exact:true});await expect(first).toBeVisible();await expect(second).toBeVisible();
 const a=await first.boundingBox(),b=await second.boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);
 const anna=await section.getByText('Anna',{exact:true}).boundingBox(),marhola=await section.getByText('Marhola',{exact:true}).boundingBox();expect(Math.abs(anna!.y-marhola!.y)).toBeGreaterThan(10);
 await expect(section.getByText('Unoccupied',{exact:true})).toBeVisible();expect(writes).toEqual([]);
 await page.screenshot({path:`../occupancy-${width}.png`});await page.reload();await expect(section).toBeVisible();
});
