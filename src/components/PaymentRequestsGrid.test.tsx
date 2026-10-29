import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentRequestsGrid from './PaymentRequestsGrid';
import { paymentRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({ paymentRequestsApi: { getAllFresh: jest.fn(), cancel: jest.fn() } }));
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

it('allows cancelling an invoice (storno) from the grid actions', async () => {
  (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [
    { _id: 'req-1', invoiceNumber: 'INV-ACTIVE', status: 'pending', requestedAmount: 1500, currency: 'EUR' },
  ] });
  (paymentRequestsApi.cancel as jest.Mock).mockResolvedValue({ data: { _id: 'req-1', status: 'cancelled' } });
  mount();

  const cancelButton = await screen.findByTitle('Cancel invoice (Storno)');
  fireEvent.click(cancelButton);

  expect(screen.getByRole('heading', { name: 'Cancel Invoice (Storno)' })).toBeInTheDocument();
  expect(screen.getByText(/Are you sure you want to cancel Invoice #INV-ACTIVE\?/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Confirm Cancellation' }));
  await screen.findByText('Invoice cancelled (storno).');
  expect(paymentRequestsApi.cancel).toHaveBeenCalledWith('req-1', 'Client did not pay');
});

 it('shows confirmed single/joint booking numbers and client booking shortcuts', async () => {
  (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [
    { _id: 'one', invoiceNumber: 'SINGLE', clientId: 'client-1', bookingId: { _id: 'book-1', bookingNumber: 1907 } },
    { _id: 'joint', invoiceNumber: 'JOINT', lineItems: [{ bookingId: { _id: 'book-2', bookingNumber: 1908 } }, { bookingId: { _id: 'book-3', bookingNumber: 1909 } }, { bookingId: { _id: 'book-2', bookingNumber: 1908 } }] },
    { _id: 'none', invoiceNumber: 'UNLINKED', clientId: 'client-2' },
  ] });mount();
  expect(await screen.findByRole('link', { name: 'Booking #1907' })).toHaveAttribute('href', '/admin/bookings/book-1');
  expect(screen.getAllByRole('link', { name: 'Booking #1908' })).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Booking #1909' })).toHaveAttribute('href', '/admin/bookings/book-3');
  expect(screen.getByText('No booking linked')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Client bookings' }).map(link => link.getAttribute('href'))).toEqual(expect.arrayContaining(['/admin/clients/client-1?tab=bookings', '/admin/clients/client-2?tab=bookings']));
 });

it('combines detailed filters with search/status and resets every filter', async () => {
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[
  {...requests[0],clientId:{firstName:'Ewa',lastName:'Franus'},status:'sent'},
  {...requests[1],clientId:{firstName:'Ewa',lastName:'Franus'},status:'paid'},
  {...requests[2],clientId:{firstName:'Samuel'},status:'sent'},
 ]});
 mount(); await screen.findByText('INV-DEPOSIT');
 fireEvent.change(screen.getByLabelText('Client name'),{target:{value:'franus'}});
 fireEvent.change(screen.getByLabelText('Requested amount from'),{target:{value:'2500'}});
 fireEvent.change(screen.getByLabelText('Requested amount to'),{target:{value:'2500'}});
 fireEvent.change(screen.getByLabelText('Currency'),{target:{value:'PLN'}});
 fireEvent.change(screen.getByLabelText('Request date from'),{target:{value:'2026-09-18'}});
 fireEvent.change(screen.getByLabelText('Request date to'),{target:{value:'2026-09-18'}});
 fireEvent.change(screen.getByLabelText('Payment status'),{target:{value:'unpaid'}});
 expect(screen.getByText('INV-DEPOSIT')).toBeInTheDocument(); expect(screen.queryByText('INV-BALANCE')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Search payment requests'),{target:{value:'BALANCE'}});
 expect(screen.getByText(/No payment requests match your filters/)).toBeInTheDocument();
 fireEvent.click(screen.getByText('Clear filters'));
 expect(screen.getByText('INV-BALANCE')).toBeInTheDocument();expect(screen.getByLabelText('Client name')).toHaveValue('');expect(screen.getByLabelText('Currency')).toHaveValue('');
 fireEvent.change(screen.getByLabelText('Requested amount from'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Requested amount to'),{target:{value:'1'}});
 expect(screen.getByRole('alert')).toHaveTextContent('must not exceed');expect(screen.queryByText('INV-DEPOSIT')).not.toBeInTheDocument();
});
