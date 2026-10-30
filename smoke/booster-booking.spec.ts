import { test, expect, Page } from '@playwright/test';

// UTC-midnight ceremony dates must keep their calendar day west of UTC.
test.use({ timezoneId: 'America/New_York' });

// PPVC-626: actual built UI and routing, isolated stateful API fixture.
// Every external request is intercepted; no production data or messages.
const clientId = '507f1f77bcf86cd799439626';
const retreatId = '507f1f77bcf86cd799439627';
const bookingId = '507f1f77bcf86cd799439628';
const ceremonies = [1, 2].map(n => ({ _id: `ceremony-${n}`, retreatId, date: `2027-06-${n === 1 ? '03' : '06'}T00:00:00.000Z`, ceremonyNumber: n }));
const client = { _id: clientId, firstName: 'Booster', lastName: 'Fixture', display_id: 1626, email: 'booster@example.invalid' };
const retreat = { _id: retreatId, name: 'Booster test retreat', code: 'B626', retreatCode: 'B626', type: 'regular', status: 'active', capacity: 3, ceremonyCount: 2, startDate: '2027-06-01', endDate: '2027-06-08', startTime: '18:00', endTime: '11:00' };

async function fixture(page: Page, baseURL: string, ceremonyRecords = ceremonies) {
  const writes: any[] = [];
  let saved: any = null;
  await page.addInitScript(() => {
    localStorage.setItem('token', 'synthetic-booster-test');
    localStorage.setItem('user', JSON.stringify({ id: 'fixture-admin', role: 'admin', email: 'admin@example.invalid' }));
  });
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/api/')) return route.continue();
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let data: any = [];
    if (path === '/environment/status') data = { production: true };
    if (path === '/users/navigation-permissions' || path === '/config-summary') data = {};
    if (path === '/submission-notifications/unread-count') data = { count: 0 };
    if (path === '/clients' || path === '/clients/booking-options') data = [client];
    if (path === `/clients/${clientId}`) data = client;
    if (path === '/retreats') data = [retreat];
    if (path === `/retreats/${retreatId}`) data = retreat;
    if (path.includes('/ceremonies/') && path.includes(retreatId)) data = ceremonyRecords;
    if (path === '/bookings/next-booking-number') data = 1626;
    if (path === '/bookings/booking-number-available') data = { available: true };
    if (path === '/bookings') {
      if (req.method() === 'POST') {
        const payload = req.postDataJSON(); writes.push(payload);
        saved = { ...payload, _id: bookingId, clientDetails: client, retreatDetails: retreat };
        data = saved;
      } else data = saved ? [saved] : [];
    }
    if (path === `/bookings/${bookingId}`) data = saved;
    if (path.startsWith('/room-inventory/')) data = path.endsWith('/options') ? [{key:'shared',active:true,labels:{en:'Shared'},occupancy:'shared',legacyRoomType:'shared'}] : { availableToSell: 3, rooms: [] };
    if (path.startsWith('/accommodation')) data = [];
    return route.fulfill({ json: data });
  });
  return { writes };
}

function selectWithOption(page: Page, value: string) {
  return page.locator('select').filter({ has: page.locator(`option[value="${value}"]`) });
}

for (const n of [1, 2]) {
  test(`booster ceremony ${n} saves its identity and dates, then survives reload`, async ({ page, baseURL }) => {
    const { writes } = await fixture(page, baseURL!);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`/admin/bookings/new?clientId=${clientId}&retreatId=${retreatId}`);
    await page.getByRole('combobox',{name:/^Accommodation/}).selectOption('shared');
    await selectWithOption(page, 'booster').selectOption('booster');
    await expect(page.locator('option').filter({ hasText: new RegExp(`Ceremony ${n} —`) })).toHaveCount(1);
    await selectWithOption(page, String(n)).filter({ has: page.locator('option[value=""]').filter({ hasText: 'Select ceremony' }) }).selectOption(String(n));
    const date = n === 1 ? '03' : '06'; const previous = n === 1 ? '02' : '05';
    const dates = page.locator('input[type="datetime-local"]');
    await expect(dates.nth(0)).toHaveValue(`2027-06-${previous}T00:00`);
    await expect(dates.nth(1)).toHaveValue(`2027-06-${date}T00:00`);
    await page.locator('input[type=number][required]').fill('450');
    await page.getByRole('button', { name: 'Add Booking', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/bookings$/);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ clientId, retreatId, bookingType: 'booster', ceremonyId: `ceremony-${n}`, ceremonyNumber: n });
    expect(writes[0].checkInDate).toBe(await page.evaluate(value => new Date(value).toISOString(), `2027-06-${previous}T00:00:00`));
    expect(writes[0].checkOutDate).toBe(await page.evaluate(value => new Date(value).toISOString(), `2027-06-${date}T00:00:00`));
    await page.goto(`/admin/bookings/${bookingId}/edit`);
    await page.reload();
    await expect(selectWithOption(page, 'booster')).toHaveValue('booster');
    await expect(selectWithOption(page, String(n)).filter({ has: page.locator('option[value=""]').filter({ hasText: 'Select ceremony' }) })).toHaveValue(String(n));
    await expect(dates.nth(0)).toHaveValue(`2027-06-${previous}T00:00`);
    await expect(dates.nth(1)).toHaveValue(`2027-06-${date}T00:00`);
    expect(errors).toEqual([]);
  });
}

test('missing ceremony records prevent a booster booking from being submitted', async ({ page, baseURL }) => {
  const { writes } = await fixture(page, baseURL!, []);
  await page.goto(`/admin/bookings/new?clientId=${clientId}&retreatId=${retreatId}`);
  await page.getByRole('combobox',{name:/^Accommodation/}).selectOption('shared');
    await selectWithOption(page, 'booster').selectOption('booster');
  await expect(page.getByText('Add ceremonies to this retreat before making a booster booking.')).toBeVisible();
  await selectWithOption(page, '1').filter({ has: page.locator('option[value=""]').filter({ hasText: 'Select ceremony' }) }).selectOption('1');
  await page.locator('input[type=number][required]').fill('450');
    await page.getByRole('button', { name: 'Add Booking', exact: true }).click();
  await expect(page.getByText('Ceremony 1 does not have a ceremony record yet for this retreat. Add it on the Ceremonies tab before booking a booster guest for it.')).toBeVisible();
  expect(writes).toEqual([]);
  await expect(page).toHaveURL(/\/admin\/bookings\/new/);
});
