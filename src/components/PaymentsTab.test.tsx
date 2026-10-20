import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentsTab from './PaymentsTab';
import { paymentsApi, bookingsApi } from '../services/api';

jest.mock('../services/api', () => ({
  paymentsApi: {
    getByRetreat: jest.fn(),
    getRetreatSummary: jest.fn(),
    delete: jest.fn(),
    processRefund: jest.fn(),
  },
  bookingsApi: {
    getByRetreatWithDetails: jest.fn(),
  },
}));

const summary = {
  totalPayments: 0, totalPaymentsEUR: 0, completedPayments: 0, completedPaymentsEUR: 0, completedPaymentsUSD: 1200,
  pendingPayments: 0, pendingPaymentsEUR: 0, pendingPaymentsUSD: 0, refundedPayments: 0, refundedPaymentsEUR: 0,
  paymentsByMethod: { bank_transfer: 1200 }, paymentsByStatus: {}, depositsPaid: 0, depositsEUR: 0, depositsUSD: 0,
  finalPaymentsPaid: 0, finalPaymentsEUR: 0, finalPaymentsUSD: 0,
};

// PPVC-900: one booking each for two clients on the retreat.
const bookings = [
  {
    _id: 'b1', retreatId: 'r1', currency: 'EUR', totalAmount: 1000, amountPaid: 600,
    clientId: { _id: 'c1', firstName: 'Eva', lastName: 'Novak', display_id: 1194 },
  },
  {
    _id: 'b2', retreatId: 'r1', currency: 'EUR', totalAmount: 800, amountPaid: 800,
    clientId: { _id: 'c2', firstName: 'Jan', lastName: 'Kowalski', display_id: 1195 },
  },
];

const payments = [
  {
    _id: 'p1', clientId: { _id: 'c1', firstName: 'Eva', lastName: 'Novak', display_id: 1194 }, bookingId: 'b1',
    amount: 600, currency: 'EUR', status: 'completed', paymentMethod: 'bank_transfer', paymentType: 'deposit_refundable',
    description: 'Deposit', isDeposit: true, isFinalPayment: false, paymentDate: '2026-09-01T00:00:00.000Z',
  },
  {
    _id: 'p2', clientId: { _id: 'c2', firstName: 'Jan', lastName: 'Kowalski', display_id: 1195 }, bookingId: 'b2',
    amount: 800, currency: 'EUR', status: 'completed', paymentMethod: 'card', paymentType: 'regular_payment',
    description: 'Full payment', isDeposit: false, isFinalPayment: true, paymentDate: '2026-09-02T00:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  (paymentsApi.getByRetreat as jest.Mock).mockResolvedValue({ data: payments });
  (paymentsApi.getRetreatSummary as jest.Mock).mockResolvedValue({ data: summary });
  (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({ data: bookings });
});

const renderTab = () => render(<MemoryRouter><PaymentsTab retreatId="r1" /></MemoryRouter>);

it('PPVC-900: defaults to the flat list view with the existing payments table', async () => {
  renderTab();
  expect(await screen.findByText('Transaction ID')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /List/ })).toHaveClass('is-active');
});

it('PPVC-900: switches to one column per client, showing header totals, payments and balance', async () => {
  renderTab();
  await screen.findByText('Transaction ID');

  fireEvent.click(screen.getByRole('button', { name: /Columns/ }));

  // One column per client, keyed by client identity.
  const evaColumn = screen.getByText('Eva Novak').closest('.payment-column') as HTMLElement;
  expect(evaColumn).toBeTruthy();
  expect(within(evaColumn).getByText('#1194')).toBeInTheDocument();
  expect(within(evaColumn).getByText('Agreed: 1,000 EUR')).toBeInTheDocument();
  expect(within(evaColumn).getByText('600 EUR')).toBeInTheDocument();
  expect(within(evaColumn).getByText('Deposit')).toBeInTheDocument();
  // Reused server-maintained financial summary, not re-derived: balance = 1000 - 600 = 400.
  expect(within(evaColumn).getByText('400 EUR')).toBeInTheDocument();
  expect(within(evaColumn).getByText('partial')).toBeInTheDocument();

  const janColumn = screen.getByText('Jan Kowalski').closest('.payment-column') as HTMLElement;
  expect(within(janColumn).getByText('#1195')).toBeInTheDocument();
  expect(within(janColumn).getByText('Agreed: 800 EUR')).toBeInTheDocument();
  expect(within(janColumn).getByText('paid')).toBeInTheDocument();

  // The flat table is gone while in column view.
  expect(screen.queryByText('Transaction ID')).not.toBeInTheDocument();
});

it('PPVC-900: switching back to List restores the flat table', async () => {
  renderTab();
  await screen.findByText('Transaction ID');
  fireEvent.click(screen.getByRole('button', { name: /Columns/ }));
  expect(screen.queryByText('Transaction ID')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /List/ }));
  expect(await screen.findByText('Transaction ID')).toBeInTheDocument();
});
