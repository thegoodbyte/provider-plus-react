jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientDetailView from './ClientDetailView';
import { api, clientsApi, clientMedicalApi, bookingsApi, notesApi, paymentRequestsApi, paymentsApi } from '../services/api';

jest.mock('../services/api', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: { count: 0 } }) },
  clientsApi: { getOne: jest.fn(), getProfilePictureBlob: jest.fn() },
  clientMedicalApi: { getByClient: jest.fn() },
  clientRequirementsApi: { getByClient: jest.fn() },
  remindersApi: { getByClient: jest.fn() },
  bookingsApi: { getByClient: jest.fn() },
  notesApi: { getByClient: jest.fn() },
  paymentRequestsApi: { getByClient: jest.fn() },
  paymentsApi: { getByClient: jest.fn() },
}));

const client = { _id: 'c1', firstName: 'Eva', lastName: 'Novak', email: 'eva@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: client });
  (clientMedicalApi.getByClient as jest.Mock).mockResolvedValue({ data: null });
  (bookingsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
  (notesApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
  (paymentRequestsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
  (paymentsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
});

const openPaymentsTab = async () => {
  render(<MemoryRouter><ClientDetailView clientId="c1" onBack={jest.fn()} /></MemoryRouter>);
  fireEvent.click(await screen.findByText('💳 Payments'));
};

// PPVC-7: the payments tab previously only fetched/rendered payment requests
// (invoices) -- a booking with real recorded payments but no payment request
// showed an empty tab. The tab now also fetches and shows actual payments.
it('PPVC-7: shows recorded payments with the booking they belong to, not just payment requests', async () => {
  (paymentsApi.getByClient as jest.Mock).mockResolvedValue({
    data: [{
      _id: 'pay1', clientId: 'c1', amount: 500, currency: 'EUR', status: 'completed',
      paymentMethod: 'bank_transfer', paymentType: 'deposit_refundable', paymentDate: '2026-09-01T00:00:00.000Z',
      retreatId: { _id: 'r1', name: 'September Retreat', retreatCode: 'SEP-26' },
      bookingId: { _id: 'b1', bookingNumber: 1234 },
    }],
  });
  await openPaymentsTab();
  expect(await screen.findByText('500 EUR')).toBeInTheDocument();
  expect(screen.getByText(/Booking: SEP-26 #1234/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View booking' })).toBeInTheDocument();
  expect(paymentsApi.getByClient).toHaveBeenCalledWith('c1');
});

it('PPVC-7: shows an empty state instead of silently hiding the section when there are no recorded payments', async () => {
  await openPaymentsTab();
  expect(await screen.findByText('No payments recorded yet.')).toBeInTheDocument();
});

it('keeps showing payment requests alongside the new payments section', async () => {
  (paymentRequestsApi.getByClient as jest.Mock).mockResolvedValue({
    data: [{ _id: 'req1', invoiceNumber: 'INV-1', requestType: 'deposit', requestedAmount: 500, currency: 'EUR', status: 'pending' }],
  });
  await openPaymentsTab();
  expect(await screen.findByText('INV-1')).toBeInTheDocument();
  expect(screen.getByText('💳 Payment Requests')).toBeInTheDocument();
});
