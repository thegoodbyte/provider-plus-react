import {test,expect} from '@playwright/test';
import path from 'node:path';

for (const width of [1440,1024,768,390]) test(`Quick Menu remains inside the viewport at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!['xhr','fetch'].includes(request.resourceType())) return route.continue();
    if(request.method()!=='GET') return route.abort();
    if(url.pathname==='/retreats') return route.fulfill({json:[{_id:'synthetic-retreat',name:'Synthetic retreat',startDate:'2026-11-01'}]});
    return route.fulfill({json:url.pathname==='/users/navigation-permissions'||url.pathname.includes('config-summary')?{}:url.pathname==='/environment/status'?{production:true}:[]});
  });
  await page.goto('/admin/ir-notifications');
  const trigger=page.getByRole('button',{name:'Quick Menu',exact:true});
  if(!await trigger.isVisible()) await page.getByLabel('Account and tools',{exact:true}).click();
  await trigger.click();
  const panel=page.locator('#quick-menu');
  await expect(panel.getByText('Choose app mode',{exact:true})).toBeVisible();
  const bounds=await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  await expect(panel.getByText('Shopping',{exact:true})).toBeVisible();
  if(process.env.QUICK_MENU_ARTIFACT_DIR) await page.screenshot({path:path.join(process.env.QUICK_MENU_ARTIFACT_DIR,`quick-menu-${width}.png`)});
  await panel.getByRole('button',{name:'Close quick menu'}).click();
  await expect(panel).toBeHidden();
});
