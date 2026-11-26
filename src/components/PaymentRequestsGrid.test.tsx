import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentRequestsGrid from './PaymentRequestsGrid';
import { paymentRequestsApi, serviceRequestsApi } from '../services/api';

jest.mock('../services/api', () => ({ paymentRequestsApi: { getAllFresh: jest.fn(), cancel: jest.fn() }, serviceRequestsApi: { get: jest.fn() } }));
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
const openMoreFilters = () => fireEvent.click(screen.getByRole('button', { name: /More filters/ }));
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

  fireEvent.click(await screen.findByRole('button', { name: 'More actions for request INV-ACTIVE' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Cancel invoice (Storno)' }));

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
 openMoreFilters();
 fireEvent.change(screen.getByLabelText('Client name'),{target:{value:'franus'}});
 fireEvent.change(screen.getByLabelText('Requested amount from'),{target:{value:'2500'}});
 fireEvent.change(screen.getByLabelText('Requested amount to'),{target:{value:'2500'}});
 fireEvent.change(screen.getByLabelText('Currency'),{target:{value:'PLN'}});
 fireEvent.change(screen.getByLabelText('Request date from'),{target:{value:'2026-09-18'}});
 fireEvent.change(screen.getByLabelText('Request date to'),{target:{value:'2026-09-18'}});
 fireEvent.change(screen.getByLabelText('Document kind'),{target:{value:'booking'}});
 fireEvent.change(screen.getByLabelText('Payment status'),{target:{value:'unpaid'}});
 expect(screen.getByText('INV-DEPOSIT')).toBeInTheDocument(); expect(screen.queryByText('INV-BALANCE')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Search payment requests'),{target:{value:'BALANCE'}});
 expect(screen.getByText(/No payment requests match your filters/)).toBeInTheDocument();
 fireEvent.click(screen.getByText('Clear filters'));
 expect(screen.getByText('INV-BALANCE')).toBeInTheDocument();expect(screen.getByLabelText('Client name')).toHaveValue('');expect(screen.getByLabelText('Currency')).toHaveValue('');expect(screen.getByLabelText('Document kind')).toHaveValue('all');expect(screen.getByLabelText('Payment status')).toHaveValue('all');
 fireEvent.change(screen.getByLabelText('Requested amount from'),{target:{value:'10'}});fireEvent.change(screen.getByLabelText('Requested amount to'),{target:{value:'1'}});
 expect(screen.getByRole('alert')).toHaveTextContent('must not exceed');expect(screen.queryByText('INV-DEPOSIT')).not.toBeInTheDocument();
});
it('distinguishes booking and itemized documents and shows the billing recipient and issued invoice', async () => {
  (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[requests[0],{_id:'service',context:'standalone_service',invoiceNumber:'SERVICE-969',requestedAmount:50,currency:'EUR',serviceDocument:{title:'Integration',client:{name:'Ewa Billing Company',email:'billing@example.invalid'}},invoiceDocument:{number:'INV-1969'}}]});
  mount();await screen.findByText('INV-DEPOSIT');openMoreFilters();
  const kind=screen.getByRole('combobox',{name:'Document kind'});fireEvent.change(kind,{target:{value:'itemized'}});
  expect(screen.getByText('Ewa Billing Company')).toBeInTheDocument();expect(screen.getByText('Itemized · INV-1969')).toBeInTheDocument();expect(screen.queryByText('INV-DEPOSIT')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));expect(screen.getByText('INV-DEPOSIT')).toBeInTheDocument();
});
it('combines client/retreat identity, removes redundant columns and keeps a visible Duplicate action',async()=>{
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[{_id:'copy',invoiceNumber:'COMPACT',currency:'PLN',requestedAmount:2500,usd_amount:630.25,clientId:{_id:'c',display_id:123,firstName:'Ewa',lastName:'Franus'},retreatId:{_id:'r',code:'NOV-29'}}]});
 mount();const row=(await screen.findByRole('button',{name:'COMPACT'})).closest('tr')!;
 const clientCell=row.querySelector('[data-label="Client"]')!;
 expect(clientCell).toHaveTextContent('Ewa Franus');expect(clientCell).toHaveTextContent('#123');expect(within(clientCell as HTMLElement).getByRole('link',{name:'NOV-29'})).toHaveAttribute('href','/admin/retreats/r');
 for(const label of ['Retreat','USD','Currency'])expect(screen.queryByRole('columnheader',{name:label})).not.toBeInTheDocument();
 fireEvent.click(within(row).getByRole('button',{name:'More actions for request COMPACT'}));
 expect(await screen.findByRole('button',{name:'Duplicate payment request'})).toHaveTextContent('Duplicate');
 fireEvent.click(within(row).getByRole('button',{name:'More actions for request COMPACT'}));
 const amount=within(row).getByText('2,500 PLN');expect(amount).toHaveAttribute('tabIndex','0');fireEvent.focus(amount);
 expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded USD equivalent: 630.25 USD');
});
it('does not present missing FX as zero USD and keeps standalone service context with the recipient',async()=>{
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[{_id:'service',invoiceNumber:'SERVICE',context:'standalone_service',currency:'EUR',requestedAmount:20,serviceDocument:{title:'Integration calls',client:{name:'One-off recipient'}}}]});
 mount();const row=(await screen.findByRole('button',{name:'SERVICE'})).closest('tr')!;
 expect(row.querySelector('[data-label="Client"]')).toHaveTextContent('Integration calls');expect(screen.queryByText('Unknown Retreat')).not.toBeInTheDocument();
 fireEvent.focus(within(row).getByText('20 EUR'));expect(await screen.findByRole('tooltip')).toHaveTextContent('USD equivalent not available');
});

