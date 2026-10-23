import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`MRR won't-do reason and Other validation save at ${width}px`,async({page})=>{
 const id='507f1f77bcf86cd799439916';let writes:any[]=[];
 let review:any={_id:id,display_id:1916,status:'pending',requestType:'ekg_review',artifactIds:[],clientId:{_id:'507f1f77bcf86cd799439915',firstName:'Synthetic',lastName:'Review'}};
 await page.setViewportSize({width,height:1000});await page.addInitScript(()=>{localStorage.setItem('token','synthetic-review');localStorage.setItem('user',JSON.stringify({id:'fixture-admin',role:'admin',email:'admin@example.invalid'}));});
 await page.route('**/*',async route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const path=new URL(req.url()).pathname;let data:any=[];
  if(path.endsWith('/review')&&req.method()==='POST'){const body=req.postDataJSON();writes.push(body);review={...review,...body,status:'wont_do'};data=review;}
  else if(path==='/medical-review-requests')data=[review];
  else if(path===`/medical-review-requests/${id}`)data=review;
  else if(path.endsWith('/context'))data={artifacts:{all:[]},reviewHistory:[]};
  else if(path.endsWith('/client-messages'))data={messages:[],skippedNotifications:[]};
  else if(path==='/environment/status')data={production:false};
  return route.fulfill({json:data});});
 await page.goto('/admin/medical-review-requests/'+id);
 const panel=page.locator(width===390?'.mrr-mobile-review-section':'.mrr-canvas-actions');await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:"Won't do",exact:true}).click();const save=panel.getByRole('button',{name:'Save review',exact:true});await expect(save).toBeDisabled();
 const reason=panel.getByLabel('Why won’t we do this?');await reason.selectOption('other');await save.click();expect(writes).toHaveLength(0);await expect(page.getByText('Explain the Other reason before saving.',{exact:true}).first()).toBeVisible();
 await panel.getByPlaceholder('Explain why this will not be done').fill('Duplicate submission confirmed by staff.');await save.click();await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toMatchObject({reviewDecision:'WONT_DO',wontDoReason:'other',wontDoNote:'Duplicate submission confirmed by staff.'});
 await page.reload();await expect(page.getByText(/Won.t do/).first()).toBeVisible();expect(review.wontDoNote).toBe('Duplicate submission confirmed by staff.');expect(writes).toHaveLength(1);
 await page.screenshot({path:`../mrr-wont-do-${width}.png`,fullPage:true});
});
