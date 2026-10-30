import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import BookingEditorForm from './BookingEditorForm';
import { bookingsApi, clientsApi, paymentRequestsApi, ceremoniesApi } from '../services/api';
import { roomInventoryApi } from '../services/roomInventoryApi';
jest.mock('../services/authService', () => ({ authService: { getUser: () => ({ role: 'staff' }) } }));
jest.mock('../services/api', () => ({ bookingsApi: { getNextBookingNumber: jest.fn().mockResolvedValue({data:9500}), create: jest.fn(), update: jest.fn(), getOne: jest.fn(), isBookingNumberAvailable: jest.fn() }, clientsApi: { getBookingOptions: jest.fn() }, ceremoniesApi: { getByRetreat: jest.fn() }, paymentRequestsApi: { getOne: jest.fn(), getAllFresh: jest.fn() }, referralsApi: { getAll: jest.fn() } }));
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
