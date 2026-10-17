import {test,expect} from '@playwright/test';
const clientId='507f1f77bcf86cd799439101';
const clients=[{_id:clientId,display_id:1501,firstName:'Synthetic',lastName:'Match',email:'match@example.invalid',workflowStatus:'screening_scheduled',screeningData:{drugsHistory:'violet screening marker'},recreationalDrugs:'violet screening marker'}, {_id:'507f1f77bcf86cd799439102',display_id:1502,firstName:'Synthetic',lastName:'Other',workflowStatus:'screening_scheduled'}];
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin===new URL(baseURL!).origin)return route.continue();const path=u.pathname.replace(/^\/api/,'');
  if(path==='/clients')return route.fulfill({json:clients});
  if(path===`/clients/${clientId}`)return route.fulfill({json:clients[0]});
  if(path==='/notes')return route.fulfill({json:[{_id:'507f1f77bcf86cd799439111',clientId,title:'Quartz note',content:'quartz linked-note marker',tags:['amber']}]});
  if(path==='/environment/status')return route.fulfill({json:{production:true}});
  if(path==='/auth/verify')return route.fulfill({json:{role:'admin',id:'admin-e2e'}});
  if(path==='/launcher-config')return route.fulfill({json:{assignments:[]}});
  if(path==='/assistant/tasks-for-today')return route.fulfill({json:{tasks:[],retreats:[]}});
  return route.fulfill({json:[]});
 });
});
test('Clients searches saved screening fields and linked notes with contextual snippets',async({page})=>{
 await page.goto('/admin/clients');await page.getByRole('textbox',{name:'Search clients',exact:true}).fill('violet');await expect(page.getByRole('row').filter({hasText:'Synthetic Match'})).toContainText('violet');await expect(page.getByRole('row').filter({hasText:'Synthetic Other'})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Search clients',exact:true}).fill('quartz');await expect(page.getByRole('row').filter({hasText:'Synthetic Match'})).toContainText('quartz');
});
test('Global search includes note context and links to the client',async({page})=>{
 await page.goto('/admin/clients');await page.getByRole('textbox',{name:'Global search',exact:true}).fill('quartz');const result=page.getByRole('button').filter({hasText:'Quartz note'});await expect(result).toContainText('quartz linked-note marker');await result.click();await expect(page).toHaveURL(new RegExp(`/clients/${clientId}`));
});
test('Screening grid filters by deep screening terms and linked note content',async({page})=>{
 await page.goto('/admin/screening');await page.getByRole('textbox',{name:'Search screening clients',exact:true}).fill('violet');await expect(page.getByRole('row').filter({hasText:'Synthetic Match'})).toBeVisible();await expect(page.getByRole('row').filter({hasText:'Synthetic Other'})).toHaveCount(0);await page.getByRole('textbox',{name:'Search screening clients',exact:true}).fill('quartz');await expect(page.getByRole('row').filter({hasText:'Synthetic Match'})).toContainText('quartz');
});
