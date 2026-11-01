import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const file=process.env.SCREENING_WORKSPACE_FIXTURE;
test.skip(!file,'Requires the disposable real API/Mongo screening fixture and built API checkout.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])test(`missing room remains visible, preserves edits and saves after correction at ${width}px`,async({page,request})=>{
 const f=JSON.parse(fs.readFileSync(file!,'utf8'));await request.post(f.url+'/fixture/reset');
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();const before=await snapshot();let writes=0;
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'staff@example.invalid'}));},f.tokens.admin);
 await page.route('**/*',async route=>{const q=route.request(),u=new URL(q.url());if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();
  if(u.pathname.startsWith('/clients')){if(!['GET','HEAD'].includes(q.method()))writes++;return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});}
  if(!['GET','HEAD'].includes(q.method()))throw Error('Unexpected write '+q.method()+' '+u.pathname);
  if(u.pathname==='/room-inventory/options')return route.fulfill({json:['shared','private'].map(key=>({key,active:true,labels:{en:key==='shared'?'Shared room':'Private room'},legacyRoomType:key}))});
  return route.fulfill({json:u.pathname==='/environment/status'?{production:true}:u.pathname==='/users/navigation-permissions'||u.pathname.includes('config-summary')?{}:[]});
 });
 await page.goto('/admin/clients/'+f.ids.client+'/screening');
 const intent=page.getByRole('textbox',{name:'Main intent / motivation'}),room=page.getByRole('combobox',{name:/Desired accommodation/});
 await intent.fill('Keep my unsaved intention '+width);await intent.focus();const scroll=await page.evaluate(()=>window.scrollY);
 const warning=page.getByRole('button',{name:'Room type required — choose room'});
 await expect(warning).toBeVisible();await expect(intent).toBeFocused();expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);expect(writes).toBe(0);
 // The old notification disappeared after2.4 seconds; required guidance must persist beyond it.
 await page.waitForTimeout(2700);await expect(warning).toBeVisible();expect(writes).toBe(0);
 await page.getByRole('button',{name:'Save Screening',exact:true}).first().click();await expect(room).toBeFocused();await expect(room).toHaveAttribute('aria-invalid','true');
 const box=await room.boundingBox();expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThan(850);
 await expect(intent).toHaveValue('Keep my unsaved intention '+width);expect(writes).toBe(0);expect(await snapshot()).toEqual(before);
 if(process.env.SCREENING_WORKSPACE_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.SCREENING_WORKSPACE_ARTIFACT_DIR,`required-room-${width}.png`)});
 await intent.focus();await page.getByRole('button',{name:'Save screening without leaving this page',exact:true}).last().click();await expect(room).toBeFocused();expect(writes).toBe(0);
 const choice=width===1440?'shared':'private';await room.selectOption(choice);await expect(warning).toBeHidden();await expect(room).not.toHaveAttribute('aria-invalid');
 await page.getByRole('button',{name:'Save screening without leaving this page',exact:true}).last().click();
 await expect.poll(async()=>(await snapshot()).clients.find((c:any)=>c._id===f.ids.client).screeningData?.desiredAccommodationKey).toBe(choice);
 await page.reload();await expect(room).toHaveValue(choice);await expect(intent).toHaveValue('Keep my unsaved intention '+width);await expect(warning).toBeHidden();
 const after=await snapshot();expect(after.clients.find((c:any)=>c._id===f.ids.sibling)).toEqual(before.clients.find((c:any)=>c._id===f.ids.sibling));expect(after.bookings).toBe(0);expect(after.effects).toEqual([]);
});
