import { test, expect } from '@playwright/test';
const response = 'Can stay on it but review the precautions with the advisor before making any changes. '.repeat(5) + 'End of actual response.';
for (const width of [1440, 390]) test(`retreat WhatsApp notes show actual response at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const retreat = { _id:'r1', name:'Synthetic Retreat', retreatCode:'WA-TEST', type:'regular', status:'scheduled', startDate:'2099-01-01', endDate:'2099-01-07', capacity:10 };
  const client = { _id:'c1', firstName:'Synthetic', lastName:'Guest', display_id:1900 };
  const reviews = [
    { _id:'m1',display_id:1367,clientId:'c1',requestType:'ekg_review',status:'approved',reviewChannel:'whatsapp',whatsappStatus:'responded',whatsappDecision:'OK',reviewNotes:'Advisor response received via WhatsApp' },
    { _id:'m2',display_id:1261,clientId:'c1',requestType:'medications_review',status:'caution',reviewChannel:'whatsapp',whatsappStatus:'responded',whatsappDecision:'caution',reviewNotes:'Advisor response received via WhatsApp: '+response },
    { _id:'m3',display_id:1380,clientId:'c1',requestType:'liver_panel_review',status:'approved',reviewNotes:'Internal advisor note' },
  ];
  const original = JSON.stringify(reviews);
  await page.route('**/*', async route => {
    const r=route.request(); if (!['xhr','fetch'].includes(r.resourceType())) return route.continue();
    const p=new URL(r.url()).pathname.replace(/^\/api(?=\/)/,'');
    if(r.method()!=='GET') throw Error('Unexpected write '+p);
    if(p==='/environment/status') return route.fulfill({json:{environment:'local',production:false,enabledJobs:[]}});
    if(p.startsWith('/bookings/retreat/')) return route.fulfill({json:[{_id:'b1',bookingNumber:1311,clientId:client,retreatId:retreat,status:'confirmed'}]});
    if(p.startsWith('/medical-review-requests')) return route.fulfill({json:reviews});
    if(p==='/retreats/r1') return route.fulfill({json:retreat});
    if(p==='/retreats') return route.fulfill({json:[retreat]});
    return route.fulfill({json:[]});
  });
  await page.goto('/admin/retreats/r1/tracking');
  const grid=page.locator('.retreat-medical-grid');
  const visibleNotes=grid.locator('.medical-cell-notes:visible');
  await expect(visibleNotes).toHaveCount(3);
  await expect(visibleNotes.filter({hasText:'WA: OK'})).toBeVisible();
  await expect(visibleNotes.filter({hasText:'Internal advisor note'})).toBeVisible();
  const actual=visibleNotes.filter({hasText:'End of actual response.'});
  await expect(actual).toHaveText('WA: '+response);
  await expect(actual).not.toContainText('Advisor response received');
  await actual.scrollIntoViewIfNeeded();
  const geometry=await actual.evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,clamp:getComputedStyle(e).webkitLineClamp}));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.height+1); expect(geometry.clamp).toBe('none');
  await actual.screenshot({path:`${process.env.WA_GRID_ARTIFACT_DIR || 'test-results'}/response-${width}.png`});
  const link=grid.getByRole('link',{name:'MRR #1261',exact:true}).filter({visible:true});
  await expect(link).toHaveAttribute('href','/admin/medical-review-requests/m2');
  await page.reload(); await expect(grid.locator('.medical-cell-notes:visible').filter({hasText:'End of actual response.'})).toHaveText('WA: '+response);
  expect(JSON.stringify(reviews)).toBe(original); expect(errors).toEqual([]);
});
