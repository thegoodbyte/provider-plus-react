import { expect, test } from '@playwright/test';

const retreatId = '507f1f77bcf86cd799439704';
const houseId = '507f1f77bcf86cd799439705';
const makeBoard = () => ({
  retreatId, houseName: 'Mountain house', houseChanged: false, revision: 0,
  rooms: [
    { id: 'r1', name: 'Room 1', floor: '1', bedCount: 3, hasBathroom: false, allowsSharing: true, availableBeds: 2, occupants: [] as Array<{ bed: number; bookingId: string }> },
    { id: 'r2', name: 'Room 2', floor: '2', bedCount: 2, hasBathroom: true, allowsSharing: true, availableBeds: 1, occupants: [] as Array<{ bed: number; bookingId: string }> },
  ],
  guests: [
    { id: 'guest1', name: 'Anna Private', bookingNumber: 101, roomType: 'private_ensuite', amountPaid: 1000, currency: 'EUR' },
    { id: 'guest2', name: 'Bob Shared', bookingNumber: 102, roomType: 'shared', amountPaid: 1000, currency: 'EUR' },
    { id: 'guest3', name: 'Carol Shared', bookingNumber: 103, roomType: 'shared', amountPaid: 1000, currency: 'EUR' },
  ],
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-token');
    localStorage.setItem('user', JSON.stringify({ id: 'admin-e2e', email: 'admin@example.com', role: 'admin' }));
  });
});

async function mockApi(page: any, baseURL: string, conflict = false) {
  let board = makeBoard();
  let house: any = { _id: houseId, name: 'Mountain house', address: 'Test address', capacity: 5, numberOfRooms: 2, numberOfBathrooms: 1, bedrooms: [
    { _id: '507f1f77bcf86cd799439706', name: 'Room 1', floor: '1', bedCount: 3, allowsSharing: true },
  ] };
  const changes: any[] = [];
  let savedHouse: any;
  await page.route('**/*', async (route: any) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.pathname === `/retreats/${retreatId}/room-allocation`) {
      if (request.method() === 'PATCH') {
        const change = request.postDataJSON(); changes.push(change);
        if (conflict) {
          conflict = false; board.revision++;
          board.rooms[0].occupants = [{ bed: 1, bookingId: 'guest2' }];
          return route.fulfill({ status: 409, json: { message: 'Room allocations changed. Refresh and try again' } });
        }
        if (change.revision !== board.revision) return route.fulfill({ status: 409, json: { message: 'Refresh allocations' } });
        const room = board.rooms.find(item => item.id === change.roomId);
        if (change.action === 'configure' && room) room.availableBeds = change.availableBeds;
        if (change.action === 'assign' && room) room.occupants = [
          ...room.occupants.filter(occupant => occupant.bed !== change.bed),
          ...(change.bookingId ? [{ bed: change.bed, bookingId: change.bookingId }] : []),
        ];
        board.revision++;
      }
      return route.fulfill({ json: board });
    }
    if (url.pathname === `/houses/${houseId}` && request.method() === 'PATCH') {
      savedHouse = request.postDataJSON(); house = { ...house, ...savedHouse };
      return route.fulfill({ json: house });
    }
    if (url.pathname === '/houses') return route.fulfill({ json: [house] });
    if (url.pathname === `/retreats/${retreatId}`) return route.fulfill({ json: { _id: retreatId, name: 'Mountain Retreat', startDate: '2026-12-01', endDate: '2026-12-08', status: 'upcoming', capacity: 5, houseId } });
    if (url.pathname === '/retreats') return route.fulfill({ json: [] });
    if (url.pathname.includes('summary')) return route.fulfill({ json: {} });
    if (url.pathname.startsWith('/auth')) return route.fulfill({ json: { id: 'admin-e2e', role: 'admin' } });
    return route.fulfill({ json: [] });
  });
  return { changes, savedHouse: () => savedHouse };
}

test('allocates shared beds and a private room, blocks duplicate choices, and releases guests', async ({ page, baseURL }) => {
  await mockApi(page, baseURL!);
  await page.goto(`/admin/retreats/${retreatId}/rooms`);
  await expect(page.getByRole('tab', { name: 'Room allocation', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('Room 1 Shared bed 1 guest').selectOption('guest2');
  await expect(page.getByLabel('Room 1 available beds')).toBeDisabled();
  await expect(page.getByLabel('Room 1 Shared bed 2 guest')).toBeEnabled();
  await expect(page.getByLabel('Room 1 Shared bed 2 guest').locator('option[value="guest2"]')).toHaveCount(0);
  await expect(page.getByLabel('Room 1 Shared bed 3 guest')).toHaveCount(0);
  await page.getByLabel('Room 1 Shared bed 2 guest').selectOption('guest3');
  await page.getByLabel('Room 2 Private room guest').selectOption('guest1');
  await expect(page.getByLabel('Room 2 available beds')).toBeDisabled();
  await expect(page.getByLabel('Room 2 Shared bed 1 guest')).toHaveCount(0);
  await expect(page.getByText('Unassigned guests (0)')).toBeVisible();
  await page.getByRole('button', { name: 'Release Bob Shared' }).click();
  await page.getByRole('button', { name: 'Release Carol Shared' }).click();
  await page.getByLabel('Room 1 available beds').selectOption('1');
  await expect(page.getByLabel('Room 1 Private room guest')).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Release Anna Private' })).toBeVisible();
  await expect(page.getByLabel('Room 1 Private room guest')).toBeVisible();
});

test('refreshes the board after a simultaneous allocation conflict', async ({ page, baseURL }) => {
  await mockApi(page, baseURL!, true);
  await page.goto(`/admin/retreats/${retreatId}/rooms`);
  await page.getByLabel('Room 1 Shared bed 1 guest').selectOption('guest3');
  await expect(page.getByRole('alert')).toContainText('Room allocations changed');
  await expect(page.getByRole('button', { name: 'Release Bob Shared' })).toBeVisible();
  await expect(page.getByLabel('Room 1 Shared bed 2 guest')).toBeEnabled();
});

test('saves house room floors and physical bed limits while preserving bedroom IDs', async ({ page, baseURL }) => {
  const api = await mockApi(page, baseURL!);
  await page.goto('/admin/houses');
  await page.getByTitle('Edit', { exact: true }).click();
  await page.getByRole('tab', { name: 'Room configuration' }).click();
  await page.getByLabel('Bedroom 1 floor').fill('Ground');
  await page.getByLabel('Bedroom 1 beds').fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => api.savedHouse()).toMatchObject({ bedrooms: [
    { _id: '507f1f77bcf86cd799439706', name: 'Room 1', floor: 'Ground', bedCount: 2 },
  ] });
});

test('keeps the room board usable on a narrow screen', async ({ page, baseURL }) => {
  await mockApi(page, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/admin/retreats/${retreatId}/rooms`);
  await expect(page.getByLabel('Room 1 Shared bed 1 guest')).toBeVisible();
  await expect(page.getByLabel('Room 2 Private room guest')).toBeVisible();
  const overflow = await page.getByRole('region', { name: 'Room allocation board' }).evaluate(element => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
});
