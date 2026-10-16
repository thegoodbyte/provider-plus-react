import {test,expect} from '@playwright/test';
// Run with MRR_DTO_URL pointing at the isolated validator built from the API DTO.
test.skip(!process.env.MRR_DTO_URL, 'Requires isolated production DTO validation fixture');
for(const width of [1440,390]) test(`WhatsApp saves pass production DTO validation and survive reload ${width}`,async({page,request})=>{
 await page.setViewportSize({width,height:1000});
 const advisor='507f1f77bcf86cd799439011';let saves=0;
 let row:any={_id:'r1',display_id:1404,status:'pending',reviewChannel:'internal',assignedToUserId:advisor,retreatId:'retreat',requestType:'ekg_review'};
 const invalid=await request.post(process.env.MRR_DTO_URL!,{data:{advisorDeliveryStatus:'sent'}});
 expect(invalid.status()).toBe(400);expect(await invalid.text()).toContain('property advisorDeliveryStatus should not exist');
 await page.route('**/*',async route=>{
  const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const p=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
  if(p==='/medical-review-requests/r1'&&req.method()==='PATCH'){
   const payload=req.postDataJSON();expect(payload).not.toHaveProperty('advisorDeliveryStatus');
   const validation=await request.post(process.env.MRR_DTO_URL!,{data:payload});
   expect(validation.status(),await validation.text()).toBe(200);
   row={...row,...await validation.json()};saves++;return json(row);
  }
  if(p==='/medical-review-requests')return json([row]);
  if(p==='/medical-review-groups'||p==='/medical-review-requests/groups')return json([{_id:'g',title:'Synthetic WhatsApp Packet',reviewRequestIds:['r1'],retreatId:'retreat',endDate:'2026-12-31'}]);
  if(p==='/retreats')return json([{_id:'retreat',retreatCode:'TEST-WA'}]);
  if(p==='/users')return json([{_id:advisor,role:'medical_advisor',firstName:'Synthetic',lastName:'Advisor'}]);
  if(p==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto('/admin/medical-review-requests');
 await page.getByText('Synthetic WhatsApp Packet',{exact:true}).click();
 await page.getByRole('button',{name:'Handle via WhatsApp',exact:true}).click();
 await expect.poll(()=>saves).toBe(1);
 await page.reload();await page.getByText('Synthetic WhatsApp Packet',{exact:true}).click();
 await page.getByRole('button',{name:'WhatsApp: awaiting answer',exact:true}).click();
 await page.getByLabel('WhatsApp status').selectOption('responded');
 await page.getByLabel('Advisor result').selectOption('OK');
 await page.getByLabel('What did the advisor say?').fill('Synthetic advisor response');
 await page.getByRole('button',{name:'Save and return to list',exact:true}).click();
 await expect.poll(()=>saves).toBe(2);expect(row.status).toBe('approved');expect(row.whatsappDecision).toBe('OK');
 await page.reload();
 await page.getByRole('button',{name:'WhatsApp handled',exact:true}).click();
 await expect(page.getByRole('cell',{name:/^(Result )?OK$/,exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:/^(Note )?Synthetic advisor response$/,exact:true})).toBeVisible();
 expect(saves).toBe(2);
});

for(const width of [1440,390]) test(`detailed MRR WhatsApp result validates and reloads ${width}`,async({page,request})=>{
 await page.setViewportSize({width,height:1000});
 const advisor='507f1f77bcf86cd799439011';let saves=0;
 let row:any={_id:'507f1f77bcf86cd799439042',display_id:1388,status:'pending',reviewChannel:'internal',assignedToUserId:advisor,requestType:'ekg_review',artifactIds:[],clientId:{_id:'507f1f77bcf86cd799439041',display_id:1246,firstName:'Synthetic',lastName:'Client'}};
 await page.route('**/*',async route=>{
  const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const p=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
  if(p===`/medical-review-requests/${row._id}`&&req.method()==='PATCH'){
   const payload=req.postDataJSON();expect(payload).not.toHaveProperty('advisorDeliveryStatus');
   const validation=await request.post(process.env.MRR_DTO_URL!,{data:payload});expect(validation.status(),await validation.text()).toBe(200);
   row={...row,...await validation.json()};saves++;return json(row);
  }
  if(p==='/medical-review-requests')return json([row]);
  if(p===`/medical-review-requests/${row._id}`)return json(row);
  if(p.endsWith('/context'))return json({client:row.clientId,artifacts:{all:[]},reviewHistory:[]});
  if(p==='/users')return json([{_id:advisor,role:'medical_advisor',firstName:'Synthetic',lastName:'Advisor'}]);
  if(p==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto(`/admin/medical-review-requests/${row._id}`);
 await page.getByLabel('Handle this review via WhatsApp').check();
 await page.getByRole('combobox',{name:'Medical advisor',exact:true}).selectOption(advisor);
 await page.getByLabel('Date sent',{exact:true}).fill('2026-10-13');
 await page.getByRole('combobox',{name:'WhatsApp status',exact:true}).selectOption('responded');
 await page.getByLabel('Date approved/answered',{exact:true}).fill('2026-10-14');
 await page.getByRole('combobox',{name:'Advisor result',exact:true}).selectOption('OK');
 await page.getByPlaceholder('What the advisor said over WhatsApp (optional)').fill('Synthetic detailed response');
 await page.getByRole('button',{name:'Save WhatsApp status',exact:true}).click();
 await expect.poll(()=>saves).toBe(1);expect(row.status).toBe('approved');
 await page.reload();
 await expect(page.getByRole('combobox',{name:'Advisor result',exact:true})).toHaveValue('OK');
 await expect(page.getByLabel('Date approved/answered',{exact:true})).toHaveValue('2026-10-14');
 await expect(page.getByPlaceholder('What the advisor said over WhatsApp (optional)')).toHaveValue('Synthetic detailed response');
});
