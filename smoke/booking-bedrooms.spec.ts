import { test, expect } from '@playwright/test';
const clientId = '507f1f77bcf86cd799439824', bookingId = '507f1f77bcf86cd799439825';
const client = { _id: clientId, firstName: 'Bedroom', lastName: 'Fixture', display_id: 1824, email: 'rooms@example.invalid' };
const h1 = { _id:'house-1',name:'Garden house',allowsRoomSharing:false,bedrooms:[{name:'Garden room',hasBathroom:true},{name:'Closed room',active:false}] };
const h2 = { _id:'house-2',name:'Lake house',bedrooms:[{name:'Lake room'}] };
async function fixture(page: any, baseURL: string, mode='raw', failFirst=false, slowFirst=false) {
 let saved: any = null; let houseRequests=0;
 const retreats = [{_id:'retreat-1',name:'Garden retreat',code:'F-ROOM1',type:'regular',houseId:mode==='none'?undefined:mode==='populated'?h1:mode==='partial'?{_id:h1._id,name:h1.name}:h1._id,startDate:'2027-01-01',endDate:'2027-01-08'}, {_id:'retreat-2',name:'Lake retreat',code:'F-ROOM2',type:'regular',houseId:h2._id,startDate:'2027-02-01',endDate:'2027-02-08'}];
 await page.addInitScript(()=>{localStorage.setItem('token','synthetic-room-fixture');localStorage.setItem('user',JSON.stringify({id:'admin',role:'admin',email:'admin@example.invalid'}));});
 await page.route('**/*',async (route: any)=>{
  const req=route.request(),url=new URL(req.url()); if(url.origin===new URL(baseURL).origin)return route.continue();
  const path=url.pathname.replace(/^\/api(?=\/)/,''); let data:any=[];
  if(path==='/environment/status')data={production:true};
  if(path==='/users/navigation-permissions'||path==='/config-summary')data={};
  if(path==='/submission-notifications/unread-count')data={count:0};
  if(path==='/clients'||path==='/clients/booking-options')data=[client];
  if(path==='/retreats')data=retreats;
  if(path==='/bookings/next-booking-number')data=1824;
  if(path==='/bookings/booking-number-available')data={available:true};
  if(path==='/houses/house-1'){
   houseRequests++; if(slowFirst)await new Promise(r=>setTimeout(r,500));
   if(failFirst&&houseRequests===1)return route.fulfill({status:503,json:{message:'Synthetic house read failure'}}); data=h1;
  }
  if(path==='/houses/house-2')data=h2;
  if(path==='/bookings'){
   if(req.method()==='POST'){saved={...req.postDataJSON(),_id:bookingId};data=saved;}else data=saved?[saved]:[];
  }
  if(path===`/bookings/${bookingId}`){if(req.method()==='PATCH')saved={...saved,...req.postDataJSON()};data=saved;}
  if(path.startsWith('/room-inventory/'))data=path.endsWith('/options')?[]:{availableToSell:2,rooms:[]};
  return route.fulfill({json:data});
 });
 return {get saved(){return saved;},get houseRequests(){return houseRequests;}};
}
const open = (page:any)=>page.goto(`/admin/bookings/new?clientId=${clientId}&retreatId=retreat-1&totalAmount=500`);
for(const mode of ['raw','partial','populated'])test(`${mode} house reference offers bedrooms and saves/reloads the selection`,async({page,baseURL})=>{
 const state=await fixture(page,baseURL!,mode);await open(page);
 const bedroom=page.getByRole('combobox',{name:'Bedroom',exact:true});await expect(bedroom).toBeEnabled();await bedroom.selectOption('Garden room');
 await expect(bedroom.locator('option',{hasText:'Closed room'})).toHaveCount(0);
 await page.getByRole('button',{name:'Add Booking',exact:true}).click();await expect(page).toHaveURL(/\/admin\/bookings$/);
 expect(state.saved).toMatchObject({retreatId:'retreat-1',roomNumber:'Garden room'});if(mode==='populated')expect(state.houseRequests).toBe(0);
 await page.goto(`/admin/bookings/${bookingId}/edit`);await page.reload();await expect(page.getByRole('combobox',{name:'Bedroom',exact:true})).toHaveValue('Garden room');
});
test('changing the retreat clears the old room and offers only the new house bedrooms',async({page,baseURL})=>{
 await fixture(page,baseURL!);await open(page);const bedroom=page.getByRole('combobox',{name:'Bedroom',exact:true});await expect(bedroom).toBeEnabled();await bedroom.selectOption('Garden room');
 await page.getByPlaceholder('Search and select a retreat...').click();await page.getByText('Lake retreat (F-ROOM2)',{exact:true}).click();
 await expect(bedroom.locator('option',{hasText:'Lake room'})).toHaveCount(1);await expect(bedroom).toHaveValue('');await expect(bedroom.locator('option',{hasText:'Garden room'})).toHaveCount(0);
});
test('a failed house read shows Retry instead of a silently empty bedroom list',async({page,baseURL})=>{
 await fixture(page,baseURL!,'raw',true);await open(page);await expect(page.getByText('Could not load bedrooms for this retreat’s house.')).toBeVisible();
 await page.getByRole('button',{name:'Retry bedrooms',exact:true}).click();await expect(page.getByRole('combobox',{name:'Bedroom',exact:true})).toBeEnabled();await expect(page.getByRole('combobox',{name:'Bedroom',exact:true}).locator('option',{hasText:'Garden room'})).toHaveCount(1);
});
test('a retreat without a house explains why room assignment is unavailable',async({page,baseURL})=>{
 await fixture(page,baseURL!,'none');await open(page);await expect(page.getByText('This retreat has no house assigned.')).toBeVisible();await expect(page.getByRole('combobox',{name:'Bedroom',exact:true})).toBeDisabled();
});

test('an existing bedroom can be explicitly cleared and stays unassigned after reload',async({page,baseURL})=>{
 const state=await fixture(page,baseURL!);await open(page);let bedroom=page.getByRole('combobox',{name:'Bedroom',exact:true});await expect(bedroom).toBeEnabled();await bedroom.selectOption('Garden room');
 await page.getByRole('button',{name:'Add Booking',exact:true}).click();await expect(page).toHaveURL(/\/admin\/bookings$/);
 await page.goto(`/admin/bookings/${bookingId}/edit`);bedroom=page.getByRole('combobox',{name:'Bedroom',exact:true});await expect(bedroom).toHaveValue('Garden room');await bedroom.selectOption('');
 await page.getByRole('button',{name:'Update Booking',exact:true}).click();await expect(page).toHaveURL(/\/admin\/bookings$/);expect(state.saved.roomNumber).toBe('');
 await page.goto(`/admin/bookings/${bookingId}/edit`);await page.reload();await expect(page.getByRole('combobox',{name:'Bedroom',exact:true})).toHaveValue('');
});
