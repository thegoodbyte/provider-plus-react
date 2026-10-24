import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentEditorPage from './PaymentEditorPage';
import { bookingsApi, clientsApi, configSummaryApi, paymentRequestsApi, serviceRequestsApi, paymentsApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getAll: jest.fn() }, clientsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() },
  configSummaryApi: { get: jest.fn() }, paymentRequestsApi: { getOne: jest.fn(), getOneFresh: jest.fn() }, serviceRequestsApi: { get: jest.fn() },
  paymentsApi: { getOne: jest.fn(), getAll: jest.fn(), getNextDisplayId: jest.fn(), conversionQuote: jest.fn(), convert: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
jest.mock('./BookingEditorForm',()=> (props: any)=><div><span>Booking prefill: {props.initialBookingData.clientId} / {String(props.initialBookingData.paymentPlanEnabled)}</span><button type="button" onClick={()=>props.onSaved({_id:'new-booking',clientId:props.initialBookingData.clientId,retreatId:'r1',bookingNumber:920,totalAmount:9000,currency:'PLN'})}>Create synthetic booking</button><button type="button" onClick={props.onCancel}>Cancel synthetic booking</button></div>);
jest.mock('./SearchableClientSelect', () => (props: any) => <select aria-label="Client" value={props.selectedClientId} onChange={e => props.onClientSelect(e.target.value)}><option value="">Choose</option><option value="c1">Anna</option></select>);
jest.mock('./SearchableRetreatSelect', () => () => <div>Retreat selector</div>);
jest.mock('./SearchablePaymentRequestSelect', () => () => <div>Request selector</div>);
jest.mock('./SearchableBookingSelect', () => (props: any) => <select aria-label="Booking" value={props.selectedBookingId} onChange={e => props.onBookingSelect(e.target.value)}><option value="">Choose</option>{props.bookings.map((booking: any) => <option key={booking._id} value={booking._id}>{booking.bookingNumber}</option>)}</select>);
const mock = (fn: unknown) => fn as jest.Mock;
const view = (path = '/admin/payments/new?clientId=c1') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/payments/new" element={<PaymentEditorPage />} /><Route path="/admin/payments/:id/edit" element={<PaymentEditorPage />} /><Route path="/admin/payments" element={<div>Payment list</div>} /></Routes></MemoryRouter>);

beforeEach(() => {
  jest.resetAllMocks();
  mock(clientsApi.getAll).mockResolvedValue({ data: [{ _id: 'c1', firstName: 'Anna' }] });
  mock(retreatsApi.getAll).mockResolvedValue({ data: [] });
  mock(bookingsApi.getAll).mockResolvedValue({ data: [] });
  mock(configSummaryApi.get).mockResolvedValue({ data: {} });
  mock(paymentsApi.getAll).mockResolvedValue({ data: [] });
  mock(paymentsApi.getNextDisplayId).mockResolvedValue({ data: 1002 });
  mock(paymentsApi.convert).mockResolvedValue({ data: { amount: 100 } });
  mock(paymentsApi.create).mockResolvedValue({ data: {} });
  mock(paymentsApi.update).mockResolvedValue({ data: {} });
});

test('records a client-only payment with a purpose and no booking, retreat or request', async () => {
  view();
  expect(await screen.findByRole('checkbox', { name: 'Client payment (no booking yet)' })).toBeChecked();
  expect(screen.queryByText('Retreat selector')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '150' } });
  fireEvent.change(screen.getByLabelText('Purpose *'), { target: { value: 'Medical exam before booking' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Payment' }));
  await screen.findByText('Payment list');
  expect(paymentsApi.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1', amount: 150, description: 'Medical exam before booking', status: 'completed', retreatId: undefined, bookingId: undefined, paymentRequestId: undefined }));
});

test('requires a meaningful purpose and reports API failures without losing entered values', async () => {
  view(); await screen.findByLabelText('Amount');
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '150' } });
  fireEvent.change(screen.getByLabelText('Purpose *'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Payment' }));
  await screen.findByText('Enter a purpose for this client payment.');
  expect(paymentsApi.create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Purpose *'), { target: { value: 'Medical exam' } });
  mock(paymentsApi.create).mockRejectedValue({ response: { data: { message: 'Save failed' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Payment' }));
  await screen.findByText('Save failed');
  expect(screen.getByLabelText('Amount')).toHaveValue(150);
  expect(screen.getByLabelText('Purpose *')).toHaveValue('Medical exam');
});

test('links an existing payment while preserving its original amount, currency and purpose', async () => {
  mock(paymentsApi.getOne).mockResolvedValue({ data: { _id: 'p1', display_id: 1002, clientId: 'c1', amount: 150, currency: 'EUR', status: 'completed', paymentMethod: 'cash', description: 'Medical exam', paymentDate: '2026-09-16' } });
  mock(bookingsApi.getAll).mockResolvedValue({ data: [{ _id: 'b1', clientId: 'c1', retreatId: 'r1', bookingNumber: 12, currency: 'PLN', totalAmount: 5000 }, { _id: 'other', clientId: 'c2', retreatId: 'r1', bookingNumber: 99 }] });
  view('/admin/payments/p1/edit');
  await screen.findByRole('button', { name: 'Link to a booking' });
  fireEvent.click(screen.getByRole('button', { name: 'Link to a booking' }));
  expect(screen.queryByRole('option', { name: '99' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Booking'), { target: { value: 'b1' } });
  expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
  expect(screen.getByLabelText('Amount')).toHaveValue(150);
  fireEvent.click(screen.getByRole('button', { name: 'Update Payment' }));
  await waitFor(() => expect(paymentsApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ bookingId: 'b1', retreatId: 'r1', amount: 150, currency: 'EUR', description: 'Medical exam' })));
  expect(paymentsApi.create).not.toHaveBeenCalled();
});

test('records the outstanding standalone amount without retreat or booking controls', async()=>{
  const request={_id:'s1',context:'standalone_service',clientId:'c1',requestedAmount:25,amountOutstanding:15,currency:'EUR',requestType:'full_payment',status:'pending',invoiceNumber:'2000'};
  mock(paymentRequestsApi.getOneFresh).mockResolvedValue({data:request});mock(serviceRequestsApi.get).mockResolvedValue({data:request});
  view('/admin/payments/new?paymentRequestId=s1');
  await waitFor(()=>expect(screen.getByLabelText('Amount')).toHaveValue(15));
  expect(screen.queryByText('Retreat selector')).not.toBeInTheDocument();expect(screen.queryByLabelText('Booking')).not.toBeInTheDocument();expect(screen.getByLabelText('Currency')).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Add Payment'}));await screen.findByText('Payment list');
  expect(paymentsApi.create).toHaveBeenCalledWith(expect.objectContaining({clientId:'c1',paymentRequestId:'s1',amount:15,currency:'EUR',retreatId:undefined,bookingId:undefined,isFinalPayment:false}));
});

test('records EUR received against a PLN request with a confirmed PLN equivalent and source', async () => {
 const request: any = { _id: 'q1', clientId: 'c1', retreatId: 'r1', bookingId: 'b1', requestedAmount: 1000, currency: 'PLN', requestType: 'payment', status: 'pending' };
 mock(bookingsApi.getAll).mockResolvedValue({ data: [{ _id: 'b1', clientId: 'c1', retreatId: 'r1', bookingNumber: 12, currency: 'PLN', totalAmount: 1000 }] });
 mock(paymentRequestsApi.getOneFresh).mockResolvedValue({ data: request });
 mock(paymentsApi.conversionQuote).mockResolvedValue({ data: { amount: 430, rate: 4.3, rateDate: '2026-10-16', source: 'ECB reference rate' } });
 view('/admin/payments/new?paymentRequestId=q1'); await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(1000));
 fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } });
 fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
 fireEvent.change(screen.getByLabelText('Request conversion method'), { target: { value: 'manual' } });
 fireEvent.change(screen.getByLabelText('PLN credited equivalent'), { target: { value: '425' } });
 fireEvent.change(screen.getByLabelText('Request conversion source'), { target: { value: 'Revolut bank confirmation #123' } });
 fireEvent.change(screen.getByLabelText('Request conversion date'), { target: { value: '2026-10-17' } });
 fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
 fireEvent.click(screen.getByRole('button', { name: 'Add Payment' }));
 await waitFor(() => expect(paymentsApi.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, currency: 'EUR', paymentRequestId: 'q1', requestCurrencyAmount: 425, requestCurrencyExchangeMode: 'manual', requestCurrencyExchangeSource: 'Revolut bank confirmation #123', requestCurrencyExchangeDate: '2026-10-17' })));
});


test('links a payment back to its source scratchpad receipt', async () => {
 mock(paymentsApi.getOne).mockResolvedValue({ data: { _id: 'p1', display_id: 1002, clientId: 'c1', amount: 150, currency: 'EUR', status: 'completed', paymentMethod: 'cash', paymentDate: '2026-09-16', sourceScratchpadId: 'sp1' } });
 view('/admin/payments/p1/edit');
 expect(await screen.findByRole('link', { name: 'Source scratchpad receipt sp1' })).toHaveAttribute('href', '/admin/payments/scratchpad/sp1');
});

test('shows the stable source scratchpad number on the payment record', async () => {
 mock(paymentsApi.getOne).mockResolvedValue({ data: { _id:'p1',display_id:1002,clientId:'c1',amount:150,currency:'EUR',status:'completed',paymentMethod:'cash',paymentDate:'2026-09-16',sourceScratchpadId:{_id:'sp1',display_id:919} } });
 view('/admin/payments/p1/edit');
 expect(await screen.findByRole('link',{name:'Source scratchpad receipt SP-919'})).toHaveAttribute('href','/admin/payments/scratchpad/sp1');
});


test('shows a client-filtered booking picker even for a new client-only payment',async()=>{
 mock(bookingsApi.getAll).mockResolvedValue({data:[{_id:'b1',clientId:'c1',bookingNumber:12,retreatId:'r1',currency:'PLN',totalAmount:9000},{_id:'other',clientId:'c2',bookingNumber:99},{_id:'unknown',bookingNumber:88}]});
 view();await screen.findByLabelText('Amount');
 expect(screen.getByLabelText('Booking')).toBeInTheDocument();
 expect(screen.getByRole('option',{name:'12'})).toBeInTheDocument();expect(screen.queryByRole('option',{name:'99'})).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:'88'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'150'}});fireEvent.change(screen.getByLabelText('Booking'),{target:{value:'b1'}});
 expect(screen.getByLabelText('Amount')).toHaveValue(150);expect(screen.getByLabelText('Currency')).toHaveValue('EUR');
 expect(screen.getByRole('checkbox',{name:'Client payment (no booking yet)'})).not.toBeChecked();
});
test('inline booking creation selects the saved booking without submitting or losing the payment draft',async()=>{
 view();await screen.findByLabelText('Amount');
 fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'3800'}});fireEvent.change(screen.getByLabelText('Currency'),{target:{value:'PLN'}});fireEvent.change(screen.getByLabelText('Purpose *'),{target:{value:'Deposit original receipt'}});
 fireEvent.click(screen.getByRole('button',{name:'Create booking for this client'}));
 expect(await screen.findByText('Booking prefill: c1 / false')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Create synthetic booking'}));
 await screen.findByText(/Booking #920 created and selected/);
 expect(screen.getByLabelText('Booking')).toHaveValue('new-booking');expect(screen.getByLabelText('Amount')).toHaveValue(3800);expect(screen.getByLabelText('Currency')).toHaveValue('PLN');
 expect(paymentsApi.create).not.toHaveBeenCalled();expect(paymentsApi.update).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Add Payment'}));
 await waitFor(()=>expect(paymentsApi.create).toHaveBeenCalledWith(expect.objectContaining({clientId:'c1',bookingId:'new-booking',retreatId:'r1',amount:3800,currency:'PLN',description:'Deposit original receipt'})));
});
test('cancelling inline booking creation leaves the original payment draft unchanged',async()=>{
 view();await screen.findByLabelText('Amount');fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'155'}});
 fireEvent.click(screen.getByRole('button',{name:'Create booking for this client'}));await screen.findByText('Booking prefill: c1 / false');fireEvent.click(screen.getByRole('button',{name:'Cancel synthetic booking'}));
 expect(screen.getByLabelText('Amount')).toHaveValue(155);expect(screen.getByLabelText('Booking')).toHaveValue('');expect(paymentsApi.create).not.toHaveBeenCalled();
});
