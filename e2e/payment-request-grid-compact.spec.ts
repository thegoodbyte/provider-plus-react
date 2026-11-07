import {test,expect} from '@playwright/test';
for (const width of [1440,390]) test(`compact payment request identity, FX tooltip and labelled Duplicate at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const record={_id:'000000000000000000000001',invoiceNumber:'INV-997',context:'retreat',clientId:{_id:'000000000000000000000010',firstName:'Ewa',lastName:'Franus',display_id:1333},retreatId:{_id:'000000000000000000000020',code:'NOV-29-26'},bookingId:{_id:'000000000000000000000030',bookingNumber:1500},currency:'PLN',requestedAmount:2500.25,usd_amount:630.55,fullPrice:9500,requestType:'payment',status:'paid',paymentDate:'2026-11-07'};
 const service={_id:'000000000000000000000002',invoiceNumber:'SERVICE-997',context:'standalone_service',serviceDocument:{title:'Integration calls',client:{name:'One-off recipient'}},currency:'EUR',requestedAmount:100,status:'pending',paymentDate:'2026-11-06'};
 const writes:string[]=[];
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic');localStorage.setItem('user',JSON.stringify({id:'grid-staff',role:'admin',email:'staff@example.invalid'}));});
 await page.route('**/*',async route=>{const r=route.request();if(!['xhr','fetch'].includes(r.resourceType()))return route.continue();const p=new URL(r.url()).pathname;if(r.method()!=='GET'){writes.push(r.method()+' '+p);return route.abort();}
  if(p==='/payment-requests')return route.fulfill({json:[record,service]});if(p==='/payment-requests/'+record._id)return route.fulfill({json:record});
  if(p==='/environment/status')return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
  if(p.includes('config-summary')||p.includes('navigation-permissions'))return route.fulfill({json:{}});
  return route.fulfill({json:[]});
 });
 await page.goto('/admin/payment-requests');
 const row=page.getByRole('row').filter({has:page.getByRole('button',{name:'INV-997',exact:true})});
 await expect(row).toBeVisible();
 for(const col of ['Retreat','USD','Currency'])await expect(page.getByRole('columnheader',{name:col,exact:true})).toHaveCount(0);
 await expect(page.getByRole('columnheader')).toHaveCount(8);
 const client=row.locator('[data-label="Client"]');await expect(client).toContainText('Ewa Franus');await expect(client).toContainText('#1333');await expect(client.getByRole('link',{name:'NOV-29-26',exact:true})).toHaveAttribute('href','/admin/retreats/'+record.retreatId._id);
 await expect(row.getByRole('link',{name:'Booking #1500',exact:true})).toHaveAttribute('href','/admin/bookings/'+record.bookingId._id);
 const amount=row.getByText('2,500.25 PLN',{exact:true});await amount.scrollIntoViewIfNeeded();
 if(width===1440)await amount.hover();else await amount.click();
 await expect(page.getByRole('tooltip')).toContainText('Recorded USD equivalent: 630.55 USD');
 await page.mouse.click(1,990);await page.mouse.move(0,0);await amount.blur();
 // Keyboard focus exposes the same recorded value; missing FX never becomes a fake zero.
 await amount.focus();await expect(page.getByRole('tooltip')).toContainText('630.55 USD');await amount.blur();
 const second=page.getByRole('row').filter({has:page.getByRole('button',{name:'SERVICE-997',exact:true})});await expect(second.locator('[data-label="Client"]')).toContainText('Integration calls');
 await second.getByText('100 EUR',{exact:true}).focus();await expect(page.getByRole('tooltip').filter({hasText:'USD equivalent not available'})).toBeVisible();
 await page.mouse.move(0,0);await second.getByText('100 EUR',{exact:true}).blur();
 const duplicate=row.getByRole('button',{name:'Duplicate payment request',exact:true});await expect(duplicate).toHaveText(/Duplicate/);await duplicate.scrollIntoViewIfNeeded();
 if(process.env.GRID_ARTIFACT_DIR){await row.screenshot({path:process.env.GRID_ARTIFACT_DIR+`/row-${width}.png`});await page.screenshot({path:process.env.GRID_ARTIFACT_DIR+`/grid-${width}.png`,fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await duplicate.click();await expect(page).toHaveURL(new RegExp('/admin/payment-requests/new\\?duplicateFrom='+record._id));
 expect(writes).toEqual([]);await page.unrouteAll({behavior:'wait'});
});