it('shows filtered status counts without claiming requested sums are outstanding balances', async () => {
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[
  {_id:'a',invoiceNumber:'A',status:'pending',requestedAmount:9500,currency:'PLN'},
  {_id:'b',invoiceNumber:'B',status:'sent',requestedAmount:500,currency:'EUR'},
  {_id:'c',invoiceNumber:'C',status:'paid',requestedAmount:100,currency:'PLN'},
  {_id:'d',invoiceNumber:'D',status:'cancelled',requestedAmount:100,currency:'PLN'},
 ]}); mount();
 expect(await screen.findByText('2 awaiting payment · 4 total')).toBeInTheDocument();
 expect(screen.queryByText(/outstanding/i)).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Payment status'),{target:{value:'paid'}});
 expect(screen.getByText('0 awaiting payment · 1 total · filtered results')).toBeInTheDocument();
});
it('opens accessible secondary actions without cancelling or deleting a request', async () => {
 jest.clearAllMocks();
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[{_id:'a',invoiceNumber:'A',status:'pending'}]}); mount();
 fireEvent.click(await screen.findByRole('button',{name:'More actions for request A'}));
 expect(await screen.findByRole('button',{name:'Duplicate payment request'})).toBeInTheDocument();
 expect(screen.getByRole('menuitem',{name:'Delete'})).toBeInTheDocument();
 expect(screen.getByRole('menuitem',{name:'Cancel invoice (Storno)'})).toBeInTheDocument();
 expect(paymentRequestsApi.cancel).not.toHaveBeenCalled();
});

