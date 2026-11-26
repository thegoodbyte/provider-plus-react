import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const file=process.env.MEDICAL_QUICK_FIXTURE;
const fixture:any=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
test.skip(!fixture,'Requires the isolated production-service quick review fixture');
test.describe.configure({mode:'serial'});
for(const width of [430,820])test(`single-record medical quick review persists with no session at ${width}px`,async({page,request},info)=>{
 const seed=await(await request.post(fixture.url+'/fixture/quick-reset')).json();
 await page.setViewportSize({width,height:1100});
 await page.addInitScript(()=>{localStorage.clear();sessionStorage.clear()});
 await page.route('**/*',async route=>{
  const r=route.request(),url=new URL(r.url());
  if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();
  if(url.pathname.startsWith('/medical-review-quick-access/')){
   const response=await request.fetch(fixture.url+url.pathname,{method:r.method(),headers:{...r.headers(),'X-Client-Timezone':'Europe/Warsaw'},data:r.postData()||undefined});return route.fulfill({response});
  }
  return route.fulfill({json:url.pathname==='/environment/status'?{environment:'local',production:false}:[]});
 });
 try{
  await page.goto(`/medical-reviews/mrr-${seed.alpha.display_id}/${seed.token}`);
  await expect(page.getByText('Synthetic Client',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Submit review',exact:true})).toBeDisabled();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const document=page.getByRole('link',{name:'Open result.svg'});await expect(document).toBeVisible();await expect(document).toHaveAttribute('href',fixture.url+'/fixture/artifact');
  const [popup]=await Promise.all([page.waitForEvent('popup'),document.click()]);await popup.waitForLoadState();await expect(popup.locator('svg')).toBeVisible();await popup.close();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('quick-review.png'),fullPage:true});
  await page.getByRole('button',{name:'Approved — clear to proceed',exact:true}).click();await page.getByLabel('Notes',{exact:true}).fill('Synthetic medical review accepted');
  await page.getByRole('button',{name:'Submit review',exact:true}).click();await expect(page.getByRole('heading',{name:/Thank you/i})).toBeVisible();
  let state=await(await request.get(fixture.url+'/fixture/quick-state')).json();const saved=state.reviews.find((x:any)=>x._id===seed.alpha._id);expect(saved.reviewDecision).toBe('OK');expect(saved.decisionHistory.at(-1).timezone).toBe('Europe/Warsaw');expect(saved.decisionHistory.at(-1).accessType).toBe('medical_review_quick_link');expect(state.reviews.find((x:any)=>x._id===seed.beta._id).status).toBe('pending');
  expect(await page.evaluate(()=>localStorage.getItem('token'))).toBeNull();
  await page.reload();await expect(page.getByText('Synthetic Client',{exact:true})).toBeVisible();
  await page.goto(`/medical-reviews/mrr-${seed.beta.display_id}/${seed.token}`);await expect(page.getByRole('heading',{name:"This link can't be opened"})).toBeVisible();await expect(page.getByText('Synthetic Client',{exact:true})).toHaveCount(0);
 }finally{await page.unrouteAll({behavior:'wait'})}
});
