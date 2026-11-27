import {test,expect} from '@playwright/test';import fs from 'node:fs';
const file=process.env.TASK_INLINE_FIXTURE,f=file?JSON.parse(fs.readFileSync(file,'utf8')):{};
test.skip(!file,'Requires the no-skip coverage runner with real API/Mongo fixture.');
test.describe.configure({mode:'serial'});
for(const width of [1440,390])test(`inline task identity, assignment, due date and status persist across main and client grids at ${width}px`,async({page,request},info)=>{
 test.setTimeout(60000);await page.clock.setFixedTime(new Date("2026-11-27T12:00:00Z"));await request.post(f.url+'/fixture/inline-reset');
 const snapshot=async()=>(await request.get(f.url+'/fixture/assignment-snapshot')).json();
 const before=await snapshot(),sibling=before.tasks.find((t:any)=>t.name==='Untouched sibling');
 await page.setViewportSize({width,height:1000});await page.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify({role:'admin',email:'owner@example.invalid'}))},f.tokens.admin);
 let failWrite=false,failDirectory=false;
 await page.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());if(!['xhr','fetch'].includes(q.resourceType()))return route.continue();
  if(failWrite&&q.method()==='PATCH'&&u.pathname.startsWith('/tasks/')){failWrite=false;return route.fulfill({status:503,json:{message:'Synthetic save failure'}})}
  if(failDirectory&&u.pathname==='/tasks/assignees'){failDirectory=false;return route.fulfill({status:503,json:{message:'Synthetic directory failure'}})}
  if(u.pathname.startsWith('/tasks')||u.pathname==='/clients'||u.pathname.startsWith('/clients/')||u.pathname==='/retreats'||u.pathname==='/bookings')return route.fulfill({response:await route.fetch({url:f.url+u.pathname+u.search})});
  if(q.method()!=='GET')return route.abort();
  if(u.pathname==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(u.pathname.includes('config-summary')||u.pathname==='/users/navigation-permissions')return route.fulfill({json:{}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/tasks');
 const row=page.locator('.task-row').filter({has:page.getByRole('button',{name:'Legacy Martin task',exact:true})});
 const assignee=()=>row.getByRole('combobox',{name:'Assignee for Legacy Martin task'}),status=()=>row.getByRole('combobox',{name:'Status for Legacy Martin task'});
 await expect(assignee()).toHaveValue(f.ids.martin);await expect(assignee()).toBeEnabled();await expect(row.getByText('MH',{exact:true})).toBeVisible();
 await expect(row.locator('.task-due')).toContainText('3 Feb 2027');await expect(row.locator('.task-days-remaining')).toHaveText(/\d+ days remaining/);
 await assignee().selectOption(f.ids.users[1]);await expect(assignee()).toHaveValue(f.ids.users[1]);await expect(assignee()).toBeEnabled();
 await page.reload();await expect(assignee()).toHaveValue(f.ids.users[1]);
 failWrite=true;await status().selectOption('on_hold');await expect(page.getByRole('alert').filter({hasText:/Synthetic save failure/})).toBeVisible();await expect(status()).toHaveValue('pending');
 await status().selectOption('on_hold');await expect(status()).toHaveValue('on_hold');await expect(status()).toBeEnabled();await page.reload();await expect(status()).toHaveValue('on_hold');
 await page.goto('/admin/clients/'+f.ids.client+'/screening');await expect(page.getByText(/Quick Tasks/)).toBeVisible();await expect(status()).toHaveValue('on_hold');await expect(assignee()).toBeEnabled();
 await assignee().selectOption('');await expect(assignee()).toHaveValue('');await expect(assignee()).toBeEnabled();
 await status().selectOption('completed');await expect(status()).toHaveValue('completed');await expect(status()).toBeEnabled();await page.reload();await expect(status()).toHaveValue('completed');await expect(assignee()).toHaveValue('');
 await expect(row.locator('.task-days-remaining')).toHaveText('Done');
 await status().selectOption('pending');await expect(status()).toHaveValue('pending');await expect(status()).toBeEnabled();
 failDirectory=true;await page.reload();await expect(page.getByRole('alert').filter({hasText:'Could not load assignees.'})).toBeVisible();await expect(assignee()).toBeDisabled();await page.getByRole('button',{name:'Retry assignees'}).click();await expect(assignee()).toBeEnabled();
 await assignee().selectOption(f.ids.martin);await expect(assignee()).toHaveValue(f.ids.martin);await expect(assignee()).toBeEnabled();
 await page.screenshot({path:info.outputPath(`inline-tasks-${width}.png`),fullPage:true});
 await assignee().scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`inline-controls-${width}.png`),fullPage:true});
 const after=await snapshot(),saved=after.tasks.find((t:any)=>t.name==='Legacy Martin task');expect(saved.status).toBe('pending');expect(saved.assignedToUserId).toBe(f.ids.martin);expect(saved.completedAt).toBeNull();expect(after.tasks.find((t:any)=>t._id===sibling._id)).toEqual(sibling);expect(after.effects).toEqual([]);
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'wait'})});