it('keeps a failed service duplication visible in the open action menu', async () => {
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({data:[{_id:'s',invoiceNumber:'SERVICE',context:'standalone_service',status:'pending'}]});
 (serviceRequestsApi.get as jest.Mock).mockRejectedValue(new Error('Service is temporarily unavailable')); mount();
 fireEvent.click(await screen.findByRole('button',{name:'More actions for request SERVICE'}));
 fireEvent.click(await screen.findByRole('button',{name:'Duplicate payment request'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Service is temporarily unavailable');
 expect(screen.getByRole('button',{name:'Duplicate payment request'})).toBeEnabled();
 expect(screen.getByRole('menuitem',{name:'Use cancellation from the service document'})).toHaveAttribute('aria-disabled','true');
});

describe('PPVC-1072 compact filter bar + More filters popover', () => {
  it('opens "More filters" on click, closes on a second click, and closes on an outside click', async () => {
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [requests[0]] });
    mount(); await screen.findByText('INV-DEPOSIT');
    expect(screen.queryByText('Document kind')).not.toBeInTheDocument();

    openMoreFilters();
    expect(await screen.findByRole('region', { name: 'More payment request filters' })).toBeInTheDocument();
    expect(screen.getByText('Document kind')).toBeInTheDocument();
    expect(screen.getByLabelText('Client name')).toBeInTheDocument();
    expect(screen.getByLabelText('Requested amount from')).toBeInTheDocument();
    expect(screen.getByLabelText('Requested amount to')).toBeInTheDocument();
    expect(screen.getByLabelText('Request date from')).toBeInTheDocument();
    expect(screen.getByLabelText('Request date to')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toBeInTheDocument();

    openMoreFilters();
    expect(screen.queryByText('Document kind')).not.toBeInTheDocument();

    openMoreFilters();
    expect(screen.getByText('Document kind')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Document kind')).not.toBeInTheDocument();
  });

  it('keeps the result count and Clear filters visible in the compact bar regardless of popover state', async () => {
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: requests });
    mount(); await screen.findByText('INV-DEPOSIT');
    fireEvent.change(screen.getByLabelText('Search payment requests'), { target: { value: 'BALANCE' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4 requests');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    openMoreFilters();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4 requests');
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('filters by the inline Retreat select and clears it with "Clear retreat"', async () => {
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [
      { _id: 'r1', invoiceNumber: 'RETREAT-ONE', status: 'pending', retreatId: { _id: 'ret-1', code: 'JNO-11-29' } },
      { _id: 'r2', invoiceNumber: 'RETREAT-TWO', status: 'pending', retreatId: { _id: 'ret-2', code: 'BEN-04-14' } },
    ] });
    mount(); await screen.findByText('RETREAT-ONE');
    fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'JNO-11' } });
    fireEvent.click(await screen.findByRole('option', { name: 'JNO-11-29' }));
    expect(screen.getByText('RETREAT-ONE')).toBeInTheDocument();
    expect(screen.queryByText('RETREAT-TWO')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear retreat' }));
    expect(screen.getByText('RETREAT-TWO')).toBeInTheDocument();
  });

  it('relocates the secondary action links behind a "More payment request actions" menu, still pointing at the correct routes', async () => {
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [requests[0]] });
    mount(); await screen.findByText('INV-DEPOSIT');
    expect(screen.queryByRole('link', { name: 'Booking link review' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More payment request actions' }));
    expect(await screen.findByRole('link', { name: 'Booking link review' })).toHaveAttribute('href', '/admin/payment-requests/booking-review');
    expect(screen.getByRole('link', { name: /New standalone service request/ })).toHaveAttribute('href', '/admin/payment-requests/services/new');
    expect(screen.getByText('Itemized · no booking required')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Service & policy settings' })).toHaveAttribute('href', '/admin/payment-requests/services/settings');
  });

  it('renders capitalized status labels, including "Void" for cancelled, without changing the underlying status value or cancel/delete gating', async () => {
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [
      { _id: 'p1', invoiceNumber: 'IS-PENDING', status: 'pending' },
      { _id: 'p2', invoiceNumber: 'IS-SENT', status: 'sent' },
      { _id: 'p3', invoiceNumber: 'IS-OVERDUE', status: 'overdue' },
      { _id: 'p4', invoiceNumber: 'IS-PAID', status: 'paid' },
      { _id: 'p5', invoiceNumber: 'IS-CANCELLED', status: 'cancelled', cancellationReason: 'Client did not pay' },
    ] });
    mount(); await screen.findByText('IS-PENDING');

    const statusCell = (invoice: string) => screen.getByRole('button', { name: invoice }).closest('tr')!.querySelector('[data-label="Status"]') as HTMLElement;
    expect(statusCell('IS-PENDING')).toHaveTextContent('Pending');
    expect(statusCell('IS-SENT')).toHaveTextContent('Sent');
    expect(statusCell('IS-OVERDUE')).toHaveTextContent('Overdue');
    expect(statusCell('IS-PAID')).toHaveTextContent('Paid');
    expect(statusCell('IS-CANCELLED')).toHaveTextContent('Void');
    expect(statusCell('IS-CANCELLED')).not.toHaveTextContent('cancelled');

    // Underlying gating still compares against the real status value, unaffected by the label map.
    // Opening the next row's menu closes the previous one automatically (shared open-menu state),
    // so there's no need to explicitly close each before opening the next.
    for (const invoice of ['IS-PENDING', 'IS-SENT', 'IS-OVERDUE']) {
      fireEvent.click(within(screen.getByRole('button', { name: invoice }).closest('tr')!).getByRole('button', { name: `More actions for request ${invoice}` }));
      expect(await screen.findByRole('menuitem', { name: 'Cancel invoice (Storno)' })).toBeInTheDocument();
    }
    for (const invoice of ['IS-PAID', 'IS-CANCELLED']) {
      fireEvent.click(within(screen.getByRole('button', { name: invoice }).closest('tr')!).getByRole('button', { name: `More actions for request ${invoice}` }));
      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Cancel invoice (Storno)' })).not.toBeInTheDocument();
    }
  }, 15000); // 5 sequential action-menu opens; antd's open/close transition makes each real-timer round trip ~700ms-1s.
});
