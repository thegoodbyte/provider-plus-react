import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentRequestsGrid from './PaymentRequestsGrid';
import { paymentRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({ paymentRequestsApi: { getAllFresh: jest.fn() } }));
jest.mock('./ClientAvatar', () => () => null);
jest.mock('./EmailComposeModal', () => () => null);

const requests = [
  { _id: 'deposit', invoiceNumber: 'INV-DEPOSIT', requestedAmount: 2500, fullPriceQuote: 9500, currency: 'PLN', paymentDate: '2026-09-18' },
  { _id: 'balance', invoiceNumber: 'INV-BALANCE', requestedAmount: 4000, fullPriceQuote: 8000, currency: 'PLN', paymentDate: '2026-09-17' },
  { _id: 'zero', invoiceNumber: 'INV-ZERO', requestedAmount: 0, amountPaid: 900, fullPriceQuote: 7000, currency: 'PLN', paymentDate: '2026-09-16' },
  { _id: 'legacy', invoiceNumber: 'INV-LEGACY', amountPaid: 1200, fullPriceQuote: 6500, currency: 'PLN', paymentDate: '2026-09-15' },
];
beforeEach(() => { (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: requests }); });
const mount = () => render(<MemoryRouter><PaymentRequestsGrid /></MemoryRouter>);
it('shows the requested installment, preserves zero and supports legacy amounts instead of the full quote', async () => {
  mount();
  await screen.findByRole('button', { name: 'Requested amount' });
  for (const [invoice, amount] of [['INV-DEPOSIT', 2500], ['INV-ZERO', 0], ['INV-LEGACY', 1200]] as const) {
    const row = screen.getByRole('button', { name: invoice }).closest('tr')!;
    expect(within(row).getByText(`${amount.toLocaleString()} PLN`)).toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: 'Quote' })).not.toBeInTheDocument();
  expect(screen.queryByText(`${(9500).toLocaleString()} PLN`)).not.toBeInTheDocument();
});
it('sorts and searches by the requested amount', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Requested amount' }));
  expect(within(screen.getAllByRole('row')[1]).getByText('INV-BALANCE')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search payment requests' }), { target: { value: '2500' } });
  expect(screen.getByText('INV-DEPOSIT')).toBeInTheDocument();
  expect(screen.queryByText('INV-BALANCE')).not.toBeInTheDocument();
});

it('filters paid, unpaid and paid without any booking, including joint-request line items', async () => {
  (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [
    { _id: 'p', invoiceNumber: 'PAID-NO-BOOKING', status: 'paid', bookingId: null },
    { _id: 'b', invoiceNumber: 'PAID-BOOKED', status: 'paid', bookingId: { _id: 'booking' } },
    { _id: 'j', invoiceNumber: 'PAID-JOINT', status: 'paid', lineItems: [{ bookingId: 'booking' }] },
    { _id: 's', invoiceNumber: 'SENT', status: 'sent' },
    { _id: 'o', invoiceNumber: 'OVERDUE', status: 'overdue' },
    { _id: 'n', invoiceNumber: 'PENDING', status: 'pending' },
    { _id: 'c', invoiceNumber: 'CANCELLED', status: 'cancelled' },
  ] });
  mount();
  const filter = await screen.findByRole('combobox', { name: 'Payment status' });
  fireEvent.change(filter, { target: { value: 'paid-unbooked' } });
  expect(screen.getByText('PAID-NO-BOOKING')).toBeInTheDocument();
  expect(screen.queryByText('PAID-BOOKED')).not.toBeInTheDocument();
  expect(screen.queryByText('PAID-JOINT')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 of 7');
  fireEvent.change(filter, { target: { value: 'paid' } });
  expect(screen.getByRole('status')).toHaveTextContent('3 of 7');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search payment requests' }), { target: { value: 'JOINT' } });
  expect(screen.getByRole('status')).toHaveTextContent('1 of 7');
  fireEvent.click(screen.getByText('Clear filters'));
  fireEvent.change(filter, { target: { value: 'unpaid' } });
  expect(screen.getByRole('status')).toHaveTextContent('3 of 7');
  expect(screen.queryByText('CANCELLED')).not.toBeInTheDocument();
  expect(screen.queryByText('PAID-NO-BOOKING')).not.toBeInTheDocument();
});
