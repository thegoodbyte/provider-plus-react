import { test, expect } from '@playwright/test';
const clients = [
  {_id:'older',display_id:9431,firstName:'Earlier',lastName:'Guest',workflowStatus:'screened_accepted',screeningDate:'2026-10-20T00:00:00.000Z',country:'Poland'},
  {_id:'missing',display_id:9432,firstName:'Undated',lastName:'Guest',workflowStatus:'screening_scheduled',screeningCallAt:'2026-10-28T15:00:00Z',screeningCompletedDate:'2026-10-29',country:'Poland'},
  {_id:'newer',display_id:9433,firstName:'Latest',lastName:'Guest',workflowStatus:'screened_accepted',screeningData:{screeningDate:'2026-10-27'},screeningDate:'2026-12-31',screeningCompletedDate:'2027-01-01',country:'Czechia'},
  {_id:'invalid',display_id:9434,firstName:'Invalid',lastName:'Guest',workflowStatus:'screening_scheduled',screeningData:{screeningDate:'2026-02-30'},country:'Czechia'},
];
for(const [width,timeZone] of [[1440,'America/Los_Angeles'],[390,'Pacific/Kiritimati']] as const) test(`recorded screening dates and sorting at ${width}px in ${timeZone}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},timezoneId:timeZone});
 const page=await context.newPage();let writes=0;
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-read-only-token');localStorage.setItem('user',JSON.stringify({id:'staff',role:'admin',email:'staff@example.invalid'}));});
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(!['xhr','fetch'].includes(request.resourceType()))return route.continue();
  if(!['GET','HEAD'].includes(request.method()))writes++;
  if(url.pathname==='/clients')return route.fulfill({json:clients});
  if(url.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  return route.fulfill({json:[]});
 });
 try{
  await page.goto((process.env.PLAYWRIGHT_BASE_URL||'http://localhost:3000')+'/admin/screening');
  const sort=page.getByRole('button',{name:'Screening date',exact:true});await expect(sort).toBeVisible();
  const ids=()=>page.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.querySelectorAll('td')[1].textContent?.trim()));
  expect(await ids()).toEqual(['#9433','#9431','#9432','#9434']);
  await expect(page.locator('time[datetime="2026-10-27"]')).toHaveText('10/27/2026');
  await expect(page.locator('time[datetime="2026-10-20"]')).toHaveText('10/20/2026');
  await expect(page.locator('time[datetime="2026-12-31"]')).toHaveCount(0);
  await sort.click();
  await expect(page.getByRole('columnheader',{name:'Screening date'})).toHaveAttribute('aria-sort','ascending');
  expect(await ids()).toEqual(['#9431','#9433','#9432','#9434']);
  await page.screenshot({path:`${process.env.SCREENING_DATE_ARTIFACT_DIR||'test-results/screening-date'}/screening-date-${width}.png`});
  await page.getByLabel('Screening status').selectOption('screened_accepted');
  expect(await ids()).toEqual(['#9431','#9433']);
  await page.getByRole('textbox',{name:'Search screening clients'}).fill('Latest');
  await expect(page.locator('tbody tr')).toHaveCount(1);expect(await ids()).toEqual(['#9433']);
  await page.getByRole('textbox',{name:'Search screening clients'}).fill('');
  expect(await ids()).toEqual(['#9431','#9433']);
  await page.reload();
  await expect(sort).toBeVisible();expect(await ids()).toEqual(['#9433','#9431','#9432','#9434']);
  expect(writes).toBe(0);
 }finally{await context.close();}
});
