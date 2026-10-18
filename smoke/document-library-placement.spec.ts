import {test,expect} from '@playwright/test';
const client={_id:'507f1f77bcf86cd799439886',firstName:'Library',lastName:'Fixture',display_id:1886};
const retreat={_id:'507f1f77bcf86cd799439887',name:'Future fixture',startDate:'2030-01-01',endDate:'2030-01-08'};
const booking={_id:'507f1f77bcf86cd799439888',bookingNumber:1886,clientId:client,retreatId:retreat};
for(const width of [1440,390])test(`configure primary libraries and retain historical access at ${width}px`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-library-fixture');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));});
 let types:any[]=[{_id:'qtype',key:'questionnaire',label:'Health Questionnaire',builtIn:true,active:true,libraryPlacement:'documents',medicalArtifactType:'questionnaire',storeAsMedicalArtifact:true},{_id:'mtype',key:'medications_form',label:'Medications Form',builtIn:true,active:true,libraryPlacement:'medical',medicalArtifactType:'medications_form',storeAsMedicalArtifact:true}];
 const docs=['questionnaire','medications_form'].map((type,i)=>({_id:`doc${i}`,display_id:1800+i,documentType:type,title:`${type} document fixture`,clientId:client,bookingId:booking,retreatId:retreat,status:'stored',files:[],receivedAt:'2026-10-01'}));
 const artifacts=['questionnaire','medications_form'].map((type,i)=>({_id:`artifact${i}`,display_id:1900+i,artifactType:type,documentType:type,title:`${type} artifact fixture`,clientId:client,bookingId:booking,retreatId:retreat,status:'stored',files:[],receivedAt:'2026-10-01'}));
 artifacts.push({_id:'orphan-q',display_id:1999,artifactType:'questionnaire',documentType:'questionnaire',title:'Prebooking orphan questionnaire',clientId:client,bookingId:undefined as any,retreatId:retreat,status:'stored',files:[{fileName:'orphan-questionnaire.pdf',s3Key:'orphan-q.pdf',mimeType:'application/pdf'}] as any,receivedAt:'2026-10-01'});
 docs.push({_id:'orphan-med',display_id:1899,documentType:'medications_form',title:'Legacy medication without artifact',clientId:client,bookingId:booking,retreatId:retreat,status:'stored',files:[],receivedAt:'2026-10-01'});
 // Explicitly link the ordinary mirror pairs so the new read views do not duplicate them.
 (docs[0] as any).metadata={linkedMedicalArtifactId:'artifact0'};(docs[1] as any).metadata={linkedMedicalArtifactId:'artifact1'};
 const writes:any[]=[];let failNext=false;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===new URL(baseURL!).origin&&!url.pathname.startsWith('/api/'))return route.continue();
  const path=url.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push({path,body:req.postDataJSON()});
  if(path==='/booking-documents/types')data=types;
  if(path.startsWith('/booking-documents/types/')&&req.method()==='PATCH'){
   if(failNext){failNext=false;return route.fulfill({status:400,json:{message:'Unable to save fixture settings. Retry.'}});}
   types=types.map(type=>type._id===path.split('/').pop()?{...type,...req.postDataJSON()}:type);data=types.find(type=>type._id===path.split('/').pop());
  }
  if(path==='/medical-artifacts/orphan-q/files/view')return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
  if(path==='/booking-documents')data=docs;
  if(path==='/medical-artifacts')data=artifacts;
  if(path==='/retreats')data=[retreat];if(path==='/clients')data=[client];
  if(path==='/environment/status')data={production:true};
  if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
  if(path==='/submission-notifications/unread-count')data={count:0};
  return route.fulfill({json:data});
 });
 await page.goto('/admin/booking-documents');
 await expect(page.getByText('questionnaire document fixture',{exact:true})).toBeVisible();await expect(page.getByText('Prebooking orphan questionnaire',{exact:true})).toBeVisible();await expect(page.getByText('medications_form document fixture',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'View Prebooking orphan questionnaire',exact:true}).click();await expect(page.locator('iframe[title="orphan-questionnaire.pdf"]')).toBeVisible();await page.getByRole('button',{name:'Close document preview'}).click();
 await page.getByRole('checkbox',{name:'Include records assigned to the other library'}).check();await expect(page.getByText('medications_form document fixture',{exact:true})).toBeVisible();expect(writes).toHaveLength(0);
 await page.goto('/admin/medical-artifacts');await expect(page.getByRole('button',{name:'Quick MRR for artifact #1901',exact:true})).toBeVisible();await expect(page.getByText('Legacy medication without artifact',{exact:true}).filter({visible:true})).toBeVisible();await expect(page.getByRole('button',{name:'Quick MRR for artifact #1900',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open original document',exact:true}).click();await expect(page.getByRole('checkbox',{name:'Include records assigned to the other library'})).toBeChecked();await expect(page.getByText('Legacy medication without artifact',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Manage document types & library placement'}).click();
 const q=page.locator('.booking-document-type-row').filter({has:page.getByLabel('Library placement for Health Questionnaire')});
 await q.getByLabel('Library placement for Health Questionnaire').selectOption('both');failNext=true;await q.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText('Unable to save fixture settings. Retry.',{exact:true})).toBeVisible();await expect(q.getByLabel('Library placement for Health Questionnaire')).toHaveValue('both');
 await q.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Booking document type saved.',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Library placement for Health Questionnaire')).toHaveValue('both');
 await page.getByLabel('Library placement for Health Questionnaire').scrollIntoViewIfNeeded();
 const box=await page.getByLabel('Library placement for Health Questionnaire').boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
 await page.screenshot({path:`test-results/ppvc886-${width}-settings.png`});
 await page.goto('/admin/medical-artifacts');await expect(page.getByRole('button',{name:'Quick MRR for artifact #1900',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Quick MRR for artifact #1901',exact:true})).toBeVisible();
 await page.goto('/admin/booking-documents');await expect(page.getByText('questionnaire document fixture',{exact:true})).toBeVisible();await expect(page.getByText('medications_form document fixture',{exact:true})).toHaveCount(0);
 expect(writes).toHaveLength(2);expect(writes.every(write=>write.path==='/booking-documents/types/qtype')).toBe(true);
 expect(docs).toHaveLength(3);expect(artifacts).toHaveLength(3);
});
