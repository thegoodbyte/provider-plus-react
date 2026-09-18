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
  fireEvent.change(screen.getByPlaceholderText('Search by client, retreat, amount, invoice...'), { target: { value: '2500' } });
  expect(screen.getByText('INV-DEPOSIT')).toBeInTheDocument();
  expect(screen.queryByText('INV-BALANCE')).not.toBeInTheDocument();
});
