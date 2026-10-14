import { expect, test } from '@playwright/test';
const reference='julian.B-48574403692_BEN061726-1184';
const secondReference='anna.N-48123456789_BEN061726-1185';
const first={ bookingId:'b1',bookingNumber:1184,clientId:'c1',clientName:'Julian B',referralId:'r1',referralName:'Partner',retreatId:'t1',retreatCode:'BEN-06-17-26',amountOwed:1700,owedCurrency:'PLN',commissionPercentage:20,refereeId:reference };
for(const width of [1440,390]) test(`copy canonical reference and selected payout total at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.addInitScript(()=>{(window as any).copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).copied.push(text);}},configurable:true});});
 const writes:any[]=[];
 await page.route('**/*',async route=>{
  if(!['xhr','fetch'].includes(route.request().resourceType()))return route.continue();
  const pathname=new URL(route.request().url()).pathname;const json=(value:any)=>route.fulfill({json:value});
  if(pathname==='/referrals')return json([{_id:'r1',name:'Partner',isActive:true}]);
  if(pathname==='/referrals/report')return json([first,{...first,bookingId:'b2',bookingNumber:1185,clientName:'Anna N',amountOwed:300,refereeId:secondReference},{...first,bookingId:'paid',bookingNumber:999,amountOwed:99000,paid:true,expenseId:'existing'},{...first,bookingId:'other',bookingNumber:1186,retreatId:'t2',retreatCode:'OTHER',amountOwed:500,owedCurrency:'EUR'}]);
  if(pathname==='/referrals/payouts'&&route.request().method()==='POST'){writes.push(route.request().postDataJSON());return json({_id:'recorded'});}
  if(pathname==='/environment/status')return json({environment:'development',production:false,enabledJobs:[]});
  return json([]);
 });
 await page.goto('/admin/referrals/commissions');
 await page.getByLabel('Filter by retreat').selectOption('t1');
 await expect(page.getByText('Retreat total to pay').locator('..')).toContainText('2,000.00');
 await expect(page.getByLabel('Select commission for booking 999')).toBeDisabled();
 await page.getByLabel('Select commission for booking 1184').check();
 await expect(page.getByRole('region',{name:'Selected payment total'})).toContainText('1,700.00');
 await page.getByRole('button',{name:'Pay selected (1)'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Reference',{exact:true})).toHaveValue(reference);
 await dialog.getByRole('button',{name:'Copy reference for booking 1184'}).click();
 await expect(dialog.getByRole('status')).toHaveText('Reference copied.');expect(await page.evaluate(()=>(window as any).copied)).toEqual([reference]);expect(writes).toHaveLength(0);
 await page.screenshot({path:`../ppvc-808-validation/single-${width}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByLabel('Select commission for booking 1185').check();
 await expect(page.getByRole('region',{name:'Selected payment total'})).toContainText('2,000.00');
 await page.getByRole('button',{name:'Pay selected (2)'}).click();
 await expect(dialog.getByLabel('Reference',{exact:true})).toHaveValue(reference+'; '+secondReference);
 for(const code of await dialog.locator('code').all()){const box=await code.boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(width);}
 await page.screenshot({path:`../ppvc-808-validation/grouped-${width}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Record paid expense'}).click();
 await expect(page).toHaveURL(/\/referrals\/payments\?referralId=r1/);
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({bookingIds:['b1','b2'],reference:reference+'; '+secondReference});
});
