import{test,expect}from'@playwright/test';
test.use({timezoneId:'Europe/Prague'});
for(const width of [1440,390])test('manual USD quote validates fields, records exact provider amount and retains provenance '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});const id='507f1f77bcf86cd799439011';let expense:any,writes=0;let preference='PLN';
 const row={bookingId:'b1',bookingNumber:1235,clientId:'c1',clientName:'Synthetic Client',referralId:id,referralName:'Synthetic Partner',retreatId:'t1',retreatCode:'TEST',amountOwed:850,owedCurrency:'PLN',commissionPercentage:10,payoutCurrency:'PLN',payoutAmount:850,usdEquivalent:217.96,usdEquivalentKind:'estimate',refereeId:'synthetic-payment-reference'};
 await page.route('**/*',async route=>{const req=route.request();if(!['xhr','fetch'].includes(req.resourceType()))return route.continue();const path=new URL(req.url()).pathname;const json=(data:any)=>route.fulfill({json:data});
 if(path==='/referrals')return json([{_id:id,name:'Synthetic Partner',referralCode:'SP',isActive:true,payoutCurrency:preference}]);
 if(path==='/referrals/report')return json([row]);
 if(path==='/referrals/payouts/quote'){const b=req.postDataJSON();return json({amount:b.manualUsdAmount,currency:'USD',originalTotals:{PLN:850},items:[{bookingId:'b1',amount:850,currency:'PLN',payoutAmount:b.manualUsdAmount,payoutCurrency:'USD',exchangeRate:b.manualUsdAmount/850,exchangeRateSource:b.fxQuoteSource,exchangeRateQuotedAt:b.fxQuotedAt}],manualFx:{source:b.fxQuoteSource,quotedAt:b.fxQuotedAt,usdAmount:b.manualUsdAmount,originalCurrency:'PLN',originalTotal:850,effectiveRate:b.manualUsdAmount/850}});}
 if(path==='/referrals/payouts'&&req.method()==='POST'){const b=req.postDataJSON();expect(b).toMatchObject({manualUsdAmount:216.57,fxQuoteSource:'Revolut website',fxQuotedAt:'2026-06-20T08:00:00.000Z',expectedPayoutAmount:216.57,expectedPayoutCurrency:'USD',expenseDate:'2026-06-20'});writes++;expense={_id:'expense',amount:216.57,currency:'USD',status:'paid',expenseDate:'2026-06-20',referralId:id,retreatId:'t1',referralPayment:{referralId:id,referralName:'Synthetic Partner',manualFx:{source:b.fxQuoteSource,quotedAt:b.fxQuotedAt,usdAmount:216.57,originalCurrency:'PLN',originalTotal:850,effectiveRate:216.57/850}},referralPayoutItems:[{bookingId:'b1',bookingNumber:1235,clientName:'Synthetic Client',amount:850,currency:'PLN',payoutAmount:216.57,payoutCurrency:'USD',exchangeRateSource:b.fxQuoteSource,exchangeRateQuotedAt:b.fxQuotedAt}]};return json(expense);}
 if(path==='/referrals/payouts')return json(expense?[expense]:[]);
 if(path==='/environment/status')return json({environment:'local',production:false,enabledJobs:[]});return json([]);
 });
 await page.goto('/admin/referrals/commissions');
 await page.getByRole('button',{name:'Pay',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByRole('checkbox',{name:'Enter actual USD payment / provider quote'}).check();
 await expect(dialog.getByRole('button',{name:'Record paid expense'})).toBeDisabled();
 await dialog.getByLabel('Payment date',{exact:true}).fill('2026-06-20');
 await dialog.getByLabel('USD amount',{exact:true}).fill('216.57');
 await dialog.getByLabel('Quote date and time',{exact:true}).fill('2026-06-20T10:00');
 await expect(dialog).toContainText('Europe/Prague');await expect(dialog).toContainText('2026-06-20T08:00:00.000Z');
 await expect(dialog.getByRole('button',{name:'Record paid expense'})).toBeEnabled();expect(writes).toBe(0);
 await dialog.getByRole('button',{name:'Record paid expense'}).click();
 await expect(page).toHaveURL(/referrals\/payments/);await expect(page.getByText(/Manual USD quote/)).toContainText('Revolut website');
 await expect(page.getByText(/Quoted at:/)).toContainText('2026-06-20T08:00:00.000Z');
 preference='EUR';await page.reload();await expect(page.getByText(/Quoted at:/)).toContainText('2026-06-20T08:00:00.000Z');expect(expense.amount).toBe(216.57);expect(writes).toBe(1);
});
