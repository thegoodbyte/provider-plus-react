import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JointPaymentEditorPage from './JointPaymentEditorPage';
import { bookingsApi, clientsApi, paymentRequestsApi, paymentsApi } from '../services/api';

jest.mock('../services/api', () => ({ bookingsApi: { getAll: jest.fn() }, paymentRequestsApi: { getAll: jest.fn() }, clientsApi: { getBookingOptions: jest.fn() }, paymentsApi: { createJoint: jest.fn(), getReceipt: jest.fn(), splitExistingReceipt: jest.fn() } }));
const bookings = [
  { _id: 'booking-1', bookingNumber: 1300, clientId: { firstName: 'Łukasz', lastName: 'Nowak' }, retreatId: { retreatCode: 'JNO-11', name: 'November' }, status: 'confirmed' },
  { _id: 'booking-2', bookingNumber: 1301, clientId: { firstName: 'Anna', lastName: 'Nováková' }, retreatId: { retreatCode: 'JNO-12', name: 'December' }, status: 'confirmed' },
  { _id: 'booking-cancelled', bookingNumber: 9999, status: 'cancelled' },
];
const requests = [
  { _id: 'request-1', invoiceNumber: 'INV-1332', display_id: 1332, clientId: bookings[0].clientId, retreatId: bookings[0].retreatId, requestedAmount: 5700, currency: 'PLN', status: 'pending' },
  { _id: 'request-cancelled', invoiceNumber: 'CANCELLED-9999', requestedAmount: 10, currency: 'EUR', status: 'cancelled' },
];
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  (bookingsApi.getAll as jest.Mock).mockResolvedValue({ data: bookings });
  (paymentRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: requests });
  (paymentsApi.createJoint as jest.Mock).mockResolvedValue({ data: {} });
});
const open = async () => {
  render(<MemoryRouter><JointPaymentEditorPage /></MemoryRouter>);
  return screen.findByRole('combobox', { name: 'Payment request (optional)' });
};
const search = (input: HTMLElement, value: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
};

test('searches payment requests by typed invoice, client, retreat and amount and preserves the equal split', async () => {
  const input = await open();
  for (const term of ['1332', 'lukasz', 'jno-11', '5700']) {
    search(input, term);
    expect(await screen.findByRole('option', { name: /INV-1332/ })).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('option', { name: /INV-1332/ }));
  expect(screen.getByLabelText(/Total received/)).toHaveValue(5700);
  expect(screen.getByLabelText(/Currency/)).toHaveValue('PLN');
  screen.getAllByLabelText(/Allocated amount/).forEach(field => expect(field).toHaveValue(2850));
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue('');
  expect(screen.getByLabelText(/Total received/)).toHaveValue(5700);
});

