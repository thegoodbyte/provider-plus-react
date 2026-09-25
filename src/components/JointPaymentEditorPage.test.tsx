import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JointPaymentEditorPage from './JointPaymentEditorPage';
import { bookingsApi, paymentRequestsApi, paymentsApi } from '../services/api';

jest.mock('../services/api', () => ({ bookingsApi: { getAll: jest.fn() }, paymentRequestsApi: { getAll: jest.fn() }, paymentsApi: { createJoint: jest.fn() } }));
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
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  fireEvent.keyDown(first, { key: 'Enter' });
  expect(paymentsApi.createJoint).not.toHaveBeenCalled();
  expect((first as HTMLInputElement).value).toContain('#1300');
  search(second, 'novakova');
  fireEvent.click(await screen.findByRole('option', { name: /#1301/ }));
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
