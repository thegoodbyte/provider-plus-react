import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import BookingEditorForm from './BookingEditorForm';
import { bookingsApi, clientsApi, paymentRequestsApi, ceremoniesApi, retreatsApi } from '../services/api';
import { roomInventoryApi } from '../services/roomInventoryApi';
jest.mock('../services/authService', () => ({ authService: { getUser: () => ({ role: 'staff' }) } }));
jest.mock('../services/api', () => ({ retreatsApi:{getAll:jest.fn()}, bookingsApi: { getNextBookingNumber: jest.fn().mockResolvedValue({data:9500}), create: jest.fn(), update: jest.fn(), getOne: jest.fn(), isBookingNumberAvailable: jest.fn() }, clientsApi: { getBookingOptions: jest.fn() }, ceremoniesApi: { getByRetreat: jest.fn() }, paymentRequestsApi: { getOne: jest.fn(), getAllFresh: jest.fn() }, referralsApi: { getAll: jest.fn() } }));
jest.mock('../services/roomInventoryApi', () => ({ roomInventoryApi: { view: jest.fn(), options: jest.fn(), preference: jest.fn() } }));
jest.mock('./SearchablePaymentRequestSelect', () => ({ __esModule: true, default: ({ onPaymentRequestSelect }: any) => <button type="button" onClick={() => onPaymentRequestSelect('new-request', { _id: 'new-request', retreatId: 'other-retreat', currency: 'USD', fullPrice: 9999, roomType: 'single' })}>Choose replacement request</button> }));
const booking: any = { _id: 'booking', bookingNumber: 1902, clientId: 'client', retreatId: 'retreat', paymentRequestId: 'old-request', totalAmount: 1000, amountPaid: 400, currency: 'PLN', status: 'confirmed', registrationDate: '2026-10-20', bookingType: 'full_retreat', roomType: 'private' };
beforeEach(() => {
 jest.clearAllMocks(); (bookingsApi.getNextBookingNumber as jest.Mock).mockResolvedValue({data:9500}); (bookingsApi.isBookingNumberAvailable as jest.Mock).mockResolvedValue({ data: { available: true } }); (clientsApi.getBookingOptions as jest.Mock).mockResolvedValue({ data: [{ _id: 'client', firstName: 'Synthetic', lastName: 'Client' }] });
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'old-request', requestedAmount: 1000, currency: 'PLN' } });
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
 (roomInventoryApi.view as jest.Mock).mockResolvedValue({ data: null }); (roomInventoryApi.options as jest.Mock).mockResolvedValue({ data: [] });
 (roomInventoryApi.preference as jest.Mock).mockResolvedValue({ data: null });
 (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({ data: [] }); (bookingsApi.update as jest.Mock).mockResolvedValue({ data: booking });
});
const open = () => render(<BookingEditorForm mode="edit" bookingId="booking" initialBooking={booking} initialRetreats={[{ _id: 'retreat', name: 'Current Retreat', type: 'regular', startDate: '2099-01-01', endDate: '2099-01-07' } as any]} onSaved={jest.fn()} onCancel={jest.fn()} />);
it('sends explicit null when clearing the primary request', async () => {
 open(); fireEvent.click(await screen.findByRole('button', { name: /Clear selection/i })); fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
 await waitFor(() => expect(bookingsApi.update).toHaveBeenCalledWith('booking', expect.objectContaining({ paymentRequestId: null, totalAmount: 1000, currency: 'PLN', retreatId: 'retreat' })));
});
it('keeps the existing agreement when choosing a request with different defaults', async () => {
 open(); fireEvent.click(await screen.findByRole('button', { name: 'Choose replacement request' })); fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
 await waitFor(() => expect(bookingsApi.update).toHaveBeenCalledWith('booking', expect.objectContaining({ paymentRequestId: 'new-request', totalAmount: 1000, currency: 'PLN', retreatId: 'retreat', roomType: 'private' })));
});

it('requires a full agreed price for a new request-based booking instead of guessing from its deposit',async()=>{const {container}=render(<BookingEditorForm mode="create" initialBookingData={{clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:0,paymentPlanEnabled:false}} initialRetreats={[{_id:'retreat',name:'Current Retreat',startDate:'2099-01-01',endDate:'2099-01-07'} as any]} onSaved={jest.fn()} onCancel={jest.fn()}/>);await screen.findByRole('button',{name:'Add Booking'});fireEvent.submit(container.querySelector('form')!);expect(await screen.findByText(/Enter the full agreed booking price/)).toBeInTheDocument();expect(bookingsApi.create).not.toHaveBeenCalled();});

