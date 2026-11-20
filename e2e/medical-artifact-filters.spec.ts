import {test,expect}from '@playwright/test';
for(const width of [1440,768,390])test(`medical artifact filters and library scope at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});let writes=0;
 const rows=[{_id:'a'.repeat(24),display_id:1050,title:'Synthetic current EKG',bookingId:'booking-AAA',clientId:'client-AAA',artifactType:'ekg',documentStage:'entry',documentType:'EKG',status:'stored'},{_id:'b'.repeat(24),display_id:1051,title:'Synthetic other library',bookingId:'booking-BBB',clientId:'client-BBB',artifactType:'blood_pressure',documentStage:'pre_ceremony',documentType:'BP',status:'stored'},{_id:'c'.repeat(24),display_id:1052,title:'Synthetic past retreat',bookingId:'booking-CCC',clientId:'client-CCC',artifactType:'liver_panel',documentStage:'post_ceremony',documentType:'Liver',status:'stored',retreatId:'past'}];
 await page.route('**/*',async route=>{
  const q=route.request(),p=new URL(q.url()).pathname;if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();if(q.method()!=='GET'){writes++;return route.abort();}
  if(p==='/medical-artifacts')return route.fulfill({json:rows});
  if(p==='/booking-documents/types')return route.fulfill({json:[{key:'bp_type',medicalArtifactType:'blood_pressure',libraryPlacement:'documents'}]});
  if(p==='/retreats')return route.fulfill({json:[{_id:'past',name:'Past Retreat',endDate:'2000-01-01'}]});
  if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(p.startsWith('/medical-artifacts/retreat-submissions'))return route.fulfill({json:null});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/medical-artifacts');await expect(page.getByRole('heading',{name:'Medical Artifacts',exact:true})).toBeVisible();
 const more=page.getByRole('button',{name:/More filters/});await expect(more).toBeVisible();
 if(width>=768){
  const count=page.getByTestId('artifact-result-count');await expect(count).toHaveText('1 of 3');
  await expect(page.getByRole('link',{name:'Document types',exact:true})).toHaveAttribute('href','/admin/booking-document-types');
  await page.screenshot({path:info.outputPath(`closed-${width}.png`),fullPage:true,animations:'disabled'});
  await more.click();const panel=page.getByRole('region',{name:'More medical artifact filters'});await expect(panel).toBeVisible();
  await expect(panel.locator('input,select')).toHaveCount(7);
  await panel.getByLabel('Booking ID',{exact:true}).fill('booking-AAA');await expect(count).toHaveText('1 of 3');
  await panel.getByLabel('Booking ID',{exact:true}).fill('missing');await expect(count).toHaveText('0 of 3');await panel.getByLabel('Booking ID',{exact:true}).fill('');
  await panel.getByRole('checkbox',{name:'Include records assigned to the other library'}).check();await expect(count).toHaveText('2 of 3');
  await page.screenshot({path:info.outputPath(`filters-${width}.png`),fullPage:true,animations:'disabled'});
  const input=panel.getByLabel('Client ID',{exact:true});await input.scrollIntoViewIfNeeded();const box=await input.boundingBox();expect(box).not.toBeNull();
  expect(await input.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===el})).toBe(true);
  await page.getByRole('heading',{name:'Medical Artifacts',exact:true}).click();await expect(panel).toHaveCount(0);
  await page.getByRole('button',{name:'Future retreats',exact:true}).click();await expect(count).toHaveText('3 of 3');
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(count).toHaveText('3 of 3');
 }else{
  await more.click();const panel=page.getByRole('region',{name:'Mobile medical artifact filters'});await expect(panel).toBeVisible();
  await panel.getByRole('checkbox',{name:'Include records assigned to the other library'}).check();await panel.getByRole('checkbox',{name:'Future retreats only'}).uncheck();
  await expect(page.getByText('Synthetic other library',{exact:false}).filter({visible:true}).first()).toBeVisible();
  await page.screenshot({path:info.outputPath(`mobile-${width}.png`),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:/Hide filters/}).click();await expect(panel).toHaveCount(0);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(writes).toBe(0);
});