test('searches each booking independently and saves selected record IDs', async () => {
  const requestInput = await open();
  search(requestInput, '1332');
  fireEvent.click(await screen.findByRole('option', { name: /INV-1332/ }));
  const first = screen.getByRole('combobox', { name: /Booking 1/ });
  const second = screen.getByRole('combobox', { name: /Booking 2/ });
  for (const term of ['1300', 'lukasz', 'jno-11']) {
    search(first, term);
    expect(await screen.findByRole('option', { name: /#1300/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /#1301/ })).not.toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('option', { name: /#1300/ }));
  expect(paymentsApi.createJoint).not.toHaveBeenCalled();
  // antd shows the committed selection in its own display element, not by
  // echoing the label back into the search <input>'s value (unlike the MUI
  // Autocomplete this replaced) -- assert against the select's visible text.
  await waitFor(() => expect(first.closest('.ant-select')).toHaveTextContent('#1300'));
  // Selecting an option doesn't close this dropdown by itself in the test
  // environment -- without closing it, its own (unfiltered) option list
  // stays in the DOM alongside the next select's, and since every per-row
  // select shares the same bookings as options, both can list booking-2
  // simultaneously and make an unscoped accessible-name query ambiguous.
  // Scope the query to the second select's own listbox to sidestep that.
  search(second, 'novakova');
  const secondListbox = document.getElementById(second.getAttribute('aria-controls')!)!;
  fireEvent.click(await within(secondListbox).findByRole('option', { name: /#1301/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Joint Payment' }));
  await waitFor(() => expect(paymentsApi.createJoint).toHaveBeenCalledWith(expect.objectContaining({ paymentRequestId: 'request-1', totalAmount: 5700, currency: 'PLN', allocations: [{ bookingId: 'booking-1', amount: 2850 }, { bookingId: 'booking-2', amount: 2850 }] })));
});

test('shows no-match feedback and does not accept arbitrary booking text as a selected record', async () => {
  const requestInput = await open();
  search(requestInput, 'CANCELLED-9999');
  expect(await screen.findByText('No payment requests match your search')).toBeInTheDocument();
  fireEvent.keyDown(requestInput, { key: 'Escape' });
  const first = screen.getByRole('combobox', { name: /Booking 1/ });
  search(first, '9999');
  expect(await screen.findByText('No bookings match your search')).toBeInTheDocument();
  fireEvent.submit(screen.getByRole('button', { name: 'Save Joint Payment' }).closest('form')!);
  expect(await screen.findByText('Select at least two bookings and enter a positive amount for each allocation.')).toBeInTheDocument();
  expect(paymentsApi.createJoint).not.toHaveBeenCalled();
});

const existingReceipt = { _id:'receipt-1', display_id:1142, totalAmount:7600, currency:'PLN', allocationCount:1, status:'received', receivedDate:'2026-10-19T00:00:00Z', paymentMethod:'bank_transfer', allocations:[{_id:'payment-1202',status:'completed',amount:7600,paymentRequestId:'request-1397'}] };
const openExisting = async (progress?: any) => {
  (bookingsApi.getAll as jest.Mock).mockResolvedValue({data:bookings.slice(0,2).map(b=>({...b,currency:'PLN',totalAmount:9500,retreatId:{_id:'retreat-1',name:'Same retreat'},clientId:{_id:b._id==='booking-1'?'client-1333':'client-1334',firstName:b._id==='booking-1'?'Participant One':'Participant Two'}}))});
  (clientsApi.getBookingOptions as jest.Mock).mockResolvedValue({data:[{_id:'client-1333',display_id:1333,firstName:'Participant',lastName:'One'}]});
  (paymentRequestsApi.getAll as jest.Mock).mockResolvedValue({data:[{_id:'request-1397',display_id:1397,currency:'PLN',requestedAmount:7600,fullPrice:19000,retreatId:'retreat-1'}]});
  (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({data:{...existingReceipt,...(progress?{splitProgress:progress}:{})}});
  (paymentsApi.splitExistingReceipt as jest.Mock).mockResolvedValue({data:{receiptId:'receipt-1'}});
  render(<MemoryRouter initialEntries={['/admin/payments/joint/new?receiptId=receipt-1']}><JointPaymentEditorPage/></MemoryRouter>);
  await screen.findByRole('button',{name:progress?'Resume receipt split':'Confirm receipt split'});
};
const chooseBooking = async (index: number, number: string) => {
  const box=screen.getByRole('combobox',{name:`Booking ${index}`});search(box,number);
  const list=document.getElementById(box.getAttribute('aria-controls')!)!;
  fireEvent.click(await within(list).findByRole('option',{name:new RegExp('#'+number)}));
};
test('existing mode locks receipt facts and sends only allocations after explicit confirmation', async()=>{
  await openExisting();
  expect(screen.getByLabelText(/Total received/)).toBeDisabled();expect(screen.getByLabelText(/Payment date/)).toBeDisabled();
  expect(screen.getByLabelText(/Total received/)).toHaveValue(7600);screen.getAllByLabelText(/Allocated amount/).forEach(input=>expect(input).toHaveValue(3800));
  expect(screen.getByRole('button',{name:'Confirm receipt split'})).toBeDisabled();
  await chooseBooking(1,'1300');await chooseBooking(2,'1301');expect(paymentsApi.splitExistingReceipt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Confirm receipt split'}));
  await waitFor(()=>expect(paymentsApi.splitExistingReceipt).toHaveBeenCalledWith('receipt-1',expect.objectContaining({confirm:true,sourcePaymentId:'payment-1202',expectedRevision:0,allocations:[{bookingId:'booking-1',amount:3800},{bookingId:'booking-2',amount:3800}]})));
  expect(paymentsApi.createJoint).not.toHaveBeenCalled();
});
test('pending split restores its immutable plan and operation key for recovery',async()=>{
  await openExisting({state:'pending',operationKey:'pending-confirmation-key',sourcePaymentId:'payment-1202',expectedRevision:0,allocations:[{bookingId:'booking-1',amount:3800},{bookingId:'booking-2',amount:3800}]});
  expect(screen.getByRole('combobox',{name:'Booking 1'})).toBeDisabled();expect(screen.getByRole('button',{name:'Divide equally'})).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Resume receipt split'}));
  await waitFor(()=>expect(paymentsApi.splitExistingReceipt).toHaveBeenCalledWith('receipt-1',expect.objectContaining({operationKey:'pending-confirmation-key'})));
  expect(paymentsApi.createJoint).not.toHaveBeenCalled();
});
