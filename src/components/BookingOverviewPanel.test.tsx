import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingOverviewPanel, { formatBookingDate, formatHistoryDateTime, retreatTown, sentConfirmationStep } from './BookingOverviewPanel';
import { paymentRequestsApi, paymentsApi } from '../services/api';
import { useBookingRequirements } from './useBookingRequirements';

jest.mock('../services/api', () => ({ paymentsApi: { getByBooking: jest.fn(), getByBookingHash: jest.fn(), convertToUsd: jest.fn() }, paymentRequestsApi: { getByBooking: jest.fn() } }));
jest.mock('./useBookingRequirements', () => ({ useBookingRequirements: jest.fn() }));
const requirement = { key: 'ekg', label: 'Entry EKG', required: true, uploaded: false, satisfied: false, reviewed: false, relatedItems: [] };
const base = { bookingId: 'b', booking: { bookingNumber: 3, bookingHash: 'booking-hash', totalAmount: 100, currency: 'USD', registrationDate: '2026-01-01', bookingConfirmationHistory: [] }, client: { _id: 'c', email: 'a@b.com', phone: '1', country: 'CZ' }, retreat: { _id: 'r', name: 'Retreat', locationTown: 'Mistrovice', startDate: '2026-09-01', endDate: '2026-09-08' }, clientName: 'Ada', bookingTypeCode: 'F', retreatCode: 'RET', retreatAddress: 'Address', onEditClient: jest.fn(), onBookingRefresh: jest.fn(), onOpenTab: jest.fn(), onSendConfirmation: jest.fn() };

describe('BookingOverviewPanel', () => {
  beforeEach(() => { jest.clearAllMocks(); (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [{ _id: 'p1', amount: 30, currency: 'USD', status: 'completed' }] }); (paymentsApi.getByBookingHash as jest.Mock).mockResolvedValue({ data: [] }); (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 100 } }); (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] }); (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [requirement], items: [], loading: false }); });
  it('formats dates and towns safely', () => { expect(formatBookingDate()).toBe('N/A'); expect(formatBookingDate('bad')).toBe('N/A'); expect(formatHistoryDateTime('bad')).toBe('N/A'); expect(retreatTown({ house: { city: 'Town' } })).toBe('Town'); });
  it('renders the operational dashboard and routes its actions', async () => { render(<BookingOverviewPanel {...base} />); await waitFor(() => expect(screen.getByText('$30.00')).toBeInTheDocument()); expect(screen.getByText('Needs attention')).toBeInTheDocument(); expect(screen.getByText('Entry EKG not received')).toBeInTheDocument(); expect(screen.getByText('Confirmation not sent')).toBeInTheDocument(); fireEvent.click(screen.getByText('Payments tab')); expect(base.onOpenTab).toHaveBeenCalledWith('payments'); fireEvent.click(screen.getByText('Send confirmation')); expect(base.onSendConfirmation).toHaveBeenCalled(); });
  it('shows sent confirmation and completed requirements', () => { (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [{ ...requirement, uploaded: true, satisfied: true }], items: [], loading: false }); render(<BookingOverviewPanel {...base} booking={{ ...base.booking, bookingConfirmationHistory: [{ sentAt: '2026-01-02' }] }} />); expect(screen.getByText('Sent')).toBeInTheDocument(); expect(screen.queryByText('Entry EKG not received')).not.toBeInTheDocument(); });
  it('uses a completed booking-flow confirmation when legacy history is empty', () => { (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [requirement], items: [{ key: 'booking_confirmation_sent', status: 'sent', emailSentAt: '2026-01-03' }], loading: false }); render(<BookingOverviewPanel {...base} />); expect(screen.getByText('Sent')).toBeInTheDocument(); expect(screen.queryByText('Confirmation not sent')).not.toBeInTheDocument(); expect(screen.getByText(/^Last sent /)).toBeInTheDocument(); });
  it('does not treat a pending confirmation step as sent', () => { expect(sentConfirmationStep([{ key: 'booking_confirmation_sent', status: 'pending' } as any])).toBeUndefined(); });
  it('uses the same USD settlement and shows overpayment as the payments tab', async () => {
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [
      { amount: 1245, currency: 'USD', usd_amount: 1245, status: 'completed' },
      { amount: 805, currency: 'USD', usd_amount: 805, status: 'completed' },
    ] });
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 1950 } });
    render(<BookingOverviewPanel {...base} booking={{ ...base.booking, totalAmount: 7500, currency: 'PLN' }} />);
    expect(await screen.findByText('Overpaid $100.00')).toBeInTheDocument();
    expect(screen.getByText('$2,050.00')).toBeInTheDocument();
    expect(screen.getByText('Client credit')).toBeInTheDocument();
    expect(screen.queryByText('Balance not requested')).not.toBeInTheDocument();
  });
  it('recalculates USD from the current price instead of showing a stale pre-edit snapshot', async () => {
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 2223 } });
    render(<BookingOverviewPanel {...base} booking={{ ...base.booking, totalAmount: 8550, totalAmountUsd: 4446, currency: 'PLN' }} />);
    expect(await screen.findByText('$2,223.00')).toBeInTheDocument();
    expect(screen.queryByText('$4,446.00')).not.toBeInTheDocument();
    expect(paymentsApi.convertToUsd).toHaveBeenCalledWith(8550, 'PLN');
  });
  it('includes a newly created refund linked through the legacy booking hash', async () => {
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [
      { _id: 'paid', amount: 2050, currency: 'USD', usd_amount: 2050, status: 'completed' },
    ] });
    (paymentsApi.getByBookingHash as jest.Mock).mockResolvedValue({ data: [
      { _id: 'refund', amount: -100, currency: 'USD', usd_amount: -100, paymentType: 'refund', status: 'completed' },
    ] });
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 1950 } });
    render(<BookingOverviewPanel {...base} booking={{ ...base.booking, totalAmount: 7500, currency: 'PLN' }} />);
    expect(await screen.findByText('Paid in full')).toBeInTheDocument();
    expect(screen.getAllByText('$1,950.00')).toHaveLength(2);
    expect(screen.queryByText(/Overpaid/)).not.toBeInTheDocument();
  });
});
