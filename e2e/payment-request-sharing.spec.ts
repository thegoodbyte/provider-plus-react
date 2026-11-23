import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const file=process.env.PAYMENT_SHARE_FIXTURE,f=file?JSON.parse(fs.readFileSync(file,'utf8')):{};
test.skip(!file,'Run full coverage with the real production template API/Mongo fixture.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])test(`save three localized messages, reload and copy without financial/email writes at ${width}px`,async({page,request})=>{
 await page.setViewportSize({width,height:1000});
 const payment={_id:'000000000000000000001010',invoiceNumber:1465,publicHash:'synthetic-private-1010',status:'pending',requestedAmount:9500,currency:'PLN',clientId:{_id:'000000000000000000000010',firstName:'Ewa',lastName:'Fixture',display_id:1333,language:'pl'},retreatId:{_id:'000000000000000000000020',code:'SYN-1010'}};
 const snapshot=async()=>{const response=await request.get(f.url+'/__fixture/state');expect(response.ok()).toBeTruthy();const state=await response.json();expect(Array.isArray(state.templates)).toBe(true);return state;};
 const before=await snapshot(),unrelated=before.templates.find((t:any)=>t._id===f.ids.unrelated);
 const writes:string[]=[];
 await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({id:'share-admin',role:'admin',email:'admin@example.invalid'}));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{(window as any).__sharedClipboard=value;}}});},f.tokens.admin);
 await page.route('**/*',async route=>{const q=route.request();if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();const u=new URL(q.url());
  if(u.pathname.startsWith('/communications/templates')){if(!['GET','POST','PATCH'].includes(q.method()))throw Error('Unexpected template method');if(q.method()!=='GET')writes.push(q.method()+' '+u.pathname);return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});}
  if(q.method()!=='GET')throw Error('Unexpected write '+q.method()+' '+u.pathname);
  if(u.pathname==='/payment-requests')return route.fulfill({json:[payment]});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:u.pathname.includes('config-summary')||u.pathname.includes('navigation-permissions')?{}:[]});
 });
 const open=async()=>{await page.goto('/admin/payment-requests');await page.getByRole('button',{name:'More actions for request 1465'}).click();await page.getByRole('menuitem',{name:'Copy payment message or link'}).click();await expect(page.getByRole('dialog',{name:'Share payment request'})).toBeVisible();await expect(page.getByLabel('Payment message preview')).toBeVisible();};
 await open();expect(writes).toEqual([]);
 for(const lang of ['en','pl','cz']){
  await page.getByLabel('Payment message language').selectOption(lang);
  const siblingsBefore=(await snapshot()).templates;
  await page.getByRole('button',{name:'Configure '+lang.toUpperCase()+' message'}).click();
  await page.getByLabel('Payment message template').fill(`${lang} ${width}: Hello {{firstName}} — {{invoiceNumber}}\n{{paymentUrl}}`);
  await page.getByRole('button',{name:'Save message',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Message saved for '+lang.toUpperCase()})).toBeVisible();
  const after=(await snapshot()).templates;
  for(const sibling of siblingsBefore.filter((t:any)=>t.templateKey!=='payment_request_share'||t.language!==lang))expect(after.find((t:any)=>t._id===sibling._id)).toEqual(sibling);
 }
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await page.getByRole('button',{name:'More actions for request 1465'}).click();await page.getByRole('menuitem',{name:'Copy payment message or link'}).click();await expect(page.getByLabel('Payment message preview')).toBeVisible();
 for(const [lang,domain]of [['en','www.ibogaready.com'],['pl','ibogaspirit.pl'],['cz','ibogaspirit.cz']]){
  await page.getByLabel('Payment message language').selectOption(lang);const preview=await page.getByLabel('Payment message preview').inputValue();expect(preview).toContain(`${lang} ${width}: Hello Ewa — 1465`);expect(preview).toContain('https://'+domain+'/');expect(preview).not.toContain('{{');
  await page.getByRole('button',{name:'Copy message',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__sharedClipboard)).toBe(preview);
  await page.getByRole('button',{name:'Copy link only'}).click();await expect.poll(()=>page.evaluate(()=>(window as any).__sharedClipboard)).toBe(await page.getByLabel('Private payment link').inputValue());
 }
 await page.screenshot({path:test.info().outputPath('share-message.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const done=await snapshot();expect(done.templates.find((t:any)=>t._id===f.ids.unrelated)).toEqual(unrelated);expect(done.payments).toBe(0);expect(done.requests).toBe(0);expect(done.emails).toBe(0);expect(writes).toHaveLength(3);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Share payment request'})).toHaveCount(0);await page.waitForLoadState('networkidle');await page.unrouteAll({behavior:'wait'});
});
