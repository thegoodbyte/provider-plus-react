import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentEditorPage from './PaymentEditorPage';
import { bookingsApi, clientsApi, configSummaryApi, paymentsApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getAll: jest.fn() }, clientsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() },
  configSummaryApi: { get: jest.fn() }, paymentRequestsApi: { getOne: jest.fn() },
  paymentsApi: { getOne: jest.fn(), getAll: jest.fn(), getNextDisplayId: jest.fn(), convert: jest.fn(), create: jest.fn(), update: jest.fn() },
}));
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
