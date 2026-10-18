import { test, expect } from '@playwright/test';
const api = process.env.BOOSTER_FIXTURE_URL;
test.skip(!api, 'Requires isolated PPVC-570 real-Mongo fixture; never production.');
for (const width of [1440, 390]) test(`booster price editing persists and publishing controls public availability at ${width}px`, async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.addInitScript(() => { localStorage.setItem('token', 'synthetic-booster-fixture'); localStorage.setItem('user', JSON.stringify({ id:'fixture',role:'admin',email:'staff@example.invalid' })); });
  await page.route('**/*', async route => {
    const u=new URL(route.request().url()); if(u.origin===new URL(baseURL!).origin && !u.pathname.startsWith('/api/')) return route.continue();
    const p=u.pathname.replace(/^\/api(?=\/)/,'');
    if(p.startsWith('/booster-offers') || p==='/retreats' || p==='/bookings') {const response=await route.fetch({url:api+p+u.search});return route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':baseURL!,'access-control-allow-credentials':'true'}});}
    return route.fulfill({json:p==='/config-summary'||p==='/users/navigation-permissions'?{}:[]});
  });
  await page.goto('/admin/retreat/booster-offers');
  const localArrival = `2027-06-02T18:${width === 1440 ? '30' : '45'}`;
  await page.getByLabel('Arrival', { exact: true }).fill(localArrival);
  await expect(page.getByLabel('Arrival', { exact: true })).toHaveValue(localArrival);
  const form=page.getByRole('form',{name:'Price for ceremony 1'});
  await form.getByRole('spinbutton').fill(String(width));await form.getByRole('combobox').selectOption('PLN');await form.getByRole('button',{name:'Save price'}).click();
  await expect(form.getByRole('button',{name:'Save price'})).toBeEnabled();
  await page.reload();await expect(page.getByLabel('Arrival', { exact: true })).toHaveValue(localArrival);await expect(form.getByRole('spinbutton')).toHaveValue(String(width));await expect(form.getByRole('combobox')).toHaveValue('PLN');
  const published=page.getByRole('checkbox',{name:'Published'});if(await published.isChecked()) await published.click();await expect(published).not.toBeChecked();await expect(published).toBeEnabled();expect(await (await request.get(api+'/booster-offers/public')).json()).toEqual([]);
  await published.click();await expect(published).toBeChecked();await expect(published).toBeEnabled();const offers=await (await request.get(api+'/booster-offers/public')).json();expect(offers[0]).toMatchObject({price:width,currency:'PLN',remaining:2});
  await page.screenshot({path:`../ppvc-570-validation/offers-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
