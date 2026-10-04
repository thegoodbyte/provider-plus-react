import { expect, test } from '@playwright/test';

const retreatId = '507f1f77bcf86cd799439704';
const houseId = '507f1f77bcf86cd799439705';
const makeBoard = () => ({
  retreatId, houseName: 'Mountain house', houseChanged: false, revision: 0,
  rooms: [
    { id: 'r1', name: 'Room 1', floor: '1', bedCount: 3, hasBathroom: false, allowsSharing: true, availableBeds: 2, use: 'shared' as 'shared' | 'private' | 'blocked', occupants: [] as Array<{ bed: number; bookingId: string }> },
    { id: 'r2', name: 'Room 2', floor: '2', bedCount: 2, hasBathroom: true, allowsSharing: true, availableBeds: 1, use: 'private' as 'shared' | 'private' | 'blocked', occupants: [] as Array<{ bed: number; bookingId: string }> },
  ],
  guests: [
    { id: 'guest1', name: 'Anna Private', bookingNumber: 101, roomType: 'private_ensuite', amountPaid: 1000, currency: 'EUR' },
    { id: 'guest2', name: 'Bob Shared', clientId: 'client-bob', profilePictureUrl: 'https://avatars.example.test/bob.svg', bookingNumber: 102, roomType: 'shared', amountPaid: 1000, currency: 'EUR' },
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
    if (url.hostname === 'avatars.example.test') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="blue"/></svg>' });
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
        if (change.action === 'configure' && room) { room.availableBeds = change.availableBeds; room.use = change.use || (change.availableBeds === 1 ? 'private' : 'shared'); }
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

async function chooseGuest(page: any, label: string, name: string) {
  const slot = label.replace(/ guest$/, '');
  await page.getByRole('button', { name: `Edit ${slot}`, exact: true }).click();
  const picker = page.getByRole('combobox', { name: label });
  await picker.click();
  const listId = await picker.getAttribute('aria-controls');
  await page.locator(`[id="${listId}"]`).getByRole('option', { name: new RegExp(name) }).click();
}
async function save(page: any, label: string) {
  await page.getByRole('button', { name: `Save ${label}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit ${label}`, exact: true })).toBeEnabled();
}
async function release(page: any, label: string, guest: string) {
  await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
  await page.getByRole('button', { name: `Remove ${guest}`, exact: true }).click();
  await save(page, label);
}

test('shows vacant slots, saves selected names and photos, and excludes allocated guests until released', async ({page,baseURL}) => {
 const api=await mockApi(page,baseURL!);await page.goto(`/admin/retreats/${retreatId}/rooms`);
 await expect(page.getByText('Vacant',{exact:true})).toHaveCount(3);
 await expect(page.getByRole('combobox',{name:/guest/})).toHaveCount(0);
 await chooseGuest(page,'Room 1 Shared bed 1 guest','Bob Shared');expect(api.changes).toHaveLength(0);
 await save(page,'Room 1 Shared bed 1');expect(api.changes).toHaveLength(1);
 const slot=page.getByLabel('Room 1 Shared bed 1 slot');await expect(slot.getByText('Bob Shared',{exact:true})).toBeVisible();await expect(slot.locator('img')).toBeVisible();
 await page.getByRole('button',{name:'Edit Room 2 Private room',exact:true}).click();
 await page.getByRole('combobox',{name:'Room 2 Private room guest'}).click();await expect(page.getByRole('option',{name:/Bob Shared/})).toHaveCount(0);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await release(page,'Room 1 Shared bed 1','Bob Shared');await expect(slot.getByText('Vacant',{exact:true})).toBeVisible();
 await chooseGuest(page,'Room 2 Private room guest','Bob Shared');await save(page,'Room 2 Private room');await page.reload();await expect(page.getByLabel('Room 2 Private room slot').getByText('Bob Shared',{exact:true})).toBeVisible();
});
test('Cancel discards a guest selection and removal without saving',async({page,baseURL})=>{
 const api=await mockApi(page,baseURL!);await page.goto(`/admin/retreats/${retreatId}/rooms`);
 await chooseGuest(page,'Room 1 Shared bed 1 guest','Bob Shared');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(api.changes).toHaveLength(0);await expect(page.getByLabel('Room 1 Shared bed 1 slot').getByText('Vacant',{exact:true})).toBeVisible();
 await chooseGuest(page,'Room 1 Shared bed 1 guest','Bob Shared');await save(page,'Room 1 Shared bed 1');await page.getByRole('button',{name:'Edit Room 1 Shared bed 1',exact:true}).click();await page.getByRole('button',{name:'Remove Bob Shared',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(api.changes).toHaveLength(1);await expect(page.getByLabel('Room 1 Shared bed 1 slot').getByText('Bob Shared',{exact:true})).toBeVisible();
});
test('refreshes saved guest cards after a simultaneous save conflict',async({page,baseURL})=>{
 await mockApi(page,baseURL!,true);await page.goto(`/admin/retreats/${retreatId}/rooms`);await chooseGuest(page,'Room 1 Shared bed 1 guest','Carol Shared');await page.getByRole('button',{name:'Save Room 1 Shared bed 1',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Room allocations changed');await expect(page.getByLabel('Room 1 Shared bed 1 slot').getByText('Bob Shared',{exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:/guest/})).toHaveCount(0);
});
test('keeps editing and guest-picker photos inside a narrow screen',async({page,baseURL})=>{
 await mockApi(page,baseURL!);await page.setViewportSize({width:390,height:844});await page.goto(`/admin/retreats/${retreatId}/rooms`);
 await page.getByRole('button',{name:'Edit Room 1 Shared bed 1',exact:true}).click();await page.getByRole('combobox',{name:'Room 1 Shared bed 1 guest'}).click();const list=page.getByRole('listbox');await expect(list).toBeVisible();await expect.poll(async()=>(await list.boundingBox())!.x).toBeGreaterThanOrEqual(0);await expect.poll(async()=>{const bounds=(await list.boundingBox())!;return bounds.x+bounds.width;}).toBeLessThanOrEqual(390);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.getByRole('region',{name:'Room allocation board'}).evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(false);
});
test('keeps private and one-bed shared configurations distinct',async({page,baseURL})=>{
 const api=await mockApi(page,baseURL!);await page.goto(`/admin/retreats/${retreatId}/rooms`);const room=page.getByRole('article',{name:'Room 1',exact:true});await room.getByRole('button',{name:'Private',exact:true}).click();await expect(page.getByRole('button',{name:'Edit Room 1 Private room',exact:true})).toBeVisible();await room.getByRole('button',{name:'Shared',exact:true}).click();await page.getByLabel('Room 1 available beds').selectOption('1');await chooseGuest(page,'Room 1 Shared bed 1 guest','Bob Shared');await save(page,'Room 1 Shared bed 1');expect(api.changes).toContainEqual(expect.objectContaining({action:'configure',use:'shared',availableBeds:1}));await release(page,'Room 1 Shared bed 1','Bob Shared');await room.getByRole('button',{name:'Closed',exact:true}).click();await expect(room.getByText('Room closed for this retreat.')).toBeVisible();
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

