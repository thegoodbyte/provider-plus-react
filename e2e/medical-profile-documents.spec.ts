import { test, expect } from '@playwright/test';
const clientId='000000000000000000001220';
for (const width of [1440,390]) for (const scenario of ['reported','undated','unavailable']) test(`client medical documents ${scenario} at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1080});
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-only');localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'staff@example.invalid'}));});
 const writes:string[]=[];page.on('request',request=>{if(['xhr','fetch'].includes(request.resourceType())&&!['GET','HEAD'].includes(request.method()))writes.push(request.method()+' '+new URL(request.url()).pathname)});
 const artifacts=[{_id:'liver-source',clientId,documentType:'Liver',artifactType:'liver_panel',status:'stored',receivedAt:scenario==='undated'?undefined:'2026-10-24',files:[{fileName:'Liver.png',s3Key:'synthetic/liver.png'}]},{_id:'ekg-source',clientId,documentType:'EKG',artifactType:'ekg',status:'stored',receivedAt:scenario==='undated'?undefined:'2026-10-24',files:[{fileName:'EKG.jpg',s3Key:'synthetic/ekg.jpg'}]}];
 await page.route('**/*',route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const u=new URL(req.url());
  if(u.pathname==='/clients/'+clientId)return route.fulfill({json:{_id:clientId,display_id:1220,firstName:'Synthetic',lastName:'Client',dateOfBirth:'1990-01-01'}});
  if(u.pathname==='/client-medical/client/'+clientId)return route.fulfill({json:[]});
  if(u.pathname==='/medical-artifacts')return scenario==='unavailable'?route.fulfill({status:503,json:{message:'Synthetic source outage'}}):route.fulfill({json:artifacts});
  if(u.pathname==='/medical-review-requests')return route.fulfill({json:[{_id:'review-liver',display_id:1437,clientId,artifactIds:['liver-source'],status:'approved',reviewDecision:'OK'},{_id:'review-ekg',display_id:1438,clientId,artifactIds:['ekg-source'],status:'awaiting_whatsapp',whatsappStatus:'awaiting_response'}]});
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/medical/'+clientId);
 if(scenario==='unavailable') {await expect(page.getByRole('alert').filter({hasText:'Medical documents could not be loaded'})).toBeVisible();await expect(page.getByText('Document availability could not be confirmed.')).toHaveCount(2);}
 else {
  const liver=page.getByRole('region',{name:'Liver Panel'}),ekg=page.getByRole('region',{name:'EKG Report'});
  await expect(liver.getByText('Liver.png')).toBeVisible();await expect(liver.getByText('Approved',{exact:true})).toBeVisible();
  await expect(ekg.getByText('Awaiting WhatsApp response')).toBeVisible();
  await ekg.scrollIntoViewIfNeeded();
  const card=await ekg.boundingBox(),badge=await ekg.getByText('Awaiting WhatsApp response').boundingBox();
  expect(badge!.x+badge!.width).toBeLessThanOrEqual(card!.x+card!.width);
  await ekg.screenshot({path:`${process.env.PPVC928_ARTIFACT_DIR || '../ppvc-928-validation'}/ekg-${scenario}-${width}.png`});await expect(ekg.getByRole('link',{name:'MRR #1438'})).toHaveAttribute('href','/admin/medical-review-requests/review-ekg');
  await expect(ekg.getByRole('link',{name:'View Document'})).toHaveAttribute('href','/admin/medical-artifacts/ekg-source/files/0');
  await expect(page.getByText(/No EKG uploaded yet|No liver panel uploaded yet/)).toHaveCount(0);
  if(scenario==='undated')await expect(page.getByText('Received date not recorded')).toHaveCount(2);
  await expect(page.getByRole('heading',{name:'Final Medical Clearance'})).toHaveCount(0);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`${process.env.PPVC928_ARTIFACT_DIR || '../ppvc-928-validation'}/${scenario}-${width}.png`,fullPage:true});expect(writes).toEqual([]);
 await page.reload();await expect(page.getByRole('heading',{name:'Synthetic Client'})).toBeVisible();
});
