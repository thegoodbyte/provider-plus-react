import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import BookingPaymentManagement from './BookingPaymentManagement';
import { configSummaryApi, paymentRequestsApi, paymentsApi } from '../services/api';

jest.mock('../services/api', () => ({
  paymentsApi: {
    getBookingPlan: jest.fn(), getByBooking: jest.fn(), getByBookingHash: jest.fn(),
    getTypes: jest.fn(), convertToUsd: jest.fn(), updateBookingPlan: jest.fn(),
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
    (paymentsApi.getBookingPlan as jest.Mock).mockResolvedValue({ data: null });
    (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getByBookingHash as jest.Mock).mockResolvedValue({ data: [payment] });
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [payment] });
    (paymentsApi.getTypes as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 1950 } });
    (configSummaryApi.get as jest.Mock).mockResolvedValue({ data: {} });
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
});
