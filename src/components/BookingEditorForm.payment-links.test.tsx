import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingEditorForm from './BookingEditorForm';
import { bookingsApi, clientsApi, paymentRequestsApi, ceremoniesApi } from '../services/api';
import { roomInventoryApi } from '../services/roomInventoryApi';
jest.mock('../services/authService', () => ({ authService: { getUser: () => ({ role: 'staff' }) } }));
jest.mock('../services/api', () => ({ bookingsApi: { update: jest.fn(), getOne: jest.fn(), isBookingNumberAvailable: jest.fn() }, clientsApi: { getBookingOptions: jest.fn() }, ceremoniesApi: { getByRetreat: jest.fn() }, paymentRequestsApi: { getOne: jest.fn(), getAllFresh: jest.fn() }, referralsApi: { getAll: jest.fn() } }));
jest.mock('../services/roomInventoryApi', () => ({ roomInventoryApi: { view: jest.fn(), options: jest.fn(), preference: jest.fn() } }));
jest.mock('./SearchablePaymentRequestSelect', () => ({ __esModule: true, default: ({ onPaymentRequestSelect }: any) => <button type="button" onClick={() => onPaymentRequestSelect('new-request', { _id: 'new-request', retreatId: 'other-retreat', currency: 'USD', fullPrice: 9999, roomType: 'single' })}>Choose replacement request</button> }));
const booking: any = { _id: 'booking', bookingNumber: 1902, clientId: 'client', retreatId: 'retreat', paymentRequestId: 'old-request', totalAmount: 1000, amountPaid: 400, currency: 'PLN', status: 'confirmed', registrationDate: '2026-10-20', bookingType: 'full_retreat', roomType: 'private' };
beforeEach(() => {
 jest.clearAllMocks(); (bookingsApi.isBookingNumberAvailable as jest.Mock).mockResolvedValue({ data: { available: true } }); (clientsApi.getBookingOptions as jest.Mock).mockResolvedValue({ data: [{ _id: 'client', firstName: 'Synthetic', lastName: 'Client' }] });
 (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'old-request', requestedAmount: 1000, currency: 'PLN' } });
 (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
 (roomInventoryApi.view as jest.Mock).mockResolvedValue({ data: null }); (roomInventoryApi.options as jest.Mock).mockResolvedValue({ data: [] });
 (roomInventoryApi.preference as jest.Mock).mockResolvedValue({ data: null });
 (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({ data: [] }); (bookingsApi.update as jest.Mock).mockResolvedValue({ data: booking });
});
const open = () => render(<BookingEditorForm mode="edit" bookingId="booking" initialBooking={booking} initialRetreats={[{ _id: 'retreat', name: 'Current Retreat', type: 'regular', startDate: '2099-01-01', endDate: '2099-01-07' } as any]} onSaved={jest.fn()} onCancel={jest.fn()} />);
it('sends explicit null when clearing the primary request', async () => {
 open(); fireEvent.click(await screen.findByRole('button', { name: /Clear selection/i })); fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
 await waitFor(() => expect(bookingsApi.update).toHaveBeenCalledWith('booking', expect.objectContaining({ paymentRequestId: null, totalAmount: 1000, currency: 'PLN', retreatId: 'retreat' })));
});
it('keeps the existing agreement when choosing a request with different defaults', async () => {
 open(); fireEvent.click(await screen.findByRole('button', { name: 'Choose replacement request' })); fireEvent.click(screen.getByRole('button', { name: 'Update Booking' }));
 await waitFor(() => expect(bookingsApi.update).toHaveBeenCalledWith('booking', expect.objectContaining({ paymentRequestId: 'new-request', totalAmount: 1000, currency: 'PLN', retreatId: 'retreat', roomType: 'private' })));
});
