import { test, expect } from '@playwright/test';
for (const width of [1440,390]) test(`edit and reload six medical decision templates at ${width}px`, async ({ page, baseURL }) => {
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(()=>{localStorage.setItem('token','synthetic-template-fixture');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));});
  let settings:any={clientMedicalReviewEmailsEnabled:true,clientMedicalNeedsInfoEmailsEnabled:false,clientMedicalDeclinedEmailsEnabled:false,medicalReviewDeclinedTemplates:{cs:{subject:'Existing Czech subject',body:'Existing Czech custom body'}}};
  const writes:string[]=[];
  await page.route('**/*', async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(baseURL!).origin&&!url.pathname.startsWith('/api/'))return route.continue();
    const path=url.pathname.replace(/^\/api(?=\/)/,'');let data:any=[];
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes.push(path);
    if(path==='/communications/settings'){
      if(route.request().method()==='PATCH')settings={...settings,...route.request().postDataJSON()};
      data=settings;
    }
    if(path==='/client-contracts/gate-settings')data={enabled:false,preContractModules:[],portalAccessByStatus:{},portalModuleCatalog:[],portalStatusCatalog:[],portalAccessModes:[]};
    if(path==='/environment/status')data={production:true};
    if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
    if(path==='/submission-notifications/unread-count')data={count:0};
    return route.fulfill({json:data});
  });
  await page.goto('/admin/communications?tab=settings');
  await page.getByRole('button',{name:'Medical notifications',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'Needs-info emails',exact:true})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Declined emails',exact:true})).not.toBeChecked();
  await expect(page.getByLabel('Declined Czech subject',{exact:true})).toHaveValue('Existing Czech subject');
  const edits:any[]=[];
  for(const outcome of ['Needs more information','Declined'])for(const language of ['English','Czech','Polish']){
    const subject=`${outcome} ${language} custom subject`;
    const body=`${language}: Hello {{client.firstName}}\n\n{{document.type}}: {{links.clientPortal}}`;
    await page.getByLabel(`${outcome} ${language} subject`,{exact:true}).fill(subject);
    await page.getByLabel(`${outcome} ${language} body`,{exact:true}).fill(body);
    edits.push({outcome,language,subject,body});
  }
  await page.getByRole('button',{name:'Save notification settings',exact:true}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
  expect(settings.clientMedicalNeedsInfoEmailsEnabled).toBe(false);expect(settings.clientMedicalDeclinedEmailsEnabled).toBe(false);
  await page.reload();await page.getByRole('button',{name:'Medical notifications',exact:true}).click();
  for(const {outcome,language,subject,body} of edits){
    await expect(page.getByLabel(`${outcome} ${language} subject`,{exact:true})).toHaveValue(subject);
    await expect(page.getByLabel(`${outcome} ${language} body`,{exact:true})).toHaveValue(body);
  }
  expect(writes).toEqual(['/communications/settings','/client-contracts/gate-settings']);
  await page.getByRole('region',{name:'Needs more information email templates',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/ppvc865-${width}-templates.png`});
});