const roomOptions = ['shared', 'private', 'private_ensuite'].map(key => ({key,active:true,labels:{en:key},occupancy:key==='shared'?'shared':'private',legacyRoomType:key}));
const openNewFromRequest = () => render(<BookingEditorForm mode="create" initialBookingData={{clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:2500,paymentPlanEnabled:false}} initialRetreats={[{_id:'retreat',name:'Current Retreat',startDate:'2099-01-01',endDate:'2099-01-07'} as any]} onSaved={jest.fn()} onCancel={jest.fn()}/>);
it('ignores an older initialization response after the linked request fills accommodation',async()=>{
 let finishOld!:(value:any)=>void;
 (bookingsApi.getNextBookingNumber as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValue({data:9501});
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'old-request',clientId:'client',roomType:'shared',accommodationKey:'shared'}});
 render(<React.StrictMode><BookingEditorForm mode="create" initialBookingData={{clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:2500}} initialRetreats={[{_id:'retreat',name:'Current Retreat'} as any]} onSaved={jest.fn()} onCancel={jest.fn()}/></React.StrictMode>);
 const field=await screen.findByRole('combobox',{name:/^Accommodation/});
 await waitFor(()=>expect(field).toHaveValue('shared'));
 await act(async()=>finishOld({data:9500}));
 expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('shared');
 expect(screen.getByDisplayValue('9501')).toHaveValue(9501);
});
it('prefills the known ensuite agreement when opening a new booking from a request URL',async()=>{
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'old-request',clientId:{_id:'client'},roomType:'private_ensuite',accommodationKey:'private_ensuite',fullPrice:2500}});
 openNewFromRequest();await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('private_ensuite'));
});
it('does not overwrite an explicit staff room choice when the request arrives late',async()=>{
 let finish!:(value:any)=>void;(paymentRequestsApi.getOne as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});openNewFromRequest();
 const field=await screen.findByRole('combobox',{name:/^Accommodation/});await screen.findByRole('option',{name:'private',exact:true});fireEvent.change(field,{target:{value:'private'}});
 await act(async()=>{finish({data:{_id:'old-request',clientId:'client',roomType:'shared',accommodationKey:'shared'}});});expect(field).toHaveValue('private');
});
it('does not borrow a different client room preference from a URL-linked request',async()=>{
 let finish!:(value:any)=>void;(paymentRequestsApi.getOne as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});openNewFromRequest();const field=await screen.findByRole('combobox',{name:/^Accommodation/});
 await act(async()=>{finish({data:{_id:'old-request',clientId:'another-client',roomType:'shared',accommodationKey:'shared'}});});expect(field).toHaveValue('');
});

