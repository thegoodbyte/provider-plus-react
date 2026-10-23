import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BookingPaymentManagement from './BookingPaymentManagement';
import { configSummaryApi, paymentRequestsApi, paymentsApi } from '../services/api';

jest.mock('../services/api', () => ({
  paymentsApi: {
    getFinancialSummary: jest.fn(), getBookingPlan: jest.fn(), getByBooking: jest.fn(), getByBookingHash: jest.fn(),
    getTypes: jest.fn(), convertToUsd: jest.fn(), updateBookingPlan: jest.fn(),
    updateBookingPrice: jest.fn(), getByClient: jest.fn(), getUnlinkedCandidatesByBooking: jest.fn(), update: jest.fn(),
  },
  paymentRequestsApi: { getByBooking: jest.fn() },
  configSummaryApi: { get: jest.fn().mockResolvedValue({ data: {} }) },
}));

jest.mock('./CurrencyDisplay', () => ({ amount, currency }: any) => <span>{currency} {Number(amount).toFixed(2)}</span>);

const payment = {
  _id: 'payment-1', display_id: 1080, amount: 2250, currency: 'PLN', usd_amount: 585,
  paymentDate: '2026-02-25T12:00:00.000Z', paymentMethod: 'bank_transfer',
  paymentType: 'deposit_non_refundable', status: 'completed', isRefundable: false,
};

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}{useLocation().search}</span>;
const renderPage = () => render(<MemoryRouter initialEntries={['/admin/bookings/booking-1/payments']}><><BookingPaymentManagement
  bookingId="booking-1" bookingHash="booking-hash" bookingNumber={1186} clientName="Arkadiusz Bujak"
  clientId="client-1" retreatId="retreat-1" totalAmount={7500} currency="PLN"
/><LocationProbe/></></MemoryRouter>);

