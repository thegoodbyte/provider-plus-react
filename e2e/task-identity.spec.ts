import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const file=process.env.TASK_IDENTITY_FIXTURE, f=file?JSON.parse(fs.readFileSync(file,'utf8')):{};
test.skip(!file,'Use scripts/run-task-identity-e2e.cjs: required real API/Mongo runner fails when dependencies are missing.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390]) test(`screening task identity, view and edit persist at ${width}px`,async({page,request})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({role:'admin',email:'admin@example.invalid'}))},f.tokens.admin);
 await page.route('**/*',async route=>{
 const q=route.request(),u=new URL(q.url());if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();
 if(u.pathname.startsWith('/tasks')||u.pathname==='/clients'||u.pathname.startsWith('/clients/'))return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});
 if(q.method()!=='GET')throw Error('Unexpected write '+q.method()+' '+u.pathname);
 let data:any=[];if(u.pathname.includes('config-summary')||u.pathname==='/users/navigation-permissions')data={};if(u.pathname==='/environment/status')data={production:true};if(u.pathname==='/submission-notifications/unread-count')data={count:0};
 return route.fulfill({json:data});
 });
 await page.goto('/admin/clients/'+f.ids.client+'/screening');await expect(page.getByText(/Quick Tasks/)).toBeVisible();
 await page.getByRole('button',{name:/Add Task/}).click();await page.getByLabel('Task Name *').fill('Screening follow-up '+width);await page.getByRole('button',{name:'Create Task'}).click();
 const title=page.getByRole('button',{name:'Screening follow-up '+width,exact:true});await expect(title).toBeVisible();
 const row=title.locator('xpath=ancestor::div[contains(@class,"task-row")]');const ref=await row.locator('.task-reference').innerText();expect(ref).toMatch(/^Task #\d+$/);
 await expect(row.getByRole('link',{name:'Ewa Synthetic #1333'})).toHaveAttribute('href','/admin/clients/'+f.ids.client);
 const snapshot=async()=>(await request.get(f.url+'/fixture/snapshot')).json();const before=await snapshot();
 await title.click();const dialog=page.getByRole('dialog',{name:'Task details'});await expect(dialog.getByRole('heading')).toContainText(ref);
 await dialog.getByRole('button',{name:'Close task details'}).click();expect(await snapshot()).toEqual(before);
 await row.getByRole('button',{name:'View task',exact:true}).click();await dialog.getByRole('button',{name:'Edit task',exact:true}).click();await page.getByLabel('Task Name *').fill('Edited follow-up '+width);await page.getByRole('button',{name:'Update Task'}).click();
 await expect(page.getByRole('button',{name:'Edited follow-up '+width,exact:true})).toBeVisible();await page.reload();const edited=page.getByRole('button',{name:'Edited follow-up '+width,exact:true});await expect(edited).toBeVisible();const editedRow=edited.locator('xpath=ancestor::div[contains(@class,"task-row")]');await expect(editedRow.locator('.task-reference')).toHaveText(ref);
 if(process.env.TASK_IDENTITY_ARTIFACT_DIR){await editedRow.screenshot({path:path.join(process.env.TASK_IDENTITY_ARTIFACT_DIR,`task-${width}.png`)});await edited.click();await page.getByRole('dialog').screenshot({path:path.join(process.env.TASK_IDENTITY_ARTIFACT_DIR,`detail-${width}.png`)});}
 const after=await snapshot();expect(after.effects).toEqual([]);expect(after.tasks.length).toBe(before.tasks.length);
});