const schedule:any={_id:'retreat',name:'Scheduled retreat',startDate:'2028-02-29',endDate:'2028-03-07',startTime:'18:30',endTime:'09:15'};
const createWithDates=(initial:any={},retreats:any[]=[schedule])=>render(<BookingEditorForm mode="create" initialBookingData={{clientId:'client',retreatId:'retreat',...initial}} initialRetreats={retreats} onSaved={jest.fn()} onCancel={jest.fn()}/>);
it('fills both dates for a URL-prefilled retreat after async list loading',async()=>{
 let finish!:(v:any)=>void;(retreatsApi.getAll as jest.Mock).mockImplementation(()=>new Promise(r=>{finish=r;}));
 createWithDates({},[]);await act(async()=>finish({data:[schedule]}));
 expect(await screen.findByLabelText('Arrival')).toHaveValue('2028-02-29T18:30');expect(screen.getByLabelText('Departure')).toHaveValue('2028-03-07T09:15');
});
it('preserves each explicitly supplied date and later staff edits when the linked request resolves',async()=>{
 let finish!:(v:any)=>void;(paymentRequestsApi.getOne as jest.Mock).mockImplementation(()=>new Promise(r=>{finish=r;}));
 createWithDates({paymentRequestId:'old-request',checkInDate:'2028-02-28T19:00'});const arrival=await screen.findByLabelText('Arrival');expect(arrival).toHaveValue('2028-02-28T19:00');expect(screen.getByLabelText('Departure')).toHaveValue('2028-03-07T09:15');
 fireEvent.change(arrival,{target:{value:'2028-03-01T12:00'}});await act(async()=>finish({data:{_id:'old-request',clientId:'client',retreatId:'retreat'}}));expect(arrival).toHaveValue('2028-03-01T12:00');
});
it('does not infer unknown dates or refill an existing booking with missing dates',async()=>{
 const view=createWithDates({},[{_id:'retreat',name:'No dates'}]);expect(await screen.findByLabelText('Arrival')).toHaveValue('');expect(screen.getByLabelText('Departure')).toHaveValue('');view.unmount();
 render(<BookingEditorForm mode="edit" initialBooking={{...booking,checkInDate:null,checkOutDate:null}} initialRetreats={[schedule]} onSaved={jest.fn()} onCancel={jest.fn()}/>);expect(await screen.findByLabelText('Arrival')).toHaveValue('');expect(screen.getByLabelText('Departure')).toHaveValue('');
});
it('booster links use their selected ceremony after loading, not the full retreat dates',async()=>{
 (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({data:[{_id:'ceremony',date:'2028-03-03T00:00:00.000Z'}]});
 createWithDates({bookingType:'booster',ceremonyId:'ceremony',ceremonyNumber:'1'});await waitFor(()=>expect(screen.getByLabelText('Arrival')).toHaveValue('2028-03-02T00:00'));expect(screen.getByLabelText('Departure')).toHaveValue('2028-03-03T00:00');
});

it('keeps custom departure while filling arrival and resolves a number-only booster record',async()=>{
 const view=createWithDates({checkOutDate:'2028-03-08T10:00'});expect(await screen.findByLabelText('Arrival')).toHaveValue('2028-02-29T18:30');expect(screen.getByLabelText('Departure')).toHaveValue('2028-03-08T10:00');view.unmount();
 (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({data:[{_id:'ceremony',date:'2028-03-03'}]});createWithDates({bookingType:'booster',ceremonyNumber:'1'});await waitFor(()=>expect(screen.getByLabelText('Arrival')).toHaveValue('2028-03-02T00:00'));expect(screen.queryByText(/doesn't have a ceremony record/)).not.toBeInTheDocument();
});

it('restores its own request accommodation after same-context initialization completes again',async()=>{
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'old-request',clientId:'client',roomType:'shared',accommodationKey:'shared'}});
 const initial={clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:2500};
 const retreats=[{_id:'retreat',name:'Current Retreat'} as any];
 const view=render(<BookingEditorForm mode="create" initialBookingData={initial} initialRetreats={retreats} onSaved={jest.fn()} onCancel={jest.fn()}/>);
 await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('shared'));
 view.rerender(<BookingEditorForm mode="create" initialBookingData={{...initial}} initialRetreats={retreats} onSaved={jest.fn()} onCancel={jest.fn()}/>);
 await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('shared'));
});
it('preserves an explicit staff agreement when equivalent create props refresh',async()=>{
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'old-request',clientId:'client',roomType:'shared',accommodationKey:'shared'}});
 const initial={clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:2500};const retreats=[{_id:'retreat',name:'Current Retreat'} as any];
 const props={mode:'create' as const,initialBookingData:initial,initialRetreats:retreats,onSaved:jest.fn(),onCancel:jest.fn()};
 const view=render(<BookingEditorForm {...props}/>);const field=await screen.findByRole('combobox',{name:/^Accommodation/});await waitFor(()=>expect(field).toHaveValue('shared'));fireEvent.change(field,{target:{value:'private'}});
 fireEvent.change(screen.getByLabelText('Departure'),{target:{value:'2099-01-09T10:00'}});
 view.rerender(<BookingEditorForm {...props} initialBookingData={{...initial}}/>);await screen.findByRole('button',{name:'Add Booking'});
 await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('private'));expect(screen.getByLabelText('Departure')).toHaveValue('2099-01-09T10:00');
});
it('resets the agreement for an actual client/request context change instead of carrying a sibling choice',async()=>{
 (roomInventoryApi.options as jest.Mock).mockResolvedValue({data:roomOptions});
 (paymentRequestsApi.getOne as jest.Mock).mockImplementation(id=>Promise.resolve({data:{_id:id,clientId:id==='new-request'?'second-client':'client',roomType:'shared',accommodationKey:'shared'}}));
 const initial={clientId:'client',retreatId:'retreat',paymentRequestId:'old-request',totalAmount:2500};const retreats=[{_id:'retreat',name:'Current Retreat'} as any];const props={mode:'create' as const,initialBookingData:initial,initialRetreats:retreats,onSaved:jest.fn(),onCancel:jest.fn()};
 const view=render(<BookingEditorForm {...props}/>);const field=await screen.findByRole('combobox',{name:/^Accommodation/});await waitFor(()=>expect(field).toHaveValue('shared'));fireEvent.change(field,{target:{value:'private'}});
 view.rerender(<BookingEditorForm {...props} initialBookingData={{...initial,clientId:'second-client',paymentRequestId:'new-request'}}/>);await waitFor(()=>expect(screen.getByRole('combobox',{name:/^Accommodation/})).toHaveValue('shared'));
});
