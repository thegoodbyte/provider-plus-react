import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedRecords, { recordRelations } from './RelatedRecords';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { get: jest.fn() } }));
const show = (record: any, path = '/admin/payments/p1') => render(<MemoryRouter initialEntries={[path]}><RelatedRecords records={recordRelations(record)} /></MemoryRouter>);
it('links directly to numbered client, booking, request and retreat records', () => {
  show({ clientId: { _id: 'c1', display_id: 101, firstName: 'Ada', lastName: 'Guest' }, bookingId: { _id: 'b1', bookingNumber: 202 }, paymentRequestId: { _id: 'r1', display_id: 303 }, retreatId: { _id: 't1', code: 'F-JNO' } });
  expect(screen.getByRole('link', { name: 'Client #101 · Ada Guest' })).toHaveAttribute('href', '/admin/clients/c1');
  expect(screen.getByRole('link', { name: 'Booking #202' })).toHaveAttribute('href', '/admin/bookings/b1');
  expect(screen.getByRole('link', { name: 'Payment request #303' })).toHaveAttribute('href', '/admin/payment-requests/r1');
  expect(screen.getByRole('link', { name: 'Retreat #F-JNO' })).toHaveAttribute('href', '/admin/retreats/t1');
});
it('resolves raw ID references to their human-readable numbers', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: { _id: 'b1', bookingNumber: 202 } }); show({ bookingId: 'b1' });
  expect(await screen.findByRole('link', { name: 'Booking #202' })).toHaveAttribute('href', '/admin/bookings/b1');
});
it('preserves role-prefixed and unprefixed routes', () => {
  const view = show({ bookingId: { _id: 'b1', bookingNumber: 202 } }, '/staff/payments/p1');
  expect(screen.getByRole('link')).toHaveAttribute('href', '/staff/bookings/b1'); view.unmount();
  show({ bookingId: { _id: 'b1', bookingNumber: 202 } }, '/payments/p1'); expect(screen.getByRole('link')).toHaveAttribute('href', '/bookings/b1');
});
it('omits missing IDs, deduplicates joint allocations and never treats allocation IDs as payment IDs', () => {
  show({ clientId: { _id: 'c1', display_id: 101 }, allocations: [{ _id: 'allocation-1', clientId: { _id: 'c1', display_id: 101 } }, { bookingId: {} }] });
  expect(screen.getAllByRole('link')).toHaveLength(1); expect(screen.queryByText(/allocation-1/)).not.toBeInTheDocument();
});
it('omits self links and empty sections', () => {
  show({ paymentId: { _id: 'p1', display_id: 400 } }); expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
it('uses the service request detail route', () => {
  show({ paymentRequestId: { _id: 'r1', display_id: 303, context: 'standalone_service' } }); expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/payment-requests/services/r1');
});
it('keeps the direct relationship usable if optional label lookup fails', async () => {
  (api.get as jest.Mock).mockRejectedValue(new Error('forbidden')); show({ bookingId: 'b1' });
  await waitFor(() => expect(api.get).toHaveBeenCalled()); expect(screen.getByRole('link', { name: 'Booking' })).toHaveAttribute('href', '/admin/bookings/b1');
});
it('ignores mismatched display metadata instead of linking the wrong record', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: { _id: 'wrong', bookingNumber: 999 } }); show({ bookingId: 'b1', bookingDetails: { _id: 'other', bookingNumber: 111 } });
  await waitFor(() => expect(api.get).toHaveBeenCalled()); expect(screen.queryByRole('link', { name: /999|111/ })).not.toBeInTheDocument(); expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/bookings/b1');
});

it('preserves numbered details when a joint allocation repeats only a raw ID', () => {
  show({ clientId: { _id: 'c1', display_id: 101, firstName: 'Ada' }, allocations: [{ clientId: 'c1' }] });
  expect(screen.getByRole('link', { name: 'Client #101 · Ada' })).toHaveAttribute('href', '/admin/clients/c1');
  expect(api.get).not.toHaveBeenCalled();
});
