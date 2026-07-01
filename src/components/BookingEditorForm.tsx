import React, { useEffect, useMemo, useState } from 'react';
import { bookingsApi, clientsApi, retreatsApi } from '../services/api';
import { RetreatClient, Client, Retreat, PaymentRequest } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import SearchablePaymentRequestSelect from './SearchablePaymentRequestSelect';
import AppleButton from './AppleButton';
import LoadingSpinner from './LoadingSpinner';

type BookingFormData = {
  clientId: string;
  retreatId: string;
  paymentRequestId: string;
  totalAmount: number;
  amountPaid: number;
  currency: 'EUR' | 'USD' | 'CZK' | 'PLN';
  status: 'pending' | 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  bookingNumber: string;
};

const bookingStatusValues = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'] as const;
type BookingStatus = typeof bookingStatusValues[number];

const normalizeBookingStatus = (status?: string | null): BookingStatus => {
  const normalized = status === 'checked_in' ? 'checked-in' : status === 'checked_out' ? 'checked-out' : status;
  return bookingStatusValues.includes(normalized as BookingStatus) ? normalized as BookingStatus : 'pending';
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

interface BookingEditorFormProps {
  mode: 'create' | 'edit';
  bookingId?: string;
  initialBooking?: RetreatClient | null;
  onCancel: () => void;
  onSaved: () => void;
  submitLabel?: string;
  showBackButton?: boolean;
}

const emptyForm = (): BookingFormData => ({
  clientId: '',
  retreatId: '',
  paymentRequestId: '',
  totalAmount: 0,
  amountPaid: 0,
  currency: 'EUR',
  status: 'pending',
  bookingNumber: '',
});

const BookingEditorForm: React.FC<BookingEditorFormProps> = ({
  mode,
  bookingId,
  initialBooking,
  onCancel,
  onSaved,
  submitLabel,
  showBackButton = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [booking, setBooking] = useState<RetreatClient | null>(initialBooking || null);
  const [formData, setFormData] = useState<BookingFormData>(emptyForm());
  const [bookingNumberError, setBookingNumberError] = useState('');

  useEffect(() => {
    loadData();
  }, [bookingId, initialBooking]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsResponse, retreatsResponse, nextNumberResponse] = await Promise.all([
        clientsApi.getAll(),
        retreatsApi.getAll(),
        mode === 'create'
          ? bookingsApi.getNextBookingNumber().catch((error) => {
              console.error('Error loading next booking number:', error);
              return { data: undefined };
            })
          : Promise.resolve({ data: undefined }),
      ]);
      setClients(clientsResponse.data || []);
      setRetreats(retreatsResponse.data || []);

      let currentBooking = initialBooking || null;
      if (mode === 'edit' && bookingId && !currentBooking) {
        const response = await bookingsApi.getOne(bookingId);
        currentBooking = response.data || null;
      }
      setBooking(currentBooking);

      if (currentBooking) {
        setFormData({
          clientId: typeof currentBooking.clientId === 'string' ? currentBooking.clientId : (currentBooking.clientId as any)?._id || '',
          retreatId: typeof currentBooking.retreatId === 'string' ? currentBooking.retreatId : (currentBooking.retreatId as any)?._id || '',
          paymentRequestId: typeof currentBooking.paymentRequestId === 'string' ? currentBooking.paymentRequestId : (currentBooking.paymentRequestId as any)?._id || '',
          totalAmount: Number(currentBooking.totalAmount || 0),
          amountPaid: Number(currentBooking.amountPaid || 0),
          currency: (currentBooking.currency || 'EUR') as BookingFormData['currency'],
          status: normalizeBookingStatus(currentBooking.status),
          bookingNumber: currentBooking.bookingNumber?.toString() || '',
        });
      } else {
        setFormData({
          ...emptyForm(),
          bookingNumber: nextNumberResponse.data ? String(nextNumberResponse.data) : '',
        });
      }
    } catch (error) {
      console.error('Error loading booking editor data:', error);
      setClients([]);
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveId = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value._id || '';
  };

  const handlePaymentRequestSelect = (paymentRequestId: string, paymentRequest?: PaymentRequest) => {
    setFormData((prev) => ({
      ...prev,
      paymentRequestId,
      clientId: paymentRequest?.clientId ? resolveId(paymentRequest.clientId) : prev.clientId,
      retreatId: paymentRequest?.retreatId ? resolveId(paymentRequest.retreatId) : prev.retreatId,
      totalAmount: paymentRequest?.fullPriceQuote ? Number(paymentRequest.fullPriceQuote) : prev.totalAmount,
      amountPaid: paymentRequest ? Number(paymentRequest.amountPaid || prev.amountPaid || 0) : prev.amountPaid,
      currency: paymentRequest?.currency ? paymentRequest.currency : prev.currency,
    }));
  };

  const handleClientSelect = (clientId: string) => {
    setFormData((prev) => ({
      ...prev,
      clientId,
      paymentRequestId: clientId === prev.clientId ? prev.paymentRequestId : '',
    }));
  };

  const validateBookingNumber = async (value: string) => {
    if (!value.trim()) {
      setBookingNumberError('');
      return true;
    }
    const numericBookingNumber = parseInt(value, 10);
    if (Number.isNaN(numericBookingNumber)) {
      setBookingNumberError('Booking number must be a valid number');
      return false;
    }
    try {
      const allBookings = await bookingsApi.getAll();
      const duplicate = (allBookings.data || []).some((existing: RetreatClient) => {
        const existingNumber = Number(existing.bookingNumber);
        return existingNumber === numericBookingNumber && existing._id !== bookingId;
      });
      if (duplicate) {
        setBookingNumberError(`Booking number ${numericBookingNumber} is already in use`);
        return false;
      }
      setBookingNumberError('');
      return true;
    } catch (error) {
      console.error('Error validating booking number:', error);
      setBookingNumberError('Unable to validate booking number');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumberError) return;
    try {
      setSaving(true);
      const bookingNumberValue = formData.bookingNumber.trim();
      const bookingNumber = bookingNumberValue ? Number(bookingNumberValue) : undefined;
      const payload = {
        clientId: formData.clientId,
        retreatId: formData.retreatId,
        paymentRequestId: formData.paymentRequestId || undefined,
        totalAmount: Number(formData.totalAmount || 0),
        amountPaid: Number(formData.amountPaid || 0),
        currency: formData.currency,
        status: formData.status,
        bookingNumber: Number.isFinite(bookingNumber) ? bookingNumber : undefined,
        registrationDate: booking?.registrationDate || new Date().toISOString(),
        checkInDate: booking?.checkInDate || new Date().toISOString(),
        checkOutDate: booking?.checkOutDate || new Date().toISOString(),
        roomAssignment: (booking as any)?.roomAssignment || '',
        specialRequests: (booking as any)?.specialRequests || '',
        notes: (booking as any)?.notes || '',
      };

      if (payload.bookingNumber != null) {
        const valid = await validateBookingNumber(String(payload.bookingNumber));
        if (!valid) return;
      }

      if (mode === 'edit' && bookingId) {
        await bookingsApi.update(bookingId, payload as any);
      } else {
        await bookingsApi.create(payload as any);
      }

      onSaved();
    } catch (error) {
      console.error('Error saving booking:', error);
      alert(`Error ${mode === 'edit' ? 'updating' : 'creating'} booking`);
    } finally {
      setSaving(false);
    }
  };

  const selectedPaymentRequest = useMemo(() => formData.paymentRequestId, [formData.paymentRequestId]);

  if (loading) {
    return <LoadingSpinner message={mode === 'edit' ? 'Loading booking...' : 'Loading form...'} />;
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking number</label>
            <input
              type="number"
              min={1001}
              step={1}
              value={formData.bookingNumber}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, bookingNumber: value });
                void validateBookingNumber(value);
              }}
              className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${bookingNumberError ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Optional"
            />
            {bookingNumberError && <p className="mt-1 text-sm text-red-600">{bookingNumberError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Booking dates</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 max-sm:rounded-none max-sm:border-x-0 max-sm:px-0 max-sm:py-2">
              <div>Registration: {formatDate(booking?.registrationDate)}</div>
              <div>Check-in: {formatDate(booking?.checkInDate)}</div>
              <div>Check-out: {formatDate(booking?.checkOutDate)}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Client</label>
            <SearchableClientSelect
              clients={clients}
              selectedClientId={formData.clientId}
              onClientSelect={handleClientSelect}
              placeholder="Search and select a client..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Retreat</label>
            <SearchableRetreatSelect
              retreats={retreats}
              selectedRetreatId={formData.retreatId}
              onRetreatSelect={(retreatId) => setFormData({ ...formData, retreatId })}
              placeholder="Search and select a retreat..."
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Payment request</label>
          <SearchablePaymentRequestSelect
            selectedPaymentRequestId={formData.paymentRequestId}
            onPaymentRequestSelect={handlePaymentRequestSelect}
            clientId={formData.clientId || undefined}
            placeholder={formData.clientId ? "Search this client's payment requests" : 'Search invoice, client, or retreat'}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Optional. Select one to auto-fill client, retreat, amount, and currency.</span>
            {selectedPaymentRequest && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, paymentRequestId: '' }))}
                className="text-blue-600 hover:text-blue-700"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Total amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount paid</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amountPaid}
              onChange={(e) => setFormData({ ...formData, amountPaid: Number(e.target.value) })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as BookingFormData['currency'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CZK">CZK</option>
              <option value="PLN">PLN</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingFormData['status'] })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="min-w-[220px] flex-1 text-xs text-gray-500">
            A booking can be created without a payment request. That is valid for cash or offline payment flows.
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <AppleButton type="button" onClick={onCancel} className="apple-button-secondary">
              Cancel
            </AppleButton>
            <AppleButton type="submit" className="apple-button-primary" disabled={saving}>
              {saving ? 'Saving...' : submitLabel || (mode === 'edit' ? 'Update Booking' : 'Add Booking')}
            </AppleButton>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BookingEditorForm;
