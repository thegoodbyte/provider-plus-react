import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingOverviewPanel, { formatBookingDate, formatHistoryDateTime, retreatTown } from './BookingOverviewPanel';
import { paymentRequestsApi, paymentsApi } from '../services/api';
import { useBookingRequirements } from './useBookingRequirements';

jest.mock('../services/api', () => ({ paymentsApi: { getByBooking: jest.fn() }, paymentRequestsApi: { getByBooking: jest.fn() } }));
jest.mock('./useBookingRequirements', () => ({ useBookingRequirements: jest.fn() }));
const requirement = { key: 'ekg', label: 'Entry EKG', required: true, uploaded: false, reviewed: false, relatedItems: [] };
const base = { bookingId: 'b', booking: { bookingNumber: 3, totalAmount: 100, currency: 'USD', registrationDate: '2026-01-01', bookingConfirmationHistory: [] }, client: { _id: 'c', email: 'a@b.com', phone: '1', country: 'CZ' }, retreat: { _id: 'r', name: 'Retreat', locationTown: 'Mistrovice', startDate: '2026-09-01', endDate: '2026-09-08' }, clientName: 'Ada', bookingTypeCode: 'F', retreatCode: 'RET', retreatAddress: 'Address', onEditClient: jest.fn(), onBookingRefresh: jest.fn(), onOpenTab: jest.fn(), onSendConfirmation: jest.fn() };

describe('BookingOverviewPanel', () => {
  beforeEach(() => { jest.clearAllMocks(); (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [{ amount: 30, status: 'completed' }] }); (paymentRequestsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] }); (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [requirement], loading: false }); });
  it('formats dates and towns safely', () => { expect(formatBookingDate()).toBe('N/A'); expect(formatBookingDate('bad')).toBe('N/A'); expect(formatHistoryDateTime('bad')).toBe('N/A'); expect(retreatTown({ house: { city: 'Town' } })).toBe('Town'); });
  it('renders the operational dashboard and routes its actions', async () => { render(<BookingOverviewPanel {...base} />); await waitFor(() => expect(screen.getByText('$30.00')).toBeInTheDocument()); expect(screen.getByText('Needs attention')).toBeInTheDocument(); expect(screen.getByText('Entry EKG not received')).toBeInTheDocument(); expect(screen.getByText('Confirmation not sent')).toBeInTheDocument(); fireEvent.click(screen.getByText('Payments tab')); expect(base.onOpenTab).toHaveBeenCalledWith('payments'); fireEvent.click(screen.getByText('Send confirmation')); expect(base.onSendConfirmation).toHaveBeenCalled(); });
  it('shows sent confirmation and completed requirements', () => { (useBookingRequirements as jest.Mock).mockReturnValue({ rows: [{ ...requirement, uploaded: true }], loading: false }); render(<BookingOverviewPanel {...base} booking={{ ...base.booking, bookingConfirmationHistory: [{ sentAt: '2026-01-02' }] }} />); expect(screen.getByText('Sent')).toBeInTheDocument(); expect(screen.queryByText('Entry EKG not received')).not.toBeInTheDocument(); });
});