describe('BookingPaymentManagement PPVC-493 layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: { price: 7500, currency: 'PLN', grossReceived: 2250, refunded: 0, netPaid: 2250, balance: 5250, overpayment: 0, paidInFull: false, state: 'partial', sourceState: 'verified_ledger', cachedAmountPaid: 999, calculated: { netPaid: 2250 } } });
    (paymentsApi.getBookingPlan as jest.Mock).mockResolvedValue({ data: null });
    (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getByBookingHash as jest.Mock).mockResolvedValue({ data: [payment] });
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [payment] });
    (paymentsApi.getTypes as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 1950 } });
    (configSummaryApi.get as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('keeps client-only money out of a booking without a hash until staff explicitly link it', async () => {
    const unlinked = { ...payment, clientId: 'client-1', retreatId: undefined, description: 'Medical exam before booking' };
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getByClient as jest.Mock).mockResolvedValue({ data: [unlinked] });
    (paymentsApi.getUnlinkedCandidatesByBooking as jest.Mock).mockResolvedValue({ data: [unlinked] });
    (paymentsApi.update as jest.Mock).mockImplementation(async () => {
      (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [{ ...unlinked, bookingId: 'booking-1', retreatId: 'retreat-1' }] });
      (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [{ _id: 'request-903', invoiceNumber: '903', requestedAmount: 2250, currency: 'PLN', status: 'paid', paymentId: payment }] });
      return { data: unlinked };
    });
    render(<MemoryRouter><BookingPaymentManagement bookingId="booking-1" clientId="client-1" retreatId="retreat-1" totalAmount={7500} currency="PLN" /></MemoryRouter>);
    await waitFor(() => expect(paymentsApi.getByClient).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /view payment/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Link existing payment' }));
    await screen.findByRole('option', { name: /Medical exam before booking/ });
    fireEvent.change(screen.getByLabelText('Existing Payment'), { target: { value: 'payment-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Link Payment' }));
    await waitFor(() => expect(paymentsApi.update).toHaveBeenCalledWith('payment-1', expect.objectContaining({ bookingId: 'booking-1', clientId: 'client-1', retreatId: 'retreat-1' })));
    expect(await screen.findByRole('button', { name: /view payment/i })).toBeInTheDocument();
    expect(await screen.findByText(/Request #903/)).toBeInTheDocument();
    expect(paymentRequestsApi.getByBooking).toHaveBeenCalledTimes(2);
  });

  it('saves an itemized booking price and asks the parent to refresh the canonical booking', async () => {
    const refreshed = jest.fn();
    render(<MemoryRouter><BookingPaymentManagement bookingId="booking-1" clientId="client-1" retreatId="retreat-1" totalAmount={9500} currency="PLN" onPaymentUpdate={refreshed} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Manage booking price' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add discount' }));
    fireEvent.change(screen.getByLabelText('Price item 1 description'), { target: { value: '10% common room discount' } });
    fireEvent.change(screen.getByLabelText('Price item 1 amount'), { target: { value: '950' } });
    fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Room discount agreed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save price' }));
    await waitFor(() => expect(paymentsApi.updateBookingPrice).toHaveBeenCalledWith('booking-1', expect.objectContaining({ basePrice: 9500, adjustments: [expect.objectContaining({ type: 'discount', amount: 950 })] })));
    await waitFor(() => expect(refreshed).toHaveBeenCalled());
  });

  it('renders the redesigned summary, requests, and payment history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByText('Booking #1186 · Arkadiusz Bujak')).toBeInTheDocument();
    expect(screen.getByText(/Not fully paid/)).toBeInTheDocument();
    expect(screen.getByText('No payment request yet')).toBeInTheDocument();
    expect(screen.getByText('Payment history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view payment/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Record a payment' })).toHaveLength(2);
  });

  it('refreshes both payments and the booking payment plan', async () => {
    renderPage();
    const refresh = await screen.findByRole('button', { name: /refresh/i });
    await waitFor(() => expect(paymentsApi.getByBooking).toHaveBeenCalledTimes(1));
    fireEvent.click(refresh);
    await waitFor(() => expect(paymentsApi.getByBooking).toHaveBeenCalledTimes(2));
    expect(paymentsApi.getBookingPlan).toHaveBeenCalledTimes(2);
  });

  it('opens the shared payment editor with the exact booking and client', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Record a payment' }))[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/payments/new?bookingId=booking-1&clientId=client-1');
  });

  it('uses the server summary over independently reconstructed USD settlement', async () => {
    (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: { price: 7500, currency: 'PLN', grossReceived: 8000, refunded: 0, netPaid: 8000, balance: 0, overpayment: 500, paidInFull: true, state: 'overpaid', sourceState: 'verified_ledger' } });
    renderPage();
    expect(await screen.findByText('Paid in full')).toBeInTheDocument();
    expect(screen.getByText('Overpaid · client credit')).toBeInTheDocument();
    expect(screen.getByText('PLN 500.00')).toBeInTheDocument();
    expect(screen.queryByText(/Not fully paid/)).not.toBeInTheDocument();
  });
  it('exposes read-only historical classification without asserting settlement', async () => {
    (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({ data: { price: 7500, currency: 'PLN', netPaid: 7500, balance: 0, overpayment: 0, paidInFull: false, sourceState: 'unreconciled_history', cachedAmountPaid: 7500, calculated: { netPaid: 0 }, mismatchReason: 'No linked ledger entries' } });
    renderPage();
    expect(await screen.findByText('Reconciliation required')).toBeInTheDocument();
    expect(screen.getByText('No linked ledger entries')).toBeInTheDocument();
    expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
  });
  it('does not substitute local settlement when the summary fails', async () => {
    (paymentsApi.getFinancialSummary as jest.Mock).mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Financial summary unavailable');
    expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
  });
  it.each([null, [], {currency:'EUR'}])('keeps payment history usable for an invalid summary %p', async data => {
    (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({data});
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Financial summary unavailable');
    expect(screen.getByText(/Total unavailable/)).toBeInTheDocument();
    expect(screen.queryByText('Paid in full')).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

});

describe('PPVC-901 independently loaded payment requests',()=>{
 beforeEach(()=>{
  (paymentsApi.getTypes as jest.Mock).mockResolvedValue({data:[]});
  (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({data:{usd_amount:2500}});
  (configSummaryApi.get as jest.Mock).mockResolvedValue({data:{}});
  (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({data:{price:10500,currency:'PLN',netPaid:10500,balance:0,overpayment:0,paidInFull:true}});
  (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({data:[]});(paymentsApi.getByClient as jest.Mock).mockResolvedValue({data:[]});
  (paymentsApi.getByBookingHash as jest.Mock).mockResolvedValue({data:[]});
 });
 it('shows request 1392 even if optional payment-plan configuration fails',async()=>{
  (paymentsApi.getBookingPlan as jest.Mock).mockRejectedValue(Error('Optional plan unavailable'));
  (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({data:[{_id:'q1392',invoiceNumber:'1392',requestedAmount:10500,currency:'PLN',status:'paid',requestType:'full_payment',paymentId:'p1187'}]});
  renderPage();expect(await screen.findByText(/Request #1392/)).toBeVisible();expect(screen.queryByText('No payment request yet')).toBeNull();
 });
 it('reports an unavailable request list and allows retry instead of claiming none exist',async()=>{
  (paymentsApi.getBookingPlan as jest.Mock).mockResolvedValue({data:null});
  (paymentRequestsApi.getByBooking as jest.Mock).mockRejectedValueOnce(Error('Unavailable')).mockResolvedValue({data:[{_id:'q1392',invoiceNumber:'1392',requestedAmount:10500,currency:'PLN',status:'paid'}]});
  renderPage();expect(await screen.findByText('Payment requests could not be loaded. Retry before creating another request.')).toBeVisible();expect(screen.queryByText('No payment request yet')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Retry payment requests'}));expect(await screen.findByText(/Request #1392/)).toBeVisible();
 });
});
